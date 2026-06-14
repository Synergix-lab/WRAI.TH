package db

import "testing"

// FindCollisions flags files held by 2+ distinct agents; single-holder files
// and an agent's own re-claim do not count.
func TestFindCollisions(t *testing.T) {
	d := testDB(t)

	if _, err := d.ClaimFiles("p1", "atlas", `["src/auth.go","src/api.go"]`, 1800); err != nil {
		t.Fatalf("claim atlas: %v", err)
	}
	if _, err := d.ClaimFiles("p1", "nova", `["src/api.go","src/db.go"]`, 1800); err != nil {
		t.Fatalf("claim nova: %v", err)
	}

	cols, err := d.FindCollisions("p1")
	if err != nil {
		t.Fatalf("find collisions: %v", err)
	}
	if len(cols) != 1 {
		t.Fatalf("expected 1 collision (src/api.go), got %d: %+v", len(cols), cols)
	}
	if cols[0].File != "src/api.go" || len(cols[0].Agents) != 2 {
		t.Fatalf("unexpected collision: %+v", cols[0])
	}

	// Releasing one side clears the collision.
	if err := d.ReleaseFiles("p1", "nova", `["src/api.go","src/db.go"]`); err != nil {
		t.Fatalf("release nova: %v", err)
	}
	cols, _ = d.FindCollisions("p1")
	if len(cols) != 0 {
		t.Fatalf("expected no collisions after release, got %+v", cols)
	}
}
