package scheduler

import (
	"fmt"
	"log/slog"
	"sync"

	"github.com/robfig/cron/v3"
)

// Scheduler wraps robfig/cron to manage agent cycles.
type Scheduler struct {
	mu      sync.Mutex
	cron    *cron.Cron
	jobs    map[string]cron.EntryID // scheduleID -> entry ID
	logger  *slog.Logger
	running bool
}

// New creates a new scheduler.
func New(logger *slog.Logger) *Scheduler {
	return &Scheduler{
		cron:   cron.New(),
		jobs:   make(map[string]cron.EntryID),
		logger: logger,
	}
}

// Start begins the cron scheduler.
func (s *Scheduler) Start() {
	s.mu.Lock()
	s.running = true
	s.mu.Unlock()
	s.cron.Start()
	s.logger.Info("scheduler started")
}

// Stop gracefully stops the scheduler.
func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	s.mu.Lock()
	s.running = false
	s.mu.Unlock()
	s.logger.Info("scheduler stopped")
}

// IsRunning returns whether the scheduler is active.
func (s *Scheduler) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

// AddJob schedules a function by a stable schedule ID.
func (s *Scheduler) AddJob(scheduleID, cronExpr string, fn func()) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Remove existing job with same ID if any
	if oldID, ok := s.jobs[scheduleID]; ok {
		s.cron.Remove(oldID)
	}

	id, err := s.cron.AddFunc(cronExpr, fn)
	if err != nil {
		return fmt.Errorf("adding cron job %s (%s): %w", scheduleID, cronExpr, err)
	}

	s.jobs[scheduleID] = id
	s.logger.Info("job scheduled", "schedule_id", scheduleID, "expr", cronExpr)
	return nil
}

// RemoveJob removes a scheduled job by its ID.
func (s *Scheduler) RemoveJob(scheduleID string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if id, ok := s.jobs[scheduleID]; ok {
		s.cron.Remove(id)
		delete(s.jobs, scheduleID)
		s.logger.Info("job removed", "schedule_id", scheduleID)
	}
}

// JobCount returns total number of scheduled jobs.
func (s *Scheduler) JobCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.jobs)
}
