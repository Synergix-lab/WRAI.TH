package workflow

import (
	"context"
	"fmt"
)

// execAction executes an action node.
func (e *Engine) execAction(ctx context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	switch node.Type {
	case "action:spawn":
		return e.actionSpawn(ctx, project, node, execData)
	case "action:message":
		return e.actionMessage(ctx, project, node, execData)
	case "action:task":
		return e.actionTask(ctx, project, node, execData)
	case "action:team_notify":
		return e.actionTeamNotify(ctx, project, node, execData)
	case "action:broadcast":
		return e.actionBroadcast(ctx, project, node, execData)
	case "action:webhook_out":
		return e.actionWebhookOut(ctx, project, node, execData)
	case "action:elevate":
		return e.actionElevate(ctx, project, node, execData)
	case "action:schedule":
		return e.actionSchedule(ctx, project, node, execData)
	case "action:task_transition":
		return e.actionTaskTransition(ctx, project, node, execData)
	default:
		return nil, fmt.Errorf("unknown action type: %s", node.Type)
	}
}

// actionSpawn spawns a child agent via SpawnWithContext.
func (e *Engine) actionSpawn(ctx context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	profile := e.configStr(node, "profile", execData)
	cycle := e.configStr(node, "cycle", execData)
	taskID := e.configStr(node, "task_id", execData)

	if profile == "" {
		return nil, fmt.Errorf("action:spawn requires profile")
	}
	if cycle == "" {
		cycle = "default"
	}

	if e.spawnMgr == nil {
		return map[string]any{"status": "skipped", "reason": "spawn manager not available"}, nil
	}

	childID, err := e.spawnMgr.SpawnWithContext(project, profile, cycle, taskID)
	if err != nil {
		return nil, fmt.Errorf("spawn failed: %w", err)
	}

	return map[string]any{
		"status":   "spawned",
		"child_id": childID,
		"profile":  profile,
		"cycle":    cycle,
	}, nil
}

// actionMessage sends a message via the relay.
func (e *Engine) actionMessage(ctx context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	to := e.configStr(node, "to", execData)
	subject := e.configStr(node, "subject", execData)
	content := e.configStr(node, "content", execData)
	msgType := e.configStr(node, "type", execData)

	if to == "" || content == "" {
		return nil, fmt.Errorf("action:message requires to and content")
	}
	if msgType == "" {
		msgType = "notification"
	}

	if e.msgFunc == nil {
		return map[string]any{"status": "skipped", "reason": "message function not configured"}, nil
	}

	err := e.msgFunc(project, "workflow-engine", to, msgType, subject, content)
	if err != nil {
		return nil, fmt.Errorf("send message: %w", err)
	}

	return map[string]any{
		"status":  "sent",
		"to":      to,
		"subject": subject,
	}, nil
}

// actionTask dispatches a task.
func (e *Engine) actionTask(ctx context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	profile := e.configStr(node, "profile", execData)
	title := e.configStr(node, "title", execData)
	description := e.configStr(node, "description", execData)

	if profile == "" || title == "" {
		return nil, fmt.Errorf("action:task requires profile and title")
	}

	if e.taskFunc == nil {
		return map[string]any{"status": "skipped", "reason": "task function not configured"}, nil
	}

	taskID, err := e.taskFunc(project, profile, title, description)
	if err != nil {
		return nil, fmt.Errorf("dispatch task: %w", err)
	}

	return map[string]any{
		"status":  "dispatched",
		"task_id": taskID,
		"profile": profile,
		"title":   title,
	}, nil
}

// Stub implementations for Phase 3 action types

func (e *Engine) actionTeamNotify(_ context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	return map[string]any{"status": "not_implemented", "type": "team_notify"}, nil
}

func (e *Engine) actionBroadcast(_ context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	return map[string]any{"status": "not_implemented", "type": "broadcast"}, nil
}

func (e *Engine) actionWebhookOut(_ context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	return map[string]any{"status": "not_implemented", "type": "webhook_out"}, nil
}

func (e *Engine) actionElevate(_ context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	return map[string]any{"status": "not_implemented", "type": "elevate"}, nil
}

func (e *Engine) actionSchedule(_ context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	return map[string]any{"status": "not_implemented", "type": "schedule"}, nil
}

func (e *Engine) actionTaskTransition(_ context.Context, project string, node *Node, execData *execContext) (map[string]any, error) {
	return map[string]any{"status": "not_implemented", "type": "task_transition"}, nil
}
