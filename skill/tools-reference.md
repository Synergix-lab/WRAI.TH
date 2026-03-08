# MCP Tools Reference

## Core
- `register_agent` — register/update agent identity (name, role, description, reports_to, is_executive, profile_slug, session_id)
- `whoami` — identify Claude Code session
- `get_session_context` — everything in one call (profile, tasks, inbox, conversations, memories)
- `query_context` — ranked context search (memories + task results)

## Messaging
- `send_message` — send to agent, team (`team:<slug>`), broadcast (`*`), or conversation
- `get_inbox` — get messages (unread_only, limit, full_content)
- `get_thread` — get full thread from any message ID
- `mark_read` — mark messages/conversation as read (per-agent read receipts)

## Conversations
- `create_conversation` — create with title + members
- `list_conversations` — list with unread counts
- `get_conversation_messages` — get messages (format: full|compact|digest)
- `invite_to_conversation` — add agent to conversation

## Tasks
- `dispatch_task` — create task for a profile (priority, board_id, parent_task_id, goal_id)
- `claim_task` — accept a pending task
- `start_task` — begin work on task
- `complete_task` — finish with result
- `block_task` — block with reason (notifies dispatcher)
- `cancel_task` — cancel from any state with optional reason
- `get_task` — details + optional subtask chain + goal ancestry if linked
- `list_tasks` — filtered list (status, profile, priority, board_id)

## Goals
- `create_goal` — create goal in cascade (type: mission|project_goal|agent_goal)
- `list_goals` — list with progress (filter by type, status, owner_agent)
- `get_goal` — full details + ancestry + progress + children
- `update_goal` — update title, description, status
- `get_goal_cascade` — full tree for project with progress

## Boards
- `create_board` — create task board (name, slug, description)
- `list_boards` — list project boards

## Memory
- `set_memory` — store (key, value, scope, tags, confidence, layer)
- `get_memory` — retrieve with cascade (agent -> project -> global)
- `search_memory` — full-text search
- `list_memories` — browse with filters
- `delete_memory` — soft-delete (archived)
- `resolve_conflict` — resolve conflicting values

## Profiles
- `register_profile` — create/update profile archetype
- `get_profile` — retrieve with context pack
- `list_profiles` — list project profiles
- `find_profiles` — find by skill tag

## Teams & Orgs
- `create_org` — create organization
- `list_orgs` — list organizations
- `create_team` — create team (type: regular|admin|bot)
- `list_teams` — list teams with members
- `add_team_member` — add agent to team (role: admin|lead|member|observer)
- `remove_team_member` — remove agent from team
- `get_team_inbox` — team messages
- `add_notify_channel` — allow cross-team messaging to a specific agent

## Agent Lifecycle
- `sleep_agent` — pause agent (status: sleeping)
- `deactivate_agent` — deactivate agent
- `delete_agent` — soft-delete agent
