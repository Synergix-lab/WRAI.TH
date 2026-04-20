package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Attendee struct {
	Name string  `json:"name"`
	Rate float64 `json:"rate"`
}

type Meeting struct {
	ID        string     `json:"id"`
	Attendees []Attendee `json:"attendees"`
	Running   bool       `json:"running"`
	ElapsedS  float64    `json:"elapsed_s"`
	StartedAt *time.Time `json:"started_at,omitempty"`
	OuchUSD   float64    `json:"ouch_usd"`
	CostUSD   float64    `json:"cost_usd"`
	CreatedAt time.Time  `json:"created_at"`
}

var (
	mu        sync.RWMutex
	meetings  = map[string]*Meeting{}
	totalCnt  int64
	todayCnt  int64
	todayMu   sync.Mutex
	todayDate = time.Now().UTC().Format("2006-01-02")
)

func shortID() string { b := make([]byte, 4); rand.Read(b); return hex.EncodeToString(b) }

func (m *Meeting) snapshot() *Meeting {
	c := *m
	e := m.ElapsedS
	if m.Running && m.StartedAt != nil {
		e += time.Since(*m.StartedAt).Seconds()
	}
	var rates float64
	for _, a := range m.Attendees {
		rates += a.Rate
	}
	c.ElapsedS = e
	c.CostUSD = rates * e / 3600
	return &c
}

func writeJSON(w http.ResponseWriter, s int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(s)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, s int, msg string) {
	writeJSON(w, s, map[string]string{"error": msg})
}

func cors(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		h(w, r)
	}
}

func rollDay() {
	today := time.Now().UTC().Format("2006-01-02")
	todayMu.Lock()
	defer todayMu.Unlock()
	if today != todayDate {
		todayDate = today
		atomic.StoreInt64(&todayCnt, 0)
	}
}

func createMeeting(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, 405, "method not allowed"); return
	}
	id := shortID()
	m := &Meeting{ID: id, Attendees: []Attendee{}, OuchUSD: 500, CreatedAt: time.Now().UTC()}
	mu.Lock(); meetings[id] = m; mu.Unlock()
	writeJSON(w, 200, map[string]string{"id": id})
}

func meetingRouter(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/meeting/"), "/")
	if parts[0] == "" { writeErr(w, 404, "not found"); return }
	mu.RLock(); m, ok := meetings[parts[0]]; mu.RUnlock()
	if !ok { writeErr(w, 404, "meeting not found"); return }
	if len(parts) == 1 {
		if r.Method != http.MethodGet { writeErr(w, 405, "method not allowed"); return }
		mu.RLock(); snap := m.snapshot(); mu.RUnlock()
		writeJSON(w, 200, snap); return
	}
	switch parts[1] {
	case "attendees":
		if r.Method != http.MethodPost { writeErr(w, 405, "method not allowed"); return }
		var body struct{ Attendees []Attendee `json:"attendees"` }
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil { writeErr(w, 400, "invalid json"); return }
		mu.Lock(); m.Attendees = body.Attendees; snap := m.snapshot(); mu.Unlock()
		writeJSON(w, 200, snap)
	case "start":
		if r.Method != http.MethodPost { writeErr(w, 405, "method not allowed"); return }
		mu.Lock()
		if !m.Running {
			now := time.Now(); m.StartedAt = &now; m.Running = true
			rollDay(); atomic.AddInt64(&todayCnt, 1); atomic.AddInt64(&totalCnt, 1)
		}
		snap := m.snapshot(); mu.Unlock()
		writeJSON(w, 200, snap)
	case "pause":
		if r.Method != http.MethodPost { writeErr(w, 405, "method not allowed"); return }
		mu.Lock()
		if m.Running && m.StartedAt != nil {
			m.ElapsedS += time.Since(*m.StartedAt).Seconds()
			m.Running = false; m.StartedAt = nil
		}
		snap := m.snapshot(); mu.Unlock()
		writeJSON(w, 200, snap)
	case "reset":
		if r.Method != http.MethodPost { writeErr(w, 405, "method not allowed"); return }
		mu.Lock(); m.ElapsedS = 0; m.Running = false; m.StartedAt = nil; snap := m.snapshot(); mu.Unlock()
		writeJSON(w, 200, snap)
	case "tick":
		if r.Method != http.MethodGet { writeErr(w, 405, "method not allowed"); return }
		tickStream(w, r, m)
	default:
		writeErr(w, 404, "not found")
	}
}

func tickStream(w http.ResponseWriter, r *http.Request, m *Meeting) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	flusher, ok := w.(http.Flusher)
	if !ok { writeErr(w, 500, "stream unsupported"); return }
	t := time.NewTicker(time.Second); defer t.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-t.C:
			mu.RLock(); snap := m.snapshot(); mu.RUnlock()
			payload, _ := json.Marshal(map[string]float64{"elapsed_s": snap.ElapsedS, "cost_usd": snap.CostUSD})
			w.Write([]byte("data: ")); w.Write(payload); w.Write([]byte("\n\n"))
			flusher.Flush()
		}
	}
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	rollDay()
	writeJSON(w, 200, map[string]int64{
		"meetings_started_today": atomic.LoadInt64(&todayCnt),
		"meetings_started_total": atomic.LoadInt64(&totalCnt),
	})
}

func staticHandler(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Path
	switch {
	case p == "/" || strings.HasPrefix(p, "/m/"):
		http.ServeFile(w, r, "../frontend/index.html")
	case strings.HasPrefix(p, "/static/"):
		// Strip the /static/ prefix — the frontend files live flat in ../frontend/,
		// not in ../frontend/static/.
		http.ServeFile(w, r, "../frontend/"+strings.TrimPrefix(p, "/static/"))
	default:
		http.NotFound(w, r)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" { port = "8080" }
	mux := http.NewServeMux()
	mux.HandleFunc("/api/meeting", cors(createMeeting))
	mux.HandleFunc("/api/meeting/", cors(meetingRouter))
	mux.HandleFunc("/stats", cors(statsHandler))
	mux.HandleFunc("/", cors(staticHandler))
	http.ListenAndServe(":"+port, mux)
}
