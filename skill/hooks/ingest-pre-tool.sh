#!/bin/bash
EVENTS_DIR="$HOME/.pixel-office/events"
mkdir -p "$EVENTS_DIR"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

FILENAME="$EVENTS_DIR/tool-start-$$-$(date +%s).json"
TMP="$FILENAME.tmp"
printf '{"type":"tool_start","session_id":"%s","tool":"%s","file":"%s","ts":"%s"}' \
  "$SESSION_ID" "$TOOL_NAME" "$FILE_PATH" "$TS" > "$TMP"
mv "$TMP" "$FILENAME"
exit 0
