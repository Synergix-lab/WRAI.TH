# QA Report — BurnMeter

**Date:** 2026-04-19
**Verdict:** PASS

## Commands run

### Build
```
cd demo-saas && make build
→ cd backend && go build -o burnmeter .
→ exit 0, binary: backend/burnmeter (8.5 MB)
```

### Runtime (server started on :8080)

| # | Command | Response |
|---|---------|----------|
| 1 | `POST /api/meeting` (empty body) | `{"id":"63e680ea"}` — 8-char hex id, matches spec |
| 2 | `GET /stats` | `{"meetings_started_today":0,"meetings_started_total":0}` |
| 3 | `GET /` | HTTP 200 (serves frontend/index.html) |
| 4 | `POST /api/meeting/{id}/attendees` with `{"attendees":[{"name":"Priya","rate":180},{"name":"Dan","rate":220}]}` | Full Meeting JSON with attendees populated, `running:false`, `cost_usd:0` |
| 5 | `POST /api/meeting/{id}/start` | Meeting with `running:true`, `started_at` set, `elapsed_s` ticking |
| 6 | `GET /stats` (post-start) | `{"meetings_started_today":1,"meetings_started_total":1}` — counter incremented |

## Verdict

**PASS** — build clean, server boots on :8080, all tested endpoints respond with the shapes specified in DESIGN.md. Meeting lifecycle (create → attendees → start → stats) verified end-to-end. Stats counter increments correctly on cold-start.

## Not tested (out of scope for integration check)
- SSE `/tick` stream (requires long-lived connection)
- `/pause`, `/reset` transitions
- Frontend JS behavior in browser
- `ouch_usd` threshold UI switch
