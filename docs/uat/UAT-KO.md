# UAT — KO

Tests échoués, bugs ou fonctionnalités manquantes.

Format : **Test** → **Voulu** → **Obtenu** → **Commentaire**

---

## CLI

### `./agent-relay --version`
- **Voulu** : afficher `v0.7.0` (le dernier commit est v0.7)
- **Obtenu** : `agent-relay dev`
- **Commentaire** : ldflags `-X main.version=...` pas injectés au build. Releases prod vont shipper avec `dev` si le Makefile n'est pas utilisé.

### `./agent-relay update` — CRITIQUE : downgrade silencieux
- **Voulu** : détecter que la version locale (v0.7 / commit du 14 mars) est plus récente que la dernière release GitHub (v0.5.0) et skip, ou au minimum demander confirmation
- **Obtenu** :
  - `current: unknown` (conséquence du bug `--version=dev`)
  - `latest release... v0.5.0` téléchargé et écrit sur `agent-relay` **sans demander**
  - Taille binaire : 24 MB → 13 MB, version passée à v0.5.0
- **Commentaire** : BUG BLOQUANT. Un utilisateur qui build depuis main et lance `update` perd toutes les features v0.6/v0.7 (spawn engine, web terminal, command panel, triggers, webhooks, poll-triggers, skills, quotas). Fix :
  1. Si `version == "dev"` ou `unknown` → skip update et avertir (`run make build` ou équivalent)
  2. Ajouter un check `semver.Compare(local, remote) >= 0` → `already up to date`
  3. Toujours confirmer avant d'écraser
  4. Release v0.6 et v0.7 sur GitHub — sinon `update` pointera toujours vers v0.5

### CLI `send` — ne crée pas de delivery → message invisible à `inbox`
- **Voulu** : `./agent-relay send alice bob "hi"` suivi de `./agent-relay inbox bob` doit afficher 1 unread
- **Obtenu** : send retourne OK, mais inbox retourne `no unread messages for bob`
- **Commentaire** : ROOT CAUSE identifié. `internal/cli/send.go:34` appelle seulement `d.InsertMessage(...)`. Les seuls callers de `CreateDeliveries` sont dans `internal/relay/handlers.go:312,335` et `internal/relay/api.go:747` (MCP + HTTP API). Le CLI oublie la fan-out. Fix : dans `runSend`, ajouter `d.CreateDeliveries(msg.ID, project, []string{to})` après InsertMessage (+ gestion broadcast `*` et conversation membership si supporté en CLI).

### CLI `inbox` post-migration — état `surfaced` masque les unread historiques
- **Voulu** : après un restart, les messages unread envoyés via CLI restent lisibles comme unread
- **Obtenu** : `migrateDeliveries` (internal/db/migrate_deliveries.go:109) marque tout message pré-existant comme `surfaced` (= "assume already seen since it's historical"). `inbox --unreadOnly=true` filtre sur `state='queued'` → retourne 0.
- **Commentaire** : le hardcode `return "surfaced"` est défensif mais trop agressif. Pour un dev qui fait `send` puis `restart`, tous ses messages passent à surfaced même s'ils n'ont jamais été lus. Suggestion : backfill en `queued` si `message_reads` est vide ET le message est récent (< 24h), sinon `surfaced`.

### Version hardcodée dans `/api/health` et MCP server info
- **Voulu** : la version remontée par `/api/health` et `initialize` MCP doit refléter la build
- **Obtenu** : `internal/relay/api.go:324` hardcode `"version":"0.5.0"`. `internal/relay/relay.go:48` passe `"0.5.0"` comme version MCP server.
- **Commentaire** : 2 endroits où v0.5 est gelé alors qu'on est en v0.7. Fix : injecter `main.Version` dans le Relay struct et l'exposer partout (health, MCP serverInfo, UI footer).

### `POST /api/poll-triggers/:id/test` — erreur opaque
- **Voulu** : exécuter immédiatement le poll et retourner le résultat (matched/value) ou une erreur détaillée
- **Obtenu** : `{"error":"poll test failed"}` sans détail
- **Commentaire** : l'erreur est enveloppée via `apiError` mais le body ne contient pas `details`. Vérifier `PollOnceByID` — probable erreur réseau non propagée à l'utilisateur. Améliorer le message (timeout ? URL injoignable ? condition mal écrite ?).

### Event names — incohérence dot vs underscore
- **Voulu** : un seul schéma de naming, documenté
- **Obtenu** : les handlers firent `task_pending`, `task_completed`, `task_blocked`, `message_received`, `signal:interrupt`, `signal:alert` (underscore). Le README, les boot prompts et les signal-handler POST montrent / acceptent `task.dispatched`, `task.complete`, `task.block` (dot notation). Les deux formats coexistent sans validation.
- **Commentaire** : un utilisateur qui enregistre un trigger `event:"task.dispatched"` croit écouter les dispatches, mais rien ne fire. Aucun warning à la création du trigger. Fix :
  1. Standardiser sur un format (recommandé: dot notation — plus idiomatique)
  2. Renommer dans `dispatcher.go` et callers — ou accepter les deux via alias map
  3. Valider à la création du trigger : rejeter si event inconnu (ou warning si non-standard)
  4. Lister les events valides dans la doc du champ `event`

### `GET /api/spawn/children?project=X` — retourne `[]` sans `agent`
- **Voulu** : lister TOUS les children d'un projet (spawned par `relay-os` ou par un agent parent)
- **Obtenu** : query forcée `WHERE parent_agent = ? AND project = ?` avec parent_agent="" → 0 rows (internal/db/spawn.go:22-24)
- **Commentaire** : appel sans `?agent=...` est fonctionnellement inutile. Pour le web UI "voir tous les children d'un projet", il faut itérer sur tous les agents. Fix : si `agent` est vide, skip la clause `parent_agent = ?`. Même fix pour CLI `./agent-relay children -p uat` (sans nom d'agent).

### `cooldown_seconds:0` ignoré à l'upsert des triggers
- **Voulu** : `cooldown_seconds:0` → pas de cooldown
- **Obtenu** : réponse retourne `cooldown_seconds:60` (default appliqué quand `0`)
- **Commentaire** : 0 est probablement traité comme "unset" dans le code Go (zero-value). Fix : utiliser `*int` ou un flag séparé pour distinguer "non fourni" de "explicitement 0".

### MCP `list_children` (et CLI `children` sans agent) — retourne toujours vide
- **Voulu** : lister tous les children du projet `uat` (au moins 3 finis existent)
- **Obtenu** : `{active_count:0, children:[]}` ; REST `/api/spawn/children?project=uat&agent=relay-os` retourne 3
- **Commentaire** : même root cause que pour `/api/spawn/children` — le filter `parent_agent = ?` est appliqué sans skip. Fix dans `ListSpawnChildren` + adapter les handlers MCP `list_children` et REST qui n'envoient pas `agent`.

### MCP `list_schedules` — returns `schedules:[]` malgré `total_jobs:1`
- **Voulu** : lister le schedule créé via MCP `schedule`
- **Obtenu** : `{scheduler_running:true, schedules:[], total_jobs:1}` ; `/api/schedules?project=uat` retourne bien la row
- **Commentaire** : la requête MCP filtre probablement sur `agent_name = ?` avec `as` vide. Aligner sur REST.

### MCP Unblock task — pas de chemin MCP propre
- **Voulu** : transition `blocked → in-progress` accessible via MCP (update_task, start_task, resume_task)
- **Obtenu** : `update_task` refuse de changer `status` (schema : "Preserves assignee, claim, and progress history"). `POST /api/tasks/:id/transition` répond `task transition failed`. Aucun tool explicite `resume_task` / `unblock_task`.
- **Commentaire** : design gap — une task blocked reste prisonnière. Ajouter un tool `resume_task` ou ouvrir `update_task.status` aux transitions supportées.

### MCP `send_message` + API Inconsistance de nommage de paramètres
- **Voulu** : noms de champs cohérents à travers les tools
- **Obtenu** : `ack_delivery` prend `delivery_id` (pas `message_id`), `mark_read` prend `message_ids` (array, pas `message_id`), `batch_complete_tasks` prend `tasks` (avec objets `task_id`), `batch_dispatch_tasks` prend `tasks`, `claim_files` prend `file_paths` (JSON string), `deactivate_agent` prend `name`, `sleep_agent` prend `as` (implicite).
- **Commentaire** : multiplier les conventions fait perdre du temps (plusieurs essais requis pour chaque tool). Standardiser : tout ID explicite (`message_id`, `delivery_id`, `task_id`), arrays vraies arrays (pas JSON string), et `as` toujours implicite caller tandis que `target_name`/`name` = autre agent.

### MCP `schedule.name` required mais absent du message d'erreur initial
- **Voulu** : l'erreur liste les champs manquants (`name`, `cron_expr` et non "cron")
- **Obtenu** : première erreur disait juste `name is required`, même après avoir fourni `cron` (il voulait `cron_expr`)
- **Commentaire** : améliorer les messages d'erreur pour lister TOUS les champs manquants en une fois, avec les noms exacts.

### CLI `memories -s "term-with-hyphen"` — FTS5 parse error
- **Voulu** : rechercher une memory par mot-clé incluant un tiret
- **Obtenu** : `./agent-relay memories -s "state-machine" -p uat` → `error: no such column: machine`
- **Commentaire** : FTS5 interprète `-` comme opérateur d'exclusion de colonne. Fix : échapper le terme dans le builder de query, par ex. `MATCH 'NEAR("state" "machine")'` ou entourer de guillemets doubles dans la query FTS. Même bug probable sur MCP `search_memory`.

### CLI `send` accepte from vide et self-send
- **Voulu** : rejeter from="" et from==to
- **Obtenu** : `send -p uat "" bob "empty from"` → OK, message envoyé avec `from_agent=""` ; `send -p uat alice alice "self"` → OK
- **Commentaire** : at minimum valider from != "" et from != to. Actuellement on peut polluer la DB avec des messages sans expéditeur.

### MCP `spawn` n'injecte pas `vault_paths` du profile
- **Voulu** : quand un profile a `vault_paths:["test1.md","test2.md"]`, le prompt du spawn doit contenir le contenu de ces docs sous `## Knowledge` (comportement documenté dans boot.md du _relay vault)
- **Obtenu** : spawn d'un profile `inspector` avec vault_paths peuplé → le `prompt` dans `spawn_children` contient Identity + Role + Boot instructions **mais aucun doc vault**
- **Commentaire** : BUG — probablement dans le spawn context builder (lookup vault docs pour les paths du profile). Comparer avec le spawn `cto` qui avait eu droit à "## Knowledge ### Conventions" avec patterns.md, onboarding-prompt.md.

### `get_inbox(apply_budget=true)` + budget trop petit → messages surfacés mais invisibles
- **Voulu** : si budget insuffisant, soit retourner les messages les plus prioritaires qui rentrent, soit ne PAS marquer comme surfaced ceux qui n'ont pas passé le filtre
- **Obtenu** : avec `max_context_bytes:512` et 8 messages queued, `count:0` retourné — mais les 8 deliveries passent de `queued` → `surfaced` (visible au SQL). L'agent ne peut plus les re-récupérer avec `unread_only:true`.
- **Commentaire** : **BUG BLOQUANT pour la feature budget**. Le pruning doit ne surfacer QUE les messages qui passent le budget, ou marquer les autres comme `pending` (nouvelle state) pour retry. Sinon les messages rejetés par budget sont perdus pour le heartbeat suivant.

### Rollup des tasks ne propage pas à travers niveaux de goals
- **Voulu** : si un agent_goal a 3 tasks (1 done), son parent project_goal doit voir `total:3, done:1, progress:0.33` (ou au minimum une version agrégée)
- **Obtenu** : le project_goal a `total_tasks:0, done_tasks:0, progress:0` même avec un agent_goal enfant rempli
- **Commentaire** : design choice peut-être, mais dans la doc README (section "goal cascade") parle de rollup progress. Clarifier : chaque niveau compte SES tasks directes (actuel), OU agrège récursivement les tasks de ses enfants (attendu par la doc).

### Broadcast sans permission exécutive
- **Voulu** : `send_message(to:"*")` par un agent non-executive doit être refusé (doc `register_agent`: "admin team membership required")
- **Obtenu** : alice (non-executive, pas dans leadership) envoie `to:"*"` et reçoit 200 avec message créé
- **Commentaire** : soit la doc est obsolète, soit le contrôle est manquant dans `HandleSendMessage`. À trancher : si les broadcasts doivent rester libres, mettre à jour la doc ; sinon ajouter le check de team membership.

### Project `default` — jamais créé en tant que row projects
- **Voulu** : le project "default" devrait avoir une row `projects` auto-créée lors du premier usage
- **Obtenu** : 2 messages existent dans `project=default` mais `SELECT * FROM projects` n'a que `uat`. `/api/projects` ne liste donc pas `default`.
- **Commentaire** : les commandes CLI et MCP acceptent `default` implicitement mais ne l'enregistrent pas. Conséquence : le web UI ne voit pas le projet `default` alors que des messages/agents y vivent.

### CLI `stats` (sans `-p`) — ne reflète pas le total global
- **Voulu** : soit agréger tous les projets, soit documenter que le défaut est `default`
- **Obtenu** : sortie identique à `stats -p default` (1 msg) alors que la DB contient 2 messages au total (1 default + 1 testproj)
- **Commentaire** : silencieux et trompeur. Soit ajouter un flag `--all-projects`, soit afficher explicitement `project: default (use -p <name> or --all)`. Actuellement l'utilisateur pense voir le total global.

### Dégâts collatéraux
- Le binaire source (`/Users/loic/Projects/agent-relay/agent-relay`) est maintenant v0.5.0
- Le process serve tournant (ID b5wchpewh) est encore en v0.7 en mémoire — mais tout redémarrage repartira en v0.5
- Les binaires nommés `agent-relay-v050`, `agent-relay-v060`, `agent-relay-bin` sont intacts → restauration possible via `cp agent-relay-v060 agent-relay` ou rebuild (`go build`)
