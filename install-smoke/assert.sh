#!/bin/sh
# Shared install-smoke assertion — the SAME contract every suite tool's clean room runs
# (trovex / yoru / dokan / wraith). A per-tool Dockerfile installs the tool from its one
# documented command, then COPYs + runs this with the tool's parameters. Identical asserts
# across all four keep the gate honest. See CONTRACT.md.
#
# Parameters (env):
#   TOOL          tool name, for messages (required)
#   TOOL_BIN      CLI command that must be on PATH (required)
#   VERSION_FLAG  flag that prints version/help and exits 0 (default: --version)
#   SKILL_FILE    a file that MUST exist after install — the Claude Code skill landing proof
#                 (e.g. $HOME/.claude/skills/<tool>/SKILL.md). Required.
#   HOOKS_FILE    optional: a settings.json that must exist (tool ships hooks)
#   HOOKS_GREP    optional: a string that must appear in HOOKS_FILE (the hook registration)
#
# Exit 0 = all asserts pass. Any failure = non-zero + a one-line reason. No tool-specific logic.
set -eu
fail() { echo "ASSERT FAIL [$TOOL]: $1" >&2; exit 1; }
: "${TOOL:?TOOL required}"; : "${TOOL_BIN:?TOOL_BIN required}"; : "${SKILL_FILE:?SKILL_FILE required}"
VERSION_FLAG="${VERSION_FLAG:---version}"

echo "[$TOOL] 1/4 CLI on PATH"
command -v "$TOOL_BIN" >/dev/null 2>&1 || fail "$TOOL_BIN not on PATH after install"

echo "[$TOOL] 2/4 $TOOL_BIN $VERSION_FLAG exits 0"
"$TOOL_BIN" $VERSION_FLAG >/dev/null 2>&1 || fail "$TOOL_BIN $VERSION_FLAG did not exit 0"

echo "[$TOOL] 3/4 Claude Code skill landed ($SKILL_FILE)"
[ -f "$SKILL_FILE" ] || fail "skill file missing: $SKILL_FILE (Claude Code would not load the operator skill)"

if [ -n "${HOOKS_FILE:-}" ]; then
  echo "[$TOOL] 4/4 hooks registered ($HOOKS_FILE)"
  [ -f "$HOOKS_FILE" ] || fail "hooks settings file missing: $HOOKS_FILE"
  if [ -n "${HOOKS_GREP:-}" ]; then
    grep -q "$HOOKS_GREP" "$HOOKS_FILE" || fail "hook not registered in $HOOKS_FILE (no match for: $HOOKS_GREP)"
  fi
else
  echo "[$TOOL] 4/4 hooks — n/a (tool ships no hooks)"
fi

echo "ASSERT OK [$TOOL]"
