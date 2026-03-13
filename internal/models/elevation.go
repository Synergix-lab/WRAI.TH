package models

// Elevation represents a temporary privilege escalation for an agent.
type Elevation struct {
	ID           string  `json:"id"`
	Project      string  `json:"project"`
	AgentName    string  `json:"agent_name"`
	ElevatedRole string  `json:"elevated_role"` // admin, lead
	GrantedBy    string  `json:"granted_by"`
	Reason       string  `json:"reason"`
	ExpiresAt    string  `json:"expires_at"`
	RevokedAt    *string `json:"revoked_at,omitempty"`
	CreatedAt    string  `json:"created_at"`
}
