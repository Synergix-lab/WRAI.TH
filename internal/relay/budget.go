package relay

import (
	"encoding/json"
	"sort"
	"time"

	"agent-relay/internal/models"
)

// applyBudget filters messages to fit within maxBytes using a utility score.
// P0 messages always bypass the budget. Remaining messages are scored and
// selected greedily until the byte budget is exhausted.
//
// Utility = 0.7 * priorityScore + 0.2 * tagScore + 0.1 * freshnessScore
func applyBudget(messages []models.Message, agentTags []string, maxBytes int) []models.Message {
	if maxBytes <= 0 || len(messages) == 0 {
		return messages
	}

	agentTagSet := make(map[string]bool, len(agentTags))
	for _, t := range agentTags {
		agentTagSet[t] = true
	}

	// Separate P0 (always included) from the rest
	var p0 []models.Message
	var rest []models.Message
	for _, m := range messages {
		if m.Priority == "P0" {
			p0 = append(p0, m)
		} else {
			rest = append(rest, m)
		}
	}

	// Accumulate P0 bytes
	usedBytes := 0
	for _, m := range p0 {
		usedBytes += messageBytes(m)
	}

	if usedBytes >= maxBytes {
		// P0 alone exceeds budget — return only P0
		return p0
	}

	// Score remaining messages
	type scored struct {
		msg   models.Message
		score float64
	}
	now := time.Now().UTC()
	scoredMsgs := make([]scored, len(rest))
	for i, m := range rest {
		scoredMsgs[i] = scored{
			msg:   m,
			score: utility(m, agentTagSet, now),
		}
	}

	// Sort by utility descending
	sort.Slice(scoredMsgs, func(i, j int) bool {
		return scoredMsgs[i].score > scoredMsgs[j].score
	})

	// Greedily select until budget
	var selected []models.Message
	for _, s := range scoredMsgs {
		b := messageBytes(s.msg)
		if usedBytes+b > maxBytes {
			continue
		}
		selected = append(selected, s.msg)
		usedBytes += b
	}

	// Combine P0 + selected, re-sort by priority ASC, created_at DESC
	result := append(p0, selected...)
	sort.Slice(result, func(i, j int) bool {
		if result[i].Priority != result[j].Priority {
			return result[i].Priority < result[j].Priority
		}
		return result[i].CreatedAt > result[j].CreatedAt
	})

	return result
}

func utility(m models.Message, agentTagSet map[string]bool, now time.Time) float64 {
	// Priority score: P1=0.67, P2=0.33, P3=0
	priIdx := 0
	switch m.Priority {
	case "P1":
		priIdx = 1
	case "P2":
		priIdx = 2
	case "P3":
		priIdx = 3
	}
	priorityScore := 1.0 - float64(priIdx)/3.0

	// Tag Jaccard similarity
	tagScore := jaccard(extractTags(m.Metadata), agentTagSet)

	// Freshness: exponential decay over 1 hour
	freshnessScore := 1.0
	if created, err := time.Parse("2006-01-02T15:04:05.000000Z", m.CreatedAt); err == nil {
		age := now.Sub(created).Seconds()
		if age > 0 {
			freshnessScore = 1.0 / (1.0 + age/3600.0)
		}
	}

	return 0.7*priorityScore + 0.2*tagScore + 0.1*freshnessScore
}

func jaccard(msgTags map[string]bool, agentTags map[string]bool) float64 {
	if len(msgTags) == 0 || len(agentTags) == 0 {
		return 0
	}
	intersection := 0
	for t := range msgTags {
		if agentTags[t] {
			intersection++
		}
	}
	union := len(msgTags) + len(agentTags) - intersection
	if union == 0 {
		return 0
	}
	return float64(intersection) / float64(union)
}

func extractTags(metadata string) map[string]bool {
	var m map[string]json.RawMessage
	if err := json.Unmarshal([]byte(metadata), &m); err != nil {
		return nil
	}
	raw, ok := m["tags"]
	if !ok {
		return nil
	}
	var tags []string
	if err := json.Unmarshal(raw, &tags); err != nil {
		return nil
	}
	set := make(map[string]bool, len(tags))
	for _, t := range tags {
		set[t] = true
	}
	return set
}

func messageBytes(m models.Message) int {
	return len(m.ID) + len(m.From) + len(m.To) + len(m.Subject) + len(m.Content) + len(m.Metadata)
}
