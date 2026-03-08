#!/bin/bash
EVENTS_DIR="$HOME/.pixel-office/events"
mkdir -p "$EVENTS_DIR"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

FILENAME="$EVENTS_DIR/tool-end-$$-$(date +%s).json"
TMP="$FILENAME.tmp"
printf '{"type":"tool_end","session_id":"%s","tool":"%s","ts":"%s"}' \
  "$SESSION_ID" "$TOOL_NAME" "$TS" > "$TMP"
mv "$TMP" "$FILENAME"
exit 0
