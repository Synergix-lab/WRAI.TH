package models

type FileLock struct {
	ID         string  `json:"id"`
	AgentName  string  `json:"agent_name"`
	Project    string  `json:"project"`
	FilePaths  string  `json:"file_paths"` // JSON array
	ClaimedAt  string  `json:"claimed_at"`
	ReleasedAt *string `json:"released_at,omitempty"`
	TTLSeconds int     `json:"ttl_seconds"`
}
