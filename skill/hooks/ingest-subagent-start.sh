#!/bin/bash
EVENTS_DIR="$HOME/.pixel-office/events"
mkdir -p "$EVENTS_DIR"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

FILENAME="$EVENTS_DIR/agent-spawn-$$-$(date +%s).json"
TMP="$FILENAME.tmp"
printf '{"type":"agent_spawn","session_id":"%s","ts":"%s"}' \
  "$SESSION_ID" "$TS" > "$TMP"
mv "$TMP" "$FILENAME"
exit 0
