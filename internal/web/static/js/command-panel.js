// command-panel.js — Colony Command Panel: agent HUD + management dock
// Replaces the side detail drawer — all agent info lives here now.
// HUD / Retro-futurism aesthetic: scanlines, neon glow, monospace

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const CMD_STYLES = `
/* ══════════════════════════════════════════════════════════
   COMMAND PANEL — HUD / Retro-Futurism Console
   ══════════════════════════════════════════════════════════ */

@keyframes cmdFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes cmdPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes scanline {
  0% { background-position: 0 0; }
  100% { background-position: 0 4px; }
}

.cmd-root {
  font-family: 'JetBrains Mono', monospace;
  color: #c8ccd4;
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden;
  position: relative;
}
/* Subtle scanline overlay */
.cmd-root::before {
  content: '';
  position: absolute; inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(108, 92, 231, 0.02) 2px,
    rgba(108, 92, 231, 0.02) 4px
  );
  pointer-events: none;
  z-index: 1;
}

/* ── CREATION BAR (no agent) ── */
.cmd-creation-bar {
  display: flex; gap: 12px;
  padding: 16px 24px;
  align-items: center;
  flex-shrink: 0;
}
.cmd-creation-bar::before {
  content: 'COMMAND';
  color: rgba(108, 92, 231, 0.5);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-right: 8px;
}
.cmd-create-btn {
  padding: 10px 20px;
  font-size: 10px; font-weight: 700;
  letter-spacing: 1.5px;
  border: 1px solid rgba(108, 92, 231, 0.4);
  background: rgba(108, 92, 231, 0.08);
  color: #a29bfe;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.2s ease;
  font-family: inherit;
  text-transform: uppercase;
}
.cmd-create-btn:hover {
  background: rgba(108, 92, 231, 0.15);
  border-color: rgba(108, 92, 231, 0.6);
  color: #a29bfe;
  box-shadow: 0 0 12px rgba(108, 92, 231, 0.15);
}
.cmd-create-btn.active {
  background: rgba(108, 92, 231, 0.2);
  border-color: #a29bfe;
  color: #d4cfff;
  box-shadow: 0 0 16px rgba(108, 92, 231, 0.25), inset 0 0 8px rgba(108, 92, 231, 0.1);
}

.cmd-form-area {
  flex: 1; overflow-y: auto;
  padding: 12px 20px;
  animation: cmdFadeIn 0.2s ease;
}

/* ── AGENT HUD — horizontal layout ── */
.cmd-agent-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* Left: Identity + live data */
.cmd-hud-left {
  width: 280px;
  min-width: 240px;
  flex-shrink: 0;
  border-right: 1px solid rgba(108, 92, 231, 0.15);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 12px 16px;
}

/* Right: Tabbed management */
.cmd-hud-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* ── HUD Identity Block ── */
.cmd-hero {
  margin-bottom: 10px;
}
.cmd-hero-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.cmd-hero-name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #e0e0e8;
  text-shadow: 0 0 8px rgba(162, 155, 254, 0.3);
}
.cmd-hero-status {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 2px 8px;
  border-radius: 2px;
  margin-left: auto;
}
.cmd-hero-status.online {
  color: #00e676;
  background: rgba(0, 230, 118, 0.08);
  border: 1px solid rgba(0, 230, 118, 0.25);
  box-shadow: 0 0 6px rgba(0, 230, 118, 0.15);
}
.cmd-hero-status.offline {
  color: #636e72;
  background: rgba(99, 110, 114, 0.06);
  border: 1px solid rgba(99, 110, 114, 0.2);
}
.cmd-hero-status.sleeping {
  color: #9b59b6;
  background: rgba(155, 89, 182, 0.06);
  border: 1px solid rgba(155, 89, 182, 0.2);
}
.cmd-hero-role {
  font-size: 9px;
  color: #7f8694;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}
.cmd-hero-activity {
  font-size: 9px;
  color: #a29bfe;
  animation: cmdPulse 2s ease infinite;
}

/* ── HUD Stats Grid ── */
.cmd-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin: 8px 0;
}
.cmd-stat {
  padding: 5px 8px;
  background: rgba(15, 15, 30, 0.5);
  border: 1px solid rgba(108, 92, 231, 0.08);
  border-radius: 2px;
}
.cmd-stat-value {
  font-size: 11px;
  font-weight: 700;
  color: #a29bfe;
  display: block;
}
.cmd-stat-label {
  font-size: 7px;
  color: #5a5e78;
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* ── Current Task ── */
.cmd-current-task {
  padding: 8px 10px;
  background: rgba(0, 230, 118, 0.03);
  border-left: 2px solid rgba(0, 230, 118, 0.4);
  border-radius: 0 2px 2px 0;
  margin: 6px 0;
}
.cmd-current-task-label {
  font-size: 7px;
  color: #5a5e78;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 3px;
}
.cmd-current-task-title {
  font-size: 10px;
  color: #dfe6e9;
}
.cmd-current-task-status {
  font-size: 8px;
  margin-top: 2px;
}

/* ── Hierarchy / Teams compact ── */
.cmd-hud-section {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(108, 92, 231, 0.08);
}
.cmd-hud-section-label {
  font-size: 7px;
  color: #5a5e78;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.cmd-tag {
  display: inline-block;
  padding: 2px 7px;
  font-size: 8px;
  font-weight: 600;
  background: rgba(108, 92, 231, 0.08);
  border: 1px solid rgba(108, 92, 231, 0.15);
  border-radius: 2px;
  color: #a29bfe;
  margin: 0 3px 3px 0;
  cursor: pointer;
  transition: all 0.15s;
}
.cmd-tag:hover {
  background: rgba(108, 92, 231, 0.2);
  border-color: rgba(108, 92, 231, 0.4);
}
.cmd-tag.gold {
  color: #f6c243;
  border-color: rgba(246, 194, 67, 0.25);
  background: rgba(246, 194, 67, 0.06);
}
.cmd-tag.dim {
  color: #636e72;
  cursor: default;
}
.cmd-tag.dim:hover { background: rgba(108, 92, 231, 0.08); }

/* ── Recent Comms compact ── */
.cmd-msg-item {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 3px 0;
  font-size: 9px;
  color: #7f8694;
  border-bottom: 1px solid rgba(108, 92, 231, 0.04);
}
.cmd-msg-item:last-child { border-bottom: none; }
.cmd-msg-dir { font-weight: 700; font-size: 10px; flex-shrink: 0; }
.cmd-msg-peer { color: #a29bfe; flex-shrink: 0; }
.cmd-msg-preview {
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: #636e72;
}
.cmd-msg-time { flex-shrink: 0; color: #3d4150; font-size: 8px; }

/* ── Nav arrows ── */
.cmd-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid rgba(108, 92, 231, 0.08);
}
.cmd-nav-btn {
  background: none; border: 1px solid rgba(108, 92, 231, 0.2);
  color: #7c6fe0; cursor: pointer;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 2px; font-size: 12px;
  font-family: inherit;
  transition: all 0.15s;
}
.cmd-nav-btn:hover {
  background: rgba(108, 92, 231, 0.15);
  border-color: rgba(108, 92, 231, 0.5);
}
.cmd-nav-label {
  font-size: 8px; color: #5a5e78;
  letter-spacing: 1px; flex: 1; text-align: center;
}

/* ── TAB BAR ── */
.cmd-tabs {
  display: flex; gap: 0;
  border-bottom: 1px solid rgba(108, 92, 231, 0.15);
  flex-shrink: 0;
  padding: 0 16px;
  background: rgba(10, 10, 26, 0.5);
}
.cmd-tab {
  padding: 8px 14px;
  font-size: 8px; font-weight: 700;
  letter-spacing: 1.5px;
  color: #4a4e64;
  cursor: pointer; border: none; background: none;
  position: relative;
  transition: color 0.15s;
  font-family: inherit;
  text-transform: uppercase;
}
.cmd-tab:hover { color: #7c6fe0; }
.cmd-tab.active { color: #a29bfe; }
.cmd-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px; left: 8px; right: 8px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #a29bfe, transparent);
  box-shadow: 0 0 6px rgba(162, 155, 254, 0.4);
}

/* ── TAB CONTENT ── */
.cmd-tab-content {
  flex: 1; overflow-y: auto;
  padding: 12px 16px;
  animation: cmdFadeIn 0.15s ease;
}

/* ── ACTIONS BAR ── */
.cmd-actions {
  display: flex; gap: 6px;
  padding: 8px 16px;
  border-top: 1px solid rgba(108, 92, 231, 0.12);
  flex-shrink: 0;
  align-items: center;
  background: rgba(10, 10, 26, 0.4);
}

/* ── Shared: forms, buttons, lists ── */
.cmd-form { display: flex; flex-direction: column; gap: 8px; }
.cmd-form-row { display: flex; gap: 8px; align-items: center; }
.cmd-form-row.wide { flex-direction: column; align-items: stretch; }
.cmd-label {
  font-size: 8px; font-weight: 700;
  letter-spacing: 1.5px; color: #4a4e64;
  min-width: 80px; flex-shrink: 0;
  text-transform: uppercase;
}
.cmd-input, .cmd-select, .cmd-textarea {
  font-family: inherit;
  font-size: 10px; padding: 5px 8px;
  background: rgba(10, 10, 26, 0.7);
  border: 1px solid rgba(108, 92, 231, 0.18);
  color: #c8ccd4;
  border-radius: 2px; flex: 1; min-width: 0;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.cmd-input:focus, .cmd-select:focus, .cmd-textarea:focus {
  outline: none;
  border-color: rgba(108, 92, 231, 0.5);
  box-shadow: 0 0 8px rgba(108, 92, 231, 0.15);
}
.cmd-textarea { resize: vertical; min-height: 40px; }
.cmd-input[readonly] { opacity: 0.4; cursor: not-allowed; }

.cmd-btn {
  padding: 5px 12px;
  font-size: 8px; font-weight: 700;
  letter-spacing: 1px;
  border: 1px solid rgba(108, 92, 231, 0.3);
  background: rgba(108, 92, 231, 0.06);
  color: #7c6fe0;
  cursor: pointer; border-radius: 2px;
  transition: all 0.2s ease;
  font-family: inherit;
  text-transform: uppercase;
}
.cmd-btn:hover {
  background: rgba(108, 92, 231, 0.18);
  border-color: #a29bfe;
  box-shadow: 0 0 8px rgba(108, 92, 231, 0.15);
}
.cmd-btn:active { transform: scale(0.97); }
.cmd-btn.primary {
  background: rgba(108, 92, 231, 0.2);
  border-color: #a29bfe;
  color: #d4cfff;
}
.cmd-btn.primary:hover {
  background: rgba(108, 92, 231, 0.35);
  box-shadow: 0 0 12px rgba(108, 92, 231, 0.25);
}
.cmd-btn.danger {
  border-color: rgba(255, 107, 107, 0.3);
  color: #e74c3c;
  background: rgba(255, 107, 107, 0.04);
}
.cmd-btn.danger:hover {
  background: rgba(255, 107, 107, 0.15);
  border-color: #ff6b6b;
  box-shadow: 0 0 8px rgba(255, 107, 107, 0.15);
}
.cmd-btn.success {
  border-color: rgba(0, 230, 118, 0.3);
  color: #00c853;
  background: rgba(0, 230, 118, 0.04);
}
.cmd-btn.success:hover {
  background: rgba(0, 230, 118, 0.15);
  border-color: #00e676;
  box-shadow: 0 0 8px rgba(0, 230, 118, 0.15);
}

/* ── List items ── */
.cmd-list-item {
  display: flex; align-items: center;
  gap: 10px; padding: 5px 0;
  border-bottom: 1px solid rgba(108, 92, 231, 0.06);
  font-size: 10px;
}
.cmd-list-item:last-child { border-bottom: none; }
.cmd-list-name { flex: 1; color: #c8ccd4; }
.cmd-list-meta { color: #4a4e64; font-size: 9px; }
.cmd-list-actions { display: flex; gap: 4px; }

/* ── Skill entries (expandable .md cards) ── */
.cmd-skill-entry {
  border-bottom: 1px solid rgba(108, 92, 231, 0.08);
  font-size: 10px;
}
.cmd-skill-entry:last-of-type { border-bottom: none; }
.cmd-skill-header {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 4px; cursor: pointer;
  transition: background 0.15s;
}
.cmd-skill-header:hover { background: rgba(108, 92, 231, 0.06); }
.cmd-skill-chevron {
  color: #4a4e64; font-size: 7px; width: 10px; text-align: center;
  flex-shrink: 0;
}
.cmd-skill-name {
  font-weight: 600; color: #a29bfe;
  font-family: 'JetBrains Mono', monospace;
  flex-shrink: 0;
}
.cmd-skill-preview {
  color: #4a4e64; font-size: 9px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1; min-width: 0;
}
.cmd-skill-body {
  padding: 0 4px 6px 20px;
}
.cmd-skill-md {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px; line-height: 1.5;
  color: #8a8ea0; white-space: pre-wrap; word-break: break-word;
  margin: 0; padding: 6px 8px;
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(108, 92, 231, 0.1);
  border-radius: 3px;
  max-height: 200px; overflow-y: auto;
}
.cmd-skill-textarea {
  min-height: 120px; font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  white-space: pre;
}

/* ── Quota bars ── */
.cmd-quota-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.cmd-quota-label {
  font-size: 8px; color: #4a4e64;
  min-width: 90px; letter-spacing: 1px;
  text-transform: uppercase;
}
.cmd-quota-bar-bg {
  flex: 1; height: 6px;
  background: rgba(108, 92, 231, 0.06);
  border-radius: 3px; overflow: hidden;
}
.cmd-quota-bar-fill {
  height: 100%; border-radius: 3px;
  transition: width 0.3s ease;
  box-shadow: 0 0 4px currentColor;
}
.cmd-quota-value {
  font-size: 9px; color: #7c6fe0;
  min-width: 55px; text-align: right;
}

.cmd-inline-form {
  padding: 10px;
  background: rgba(10, 10, 26, 0.6);
  border: 1px solid rgba(108, 92, 231, 0.12);
  border-radius: 2px; margin-top: 8px;
  animation: cmdFadeIn 0.15s ease;
}

.cmd-empty {
  text-align: center; color: #3d4150;
  font-size: 9px; padding: 16px;
  letter-spacing: 1px;
}

/* Terminal tab */
#cmd-xterm { flex: 1; min-height: 0; }
#cmd-xterm .xterm { height: 100%; }
#cmd-xterm .xterm-viewport { overflow-y: auto !important; }
.cmd-tab-content:has(#cmd-xterm) { padding: 0; }

/* ── Send message form ── */
.cmd-send-form {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px 16px;
  border-top: 1px solid rgba(108, 92, 231, 0.1);
  background: rgba(10, 10, 26, 0.4);
  flex-shrink: 0;
  animation: cmdFadeIn 0.15s ease;
}
.cmd-send-row { display: flex; gap: 6px; align-items: center; }
`;

export class CommandPanel {
  constructor(container, resizeHandle) {
    this._container = container;
    this._resizeHandle = resizeHandle;
    this._project = null;
    this._agent = null;
    this._activeTab = 'profile';
    this._client = null;
    this._profiles = [];
    this._cycles = [];
    this._activeCreateForm = null;
    this._msgFormOpen = false;
    this._onNavigate = null; // callback(agentKey) for prev/next
    this._terminal = null;     // xterm.js Terminal instance
    this._termWs = null;       // WebSocket connection
    this._termSessionId = null; // PTY session ID
    this._termBox = null;      // persistent DOM container for xterm (survives tab switches)
    this._termFit = null;      // FitAddon instance
    this._termByAgent = {};    // slug → sessionId (survives agent switches)

    if (!document.getElementById('cmd-panel-styles')) {
      const style = document.createElement('style');
      style.id = 'cmd-panel-styles';
      style.textContent = CMD_STYLES;
      document.head.appendChild(style);
    }
    this._initResize();
  }

  setClient(client) { this._client = client; }

  /** @param {Function} fn - called with direction: -1 or +1 */
  set onNavigate(fn) { this._onNavigate = fn; }

  show(project) {
    this._project = project;
    this._loadCacheLists();
    if (!this._agent) this._renderCreationBar();
  }

  hide() {
    // Visibility is controlled by body.view-galaxy .colony-only { display: none !important }
    // No need to set inline styles
    this._resizeHandle.style.display = 'none';
  }

  setAgent(agentData) {
    const prevSlug = this._agent?.slug || this._agent?.name;
    const newSlug = agentData?.slug || agentData?.name;
    // Switching to a different agent — save session ID, teardown UI only
    if (prevSlug && newSlug && prevSlug !== newSlug) {
      if (this._termSessionId) {
        this._termByAgent[prevSlug] = this._termSessionId;
      }
      this._teardownTerminalUI();
      // Restore session ID if this agent had one running
      this._termSessionId = this._termByAgent[newSlug] || null;
    }
    this._agent = agentData;
    if (!this._agent._tabVisited) this._activeTab = 'profile';
    this._agent._tabVisited = true;
    this._msgFormOpen = false;
    this._renderAgentPanel();
  }

  clearAgent() {
    // Save session before clearing
    const slug = this._agent?.slug || this._agent?.name;
    if (slug && this._termSessionId) {
      this._termByAgent[slug] = this._termSessionId;
    }
    this._agent = null;
    this._activeCreateForm = null;
    this._msgFormOpen = false;
    this._teardownTerminalUI();
    this._termSessionId = null;
    this._renderCreationBar();
  }

  // Teardown xterm UI only (WS + DOM). PTY session stays alive on server.
  _teardownTerminalUI() {
    if (this._termWs) { this._termWs.close(); this._termWs = null; }
    if (this._terminal) { this._terminal.dispose(); this._terminal = null; }
    if (this._termBox) { this._termBox.remove(); this._termBox = null; }
    this._termFit = null;
  }

  // Full destroy: teardown UI + forget session ID
  _destroyTerminal() {
    const slug = this._agent?.slug || this._agent?.name;
    if (slug) delete this._termByAgent[slug];
    this._teardownTerminalUI();
    this._termSessionId = null;
  }

  // ── Internals ──

  async _loadCacheLists() {
    if (!this._client || !this._project) return;
    try {
      [this._profiles, this._cycles] = await Promise.all([
        this._client.fetchProfiles(this._project),
        this._client.fetchCycles(this._project),
      ]);
    } catch { /* ignore */ }
  }

  // ════════════════════════════════════════════
  //  CREATION BAR (no agent selected)
  // ════════════════════════════════════════════

  _renderCreationBar() {
    this._container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'cmd-root';

    const bar = document.createElement('div');
    bar.className = 'cmd-creation-bar';
    const btns = [
      { label: '+ Agent', form: 'agent' },
      { label: '+ Cycle', form: 'cycle' },
      { label: '+ Schedule', form: 'schedule' },
    ];
    for (const b of btns) {
      const btn = document.createElement('button');
      btn.className = 'cmd-create-btn' + (this._activeCreateForm === b.form ? ' active' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => {
        this._activeCreateForm = this._activeCreateForm === b.form ? null : b.form;
        this._renderCreationBar();
      });
      bar.appendChild(btn);
    }
    root.appendChild(bar);

    if (this._activeCreateForm) {
      const area = document.createElement('div');
      area.className = 'cmd-form-area';
      if (this._activeCreateForm === 'agent') this._buildAgentCreateForm(area);
      else if (this._activeCreateForm === 'cycle') this._buildCycleCreateForm(area);
      else if (this._activeCreateForm === 'schedule') this._buildScheduleCreateForm(area);
      root.appendChild(area);
    }

    this._container.appendChild(root);
  }

  _buildAgentCreateForm(area) {
    const form = document.createElement('div');
    form.className = 'cmd-form';
    form.innerHTML = `
      <div class="cmd-form-row">
        <span class="cmd-label">SLUG</span>
        <input class="cmd-input" data-field="slug" placeholder="agent-slug" />
      </div>
      <div class="cmd-form-row">
        <span class="cmd-label">NAME</span>
        <input class="cmd-input" data-field="name" placeholder="Agent Name" />
      </div>
      <div class="cmd-form-row">
        <span class="cmd-label">ROLE</span>
        <input class="cmd-input" data-field="role" placeholder="Role description" />
      </div>
      <div class="cmd-form-row wide">
        <span class="cmd-label">CONTEXT PACK</span>
        <textarea class="cmd-textarea" data-field="context_pack" rows="2" placeholder="Context pack..."></textarea>
      </div>
      <div class="cmd-form-row">
        <span class="cmd-label">PROJECT</span>
        <input class="cmd-input" data-field="project" value="${esc(this._project)}" readonly />
        <button class="cmd-btn primary" id="cmd-create-agent-btn">CREATE</button>
      </div>
    `;
    area.appendChild(form);
    area.querySelector('#cmd-create-agent-btn').addEventListener('click', () => this._doCreateAgent(form));
  }

  async _doCreateAgent(form) {
    const get = (f) => form.querySelector(`[data-field="${f}"]`)?.value?.trim() || '';
    const data = { slug: get('slug'), name: get('name'), role: get('role'), context_pack: get('context_pack'), project: this._project };
    if (!data.slug) return;
    const result = await this._client.createProfile(data);
    if (result) { this._activeCreateForm = null; await this._loadCacheLists(); this._renderCreationBar(); }
  }

  _buildCycleCreateForm(area) {
    const form = document.createElement('div');
    form.className = 'cmd-form';
    form.innerHTML = `
      <div class="cmd-form-row">
        <span class="cmd-label">NAME</span>
        <input class="cmd-input" data-field="name" placeholder="cycle-name" />
      </div>
      <div class="cmd-form-row wide">
        <span class="cmd-label">PROMPT</span>
        <textarea class="cmd-textarea" data-field="prompt" rows="2" placeholder="Cycle prompt..."></textarea>
      </div>
      <div class="cmd-form-row">
        <span class="cmd-label">TTL</span>
        <input class="cmd-input" data-field="ttl" placeholder="30m" />
        <button class="cmd-btn primary" id="cmd-create-cycle-btn">CREATE</button>
      </div>
    `;
    area.appendChild(form);
    area.querySelector('#cmd-create-cycle-btn').addEventListener('click', () => this._doCreateCycle(form));
  }

  async _doCreateCycle(form) {
    const get = (f) => form.querySelector(`[data-field="${f}"]`)?.value?.trim() || '';
    const data = { name: get('name'), prompt: get('prompt'), ttl: get('ttl'), project: this._project };
    if (!data.name) return;
    const result = await this._client.createCycle(data);
    if (result) { this._activeCreateForm = null; await this._loadCacheLists(); this._renderCreationBar(); }
  }

  _buildScheduleCreateForm(area) {
    const form = document.createElement('div');
    form.className = 'cmd-form';
    const agentOpts = this._profiles.map(p => `<option value="${esc(p.slug)}">${esc(p.slug)}</option>`).join('');
    const cycleOpts = this._cycles.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    form.innerHTML = `
      <div class="cmd-form-row">
        <span class="cmd-label">AGENT</span>
        <select class="cmd-select" data-field="agent"><option value="">--</option>${agentOpts}</select>
      </div>
      <div class="cmd-form-row">
        <span class="cmd-label">CYCLE</span>
        <select class="cmd-select" data-field="cycle"><option value="">--</option>${cycleOpts}</select>
      </div>
      <div class="cmd-form-row">
        <span class="cmd-label">NAME</span>
        <input class="cmd-input" data-field="name" placeholder="schedule-name" />
      </div>
      <div class="cmd-form-row">
        <span class="cmd-label">CRON</span>
        <input class="cmd-input" data-field="cron_expr" placeholder="*/30 * * * *" />
        <button class="cmd-btn primary" id="cmd-create-schedule-btn">CREATE</button>
      </div>
    `;
    area.appendChild(form);
    area.querySelector('#cmd-create-schedule-btn').addEventListener('click', () => this._doCreateSchedule(form));
  }

  async _doCreateSchedule(form) {
    const get = (f) => form.querySelector(`[data-field="${f}"]`)?.value?.trim() || '';
    const data = { agent: get('agent'), project: this._project, name: get('name'), cron_expr: get('cron_expr'), ttl: '', cycle: get('cycle') };
    if (!data.agent || !data.cron_expr) return;
    const result = await this._client.createSchedule(data);
    if (result) { this._activeCreateForm = null; this._renderCreationBar(); }
  }

  // ════════════════════════════════════════════
  //  AGENT HUD PANEL
  // ════════════════════════════════════════════

  _renderAgentPanel() {
    const a = this._agent;
    if (!a) return;
    // Detach the persistent terminal box before clearing (so it isn't destroyed)
    if (this._termBox && this._termBox.parentNode) {
      this._termBox.remove();
    }
    this._container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'cmd-root';

    const layout = document.createElement('div');
    layout.className = 'cmd-agent-layout';

    // ── LEFT: Identity HUD ──
    const left = document.createElement('div');
    left.className = 'cmd-hud-left';
    this._renderHudLeft(left, a);
    layout.appendChild(left);

    // ── RIGHT: Tabbed management ──
    const right = document.createElement('div');
    right.className = 'cmd-hud-right';

    // Tab bar
    const tabs = document.createElement('div');
    tabs.className = 'cmd-tabs';
    const tabDefs = ['profile', 'skills', 'quotas', 'schedules', 'comms', 'tasks', 'terminal'];
    for (const t of tabDefs) {
      const btn = document.createElement('button');
      btn.className = 'cmd-tab' + (this._activeTab === t ? ' active' : '');
      btn.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      btn.addEventListener('click', () => { this._activeTab = t; this._renderAgentPanel(); });
      tabs.appendChild(btn);
    }
    right.appendChild(tabs);

    // Tab content
    const content = document.createElement('div');
    content.className = 'cmd-tab-content';
    if (this._activeTab === 'profile') this._renderProfileTab(content);
    else if (this._activeTab === 'skills') this._renderSkillsTab(content);
    else if (this._activeTab === 'quotas') this._renderQuotasTab(content);
    else if (this._activeTab === 'schedules') this._renderSchedulesTab(content);
    else if (this._activeTab === 'comms') this._renderCommsTab(content);
    else if (this._activeTab === 'tasks') this._renderTasksTab(content);
    else if (this._activeTab === 'terminal') this._renderTerminalTab(content);
    right.appendChild(content);

    // Actions bar
    const actions = document.createElement('div');
    actions.className = 'cmd-actions';

    // Terminal spawn button
    const spawnBtn = document.createElement('button');
    if (this._termSessionId) {
      // Terminal is running — show kill button
      spawnBtn.className = 'cmd-btn danger';
      spawnBtn.textContent = 'Kill Terminal';
      spawnBtn.addEventListener('click', async () => {
        spawnBtn.textContent = 'Killing...';
        spawnBtn.disabled = true;
        await this._client.terminalKill(this._termSessionId);
        this._destroyTerminal();
        this._renderAgentPanel();
      });
    } else {
      spawnBtn.className = 'cmd-btn success';
      spawnBtn.textContent = 'Spawn Terminal';
      spawnBtn.addEventListener('click', async () => {
        spawnBtn.textContent = 'Spawning...';
        spawnBtn.disabled = true;
        const slug = this._agent.slug || this._agent.name;
        const result = await this._client.terminalSpawn({
          project: this._project,
          profile: slug,
        });
        if (result && result.session_id) {
          this._termSessionId = result.session_id;
          this._activeTab = 'terminal';
          this._renderAgentPanel();
        } else {
          spawnBtn.textContent = 'Failed';
          spawnBtn.style.color = '#ff6b6b';
          setTimeout(() => { spawnBtn.textContent = 'Spawn Terminal'; spawnBtn.disabled = false; spawnBtn.style.color = ''; }, 2000);
        }
      });
    }
    actions.appendChild(spawnBtn);

    const msgBtn = document.createElement('button');
    msgBtn.className = 'cmd-btn';
    msgBtn.textContent = 'Message';
    msgBtn.addEventListener('click', () => { this._msgFormOpen = !this._msgFormOpen; this._renderAgentPanel(); });
    actions.appendChild(msgBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'cmd-btn danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => this._doDeleteAgent());
    actions.appendChild(delBtn);

    right.appendChild(actions);

    // Message form (inline, below actions)
    if (this._msgFormOpen) {
      const mf = document.createElement('div');
      mf.className = 'cmd-send-form';
      mf.innerHTML = `
        <div class="cmd-send-row">
          <span class="cmd-label">TO</span>
          <input class="cmd-input" data-field="to" value="${esc(a.slug || a.name)}" />
          <span class="cmd-label" style="min-width:auto">PRI</span>
          <select class="cmd-select" data-field="priority" style="width:70px;flex:none">
            <option value="normal">normal</option><option value="high">high</option><option value="low">low</option>
          </select>
        </div>
        <div class="cmd-send-row">
          <textarea class="cmd-textarea" data-field="content" rows="2" placeholder="Message..." style="flex:1"></textarea>
          <button class="cmd-btn primary" id="cmd-send-msg-btn" style="align-self:flex-end">Send</button>
        </div>
      `;
      right.appendChild(mf);
      mf.querySelector('#cmd-send-msg-btn').addEventListener('click', () => this._doSendMessage(mf));
    }

    layout.appendChild(right);
    root.appendChild(layout);
    this._container.appendChild(root);
  }

  _renderHudLeft(left, a) {
    // Hero identity
    const hero = document.createElement('div');
    hero.className = 'cmd-hero';

    const statusClass = a.sleeping ? 'sleeping' : a.online ? 'online' : 'offline';
    const statusText = a.sleeping ? 'ZZZ' : a.online ? 'ONLINE' : 'OFFLINE';

    hero.innerHTML = `
      <div class="cmd-hero-row">
        <span class="cmd-hero-name" style="color:${a.color || '#a29bfe'}">${esc(a.name || a.slug)}</span>
        <span class="cmd-hero-status ${statusClass}">${statusText}</span>
      </div>
      <div class="cmd-hero-role">${esc(a.role || '')}</div>
      ${a.activity && a.activity !== 'idle' ? `<div class="cmd-hero-activity">${esc(a.activityTool || a.activity)}</div>` : ''}
    `;
    left.appendChild(hero);

    // Stats grid
    const stats = document.createElement('div');
    stats.className = 'cmd-stats';
    const lastSeen = a._lastSeenRaw ? timeAgo(a._lastSeenRaw) : '--';
    const poolSize = a.pool_size || 1;
    const skillCount = (a._skills || []).length;
    const taskCount = (a._tasks || []).length;
    stats.innerHTML = `
      <div class="cmd-stat"><span class="cmd-stat-value">${lastSeen}</span><span class="cmd-stat-label">Last seen</span></div>
      <div class="cmd-stat"><span class="cmd-stat-value">${poolSize}</span><span class="cmd-stat-label">Pool size</span></div>
      <div class="cmd-stat"><span class="cmd-stat-value">${skillCount}</span><span class="cmd-stat-label">Skills</span></div>
      <div class="cmd-stat"><span class="cmd-stat-value">${taskCount}</span><span class="cmd-stat-label">Tasks</span></div>
    `;
    left.appendChild(stats);

    // Current task
    const tasks = a._tasks || [];
    const current = tasks.find(t => t.status === 'in-progress') || tasks[0];
    if (current) {
      const statusColors = { pending: '#ffd93d', accepted: '#74b9ff', 'in-progress': '#00e676', blocked: '#ff6b6b' };
      const c = statusColors[current.status] || '#636e72';
      const ct = document.createElement('div');
      ct.className = 'cmd-current-task';
      ct.innerHTML = `
        <div class="cmd-current-task-label">Current Task</div>
        <div class="cmd-current-task-title">${esc(current.title)}</div>
        <div class="cmd-current-task-status" style="color:${c}">${current.status} &middot; ${current.priority}</div>
      `;
      left.appendChild(ct);
    }

    // Hierarchy
    if (a._reportsTo || (a._directReports && a._directReports.length)) {
      const sec = document.createElement('div');
      sec.className = 'cmd-hud-section';
      sec.innerHTML = '<div class="cmd-hud-section-label">Hierarchy</div>';
      if (a._reportsTo) {
        const tag = document.createElement('span');
        tag.className = 'cmd-tag';
        tag.textContent = '\u25B2 ' + a._reportsTo;
        tag.addEventListener('click', () => { if (this._onNavigate) this._onNavigate(a._reportsTo); });
        sec.appendChild(tag);
      }
      for (const r of (a._directReports || [])) {
        const tag = document.createElement('span');
        tag.className = 'cmd-tag';
        tag.textContent = '\u25BC ' + r;
        tag.addEventListener('click', () => { if (this._onNavigate) this._onNavigate(r); });
        sec.appendChild(tag);
      }
      left.appendChild(sec);
    }

    // Teams
    if (a._teams && a._teams.length) {
      const sec = document.createElement('div');
      sec.className = 'cmd-hud-section';
      sec.innerHTML = '<div class="cmd-hud-section-label">Teams</div>';
      for (const t of a._teams) {
        const tag = document.createElement('span');
        tag.className = 'cmd-tag' + (t.type === 'admin' ? ' gold' : '');
        tag.textContent = (t.type === 'admin' ? '\u2605 ' : '') + t.name;
        tag.title = `Role: ${t.role || '-'} | Type: ${t.type}`;
        sec.appendChild(tag);
      }
      left.appendChild(sec);
    }

    // Nav arrows
    const nav = document.createElement('div');
    nav.className = 'cmd-nav';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'cmd-nav-btn';
    prevBtn.textContent = '\u25C0';
    prevBtn.title = 'Previous agent';
    prevBtn.addEventListener('click', () => { if (this._onNavigate) this._onNavigate(-1); });
    const nextBtn = document.createElement('button');
    nextBtn.className = 'cmd-nav-btn';
    nextBtn.textContent = '\u25B6';
    nextBtn.title = 'Next agent';
    nextBtn.addEventListener('click', () => { if (this._onNavigate) this._onNavigate(+1); });
    const navLabel = document.createElement('span');
    navLabel.className = 'cmd-nav-label';
    navLabel.textContent = a._navLabel || '';
    nav.appendChild(prevBtn);
    nav.appendChild(navLabel);
    nav.appendChild(nextBtn);
    left.appendChild(nav);
  }

  // ── Tab renderers ──

  _renderProfileTab(content) {
    const a = this._agent;
    const form = document.createElement('div');
    form.className = 'cmd-form';
    form.innerHTML = `
      <div class="cmd-form-row">
        <span class="cmd-label">SLUG</span>
        <input class="cmd-input" data-field="slug" value="${esc(a.slug || '')}" readonly />
        <span class="cmd-label" style="min-width:auto">POOL</span>
        <input class="cmd-input" data-field="pool_size" type="number" value="${a.pool_size || 1}" style="width:50px;flex:none" />
      </div>
      <div class="cmd-form-row">
        <span class="cmd-label">NAME</span>
        <input class="cmd-input" data-field="name" value="${esc(a.name || '')}" />
      </div>
      <div class="cmd-form-row">
        <span class="cmd-label">ROLE</span>
        <input class="cmd-input" data-field="role" value="${esc(a.role || '')}" />
      </div>
      <div class="cmd-form-row wide">
        <span class="cmd-label">CONTEXT PACK</span>
        <textarea class="cmd-textarea" data-field="context_pack" rows="2">${esc(a.context_pack || '')}</textarea>
      </div>
      <div class="cmd-form-row wide">
        <span class="cmd-label">VAULT PATHS</span>
        <textarea class="cmd-textarea" data-field="vault_paths" rows="1">${esc(a.vault_paths || '')}</textarea>
      </div>
      <div class="cmd-form-row wide">
        <span class="cmd-label">ALLOWED TOOLS</span>
        <textarea class="cmd-textarea" data-field="allowed_tools" rows="1">${esc(a.allowed_tools || '')}</textarea>
      </div>
      <div class="cmd-form-row"><button class="cmd-btn primary" id="cmd-save-profile-btn">Save Profile</button></div>
    `;
    content.appendChild(form);
    content.querySelector('#cmd-save-profile-btn').addEventListener('click', () => this._doSaveProfile(form));
  }

  async _doSaveProfile(form) {
    const get = (f) => form.querySelector(`[data-field="${f}"]`)?.value?.trim() || '';
    const slug = this._agent.slug || this._agent.name;
    await this._client.updateProfile(slug, {
      name: get('name'), role: get('role'), context_pack: get('context_pack'),
      vault_paths: get('vault_paths'), allowed_tools: get('allowed_tools'),
      pool_size: parseInt(get('pool_size')) || 1, project: this._project,
    });
  }

  _renderSkillsTab(content) {
    const skills = this._agent._skills || [];
    if (skills.length === 0) {
      content.innerHTML = '<div class="cmd-empty">No skills registered</div>';
    } else {
      for (const sk of skills) {
        const item = document.createElement('div');
        item.className = 'cmd-skill-entry';
        const hasDesc = sk.description && sk.description.trim();
        const preview = hasDesc ? (sk.description.length > 80 ? sk.description.slice(0, 78) + '...' : sk.description.split('\n')[0]) : '';
        item.innerHTML = `
          <div class="cmd-skill-header" data-toggle-skill="${esc(sk.name)}">
            <span class="cmd-skill-chevron">${hasDesc ? '\u25B6' : '\u2022'}</span>
            <span class="cmd-skill-name">${esc(sk.name)}</span>
            ${preview ? `<span class="cmd-skill-preview">${esc(preview)}</span>` : ''}
            <button class="cmd-btn danger" data-del-skill="${esc(sk.name)}" style="padding:1px 6px;font-size:8px">x</button>
          </div>
          <div class="cmd-skill-body" data-skill-body="${esc(sk.name)}" style="display:none">
            <pre class="cmd-skill-md">${esc(sk.description || '')}</pre>
          </div>
        `;
        content.appendChild(item);
      }
      // Toggle expand/collapse
      content.querySelectorAll('[data-toggle-skill]').forEach(header => {
        header.addEventListener('click', (e) => {
          if (e.target.dataset.delSkill) return; // don't toggle on delete click
          const name = header.dataset.toggleSkill;
          const body = content.querySelector(`[data-skill-body="${name}"]`);
          const chevron = header.querySelector('.cmd-skill-chevron');
          if (body.style.display === 'none') {
            body.style.display = 'block';
            chevron.textContent = '\u25BC';
          } else {
            body.style.display = 'none';
            chevron.textContent = '\u25B6';
          }
        });
      });
      content.querySelectorAll('[data-del-skill]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await this._client.deleteSkill(btn.dataset.delSkill, this._project);
          this._renderAgentPanel();
        });
      });
    }
    // Add skill form
    const addBtn = document.createElement('button');
    addBtn.className = 'cmd-btn';
    addBtn.textContent = '+ Skill';
    addBtn.style.marginTop = '8px';
    addBtn.addEventListener('click', () => {
      if (content.querySelector('.cmd-inline-form')) return;
      const f = document.createElement('div');
      f.className = 'cmd-inline-form';
      f.innerHTML = `<div class="cmd-form">
        <div class="cmd-form-row">
          <span class="cmd-label">NAME</span>
          <input class="cmd-input" data-field="skill-name" placeholder="e.g. deploy-pipeline" />
        </div>
        <div class="cmd-form-row wide">
          <span class="cmd-label">CONTENT</span>
          <textarea class="cmd-textarea cmd-skill-textarea" data-field="skill-desc" rows="10" placeholder="Paste full .md skill definition here..."></textarea>
        </div>
        <div class="cmd-form-row">
          <button class="cmd-btn primary" id="cmd-add-skill-btn">Add Skill</button>
        </div></div>`;
      content.appendChild(f);
      f.querySelector('#cmd-add-skill-btn').addEventListener('click', async () => {
        const name = f.querySelector('[data-field="skill-name"]').value.trim();
        const desc = f.querySelector('[data-field="skill-desc"]').value;
        if (!name) return;
        const slug = this._agent.slug || this._agent.name;
        await this._client.createSkill({ name, description: desc, proficiency: 3, agent: slug, project: this._project });
        const skills = await this._client.fetchSkills(this._project, slug);
        this._agent._skills = skills;
        this._renderAgentPanel();
      });
    });
    content.appendChild(addBtn);
  }

  _renderQuotasTab(content) {
    const q = this._agent._quota || {};
    const fields = [
      { key: 'max_tokens_per_day', label: 'Tokens/Day', used: q.tokens_today || 0 },
      { key: 'max_messages_per_hour', label: 'Msgs/Hour', used: q.messages_this_hour || 0 },
      { key: 'max_tasks_per_hour', label: 'Tasks/Hour', used: q.tasks_this_hour || 0 },
      { key: 'max_spawns_per_hour', label: 'Spawns/Hour', used: q.spawns_this_hour || 0 },
    ];
    const form = document.createElement('div');
    form.className = 'cmd-form';
    for (const f of fields) {
      const limit = q[f.key] || 0;
      const pct = limit > 0 ? Math.min(100, (f.used / limit) * 100) : 0;
      const color = pct > 80 ? '#ff6b6b' : pct > 50 ? '#ffd93d' : '#00e676';
      const row = document.createElement('div');
      row.className = 'cmd-quota-row';
      row.innerHTML = `
        <span class="cmd-quota-label">${f.label}</span>
        <div class="cmd-quota-bar-bg"><div class="cmd-quota-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <input class="cmd-input" data-field="${f.key}" type="number" value="${limit}" style="width:65px;flex:none;text-align:right" />
      `;
      form.appendChild(row);
    }
    const saveRow = document.createElement('div');
    saveRow.className = 'cmd-form-row';
    saveRow.innerHTML = '<button class="cmd-btn primary" id="cmd-save-quotas-btn">Save Quotas</button>';
    form.appendChild(saveRow);
    content.appendChild(form);
    content.querySelector('#cmd-save-quotas-btn').addEventListener('click', async () => {
      const get = (f) => parseInt(form.querySelector(`[data-field="${f}"]`)?.value) || 0;
      const slug = this._agent.slug || this._agent.name;
      await this._client.updateAgentQuota(slug, {
        project: this._project,
        max_tokens_per_day: get('max_tokens_per_day'), max_messages_per_hour: get('max_messages_per_hour'),
        max_tasks_per_hour: get('max_tasks_per_hour'), max_spawns_per_hour: get('max_spawns_per_hour'),
      });
    });
  }

  async _renderSchedulesTab(content) {
    const slug = this._agent.slug || this._agent.name;
    const schedules = await this._client.fetchAgentSchedules(this._project, slug);
    if (!schedules || schedules.length === 0) {
      content.innerHTML = '<div class="cmd-empty">No schedules</div>';
    } else {
      for (const s of schedules) {
        const item = document.createElement('div');
        item.className = 'cmd-list-item';
        item.innerHTML = `
          <span class="cmd-list-name">${esc(s.name || s.id)}</span>
          <span class="cmd-list-meta">${esc(s.cron_expr)} &middot; ${esc(s.cycle || '-')}</span>
          <div class="cmd-list-actions">
            <button class="cmd-btn success" data-trigger="${s.id}">Run</button>
            <button class="cmd-btn danger" data-del="${s.id}">Del</button>
          </div>
        `;
        content.appendChild(item);
      }
      content.querySelectorAll('[data-trigger]').forEach(b => b.addEventListener('click', () => this._client.triggerSchedule(b.dataset.trigger)));
      content.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => { await this._client.deleteSchedule(b.dataset.del); this._renderAgentPanel(); }));
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'cmd-btn';
    addBtn.textContent = '+ Schedule';
    addBtn.style.marginTop = '8px';
    addBtn.addEventListener('click', () => {
      if (content.querySelector('.cmd-inline-form')) return;
      const cycleOpts = this._cycles.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
      const f = document.createElement('div');
      f.className = 'cmd-inline-form';
      f.innerHTML = `<div class="cmd-form">
        <div class="cmd-form-row">
          <span class="cmd-label">CRON</span><input class="cmd-input" data-field="sched-cron" placeholder="*/30 * * * *" />
          <span class="cmd-label" style="min-width:auto">CYCLE</span>
          <select class="cmd-select" data-field="sched-cycle" style="width:90px;flex:none"><option value="">--</option>${cycleOpts}</select>
          <button class="cmd-btn primary" id="cmd-add-sched-btn">Create</button>
        </div></div>`;
      content.appendChild(f);
      f.querySelector('#cmd-add-sched-btn').addEventListener('click', async () => {
        const cron_expr = f.querySelector('[data-field="sched-cron"]').value.trim();
        const cycle = f.querySelector('[data-field="sched-cycle"]').value;
        if (!cron_expr) return;
        await this._client.createSchedule({ agent: slug, project: this._project, name: '', cron_expr, cycle, ttl: '' });
        this._renderAgentPanel();
      });
    });
    content.appendChild(addBtn);
  }

  _renderCommsTab(content) {
    const msgs = this._agent._recentMsgs || [];
    if (msgs.length === 0) {
      content.innerHTML = '<div class="cmd-empty">No recent messages</div>';
      return;
    }
    for (const m of msgs) {
      const isSent = m.from === (this._agent.slug || this._agent.name);
      const peer = isSent ? (m.to || 'broadcast') : m.from;
      const dir = isSent ? '\u2192' : '\u2190';
      const dirColor = isSent ? '#a29bfe' : '#74b9ff';
      const preview = m.content.length > 80 ? m.content.slice(0, 78) + '...' : m.content;
      const item = document.createElement('div');
      item.className = 'cmd-msg-item';
      item.innerHTML = `
        <span class="cmd-msg-dir" style="color:${dirColor}">${dir}</span>
        <span class="cmd-msg-peer">${esc(peer)}</span>
        <span class="cmd-msg-preview">${esc(preview)}</span>
        <span class="cmd-msg-time">${timeAgo(m.created_at)}</span>
      `;
      content.appendChild(item);
    }
  }

  _renderTasksTab(content) {
    const tasks = this._agent._tasks || [];
    if (tasks.length === 0) {
      content.innerHTML = '<div class="cmd-empty">No active tasks</div>';
      return;
    }
    const statusColors = { pending: '#ffd93d', accepted: '#74b9ff', 'in-progress': '#00e676', blocked: '#ff6b6b' };
    for (const t of tasks) {
      const c = statusColors[t.status] || '#636e72';
      const item = document.createElement('div');
      item.className = 'cmd-list-item';
      item.innerHTML = `
        <span style="color:${c};font-size:9px;font-weight:700;min-width:70px">${t.status}</span>
        <span class="cmd-list-name">${esc(t.title.length > 50 ? t.title.slice(0, 48) + '...' : t.title)}</span>
        <span class="cmd-list-meta">${t.priority}</span>
      `;
      content.appendChild(item);
    }
  }

  _renderTerminalTab(content) {
    if (!this._termSessionId) {
      content.innerHTML = `<div class="cmd-empty">
        No terminal session.<br>
        <span style="color:#5a5e78;font-size:8px">Click "Spawn Terminal" to start an interactive agent.</span>
      </div>`;
      return;
    }

    // Make content a flex column so the terminal fills it
    content.style.cssText += 'display:flex;flex-direction:column;padding:4px;';

    // If we already have a persistent terminal box, just re-attach it
    if (this._termBox) {
      content.appendChild(this._termBox);
      this._termBox.style.display = 'flex';
      // Re-fit after re-attach
      requestAnimationFrame(() => { if (this._termFit) this._termFit.fit(); });
      return;
    }

    // First time: create the persistent terminal box + xterm instance
    const termBox = document.createElement('div');
    termBox.id = 'cmd-xterm';
    termBox.style.cssText = 'flex:1;min-height:0;width:100%;display:flex;';
    this._termBox = termBox;
    content.appendChild(termBox);

    requestAnimationFrame(() => {
      const Terminal = window.Terminal;
      const FitAddon = window.FitAddon?.FitAddon;
      if (!Terminal) {
        termBox.innerHTML = '<div class="cmd-empty" style="color:#ff6b6b">xterm.js not loaded</div>';
        return;
      }

      const term = new Terminal({
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        theme: {
          background: '#0a0a1a',
          foreground: '#c8ccd4',
          cursor: '#a29bfe',
          cursorAccent: '#0a0a1a',
          selectionBackground: 'rgba(162, 155, 254, 0.3)',
          black: '#0a0a12',
          red: '#ff6b6b',
          green: '#00e676',
          yellow: '#ffd93d',
          blue: '#74b9ff',
          magenta: '#a29bfe',
          cyan: '#00cec9',
          white: '#c8ccd4',
          brightBlack: '#636e72',
          brightRed: '#ff6b6b',
          brightGreen: '#00e676',
          brightYellow: '#ffd93d',
          brightBlue: '#74b9ff',
          brightMagenta: '#d4cfff',
          brightCyan: '#00cec9',
          brightWhite: '#e0e0e8',
        },
        cursorBlink: true,
        scrollback: 5000,
        convertEol: true,
      });

      term.open(termBox);

      if (FitAddon) {
        const fit = new FitAddon();
        term.loadAddon(fit);
        fit.fit();
        this._termFit = fit;
        // Re-fit whenever the box resizes (panel drag, window resize)
        const ro = new ResizeObserver(() => fit.fit());
        ro.observe(termBox);
      }

      this._terminal = term;

      // Connect WebSocket
      const wsUrl = this._client.terminalWsUrl(this._termSessionId);
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      this._termWs = ws;

      ws.onopen = () => {
        term.writeln('\x1b[38;5;141m// Connected to agent terminal\x1b[0m');
        ws.send(JSON.stringify({ type: 'resize', rows: term.rows, cols: term.cols }));
      };

      ws.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(ev.data));
        } else {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'exit') {
              term.writeln('\r\n\x1b[38;5;203m// Process exited\x1b[0m');
              this._termSessionId = null;
            }
          } catch {
            term.write(ev.data);
          }
        }
      };

      ws.onclose = () => {
        term.writeln('\r\n\x1b[38;5;243m// Connection closed\x1b[0m');
      };

      ws.onerror = () => {
        term.writeln('\r\n\x1b[38;5;203m// WebSocket error\x1b[0m');
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      term.onResize(({ rows, cols }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', rows, cols }));
        }
      });
    });
  }

  // ── Actions ──

  async _doSpawn() {
    const slug = this._agent.slug || this._agent.name;
    return await this._client.spawnWithContext({ project: this._project, profile: slug });
  }

  async _doDeleteAgent() {
    const slug = this._agent.slug || this._agent.name;
    if (!confirm(`Delete agent "${slug}"?`)) return;
    await this._client.deleteProfile(slug, this._project);
    this.clearAgent();
  }

  async _doSendMessage(form) {
    const get = (f) => form.querySelector(`[data-field="${f}"]`)?.value?.trim() || '';
    const to = get('to');
    const content = get('content');
    if (!to || !content) return;
    await this._client.sendUserResponse(this._project, to, content, null);
    this._msgFormOpen = false;
    this._renderAgentPanel();
  }

  // ── Resize ──

  _initResize() {
    let startY = 0, startH = 0, active = false;
    const onMove = (e) => {
      if (!active) return;
      const dy = startY - e.clientY;
      const newH = Math.max(120, Math.min(window.innerHeight * 0.6, startH + dy));
      this._container.style.height = newH + 'px';
      window.dispatchEvent(new Event('resize'));
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    this._resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      active = true;
      startY = e.clientY;
      startH = this._container.offsetHeight;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}
