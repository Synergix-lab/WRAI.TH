package models

// AgentQuota defines rate limits for an agent within a project.
type AgentQuota struct {
	Project            string `json:"project"`
	AgentName          string `json:"agent_name"`
	MaxTokensPerDay    int64  `json:"max_tokens_per_day"`
	MaxMessagesPerHour int64  `json:"max_messages_per_hour"`
	MaxTasksPerHour    int64  `json:"max_tasks_per_hour"`
	MaxSpawnsPerHour   int64  `json:"max_spawns_per_hour"`
	CreatedAt          string `json:"created_at"`
	UpdatedAt          string `json:"updated_at"`
}

// QuotaUsage shows current usage against limits for an agent.
type QuotaUsage struct {
	AgentQuota
	TokensUsed24h  int64 `json:"tokens_used_24h"`
	MessagesUsed1h int64 `json:"messages_used_1h"`
	TasksUsed1h    int64 `json:"tasks_used_1h"`
	SpawnsUsed1h   int64 `json:"spawns_used_1h"`
}
