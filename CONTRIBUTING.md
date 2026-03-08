# Contributing to wrai.th

Thanks for your interest in contributing! Here's how to get started.

## Development setup

```bash
# Clone
git clone https://github.com/Synergix-lab/claude-agentic-relay.git
cd claude-agentic-relay

# Build (requires Go 1.23+ and a C compiler for CGO/SQLite)
CGO_ENABLED=1 go build -tags fts5 -o agent-relay .

# Run
./agent-relay
# Open http://localhost:8090
```

## Project structure

```
internal/
  db/         SQLite models (agents, messages, memories, tasks, goals, vault)
  relay/      MCP handlers, REST API, SSE streams
  ingest/     Activity hook ingestion (fsnotify on ~/.pixel-office/events/)
  vault/      Obsidian vault watcher (fsnotify + FTS5 indexing)
  web/        Embedded static assets (canvas UI)
  models/     Shared structs
docs/         Embedded relay documentation (go:embed, indexed as _relay project)
skill/        /relay skill for Claude Code
install.sh    macOS/Linux installer
install.ps1   Windows installer
```

## Making changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Test: `go build -tags fts5 .` (must compile with FTS5)
4. Commit with [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `ci:`
5. Open a PR

## What to work on

- Check [open issues](https://github.com/Synergix-lab/claude-agentic-relay/issues)
- Join the [Discord](https://discord.gg/QPq7qfbEk8) to discuss ideas
- The MCP tools were designed by agents themselves — if you use the relay and hit friction, that's a valid feature request

## Code style

- Go standard formatting (`gofmt`)
- Keep it simple — the relay is a single binary with zero external dependencies beyond SQLite
- Frontend is vanilla JS (no framework, no build step) with canvas rendering

## Releases

Tags (`v*`) trigger the release workflow which cross-compiles for 5 platforms and publishes to GitHub Releases. The installer test workflow runs automatically after each release.
