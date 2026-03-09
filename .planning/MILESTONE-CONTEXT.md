# Milestone Context

**Generated:** 2026-03-09
**Status:** Ready for /gsd:new-milestone

<features>
## Features to Build

### Phase 0: Merge 4 open PRs
- **PR #3** — Delete project endpoint + MCP tool (cascade delete)
- **PR #4** — Auto-normalize JSON keys to snake_case
- **PR #5** — SQLite perf (WAL tuning, reader/writer split, CI workflow)
- **PR #6** — 68 tests (MCP handlers + REST API)

### Feature 1: Message Priority (Hybrid P0-P3 + MACP aliases)
- New `priority` field on messages: P0-P3 in DB
- Accept MACP aliases in MCP tools: interrupt=P0, steering=P1, advisory=P2, info=P3
- Inbox sorted by priority DESC then created_at DESC
- P0 (interrupt) bypasses budget pruning
- Behavior: sorting + budget bypass (no push notifications for now)

### Feature 2: Context Budget Pruning
- New `interest_tags` field on agents (JSON array)
- Utility scoring: `0.7 * priority_score + 0.2 * Jaccard(tags) + 0.1 * freshness`
- Default budget: 16KB per poll, configurable per agent
- New `apply_budget` param on `get_inbox` tool
- Pruned messages stay in queue (not deleted), eligible for later polls

### Feature 3: Message TTL / Expiry
- New `ttl_seconds` field on messages (default: 3600 = 1 hour)
- Auto-expire on poll: mark expired messages as terminal state
- Expired messages not deleted, just marked (audit trail)
- `ttl_seconds` param on `send_message` tool

### Feature 4: Full Delivery Tracking (Refactor)
- Split `messages` table into `messages` (content) + `deliveries` (per-recipient state)
- Delivery state machine: queued -> surfaced -> acknowledged | expired | dropped
- message_id (shared) vs delivery_id (per recipient)
- Explicit ACK per delivery (new `ack_delivery` MCP tool)
- Migration: existing messages become messages + 1 delivery per recipient
- Zero data loss migration

### Feature 5: File Ownership Broadcast
- New `file_locks` table: agent_id, file_paths (JSON array), claimed_at, released_at
- New MCP tools: `claim_files`, `release_files`, `list_locks`
- Auto-broadcast steering priority message when agent claims/releases files
- TTL on locks (auto-release after inactivity)

### UI Updates
- Priority visual in sidebar Messages (color/icon per level, interrupts in red)
- File locks displayed visually on Colony canvas
- Delivery state badges on messages
- Settings panel to modify defaults (budget, TTL, etc.)

</features>

<scope>
## Scope

**Suggested name:** v0.3 Smart Messaging
**Estimated phases:** 7-8 (merge PRs + 5 features + UI + settings)
**Focus:** Transform dumb message passing into intelligent, priority-aware delivery with MACP-inspired features

</scope>

<constraints>
## Constraints

- Migrations auto at startup, zero data loss on existing messages
- Backward compat on existing MCP tools (new params are optional)
- No user/auth system — single operator (the dev), agents + humans in the system
- Inspired by MACP (github.com/multiagentcognition/macp) but adapted to Agent Relay's richer model

</constraints>

<notes>
## Additional Context

- MACP repo cloned at /Users/loicmancino/macp for reference
- Current message system: single messages table, message_reads for per-agent receipts
- Tasks already use P0-P3 priority — messages will follow same convention
- Agent model has role field but no interest_tags yet
- Notify system already exists for push notifications (can be extended later)
- Frontend: Canvas 2D + vanilla JS, pixel art aesthetic, Colony view has sidebar with Messages/Memories/Tasks tabs

</notes>

---

*This file is temporary. It will be deleted after /gsd:new-milestone creates the milestone.*
