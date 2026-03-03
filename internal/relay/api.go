package relay

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"agent-relay/internal/db"
	"agent-relay/internal/models"
)

// ServeAPI handles REST API requests for the web UI.
func (r *Relay) ServeAPI(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	path := strings.TrimPrefix(req.URL.Path, "/api")

	switch {
	case path == "/projects" && req.Method == http.MethodGet:
		r.apiGetProjects(w)
	case path == "/agents" && req.Method == http.MethodGet:
		r.apiGetAgents(w, req)
	case path == "/org" && req.Method == http.MethodGet:
		r.apiGetOrgTree(w, req)
	case path == "/agents/all" && req.Method == http.MethodGet:
		r.apiGetAllAgents(w)
	case path == "/conversations/all" && req.Method == http.MethodGet:
		r.apiGetAllConversations(w)
	case path == "/conversations" && req.Method == http.MethodGet:
		r.apiGetConversations(w, req)
	case strings.HasPrefix(path, "/conversations/") && strings.HasSuffix(path, "/messages") && req.Method == http.MethodGet:
		r.apiGetConversationMessages(w, path)
	case path == "/messages/all-projects" && req.Method == http.MethodGet:
		r.apiGetAllMessagesAllProjects(w)
	case path == "/messages/latest-all" && req.Method == http.MethodGet:
		r.apiGetLatestMessagesAllProjects(w, req)
	case path == "/messages/all" && req.Method == http.MethodGet:
		r.apiGetAllMessages(w, req)
	case path == "/messages/latest" && req.Method == http.MethodGet:
		r.apiGetLatestMessages(w, req)
	case path == "/user-response" && req.Method == http.MethodPost:
		r.apiPostUserResponse(w, req)
	// Memory endpoints
	case path == "/memories" && req.Method == http.MethodGet:
		r.apiGetMemories(w, req)
	case path == "/memories/search" && req.Method == http.MethodGet:
		r.apiSearchMemories(w, req)
	case path == "/memories" && req.Method == http.MethodPost:
		r.apiPostMemory(w, req)
	case strings.HasPrefix(path, "/memories/") && strings.HasSuffix(path, "/resolve") && req.Method == http.MethodPost:
		r.apiResolveMemoryConflict(w, req, path)
	case strings.HasPrefix(path, "/memories/") && req.Method == http.MethodDelete:
		r.apiDeleteMemory(w, path)
	default:
		http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
	}
}

// projectFromRequest extracts the ?project= query parameter, defaulting to "default".
func projectFromRequest(req *http.Request) string {
	p := req.URL.Query().Get("project")
	if p == "" {
		return "default"
	}
	return p
}

func (r *Relay) apiGetProjects(w http.ResponseWriter) {
	projects, err := r.DB.ListProjects()
	if err != nil {
		http.Error(w, `{"error":"failed to list projects"}`, http.StatusInternalServerError)
		return
	}
	if projects == nil {
		projects = []string{}
	}
	writeJSON(w, projects)
}

type apiAgent struct {
	Name         string  `json:"name"`
	Role         string  `json:"role"`
	Description  string  `json:"description"`
	LastSeen     string  `json:"last_seen"`
	RegisteredAt string  `json:"registered_at"`
	Online       bool    `json:"online"`
	ReportsTo    *string `json:"reports_to,omitempty"`
	Project      string  `json:"project"`
}

func (r *Relay) apiGetAgents(w http.ResponseWriter, req *http.Request) {
	project := projectFromRequest(req)

	agents, err := r.DB.ListAgents(project)
	if err != nil {
		http.Error(w, `{"error":"failed to list agents"}`, http.StatusInternalServerError)
		return
	}

	now := time.Now().UTC()
	result := make([]apiAgent, 0, len(agents))
	for _, a := range agents {
		online := false
		if t, err := time.Parse(time.RFC3339, a.LastSeen); err == nil {
			online = now.Sub(t) < 5*time.Minute
		}
		result = append(result, apiAgent{
			Name:         a.Name,
			Role:         a.Role,
			Description:  a.Description,
			LastSeen:     a.LastSeen,
			RegisteredAt: a.RegisteredAt,
			Online:       online,
			ReportsTo:    a.ReportsTo,
			Project:      project,
		})
	}

	writeJSON(w, result)
}

func (r *Relay) apiGetAllAgents(w http.ResponseWriter) {
	agents, err := r.DB.ListAllAgents()
	if err != nil {
		http.Error(w, `{"error":"failed to list agents"}`, http.StatusInternalServerError)
		return
	}

	now := time.Now().UTC()
	result := make([]apiAgent, 0, len(agents))
	for _, a := range agents {
		online := false
		if t, err := time.Parse(time.RFC3339, a.LastSeen); err == nil {
			online = now.Sub(t) < 5*time.Minute
		}
		result = append(result, apiAgent{
			Name:         a.Name,
			Role:         a.Role,
			Description:  a.Description,
			LastSeen:     a.LastSeen,
			RegisteredAt: a.RegisteredAt,
			Online:       online,
			ReportsTo:    a.ReportsTo,
			Project:      a.Project,
		})
	}

	writeJSON(w, result)
}

func (r *Relay) apiGetAllConversations(w http.ResponseWriter) {
	convs, err := r.DB.ListAllConversationsAcrossProjects()
	if err != nil {
		http.Error(w, `{"error":"failed to list conversations"}`, http.StatusInternalServerError)
		return
	}

	if convs == nil {
		convs = make([]models.ConversationWithMembers, 0)
	}

	writeJSON(w, convs)
}

func (r *Relay) apiGetAllMessagesAllProjects(w http.ResponseWriter) {
	msgs, err := r.DB.GetAllRecentMessagesAllProjects(500)
	if err != nil {
		http.Error(w, `{"error":"failed to get messages"}`, http.StatusInternalServerError)
		return
	}

	if msgs == nil {
		msgs = make([]models.Message, 0)
	}

	writeJSON(w, msgs)
}

func (r *Relay) apiGetLatestMessagesAllProjects(w http.ResponseWriter, req *http.Request) {
	since := req.URL.Query().Get("since")
	if since == "" {
		since = time.Now().UTC().Add(-30 * time.Second).Format("2006-01-02T15:04:05.000000Z")
	}

	msgs, err := r.DB.GetMessagesSinceAllProjects(since, 100)
	if err != nil {
		http.Error(w, `{"error":"failed to get messages"}`, http.StatusInternalServerError)
		return
	}

	if msgs == nil {
		msgs = make([]models.Message, 0)
	}

	writeJSON(w, msgs)
}

func (r *Relay) apiGetConversations(w http.ResponseWriter, req *http.Request) {
	project := projectFromRequest(req)

	convs, err := r.DB.ListAllConversations(project)
	if err != nil {
		http.Error(w, `{"error":"failed to list conversations"}`, http.StatusInternalServerError)
		return
	}

	if convs == nil {
		convs = make([]models.ConversationWithMembers, 0)
	}

	writeJSON(w, convs)
}

func (r *Relay) apiGetConversationMessages(w http.ResponseWriter, path string) {
	// path: /conversations/{id}/messages
	trimmed := strings.TrimPrefix(path, "/conversations/")
	convID, _, _ := strings.Cut(trimmed, "/")
	if convID == "" {
		http.Error(w, `{"error":"missing conversation id"}`, http.StatusBadRequest)
		return
	}

	msgs, err := r.DB.GetConversationMessages(convID, 200)
	if err != nil {
		http.Error(w, `{"error":"failed to get messages"}`, http.StatusInternalServerError)
		return
	}

	if msgs == nil {
		msgs = make([]models.Message, 0)
	}

	writeJSON(w, msgs)
}

func (r *Relay) apiGetAllMessages(w http.ResponseWriter, req *http.Request) {
	project := projectFromRequest(req)

	msgs, err := r.DB.GetAllRecentMessages(project, 500)
	if err != nil {
		http.Error(w, `{"error":"failed to get messages"}`, http.StatusInternalServerError)
		return
	}

	if msgs == nil {
		msgs = make([]models.Message, 0)
	}

	writeJSON(w, msgs)
}

func (r *Relay) apiGetLatestMessages(w http.ResponseWriter, req *http.Request) {
	project := projectFromRequest(req)
	since := req.URL.Query().Get("since")
	if since == "" {
		since = time.Now().UTC().Add(-30 * time.Second).Format("2006-01-02T15:04:05.000000Z")
	}

	msgs, err := r.DB.GetMessagesSince(project, since, 100)
	if err != nil {
		http.Error(w, `{"error":"failed to get messages"}`, http.StatusInternalServerError)
		return
	}

	if msgs == nil {
		msgs = make([]models.Message, 0)
	}

	writeJSON(w, msgs)
}

// apiGetOrgTree returns the agent hierarchy as a nested tree structure.
func (r *Relay) apiGetOrgTree(w http.ResponseWriter, req *http.Request) {
	project := projectFromRequest(req)

	agents, err := r.DB.GetOrgTree(project)
	if err != nil {
		http.Error(w, `{"error":"failed to get org tree"}`, http.StatusInternalServerError)
		return
	}

	now := time.Now().UTC()

	type orgNode struct {
		Name    string     `json:"name"`
		Role    string     `json:"role"`
		Online  bool       `json:"online"`
		Reports []*orgNode `json:"reports"`
	}

	// Build a map of nodes and track children
	nodeMap := make(map[string]*orgNode, len(agents))
	for _, a := range agents {
		online := false
		if t, err := time.Parse(time.RFC3339, a.LastSeen); err == nil {
			online = now.Sub(t) < 5*time.Minute
		}
		nodeMap[a.Name] = &orgNode{
			Name:    a.Name,
			Role:    a.Role,
			Online:  online,
			Reports: []*orgNode{},
		}
	}

	// Build tree
	var roots []*orgNode
	for _, a := range agents {
		node := nodeMap[a.Name]
		if a.ReportsTo != nil {
			if parent, ok := nodeMap[*a.ReportsTo]; ok {
				parent.Reports = append(parent.Reports, node)
				continue
			}
		}
		roots = append(roots, node)
	}

	if roots == nil {
		roots = []*orgNode{}
	}

	writeJSON(w, roots)
}

// apiPostUserResponse handles user responses from the web UI to agent questions.
func (r *Relay) apiPostUserResponse(w http.ResponseWriter, req *http.Request) {
	var body struct {
		Project string `json:"project"`
		To      string `json:"to"`
		Content string `json:"content"`
		ReplyTo string `json:"reply_to"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	if body.To == "" || body.Content == "" {
		http.Error(w, `{"error":"to and content are required"}`, http.StatusBadRequest)
		return
	}
	if body.Project == "" {
		body.Project = "default"
	}

	replyTo := optionalString(body.ReplyTo)

	msg, err := r.DB.InsertMessage(body.Project, "user", body.To, "response", "User response", body.Content, "{}", replyTo, nil)
	if err != nil {
		http.Error(w, `{"error":"failed to send response"}`, http.StatusInternalServerError)
		return
	}

	// Push notification to the target agent
	r.Registry.Notify(body.Project, body.To, "user", "User response", msg.ID)

	writeJSON(w, map[string]any{"ok": true, "message_id": msg.ID})
}

// --- Memory API endpoints ---

func (r *Relay) apiGetMemories(w http.ResponseWriter, req *http.Request) {
	project := req.URL.Query().Get("project")
	scope := req.URL.Query().Get("scope")
	agent := req.URL.Query().Get("agent")
	tag := req.URL.Query().Get("tag")

	var tags []string
	if tag != "" {
		tags = strings.Split(tag, ",")
	}

	var (
		memories []models.Memory
		err      error
	)

	if project == "" && scope == "" && agent == "" && len(tags) == 0 {
		memories, err = r.DB.ListAllMemories(200)
	} else {
		memories, err = r.DB.ListMemories(project, scope, agent, tags, 200)
	}

	if err != nil {
		http.Error(w, `{"error":"failed to list memories"}`, http.StatusInternalServerError)
		return
	}
	if memories == nil {
		memories = []models.Memory{}
	}
	writeJSON(w, memories)
}

func (r *Relay) apiSearchMemories(w http.ResponseWriter, req *http.Request) {
	query := req.URL.Query().Get("q")
	if query == "" {
		http.Error(w, `{"error":"q parameter required"}`, http.StatusBadRequest)
		return
	}

	memories, err := r.DB.SearchAllMemories(query, 50)
	if err != nil {
		http.Error(w, `{"error":"search failed"}`, http.StatusInternalServerError)
		return
	}
	if memories == nil {
		memories = []models.Memory{}
	}
	writeJSON(w, memories)
}

func (r *Relay) apiPostMemory(w http.ResponseWriter, req *http.Request) {
	var body struct {
		Project    string   `json:"project"`
		AgentName  string   `json:"agent_name"`
		Key        string   `json:"key"`
		Value      string   `json:"value"`
		Tags       []string `json:"tags"`
		Scope      string   `json:"scope"`
		Confidence string   `json:"confidence"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	if body.Key == "" || body.Value == "" {
		http.Error(w, `{"error":"key and value are required"}`, http.StatusBadRequest)
		return
	}
	if body.Project == "" {
		body.Project = "default"
	}
	if body.AgentName == "" {
		body.AgentName = "user"
	}
	if body.Scope == "" {
		body.Scope = "project"
	}

	tagsJSON := db.TagsToJSON(body.Tags)
	mem, err := r.DB.SetMemory(body.Project, body.AgentName, body.Key, body.Value, tagsJSON, body.Scope, body.Confidence)
	if err != nil {
		http.Error(w, `{"error":"failed to set memory"}`, http.StatusInternalServerError)
		return
	}
	writeJSON(w, mem)
}

func (r *Relay) apiDeleteMemory(w http.ResponseWriter, path string) {
	// path: /memories/{id}
	id := strings.TrimPrefix(path, "/memories/")
	if id == "" {
		http.Error(w, `{"error":"missing memory id"}`, http.StatusBadRequest)
		return
	}

	if err := r.DB.DeleteMemoryByID(id, "user"); err != nil {
		http.Error(w, `{"error":"failed to delete memory"}`, http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"deleted": true, "id": id})
}

func (r *Relay) apiResolveMemoryConflict(w http.ResponseWriter, req *http.Request, path string) {
	// path: /memories/{key}/resolve
	trimmed := strings.TrimPrefix(path, "/memories/")
	key, _, _ := strings.Cut(trimmed, "/")
	if key == "" {
		http.Error(w, `{"error":"missing key"}`, http.StatusBadRequest)
		return
	}

	var body struct {
		Project     string `json:"project"`
		ChosenValue string `json:"chosen_value"`
		Scope       string `json:"scope"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}
	if body.ChosenValue == "" {
		http.Error(w, `{"error":"chosen_value is required"}`, http.StatusBadRequest)
		return
	}
	if body.Project == "" {
		body.Project = "default"
	}
	if body.Scope == "" {
		body.Scope = "project"
	}

	mem, err := r.DB.ResolveConflict(body.Project, "user", key, body.ChosenValue, body.Scope)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"resolved": true, "memory": mem})
}

func writeJSON(w http.ResponseWriter, v any) {
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, `{"error":"encode failed"}`, http.StatusInternalServerError)
	}
}
