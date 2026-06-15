package db

import (
	"agent-relay/internal/models"
	"time"
)

// FleetThroughput returns a fleet-wide daily time series for the last `days`
// days (oldest → newest, gap-filled with zeros): tasks completed (by
// completed_at) and tasks dispatched (by dispatched_at) per calendar day (UTC).
// This is the persistent "heartbeat" behind mission control's pulse chart — it
// survives restarts, unlike the in-memory event ring buffer.
func (d *DB) FleetThroughput(days int) ([]models.DayBucket, error) {
	if days <= 0 {
		days = 30
	}
	now := time.Now().UTC()
	start := now.AddDate(0, 0, -(days - 1))
	since := start.Format("2006-01-02")

	tally := func(query string) (map[string]int, error) {
		rows, err := d.ro().Query(query, since)
		if err != nil {
			return nil, err
		}
		defer func() { _ = rows.Close() }()
		m := make(map[string]int)
		for rows.Next() {
			var day string
			var n int
			if err := rows.Scan(&day, &n); err != nil {
				return nil, err
			}
			m[day] = n
		}
		return m, rows.Err()
	}

	done, err := tally(`
		SELECT substr(completed_at, 1, 10) AS d, COUNT(*)
		FROM tasks
		WHERE status = 'done' AND completed_at IS NOT NULL AND substr(completed_at, 1, 10) >= ?
		GROUP BY d`)
	if err != nil {
		return nil, err
	}
	disp, err := tally(`
		SELECT substr(dispatched_at, 1, 10) AS d, COUNT(*)
		FROM tasks
		WHERE dispatched_at IS NOT NULL AND substr(dispatched_at, 1, 10) >= ?
		GROUP BY d`)
	if err != nil {
		return nil, err
	}

	out := make([]models.DayBucket, 0, days)
	for i := 0; i < days; i++ {
		day := start.AddDate(0, 0, i).Format("2006-01-02")
		out = append(out, models.DayBucket{Date: day, Done: done[day], Dispatched: disp[day]})
	}
	return out, nil
}
