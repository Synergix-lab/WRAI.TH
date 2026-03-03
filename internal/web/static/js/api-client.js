export class APIClient {
  constructor(onAgents, onConversations, onNewMessages) {
    this.onAgents = onAgents;
    this.onConversations = onConversations;
    this.onNewMessages = onNewMessages;

    this._lastMessageTime = null;
    this._agentTimer = null;
    this._msgTimer = null;
    this._convTimer = null;
    this._running = false;
  }

  start() {
    this._running = true;

    // Initial fetch (cross-project)
    this.fetchAllAgents();
    this.fetchAllConversations();

    // Poll agents every 5s
    this._agentTimer = setInterval(() => this.fetchAllAgents(), 5000);

    // Poll conversations every 10s
    this._convTimer = setInterval(() => this.fetchAllConversations(), 10000);

    // Poll new messages every 2s
    this._msgTimer = setInterval(() => this.fetchLatestMessagesAllProjects(), 2000);
  }

  stop() {
    this._running = false;
    clearInterval(this._agentTimer);
    clearInterval(this._msgTimer);
    clearInterval(this._convTimer);
  }

  async fetchAllAgents() {
    try {
      const res = await fetch("/api/agents/all");
      if (!res.ok) return;
      const agents = await res.json();
      this.onAgents(agents);
    } catch (e) {
      console.error("[relay] fetchAllAgents error:", e);
    }
  }

  async fetchAllConversations() {
    try {
      const res = await fetch("/api/conversations/all");
      if (!res.ok) return;
      const convs = await res.json();
      this.onConversations(convs);
    } catch (e) {
      console.error("[relay] fetchAllConversations error:", e);
    }
  }

  async fetchLatestMessagesAllProjects() {
    try {
      const since = this._lastMessageTime || new Date(Date.now() - 30000).toISOString();
      const res = await fetch(`/api/messages/latest-all?since=${encodeURIComponent(since)}`);
      if (!res.ok) return;
      const msgs = await res.json();

      if (msgs.length > 0) {
        this._lastMessageTime = msgs[msgs.length - 1].created_at;
        this.onNewMessages(msgs);
      }
    } catch {
      // Silently ignore
    }
  }

  async fetchAllMessagesAllProjects() {
    try {
      const res = await fetch("/api/messages/all-projects");
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async fetchConversationMessages(convId) {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async sendUserResponse(project, to, content, replyTo) {
    try {
      const res = await fetch("/api/user-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, to, content, reply_to: replyTo }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Memory API ---

  async fetchMemories(params = {}) {
    try {
      const qs = new URLSearchParams();
      if (params.project) qs.set("project", params.project);
      if (params.scope) qs.set("scope", params.scope);
      if (params.agent) qs.set("agent", params.agent);
      if (params.tag) qs.set("tag", params.tag);
      const res = await fetch(`/api/memories?${qs}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async searchMemories(query) {
    try {
      const res = await fetch(`/api/memories/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async createMemory(data) {
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  async deleteMemory(id) {
    try {
      const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async resolveConflict(key, chosenValue, project, scope) {
    try {
      const res = await fetch(`/api/memories/${encodeURIComponent(key)}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chosen_value: chosenValue, project, scope }),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }
}
