#!/bin/bash
EVENTS_DIR="$HOME/.pixel-office/events"
mkdir -p "$EVENTS_DIR"

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

FILENAME="$EVENTS_DIR/stop-$$-$(date +%s).json"
TMP="$FILENAME.tmp"
printf '{"type":"stop","session_id":"%s","tool":"","file":"","ts":"%s"}' \
  "$SESSION_ID" "$TS" > "$TMP"
mv "$TMP" "$FILENAME"
exit 0
