package models

type Delivery struct {
	ID             string  `json:"id"`
	MessageID      string  `json:"message_id"`
	ToAgent        string  `json:"to_agent"`
	State          string  `json:"state"` // queued, surfaced, acknowledged, expired, dropped
	SequenceNumber int     `json:"sequence_number"`
	CreatedAt      string  `json:"created_at"`
	SurfacedAt     *string `json:"surfaced_at,omitempty"`
	AcknowledgedAt *string `json:"acknowledged_at,omitempty"`
	ExpiredAt      *string `json:"expired_at,omitempty"`
	Project        string  `json:"project"`
}
