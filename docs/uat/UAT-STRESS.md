# UAT Stress Test — Phase 6 du patch plan

**Build** : `fix/uat-p0` @ ecc0158
**Project isolé** : `stress`
**Durée totale** : ~3 minutes wall time

---

## Résultats

| Test | Paramètres | Résultat | Latence |
|------|-----------|----------|--------:|
| **1** Registration parallèle | 10 agents concurrents | 10/10 registered | 140 ms |
| **2** Sends parallèles | 200 messages (20 × 10 batches) | 200 msgs + 200 deliveries | 350 ms (~570 msg/s) |
| **3a** Memory insertion | 500 memories (batches de 50) | 500 rows | 570 ms (~880 ins/s) |
| **3b** FTS5 search latency | 10 queries sur 500 memories | ~237 ms constant par query | OK |
| **4a** Quota sans team | 50 sends fresh → agent3 | 0 OK / 50 REJ (team-auth rejected first) | 6 s |
| **4c** Quota avec team | fresh 15 → agent1 (team qteam, quota 10/h) | **10 OK / 5 REJ** correct | < 1 s |
| **5** Trigger cooldown burst | 10 webhook fires en 176 ms, cooldown=60s | 3 fires (race) | — |
| **6** Dispatch/complete race | 20 dispatches puis 20 completes concurrents | 20 tasks done, goal rollup 20/20, **pas de race** | 140 + 140 ms |
| **7** Memory concurrent same key | 10 agents écrivent `contested` | versioning a des **duplicates de version** | — |
| **8** Ring buffer events | /api/events/recent après storm | 10 events retournés | — |
| **9** Health post-stress | 26 agents, 282 msgs, 521 memories | status ok, uptime 3min | — |

---

## Bugs / limites trouvés sous charge

### BUG-S1 : Version race dans `set_memory`
- **Symptôme** : 10 writers concurrent sur la même key → versions `v1, v1, v2, v2, v2, v3, v4, v5, v6, v6` (duplicates)
- **Cause** : `SELECT max(version)` puis `INSERT version+1` — pas de lock
- **Impact** : faible (2+ agents n'écrivent que rarement en même temps sur la même key), mais la chaîne `supersedes` perd sa linéarité
- **Fix proposé** : transaction avec lock sur la row, ou séquence SQLite, ou contrainte UNIQUE(key, project, version) + retry

### BUG-S2 : Trigger cooldown race
- **Symptôme** : 10 webhooks en parallèle → 3 fires passent le cooldown au lieu de 1
- **Cause** : chaque goroutine lit `LastFiredAt` avant que le premier fire ne mette à jour la row
- **Impact** : moyen — sous rafale, le cooldown protège moins qu'attendu. Les 7 autres sont bien droppés.
- **Fix proposé** : update atomic `UPDATE triggers SET last_fired_at=? WHERE id=? AND (last_fired_at IS NULL OR last_fired_at < ?)` et check `rows_affected == 1`

### Observation non-bug
- `/api/events/recent` ring buffer a une capacité de 500 events ; la requête `limit=10` retourne les 10 plus récents (memory.set a dominé la fin) → comportement correct

---

## Pas de régression attendue

- ✓ Aucun deadlock SQLite WAL avec 200+ writes concurrents
- ✓ Pas de deliveries orphelines (1:1 avec messages)
- ✓ Goal rollup correct sous charge (20/20)
- ✓ Team-gated DM enforcement fonctionne sous concurrence
- ✓ Quota enforcement fonctionne (10 passent, 5 rejetés quand team-auth OK)
- ✓ FTS5 escape tient sous 500 inserts (hyphens, wildcards)
- ✓ Aucun process `claude` orphelin (0 stray)

---

## Verdict release v0.7

Les 2 bugs sous charge (version race + cooldown race) sont des **edge cases sous concurrence**. Ils ne bloquent pas v0.7 pour un usage single-writer ou low-concurrency. À ajouter au backlog **v0.7.2** ou **v0.8** quand la charge multi-agent réelle se manifeste.

Les features critiques (task state machine, goals cascade, team auth, quota) résistent au test. Release v0.7 peut partir.
