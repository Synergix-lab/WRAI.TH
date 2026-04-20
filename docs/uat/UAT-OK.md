# UAT — OK

Tests réussis conformes aux attentes.

Format : **Test** → **Voulu** → **Obtenu** → **Commentaire**

---

## CLI

### `./agent-relay status` (relay stopped)
- **Voulu** : afficher l'état stopped sans crasher
- **Obtenu** : `relay: stopped` + `db: not found`
- **Commentaire** : OK, message clair

### `./agent-relay serve` (démarrage)
- **Voulu** : lancer le serveur HTTP sur :8090
- **Obtenu** : serveur démarré, `status` confirme `running (:8090)`
- **Commentaire** : OK

### `./agent-relay --help`
- **Voulu** : liste des commandes et flags
- **Obtenu** : aide complète et lisible
- **Commentaire** : OK

### `./agent-relay send alice bob "hello world"`
- **Voulu** : envoyer un message, retourner l'id
- **Obtenu** : `ok → bob (id:66d5bed4)`
- **Commentaire** : OK

### `./agent-relay inbox bob`
- **Voulu** : lister les messages non lus de bob
- **Obtenu** : `1 unread: [notification] alice → "hello world" ...`
- **Commentaire** : OK

### `./agent-relay agents -p uat` après register
- **Voulu** : liste alice + bob avec statut online après register_agent
- **Obtenu** : 2 lignes, statut `online`, rôles affichés, "just now"
- **Commentaire** : OK

## API REST

### `GET /api/health`
- **Voulu** : JSON health check
- **Obtenu** : `{"status":"ok","version":"0.5.0","uptime":"...","db":{...counts...}}`
- **Commentaire** : endpoint OK (version hardcoded, voir KO)

### `GET /api/projects` (après create_project)
- **Voulu** : lister les projets avec agent/task counts
- **Obtenu** : `[{"name":"uat","planet_type":"forest/1","agent_count":2,"online_count":2,...}]`
- **Commentaire** : OK, planet_type automatiquement assigné (forest/1)

### `GET /api/agents?project=uat`
- **Voulu** : liste des agents du projet
- **Obtenu** : alice + bob avec status, online, session_id
- **Commentaire** : OK

### `POST /api/triggers` + `GET /api/triggers`
- **Voulu** : créer trigger event→profile+cycle, le lister
- **Obtenu** : 201 Created avec ID + cooldown default 60s ; GET retourne le trigger
- **Commentaire** : OK

### `POST /api/poll-triggers` + `GET /api/poll-triggers`
- **Voulu** : créer poll trigger URL→condition→event
- **Obtenu** : 201 avec tous les champs, defaults `cooldown_seconds:300`, `enabled:true`
- **Commentaire** : OK

### `POST /api/skills` + `GET /api/skills`
- **Voulu** : créer skill avec tags JSON string
- **Obtenu** : skill créé, visible en GET
- **Commentaire** : OK

### `POST /api/signal-handlers` + `GET /api/triggers`
- **Voulu** : créer un signal handler (alias trigger event=signal:X)
- **Obtenu** : 201, apparaît dans triggers avec `event:"signal:deploy-done"`
- **Commentaire** : OK, design cohérent (signal-handler = trigger préfixé)

### `POST /api/webhooks/uat/task.dispatched`
- **Voulu** : déclencher évaluation des triggers pour cet event
- **Obtenu** : `{"fires":[],"skipped":[{"trigger_id":"...","reason":"profile cto not found"}]}`
- **Commentaire** : OK — webhook arrive, trigger matché, skipped avec raison claire

### MCP `send_message` + `get_inbox` — flow complet
- **Voulu** : send crée une delivery `queued`, get_inbox la surface et passe à `surfaced`, ack_delivery → `acknowledged`
- **Obtenu** : chaque étape retourne les bonnes structures, `delivery_state` propagé dans la réponse inbox
- **Commentaire** : OK, model deliveries cohérent

### MCP `dispatch_task` → `task_pending` trigger → child spawn
- **Voulu** : dispatcher une task doit fire un trigger matché et créer un child dans spawn_children
- **Obtenu** : trigger fire, child créé (status:running → finished, exit_code:0), trigger_history enregistré
- **Commentaire** : OK (à condition d'utiliser le nom d'event `task_pending` avec underscore, voir KO)

### MCP `set_memory` + `search_memory` + conflict versioning
- **Voulu** : écrire, chercher via FTS5, versionner quand même key + agent différent
- **Obtenu** : v1 → v2 avec `supersedes` pointant vers v1, `layer:"behavior"` auto-assigné
- **Commentaire** : OK, design propre

### Web UI — HTML + assets
- **Voulu** : `GET /` sert l'app, `/style.css`, `/js/main.js`, `/img/wraith-logo.jpeg` servis avec bons content-types
- **Obtenu** : tous OK (115KB main.js, 73KB style.css, image 54KB)
- **Commentaire** : OK

### MCP `tools/list` — 75 tools exposés (v0.7)
- **Voulu** : MCP server publie la liste complète des tools
- **Obtenu** : 75 tools (register_agent, send_message, dispatch_task, spawn, trigger_cycle, get_session_context, etc.)
- **Commentaire** : OK fonctionnellement (voir PARTIAL pour l'écart avec la doc)

### MCP `get_session_context`, `get_goal_cascade`, `search_vault`
- **Voulu** : récupérer en un call l'état de session, la cascade de goals, les docs vault matchant une query
- **Obtenu** : tous retournent des JSON structurés cohérents (pending_tasks, progress, FTS5 excerpts)
- **Commentaire** : OK, compact_get_session_context devrait être évalué sur un vrai projet (gros contenu)

### MCP `claim_files`, `list_locks`
- **Voulu** : poser et lister des advisory locks
- **Obtenu** : locks créés avec file_paths JSON string, TTL 1800s, visibles en list_locks
- **Commentaire** : fonctionnel (conflits non signalés, voir PARTIAL)

### MCP `create_conversation` + fanout deliveries
- **Voulu** : créer une convo avec alice+bob+cto (caller auto-added), send_message avec `conversation_id` → bob+cto reçoivent
- **Obtenu** : convo créée, send fanout vers les 2 autres membres, delivery `queued` chacun, get_conversation_messages retourne le thread
- **Commentaire** : OK, design solide

### MCP `invite_to_conversation`, `leave_conversation`, `archive_conversation`
- **Voulu** : gérer le cycle de vie d'une conversation
- **Obtenu** : invite diana OK, leave alice OK, archive OK
- **Commentaire** : OK

### MCP Team-gated messaging
- **Voulu** : après retrait d'un agent d'une team partagée, `send_message` directe doit échouer
- **Obtenu** : `not authorized to message 'bob' — no shared team, reports_to chain, or notify channel`
- **Commentaire** : **BONUS** — le contrôle d'autorisation DM fonctionne correctement (à la différence du broadcast — voir KO)

### MCP Team lifecycle
- **Voulu** : create_team, add/remove_team_member, send to `team:slug`, get_team_inbox, list_teams
- **Obtenu** : engineering créée, alice admin + bob member, remove_team_member OK, team send fan-out, get_team_inbox retourne la liste, list_teams avec members
- **Commentaire** : OK

### MCP `create_org`, `list_orgs`
- **Voulu** : créer une org cross-project (avec `slug` obligatoire)
- **Obtenu** : org créée, liste retourne 1
- **Commentaire** : OK

### MCP Task state machine complet
- **Voulu** : pending → accepted (claim) → in-progress (start) → blocked (block avec reason) → in-progress (unblock) → done (complete). Plus update_task priority, move_task, cancel_task, batch_dispatch, batch_complete, archive_tasks
- **Obtenu** : toutes les transitions principales OK. Batch dispatch + complete atomiques. Archive retourne `Archived N tasks (status=done)`. cancel → status cancelled.
- **Commentaire** : OK à l'exception de l'unblock (voir KO)

### MCP `update_goal`, `get_goal`, `archive_board`, `delete_board`
- **Voulu** : modifier status goal, lire avec rollup progress, archiver board + cascading tasks, delete_board après archive
- **Obtenu** : toutes les ops OK, progress `total_tasks:2, done_tasks:1`, board archived puis deleted
- **Commentaire** : OK

### MCP `get_memory`, `delete_memory`
- **Voulu** : lire par key, soft-delete
- **Obtenu** : get retourne v2 (supersedes v1 OK), delete retourne `{deleted:true}`
- **Commentaire** : OK

### MCP `get_profile`, `find_profiles`, `register_vault`, `get_vault_doc`
- **Voulu** : lire profile, chercher par skill, enregistrer vault externe, lire doc d'un vault
- **Obtenu** : get_profile cto ✓, register_vault /tmp/uat-vault → `docs_indexed:2`, get_vault_doc test1.md OK
- **Commentaire** : OK (find_profiles retourne 0 car skill non liée — comportement attendu)

### MCP `ack_delivery`, `release_files`, `get_thread`, `schedule`, `trigger_cycle`, `unschedule`
- **Voulu** : ack une delivery par ID, libérer locks, lire thread, planifier cron + déclencher manuellement + supprimer
- **Obtenu** : ack → acknowledged, release OK, get_thread retourne la chaîne, schedule créé avec schedule_id, trigger_cycle OK, unschedule OK
- **Commentaire** : OK (après avoir trouvé les bons noms de params : delivery_id, cron_expr, schedule_id)

### MCP TTL expiry
- **Voulu** : message avec ttl_seconds:3 doit être marqué `expired_at` après 3s et ne plus apparaître dans inbox
- **Obtenu** : après 4s, `expired_at` peuplé dans DB, inbox retourne 0 pour bob
- **Commentaire** : OK — reaper fonctionne

### REST `GET/PUT /api/settings`
- **Voulu** : lire+écrire settings globaux (sun_type)
- **Obtenu** : GET→`{sun_type:"1"}`, PUT avec `{sun_type:"3"}` → 200, GET confirme `sun_type:"3"`
- **Commentaire** : OK

### REST `PATCH /api/projects/:name`
- **Voulu** : modifier planet_type d'un projet
- **Obtenu** : 200 `{ok:"true"}`
- **Commentaire** : OK

### REST `GET /api/messages/all-projects`, `/latest`
- **Voulu** : all-projects = tout, latest = messages des 30s dernières
- **Obtenu** : all-projects liste tout incluant `default`, latest retourne `[]` (rien dans les 30s)
- **Commentaire** : OK (latest est un feed temps réel, correct)

### REST Profiles CRUD complet
- **Voulu** : POST/PUT/DELETE /api/profiles
- **Obtenu** : POST crée backend avec id+pool_size=3 default, PUT met à jour, DELETE retourne `{status:"deleted"}`
- **Commentaire** : OK (note : PUT remplace tout, context_pack wiped — à noter dans PARTIAL)

### REST `DELETE /api/agents/:name`
- **Voulu** : deactivate un agent
- **Obtenu** : `{agent:"diana", status:"deactivated"}`
- **Commentaire** : OK (soft delete)

### REST `GET /api/org`, `/teams/:slug/members`
- **Voulu** : arbre org + members d'une team
- **Obtenu** : org retourne les agents actifs sans reports_to, team members retourne liste + team meta
- **Commentaire** : OK

### REST Quotas CRUD
- **Voulu** : GET/PUT/DELETE /api/quotas/:agent
- **Obtenu** : GET retourne usage réel (tokens_used_24h, messages_used_1h, etc), PUT updated, DELETE deleted
- **Commentaire** : OK (tracking d'usage fonctionne même sans limits. Field naming : `max_*` requis voir PARTIAL)

### REST Cycles CRUD
- **Voulu** : POST crée cycle avec name+prompt+ttl (int)
- **Obtenu** : crée `heartbeat-5min` TTL 300s, GET /cycles retourne la liste
- **Commentaire** : OK

### REST Workflows CRUD + execute
- **Voulu** : créer workflow, execute, lister runs
- **Obtenu** : POST crée workflow, /execute lance un run (id, status:running), /runs liste le run (failed "no trigger node found" car j'ai pas défini de node — normal)
- **Commentaire** : OK — nodes/edges stockés comme JSON strings

### REST Elevations
- **Voulu** : POST /api/elevations avec agent+role+granted_by+reason
- **Obtenu** : 1h expiry par défaut, ID retourné
- **Commentaire** : OK

### REST Custom events + webhook
- **Voulu** : définir un event type, le fire via webhook
- **Obtenu** : POST /api/custom-events crée deploy-done ; POST /api/webhooks/uat/deploy-done retourne `{fires:[],skipped:[]}` (aucun trigger défini)
- **Commentaire** : OK

### E2E Goal cascade avec rollup via `/api/goals/cascade`
- **Voulu** : arbre mission → project_goal → agent_goal avec `total_tasks` / `done_tasks` / `progress` à chaque niveau
- **Obtenu** : REST et MCP retournent l'arbre nested complet avec `children[]`. Chaque nœud a ses counts directs.
- **Commentaire** : OK pour structure. **Note** : les counts sont par niveau, pas aggregés cumulatif (voir PARTIAL)

### E2E Executive broadcast (`to:"*"`)
- **Voulu** : cto (`is_executive:true` → auto-join leadership) peut broadcast à tous
- **Obtenu** : broadcast reçu par alice + bob via deliveries
- **Commentaire** : OK

### E2E TTL expiry complet
- **Voulu** : message avec ttl_seconds:3 → reaper marque `expired_at` et inbox le cache
- **Obtenu** : après 4s, `expired_at` peuplé, inbox 0 messages pour bob
- **Commentaire** : OK

### E2E Budget pruning (messages frais)
- **Voulu** : avec un budget raisonnable, inbox retourne les messages prioritisés
- **Obtenu** : 2 fresh msgs (P0 + P3) rentrent dans budget 4096, P0 en premier
- **Commentaire** : OK pour le cas nominal (voir KO pour le cas où budget trop petit)

### E2E MCP `spawn` + `kill_child`
- **Voulu** : spawn un child avec profile custom, récupérer child_id, kill
- **Obtenu** : child créé dans spawn_children, status:running, prompt assemblé, kill → status:killed
- **Commentaire** : OK (voir KO pour vault injection manquante)

### Stress — Concurrence 10 sends parallèles
- **Voulu** : 10 send_message en parallèle, aucun drop, aucune race
- **Obtenu** : 10/10 succès, 10 rows en DB, pas d'isError
- **Commentaire** : OK (SQLite WAL handle correctement)

### Stress — Trigger cooldown
- **Voulu** : 5 fires rapides avec cooldown=60s → 1 seul fire effectif
- **Obtenu** : 1 fire OK (child spawné), 4 fires droppés silencieusement par cooldown
- **Commentaire** : OK fonctionnellement (voir PARTIAL : silence total n'est pas idéal pour debug)

### Stress — Quota enforcement
- **Voulu** : quota `max_messages_per_hour:3`, alice (déjà 6 msgs/1h) doit voir tous ses sends rejetés
- **Obtenu** : `quota exceeded: messages 6/3 for agent 'alice'` — message précis, block correct
- **Commentaire** : OK

### CLI `init --port 9999`
- **Voulu** : générer un .mcp.json avec le port custom
- **Obtenu** : url `http://localhost:9999/mcp?project=testproj`
- **Commentaire** : OK

### CLI `children -p uat relay-os -s finished`
- **Voulu** : lister les children finis avec parent_agent spécifié
- **Obtenu** : 3 children finished, incluant celui killé (error: signal: killed)
- **Commentaire** : OK (fonctionne SSI on passe le parent_agent)

### CLI robustesse — IDs malformés et projets absents
- **Voulu** : messages d'erreur clairs
- **Obtenu** : `thread 000` → `no message found with prefix "000"` ; `schedules -p empty` → `no schedules found`
- **Commentaire** : OK (avec PARTIAL note sur `inbox` silencieux si project absent)

### UI — structure HTML
- **Voulu** : tous les panels attendus présents dans le DOM (galaxy, colony canvas, kanban, vault, ops, messages, memories, tasks, agent-detail, command-panel, quest-tracker)
- **Obtenu** : 10 panels trouvés avec IDs propres (`#kanban-panel`, `#vault-panel`, `#ops-panel`, etc.). Tabs `#tab-messages`, `#tab-memories`, `#tab-tasks`. Widget token avec pills période. Help button.
- **Commentaire** : OK pour la structure, clics manuels browser requis pour valider les interactions

### UI — endpoints API backing tous répondent
- **Voulu** : tous les endpoints appelés par `api-client.js` répondent avec du JSON valide
- **Obtenu** : testés et OK : /settings, /tasks/all, /tasks/latest, /conversations/all, /teams/all, /token-usage/{agent,project,timeseries}, /vault/stats, /vault/docs/all, /vault/doc/:path, /cycle-history, /cycles, /elevations, /workflows, /custom-events, /spawn/context
- **Commentaire** : OK — pas de 404 ni 500 sur les lectures UI

### API `GET /api/token-usage/agent`
- **Voulu** : breakdown par tool pour un agent
- **Obtenu** : liste `{key:tool_name, bytes, tokens, call_count}` triée par tokens desc
- **Commentaire** : OK, utile pour agent detail panel

### API `GET /api/token-usage/timeseries`
- **Voulu** : buckets temporels (5min/1h/24h) avec tokens+calls
- **Obtenu** : `[{bucket:"2026-04-18T12:00",tokens:2437,call_count:26}]`
- **Commentaire** : OK, format adapté au sparkline

### API `GET /api/cycle-history`
- **Voulu** : historique des spawns avec tokens cache/input/output et success
- **Obtenu** : entry `relay-os` / `spawn:cto` avec `cache_creation_tokens:25064`, `cache_read_tokens:91003`, `input_tokens:13`, `output_tokens:1155`, duration 24s
- **Commentaire** : OK, télémétrie riche

### API `GET /api/vault/doc/:path` et `/api/vault/stats`
- **Voulu** : servir le contenu markdown + stats agrégées
- **Obtenu** : content retourné intégralement, stats `{doc_count:12, total_bytes:44246}`
- **Commentaire** : OK

### Web terminal — spawn d'un process `claude`
- **Voulu** : `POST /api/terminal/spawn {profile:"cto"}` lance `claude` avec `--append-system-prompt` construit depuis le profile
- **Obtenu** : process PID 38303, session_id retourné, `POST /api/terminal/:id/kill` arrête le process
- **Commentaire** : OK fonctionnellement. Note : consomme des tokens Claude pendant l'exécution.

### MCP `complete_task`
- **Voulu** : passer status → done
- **Obtenu** : `"status":"done"` retourné
- **Commentaire** : OK

### `GET /api/trigger-history`
- **Voulu** : audit log des tentatives de fire
- **Obtenu** : record de la tentative skipped avec error, fired_at
- **Commentaire** : OK

### `./agent-relay conversations bob` / `memories` / `children` / `schedules` / `history` (vides)
- **Voulu** : retour vide clair quand aucune donnée
- **Obtenu** : chaque commande retourne un message explicite (`No conversations for bob`, `no spawned children found`, etc.)
- **Commentaire** : OK, cohérent
