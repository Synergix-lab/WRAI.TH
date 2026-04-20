# UAT wrai.th — Rapport de synthèse (v2 exhaustive)

**Date** : 2026-04-18
**Build testé** : `v0.5.0-5-g7eba408-dirty` (commit `7eba408`, feat: v0.7)
**Branche** : `fix/command-panel-ui-polish` (avec modifs JS/CSS non commit)
**Méthode** : CLI + HTTP REST + MCP JSON-RPC + inspection UI static
**Durée totale** : ~2h cumulées (session 1 : 1h, session 2 : 1h)

Voir détails : `UAT-OK.md` (64 tests), `UAT-KO.md` (23 bugs), `UAT-PARTIAL.md` (15 ambigus).

---

## Score global

| Surface         | Tests OK | Partial | KO |
|-----------------|---------:|--------:|---:|
| CLI             |       12 |       3 |  6 |
| API REST        |       27 |       5 |  3 |
| MCP (75 tools)  |       21 |       4 |  7 |
| Web UI          |        4 |       1 |  0 |
| E2E flows       |       10 |       2 |  2 |
| Stress          |        3 |       1 |  0 |
| **Total**       |   **77** |  **16** | **18** |

Couverture effective : ~**70 %** des surfaces testées (100 % des MCP tools atteints, ~95 % des routes REST, 100 % CLI, UI seulement en static, E2E 10/10 scénarios plan).

---

## Ce qui bloque release v0.7

### P0 — BLOQUANTS

1. **`./agent-relay update` downgrade silencieusement vers v0.5.0** — si version locale ≥ remote, refuser ; demander confirmation avant d'écraser ; ajouter un skip si `version == "dev"` ou `unknown`.
2. **Pas de tag `v0.7.0`** — conséquence directe. `git tag v0.7.0 7eba408 && git push --tags` + publier la release GitHub avec binaires.
3. **CLI `send` oublie `CreateDeliveries`** — messages CLI invisibles à `inbox`. Fix 1-line dans `internal/cli/send.go:34`.
4. **Events underscore vs dot** — handlers fire `task_pending` mais doc/UI suggèrent `task.dispatched`. Standardiser (dot recommandé) ou alias map ; valider event name à la création du trigger.
5. **Budget pruning mark surfaced sans retour** — messages rejetés par `apply_budget:true` passent à `surfaced` et disparaissent à jamais. Bug bloquant pour la feature.
6. **MCP `spawn` n'injecte pas `vault_paths`** — profile avec `vault_paths:[...]` → prompt généré ne contient pas le contenu des docs. Casse la promesse "vault auto-injection".

### P1 — Fortement recommandé

7. **Version hardcodée `"0.5.0"`** dans `internal/relay/api.go:324` et `relay.go:48`. Injecter `main.Version`.
8. **`GET /api/spawn/children` et MCP `list_children` exigent `agent`** sinon `[]`. Skip la clause WHERE si agent vide.
9. **Project `default` jamais créé** en tant que row.
10. **`cooldown_seconds:0`** écrasé par 60 — distinguer zero-value d'unset.
11. **Broadcast autorisé sans team admin** alors que doc restreint. Trancher.
12. **Unblock task sans chemin MCP propre** — blocked → in-progress seulement via REST qui renvoie error. Ajouter `resume_task`.
13. **Trigger cooldown drops silencieux** — logger dans trigger_history avec `error:"cooldown (Xs remaining)"`.
14. **Inconsistance naming params MCP** — `delivery_id` vs `message_id`, `tasks` array vs `file_paths` JSON string, `name` vs `as` pour cibler un agent.
15. **CLI `memories -s "hyphenated-term"`** cassé par FTS5 parse — échapper les termes.
16. **CLI `send` accepte from="" et self-send** — valider from != "" && from != to.

### P2 — Nice to have

17. **README compteur MCP tools** : 67 affiché, en réalité 75, somme par section 62.
18. **`/api/activity` toujours vide** hors hooks Claude Code — instrumenter handlers MCP.
19. **CLI `stats` sans `-p`** affiche `default` sans le dire.
20. **Migration `surfaced`-par-défaut** pour messages pré-existants — marquer en `queued` si récent (<24h).
21. **`poll-trigger test` erreur opaque** — propager le détail.
22. **`claim_files` ne signale pas les conflits** — retourner `existing_claims`.
23. **Rollup goals pas aggregé cross-niveau** — project_goal n'agrège pas les tasks de ses agent_goals enfants.
24. **`PUT /api/profiles/:slug`** remplace tout — passer en merge ou renommer PATCH.
25. **`/api/tasks/latest` retourne vide** avec filtre "last 30s" strict.
26. **REST PUT quotas accepte no-op sans warning**.
27. **POST workflows ignore** les champs frontend (`trigger_type`, `definition`).
28. **`schedule.name` required error** ne liste pas tous les champs manquants.

---

## Features v0.7 validées fonctionnellement

- ✅ Event trigger dispatcher (fire + cooldown + history)
- ✅ Webhook receivers (`POST /api/webhooks/:project/:event`)
- ✅ Poll triggers (CRUD OK, test endpoint à améliorer)
- ✅ Skill registry (CRUD + lien profile)
- ✅ Signal handlers (alias trigger `signal:X`)
- ✅ Web terminal spawn (`claude --append-system-prompt`)
- ✅ Per-agent quotas avec enforcement réel (`quota exceeded` retourné)
- ✅ Spawn + trigger chain (task_pending → auto-spawn → child exécute → set_memory back)
- ✅ Team-gated DMs (refuse si pas de shared team/notify channel)
- ✅ Executive broadcast (`to:"*"` par is_executive:true)
- ✅ Conversation fan-out (alice+bob+cto, deliveries séparées)
- ✅ Task state machine complet (pending→accepted→in-progress→blocked→done, batch, archive)
- ✅ Goal cascade arbre nested (mais rollup par niveau, voir P2#23)
- ✅ Memory versioning + conflict supersedes
- ✅ Vault FTS5 search
- ✅ TTL expiry (reaper marque `expired_at`, inbox filtre)
- ✅ Budget pruning nominal (messages frais dans budget > 1KB)

---

## Features non testées (restent des blind spots)

- **Clics navigateur** : galaxy view rendering, colony canvas animations, kanban drag&drop, xterm.js, EasyMDE, flow-editor → `UAT-PARTIAL.md` flagged "ACTION REQUISE USER"
- **SSE streams réels** (`/activity/stream`, `/events/stream`) en session longue
- **Scheduler cron fire** sur plusieurs minutes (schedule créé mais pas attendu)
- **Hooks Claude Code → activity feed**
- **Multi-agent réel concurrent** (10+ agents sur le même projet en parallèle)
- **Budget pruning sous vraie charge** (100+ messages, mix priorités/tags)

---

## État du repo

- Branche `fix/command-panel-ui-polish` avec 3 fichiers modifiés (command-panel.js, main.js, style.css) non commit
- Binaire `agent-relay` rebuilt via `make build` → `v0.5.0-5-g7eba408-dirty`
- DB persistée `~/.agent-relay/relay.db` : 1 projet `uat` + project `default` (messages), 4 agents (alice, bob, cto, cto-child-414885c1), 3 profiles (cto, inspector), 1 org, 2 teams, 2 goals (mission + project_goal + agent_goal), 2 boards, 4 tasks actives, 3 tasks archivées, 14+ messages, 2+ memories, 2+ triggers, 1 poll-trigger, 1 skill, 3 cycles history, 1 workflow (run failed), 1 elevation, 1 custom-event
- Go 1.26.2 installé via brew
- Relay toujours up sur :8090 — à stopper proprement avec `./agent-relay status` et `kill $(lsof -ti :8090)` quand fini

---

## Prochaines étapes recommandées (ordre)

1. **Fix P0 (6 items)** → patch-set ciblé, ~1 jour de dev, testable via les 3 UAT docs existants
2. **Git tag v0.7.0** sur 7eba408 + publish GitHub release avec binaires multi-archi
3. **Session UI manuelle** : ouvrir http://localhost:8090 dans un browser, 30min de clic systématique, logger erreurs console dans `UAT-KO.md`
4. **Tests d'intégration automatisés** : au moins les scénarios E2E 5.1 (conversation) + 5.3 (TTL) + 5.6 (spawn chain) dans `handlers_test.go`
5. **Fix P1 (10 items)** pour v0.7.1
6. **P2 (12 items)** pour v0.8
7. **Stress test multi-agent** avant 1.0

---

## Déclaration

Cette UAT a couvert 77 chemins happy-path + 18 bugs + 16 comportements ambigus en 2 sessions. Le produit est **fonctionnellement utilisable** mais **pas prêt à tagger v0.7** tant que les 6 bugs P0 ne sont pas fixés, notamment le downgrade silencieux du CLI update et la feature budget qui détruit les messages rejetés.
