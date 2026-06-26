package relay

import (
	"path/filepath"
	"strings"
	"testing"

	"agent-relay/internal/db"
	"agent-relay/internal/models"
)

// fetchEvent returns the outbox event with the given id (or fails the test).
func fetchEvent(t *testing.T, d *db.DB, id string) db.Event {
	t.Helper()
	evs, err := d.RecentEvents("", 100)
	if err != nil {
		t.Fatalf("recent events: %v", err)
	}
	for _, e := range evs {
		if e.ID == id {
			return e
		}
	}
	t.Fatalf("event %s not found", id)
	return db.Event{}
}

// TestSweeper_DeliverAndDLQ covers TSU-52 slice-B: an event with no matching
// rule is marked delivered immediately; an event whose only matched rule keeps
// failing is retried and dead-lettered past maxEventAttempts.
func TestSweeper_DeliverAndDLQ(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	database, err := db.NewTestDB(dbPath)
	if err != nil {
		t.Fatalf("create test db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	n := &Notifier{db: database}
	const project = "p1"

	// (1) No matching rule → delivered on first pass.
	noRuleID, _, err := database.InsertEvent("", project, "event:no-rule", "", `{}`)
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	n.deliverEvent(fetchEvent(t, database, noRuleID))
	if e := fetchEvent(t, database, noRuleID); e.DeliveredAt == nil {
		t.Fatalf("no-rule event must be delivered immediately")
	}

	// (2) A webhook rule with an empty target always fails → retry then DLQ.
	if _, err := database.CreateNotificationRule(&models.NotificationRule{
		Project: project, Name: "always-fails", Enabled: true,
		Event: "event:fail-sweep", Match: "{}", Action: "webhook", Target: "",
	}); err != nil {
		t.Fatalf("create rule: %v", err)
	}
	failID, _, err := database.InsertEvent("", project, "event:fail-sweep", "", `{}`)
	if err != nil {
		t.Fatalf("insert: %v", err)
	}

	// Drive the sweeper one pass at a time, re-fetching the (incremented) row.
	for i := 0; i < maxEventAttempts; i++ {
		e := fetchEvent(t, database, failID)
		if e.DeliveredAt != nil {
			t.Fatalf("event dead-lettered too early (after %d passes)", i)
		}
		n.deliverEvent(e)
	}

	final := fetchEvent(t, database, failID)
	if final.DeliveredAt == nil {
		t.Fatalf("event should be dead-lettered (delivered_at stamped) after %d attempts", maxEventAttempts)
	}
	if !strings.HasPrefix(final.LastError, "DLQ:") {
		t.Fatalf("expected DLQ last_error, got %q", final.LastError)
	}
	if final.Attempts < maxEventAttempts {
		t.Fatalf("expected attempts ≥ %d, got %d", maxEventAttempts, final.Attempts)
	}
}
