package relay

import (
	"sync"
	"time"

	"agent-relay/internal/models"
)

// MCPEvent represents a visual event triggered by an MCP tool call.
type MCPEvent struct {
	Type    string `json:"type"`             // event group: memory, task, register, sleep, vault, team
	Action  string `json:"action"`           // specific action: set, search, dispatch, claim, complete, block, etc.
	Agent   string `json:"agent"`            // agent that triggered it
	Project string `json:"project"`          // project scope
	Target  string `json:"target,omitempty"` // target agent/profile (for dispatch, team ops)
	Label   string `json:"label,omitempty"`  // short label (task title, memory key, etc.)
	TS      int64  `json:"ts"`               // unix ms

	// Semantic carries the notifications-engine payload for lifecycle events
	// (task.dispatched/claimed/in_progress/in_review/blocked/done). Populated only
	// for those; nil for plain visual events. Event name is in Type (e.g.
	// "task.claimed"); the canvas still reads Type/Action for visuals.
	Semantic *TaskEventPayload `json:"semantic,omitempty"`
}

// TaskEventPayload is the minimal, stable payload the notifications subsystem
// consumes for every task lifecycle transition. Kept tiny on purpose.
type TaskEventPayload struct {
	Agent     string  `json:"agent"`                // the agent that triggered the transition
	TaskID    string  `json:"task_id"`              // task UUID
	LinearKey *string `json:"linear_key,omitempty"` // e.g. SYN-123 (nil in native mode)
	Title     string  `json:"title"`                // one-line task title
}

// eventHistorySize is the fixed-size ring buffer for /api/events/recent.
// Keeps the last N MCP events so the UI can display recent activity even
// without an open SSE subscription (cold load, page refresh, etc.).
const eventHistorySize = 500

// EventBus broadcasts MCP events to SSE subscribers and retains a bounded
// history of recent events for HTTP polling.
type EventBus struct {
	mu      sync.RWMutex
	subs    map[chan MCPEvent]struct{}
	history []MCPEvent // ring buffer, newest last
}

func NewEventBus() *EventBus {
	return &EventBus{
		subs:    make(map[chan MCPEvent]struct{}),
		history: make([]MCPEvent, 0, eventHistorySize),
	}
}

func (b *EventBus) Emit(evt MCPEvent) {
	evt.TS = time.Now().UnixMilli()
	b.mu.Lock()
	// Append + trim to ring size
	b.history = append(b.history, evt)
	if len(b.history) > eventHistorySize {
		b.history = b.history[len(b.history)-eventHistorySize:]
	}
	subs := b.subs
	b.mu.Unlock()

	for ch := range subs {
		select {
		case ch <- evt:
		default: // drop if slow
		}
	}
}

// Recent returns up to limit most-recent events (newest first) optionally
// filtered by project. Limit 0 or negative uses the full buffer.
func (b *EventBus) Recent(project string, limit int) []MCPEvent {
	b.mu.RLock()
	defer b.mu.RUnlock()
	out := make([]MCPEvent, 0, len(b.history))
	// Walk newest → oldest
	for i := len(b.history) - 1; i >= 0; i-- {
		e := b.history[i]
		if project != "" && e.Project != project {
			continue
		}
		out = append(out, e)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

// emitTaskEvent emits a semantic task lifecycle event on the shared bus.
// name is the full semantic event name ("task.dispatched", "task.claimed",
// "task.in_progress", "task.blocked", "task.in_review", "task.done"); action is
// the short visual action the canvas already understands. The minimal payload
// {agent, task_id, linear_key, title} is attached for the notifications engine.
func emitTaskEvent(events *EventBus, name, action, project string, t *models.Task) {
	if events == nil || t == nil {
		return
	}
	events.Emit(MCPEvent{
		Type:    name,
		Action:  action,
		Agent:   t.DispatchedBy,
		Project: project,
		Label:   t.Title,
		Semantic: &TaskEventPayload{
			Agent:     agentForEvent(t),
			TaskID:    t.ID,
			LinearKey: t.LinearKey,
			Title:     t.Title,
		},
	})
}

// agentForEvent returns the most relevant agent for a task event: the assignee
// if claimed, else the dispatcher.
func agentForEvent(t *models.Task) string {
	if t.AssignedTo != nil && *t.AssignedTo != "" {
		return *t.AssignedTo
	}
	return t.DispatchedBy
}

func (b *EventBus) Subscribe() chan MCPEvent {
	ch := make(chan MCPEvent, 32)
	b.mu.Lock()
	b.subs[ch] = struct{}{}
	b.mu.Unlock()
	return ch
}

func (b *EventBus) Unsubscribe(ch chan MCPEvent) {
	b.mu.Lock()
	delete(b.subs, ch)
	b.mu.Unlock()
	close(ch)
}
