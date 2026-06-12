# BurnMeter — Build Brief

## Data model (Go structs with fields + JSON tags)

```go
type Attendee struct {
    Name string  `json:"name"`
    Rate float64 `json:"rate"` // hourly USD
}

type Meeting struct {
    ID          string     `json:"id"`           // 8-char short id
    Attendees   []Attendee `json:"attendees"`
    Running     bool       `json:"running"`
    ElapsedS    float64    `json:"elapsed_s"`    // seconds accumulated while running
    StartedAt   *time.Time `json:"started_at"`   // nil when paused; ptr for omitempty
    OuchUSD     float64    `json:"ouch_usd"`     // threshold, default 500
    CostUSD     float64    `json:"cost_usd"`     // computed: sumRates * elapsed_s / 3600
    CreatedAt   time.Time  `json:"created_at"`
}

type Stats struct {
    MeetingsStartedToday int `json:"meetings_started_today"`
    MeetingsStartedTotal int `json:"meetings_started_total"`
}
```

In-memory store: `map[string]*Meeting` guarded by `sync.RWMutex`. Stats counters are int64 with atomic increments. No persistence.

## API endpoints (method + path + request body + response shape)

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/api/meeting` | `{}` | `{"id":"a1b2c3d4"}` |
| GET | `/api/meeting/{id}` | — | full `Meeting` JSON (with computed `cost_usd` + `elapsed_s`) |
| POST | `/api/meeting/{id}/attendees` | `{"attendees":[{"name":"Priya","rate":180}]}` | updated `Meeting` |
| POST | `/api/meeting/{id}/start` | `{}` | updated `Meeting` (running=true, increments stats once per cold-start) |
| POST | `/api/meeting/{id}/pause` | `{}` | updated `Meeting` (running=false, elapsed preserved) |
| POST | `/api/meeting/{id}/reset` | `{}` | updated `Meeting` (elapsed=0, running=false, attendees kept) |
| GET | `/api/meeting/{id}/tick` | — | SSE stream, `data: {"elapsed_s":872,"cost_usd":312.47}\n\n` once/sec |
| GET | `/stats` | — | `Stats` JSON |
| GET | `/` | — | `frontend/index.html` |
| GET | `/static/*` | — | serves `frontend/{app.js,styles.css}` |

Errors return `{"error":"message"}` with appropriate 4xx/5xx. Unknown id → 404. Invalid JSON → 400.

## UI layout (sections, components, user flow sketch)

Single page, three stacked sections (top → bottom):

1. **Header bar** — `BurnMeter 🔥` wordmark left, room URL + copy button right (only after meeting created).
2. **Ticker** — full-width hero. Centered, monospaced, `$312.47 burned · 00:14:32`. Becomes red + pulsing when `cost_usd >= ouch_usd`. Tab title mirrors `🔥 $312.47 — BurnMeter` past threshold.
3. **Controls strip** — three big buttons: `Start` / `Pause` / `Reset`. Disabled states reflect server `running`.
4. **Attendees panel** — left column, `<textarea>` placeholder `Priya, 180\nDan, 220`. Live-parsed into a chip list on the right. `Save attendees` button posts the list.
5. **Ouch threshold input** — small number field `Ouch line $`, default 500.

**User flow:** open `/` → POST `/api/meeting` (auto on load if no `#id` in URL) → URL becomes `/m/<id>` via history.replaceState → paste attendees → Save → Start → SSE stream drives the ticker → Pause / Reset as needed → share URL with the room.

## Styling direction (colors, vibe — one paragraph)

Terminal-finance aesthetic: near-black canvas (`#0b0d10`), warm off-white text (`#e8e6df`), single accent of money-green (`#3ddc84`) for the ticker in normal state, switching to alarm-red (`#ff3b30`) past the ouch line. One typeface: a system monospace stack (`ui-monospace, SFMono-Regular, Menlo, monospace`). Generous whitespace, oversized ticker (≥12vw font-size), no shadows or gradients. The screen should look like a Bloomberg terminal that learned shame.

## Build constraints

- **Port:** `8080` (configurable via `PORT` env var, default 8080).
- **Language:** Go, **stdlib only** (`net/http`, `encoding/json`, `sync`, `time`, `crypto/rand`, `html/template` if needed). No third-party deps. `go.mod` declares module `burnmeter`, `go 1.22`.
- **Frontend:** vanilla JS (no framework, no build step), one `index.html`, one `app.js`, one `styles.css`. EventSource for SSE.
- **File structure under `/Users/loic/Projects/agent-relay/demo-saas/`:**
  ```
  backend/
    main.go        # all handlers + in-memory store + SSE loop
    go.mod
  frontend/
    index.html
    app.js
    styles.css
  Makefile         # build, run, stop, clean, test
  Dockerfile       # multi-stage: golang:1.22 → distroless/static
  README.md        # quickstart
  PRODUCT.md
  DESIGN.md
  ```
- Backend serves `/` and `/static/*` from `../frontend/` relative to the binary; Docker image bakes the assets into `/app/frontend/`.
- SSE handler ticks every 1s using `time.Ticker`, flushes after each write, exits cleanly on client disconnect (`r.Context().Done()`).
- Short id: 8 hex chars from `crypto/rand`.
