package config

import (
	"os"
	"strconv"
	"strings"
)

// Config holds server security settings loaded from environment variables.
// All settings are opt-in — zero values preserve backward-compatible behavior.
type Config struct {
	APIKey      string   // RELAY_API_KEY: shared secret for Bearer auth
	CORSOrigins []string // RELAY_CORS_ORIGINS: allowed origins (comma-separated)
	MaxBody     int64    // RELAY_MAX_BODY: max request body in bytes
	RateLimit   int      // RELAY_RATE_LIMIT: requests/minute per IP

	// LinearMode toggles Linear-SSOT mirror mode. Default false = degraded/native
	// mode (tasks live in the relay DB, kanban is writable). Surfaced via
	// /api/health and /api/settings so the web UI can detect the mode.
	// Set with RELAY_LINEAR_MODE=1 (or true). No Linear connector ships yet —
	// this is the schema + flag only.
	LinearMode bool // RELAY_LINEAR_MODE

	// Version is the build tag (from main.Version). Surfaced in /api/health
	// and MCP server info. Set by the caller before relay.New.
	Version string
}

// Load reads configuration from environment variables with safe defaults.
func Load() Config {
	cfg := Config{
		APIKey: os.Getenv("RELAY_API_KEY"),
	}

	if v := os.Getenv("RELAY_CORS_ORIGINS"); v != "" {
		for _, origin := range strings.Split(v, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				cfg.CORSOrigins = append(cfg.CORSOrigins, origin)
			}
		}
	}

	if v := os.Getenv("RELAY_MAX_BODY"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			cfg.MaxBody = n
		}
	}

	if v := os.Getenv("RELAY_RATE_LIMIT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.RateLimit = n
		}
	}

	if v := strings.ToLower(strings.TrimSpace(os.Getenv("RELAY_LINEAR_MODE"))); v == "1" || v == "true" || v == "yes" {
		cfg.LinearMode = true
	}

	return cfg
}
