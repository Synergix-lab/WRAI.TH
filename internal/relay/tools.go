package relay

import "github.com/mark3labs/mcp-go/mcp"

// asParam is added to every tool that uses agent identity.
var asParam = mcp.WithString("as", mcp.Description("Act as this agent (overrides the default identity from the connection URL). Use this when managing multiple agents from a single session."))

// projectParam is added to every tool that needs project scoping.
// It allows overriding the default ?project= from the URL,
// so agents can switch projects without changing the MCP connection.
var projectParam = mcp.WithString("project", mcp.Description("Project namespace (overrides the default from the connection URL). Agents, messages, and conversations are isolated per project."))

func registerAgentTool() mcp.Tool {
	return mcp.NewTool(
		"register_agent",
		mcp.WithDescription("Register an agent with the relay. Call this once per agent at startup to announce their presence."),
		projectParam,
		mcp.WithString("name", mcp.Description("Unique agent name (e.g. 'backend', 'frontend')"), mcp.Required()),
		mcp.WithString("role", mcp.Description("Agent role description (e.g. 'FastAPI backend developer')")),
		mcp.WithString("description", mcp.Description("What this agent is currently working on")),
		mcp.WithString("reports_to", mcp.Description("Name of the agent this one reports to (for org hierarchy)")),
	)
}

func sendMessageTool() mcp.Tool {
	return mcp.NewTool(
		"send_message",
		mcp.WithDescription("Send a message to another agent. Use '*' as recipient for broadcast. Set conversation_id to send to a conversation (all members will see it)."),
		asParam,
		projectParam,
		mcp.WithString("to", mcp.Description("Recipient agent name, or '*' for broadcast. Ignored when conversation_id is set."), mcp.Required()),
		mcp.WithString("type",
			mcp.Description("Message type"),
			mcp.Enum("question", "response", "notification", "code-snippet", "task", "user_question"),
		),
		mcp.WithString("subject", mcp.Description("Message subject line"), mcp.Required()),
		mcp.WithString("content", mcp.Description("Message body content"), mcp.Required()),
		mcp.WithString("reply_to", mcp.Description("Message ID to reply to (for threading)")),
		mcp.WithString("metadata", mcp.Description("JSON string of additional metadata")),
		mcp.WithString("conversation_id", mcp.Description("Send message to a conversation instead of a single agent")),
	)
}

func getInboxTool() mcp.Tool {
	return mcp.NewTool(
		"get_inbox",
		mcp.WithDescription("Get messages from an agent's inbox. Returns messages sent to them or broadcast (excluding their own broadcasts)."),
		asParam,
		projectParam,
		mcp.WithBoolean("unread_only", mcp.Description("Only return unread messages (default: true)")),
		mcp.WithNumber("limit", mcp.Description("Max number of messages to return (default: 10). Content is truncated to 300 chars — use get_thread for full messages.")),
	)
}

func getThreadTool() mcp.Tool {
	return mcp.NewTool(
		"get_thread",
		mcp.WithDescription("Get a complete thread of messages starting from any message in the thread."),
		projectParam,
		mcp.WithString("message_id", mcp.Description("Any message ID in the thread"), mcp.Required()),
	)
}

func listAgentsTool() mcp.Tool {
	return mcp.NewTool(
		"list_agents",
		mcp.WithDescription("List all registered agents and their status."),
		projectParam,
	)
}

func markReadTool() mcp.Tool {
	return mcp.NewTool(
		"mark_read",
		mcp.WithDescription("Mark messages as read."),
		asParam,
		projectParam,
		mcp.WithArray("message_ids",
			mcp.Description("List of message IDs to mark as read"),
			mcp.WithStringItems(),
		),
		mcp.WithString("conversation_id", mcp.Description("Mark all messages in a conversation as read (alternative to message_ids)")),
	)
}

func createConversationTool() mcp.Tool {
	return mcp.NewTool(
		"create_conversation",
		mcp.WithDescription("Create a multi-agent conversation. All members will see messages sent to it."),
		asParam,
		projectParam,
		mcp.WithString("title", mcp.Description("Conversation title"), mcp.Required()),
		mcp.WithArray("members",
			mcp.Description("Agent names to include (you are added automatically)"),
			mcp.Required(),
			mcp.WithStringItems(),
		),
	)
}

func listConversationsTool() mcp.Tool {
	return mcp.NewTool(
		"list_conversations",
		mcp.WithDescription("List conversations you are a member of, with unread counts."),
		asParam,
		projectParam,
	)
}

func getConversationMessagesTool() mcp.Tool {
	return mcp.NewTool(
		"get_conversation_messages",
		mcp.WithDescription("Get messages from a conversation, ordered chronologically."),
		asParam,
		projectParam,
		mcp.WithString("conversation_id", mcp.Description("The conversation ID"), mcp.Required()),
		mcp.WithNumber("limit", mcp.Description("Max number of messages to return (default: 50)")),
		mcp.WithString("format", mcp.Description("Response format: 'full' (default), 'compact' (metadata only: id, from, type, subject, timestamp), 'digest' (metadata + first 200 chars of content)")),
	)
}

func inviteToConversationTool() mcp.Tool {
	return mcp.NewTool(
		"invite_to_conversation",
		mcp.WithDescription("Add an agent to an existing conversation."),
		asParam,
		projectParam,
		mcp.WithString("conversation_id", mcp.Description("The conversation ID"), mcp.Required()),
		mcp.WithString("agent_name", mcp.Description("Agent name to invite"), mcp.Required()),
	)
}

// --- Memory tools ---

func setMemoryTool() mcp.Tool {
	return mcp.NewTool(
		"set_memory",
		mcp.WithDescription("Store a piece of knowledge in persistent memory. If the key exists with a different value at the same scope, a conflict is flagged (both versions preserved). Use resolve_conflict to pick the truth."),
		asParam,
		projectParam,
		mcp.WithString("key", mcp.Description("Memory key (e.g. 'auth-header-format', 'db-schema-version')"), mcp.Required()),
		mcp.WithString("value", mcp.Description("The knowledge to store"), mcp.Required()),
		mcp.WithArray("tags", mcp.Description("Categorization tags for search and filtering (e.g. ['auth', 'api'])"), mcp.WithStringItems()),
		mcp.WithString("scope",
			mcp.Description("Visibility scope: 'agent' (private), 'project' (shared with team), 'global' (cross-project)"),
			mcp.Enum("agent", "project", "global"),
		),
		mcp.WithString("confidence",
			mcp.Description("How this knowledge was obtained"),
			mcp.Enum("stated", "inferred", "observed"),
		),
	)
}

func getMemoryTool() mcp.Tool {
	return mcp.NewTool(
		"get_memory",
		mcp.WithDescription("Retrieve a memory by key. Searches with scope cascade: agent → project → global. If a conflict exists, returns ALL conflicting values with provenance so you can decide."),
		asParam,
		projectParam,
		mcp.WithString("key", mcp.Description("The memory key to look up"), mcp.Required()),
		mcp.WithString("scope",
			mcp.Description("Specific scope to search (skips cascade). Leave empty for automatic cascade."),
			mcp.Enum("agent", "project", "global"),
		),
	)
}

func searchMemoryTool() mcp.Tool {
	return mcp.NewTool(
		"search_memory",
		mcp.WithDescription("Full-text search across memories. Returns ranked results with provenance and confidence. Cross-scope search by default (respects agent privacy)."),
		asParam,
		projectParam,
		mcp.WithString("query", mcp.Description("Search query (full-text search)"), mcp.Required()),
		mcp.WithArray("tags", mcp.Description("Filter by tags"), mcp.WithStringItems()),
		mcp.WithString("scope",
			mcp.Description("Limit search to a specific scope"),
			mcp.Enum("agent", "project", "global"),
		),
		mcp.WithNumber("limit", mcp.Description("Max results to return (default: 20)")),
	)
}

func listMemoriesTool() mcp.Tool {
	return mcp.NewTool(
		"list_memories",
		mcp.WithDescription("Browse memories with filtering. Shows key, truncated value, tags, provenance. Useful for 'what does the team know about X?'"),
		asParam,
		projectParam,
		mcp.WithString("scope",
			mcp.Description("Filter by scope"),
			mcp.Enum("agent", "project", "global"),
		),
		mcp.WithArray("tags", mcp.Description("Filter by tags"), mcp.WithStringItems()),
		mcp.WithString("agent", mcp.Description("Filter by author agent name")),
		mcp.WithNumber("limit", mcp.Description("Max results (default: 50)")),
	)
}

func deleteMemoryTool() mcp.Tool {
	return mcp.NewTool(
		"delete_memory",
		mcp.WithDescription("Soft-delete a memory (archived, never hard deleted). Only the author or same scope can archive."),
		asParam,
		projectParam,
		mcp.WithString("key", mcp.Description("The memory key to archive"), mcp.Required()),
		mcp.WithString("scope",
			mcp.Description("Scope of the memory to delete"),
			mcp.Enum("agent", "project", "global"),
		),
	)
}

func resolveConflictTool() mcp.Tool {
	return mcp.NewTool(
		"resolve_conflict",
		mcp.WithDescription("Resolve a flagged memory conflict by choosing one value or providing a new one. The rejected version is archived with resolution metadata."),
		asParam,
		projectParam,
		mcp.WithString("key", mcp.Description("The conflicted memory key"), mcp.Required()),
		mcp.WithString("chosen_value", mcp.Description("The value to keep (can be one of the existing values or a new one)"), mcp.Required()),
		mcp.WithString("scope",
			mcp.Description("Scope where the conflict exists"),
			mcp.Enum("agent", "project", "global"),
		),
	)
}
