package ingest

import (
	"context"
	"os"
	"path/filepath"
)

type Config struct {
	HooksDir        string
	EventBufferSize int
	SessionProvider SessionProvider
}

func (c *Config) defaults() {
	if c.HooksDir == "" {
		home, _ := os.UserHomeDir()
		c.HooksDir = filepath.Join(home, ".pixel-office", "events")
	}
	if c.EventBufferSize <= 0 {
		c.EventBufferSize = 100
	}
}

// SessionProvider returns the set of known Claude session IDs from registered agents.
type SessionProvider func() map[string]bool

type Ingester struct {
	Events          chan AgentEvent
	detector        *Detector
	cancel          context.CancelFunc
	SessionProvider SessionProvider
}

func New(cfg Config) (*Ingester, error) {
	cfg.defaults()

	ctx, cancel := context.WithCancel(context.Background())

	events := make(chan AgentEvent, cfg.EventBufferSize)
	detector := newDetector(events)
	watcher := newHooksWatcher(cfg.HooksDir, events, detector, cfg.SessionProvider)

	go detector.run(ctx)
	go watcher.run(ctx)

	return &Ingester{
		Events:          events,
		detector:        detector,
		cancel:          cancel,
		SessionProvider: cfg.SessionProvider,
	}, nil
}

// RecordHookEvent feeds an event that arrived over HTTP (a Claude Code hook
// POSTing to the relay) into the in-memory detector — same path the file-drop
// watcher used, minus the filesystem. Activity is ephemeral: it updates detector
// state + broadcasts to SSE subscribers, and never touches the DB.
func (i *Ingester) RecordHookEvent(evt AgentEvent) {
	i.detector.RecordEvent(evt)
}

func (i *Ingester) GetSessions() []SessionState {
	return i.detector.GetSessions()
}

func (i *Ingester) SubscribeActivity() chan []SessionState {
	return i.detector.Subscribe()
}

func (i *Ingester) UnsubscribeActivity(ch chan []SessionState) {
	i.detector.Unsubscribe(ch)
}

func (i *Ingester) Stop() {
	i.cancel()
	close(i.Events)
}
