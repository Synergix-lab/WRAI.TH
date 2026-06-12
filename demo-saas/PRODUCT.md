# BurnMeter

A live dollar-ticker for meetings. You paste who's in the room and what they cost — it counts money burned in real time while the meeting drags on.

## The problem

Meetings feel free. The calendar invite doesn't show a price tag, so a "quick sync" with seven senior engineers ends up costing $450 and nobody notices. Managers want ammunition to cancel, shorten, or trim invitees — but abstract complaints about "too many meetings" don't move the needle. A visible, ticking dollar figure on the shared screen does.

## The solution

A single-page web app. Paste/type the attendees + their approximate hourly burden, click **Start**, and a giant counter ticks the running cost of the meeting upward every second. Screen-share it. Watch behavior change within one sprint.

Everything lives in memory on the Go backend; meetings evaporate on restart. That's the feature, not the bug — no PII stored, no compliance surface.

## Target user (one persona)

**Priya, engineering manager at a 40-person startup.** Has 22 hours of recurring meetings per week, suspects half are useless, and wants a visceral prop to show her director when arguing for calendar cleanup. Not technical enough to spin up a dashboard, not patient enough to fill out a 10-field form.

## Core feature list

- **Add attendees fast:** one line per person, `Name, HourlyRate`. Paste a block, it parses.
- **Giant live ticker:** center of the screen, bold, updates once per second. Format: `$312.47 burned · 00:14:32`.
- **Pause / resume / reset:** because people step out, and because the next meeting should start fresh.
- **Shareable room URL:** `/m/<short-id>` so everyone on the call can open the same ticker.
- **"Ouch line":** set a threshold (default $500). When crossed, the counter flashes red and the tab title screams 🔥.

## Non-features (what we explicitly do NOT build)

- No login, no accounts, no SSO.
- No persistence across server restarts — in-memory only.
- No calendar / Zoom / Google integrations.
- No per-org billing or free/paid tiers.
- No history, analytics, or "meetings this week" reports.
- No mobile-optimized layout (desktop share-screen only).

## Success metric

**Meetings started per active day.** One number, on the server, exposed at `/stats`. If people actually use it, it ticks up.

## API surface

- `POST   /api/meeting` — create a room, returns `{id}`
- `GET    /api/meeting/{id}` — fetch attendees, state, elapsed, cost
- `POST   /api/meeting/{id}/attendees` — replace the attendee list (array of `{name, rate}`)
- `POST   /api/meeting/{id}/start` — begin ticking
- `POST   /api/meeting/{id}/pause` — stop ticking, preserve elapsed
- `POST   /api/meeting/{id}/reset` — zero elapsed, keep attendees
- `GET    /api/meeting/{id}/tick` — Server-Sent Events stream of `{elapsed_s, cost_usd}` once per second
- `GET    /stats` — returns `{meetings_started_today, meetings_started_total}`
- `GET    /` — serves the static HTML/JS single page
