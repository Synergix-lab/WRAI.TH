# UAT — PARTIAL

Tests qui fonctionnent partiellement, comportement ambigu, ou edge case.

Format : **Test** → **Voulu** → **Obtenu** → **Commentaire**

---

## CLI

### `./agent-relay send alice bob "hello world"` — auto-registration
- **Voulu** : `send` devrait idéalement soit refuser des agents inconnus, soit les auto-enregistrer
- **Obtenu** : message envoyé OK, mais `./agent-relay agents` continue d'afficher `no agents registered`
- **Commentaire** : comportement ambigu. Le message existe avec `from=alice to=bob` mais aucune trace dans la table agents. Soit documenter que la registration est explicite (via MCP `register_agent`), soit auto-register au premier send.

### `./agent-relay --version` après `make build`
- **Voulu** : afficher une version semver propre ex. `v0.7.0`
- **Obtenu** : `agent-relay v0.5.0-5-g7eba408-dirty` (via `git describe`)
- **Commentaire** : OK fonctionnellement (ldflag fonctionne) mais cosmétique : pas de tag v0.7 sur le repo donc `git describe` rapporte v0.5.0 + 5 commits. Ajouter `git tag v0.7.0` sur 7eba408.

### MCP `claim_files` — claims concurrents acceptés sans warning
- **Voulu** : quand bob claim `main.go` déjà claimé par alice, au minimum un warning `conflict:true` dans la réponse
- **Obtenu** : 2 locks créés sur le même fichier par 2 agents. list_locks retourne les 2 sans signal de conflit.
- **Commentaire** : la doc dit "advisory locks" — c'est cohérent avec un design par convention. Mais le retour ne donne aucune info sur les conflits existants. Améliorer : retourner `existing_claims:[{agent:"alice", file_paths:["main.go"]}]` dans la réponse pour que l'agent sache qu'il y a collision.

### MCP `query_context` — 0 résultats malgré memory correspondante
- **Voulu** : query "test memory findings" doit retourner la memory dont la key est "test-memory" et la valeur contient "UAT finding"
- **Obtenu** : `{count:0, results:[]}`
- **Commentaire** : search_memory trouve bien la memory avec query "event name", mais query_context (qui est censé fusionner memory + vault) retourne 0. À creuser : peut-être query_context filtre par scope ou confidence, ou nécessite `top_k` plus grand.

### MCP `schedule` — erreur "name is required" non documentée
- **Voulu** : créer un schedule cron avec les params évidents (agent, cycle, cron, prompt)
- **Obtenu** : `name is required` — champ absent de ma requête
- **Commentaire** : le tool description ne liste pas clairement `name` comme param requis (à vérifier dans tools.go). Ajouter `Required()` explicitement + exemple dans la description.

### README — compteur de MCP tools incorrect
- **Voulu** : README dit "67 MCP tools", le vrai compte doit matcher
- **Obtenu** : `tools/list` retourne 75 tools. Somme des sous-totaux par catégorie dans README = 62. Le "67" global et les compteurs par section sont incohérents entre eux et avec la réalité.
- **Commentaire** : doc drift après v0.7 (ajout de `spawn`, `kill_child`, `list_children`, `trigger_cycle`, `schedule`, `unschedule`, `add_notify_channel`, `get_team_inbox` probablement). Mettre à jour README avec la liste v0.7 complète.

### UI — tests visuels/interactifs non couverts (requiert navigateur humain)
- **Voulu** : validation visuelle des vues Galaxy/Colony/Kanban/Vault/Ops, drag&drop, animations message-orb, starfield procédural, xterm.js, EasyMDE éditeur, flow-editor visuel
- **Obtenu** : structure HTML + backing API vérifiés en static, mais aucun clic effectué
- **Commentaire** : **ACTION REQUISE USER** — ouvrir http://localhost:8090 dans Chrome, devtools console active, cliquer chaque tab et logger les erreurs console. Listé dans le plan UAT-REPORT section "Prochaines étapes manuelles".

### Trigger cooldown drops sans trace
- **Voulu** : fires droppés par cooldown devraient apparaître dans `trigger_history` avec `error:"cooldown"`
- **Obtenu** : 4 fires sur 5 disparaissent sans trace (history ne liste que le 1 passé)
- **Commentaire** : debugabilité faible. Ajouter une entrée `error:"cooldown (X seconds remaining)"` dans history pour chaque fire skipped.

### REST `PUT /api/profiles/:slug` — remplace au lieu de merger
- **Voulu** : PUT permet un update partiel (envoie que les champs à changer, garde le reste)
- **Obtenu** : PUT avec `{name, role}` seulement → `context_pack` mis à `""`, soul_keys/skills/vault_paths écrasés par défaut `"[]"`
- **Commentaire** : REST PUT sémantiquement remplace tout, mais pour une UX propre on veut soit un PATCH partiel, soit un PUT qui ne touche que les champs présents. Aligner avec `register_profile` qui est un upsert non destructif.

### REST `PUT /api/quotas/:agent` — accepte des noms non documentés, silencieux si 0
- **Voulu** : erreur si tous les champs sont 0 ou unknown (probable no-op)
- **Obtenu** : `{status:"updated"}` même si les `max_*_per_*` ne sont pas fournis → tous les maxes restent à 0 (= no limit)
- **Commentaire** : la sémantique "0 = pas de limite" est raisonnable mais non documentée. Ajouter au minimum dans la réponse la config écrite (echo back).

### REST `POST /api/workflows` — fields `trigger_type`/`definition` ignorés
- **Voulu** : POST accepte les champs attendus par le frontend (flow-editor.js)
- **Obtenu** : mes `trigger_type:"manual"` + `definition:"[]"` ont été ignorés silencieusement. Le handler attend `nodes`, `edges`. Response OK mais champs perdus.
- **Commentaire** : aligner le contrat d'API avec ce que le frontend utilise, ou ignorer + retourner warning.

### `/api/tasks/latest` retourne vide alors qu'il y a des tasks
- **Voulu** : derniers tasks du projet courant
- **Obtenu** : `[]` malgré 2 tasks existantes dans `uat` (1 pending, 1 done)
- **Commentaire** : `/tasks/all` retourne les 2, `/tasks/latest?project=uat` retourne 0. Probablement filtre sur `active only` ou buggy. À vérifier `apiGetTasksLatest`.

### `/api/activity?project=uat` — toujours vide
- **Voulu** : log d'activité (register, send, dispatch, complete, memory) visible dans l'UI
- **Obtenu** : `[]` malgré ~20 calls MCP/API
- **Commentaire** : activity est probablement populée via Claude Code hooks (UserPromptSubmit/SessionEnd etc.) et non via MCP calls directs. Pour UI utile hors Claude Code, instrumenter les MCP handlers pour écrire dans l'activity feed.

### `/api/orgs?project=uat` et `/api/teams?project=uat` — vides
- **Voulu** : possiblement avoir une org auto-créée au premier project/agent
- **Obtenu** : `[]` même avec 2 agents + 1 profile
- **Commentaire** : cohérent car je n'ai pas appelé create_team/create_org, mais il faut vérifier si l'onboarding UI guide l'utilisateur à le faire, sinon le tab "Org" du web UI sera vide par défaut.

### `./agent-relay thread 66d5bed4`
- **Voulu** : afficher le message une seule fois, formaté (header + body)
- **Obtenu** : `66d5bed4 alice → bob [notification] ... hello world: hello world`
- **Commentaire** : le `hello world: hello world` ressemble à `subject: body` mais ici les deux sont identiques car `send` n'a qu'un argument message. À vérifier dans `internal/cli` — soit le subject ne devrait pas être affiché quand == body, soit le CLI devrait séparer subject/body.
