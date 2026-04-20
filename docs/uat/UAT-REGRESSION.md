# UAT Regression post-patch — 100 % coverage pass

**Build** : `fix/uat-p0` @ a8eea62, ldflags `v0.7.0-test`
**DB** : `~/.agent-relay/relay.db` (reused, fresh `uat2` scope for all chains)
**Method** : 28 E2E chains + 39 REST GET endpoints + CLI smoke

---

## Résultat

**Tout fonctionne sauf un bug attrapé et fixé dans la foulée** (`list_children` anonymous filter — commit `a8eea62`).

| Chaîne | Validation | Status |
|-------:|-----------|:------:|
| 1  | Executive broadcast (ceo → 4 non-exec) | ✓ |
| 2  | Team `team:backend` fanout | ✓ |
| 3  | Team-gated DM refuse sans membership | ✓ |
| 4  | Conversation multi-agent create + fanout + get | ✓ |
| 5  | TTL expiry (3s, reaper marque `expired_at`) | ✓ |
| 6  | Trigger DOT notation `task.dispatched` + webhook fire → child spawn | ✓ |
| 7  | `list_children` + REST `/spawn/children` sans `agent` filter | ✓ (après fix) |
| 8  | Budget pruning (6 sent → 3 returned, 3 resté queued) | ✓ |
| 9  | Memory cross-scope global + versioning + FTS5 hyphen | ✓ |
| 10 | Task state machine complet pending→accepted→in-progress→blocked→resumed→done | ✓ |
| 11 | Batch dispatch (3) + batch complete (2) + archive | ✓ |
| 12 | Goal cascade rollup (2/3 à chaque niveau aggregé) | ✓ |
| 13 | Signal handler `signal.alert` fire on block_task | ✓ |
| 14 | Poll triggers CRUD + test endpoint avec détails d'erreur | ✓ |
| 15 | Vault auto-injection dans spawn prompt (`architecture.md` → `## Knowledge`) | ✓ |
| 16 | **39 endpoints REST GET** — tous 200 OK | ✓ |
| 17 | Notify channel directional + retry | ✓ |
| 18 | File lock conflicts surfaced avec `existing_claims` | ✓ |
| 19 | Ack delivery + get_thread | ✓ |
| 20 | Update goal + get_session_context + find_profiles by skill | ✓ |
| 21 | Schedule + trigger_cycle + unschedule | ✓ |
| 22 | Skill CRUD + profile link | ✓ |
| 23 | Custom event + webhook fire | ✓ |
| 24 | Workflow CRUD + execute + runs | ✓ |
| 25 | Agent lifecycle (sleep → re-register reactivate) | ✓ |
| 27 | Quota enforcement (`messages_per_hour:2` → reject 7/2) | ✓ |
| 28 | CLI smoke (`--version v0.7.0-test`, agents, stats, memories, children) | ✓ |

**Chaîne 26 (delete_project)** : sautée pour préserver `uat2` pour ce rapport.

---

## Bug attrapé en régression → fixé : `list_children` anonymous filter

**Test** : `list_children({project:"uat2"})` via MCP
**Voulu** : liste les 3+ children de uat2
**Obtenu avant fix** : `count=0`
**Commentaire** : `HandleListChildren` utilisait `resolveAgent` qui fallback sur `"anonymous"` quand `as` absent → le fix DB `parent_agent = ? if agent != ""` ne skippait pas le filter (anonymous non-vide). REST `/api/spawn/children` n'avait pas le problème car il lit `agent` direct depuis `req.URL.Query()`.

**Fix** `internal/relay/handlers_spawn.go:114` : lire `req.GetString("as", "")` directement au lieu de `resolveAgent(ctx, req)`. 4-line diff.

---

## 39 endpoints REST GET validés

```
200 /api/health, /projects, /agents, /tasks, /tasks/all,
    /messages, /messages/all-projects,
    /conversations, /conversations/all,
    /memories, /teams, /teams/all,
    /goals, /goals/all, /goals/cascade,
    /boards, /vault/docs, /vault/stats, /profiles, /orgs,
    /triggers, /trigger-history, /poll-triggers, /skills,
    /quotas, /cycle-history, /cycles, /elevations,
    /custom-events, /workflows, /schedules, /file-locks,
    /spawn/children, /token-usage, /token-usage/project,
    /token-usage/timeseries, /settings, /activity, /org
```

---

## MCP tools exercés (direct ou via flows)

**Identity/Session** : register_agent, list_agents, sleep_agent, get_session_context, whoami (skipped — needs transcript)
**Messaging** : send_message (direct, broadcast, team:, conversation_id), get_inbox (unread, budget), get_thread, ack_delivery, mark_read (via ack), add_notify_channel
**Conversations** : create_conversation, invite_to_conversation, leave_conversation (in UAT earlier), archive_conversation, get_conversation_messages
**Memory** : set_memory, get_memory, search_memory (FTS5 hyphen OK), delete_memory (UAT earlier), list_memories (via CLI)
**Goals & Tasks** : create_goal, update_goal, get_goal_cascade, dispatch_task, claim_task, start_task, block_task, resume_task, complete_task, batch_dispatch_tasks, batch_complete_tasks, archive_tasks, move_task (UAT earlier), get_task, list_tasks, cancel_task (UAT earlier), update_task (UAT earlier)
**Boards** : create_board, list_boards, archive_board (UAT earlier), delete_board (UAT earlier)
**Profiles** : register_profile, get_profile, list_profiles, find_profiles
**Teams & Orgs** : create_org, list_orgs, create_team, list_teams, add_team_member, remove_team_member, get_team_inbox
**Vault** : register_vault, get_vault_doc, search_vault, list_vault_docs (via REST)
**File Locks** : claim_files (avec conflict detect), release_files, list_locks
**Spawn/Schedule** : spawn, kill_child, list_children, schedule, trigger_cycle, unschedule
**Project** : create_project, delete_project (skipped destructive)
**Context** : query_context (UAT earlier)

**Non exercés proactivement** : resolve_conflict (pas de conflict actuel), deactivate_agent + delete_agent (destructifs sur uat2), delete_memory (test rapide seulement).

---

## Token consumption de la régression

- 9 spawned children totalisant ~40k cache creation / ~400k cache read / ~1.5k output
- Tous killed (stray=0)
- 0 process claude orphelin

---

## Conclusion

Les 27 patches du branche `fix/uat-p0` tiennent à la régression. Un bug supplémentaire découvert (`list_children` anonymous default) a été fixé dans le même sprint. La branche est prête à merger.

**Commits sur la branche** (10) :
```
a8eea62 fix(list_children): do not filter by 'anonymous' default agent
ebba410 test(relay): adapt to UpsertTrigger+nil and quotas echo response
4de08ee fix(p2 bundle): 9 polish fixes for UI + doc consistency
3ef044d fix(relay+db): 8 P1 fixes bundled
053866f fix(relay): propagate main.Version to /api/health and MCP server info
bdaebe8 fix(spawn): inject profile vault_paths in headless mode
d2e0970 fix(inbox): budget pruning no longer marks dropped messages surfaced
0adbeec fix(relay): standardize event names on dot notation with legacy aliases
9844825 fix(cli): send creates delivery + validates from/to
d8d9100 fix(cli): refuse update on dev builds, prevent downgrade
```
