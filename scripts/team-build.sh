#!/usr/bin/env bash
# Team BUILD demo — autonomous team constructs a real Go URL-shortener app.
#
# Pipeline:
#   1. Project shortly-team created, engineer + tester profiles registered
#   2. Triggers wired: task.dispatched → engineer, task.completed → tester
#   3. CTO dispatches ONE task to engineer
#   4. Engineer writes main.go + go.mod in $WORKSPACE, completes
#   5. task.completed trigger fires → tester auto-spawns
#   6. Tester runs `go build`, starts the server, hits endpoints with curl,
#      completes with a test report
#
# Watch it live: open http://localhost:8090 → Galaxy → click shortly-team
# colony → see sprites of engineer/tester moving, kanban cards transitioning.
#
# Usage: ./scripts/team-build.sh           — full run
#        ./scripts/team-build.sh cleanup   — drop project + wipe workspace

set -euo pipefail

RELAY="${RELAY:-http://localhost:8090}"
PROJECT="${PROJECT:-shortly-team}"
DB="${DB:-$HOME/.agent-relay/relay.db}"
WORKSPACE="${WORKSPACE:-/tmp/shortly-build}"
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

if [ "$MODE" = "cleanup" ]; then
  section "Cleanup"
  sqlite3 "$DB" "SELECT id FROM spawn_children WHERE status='running' AND project='$PROJECT';" | while read -r id; do
    [ -n "$id" ] && curl -sS -X POST "$RELAY/api/spawn/children/$id/kill" >/dev/null 2>&1 || true
  done
  # Kill any still-running shortly server from a previous run
  pkill -f "$WORKSPACE/shortly" 2>/dev/null || true
  for t in triggers trigger_history messages deliveries agents profiles tasks goals boards spawn_children memories; do
    sqlite3 "$DB" "DELETE FROM $t WHERE project='$PROJECT';" 2>/dev/null || true
  done
  sqlite3 "$DB" "DELETE FROM projects WHERE name='$PROJECT';"
  rm -rf "$WORKSPACE"
  echo "  done"
  exit 0
fi

# --- setup ------------------------------------------------------------------

section "1. Workspace + project"
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE"
echo "  workspace: $WORKSPACE"

mcp '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_project","arguments":{"name":"'"$PROJECT"'","description":"autonomous team building a mini Go URL shortener"}}}' >/dev/null
echo "  project: $PROJECT"

# CTO (executive, for dispatch privileges)
mcp '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"register_agent","arguments":{"name":"cto","project":"'"$PROJECT"'","is_executive":true}}}' >/dev/null
echo "  agent: cto"

section "2. Register profiles"

# --- engineer profile ---
ENGINEER_CTX=$(cat <<EOF
You are the ENGINEER of the shortly-team. You write production-quality Go code.

For each task dispatched to you:
1. claim_task then start_task
2. Read the task description — it tells you the workspace path and the app spec
3. Use the Write tool to create go.mod and main.go with a working HTTP server:
   - POST /shorten: accepts JSON {"url":"..."}, returns {"code":"<6 chars>","short_url":"..."}
   - GET /:code: 302 redirect to the stored URL, 404 if unknown
   - In-memory sync.Map for storage, random 6-char alphanumeric codes
   - Listen on :8787
4. Keep the code SMALL: one main.go (~80 lines max), no extra files, stdlib only
5. complete_task with result="wrote main.go + go.mod at \$WORKSPACE"
6. Exit immediately after complete_task

Do not run tests yourself — the tester will do that. Just write the code.
EOF
)
ENGINEER_ESC=$(python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$ENGINEER_CTX")

mcp '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"register_profile","arguments":{"project":"'"$PROJECT"'","slug":"engineer","name":"Engineer","role":"Go engineer","context_pack":'"$ENGINEER_ESC"',"allowed_tools":"[\"Write\",\"Read\",\"Edit\",\"mcp__agent-relay__*\"]"}}}' >/dev/null
echo "  profile: engineer (Write/Read/Edit + relay MCP)"

# --- tester profile ---
TESTER_CTX=$(cat <<EOF
You are the TESTER of the shortly-team. You verify the engineer's work.

For each task dispatched to you:
1. claim_task then start_task
2. The task description gives you a workspace path with main.go + go.mod
3. Run these commands via Bash (each as a single Bash call):
   a. cd <workspace> && go build -o shortly .
   b. cd <workspace> && ./shortly &  (then sleep 1)
   c. curl -sS -X POST http://localhost:8787/shorten -d '{"url":"https://example.com"}'
      Capture the returned code. If the response doesn't contain "code", the build is broken.
   d. curl -sSI http://localhost:8787/<code>   (check for HTTP 302 + Location header)
   e. pkill -f "<workspace>/shortly"
4. Write a short markdown test report to <workspace>/TEST_REPORT.md with PASS/FAIL
   for each step + the commands you ran
5. complete_task with result="PASS" or "FAIL: <reason>"
6. Exit immediately

Be thorough but fast. If build fails, stop and complete_task with FAIL + the build error.
EOF
)
TESTER_ESC=$(python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$TESTER_CTX")

mcp '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"register_profile","arguments":{"project":"'"$PROJECT"'","slug":"tester","name":"Tester","role":"QA","context_pack":'"$TESTER_ESC"',"allowed_tools":"[\"Bash\",\"Read\",\"Write\",\"mcp__agent-relay__*\"]"}}}' >/dev/null
echo "  profile: tester (Bash + Write/Read + relay MCP)"

# --- triggers ---
section "3. Triggers (pipeline: dispatch → engineer, complete → tester)"

TR_E=$(rest_post /api/triggers '{
  "project":"'"$PROJECT"'",
  "event":"task.dispatched",
  "match_rules":"{\"profile\":\"engineer\"}",
  "profile_slug":"engineer",
  "cycle":"respond",
  "cooldown_seconds":0,
  "max_duration":"4m"
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  task.dispatched (profile=engineer) → spawn engineer   ${TR_E:0:8}"

TR_T=$(rest_post /api/triggers '{
  "project":"'"$PROJECT"'",
  "event":"task.completed",
  "match_rules":"{\"profile\":\"engineer\"}",
  "profile_slug":"tester",
  "cycle":"respond",
  "cooldown_seconds":0,
  "max_duration":"4m"
}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  task.completed (profile=engineer) → spawn tester   ${TR_T:0:8}"

# --- UI hint ----------------------------------------------------------------

section "4. ▶▶▶  OPEN http://localhost:8090  IN YOUR BROWSER"
echo
echo "  You'll see Galaxy → click the '$PROJECT' planet → Colony view"
echo "  Watch the sprites (cto, engineer-child, tester-child), kanban cards,"
echo "  and the message orbs fly between agents."
echo
echo "  Starting dispatch in 10s (Ctrl+C to abort)..."
for i in 10 9 8 7 6 5 4 3 2 1; do
  printf "\r  T-minus %2ds " "$i"
  sleep 1
done
echo

# --- dispatch engineer ------------------------------------------------------

section "5. CTO dispatches the build task"

ENG_PROMPT="Build a Go URL shortener at $WORKSPACE. Requirements: POST /shorten {url} → {code, short_url}, GET /:code → 302 redirect, listen on :8787, in-memory sync.Map, random 6-char codes, one main.go + go.mod, stdlib only. After writing both files, complete_task with result='wrote main.go + go.mod'."

ENG_PROMPT_ESC=$(python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$ENG_PROMPT")

ENG_TASK_ID=$(mcp '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"dispatch_task","arguments":{"project":"'"$PROJECT"'","as":"cto","profile":"engineer","title":"build-shortly","description":'"$ENG_PROMPT_ESC"',"priority":"P1"}}}' | python3 -c "import sys,json; t=json.load(sys.stdin)['result']['content'][0]['text']; print(json.loads(t)['task']['id'])")
echo "  engineer task: ${ENG_TASK_ID:0:8}"

# --- watch pipeline ---------------------------------------------------------

section "6. Watching the pipeline"

sleep 2
DEADLINE=$(($(date +%s) + 420))   # up to 7 min
LAST=0
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  NOW=$(date +%s)
  ENG_STATUS=$(sqlite3 "$DB" "SELECT status FROM tasks WHERE id='$ENG_TASK_ID';")
  TEST_ROW=$(sqlite3 "$DB" "SELECT id, status, COALESCE(substr(result,1,40),'') FROM tasks WHERE project='$PROJECT' AND assigned_to LIKE 'tester%' OR (dispatched_by LIKE '%tester%') ORDER BY dispatched_at DESC LIMIT 1;" || echo "")
  RUNNING=$(sqlite3 "$DB" "SELECT count(*) FROM spawn_children WHERE project='$PROJECT' AND status='running';")
  TOTAL=$(sqlite3 "$DB" "SELECT count(*) FROM spawn_children WHERE project='$PROJECT';")

  if [ "$((NOW - LAST))" -ge 6 ]; then
    FILES=$(ls "$WORKSPACE" 2>/dev/null | tr '\n' ' ')
    echo "  t=$((NOW - (DEADLINE - 420)))s   engineer_task=$ENG_STATUS   children_running=$RUNNING/$TOTAL   files={$FILES}"
    LAST=$NOW
  fi

  # Done condition: tester task done (or no more running, timeout)
  TESTER_DONE=$(sqlite3 "$DB" "SELECT count(*) FROM tasks WHERE project='$PROJECT' AND title LIKE '%tester%' OR (dispatched_at > (SELECT dispatched_at FROM tasks WHERE id='$ENG_TASK_ID')) AND status='done';")
  if [ "$TESTER_DONE" -gt 0 ] && [ "$RUNNING" = "0" ]; then break; fi
  sleep 3
done

# --- result -----------------------------------------------------------------

section "7. Workspace contents"
ls -la "$WORKSPACE" | tail -n +2

if [ -f "$WORKSPACE/main.go" ]; then
  echo
  echo "───── main.go (first 40 lines) ─────"
  head -40 "$WORKSPACE/main.go"
  echo "..."
fi

if [ -f "$WORKSPACE/TEST_REPORT.md" ]; then
  echo
  echo "───── TEST_REPORT.md ─────"
  cat "$WORKSPACE/TEST_REPORT.md"
fi

section "8. Telemetry"
echo
echo "  tasks timeline:"
sqlite3 "$DB" "SELECT title, status, assigned_to, dispatched_at, completed_at, substr(COALESCE(result,''),1,60) FROM tasks WHERE project='$PROJECT' ORDER BY dispatched_at;" | awk -F'|' '{printf "    %-20s status=%-10s by=%-30s start=%s done=%s\n      result=%s\n", $1, $2, $3, substr($4,12,8), substr($5,12,8), $6}'

echo
echo "  children:"
sqlite3 "$DB" "SELECT substr(id,1,8), profile, status, exit_code FROM spawn_children WHERE project='$PROJECT' ORDER BY started_at;" | awk -F'|' '{print "    "$1"   "$2"   "$3"   exit="$4}'

echo
echo "  cycle tokens:"
curl -sS "$RELAY/api/cycle-history?project=$PROJECT" | python3 -c "
import sys, json
for e in json.load(sys.stdin):
  if 'spawn' in e.get('cycle_name',''):
    print(f'    {e[\"cycle_name\"]}   {e[\"duration_ms\"]}ms   out_tokens={e[\"output_tokens\"]}   cache_read={e[\"cache_read_tokens\"]}')
"

echo
echo "  messages exchanged:"
sqlite3 "$DB" "SELECT from_agent, to_agent, subject FROM messages WHERE project='$PROJECT' ORDER BY created_at;" | awk -F'|' '{print "    "$1" → "$2"   "$3}'

# ensure no stray server
pkill -f "$WORKSPACE/shortly" 2>/dev/null || true

section "9. Try it yourself"
echo "  cd $WORKSPACE && go run . &"
echo "  curl -sS -X POST http://localhost:8787/shorten -d '{\"url\":\"https://ycombinator.com\"}'"
echo "  curl -sSI http://localhost:8787/<code>"
echo
echo "  cleanup: ./scripts/team-build.sh cleanup"
