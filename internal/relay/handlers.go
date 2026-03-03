package relay

import (
	"context"
	"encoding/json"
	"fmt"

	"agent-relay/internal/db"
	"agent-relay/internal/models"

	"github.com/mark3labs/mcp-go/mcp"
)

type Handlers struct {
	db       *db.DB
	registry *SessionRegistry
}

func NewHandlers(db *db.DB, registry *SessionRegistry) *Handlers {
	return &Handlers{db: db, registry: registry}
}

func (h *Handlers) HandleRegisterAgent(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	name := req.GetString("name", "")
	if name == "" {
		return mcp.NewToolResultError("name is required"), nil
	}
	role := req.GetString("role", "")
	description := req.GetString("description", "")
	reportsTo := optionalString(req.GetString("reports_to", ""))

	agent, err := h.db.RegisterAgent(project, name, role, description, reportsTo)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to register agent: %v", err)), nil
	}

	// Register the session for push notifications
	if sess := sessionFromContext(ctx); sess != nil {
		h.registry.Register(project, name, sess.SessionID())
	}

	return resultJSON(agent)
}

func (h *Handlers) HandleSendMessage(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	from := resolveAgent(ctx, req)
	to := req.GetString("to", "")
	msgType := req.GetString("type", "notification")
	subject := req.GetString("subject", "")
	content := req.GetString("content", "")
	if content == "" {
		return mcp.NewToolResultError("content is required"), nil
	}

	metadata := req.GetString("metadata", "{}")
	replyTo := optionalString(req.GetString("reply_to", ""))
	conversationID := optionalString(req.GetString("conversation_id", ""))

	// Touch sender's last_seen
	_ = h.db.TouchAgent(project, from)

	if conversationID != nil {
		// Conversation message — validate membership
		isMember, err := h.db.IsConversationMember(*conversationID, from)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to check membership: %v", err)), nil
		}
		if !isMember {
			return mcp.NewToolResultError("you are not a member of this conversation"), nil
		}
		to = "" // no single recipient for conversation messages
	} else if to == "" {
		return mcp.NewToolResultError("to is required (or provide conversation_id)"), nil
	}

	msg, err := h.db.InsertMessage(project, from, to, msgType, subject, content, metadata, replyTo, conversationID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to send message: %v", err)), nil
	}

	// Push notification
	if conversationID != nil {
		h.notifyConversation(project, *conversationID, from, subject, msg.ID)
	} else if to == "*" {
		h.registry.NotifyBroadcast(project, from, subject, msg.ID)
	} else {
		h.registry.Notify(project, to, from, subject, msg.ID)
	}

	return resultJSON(msg)
}

func (h *Handlers) HandleGetInbox(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	agent := resolveAgent(ctx, req)
	unreadOnly := req.GetBool("unread_only", true)
	limit := req.GetInt("limit", 10)

	_ = h.db.TouchAgent(project, agent)

	messages, err := h.db.GetInbox(project, agent, unreadOnly, limit)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get inbox: %v", err)), nil
	}
	if messages == nil {
		messages = []models.Message{}
	}

	// Truncate content to keep response compact
	truncated := make([]map[string]any, len(messages))
	for i, m := range messages {
		content := m.Content
		if len(content) > 300 {
			content = content[:300] + "..."
		}
		entry := map[string]any{
			"id":         m.ID,
			"from":       m.From,
			"to":         m.To,
			"type":       m.Type,
			"subject":    m.Subject,
			"content":    content,
			"created_at": m.CreatedAt,
		}
		if m.ReplyTo != nil {
			entry["reply_to"] = *m.ReplyTo
		}
		if m.ConversationID != nil {
			entry["conversation_id"] = *m.ConversationID
		}
		truncated[i] = entry
	}

	return resultJSON(map[string]any{
		"agent":    agent,
		"count":    len(messages),
		"messages": truncated,
	})
}

func (h *Handlers) HandleGetThread(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	messageID := req.GetString("message_id", "")
	if messageID == "" {
		return mcp.NewToolResultError("message_id is required"), nil
	}

	messages, err := h.db.GetThread(messageID)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get thread: %v", err)), nil
	}
	if messages == nil {
		messages = []models.Message{}
	}

	return resultJSON(map[string]any{
		"count":    len(messages),
		"messages": messages,
	})
}

func (h *Handlers) HandleListAgents(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)

	agents, err := h.db.ListAgents(project)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list agents: %v", err)), nil
	}
	if agents == nil {
		agents = []models.Agent{}
	}

	return resultJSON(map[string]any{
		"count":  len(agents),
		"agents": agents,
	})
}

func (h *Handlers) HandleMarkRead(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	agent := resolveAgent(ctx, req)

	// Support marking a whole conversation as read
	convID := req.GetString("conversation_id", "")
	if convID != "" {
		if err := h.db.MarkConversationRead(convID, agent); err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to mark conversation read: %v", err)), nil
		}
		return resultJSON(map[string]any{
			"conversation_id": convID,
			"marked_read":     true,
		})
	}

	ids := req.GetStringSlice("message_ids", nil)
	if len(ids) == 0 {
		return mcp.NewToolResultError("message_ids or conversation_id is required"), nil
	}

	count, err := h.db.MarkRead(ids, agent)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to mark read: %v", err)), nil
	}

	return resultJSON(map[string]any{
		"marked_read": count,
	})
}

func (h *Handlers) HandleCreateConversation(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	agent := resolveAgent(ctx, req)
	title := req.GetString("title", "")
	if title == "" {
		return mcp.NewToolResultError("title is required"), nil
	}

	members := req.GetStringSlice("members", nil)
	if len(members) == 0 {
		return mcp.NewToolResultError("at least one other member is required"), nil
	}

	// Ensure creator is included in members
	found := false
	for _, m := range members {
		if m == agent {
			found = true
			break
		}
	}
	if !found {
		members = append([]string{agent}, members...)
	}

	conv, err := h.db.CreateConversation(project, title, agent, members)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to create conversation: %v", err)), nil
	}

	return resultJSON(map[string]any{
		"conversation": conv,
		"members":      members,
	})
}

func (h *Handlers) HandleListConversations(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	agent := resolveAgent(ctx, req)

	convs, err := h.db.ListConversations(project, agent)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list conversations: %v", err)), nil
	}
	if convs == nil {
		convs = []models.ConversationSummary{}
	}

	return resultJSON(map[string]any{
		"agent":         agent,
		"count":         len(convs),
		"conversations": convs,
	})
}

func (h *Handlers) HandleGetConversationMessages(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	agent := resolveAgent(ctx, req)
	convID := req.GetString("conversation_id", "")
	if convID == "" {
		return mcp.NewToolResultError("conversation_id is required"), nil
	}
	limit := req.GetInt("limit", 50)

	// Verify membership
	isMember, err := h.db.IsConversationMember(convID, agent)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to check membership: %v", err)), nil
	}
	if !isMember {
		return mcp.NewToolResultError("you are not a member of this conversation"), nil
	}

	messages, err := h.db.GetConversationMessages(convID, limit)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get messages: %v", err)), nil
	}
	if messages == nil {
		messages = []models.Message{}
	}

	// Auto-mark conversation as read when fetching messages
	_ = h.db.MarkConversationRead(convID, agent)

	format := req.GetString("format", "full")

	formatted := make([]map[string]any, len(messages))
	for i, m := range messages {
		entry := map[string]any{
			"id":         m.ID,
			"from":       m.From,
			"type":       m.Type,
			"subject":    m.Subject,
			"created_at": m.CreatedAt,
		}
		if m.ReplyTo != nil {
			entry["reply_to"] = *m.ReplyTo
		}
		switch format {
		case "compact":
			// metadata only — no content
		case "digest":
			c := m.Content
			if len(c) > 200 {
				c = c[:200] + "..."
			}
			entry["content"] = c
		default: // "full"
			entry["content"] = m.Content
			entry["metadata"] = m.Metadata
		}
		formatted[i] = entry
	}

	return resultJSON(map[string]any{
		"conversation_id": convID,
		"count":           len(formatted),
		"format":          format,
		"messages":        formatted,
	})
}

func (h *Handlers) HandleInviteToConversation(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	agent := resolveAgent(ctx, req)
	convID := req.GetString("conversation_id", "")
	if convID == "" {
		return mcp.NewToolResultError("conversation_id is required"), nil
	}
	invitee := req.GetString("agent_name", "")
	if invitee == "" {
		return mcp.NewToolResultError("agent_name is required"), nil
	}

	// Verify inviter is a member
	isMember, err := h.db.IsConversationMember(convID, agent)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to check membership: %v", err)), nil
	}
	if !isMember {
		return mcp.NewToolResultError("you are not a member of this conversation"), nil
	}

	if err := h.db.AddConversationMember(convID, invitee); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to invite: %v", err)), nil
	}

	// Notify the invitee
	h.registry.Notify(project, invitee, agent, fmt.Sprintf("You were invited to conversation: %s", convID), "")

	return resultJSON(map[string]any{
		"conversation_id": convID,
		"invited":         invitee,
	})
}

func (h *Handlers) notifyConversation(project, conversationID, senderName, subject, messageID string) {
	members, err := h.db.GetConversationMembers(conversationID)
	if err != nil {
		return
	}
	for _, m := range members {
		if m.AgentName != senderName {
			h.registry.Notify(project, m.AgentName, senderName, subject, messageID)
		}
	}
}

// resolveProject returns the project from the `project` tool parameter if set,
// otherwise falls back to the ?project= URL parameter from the connection.
func resolveProject(ctx context.Context, req mcp.CallToolRequest) string {
	if p := req.GetString("project", ""); p != "" {
		return p
	}
	return ProjectFromContext(ctx)
}

// resolveAgent returns the agent name from the `as` parameter if set,
// otherwise falls back to the URL context (for backward compatibility).
func resolveAgent(ctx context.Context, req mcp.CallToolRequest) string {
	if as := req.GetString("as", ""); as != "" {
		return as
	}
	return AgentFromContext(ctx)
}

// helpers

func resultJSON(data any) (*mcp.CallToolResult, error) {
	b, err := json.Marshal(data)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("json marshal: %v", err)), nil
	}
	return mcp.NewToolResultText(string(b)), nil
}

func optionalString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func sessionFromContext(ctx context.Context) clientSession {
	if sess, ok := ctx.Value(sessionKey).(clientSession); ok {
		return sess
	}
	return nil
}

type clientSession interface {
	SessionID() string
}

const sessionKey contextKey = "mcp_session"

// --- Memory handlers ---

func (h *Handlers) HandleSetMemory(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	agent := resolveAgent(ctx, req)
	key := req.GetString("key", "")
	if key == "" {
		return mcp.NewToolResultError("key is required"), nil
	}
	value := req.GetString("value", "")
	if value == "" {
		return mcp.NewToolResultError("value is required"), nil
	}
	scope := req.GetString("scope", "project")
	confidence := req.GetString("confidence", "stated")
	tags := req.GetStringSlice("tags", nil)
	tagsJSON := db.TagsToJSON(tags)

	mem, err := h.db.SetMemory(project, agent, key, value, tagsJSON, scope, confidence)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to set memory: %v", err)), nil
	}

	result := map[string]any{
		"memory": mem,
	}
	if mem.ConflictWith != nil {
		result["conflict"] = true
		result["message"] = fmt.Sprintf("Conflict detected: key '%s' already exists with a different value. Both versions preserved. Use resolve_conflict to pick the truth.", key)
	}

	return resultJSON(result)
}

func (h *Handlers) HandleGetMemory(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	agent := resolveAgent(ctx, req)
	key := req.GetString("key", "")
	if key == "" {
		return mcp.NewToolResultError("key is required"), nil
	}
	scope := req.GetString("scope", "")

	memories, err := h.db.GetMemory(project, agent, key, scope)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to get memory: %v", err)), nil
	}
	if memories == nil {
		memories = []models.Memory{}
	}

	result := map[string]any{
		"key":      key,
		"count":    len(memories),
		"memories": memories,
	}
	if len(memories) > 1 {
		result["conflict"] = true
		result["message"] = "Multiple values exist for this key. Use resolve_conflict to pick the truth."
	}

	return resultJSON(result)
}

func (h *Handlers) HandleSearchMemory(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	agent := resolveAgent(ctx, req)
	query := req.GetString("query", "")
	if query == "" {
		return mcp.NewToolResultError("query is required"), nil
	}
	scope := req.GetString("scope", "")
	tags := req.GetStringSlice("tags", nil)
	limit := req.GetInt("limit", 20)

	memories, err := h.db.SearchMemory(project, agent, query, tags, scope, limit)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to search memories: %v", err)), nil
	}
	if memories == nil {
		memories = []models.Memory{}
	}

	// Truncate values for compact response
	truncated := make([]map[string]any, len(memories))
	for i, m := range memories {
		val := m.Value
		if len(val) > 300 {
			val = val[:300] + "..."
		}
		truncated[i] = map[string]any{
			"id":         m.ID,
			"key":        m.Key,
			"value":      val,
			"tags":       m.Tags,
			"scope":      m.Scope,
			"agent_name": m.AgentName,
			"confidence": m.Confidence,
			"version":    m.Version,
			"updated_at": m.UpdatedAt,
			"conflict":   m.ConflictWith != nil,
		}
	}

	return resultJSON(map[string]any{
		"query":    query,
		"count":    len(truncated),
		"memories": truncated,
	})
}

func (h *Handlers) HandleListMemories(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	scope := req.GetString("scope", "")
	agentFilter := req.GetString("agent", "")
	tags := req.GetStringSlice("tags", nil)
	limit := req.GetInt("limit", 50)

	memories, err := h.db.ListMemories(project, scope, agentFilter, tags, limit)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to list memories: %v", err)), nil
	}
	if memories == nil {
		memories = []models.Memory{}
	}

	// Truncate values for compact response
	truncated := make([]map[string]any, len(memories))
	for i, m := range memories {
		val := m.Value
		if len(val) > 200 {
			val = val[:200] + "..."
		}
		truncated[i] = map[string]any{
			"id":         m.ID,
			"key":        m.Key,
			"value":      val,
			"tags":       m.Tags,
			"scope":      m.Scope,
			"project":    m.Project,
			"agent_name": m.AgentName,
			"confidence": m.Confidence,
			"version":    m.Version,
			"updated_at": m.UpdatedAt,
			"conflict":   m.ConflictWith != nil,
		}
	}

	return resultJSON(map[string]any{
		"count":    len(truncated),
		"memories": truncated,
	})
}

func (h *Handlers) HandleDeleteMemory(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	agent := resolveAgent(ctx, req)
	key := req.GetString("key", "")
	if key == "" {
		return mcp.NewToolResultError("key is required"), nil
	}
	scope := req.GetString("scope", "project")

	if err := h.db.DeleteMemory(project, agent, key, scope); err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to delete memory: %v", err)), nil
	}

	return resultJSON(map[string]any{
		"deleted": true,
		"key":     key,
		"scope":   scope,
	})
}

func (h *Handlers) HandleResolveConflict(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	project := resolveProject(ctx, req)
	agent := resolveAgent(ctx, req)
	key := req.GetString("key", "")
	if key == "" {
		return mcp.NewToolResultError("key is required"), nil
	}
	chosenValue := req.GetString("chosen_value", "")
	if chosenValue == "" {
		return mcp.NewToolResultError("chosen_value is required"), nil
	}
	scope := req.GetString("scope", "project")

	winner, err := h.db.ResolveConflict(project, agent, key, chosenValue, scope)
	if err != nil {
		return mcp.NewToolResultError(fmt.Sprintf("failed to resolve conflict: %v", err)), nil
	}

	return resultJSON(map[string]any{
		"resolved": true,
		"memory":   winner,
	})
}
