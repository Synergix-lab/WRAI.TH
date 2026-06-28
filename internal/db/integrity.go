package db

import (
	"database/sql"
	"fmt"
	"os"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

// IntegrityCheck runs SQLite's structural + foreign-key checks against the live
// database. Returns nil only when the store is sound. Use after a restore, or to
// gate trusting a snapshot.
func (d *DB) IntegrityCheck() error {
	return integrityCheck(d.conn)
}

// integrityCheck runs PRAGMA integrity_check + foreign_key_check on a connection.
// A clean DB returns a single "ok" row from integrity_check and no rows from
// foreign_key_check; anything else is corruption.
func integrityCheck(conn *sql.DB) error {
	rows, err := conn.Query(`PRAGMA integrity_check`)
	if err != nil {
		return fmt.Errorf("integrity_check: %w", err)
	}
	var problems []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			_ = rows.Close()
			return fmt.Errorf("integrity_check scan: %w", err)
		}
		if s != "ok" {
			problems = append(problems, s)
		}
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return fmt.Errorf("integrity_check rows: %w", err)
	}
	_ = rows.Close()
	if len(problems) > 0 {
		return fmt.Errorf("integrity_check failed: %s", strings.Join(problems, "; "))
	}

	fkRows, err := conn.Query(`PRAGMA foreign_key_check`)
	if err != nil {
		return fmt.Errorf("foreign_key_check: %w", err)
	}
	defer func() { _ = fkRows.Close() }()
	if fkRows.Next() {
		return fmt.Errorf("foreign_key_check found violations")
	}
	return fkRows.Err()
}

// coreTableCounts are the fleet-state tables a restore drill reports on. Constant
// queries (no string formatting) so a missing/renamed table is the only failure
// mode, not SQL injection.
var coreTableCounts = map[string]string{
	"agents":     `SELECT COUNT(*) FROM agents`,
	"messages":   `SELECT COUNT(*) FROM messages`,
	"deliveries": `SELECT COUNT(*) FROM deliveries`,
	"tasks":      `SELECT COUNT(*) FROM tasks`,
	"memories":   `SELECT COUNT(*) FROM memories`,
	"audit_log":  `SELECT COUNT(*) FROM audit_log`,
}

// VerifyDBFile opens an existing SQLite file (e.g. a Backup() snapshot) read-only,
// runs the integrity + foreign-key checks, and returns row counts for the core
// fleet-state tables. This is the verified-restore drill: prove a snapshot is
// sound and non-empty before trusting it for disaster recovery. The temporary
// connection is closed here.
func VerifyDBFile(path string) (map[string]int64, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, fmt.Errorf("snapshot not found: %w", err)
	}
	conn, err := sql.Open("sqlite3", path+"?mode=ro&_foreign_keys=ON")
	if err != nil {
		return nil, fmt.Errorf("open snapshot: %w", err)
	}
	defer func() { _ = conn.Close() }()

	if err := integrityCheck(conn); err != nil {
		return nil, err
	}

	counts := map[string]int64{}
	for table, q := range coreTableCounts {
		var n int64
		// A table may be absent in a very old snapshot; skip rather than fail.
		if err := conn.QueryRow(q).Scan(&n); err != nil {
			continue
		}
		counts[table] = n
	}
	return counts, nil
}
