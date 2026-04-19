package models

type Profile struct {
	ID           string  `json:"id"`
	Slug         string  `json:"slug"`
	Name         string  `json:"name"`
	Role         string  `json:"role"`
	ContextPack  string  `json:"context_pack"`
	SoulKeys     string  `json:"soul_keys"`     // JSON array
	Skills       string  `json:"skills"`        // JSON array of skill objects
	VaultPaths   string  `json:"vault_paths"`   // JSON array of glob patterns
	AllowedTools string  `json:"allowed_tools"` // JSON array of tool patterns
	PoolSize     int     `json:"pool_size"`     // Max concurrent spawns for this profile
	// ExitPrompt overrides the default "When done, persist via set_memory, then exit."
	// boilerplate at the end of the spawn prompt. Use this to chain spawns into
	// other actions (message others, dispatch tasks, etc.) before exit.
	ExitPrompt string  `json:"exit_prompt,omitempty"`
	Project    string  `json:"project"`
	OrgID      *string `json:"org_id,omitempty"`
	CreatedAt  string  `json:"created_at"`
	UpdatedAt  string  `json:"updated_at"`
}
