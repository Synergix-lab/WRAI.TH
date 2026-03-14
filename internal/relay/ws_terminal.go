package relay

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"agent-relay/internal/spawn"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// wsMessage is a message from the browser to the terminal.
type wsMessage struct {
	Type string `json:"type"` // "input", "resize", "ping"
	Data string `json:"data"`
	Rows uint16 `json:"rows"`
	Cols uint16 `json:"cols"`
}

// apiTerminalSpawn handles POST /api/terminal/spawn — creates a PTY session and returns the session ID.
func (r *Relay) apiTerminalSpawn(w http.ResponseWriter, req *http.Request) {
	var body struct {
		Project string `json:"project"`
		Profile string `json:"profile"`
		Cycle   string `json:"cycle"`
		TaskID  string `json:"task_id"`
		WorkDir string `json:"work_dir"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apiError(w, http.StatusBadRequest, "invalid JSON", err)
		return
	}
	if body.Project == "" {
		body.Project = "default"
	}
	if body.Profile == "" {
		http.Error(w, `{"error":"profile is required"}`, http.StatusBadRequest)
		return
	}

	if r.PTYMgr == nil {
		http.Error(w, `{"error":"PTY not available"}`, http.StatusServiceUnavailable)
		return
	}

	// Build context prompt from profile+cycle — interactive mode gets full context
	ctx, err := spawn.BuildSpawnContext(r.DB, body.Project, body.Profile, body.Cycle, body.TaskID, spawn.ModeInteractive)
	if err != nil {
		apiError(w, http.StatusBadRequest, "build context failed", err)
		return
	}
	prompt := spawn.FormatPrompt(ctx)

	sessionID, _, err := r.PTYMgr.Spawn(prompt, "", "30m", body.WorkDir)
	if err != nil {
		apiError(w, http.StatusConflict, "spawn failed", err)
		return
	}

	b, _ := json.Marshal(map[string]any{
		"session_id": sessionID,
		"profile":    body.Profile,
		"status":     "running",
	})
	w.WriteHeader(http.StatusCreated)
	w.Write(b)
}

// apiTerminalWS handles GET /api/terminal/ws/{sessionID} — upgrades to WebSocket.
// On connect, replays the 128KB ring buffer so the client sees full history,
// then streams live output. Multiple reconnects are supported.
func (r *Relay) apiTerminalWS(w http.ResponseWriter, req *http.Request, path string) {
	sessionID := strings.TrimPrefix(path, "/terminal/ws/")
	sessionID = strings.TrimSuffix(sessionID, "/")

	if r.PTYMgr == nil {
		http.Error(w, `{"error":"PTY not available"}`, http.StatusServiceUnavailable)
		return
	}

	sess := r.PTYMgr.Get(sessionID)
	if sess == nil {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		log.Printf("[ws-terminal] upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Subscribe to PTY output — get replay + live channel
	replay, live, subID := sess.Subscribe()
	defer sess.Unsubscribe(subID)

	// Send replay buffer first (full history)
	if len(replay) > 0 {
		if err := conn.WriteMessage(websocket.BinaryMessage, replay); err != nil {
			return
		}
	}

	// PTY live output → WebSocket (binary frames)
	wsDone := make(chan struct{})
	go func() {
		defer close(wsDone)
		for {
			select {
			case chunk, ok := <-live:
				if !ok {
					// Channel closed — subscriber removed or session ended
					conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"exit"}`))
					return
				}
				if err := conn.WriteMessage(websocket.BinaryMessage, chunk); err != nil {
					return
				}
			case <-sess.Done():
				conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"exit"}`))
				return
			}
		}
	}()

	// WebSocket → PTY input
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			break
		}

		if msgType == websocket.TextMessage {
			var msg wsMessage
			if json.Unmarshal(data, &msg) == nil {
				switch msg.Type {
				case "resize":
					if msg.Rows > 0 && msg.Cols > 0 {
						sess.Resize(msg.Rows, msg.Cols)
					}
				case "input":
					sess.Write([]byte(msg.Data))
				case "ping":
					conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"pong"}`))
				}
			}
		} else if msgType == websocket.BinaryMessage {
			sess.Write(data)
		}
	}

	<-wsDone
}

// apiTerminalKill handles POST /api/terminal/{sessionID}/kill.
func (r *Relay) apiTerminalKill(w http.ResponseWriter, path string) {
	sessionID := strings.TrimSuffix(strings.TrimPrefix(path, "/terminal/"), "/kill")

	if r.PTYMgr == nil {
		http.Error(w, `{"error":"PTY not available"}`, http.StatusServiceUnavailable)
		return
	}

	if err := r.PTYMgr.Kill(sessionID); err != nil {
		apiError(w, http.StatusNotFound, "kill failed", err)
		return
	}
	writeJSON(w, map[string]any{"session_id": sessionID, "status": "killed"})
}
