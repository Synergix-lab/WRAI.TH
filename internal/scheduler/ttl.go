package scheduler

import "time"

// DefaultTTL is the default maximum duration for a cycle execution.
const DefaultTTL = 10 * time.Minute

// ParseTTL parses a TTL string like "10m", "2h", "30s".
// Returns DefaultTTL if empty or invalid.
func ParseTTL(s string) time.Duration {
	if s == "" {
		return DefaultTTL
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return DefaultTTL
	}
	return d
}
