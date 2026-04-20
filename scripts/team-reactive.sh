#!/usr/bin/env bash
# Reactive team demo — agents launch from INCOMING MESSAGES (not dispatched tasks).
#
# Builds on the taskboard from team-fullstack.sh. CTO sends a P1 message to
# backend-dev with a feature request — backend-dev auto-spawns (message.received
# trigger), implements, then messages reviewer — reviewer auto-spawns, runs
# tests, messages CTO with the verdict.
#
# Pattern: message-driven reactive coordination. No tasks, no manual dispatch
# after the initial seed — all cascading via P0/P1 messages.
#
# Prereqs: team-fullstack.sh has been run and /tmp/taskboard/backend/main.go exists.
#
# Usage: ./scripts/team-reactive.sh           — full run
#        ./scripts/team-reactive.sh cleanup   — drop reactive triggers + reviewer profile

set -euo pipefail

RELAY="${RELAY:-http://localhost:8090}"
PROJECT="${PROJECT:-fullstack-team}"
DB="${DB:-$HOME/.agent-relay/relay.db}"
WORKSPACE="${WORKSPACE:-/tmp/taskboard}"
MODE="${1:-full}"

mcp() {
  curl -sS -X POST "$RELAY/mcp?project=$PROJECT" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "$1"
}

rest_post() {
  curl -sS -X POST "$RELAY$1" -H "Content-Type: application/json" -d "$2"
}

section() {
  echo
  echo "━━━ $1 ━━━"
}

# --- cleanup ----------------------------------------------------------------
if [ "$MODE" = "cleanup" ]; then
  section "Cleanup reactive bits"
  sqlite3 "$DB" "SELECT id FROM spawn_children WHERE status='running' AND project='$PROJECT';" | while read -r id; do
    [ -n "$id" ] && curl -sS -X POST "$RELAY/api/spawn/children/$id/kill" >/dev/null 2>&1 || true
  done
  pkill -f "$WORKSPACE/backend/taskboard" 2>/dev/null || true
  # Only drop reactive-specific rows, keep the taskboard build intact
  sqlite3 "$DB" "DELETE FROM triggers WHERE project='$PROJECT' AND event='message.received';"
  sqlite3 "$DB" "DELETE FROM trigger_history WHERE project='$PROJECT' AND event='message.received';"
  echo "  done (reactive triggers removed; taskboard workspace kept)"
  exit 0
fi

# --- check prereqs ----------------------------------------------------------
if [ ! -f "$WORKSPACE/backend/main.go" ]; then
  echo "ERROR: $WORKSPACE/backend/main.go not found."
  echo "Run ./scripts/team-fullstack.sh first to build the initial taskboard."
  exit 1
fi

# --- setup reviewer profile + hierarchy -------------------------------------

section "1. Add reviewer profile (reports to cto)"

REVIEWER_CTX=$(cat <<EOF
You are the REVIEWER of the fullstack team. Reports to CTO.

For each P1 message you receive:
1. get_inbox to read the incoming request
2. Read the file(s) mentioned in the message ($WORKSPACE/backend/main.go especially)
3. Verify: is the requested change actually in the code?
4. Run a quick test: Bash("cd $WORKSPACE && make build 2>&1 | head -10") — did it compile?
5. Send a P1 message back to cto with result:
   - subject="review: PASS" or "review: FAIL"
   - content="<1-2 sentences with specifics>"
6. set_memory scope=project key="review-<short_reason>" value="<what you checked>"
7. Exit immediately

You only spawn from P1 messages to you. Be concise and fast.
EOF
)
REVIEWER_ESC=$(python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$REVIEWER_CTX")

mcp '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"register_profile","arguments":{"project":"'"$PROJECT"'","slug":"reviewer","name":"Reviewer","context_pack":'"$REVIEWER_ESC"',"allowed_tools":"[\"Read\",\"Bash\",\"mcp__agent-relay__*\"]"}}}' >/dev/null
echo "  profile: reviewer (Read, Bash, relay MCP)"

mcp '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"register_agent","arguments":{"name":"reviewer","project":"'"$PROJECT"'","profile_slug":"reviewer","reports_to":"cto","role":"code reviewer"}}}' >/dev/null
echo "  agent: reviewer reports_to cto"

# --- extended backend-dev profile (reactive version) ------------------------

section "2. Update backend-dev profile for reactive mode"

BACKEND_RX_CTX=$(cat <<EOF
You are the BACKEND-DEV of the fullstack team. Reactive mode — you spawn from P1 messages.

For each P1 message you receive:
1. get_inbox to read the feature request
2. Read $WORKSPACE/backend/main.go
3. Use the Edit tool to add the requested feature (one focused change, keep it small)
4. Write-back: the file stays at $WORKSPACE/backend/main.go
5. Send a P1 message to reviewer with:
   - subject="impl: <short description>"
   - content="changed: <what you modified>. File: $WORKSPACE/backend/main.go. Please verify."
6. set_memory scope=project key="impl-<short_reason>" value="<what changed>"
7. Exit

Do NOT run go build — the reviewer will. Just make the code change.
EOF
)
BACKEND_RX_ESC=$(python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$BACKEND_RX_CTX")

# register_profile is upsert — replaces the prior definition
mcp '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"register_profile","arguments":{"project":"'"$PROJECT"'","slug":"backend-dev","name":"Backend Dev","context_pack":'"$BACKEND_RX_ESC"',"allowed_tools":"[\"Read\",\"Edit\",\"Write\",\"mcp__agent-relay__*\"]"}}}' >/dev/null
echo "  profile: backend-dev (Edit + Read + relay MCP, reactive to P1 messages)"

# --- message-driven triggers ------------------------------------------------

section "3. Register message-driven triggers"

# drop any previous reactive triggers to avoid double spawns
sqlite3 "$DB" "DELETE FROM triggers WHERE project='$PROJECT' AND event='message.received';" 2>/dev/null || true

TR1=$(rest_post /api/triggers '{
  "project":"'"$PROJECT"'",
  "event":"message.received",
  "match_rules":"{\"to\":\"backend-dev\"}",
  "profile_slug":"backend-dev",
  "cycle":"respond",
  "cooldown_seconds":0,
  "max_duration":"3m"
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  message.received → backend-dev (match to=backend-dev)   ${TR1:0:8}"

TR2=$(rest_post /api/triggers '{
  "project":"'"$PROJECT"'",
  "event":"message.received",
  "match_rules":"{\"to\":\"reviewer\"}",
  "profile_slug":"reviewer",
  "cycle":"respond",
  "cooldown_seconds":0,
  "max_duration":"3m"
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  message.received → reviewer    (match to=reviewer)   ${TR2:0:8}"

# --- browser hint -----------------------------------------------------------
section "4. ▶▶▶  OPEN http://localhost:8090 → 'fullstack-team' colony"
echo
echo "  This time there are NO tasks. Watch the MESSAGE ORBS flow:"
echo "  cto → backend-dev → reviewer → cto"
echo "  Each arrival triggers a spawn (visible sprite pop-in + kanban activity)."
echo
echo "  Starting in 8s..."
for i in 8 7 6 5 4 3 2 1; do
  printf "\r  T-minus %ds " "$i"
  sleep 1
done
echo

# --- seed: CTO sends the feature request ------------------------------------

section "5. CTO sends P1 message to backend-dev (the seed)"

REQ_CONTENT="Add a 'priority' field to the Task struct (string, values: low/medium/high, default medium). Accept it in POST /tasks JSON body. Include it in all JSON responses. The file is at $WORKSPACE/backend/main.go. Keep the change minimal — one struct field + one handler read. When done, send me back a P1 via reviewer so I have a PASS/FAIL."

REQ_ESC=$(python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$REQ_CONTENT")

mcp '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"send_message","arguments":{"project":"'"$PROJECT"'","as":"cto","to":"backend-dev","subject":"add priority field","content":'"$REQ_ESC"',"priority":"P1"}}}' | python3 -c "
import sys, json
raw = sys.stdin.read(); s = raw.find('{')
d = json.loads(raw[s:])
t = json.loads(d['result']['content'][0]['text'])
print(f'  message sent to backend-dev   id={t[\"id\"][:8]}   priority={t[\"priority\"]}')"

# --- watch the cascade ------------------------------------------------------

section "6. Watch the cascade (up to 6 min)"

sleep 2
DEADLINE=$(($(date +%s) + 360))
LAST=0
SEEN_BACKEND=0; SEEN_REVIEWER=0
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  NOW=$(date +%s)
  RUNNING=$(sqlite3 "$DB" "SELECT count(*) FROM spawn_children WHERE project='$PROJECT' AND status='running';")
  BACKEND_CHILDREN=$(sqlite3 "$DB" "SELECT count(*) FROM spawn_children WHERE project='$PROJECT' AND profile='backend-dev' AND started_at > datetime('now','-10 minutes');")
  REVIEWER_CHILDREN=$(sqlite3 "$DB" "SELECT count(*) FROM spawn_children WHERE project='$PROJECT' AND profile='reviewer' AND started_at > datetime('now','-10 minutes');")
  RECENT_MSGS=$(sqlite3 "$DB" "SELECT count(*) FROM messages WHERE project='$PROJECT' AND created_at > datetime('now','-10 minutes');")

  if [ "$((NOW - LAST))" -ge 6 ]; then
    echo "  t=$((NOW - (DEADLINE - 360)))s   backend_spawns=$BACKEND_CHILDREN   reviewer_spawns=$REVIEWER_CHILDREN   running=$RUNNING   msgs=$RECENT_MSGS"
    LAST=$NOW
  fi

  # Done: both have spawned, both finished, cto has received the final verdict
  CTO_VERDICT=$(sqlite3 "$DB" "SELECT count(*) FROM messages WHERE project='$PROJECT' AND to_agent='cto' AND subject LIKE 'review:%' AND created_at > datetime('now','-10 minutes');")
  if [ "$CTO_VERDICT" -ge "1" ] && [ "$RUNNING" = "0" ]; then
    echo "  ✓ cto received review verdict — pipeline done"
    break
  fi
  sleep 4
done

# --- show the chain ---------------------------------------------------------

section "7. Message cascade (chronological)"

sqlite3 "$DB" "SELECT datetime(created_at), from_agent, to_agent, priority, substr(subject,1,40), substr(content,1,60) FROM messages WHERE project='$PROJECT' AND created_at > datetime('now','-10 minutes') ORDER BY created_at;" | awk -F'|' '{printf "  %s  %-30s → %-30s  [%s] %s\n           %s\n\n", $1, $2, $3, $4, $5, $6}'

section "8. Spawned children (reactive)"

sqlite3 "$DB" "SELECT substr(id,1,8), profile, status, exit_code, started_at, finished_at FROM spawn_children WHERE project='$PROJECT' AND started_at > datetime('now','-10 minutes') ORDER BY started_at;" | awk -F'|' '{printf "  %s  %-14s  %-10s exit=%s  start=%s  end=%s\n", $1, $2, $3, $4, $5, $6}'

section "9. File diff — did backend-dev actually change main.go?"

if grep -q '"priority"' "$WORKSPACE/backend/main.go" 2>/dev/null; then
  echo "  ✓ priority field found in main.go"
  grep -n "priority" "$WORKSPACE/backend/main.go" | head -5 | awk '{print "    " $0}'
else
  echo "  ✗ priority field NOT found — backend-dev did not apply the change"
fi

echo
echo "  main.go stats:"
wc -l "$WORKSPACE/backend/main.go" | awk '{print "    lines: " $1}'

section "10. Final compile + smoke test"

export PATH="/opt/homebrew/bin:$PATH"
(cd "$WORKSPACE/backend" && go build -o taskboard . 2>&1 | head -5)
if [ -f "$WORKSPACE/backend/taskboard" ]; then
  echo "  ✓ compiled"
  (cd "$WORKSPACE/backend" && ./taskboard &) 2>/dev/null
  until curl -sS http://localhost:8788/tasks >/dev/null 2>&1; do sleep 0.3; done
  echo "  POST /tasks with priority=high:"
  curl -sS -X POST http://localhost:8788/tasks -H "Content-Type: application/json" -d '{"title":"reactive-test","status":"todo","priority":"high"}'
  echo
  echo "  GET /tasks:"
  curl -sS http://localhost:8788/tasks | python3 -m json.tool 2>/dev/null | head -10
  pkill -f "$WORKSPACE/backend/taskboard" 2>/dev/null || true
else
  echo "  ✗ compile FAILED"
fi

section "11. Events feed (last 10)"
curl -sS "$RELAY/api/events/recent?project=$PROJECT&limit=15" | python3 -c "
import sys, json
for e in json.load(sys.stdin)[:15]:
  print(f\"  {e['type']:<10}.{e['action']:<15} by={e['agent'][:30]:<30} target={e.get('target','')[:25]:<25} label={e.get('label','')[:30]}\")"

echo
echo "━━━ done ━━━"
echo "Cleanup reactive bits: ./scripts/team-reactive.sh cleanup"
echo "Full cleanup: ./scripts/team-fullstack.sh cleanup"
