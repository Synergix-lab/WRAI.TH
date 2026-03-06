package db

import (
	"agent-relay/internal/models"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func (d *DB) RegisterAgent(project, name, role, description string, reportsTo, sessionID *string) (*models.Agent, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	// Upsert: update if exists, insert if not
	var existing models.Agent
	err := d.conn.QueryRow("SELECT id, name, role, description, registered_at, last_seen, project, reports_to, session_id FROM agents WHERE name = ? AND project = ?", name, project).
		Scan(&existing.ID, &existing.Name, &existing.Role, &existing.Description, &existing.RegisteredAt, &existing.LastSeen, &existing.Project, &existing.ReportsTo, &existing.SessionID)

	if err == sql.ErrNoRows {
		agent := &models.Agent{
			ID:           uuid.New().String(),
			Name:         name,
			Role:         role,
			Description:  description,
			RegisteredAt: now,
			LastSeen:     now,
			Project:      project,
			ReportsTo:    reportsTo,
			SessionID:    sessionID,
		}
		_, err := d.conn.Exec(
			"INSERT INTO agents (id, name, role, description, registered_at, last_seen, project, reports_to, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			agent.ID, agent.Name, agent.Role, agent.Description, agent.RegisteredAt, agent.LastSeen, agent.Project, agent.ReportsTo, agent.SessionID,
		)
		if err != nil {
			return nil, fmt.Errorf("insert agent: %w", err)
		}
		return agent, nil
	}
	if err != nil {
		return nil, fmt.Errorf("query agent: %w", err)
	}

	// Update existing
	_, err = d.conn.Exec(
		"UPDATE agents SET role = ?, description = ?, last_seen = ?, reports_to = ?, session_id = ? WHERE name = ? AND project = ?",
		role, description, now, reportsTo, sessionID, name, project,
	)
	if err != nil {
		return nil, fmt.Errorf("update agent: %w", err)
	}
	existing.Role = role
	existing.Description = description
	existing.LastSeen = now
	existing.ReportsTo = reportsTo
	existing.SessionID = sessionID
	return &existing, nil
}

func (d *DB) TouchAgent(project, name string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := d.conn.Exec("UPDATE agents SET last_seen = ? WHERE name = ? AND project = ?", now, name, project)
	return err
}

func (d *DB) ListAgents(project string) ([]models.Agent, error) {
	rows, err := d.conn.Query("SELECT id, name, role, description, registered_at, last_seen, project, reports_to, session_id FROM agents WHERE project = ? ORDER BY name", project)
	if err != nil {
		return nil, fmt.Errorf("list agents: %w", err)
	}
	defer rows.Close()

	var agents []models.Agent
	for rows.Next() {
		var a models.Agent
		if err := rows.Scan(&a.ID, &a.Name, &a.Role, &a.Description, &a.RegisteredAt, &a.LastSeen, &a.Project, &a.ReportsTo, &a.SessionID); err != nil {
			return nil, fmt.Errorf("scan agent: %w", err)
		}
		agents = append(agents, a)
	}
	return agents, rows.Err()
}

// PurgeStaleAgents removes agents whose last_seen is older than the given duration.
// Returns the number of agents removed. Global across all projects.
func (d *DB) PurgeStaleAgents(maxAge time.Duration) (int, error) {
	cutoff := time.Now().UTC().Add(-maxAge).Format(time.RFC3339)
	result, err := d.conn.Exec("DELETE FROM agents WHERE last_seen < ?", cutoff)
	if err != nil {
		return 0, fmt.Errorf("purge stale agents: %w", err)
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

func (d *DB) GetAgent(project, name string) (*models.Agent, error) {
	var a models.Agent
	err := d.conn.QueryRow(
		"SELECT id, name, role, description, registered_at, last_seen, project, reports_to, session_id FROM agents WHERE name = ? AND project = ?", name, project,
	).Scan(&a.ID, &a.Name, &a.Role, &a.Description, &a.RegisteredAt, &a.LastSeen, &a.Project, &a.ReportsTo, &a.SessionID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get agent: %w", err)
	}
	return &a, nil
}

// GetOrgTree returns all agents ordered for tree display (managers first).
func (d *DB) GetOrgTree(project string) ([]models.Agent, error) {
	rows, err := d.conn.Query(
		"SELECT id, name, role, description, registered_at, last_seen, project, reports_to, session_id FROM agents WHERE project = ? ORDER BY reports_to IS NULL DESC, reports_to, name",
		project,
	)
	if err != nil {
		return nil, fmt.Errorf("get org tree: %w", err)
	}
	defer rows.Close()

	var agents []models.Agent
	for rows.Next() {
		var a models.Agent
		if err := rows.Scan(&a.ID, &a.Name, &a.Role, &a.Description, &a.RegisteredAt, &a.LastSeen, &a.Project, &a.ReportsTo, &a.SessionID); err != nil {
			return nil, fmt.Errorf("scan agent: %w", err)
		}
		agents = append(agents, a)
	}
	return agents, rows.Err()
}

// GetKnownSessionIDs returns the set of session_ids from all registered agents.
func (d *DB) GetKnownSessionIDs() map[string]bool {
	rows, err := d.conn.Query("SELECT session_id FROM agents WHERE session_id IS NOT NULL AND session_id != ''")
	if err != nil {
		return nil
	}
	defer rows.Close()

	ids := make(map[string]bool)
	for rows.Next() {
		var sid string
		if err := rows.Scan(&sid); err == nil {
			ids[sid] = true
		}
	}
	return ids
}
