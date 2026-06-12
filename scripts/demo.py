#!/usr/bin/env python3
"""
Demo script for wrai.th screen recording.
Usage: python3 scripts/demo.py
Keeps CTO, cleans the rest, rebuilds the full team + activity.
"""

import json
import os
import random
import sqlite3
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from uuid import uuid4

BASE = "http://localhost:8090"
PROJECT = "wraith"
EVENTS_DIR = os.path.expanduser("~/.pixel-office/events")
DB_PATH = os.path.expanduser("~/.agent-relay/relay.db")

# CTO stays, these get spawned fresh
NEW_AGENTS = [
    {"name": "backend-lead", "role": "Backend Lead", "description": "Go services, API design, database optimization", "reports_to": "cto", "profile": "backend"},
    {"name": "frontend-dev", "role": "Frontend Developer", "description": "Canvas rendering, UI components, pixel art integration", "reports_to": "backend-lead", "profile": "frontend"},
    {"name": "devops", "role": "DevOps Engineer", "description": "CI/CD, deployment, monitoring, infrastructure", "reports_to": "cto", "profile": "devops"},
    {"name": "qa-tester", "role": "QA Tester", "description": "E2E tests, regression testing, bug reports", "reports_to": "backend-lead", "profile": "qa"},
]

ALL_AGENTS = [{"name": "cto", "profile": "cto"}] + NEW_AGENTS

SALT = "demo alpha bravo charlie"
sessions = {}


def mcp(tool, args):
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": random.randint(1, 999999),
        "method": "tools/call",
        "params": {"name": tool, "arguments": args}
    }).encode()
    req = urllib.request.Request(BASE + "/mcp", data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    result = data.get("result", {})
    content = result.get("content", [{}])
    text = content[0].get("text", "") if content else ""
    if result.get("isError"):
        print(f"  ERROR [{tool}]: {text}")
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def activity(agent_name, event_type, tool="", file=""):
    sid = sessions.get(agent_name, "")
    if not sid:
        return
    evt = {
        "type": event_type,
        "session_id": sid,
        "tool": tool,
        "file": file,
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    }
    path = os.path.join(EVENTS_DIR, f"{uuid4()}.json")
    with open(path, "w") as f:
        json.dump(evt, f)


def step(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def main():
    os.makedirs(EVENTS_DIR, exist_ok=True)

    # ── 0. Cleanup: delete all agents except CTO, clear old data ──
    step("0. Cleanup")
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM agents WHERE project = ? AND name != 'cto'", (PROJECT,))
    conn.execute("DELETE FROM agents WHERE project = ? AND name = '_init'", (PROJECT,))
    conn.execute("DELETE FROM messages WHERE project = ?", (PROJECT,))
    conn.execute("DELETE FROM deliveries WHERE project = ?", (PROJECT,))
    conn.execute("DELETE FROM memories WHERE project = ?", (PROJECT,))
    conn.execute("DELETE FROM tasks WHERE project = ?", (PROJECT,))
    conn.execute("DELETE FROM goals WHERE project = ?", (PROJECT,))
    conn.execute("DELETE FROM boards WHERE project = ?", (PROJECT,))
    conn.execute("DELETE FROM teams WHERE project = ?", (PROJECT,))
    conn.execute("DELETE FROM team_members WHERE team_id NOT IN (SELECT id FROM teams)", )
    conn.execute("DELETE FROM conversations WHERE project = ?", (PROJECT,))
    conn.execute("DELETE FROM conversation_members WHERE conversation_id NOT IN (SELECT id FROM conversations)",)
    conn.execute("DELETE FROM token_usage WHERE project = ?", (PROJECT,))
    conn.execute("DELETE FROM vault_docs WHERE project = ?", (PROJECT,))
    conn.commit()
    conn.close()
    print("  Cleaned agents (kept cto), messages, tasks, goals, memories, tokens")

    # Re-register CTO to get session_id
    result = mcp("register_agent", {
        "name": "cto", "role": "Chief Technology Officer",
        "description": "Architecture decisions, code review, team coordination",
        "salt": SALT, "project": PROJECT, "is_executive": True,
    })
    if result and isinstance(result, dict):
        sessions["cto"] = result.get("agent", {}).get("session_id", "")
        print(f"  CTO re-registered (session: {sessions['cto'][:12]}...)")
    activity("cto", "tool_start", tool="Read", file="boot.md")
    time.sleep(0.5)

    # ── 1. Profiles ──
    step("1. Creating profiles")
    profiles = [
        ("cto", "Chief Technology Officer", "Architecture, code review, team coordination, sprint planning"),
        ("backend", "Backend Developer", "Go services, REST API, SQLite schema, MCP handlers, performance"),
        ("frontend", "Frontend Developer", "Canvas 2D, UI components, pixel art, vanilla JS modules"),
        ("devops", "DevOps Engineer", "CI/CD, GitHub Actions, deployment, monitoring, infrastructure"),
        ("qa", "QA Tester", "E2E testing, regression, coverage reports, Playwright, bug triage"),
    ]
    for slug, name, desc in profiles:
        mcp("create_profile", {"slug": slug, "name": name, "description": desc, "project": PROJECT, "as": "cto"})
        print(f"  Profile: {slug}")
    time.sleep(0.3)

    # ── 2. Spawn agents one by one ──
    step("2. Spawning agents (1s delay each)")
    for agent in NEW_AGENTS:
        args = {
            "name": agent["name"],
            "role": agent["role"],
            "description": agent["description"],
            "salt": SALT,
            "project": PROJECT,
            "profile_slug": agent["profile"],
            "reports_to": agent["reports_to"],
        }
        result = mcp("register_agent", args)
        if result and isinstance(result, dict):
            sid = result.get("agent", {}).get("session_id", "")
            sessions[agent["name"]] = sid
            print(f"  + {agent['name']} ({agent['role']})")
            activity(agent["name"], "tool_start", tool="Read", file="boot.md")
        time.sleep(1)

    # ── 3. Create team ──
    step("3. Forming team")
    mcp("create_team", {"name": "Core", "slug": "core", "project": PROJECT, "as": "cto"})
    print("  Team 'Core' created")
    for agent in ALL_AGENTS:
        role = "lead" if agent["name"] == "cto" else "member"
        mcp("add_team_member", {"team": "core", "agent_name": agent["name"], "project": PROJECT, "role": role})
        print(f"  + {agent['name']} ({role})")
    time.sleep(0.5)

    # ── 4. Mission + Goals ──
    step("4. Mission & Goals")
    mcp("set_mission", {
        "mission": "Build the most reliable multi-agent orchestration layer for AI development teams",
        "project": PROJECT, "as": "cto"
    })
    print("  Mission set")

    goals_data = [
        ("v0.6 Release", "Ship v0.6 with token tracking, improved UI, and performance optimizations", "cto"),
        ("Test Coverage 80%", "Reach 80% test coverage on MCP handlers and REST API", "qa-tester"),
        ("P99 < 50ms", "Reduce MCP response time to <50ms p99 for all handlers", "backend-lead"),
    ]
    goal_ids = []
    for title, desc, agent in goals_data:
        result = mcp("create_goal", {"title": title, "description": desc, "project": PROJECT, "as": agent})
        if result and isinstance(result, dict):
            gid = result.get("id", "")
            goal_ids.append(gid)
            print(f"  Goal: {title}")
        activity(agent, "tool_start", tool="Write", file="goals.md")
        time.sleep(0.5)

    # ── 5. Board + Tasks ──
    step("5. Kanban board & tasks")
    board_result = mcp("create_board", {"name": "Sprint v0.6", "slug": "sprint-v06", "project": PROJECT, "as": "cto"})
    board_id = ""
    if board_result and isinstance(board_result, dict):
        board_id = board_result.get("id", "")
        print(f"  Board: Sprint v0.6")

    # goal_ids[0] = v0.6 Release, [1] = Test Coverage 80%, [2] = P99 < 50ms
    tasks_data = [
        ("Add token usage sparkline to agent detail panel", "frontend", "cto", "high", 0),
        ("Implement kanban drag-and-drop reorder", "frontend", "cto", "low", 0),
        ("Optimize SQLite queries for deliveries table", "backend", "cto", "high", 2),
        ("Fix SSE reconnection on network drop", "backend", "frontend-dev", "low", 2),
        ("Add vault doc auto-injection to profiles", "backend", "cto", "medium", 0),
        ("Set up Playwright E2E test suite", "qa", "backend-lead", "medium", 1),
        ("Write handler tests for messaging tools", "qa", "backend-lead", "high", 1),
        ("Configure GitHub Actions release workflow", "devops", "cto", "medium", 0),
    ]

    task_ids = []
    for title, profile, dispatched_by, priority, goal_idx in tasks_data:
        args = {
            "title": title,
            "profile": profile,
            "project": PROJECT,
            "as": dispatched_by,
            "priority": priority,
        }
        if goal_ids and goal_idx < len(goal_ids):
            args["goal_id"] = goal_ids[goal_idx]
        if board_id:
            args["board_id"] = board_id
        result = mcp("dispatch_task", args)
        if result and isinstance(result, dict):
            tid = result.get("task", {}).get("id", result.get("id", ""))
            agent_name = next((a["name"] for a in ALL_AGENTS if a["profile"] == profile), "")
            task_ids.append((tid, agent_name))
            print(f"  Task: '{title}' -> {profile}")
        activity(dispatched_by, "tool_start", tool="Bash", file="dispatch")
        time.sleep(0.5)

    # Claim + start first 3
    for tid, assigned in task_ids[:3]:
        if not tid or not assigned:
            continue
        mcp("claim_task", {"task_id": tid, "as": assigned, "project": PROJECT})
        mcp("start_task", {"task_id": tid, "as": assigned, "project": PROJECT})
        activity(assigned, "tool_start", tool="Edit", file=f"internal/{assigned}/work.go")
        print(f"  {assigned} working on task")
        time.sleep(0.5)

    # Complete first task
    if task_ids:
        tid, assigned = task_ids[0]
        if tid and assigned:
            mcp("complete_task", {
                "task_id": tid, "as": assigned, "project": PROJECT,
                "result": "Sparkline component implemented with SVG, 24h/7d toggle, responsive layout"
            })
            print(f"  {assigned} completed task!")
            activity(assigned, "tool_end")
            time.sleep(0.5)

    # ── 6. Memories ──
    step("6. Shared memories")
    memories = [
        ("arch:stack", "Go 1.23, SQLite FTS5 (modernc.org/sqlite), MCP Streamable HTTP, Canvas 2D, vanilla JS ES modules, JetBrains Mono", "project", "cto"),
        ("arch:conventions", "Uber Go style guide, golangci-lint CI, errcheck strict, goimports formatter, table-driven tests", "project", "cto"),
        ("soul:cto", "I am the CTO of wrai.th. I own architecture decisions, coordinate the team, and review all PRs.", "agent", "cto"),
        ("soul:backend-lead", "I am the backend lead. I own Go services, API design, SQLite schema, and performance.", "agent", "backend-lead"),
        ("soul:frontend-dev", "I build the galaxy/colony UI. Canvas 2D rendering, pixel art sprites, vanilla JS modules.", "agent", "frontend-dev"),
        ("soul:devops", "I own CI/CD, deployment, monitoring. Build: go build -tags fts5. Deploy: cp first, then restart.", "agent", "devops"),
        ("soul:qa-tester", "I run E2E tests, regression tests, and coverage reports. Playwright + Go test suite.", "agent", "qa-tester"),
        ("deploy:rules", "CRITICAL: Always cp binary FIRST, then kill process, then restart. Never kill before copy.", "project", "devops"),
        ("qa:strategy", "Focus on MCP handler tests and REST API coverage. Use table-driven tests. Target 80%.", "project", "qa-tester"),
        ("arch:db-schema", "Tables: agents, messages, deliveries, memories, tasks, goals, boards, teams, conversations, token_usage, vault_docs, file_locks", "project", "backend-lead"),
    ]
    for key, value, scope, agent in memories:
        mcp("set_memory", {"key": key, "value": value, "scope": scope, "project": PROJECT, "as": agent})
        activity(agent, "tool_start", tool="Write", file=f"memories/{key}")
        print(f"  [{scope}] {key}")
        time.sleep(0.3)

    # ── 7. Vault docs ──
    step("7. Vault docs")
    conn = sqlite3.connect(DB_PATH)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    vault_docs = [
        ("architecture.md", "Architecture",
         "# Architecture\n\nSingle Go binary, SQLite FTS5, MCP Streamable HTTP.\n\n## Stack\n- Go 1.23\n- modernc.org/sqlite (pure Go)\n- FTS5 for full-text search\n- Canvas 2D for galaxy/colony rendering\n- Vanilla JS ES modules\n\n## Data flow\n```\nMCP client -> handlers.go (67 tools) -> SQLite -> SSE -> Web UI\n```"),
        ("onboarding.md", "Agent Onboarding",
         "# Agent Onboarding\n\n1. register_agent with salt, role, reports_to\n2. get_session_context to restore full state\n3. Read vault docs for project knowledge\n4. Check inbox for pending messages\n5. Claim assigned tasks\n6. Start working"),
        ("api-reference.md", "API Reference",
         "# API Reference\n\n## MCP Tools (67)\n- Agent lifecycle: register, heartbeat, deactivate\n- Messaging: send, inbox, conversations, mark_read\n- Memory: set, get, search, delete (3 scopes)\n- Tasks: dispatch, claim, start, complete, block\n- Goals: create, update, cascade, progress\n- Vault: search, index, query_context (RAG)\n- Teams: create, members, permissions"),
        ("deployment.md", "Deployment Guide",
         "# Deployment\n\n## Local\n```bash\nagent-relay serve\n```\n\n## Server\n```bash\nRELAY_API_KEY=secret ./agent-relay serve\n```\n\n## Build\n```bash\ngo build -tags fts5 -o agent-relay .\n```"),
    ]
    for doc_path, title, content in vault_docs:
        conn.execute(
            "INSERT OR REPLACE INTO vault_docs (project, path, title, content, updated_at, indexed_at) VALUES (?, ?, ?, ?, ?, ?)",
            (PROJECT, doc_path, title, content, now, now)
        )
        print(f"  doc: {doc_path}")
    conn.commit()
    conn.close()
    time.sleep(0.5)

    # ── 8. Messages — all types ──
    step("8. Inter-agent communication")

    mcp("send_message", {
        "to": "backend-lead",
        "content": "The deliveries query is doing a full table scan on 50K rows. We need a composite index on (project, created_at). Can you benchmark before/after?",
        "project": PROJECT, "as": "cto", "priority": 1,
    })
    print("  [direct] cto -> backend-lead")
    activity("cto", "tool_start", tool="Read", file="internal/db/deliveries.go")
    time.sleep(0.8)

    mcp("send_message", {
        "to": "cto",
        "content": "Benchmarked: p99 dropped from 180ms to 12ms with the composite index. Preparing PR now.",
        "project": PROJECT, "as": "backend-lead", "priority": 1,
    })
    print("  [direct] backend-lead -> cto")
    activity("backend-lead", "tool_start", tool="Bash", file="go test -bench=.")
    time.sleep(0.8)

    mcp("send_message", {
        "to": "frontend-dev",
        "content": "The sparkline SVG flickers on Safari. Can you check if requestAnimationFrame fixes it?",
        "project": PROJECT, "as": "backend-lead", "priority": 2,
    })
    print("  [direct] backend-lead -> frontend-dev")
    time.sleep(0.5)

    mcp("send_message", {
        "to": "backend-lead",
        "content": "Fixed with double-buffering. Safari was re-painting the SVG on every data update. Now batched.",
        "project": PROJECT, "as": "frontend-dev", "priority": 2,
    })
    print("  [direct] frontend-dev -> backend-lead")
    activity("frontend-dev", "tool_start", tool="Edit", file="internal/web/static/js/main.js")
    time.sleep(0.5)

    mcp("send_message", {
        "to": "*",
        "content": "Sprint v0.6 kicked off. Check the kanban board for your assigned tasks. Daily standup in the conversation thread.",
        "project": PROJECT, "as": "cto", "priority": 2,
    })
    print("  [broadcast] cto -> *")
    time.sleep(0.5)

    mcp("send_message", {
        "to": "team:core",
        "content": "All PRs need golangci-lint green before merge. Zero tolerance on lint errors. Run go test -race locally.",
        "project": PROJECT, "as": "cto", "priority": 2,
    })
    print("  [team] cto -> team:core")
    time.sleep(0.5)

    # Group conversation
    result = mcp("create_conversation", {
        "title": "Architecture Review -- Token Tracking",
        "members": ["cto", "backend-lead", "frontend-dev"],
        "project": PROJECT, "as": "cto"
    })
    conv_id = ""
    if result and isinstance(result, dict):
        conv_id = result.get("id", result.get("conversation", {}).get("id", ""))
        print(f"  [conv] 'Architecture Review -- Token Tracking'")

    if conv_id:
        for author, content in [
            ("cto", "Should token tracking be per-session or per-agent? Per-agent is simpler but we lose granularity."),
            ("backend-lead", "Per-agent with a session_id column for drill-down. Best of both worlds, minimal schema change."),
            ("frontend-dev", "I can display both views -- sparkline per agent, expandable to per-session. Just need the timeseries endpoint."),
            ("cto", "Good. Ship it. Backend: schema + endpoints. Frontend: sparkline + detail section. EOD target."),
        ]:
            mcp("post_to_conversation", {"conversation_id": conv_id, "content": content, "project": PROJECT, "as": author})
            activity(author, "tool_start", tool="Write", file="conversation")
            print(f"    {author}: {content[:60]}...")
            time.sleep(0.6)

    # 1-to-1 conversation
    result = mcp("create_conversation", {
        "title": "DevOps x QA -- CI Pipeline",
        "members": ["devops", "qa-tester"],
        "project": PROJECT, "as": "devops"
    })
    conv2_id = ""
    if result and isinstance(result, dict):
        conv2_id = result.get("id", result.get("conversation", {}).get("id", ""))
        print(f"  [conv] 'DevOps x QA -- CI Pipeline'")

    if conv2_id:
        for author, content in [
            ("devops", "Lint + test workflow is up. Can you add Playwright tests to the CI matrix?"),
            ("qa-tester", "Done. Added playwright.yml with 3 browser targets. Runs in ~2min. Make it a required check?"),
            ("devops", "Yes, required on main. I'll add branch protection."),
        ]:
            mcp("post_to_conversation", {"conversation_id": conv2_id, "content": content, "project": PROJECT, "as": author})
            activity(author, "tool_start", tool="Bash", file=".github/workflows/")
            print(f"    {author}: {content[:60]}...")
            time.sleep(0.5)

    # ── 9. User questions (3) ──
    step("9. User questions")

    mcp("send_message", {
        "to": "user",
        "content": "I found a potential security issue: the API key comparison in auth middleware is not constant-time, which could leak timing information. Should I fix in v0.6 or ship a hotfix?",
        "project": PROJECT, "as": "backend-lead", "priority": 0,
    })
    print("  [P0] backend-lead: Security issue in auth")
    activity("backend-lead", "tool_start", tool="Read", file="internal/config/config.go")
    time.sleep(1)

    mcp("send_message", {
        "to": "user",
        "content": "E2E test suite ready: 12 tests covering registration, messaging, tasks, memory, conversations. All green. Run against production or staging first?",
        "project": PROJECT, "as": "qa-tester", "priority": 1,
    })
    print("  [P1] qa-tester: E2E suite ready")
    activity("qa-tester", "tool_start", tool="Bash", file="go test ./...")
    time.sleep(1)

    mcp("send_message", {
        "to": "user",
        "content": "Galaxy view has 12 planets now, getting crowded on small screens. Two options: (A) auto-zoom to fit, (B) scrollable canvas with minimap. Which direction?",
        "project": PROJECT, "as": "frontend-dev", "priority": 1,
    })
    print("  [P1] frontend-dev: Galaxy layout question")
    activity("frontend-dev", "tool_start", tool="Write", file="internal/web/static/js/world.js")
    time.sleep(1)

    # ── 10. Token usage (~300 tokens/call) ──
    step("10. Token usage data")
    conn = sqlite3.connect(DB_PATH)
    now_dt = datetime.now(timezone.utc)
    tools = ["register_agent", "send_message", "get_inbox", "set_memory", "get_memory",
             "dispatch_task", "complete_task", "list_tasks", "get_session_context",
             "query_context", "search_vault", "list_agents", "create_goal", "heartbeat"]
    records = []
    for agent in ALL_AGENTS:
        for _ in range(random.randint(60, 80)):
            t = now_dt - timedelta(hours=random.uniform(0, 24))
            tool = random.choice(tools)
            bytes_val = random.randint(1000, 1400)  # ~250-350 tokens
            records.append((PROJECT, agent["name"], tool, bytes_val, t.strftime("%Y-%m-%dT%H:%M:%SZ")))
    conn.executemany(
        "INSERT INTO token_usage (project, agent, tool, bytes, created_at) VALUES (?, ?, ?, ?, ?)",
        records
    )
    conn.commit()
    conn.close()
    print(f"  {len(records)} records (~300 tokens/call avg)")

    # ── 11. Activity burst ──
    step("11. GO FILM -- agents active for 20s")
    print("  Galaxy -> click wraith -> Colony")
    print("  [1] Agents  [2] Kanban  [M] Messages  [Y] Memories  [T] Tasks")
    print("  Click an agent for detail panel + token sparkline")
    print()

    tools_cycle = ["Read", "Write", "Edit", "Bash", "Grep", "Read", "Edit", "Write"]
    files_cycle = [
        "internal/relay/handlers.go", "internal/db/tasks.go",
        "internal/web/static/js/main.js", "internal/relay/api.go",
        "internal/ingest/detector.go", "internal/db/agents.go",
        "internal/web/static/js/world.js", "internal/relay/budget.go",
    ]
    for i in range(20):
        agent = ALL_AGENTS[i % len(ALL_AGENTS)]
        activity(agent["name"], "tool_start",
                 tool=tools_cycle[i % len(tools_cycle)],
                 file=files_cycle[i % len(files_cycle)])
        time.sleep(1)

    print("\nDone. Agents go idle after 30s of inactivity.")


if __name__ == "__main__":
    main()
