package relay

import (
	"path/filepath"
	"testing"

	"agent-relay/internal/db"
)

// TestResolveAssignee_LinearRoutedLane covers the autonomy-loop unblock: a
// stale-scanner emits task-stale with only a task_id (a Linear-sourced task has
// no payload.agent and an empty profile_slug). The "assignee" target must still
// resolve the lead by routing the task's Linear project through linear_routing.
func TestResolveAssignee_LinearRoutedLane(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	database, err := db.NewTestDB(dbPath)
	if err != nil {
		t.Fatalf("create test db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	const project = "trovex-growth"
	const linearProj = "proj-wraith-uuid"

	// Mirror a Linear-sourced task carrying its Linear project id (and NO assignee).
	projID := linearProj
	taskID, _, err := database.UpsertLinearMirror(db.LinearMirrorSeed{
		Project:         project,
		LinearIssueID:   "iss-1",
		Title:           "stale me",
		Status:          "pending",
		LinearProjectID: &projID,
	})
	if err != nil {
		t.Fatalf("upsert mirror: %v", err)
	}

	// The owner-configured routing map: this Linear project → the wraith lead.
	database.SetSetting("linear_routing", `{"proj-wraith-uuid":"wraith-dev"}`)

	n := &Notifier{db: database}

	// payload.agent empty → must resolve via the task's Linear project → lane.
	got := n.resolveTargets(project, "assignee", map[string]any{"task_id": taskID})
	if len(got) != 1 || got[0] != "wraith-dev" {
		t.Fatalf("want [wraith-dev] from routed lane, got %v", got)
	}

	// An explicit payload.agent still wins (no DB lookup needed).
	got = n.resolveTargets(project, "assignee", map[string]any{"agent": "someone-else", "task_id": taskID})
	if len(got) != 1 || got[0] != "someone-else" {
		t.Fatalf("explicit agent must win, got %v", got)
	}
}

// TestUpsertLinearMirror_ProjectIDBackfill verifies condition (2) of the
// approved migration: an existing mirror row (linear_project_id NULL) gets it
// backfilled when reconcile re-upserts the issue with the now-computed seed.
func TestUpsertLinearMirror_ProjectIDBackfill(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	database, err := db.NewTestDB(dbPath)
	if err != nil {
		t.Fatalf("create test db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	const project = "p1"

	// First upsert WITHOUT a project id — simulates a row mirrored before the
	// column existed.
	taskID, created, err := database.UpsertLinearMirror(db.LinearMirrorSeed{
		Project: project, LinearIssueID: "iss-x", Title: "t", Status: "pending",
	})
	if err != nil || !created {
		t.Fatalf("first upsert: created=%v err=%v", created, err)
	}
	if got, _ := database.GetTask(taskID, project); got.LinearProjectID != nil {
		t.Fatalf("expected NULL project id pre-backfill, got %v", *got.LinearProjectID)
	}

	// Reconcile re-upserts with the computed project id → backfilled.
	projID := "proj-x"
	if _, _, err := database.UpsertLinearMirror(db.LinearMirrorSeed{
		Project: project, LinearIssueID: "iss-x", Title: "t", Status: "in-progress",
		LinearProjectID: &projID,
	}); err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	got, _ := database.GetTask(taskID, project)
	if got.LinearProjectID == nil || *got.LinearProjectID != "proj-x" {
		t.Fatalf("want backfilled project id proj-x, got %v", got.LinearProjectID)
	}
}
