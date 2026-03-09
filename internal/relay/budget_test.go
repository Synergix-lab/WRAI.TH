package relay

import (
	"testing"

	"agent-relay/internal/models"
)

func msg(id, priority, content string) models.Message {
	return models.Message{
		ID:       id,
		From:     "a",
		To:       "b",
		Priority: priority,
		Subject:  "test",
		Content:  content,
		Metadata: "{}",
	}
}

func TestApplyBudgetP0Bypass(t *testing.T) {
	msgs := []models.Message{
		msg("1", "P0", "critical"),
		msg("2", "P2", "normal"),
	}
	// Budget too small for both — P0 must still be included
	result := applyBudget(msgs, nil, 50)
	found := false
	for _, m := range result {
		if m.ID == "1" {
			found = true
		}
	}
	if !found {
		t.Error("P0 message should always be included")
	}
}

func TestApplyBudgetEmptyTags(t *testing.T) {
	score := jaccard(nil, nil)
	if score != 0 {
		t.Errorf("expected 0 for empty tags, got %f", score)
	}
}

func TestJaccardSimilarity(t *testing.T) {
	a := map[string]bool{"database": true, "auth": true, "api": true}
	b := map[string]bool{"database": true, "frontend": true, "auth": true}
	// intersection=2, union=4 → 0.5
	j := jaccard(a, b)
	if j < 0.49 || j > 0.51 {
		t.Errorf("expected ~0.5, got %f", j)
	}
}

func TestApplyBudgetRespectsLimit(t *testing.T) {
	msgs := []models.Message{
		msg("1", "P2", "aaaa"),
		msg("2", "P2", "bbbb"),
		msg("3", "P2", "cccc"),
	}
	// Each message is roughly 20 bytes. Budget for ~2.
	b := messageBytes(msgs[0])
	result := applyBudget(msgs, nil, b*2+1)
	if len(result) > 2 {
		t.Errorf("expected at most 2 messages, got %d", len(result))
	}
}

func TestApplyBudgetZeroBudget(t *testing.T) {
	msgs := []models.Message{msg("1", "P2", "hello")}
	result := applyBudget(msgs, nil, 0)
	if len(result) != 1 {
		t.Error("zero budget should return all messages (no filtering)")
	}
}

func TestExtractTags(t *testing.T) {
	tags := extractTags(`{"tags":["db","auth"],"other":"x"}`)
	if len(tags) != 2 || !tags["db"] || !tags["auth"] {
		t.Errorf("expected {db, auth}, got %v", tags)
	}

	empty := extractTags(`{"no_tags": true}`)
	if len(empty) != 0 {
		t.Error("expected empty tags")
	}
}
