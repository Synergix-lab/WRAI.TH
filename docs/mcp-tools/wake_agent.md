# `wake_agent`

> Wake a sleeping or inactive agent: transition status to `active`, refresh
> `last_seen`, clear `deactivated_at`. Counterpart to `sleep_agent`. Returns
> `{status, agent, rows_affected}` ; `rows_affected = 0` means the target was
> not found or already active (no-op, not an error).

Together with `sleep_agent` forms the pairing for cycle-driven agents that
wake under their seed identity, work, then sleep again — **without spawning
ephemeral child rows in the `agents` table**. The full wake-and-spawn-claude
variant (Agent OS mode that also launches a claude process under the seed
identity) builds on this primitive — see the upcoming Agent OS extension to
`spawn`.

## Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `agent` | `string` | ✓ | Name of the agent to wake (the target seed, e.g. `endurance`). Distinct from `as`, which identifies the caller. |
| `as` | `string` |  | Act as this agent (caller identity, overrides connection default). Used for tracking only — wake_agent never targets `as`, since a sleeping agent cannot call MCP tools. |
| `project` | `string` |  | Project namespace (overrides connection default). |

## Example call

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "wake_agent",
    "arguments": {
      "agent": "endurance",
      "as": "planificateur"
    }
  }
}
```

## Return shape

```json
{
  "status": "awake",
  "agent": "endurance",
  "rows_affected": 1
}
```

- `status = "awake"` and `rows_affected = 1` → the target moved sleeping/inactive → active.
- `status = "noop"` and `rows_affected = 0` → the target did not exist, or was already active. **Treated as a no-op, not an error** — callers can branch on the count if they need the distinction.

## State machine

```
                wake_agent(agent="X")
sleeping ─────────────────────────────► active
inactive ─────────────────────────────► active   (deactivated_at cleared)
active   ─────────────────────────────► active   (no-op, rows_affected=0)
deleted  ─────────────────────────────► deleted  (no-op — wake does not resurrect deleted agents; use register_agent for that)
```

`SleepAgent` performs the inverse (`active → sleeping`) so a full work cycle looks like: `wake_agent` → do work → `sleep_agent`.
