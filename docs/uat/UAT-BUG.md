# relay bugs

## BUG — pool-spawn burst nukes reports_to to NULL on ALL spawned agents

**Severity:** P0 (breaks org hierarchy + authorization)
**Found:** 2026-04-20 15:34 — observed directly
**Reproduced:** every mass pool-refill via webhook POST /api/webhooks/<project>/task.dispatched

**Impact:** when 10 profiles get `task.dispatched` fired in <1s (manual pool-refill workaround), the relay spawns 10 children. Each spawn calls internal `register_agent(name, ...)` to upsert the child's registration. The internal call does NOT pass `reports_to` → relay code defaults it to NULL → ALL 10 pre-existing reports_to fields get wiped in <1s. A period cron healer at */5min cannot keep up because the next pool-refill re-wipes them.

**Evidence:** after a burst spawn, `list_agents` shows `reports_to=None` on every active agent. Re-applying the healer immediately restores all 10 at once.

**Root cause hypothesis:** `internal/spawn/assembly.go` calls `db.RegisterAgent(name, role, ...)` without forwarding an existing `reports_to`. The `resolveReportsTo()` fallback chain only picks "sole-exec" when creating NEW agents, not when updating existing. So every re-register blanks the field.

**Fix (1 of 3, ranked):**
1. In the spawn register-agent call, read the existing row's `reports_to` first and pass it through. If profile has a registered template `reports_to_hint`, prefer that. Never pass NULL for an existing agent unless explicitly intended.
2. Add `reports_to` column to profiles; spawn uses `profile.reports_to` for new agents.
3. Separate `upsert_agent(reports_to)` from `touch_agent(last_seen)`: spawn should use touch, not upsert.

Workaround: cron `reports-to-healer` every 5min reverting known mappings. Still leaves a 0-5min window where authorization is broken.

---

## BUG — task.dispatched trigger fires once; pool-full → task stranded

**Severity:** P1 (pending tasks sit forever)
**Found:** 2026-04-20 (observed multiple times)
**Impact:** when `dispatch_task` is called and the target pool is already full, the `task.dispatched` trigger STILL fires but the spawn call returns "pool full". The task stays `pending` forever. When the pool later frees (child completes), NO retry happens — the trigger does not re-fire.

Symptom on the overnight-saas project: board shows 8 pending tasks for 30+ min even though pools are idle; manually hitting the webhook re-fires the trigger and spawns proceed.

**Fix:**
- On `task.completed` for profile X, check if any `pending` tasks exist for profile X (or same pool). If yes, fire task.dispatched for the oldest one.
- Alternative: on pool-slot-free event, scan pending tasks matching that profile and fire.

Workaround: cron pool-refill every 3min that fires task.dispatched webhook for one pending task per profile. (Tried this overnight; the cron itself had bugs so we removed it. Re-implement server-side.)

---

## BUG — child stdout / stderr not persisted

**Severity:** P2 (debuggability)
**Found:** 2026-04-20
**Impact:** when a child exits=1 after 3-9 seconds, the relay logs `error="exit status 1"` but nothing else. There is no way to see the claude CLI's stderr / traceback / auth error. The `spawn_children` table has columns for `prompt`, `exit_code`, `error` (one line) — but no `stdout` / `stderr`. Makes diagnosing "why did this batch of 6 children die in 4s at cron-boundary :00:00" nearly impossible.

**Fix:** add `stdout_tail` (last 2KB) + `stderr_tail` (last 4KB) columns, truncated on insert. Or write full logs to `~/.agent-relay/child-logs/<id>.log` and reference from the table.

---

## BUG — trigger_cycle and related POST endpoints return generic "trigger failed" on any error

**Severity:** P2
**Found:** 2026-04-20
**Impact:** `POST /api/schedules/<id>/trigger` returns `{"error":"trigger failed"}` without distinguishing: (a) schedule not found, (b) profile missing for the agent, (c) lock already held, (d) quota exceeded, (e) spawn internal error. When debugging, I had to grep `/private/tmp/relay.log` to find the real cause.

**Fix:** propagate the underlying error message to the response. Example: `{"error":"trigger failed","cause":"profile 'ceo-autopilot' not found in project 'overnight-saas'"}`.

---

## BUG — `register_profile` wipes unspecified fields

**Severity:** P1 (data loss on partial update)
**Found:** 2026-04-20 during overnight-saas run
**Impact:** Calling `register_profile` with only a subset of args (e.g. just `name` + `vault_paths`) nukes `context_pack`, `exit_prompt`, `role`, `allowed_tools`, `pool_size` back to empty. I wiped 13 profiles' context_packs by accident when trying to add a `TASK_STATE.md` path to their `vault_paths`.

**Repro:**
```bash
# existing profile with full context_pack set
curl -X POST /mcp register_profile { slug:"backend-dev", name:"...", context_pack:"...long..." , vault_paths:[] }

# "update" just vault_paths
curl -X POST /mcp register_profile { slug:"backend-dev", name:"...", vault_paths:["TASK_STATE.md"] }

# context_pack is now "" — data lost
```

**Expected:** partial update should merge (PATCH semantics) — fields not passed stay as-is.

**Current code (likely):** `register_profile` handler does a full `UPSERT` / `INSERT OR REPLACE` that fills every column, defaulting missing args to "". See `internal/relay/handlers.go` around the register_profile tool implementation and the DB `UpsertProfile` call in `internal/db/profiles.go`.

**Fix options (ranked):**

1. **Separate `update_profile` MCP tool** (cleanest). register_profile = full upsert, update_profile = partial PATCH. Clear semantics, no surprise.
2. **Merge semantics in register_profile** — before upsert, if profile exists, fetch current and fill missing args from it. Preserves the single-tool UX but is magic (hard to reset a field to empty).
3. **Require all fields on re-register** — keep current behavior, but fail loudly if existing profile exists and args are incomplete. Safest, most annoying.

**Workaround today:** always pass ALL fields on `register_profile`. Script:
```python
existing = GET /api/profiles/<slug>?project=X
args = {**existing, **new_fields}
POST register_profile args
```

**Related:** same footgun probably exists for `register_agent` — I hit it earlier when updating `reports_to` for backend-lead and it wiped `role`. Worth auditing every "upsert via MCP" tool for the same pattern.

**Recommendation:** go with option 1 (add `update_profile` + `update_agent` MCP tools). Clear contract: `register_*` = create-or-full-replace, `update_*` = partial patch.

---

## BUG — `PUT /api/schedules/{id}` with partial body silently no-ops

**Severity:** P2
**Found:** 2026-04-20 09:14Z
**Impact:** `PUT /api/schedules/<id>` with `{"enabled":false}` returned success but the schedule stayed `enabled=true`. Same family as the triggers PUT bug — partial-body update probably falls through to full-replace that requires all fields. Workaround: DELETE + recreate, or pass the full schedule body.

**Fix:** mirror the fix recommendation on schedules: either make PUT a real PATCH that merges, or reject partial bodies with 400.

---

## BUG — `PUT /api/triggers/{id}` silently no-ops

**Severity:** P1 (silent failure, misleading 200 response)
**Found:** 2026-04-20
**Impact:** Sending `PUT /api/triggers/{id}` with `{"max_duration":"20m"}` returned the trigger as if updated, but the actual stored TTL stayed unchanged. Cost me ~10 minutes of wrong assumption ("I bumped the lead TTL, why is backend-lead still killed at 10m?").

**Root cause:** `internal/relay/api.go` only has `POST /triggers` (create), `GET /triggers` (list), `DELETE /triggers/{id}`. There is no PUT/PATCH handler, so PUT falls through to... whatever the default is. It doesn't return 404 or 405.

**Repro:**
```bash
curl -X PUT /api/triggers/<uuid> -d '{"max_duration":"20m"}'
# response looks OK (no error)
curl /api/triggers | jq '.[] | select(.id=="<uuid>").max_duration'
# → still old value
```

**Fix:**
1. Add `apiUpdateTrigger` handler in `api_spawn.go` (mirror `apiUpdateSchedule`).
2. Wire the case in `api.go` router: `case strings.HasPrefix(path, "/triggers/") && req.Method == http.MethodPut`.
3. Return 405 for unsupported methods on this path until implemented — silent 200 is worse than explicit failure.

**Workaround today:** delete + recreate the trigger via `DELETE /triggers/{id}` then `POST /triggers`.

---

## BUG — spawn prompt does not include `task_id` of the dispatched task

**Severity:** P0 (breaks the entire task state machine)
**Found:** 2026-04-20
**Impact:** Spawned children cannot call `claim_task(task_id=...)` because they don't know their task_id. The `## Task` section in the assembled prompt shows `[priority] title + description + acceptance` but never surfaces the UUID. As a result, across 30+ spawns tonight, **zero tasks have `claimed_by` populated** — the state machine "in-progress" is set automatically by the spawn trigger, but no agent explicitly claimed. The CEO and auditor have no authoritative record of who owns what.

**Fix:** in `internal/spawn/prompt.go` around line 378 (the `## Task` section), add:
```go
fmt.Fprintf(&b, "**task_id:** `%s`\n\n", ctx.Task.ID)
```
Right after the title line. Also mirror into a `meta` block near the top:
```
## Meta (use these IDs in MCP calls)
- task_id: <uuid>
- agent: <your-name>
- project: <project>
```

Workaround today: agents call `list_tasks(assigned_to=<self>, status=in-progress)` → pick the matching title → use that ID. Hacky and fails when multiple tasks share a title.

---

## BUG — `reports_to` regresses on pool spawn / agent re-register

**Severity:** P1 (chain of command silently breaks)
**Found:** 2026-04-20 (3rd time in this run)
**Impact:** When a pool profile spawns a new agent (backend-dev-2, frontend-dev-3, product-researcher-1), or when an existing agent calls `register_agent` with itself without explicitly passing `reports_to`, the `reports_to` field resets to `ceo` (the sole remaining executive fallback). This breaks the chain: backend-lead → cto got reset to backend-lead → ceo; frontend-dev → frontend-lead got reset to frontend-dev → ceo; product-researcher → product-lead got reset to product-researcher → ceo.

**Root cause (hypothesis):** `resolveReportsTo()` fallback chain (template → sole exec → orphan) lands on "sole exec" = ceo when no template hint exists on the profile. Profiles have NO `reports_to` field to hint at the expected parent.

**Fix:**
1. Add `reports_to` to `register_profile` schema — pool-spawned agents inherit from profile template.
2. When `register_agent` is called WITHOUT reports_to and the agent exists, PRESERVE the existing reports_to (don't reset to default).
3. Also: consider inheriting from `dispatched_by` agent's `reports_to` when a child spawns via a task trigger (backend-dev spawned by backend-lead's dispatch should report to backend-lead, not ceo).

Option 2 is the cheap P1 fix. Option 1 is the "correct" fix. Do both.

---

## BUG — no `update_task` progress visibility in UI

**Severity:** P2 (observability)
**Found:** 2026-04-20
Children that run long (5-20min) can't signal progress to the board between claim and complete. Would be useful to have `update_task(task_id, progress_note)` append to an activity log visible in the web UI.

Probably partially implemented — need to verify what `update_task` does today and whether the web UI surfaces it.
