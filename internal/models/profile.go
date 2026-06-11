package models

// Profile is a slim identity card for an agent role: who they are and what
// skills they advertise (for discovery via find_profiles). The agent-OS
// execution fields were removed along with the spawn subsystem.
type Profile struct {
	ID        string  `json:"id"`
	Slug      string  `json:"slug"`
	Name      string  `json:"name"`
	Role      string  `json:"role"`
	Skills    string  `json:"skills"` // JSON array of skill objects
	Project   string  `json:"project"`
	OrgID     *string `json:"org_id,omitempty"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}
