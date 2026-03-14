// ops.js — Ops Console: OS Primitives (triggers, polls, skills, quotas, flows)
// Pixel art management aesthetic — purple neon on dark

import { FlowEditor } from './flow-editor.js';

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function fmtTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const OPS_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');

@keyframes slideIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes formIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

.ops-root {
  font-family: 'JetBrains Mono', monospace;
  background: #0a0a12;
  color: #dfe6e9;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ── Sub-tab bar ── */
.ops-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(108, 92, 231, 0.2);
  flex-shrink: 0;
  padding: 0 20px;
  background: rgba(15, 15, 26, 0.95);
}
.ops-tab {
  padding: 10px 18px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #636e72;
  cursor: pointer;
  border: none;
  background: none;
  position: relative;
  transition: all 0.15s;
  font-family: inherit;
  border-radius: 2px;
}
.ops-tab:hover {
  color: #a29bfe;
  border-color: rgba(108, 92, 231, 0.4);
}
.ops-tab.active {
  color: #6c5ce7;
  text-shadow: 0 0 6px rgba(108, 92, 231, 0.4);
}
.ops-tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 4px;
  right: 4px;
  height: 2px;
  background: #6c5ce7;
  box-shadow: 0 0 8px rgba(108, 92, 231, 0.5);
}

/* ── Content area ── */
.ops-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
}
.ops-content::-webkit-scrollbar { width: 4px; }
.ops-content::-webkit-scrollbar-track { background: transparent; }
.ops-content::-webkit-scrollbar-thumb { background: rgba(108, 92, 231, 0.3); border-radius: 2px; }

/* ── Common card ── */
.ops-card {
  background: rgba(30, 30, 50, 0.6);
  border: 1px solid rgba(108, 92, 231, 0.15);
  border-radius: 3px;
  padding: 10px 12px;
  margin-bottom: 10px;
  transition: all 0.15s;
  animation: slideIn 0.25s ease-out;
}
.ops-card:hover {
  border-color: rgba(108, 92, 231, 0.4);
  box-shadow: 0 0 10px rgba(108, 92, 231, 0.15);
  transform: translateY(-1px);
}
.ops-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ops-card-title {
  font-size: 12px;
  font-weight: 700;
  color: #dfe6e9;
}
.ops-card-subtitle {
  font-size: 9px;
  color: #636e72;
  margin-top: 2px;
}

/* ── Buttons (aligned with kb-add-btn / kb-form-btn) ── */
.ops-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 6px 14px;
  border: 1px solid rgba(108, 92, 231, 0.35);
  background: rgba(108, 92, 231, 0.15);
  color: #6c5ce7;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s;
}
.ops-btn:hover {
  background: rgba(108, 92, 231, 0.3);
  box-shadow: 0 0 12px rgba(108, 92, 231, 0.4);
}
.ops-btn-danger {
  color: #ff6b6b;
  border-color: rgba(255, 107, 107, 0.35);
  background: rgba(255, 107, 107, 0.1);
}
.ops-btn-danger:hover {
  background: rgba(255, 107, 107, 0.2);
  border-color: rgba(255, 107, 107, 0.6);
  box-shadow: 0 0 12px rgba(255, 107, 107, 0.3);
}
.ops-btn-success {
  color: #00e676;
  border-color: rgba(0, 230, 118, 0.35);
  background: rgba(0, 230, 118, 0.1);
}
.ops-btn-success:hover {
  background: rgba(0, 230, 118, 0.2);
  border-color: rgba(0, 230, 118, 0.6);
  box-shadow: 0 0 12px rgba(0, 230, 118, 0.3);
}
.ops-btn-sm { padding: 3px 8px; font-size: 9px; }

/* ── Badge / pill ── */
.ops-badge {
  display: inline-block;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 2px;
  text-transform: uppercase;
}
.ops-badge-green  { color: #00e676; background: rgba(0, 230, 118, 0.12); }
.ops-badge-red    { color: #ff6b6b; background: rgba(255, 107, 107, 0.12); }
.ops-badge-yellow { color: #ffd93d; background: rgba(255, 217, 61, 0.12); }
.ops-badge-gray   { color: #636e72; background: rgba(99, 110, 114, 0.12); }
.ops-badge-purple { color: #a29bfe; background: rgba(162, 155, 254, 0.12); }

/* ── Toggle switch ── */
.ops-toggle {
  position: relative;
  width: 28px;
  height: 14px;
  background: rgba(99, 110, 114, 0.3);
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.ops-toggle.on { background: rgba(0, 230, 118, 0.3); }
.ops-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #636e72;
  transition: all 0.2s;
}
.ops-toggle.on::after {
  left: 16px;
  background: #00e676;
  box-shadow: 0 0 4px #00e676;
}

/* ── Triggers layout ── */
.ops-triggers-layout {
  display: flex;
  gap: 16px;
  height: 100%;
}
.ops-triggers-rules {
  flex: 7;
  overflow-y: auto;
}
.ops-triggers-history {
  flex: 3;
  overflow-y: auto;
  border-left: 1px solid rgba(108, 92, 231, 0.12);
  padding-left: 16px;
}
.ops-history-title {
  font-size: 10px;
  font-weight: 700;
  color: #6c5ce7;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 10px;
  text-shadow: 0 0 8px rgba(108, 92, 231, 0.4);
}
.ops-history-item {
  padding: 6px 8px;
  margin-bottom: 6px;
  background: rgba(30, 30, 50, 0.4);
  border-left: 2px solid rgba(108, 92, 231, 0.15);
  border-radius: 2px;
  font-size: 9px;
  animation: slideIn 0.2s ease-out;
}
.ops-history-item.success { border-left-color: #00e676; }
.ops-history-item.error { border-left-color: #ff6b6b; }
.ops-history-time {
  color: #4a4e60;
  font-size: 8px;
}
.ops-history-event {
  color: #a29bfe;
  font-weight: 600;
}
.ops-history-child {
  color: #74b9ff;
  cursor: pointer;
}
.ops-history-child:hover { text-decoration: underline; }
.ops-history-error {
  color: #ff6b6b;
  font-size: 8px;
  margin-top: 2px;
}

/* ── Inline forms (aligned with kb-form / kb-field) ── */
.ops-form {
  background: rgba(15, 15, 26, 0.98);
  border: 1px solid rgba(108, 92, 231, 0.3);
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 12px;
  animation: formIn 0.2s ease-out;
  box-shadow: 0 0 30px rgba(108, 92, 231, 0.15);
}
.ops-form-row {
  margin-bottom: 12px;
}
.ops-form-label {
  font-size: 10px;
  color: #636e72;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 4px;
  display: block;
}
.ops-form input, .ops-form select, .ops-form textarea {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  background: rgba(30, 30, 50, 0.6);
  color: #dfe6e9;
  border: 1px solid rgba(108, 92, 231, 0.2);
  border-radius: 2px;
  padding: 7px 10px;
  width: 100%;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.ops-form input:focus, .ops-form select:focus, .ops-form textarea:focus {
  border-color: rgba(108, 92, 231, 0.6);
  box-shadow: 0 0 8px rgba(108, 92, 231, 0.2);
}
.ops-form textarea { resize: vertical; min-height: 60px; }
.ops-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* ── Empty state ── */
.ops-empty {
  text-align: center;
  padding: 40px 20px;
  color: #636e72;
  font-size: 10px;
  letter-spacing: 1px;
}
.ops-empty-icon {
  font-size: 24px;
  margin-bottom: 10px;
  opacity: 0.25;
  color: #6c5ce7;
}

/* ── Trigger card specifics ── */
.ops-trigger-event {
  font-size: 11px;
  color: #6c5ce7;
  font-weight: 700;
  text-shadow: 0 0 6px rgba(108, 92, 231, 0.3);
}
.ops-trigger-meta {
  font-size: 9px;
  color: #636e72;
  margin-top: 6px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.ops-trigger-meta span { white-space: nowrap; }
.ops-trigger-rules {
  font-size: 9px;
  color: #dfe6e9;
  margin-top: 6px;
  background: rgba(15, 15, 26, 0.6);
  border: 1px solid rgba(108, 92, 231, 0.1);
  padding: 6px 8px;
  border-radius: 2px;
  overflow-x: auto;
  white-space: pre-wrap;
  max-height: 80px;
}
.ops-trigger-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* ── Poll card ── */
.ops-poll-url {
  font-size: 9px;
  color: #636e72;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 400px;
}
.ops-poll-condition {
  font-size: 9px;
  color: #8890a4;
  margin-top: 4px;
}
.ops-poll-result {
  display: inline-block;
  margin-left: 8px;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 2px;
  animation: formIn 0.2s ease;
}

/* ── Skills ── */
.ops-skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.ops-skill-tag {
  font-size: 8px;
  padding: 2px 6px;
  background: rgba(162, 155, 254, 0.08);
  border: 1px solid rgba(162, 155, 254, 0.15);
  border-radius: 2px;
  color: #a29bfe;
}
.ops-skill-agents {
  font-size: 9px;
  color: #636e72;
  margin-top: 6px;
}
.ops-skill-profiles {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(108, 92, 231, 0.1);
}
.ops-skill-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 10px;
}
.ops-skill-profile-name {
  color: #dfe6e9;
  font-weight: 600;
  min-width: 100px;
}
.ops-proficiency-dots {
  display: flex;
  gap: 3px;
}
.ops-proficiency-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(108, 92, 231, 0.15);
  border: 1px solid rgba(108, 92, 231, 0.2);
}
.ops-proficiency-dot.filled {
  background: #a29bfe;
  border-color: #a29bfe;
  box-shadow: 0 0 4px rgba(162, 155, 254, 0.4);
}

/* ── Discover result ── */
.ops-discover-result {
  margin-top: 8px;
  padding: 8px;
  background: rgba(10, 10, 18, 0.5);
  border-radius: 2px;
  border-left: 2px solid rgba(0, 230, 118, 0.3);
}
.ops-discover-agent {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 10px;
}
.ops-discover-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ops-discover-dot.active { background: #00e676; box-shadow: 0 0 4px #00e676; }
.ops-discover-dot.inactive { background: #636e72; }
.ops-discover-name {
  color: #74b9ff;
  cursor: pointer;
}
.ops-discover-name:hover { text-decoration: underline; }
.ops-discover-role {
  color: #5a5e78;
  font-size: 9px;
}

/* ── Quotas table ── */
.ops-quota-table {
  width: 100%;
  border-collapse: collapse;
}
.ops-quota-table th {
  font-size: 9px;
  color: #636e72;
  letter-spacing: 1px;
  text-transform: uppercase;
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(108, 92, 231, 0.2);
}
.ops-quota-table td {
  padding: 8px 10px;
  font-size: 10px;
  border-bottom: 1px solid rgba(108, 92, 231, 0.08);
}
.ops-quota-table tr { transition: background 0.15s; cursor: pointer; }
.ops-quota-table tr:hover { background: rgba(108, 92, 231, 0.05); }
.ops-quota-table tr.warning { background: rgba(255, 107, 107, 0.04); }
.ops-quota-table tr.warning:hover { background: rgba(255, 107, 107, 0.08); }

.ops-quota-agent {
  color: #dfe6e9;
  font-weight: 600;
}

/* ── Health bar (10 segments, Zelda hearts style) ── */
.ops-health-bar {
  display: flex;
  gap: 2px;
  align-items: center;
}
.ops-health-seg {
  width: 8px;
  height: 10px;
  background: rgba(30, 30, 50, 0.6);
  border: 1px solid rgba(108, 92, 231, 0.15);
  border-radius: 0;
  transition: all 0.15s;
  image-rendering: pixelated;
}
.ops-health-seg.filled { background: #00e676; border-color: rgba(0, 230, 118, 0.6); box-shadow: 0 0 3px rgba(0, 230, 118, 0.4); }
.ops-health-seg.warn   { background: #ffd93d; border-color: rgba(255, 217, 61, 0.6); box-shadow: 0 0 3px rgba(255, 217, 61, 0.4); }
.ops-health-seg.danger { background: #ff6b6b; border-color: rgba(255, 107, 107, 0.6); box-shadow: 0 0 4px rgba(255, 107, 107, 0.5); }
.ops-quota-text {
  font-size: 8px;
  color: #5a5e78;
  margin-left: 6px;
  white-space: nowrap;
}
.ops-quota-warning {
  color: #ffd93d;
  font-size: 10px;
  margin-left: 4px;
}

/* ── Elevation section in detail ── */
.ops-elevation-active {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 215, 0, 0.06);
  border-left: 2px solid rgba(255, 215, 0, 0.4);
  border-radius: 2px;
  margin-bottom: 6px;
}
.ops-elevation-role {
  font-size: 11px;
  font-weight: 700;
  color: #ffd700;
}
.ops-elevation-countdown {
  font-size: 9px;
  color: #5a5e78;
  margin-left: auto;
}
.ops-elevation-granted-by {
  font-size: 8px;
  color: #5a5e78;
}

/* ── Agents tab — master/detail layout ── */
.ops-agents-layout {
  display: flex;
  gap: 0;
  height: 100%;
}
.ops-agents-list {
  width: 240px;
  min-width: 200px;
  overflow-y: auto;
  border-right: 1px solid rgba(108, 92, 231, 0.12);
  padding-right: 12px;
  flex-shrink: 0;
}
.ops-agents-detail {
  flex: 1;
  overflow-y: auto;
  padding-left: 16px;
}
.ops-agent-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}
.ops-agent-row:hover {
  background: rgba(108, 92, 231, 0.08);
  border-color: rgba(108, 92, 231, 0.2);
}
.ops-agent-row.selected {
  background: rgba(108, 92, 231, 0.12);
  border-color: rgba(108, 92, 231, 0.35);
}
.ops-agent-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ops-agent-dot.active { background: #00e676; box-shadow: 0 0 4px #00e676; }
.ops-agent-dot.sleeping { background: #ffd93d; box-shadow: 0 0 4px rgba(255,217,61,0.4); }
.ops-agent-dot.inactive { background: #636e72; }
.ops-agent-name {
  font-size: 11px;
  font-weight: 600;
  color: #dfe6e9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ops-agent-role-sm {
  font-size: 8px;
  color: #636e72;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Agent detail sections ── */
.ops-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(108, 92, 231, 0.15);
}
.ops-detail-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ops-detail-dot.active { background: #00e676; box-shadow: 0 0 6px #00e676; }
.ops-detail-dot.sleeping { background: #ffd93d; box-shadow: 0 0 6px rgba(255,217,61,0.5); }
.ops-detail-dot.inactive { background: #636e72; }
.ops-detail-name {
  font-size: 16px;
  font-weight: 700;
  color: #dfe6e9;
}
.ops-detail-role {
  font-size: 10px;
  color: #a29bfe;
  margin-top: 2px;
}
.ops-detail-section {
  margin-bottom: 16px;
}
.ops-detail-section-title {
  font-size: 9px;
  font-weight: 700;
  color: #6c5ce7;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 8px;
  text-shadow: 0 0 6px rgba(108, 92, 231, 0.3);
}
.ops-detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 10px;
}
.ops-detail-label {
  color: #636e72;
  min-width: 90px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.ops-detail-value {
  color: #dfe6e9;
}
.ops-detail-empty {
  text-align: center;
  padding: 60px 20px;
  color: #4a4e60;
  font-size: 10px;
  letter-spacing: 1px;
}

/* ── Profile section tab bar ── */
.ops-profile-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(108, 92, 231, 0.12);
}
.ops-profile-tab {
  padding: 6px 12px;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 1px;
  color: #4a4e60;
  cursor: pointer;
  border: none;
  background: none;
  font-family: inherit;
  transition: color 0.15s;
}
.ops-profile-tab:hover { color: #a29bfe; }
.ops-profile-tab.active {
  color: #6c5ce7;
  border-bottom: 1px solid #6c5ce7;
  margin-bottom: -1px;
}

/* ── Scrollbar ── */
.ops-root ::-webkit-scrollbar { width: 4px; }
.ops-root ::-webkit-scrollbar-track { background: transparent; }
.ops-root ::-webkit-scrollbar-thumb { background: rgba(108, 92, 231, 0.2); border-radius: 2px; }
`;

export class OpsConsole {
  constructor(container) {
    this.container = container;
    this.project = null;
    this.activeTab = 'agents';
    this._timers = [];
    this._visible = false;
    this.onAgentClick = null; // callback(project, name) to open agent detail

    // API client set externally
    this.client = null;
    this.agents = []; // agent list for discovery
  }

  show(project) {
    this.project = project;
    this._visible = true;
    this.container.classList.remove('hidden');
    this._build();
    this._switchTab(this.activeTab);
  }

  hide() {
    this._visible = false;
    this.container.classList.add('hidden');
    this._clearTimers();
    if (this._flowEditor) this._flowEditor.hide();
  }

  _clearTimers() {
    this._timers.forEach(t => clearInterval(t));
    this._timers = [];
  }

  _build() {
    this._clearTimers();
    this.container.innerHTML = '';

    const shadow = this.container.attachShadow
      ? null // don't use shadow DOM, keep it simple
      : null;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = OPS_STYLES;
    this.container.appendChild(style);

    const root = document.createElement('div');
    root.className = 'ops-root';

    // Tab bar
    const tabs = document.createElement('div');
    tabs.className = 'ops-tabs';
    const tabDefs = [
      { id: 'agents', label: 'AGENTS' },
      { id: 'triggers', label: 'TRIGGERS' },
      { id: 'polls', label: 'POLLS' },
      { id: 'cycles', label: 'CYCLES' },
      { id: 'flows', label: 'FLOWS' },
    ];
    for (const t of tabDefs) {
      const btn = document.createElement('button');
      btn.className = `ops-tab${t.id === this.activeTab ? ' active' : ''}`;
      btn.textContent = t.label;
      btn.dataset.tab = t.id;
      btn.addEventListener('click', () => this._switchTab(t.id));
      tabs.appendChild(btn);
    }
    root.appendChild(tabs);

    // Content area
    const content = document.createElement('div');
    content.className = 'ops-content';
    this._contentEl = content;
    root.appendChild(content);

    this.container.appendChild(root);
  }

  _switchTab(tabId) {
    this.activeTab = tabId;
    this._clearTimers();

    // Update active state
    const tabs = this.container.querySelectorAll('.ops-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));

    // Render content
    switch (tabId) {
      case 'agents': this._renderAgents(); break;
      case 'triggers': this._renderTriggers(); break;
      case 'polls': this._renderPolls(); break;
      case 'cycles': this._renderCycles(); break;
      case 'flows': this._renderFlows(); break;
    }
  }

  // ═══════════════════════════════════════
  // AGENTS TAB
  // ═══════════════════════════════════════

  async _renderAgents() {
    const content = this._contentEl;
    content.innerHTML = '<div class="ops-empty"><div class="ops-empty-icon">&#9881;</div>Loading agents...</div>';

    const [agents, profiles, skills, quotas, elevations] = await Promise.all([
      this._fetchProjectAgents(),
      this.client.fetchProfiles(this.project),
      this.client.fetchSkills(this.project),
      this.client.fetchQuotas(this.project),
      this.client.fetchElevations(this.project),
    ]);

    content.innerHTML = '';

    if ((!agents || agents.length === 0) && (!profiles || profiles.length === 0)) {
      content.innerHTML = '<div class="ops-empty"><div class="ops-empty-icon">&#9881;</div>No agents or profiles registered</div>';
      return;
    }

    // Build lookup maps
    const profileMap = {};
    for (const p of (profiles || [])) profileMap[p.slug] = p;
    const quotaMap = {};
    for (const q of (quotas || [])) quotaMap[q.agent || q.profile_slug || q.name] = q;
    const elevMap = {};
    for (const e of (elevations || [])) {
      const key = e.agent || e.agent_name;
      if (!elevMap[key]) elevMap[key] = [];
      elevMap[key].push(e);
    }

    // Layout: list (left) + detail (right)
    const layout = document.createElement('div');
    layout.className = 'ops-agents-layout';

    const listCol = document.createElement('div');
    listCol.className = 'ops-agents-list';

    const detailCol = document.createElement('div');
    detailCol.className = 'ops-agents-detail';

    // Section header: Agents
    const agentHeader = document.createElement('div');
    agentHeader.style.cssText = 'font-size:9px;font-weight:700;color:#6c5ce7;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;text-shadow:0 0 6px rgba(108,92,231,0.3)';
    agentHeader.textContent = `AGENTS (${(agents || []).length})`;
    listCol.appendChild(agentHeader);

    // Agent rows
    for (const a of (agents || [])) {
      const row = document.createElement('div');
      row.className = 'ops-agent-row';
      row.dataset.name = a.name;

      const dot = document.createElement('div');
      dot.className = `ops-agent-dot ${a.status || 'inactive'}`;
      row.appendChild(dot);

      const info = document.createElement('div');
      info.style.cssText = 'overflow:hidden;flex:1';
      const nameEl = document.createElement('div');
      nameEl.className = 'ops-agent-name';
      nameEl.textContent = a.name;
      info.appendChild(nameEl);
      if (a.role) {
        const roleEl = document.createElement('div');
        roleEl.className = 'ops-agent-role-sm';
        roleEl.textContent = a.role;
        info.appendChild(roleEl);
      }
      row.appendChild(info);

      if (a.profile_slug) {
        const badge = document.createElement('span');
        badge.className = 'ops-badge ops-badge-purple';
        badge.textContent = a.profile_slug;
        badge.style.flexShrink = '0';
        row.appendChild(badge);
      }

      row.addEventListener('click', () => {
        listCol.querySelectorAll('.ops-agent-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        this._renderAgentDetail(detailCol, a, profileMap, skills || [], quotaMap, elevMap);
      });

      listCol.appendChild(row);
    }

    // Profiles section
    const allProfiles = profiles || [];
    const activeAgentSlugs = new Set((agents || []).filter(a => a.profile_slug).map(a => a.profile_slug));
    const unlinkedProfiles = allProfiles.filter(p => !activeAgentSlugs.has(p.slug));

    const profHeader = document.createElement('div');
    profHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;font-size:9px;font-weight:700;color:#636e72;letter-spacing:1.5px;text-transform:uppercase;margin:16px 0 8px;border-top:1px solid rgba(108,92,231,0.1);padding-top:12px';
    profHeader.innerHTML = `<span>PROFILES (${allProfiles.length})</span>`;
    const addProfBtn = document.createElement('button');
    addProfBtn.className = 'ops-btn ops-btn-sm';
    addProfBtn.textContent = '+ NEW';
    addProfBtn.addEventListener('click', () => {
      listCol.querySelectorAll('.ops-agent-row').forEach(r => r.classList.remove('selected'));
      this._showProfileForm(detailCol, null);
    });
    profHeader.appendChild(addProfBtn);
    listCol.appendChild(profHeader);

    for (const p of unlinkedProfiles) {
      const row = document.createElement('div');
      row.className = 'ops-agent-row';

      const dot = document.createElement('div');
      dot.className = 'ops-agent-dot inactive';
      row.appendChild(dot);

      const info = document.createElement('div');
      info.style.cssText = 'overflow:hidden;flex:1';
      const nameEl = document.createElement('div');
      nameEl.className = 'ops-agent-name';
      nameEl.textContent = p.name || p.slug;
      info.appendChild(nameEl);
      const roleEl = document.createElement('div');
      roleEl.className = 'ops-agent-role-sm';
      roleEl.textContent = p.role || 'profile';
      info.appendChild(roleEl);
      row.appendChild(info);

      row.addEventListener('click', () => {
        listCol.querySelectorAll('.ops-agent-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        this._renderProfileDetail(detailCol, p, skills || [], quotaMap);
      });

      listCol.appendChild(row);
    }

    // Also show linked profiles
    const linkedProfiles = allProfiles.filter(p => activeAgentSlugs.has(p.slug));
    for (const p of linkedProfiles) {
      const row = document.createElement('div');
      row.className = 'ops-agent-row';
      const dot = document.createElement('div');
      dot.className = 'ops-agent-dot active';
      dot.style.cssText = 'width:5px;height:5px';
      row.appendChild(dot);
      const info = document.createElement('div');
      info.style.cssText = 'overflow:hidden;flex:1';
      info.innerHTML = `<div class="ops-agent-name" style="font-size:10px;color:#8890a4">${esc(p.slug)}</div>`;
      row.appendChild(info);
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:7px;color:#4a4e60';
      badge.textContent = 'LINKED';
      row.appendChild(badge);
      row.addEventListener('click', () => {
        listCol.querySelectorAll('.ops-agent-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        this._renderProfileDetail(detailCol, p, skills || [], quotaMap);
      });
      listCol.appendChild(row);
    }

    layout.appendChild(listCol);

    // Default detail view
    detailCol.innerHTML = '<div class="ops-detail-empty">Select an agent or profile</div>';
    layout.appendChild(detailCol);

    content.appendChild(layout);

    // Auto-select first agent
    const firstRow = listCol.querySelector('.ops-agent-row');
    if (firstRow) firstRow.click();
  }

  async _fetchProjectAgents() {
    // Filter all agents by current project
    try {
      const res = await fetch(`/api/agents?project=${encodeURIComponent(this.project)}`);
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  _renderAgentDetail(container, agent, profileMap, skills, quotaMap, elevMap) {
    container.innerHTML = '';

    // Header with actions
    const header = document.createElement('div');
    header.className = 'ops-detail-header';
    const dot = document.createElement('div');
    dot.className = `ops-detail-dot ${agent.status || 'inactive'}`;
    header.appendChild(dot);
    const headerInfo = document.createElement('div');
    headerInfo.style.flex = '1';
    headerInfo.innerHTML = `<div class="ops-detail-name">${esc(agent.name)}</div>
      <div class="ops-detail-role">${esc(agent.role || 'agent')}</div>`;
    header.appendChild(headerInfo);

    const headerRight = document.createElement('div');
    headerRight.style.cssText = 'display:flex;align-items:center;gap:8px';
    const statusBadge = agent.status === 'active' ? 'ops-badge-green' : agent.status === 'sleeping' ? 'ops-badge-yellow' : 'ops-badge-gray';
    headerRight.innerHTML = `<span class="ops-badge ${statusBadge}">${agent.status || 'unknown'}</span>`;

    // Deactivate button
    if (agent.status === 'active' || agent.status === 'sleeping') {
      const deactBtn = document.createElement('button');
      deactBtn.className = 'ops-btn ops-btn-sm ops-btn-danger';
      deactBtn.textContent = 'DEACTIVATE';
      deactBtn.addEventListener('click', async () => {
        if (!confirm(`Deactivate agent "${agent.name}"?`)) return;
        await this.client.deactivateAgent(agent.name, this.project);
        this._renderAgents();
      });
      headerRight.appendChild(deactBtn);
    }
    header.appendChild(headerRight);
    container.appendChild(header);

    if (agent.last_seen) {
      const seenEl = document.createElement('div');
      seenEl.style.cssText = 'font-size:8px;color:#4a4e60;margin:-12px 0 12px 22px';
      seenEl.textContent = `Last seen ${timeAgo(agent.last_seen)}`;
      container.appendChild(seenEl);
    }

    // Description
    if (agent.description) {
      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:10px;color:#8890a4;margin-bottom:16px;line-height:1.5';
      desc.textContent = agent.description;
      container.appendChild(desc);
    }

    // Meta info
    const metaSection = document.createElement('div');
    metaSection.className = 'ops-detail-section';
    metaSection.innerHTML = `<div class="ops-detail-section-title">Info</div>`;
    const rows = [
      ['Profile', agent.profile_slug || '--'],
      ['Reports to', agent.reports_to || '--'],
      ['Executive', agent.is_executive ? 'Yes' : 'No'],
    ];
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'ops-detail-row';
      row.innerHTML = `<span class="ops-detail-label">${label}</span><span class="ops-detail-value">${esc(String(value))}</span>`;
      metaSection.appendChild(row);
    }
    container.appendChild(metaSection);

    // Profile detail (if linked)
    const profile = agent.profile_slug ? profileMap[agent.profile_slug] : null;
    if (profile) {
      const profSection = document.createElement('div');
      profSection.className = 'ops-detail-section';
      profSection.innerHTML = `<div class="ops-detail-section-title">Profile: ${esc(profile.slug)}</div>`;

      let soulKeys = [];
      try { soulKeys = JSON.parse(profile.soul_keys || '[]'); } catch {}
      if (soulKeys.length > 0) {
        const keysEl = document.createElement('div');
        keysEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px';
        for (const k of soulKeys) {
          const tag = document.createElement('span');
          tag.className = 'ops-skill-tag';
          tag.textContent = k;
          keysEl.appendChild(tag);
        }
        profSection.appendChild(keysEl);
      }

      if (profile.context_pack) {
        const cpRow = document.createElement('div');
        cpRow.className = 'ops-detail-row';
        const cpVal = profile.context_pack.length > 120 ? profile.context_pack.substring(0, 120) + '...' : profile.context_pack;
        cpRow.innerHTML = `<span class="ops-detail-label">Context</span><span class="ops-detail-value" style="font-size:9px;color:#8890a4">${esc(cpVal)}</span>`;
        profSection.appendChild(cpRow);
      }

      const poolRow = document.createElement('div');
      poolRow.className = 'ops-detail-row';
      poolRow.innerHTML = `<span class="ops-detail-label">Pool size</span><span class="ops-detail-value">${profile.pool_size || 3}</span>`;
      profSection.appendChild(poolRow);

      container.appendChild(profSection);
    }

    // Skills
    const skillsSection = document.createElement('div');
    skillsSection.className = 'ops-detail-section';
    skillsSection.innerHTML = `<div class="ops-detail-section-title">Skills</div>`;
    const skillsEl = document.createElement('div');
    let agentSkills = [];
    if (profile) {
      try { agentSkills = JSON.parse(profile.skills || '[]'); } catch {}
    }
    if (agentSkills.length > 0) {
      OpsConsole.renderSkillsSection(skillsEl, agentSkills);
    } else {
      skillsEl.innerHTML = '<span style="color:#4a4e60;font-size:9px">No skills assigned</span>';
    }
    skillsSection.appendChild(skillsEl);
    container.appendChild(skillsSection);

    // Quota — with set/edit button
    const quotaSection = document.createElement('div');
    quotaSection.className = 'ops-detail-section';
    const quotaHeader = document.createElement('div');
    quotaHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
    quotaHeader.innerHTML = `<div class="ops-detail-section-title" style="margin-bottom:0">Quota</div>`;
    const quotaBtnArea = document.createElement('div');
    quotaBtnArea.style.cssText = 'display:flex;gap:4px';
    const setQuotaBtn = document.createElement('button');
    setQuotaBtn.className = 'ops-btn ops-btn-sm';
    setQuotaBtn.textContent = 'SET';
    setQuotaBtn.addEventListener('click', () => this._showQuotaForm(container, agent.name));
    quotaBtnArea.appendChild(setQuotaBtn);
    const quota = quotaMap[agent.name] || quotaMap[agent.profile_slug];
    if (quota) {
      const delQuotaBtn = document.createElement('button');
      delQuotaBtn.className = 'ops-btn ops-btn-sm ops-btn-danger';
      delQuotaBtn.textContent = 'DEL';
      delQuotaBtn.addEventListener('click', async () => {
        await this.client.deleteQuota(agent.name, this.project);
        this._renderAgents();
      });
      quotaBtnArea.appendChild(delQuotaBtn);
    }
    quotaHeader.appendChild(quotaBtnArea);
    quotaSection.appendChild(quotaHeader);
    const quotaEl = document.createElement('div');
    quotaEl.style.marginTop = '8px';
    OpsConsole.renderQuotasSection(quotaEl, quota);
    quotaSection.appendChild(quotaEl);
    container.appendChild(quotaSection);

    // Elevations — with grant button
    const agentElevations = elevMap[agent.name] || [];
    const elevSection = document.createElement('div');
    elevSection.className = 'ops-detail-section';
    const elevHeader = document.createElement('div');
    elevHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
    elevHeader.innerHTML = `<div class="ops-detail-section-title" style="margin-bottom:0">Elevations</div>`;
    const grantBtn = document.createElement('button');
    grantBtn.className = 'ops-btn ops-btn-sm';
    grantBtn.textContent = 'GRANT';
    grantBtn.addEventListener('click', () => this._showElevationForm(container, agent.name));
    elevHeader.appendChild(grantBtn);
    elevSection.appendChild(elevHeader);
    const elevEl = document.createElement('div');
    elevEl.style.marginTop = '8px';
    if (agentElevations.length === 0) {
      elevEl.innerHTML = '<span style="color:#4a4e60;font-size:9px">No active elevation</span>';
    } else {
      for (const e of agentElevations) {
        const eRow = document.createElement('div');
        eRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,215,0,0.06);border-left:2px solid rgba(255,215,0,0.4);border-radius:2px;margin-bottom:4px';
        const remaining = e.expires_at ? Math.max(0, Math.floor((new Date(e.expires_at) - Date.now()) / 1000)) : null;
        const countdown = remaining !== null ? `${Math.floor(remaining / 60)}m ${remaining % 60}s` : 'permanent';
        eRow.innerHTML = `<span style="font-size:11px;font-weight:700;color:#ffd700">${esc(e.elevated_role || e.role)}</span>
          <span style="font-size:9px;color:#5a5e78;flex:1">${countdown}</span>`;
        const revokeBtn = document.createElement('button');
        revokeBtn.className = 'ops-btn ops-btn-sm ops-btn-danger';
        revokeBtn.textContent = 'REVOKE';
        revokeBtn.addEventListener('click', async () => {
          await this.client.revokeElevation(e.id);
          this._renderAgents();
        });
        eRow.appendChild(revokeBtn);
        elevEl.appendChild(eRow);
      }
    }
    elevSection.appendChild(elevEl);
    container.appendChild(elevSection);
  }

  _renderProfileDetail(container, profile, skills, quotaMap) {
    container.innerHTML = '';

    // Header with actions
    const header = document.createElement('div');
    header.className = 'ops-detail-header';
    const dot = document.createElement('div');
    dot.className = 'ops-detail-dot inactive';
    header.appendChild(dot);
    const headerInfo = document.createElement('div');
    headerInfo.style.flex = '1';
    headerInfo.innerHTML = `<div class="ops-detail-name">${esc(profile.name || profile.slug)}</div>
      <div class="ops-detail-role">${esc(profile.role || 'profile')}</div>`;
    header.appendChild(headerInfo);
    const headerRight = document.createElement('div');
    headerRight.style.cssText = 'display:flex;align-items:center;gap:8px';
    headerRight.innerHTML = `<span class="ops-badge ops-badge-purple">PROFILE</span>`;
    const editBtn = document.createElement('button');
    editBtn.className = 'ops-btn ops-btn-sm';
    editBtn.textContent = 'EDIT';
    editBtn.addEventListener('click', () => this._showProfileForm(container, profile));
    headerRight.appendChild(editBtn);
    const delBtn = document.createElement('button');
    delBtn.className = 'ops-btn ops-btn-sm ops-btn-danger';
    delBtn.textContent = 'DELETE';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete profile "${profile.slug}"?`)) return;
      await this.client.deleteProfile(profile.slug, this.project);
      this._renderAgents();
    });
    headerRight.appendChild(delBtn);
    header.appendChild(headerRight);
    container.appendChild(header);

    // Info
    const infoSection = document.createElement('div');
    infoSection.className = 'ops-detail-section';
    infoSection.innerHTML = `<div class="ops-detail-section-title">Info</div>`;
    const infoRows = [
      ['Slug', profile.slug],
      ['Pool size', profile.pool_size || 3],
    ];
    for (const [label, value] of infoRows) {
      const row = document.createElement('div');
      row.className = 'ops-detail-row';
      row.innerHTML = `<span class="ops-detail-label">${label}</span><span class="ops-detail-value">${esc(String(value))}</span>`;
      infoSection.appendChild(row);
    }
    container.appendChild(infoSection);

    // Soul keys
    let soulKeys = [];
    try { soulKeys = JSON.parse(profile.soul_keys || '[]'); } catch {}
    if (soulKeys.length > 0) {
      const keysSection = document.createElement('div');
      keysSection.className = 'ops-detail-section';
      keysSection.innerHTML = `<div class="ops-detail-section-title">Soul Keys</div>`;
      const keysEl = document.createElement('div');
      keysEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
      for (const k of soulKeys) {
        const tag = document.createElement('span');
        tag.className = 'ops-skill-tag';
        tag.textContent = k;
        keysEl.appendChild(tag);
      }
      keysSection.appendChild(keysEl);
      container.appendChild(keysSection);
    }

    // Context pack
    if (profile.context_pack) {
      const cpSection = document.createElement('div');
      cpSection.className = 'ops-detail-section';
      cpSection.innerHTML = `<div class="ops-detail-section-title">Context Pack</div>`;
      const cpEl = document.createElement('div');
      cpEl.style.cssText = 'font-size:9px;color:#8890a4;line-height:1.5;max-height:120px;overflow-y:auto;background:rgba(15,15,26,0.5);padding:8px;border-radius:2px;border:1px solid rgba(108,92,231,0.1)';
      cpEl.textContent = profile.context_pack;
      cpSection.appendChild(cpEl);
      container.appendChild(cpSection);
    }

    // Skills
    const skillsSection = document.createElement('div');
    skillsSection.className = 'ops-detail-section';
    skillsSection.innerHTML = `<div class="ops-detail-section-title">Skills</div>`;
    const skillsEl = document.createElement('div');
    let profSkills = [];
    try { profSkills = JSON.parse(profile.skills || '[]'); } catch {}
    if (profSkills.length > 0) {
      OpsConsole.renderSkillsSection(skillsEl, profSkills);
    } else {
      skillsEl.innerHTML = '<span style="color:#4a4e60;font-size:9px">No skills assigned</span>';
    }
    skillsSection.appendChild(skillsEl);
    container.appendChild(skillsSection);

    // Quota — with set button
    const quotaSection = document.createElement('div');
    quotaSection.className = 'ops-detail-section';
    const quotaHeader = document.createElement('div');
    quotaHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between';
    quotaHeader.innerHTML = `<div class="ops-detail-section-title" style="margin-bottom:0">Quota</div>`;
    const setQuotaBtn = document.createElement('button');
    setQuotaBtn.className = 'ops-btn ops-btn-sm';
    setQuotaBtn.textContent = 'SET';
    setQuotaBtn.addEventListener('click', () => this._showQuotaForm(container, profile.slug));
    quotaHeader.appendChild(setQuotaBtn);
    quotaSection.appendChild(quotaHeader);
    const quotaEl = document.createElement('div');
    quotaEl.style.marginTop = '8px';
    const quota = quotaMap[profile.slug];
    OpsConsole.renderQuotasSection(quotaEl, quota);
    quotaSection.appendChild(quotaEl);
    container.appendChild(quotaSection);

    // Allowed tools
    let allowedTools = [];
    try { allowedTools = JSON.parse(profile.allowed_tools || '[]'); } catch {}
    if (allowedTools.length > 0) {
      const toolsSection = document.createElement('div');
      toolsSection.className = 'ops-detail-section';
      toolsSection.innerHTML = `<div class="ops-detail-section-title">Allowed Tools</div>`;
      const toolsEl = document.createElement('div');
      toolsEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';
      for (const t of allowedTools) {
        const tag = document.createElement('span');
        tag.className = 'ops-skill-tag';
        tag.textContent = t;
        toolsEl.appendChild(tag);
      }
      toolsSection.appendChild(toolsEl);
      container.appendChild(toolsSection);
    }
  }

  // ── CRUD Forms ──

  _showProfileForm(container, existing) {
    container.innerHTML = '';
    const isEdit = !!existing;
    const title = isEdit ? `Edit Profile: ${existing.slug}` : 'New Profile';

    let existingSoulKeys = [];
    let existingSkills = [];
    let existingAllowedTools = [];
    let existingVaultPaths = [];
    if (existing) {
      try { existingSoulKeys = JSON.parse(existing.soul_keys || '[]'); } catch {}
      try { existingSkills = JSON.parse(existing.skills || '[]'); } catch {}
      try { existingAllowedTools = JSON.parse(existing.allowed_tools || '[]'); } catch {}
      try { existingVaultPaths = JSON.parse(existing.vault_paths || '[]'); } catch {}
    }

    const form = document.createElement('div');
    form.className = 'ops-form';
    form.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:#6c5ce7;margin-bottom:14px">${title}</div>
      <div class="ops-form-row">
        <label class="ops-form-label">Slug (unique ID)</label>
        <input type="text" id="pf-slug" value="${esc(existing?.slug || '')}" ${isEdit ? 'disabled style="opacity:0.5"' : ''} placeholder="e.g. backend-dev" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Name</label>
        <input type="text" id="pf-name" value="${esc(existing?.name || '')}" placeholder="e.g. Backend Developer" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Role</label>
        <input type="text" id="pf-role" value="${esc(existing?.role || '')}" placeholder="e.g. Senior Engineer" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Context Pack</label>
        <textarea id="pf-context" rows="3" placeholder="System prompt / instructions for agents using this profile">${esc(existing?.context_pack || '')}</textarea>
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Soul Keys (comma-separated)</label>
        <input type="text" id="pf-soulkeys" value="${existingSoulKeys.join(', ')}" placeholder="e.g. precision, autonomy, team-player" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Allowed Tools (comma-separated)</label>
        <input type="text" id="pf-tools" value="${existingAllowedTools.join(', ')}" placeholder="e.g. send_message, dispatch_task, *" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Vault Paths (comma-separated globs)</label>
        <input type="text" id="pf-vault" value="${existingVaultPaths.join(', ')}" placeholder="e.g. docs/*, specs/*" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Pool Size (max concurrent spawns)</label>
        <input type="number" id="pf-pool" value="${existing?.pool_size || 3}" min="1" max="20" />
      </div>
      <div class="ops-form-actions">
        <button class="ops-btn ops-btn-success" id="pf-save">${isEdit ? 'UPDATE' : 'CREATE'}</button>
        <button class="ops-btn" id="pf-cancel">CANCEL</button>
      </div>
    `;
    container.appendChild(form);

    form.querySelector('#pf-cancel').addEventListener('click', () => this._renderAgents());
    form.querySelector('#pf-save').addEventListener('click', async () => {
      const slug = form.querySelector('#pf-slug').value.trim();
      if (!slug) { alert('Slug is required'); return; }

      const soulKeysRaw = form.querySelector('#pf-soulkeys').value;
      const soulKeys = soulKeysRaw ? soulKeysRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
      const toolsRaw = form.querySelector('#pf-tools').value;
      const tools = toolsRaw ? toolsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
      const vaultRaw = form.querySelector('#pf-vault').value;
      const vaultPaths = vaultRaw ? vaultRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

      const data = {
        project: this.project,
        slug,
        name: form.querySelector('#pf-name').value.trim(),
        role: form.querySelector('#pf-role').value.trim(),
        context_pack: form.querySelector('#pf-context').value,
        soul_keys: JSON.stringify(soulKeys),
        skills: existing ? existing.skills : '[]',
        vault_paths: JSON.stringify(vaultPaths),
        allowed_tools: JSON.stringify(tools),
        pool_size: parseInt(form.querySelector('#pf-pool').value) || 3,
      };

      if (isEdit) {
        await this.client.updateProfile(slug, data);
      } else {
        await this.client.createProfile(data);
      }
      this._renderAgents();
    });
  }

  _showQuotaForm(container, agentName) {
    // Remove any existing quota form
    const existing = container.querySelector('.ops-quota-form');
    if (existing) { existing.remove(); return; }

    const form = document.createElement('div');
    form.className = 'ops-form ops-quota-form';
    form.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:#6c5ce7;margin-bottom:12px">Set Quota: ${esc(agentName)}</div>
      <div class="ops-form-row">
        <label class="ops-form-label">Tokens / day</label>
        <input type="number" id="qf-tokens" value="0" min="0" placeholder="0 = unlimited" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Messages / hour</label>
        <input type="number" id="qf-msgs" value="0" min="0" placeholder="0 = unlimited" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Tasks / hour</label>
        <input type="number" id="qf-tasks" value="0" min="0" placeholder="0 = unlimited" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Spawns / hour</label>
        <input type="number" id="qf-spawns" value="0" min="0" placeholder="0 = unlimited" />
      </div>
      <div class="ops-form-actions">
        <button class="ops-btn ops-btn-success" id="qf-save">SAVE</button>
        <button class="ops-btn" id="qf-cancel">CANCEL</button>
      </div>
    `;
    container.appendChild(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    form.querySelector('#qf-cancel').addEventListener('click', () => form.remove());
    form.querySelector('#qf-save').addEventListener('click', async () => {
      const data = {
        project: this.project,
        max_tokens_per_day: parseInt(form.querySelector('#qf-tokens').value) || 0,
        max_messages_per_hour: parseInt(form.querySelector('#qf-msgs').value) || 0,
        max_tasks_per_hour: parseInt(form.querySelector('#qf-tasks').value) || 0,
        max_spawns_per_hour: parseInt(form.querySelector('#qf-spawns').value) || 0,
      };
      await this.client.updateAgentQuota(agentName, data);
      this._renderAgents();
    });
  }

  _showElevationForm(container, agentName) {
    const existing = container.querySelector('.ops-elev-form');
    if (existing) { existing.remove(); return; }

    const form = document.createElement('div');
    form.className = 'ops-form ops-elev-form';
    form.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:#ffd700;margin-bottom:12px">Grant Elevation: ${esc(agentName)}</div>
      <div class="ops-form-row">
        <label class="ops-form-label">Role</label>
        <select id="ef-role">
          <option value="admin">Admin</option>
          <option value="lead">Lead</option>
          <option value="supervisor">Supervisor</option>
        </select>
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Duration</label>
        <select id="ef-duration">
          <option value="15m">15 minutes</option>
          <option value="30m">30 minutes</option>
          <option value="1h" selected>1 hour</option>
          <option value="2h">2 hours</option>
          <option value="4h">4 hours</option>
          <option value="24h">24 hours</option>
        </select>
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Reason (optional)</label>
        <input type="text" id="ef-reason" placeholder="e.g. deployment supervision" />
      </div>
      <div class="ops-form-actions">
        <button class="ops-btn ops-btn-success" id="ef-save">GRANT</button>
        <button class="ops-btn" id="ef-cancel">CANCEL</button>
      </div>
    `;
    container.appendChild(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    form.querySelector('#ef-cancel').addEventListener('click', () => form.remove());
    form.querySelector('#ef-save').addEventListener('click', async () => {
      const data = {
        project: this.project,
        agent: agentName,
        role: form.querySelector('#ef-role').value,
        granted_by: 'user',
        duration: form.querySelector('#ef-duration').value,
        reason: form.querySelector('#ef-reason').value,
      };
      await this.client.grantElevation(data);
      this._renderAgents();
    });
  }

  // ═══════════════════════════════════════
  // TRIGGERS TAB
  // ═══════════════════════════════════════

  async _renderTriggers() {
    const content = this._contentEl;
    content.innerHTML = '<div class="ops-empty"><div class="ops-empty-icon">&#9889;</div>Loading triggers...</div>';

    const [triggers, history] = await Promise.all([
      this.client.fetchTriggers(this.project),
      this.client.fetchTriggerHistory(this.project),
    ]);

    content.innerHTML = '';

    const layout = document.createElement('div');
    layout.className = 'ops-triggers-layout';

    // Left: rules
    const rulesCol = document.createElement('div');
    rulesCol.className = 'ops-triggers-rules';

    const addBtn = document.createElement('button');
    addBtn.className = 'ops-btn';
    addBtn.textContent = '+ NEW TRIGGER';
    addBtn.style.marginBottom = '12px';
    addBtn.addEventListener('click', () => this._showTriggerForm(rulesCol, addBtn));
    rulesCol.appendChild(addBtn);

    if (!triggers || triggers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ops-empty';
      empty.innerHTML = '<div class="ops-empty-icon">&#9889;</div>No triggers configured';
      rulesCol.appendChild(empty);
    } else {
      for (const tr of triggers) {
        rulesCol.appendChild(this._triggerCard(tr));
      }
    }

    // Right: history
    const histCol = document.createElement('div');
    histCol.className = 'ops-triggers-history';
    this._renderHistoryColumn(histCol, history);

    layout.appendChild(rulesCol);
    layout.appendChild(histCol);
    content.appendChild(layout);

    // Auto-refresh history every 5s
    const timer = setInterval(async () => {
      if (!this._visible || this.activeTab !== 'triggers') return;
      const h = await this.client.fetchTriggerHistory(this.project);
      this._renderHistoryColumn(histCol, h);
    }, 5000);
    this._timers.push(timer);
  }

  _triggerCard(tr) {
    const card = document.createElement('div');
    card.className = 'ops-card';

    const header = document.createElement('div');
    header.className = 'ops-card-header';

    const left = document.createElement('div');
    const evSpan = document.createElement('span');
    evSpan.className = 'ops-trigger-event';
    evSpan.textContent = tr.event_name || tr.event || '(any)';
    left.appendChild(evSpan);

    const actions = document.createElement('div');
    actions.className = 'ops-trigger-actions';

    const toggle = document.createElement('div');
    toggle.className = `ops-toggle${tr.enabled !== false ? ' on' : ''}`;
    toggle.title = tr.enabled !== false ? 'Enabled' : 'Disabled';
    actions.appendChild(toggle);

    const delBtn = document.createElement('button');
    delBtn.className = 'ops-btn ops-btn-danger ops-btn-sm';
    delBtn.textContent = 'DEL';
    delBtn.addEventListener('click', async () => {
      await this.client.deleteTrigger(tr.id);
      this._renderTriggers();
    });
    actions.appendChild(delBtn);

    header.appendChild(left);
    header.appendChild(actions);
    card.appendChild(header);

    // Meta
    const meta = document.createElement('div');
    meta.className = 'ops-trigger-meta';
    if (tr.profile_slug) meta.innerHTML += `<span>Profile: <b>${esc(tr.profile_slug)}</b></span>`;
    if (tr.cycle) meta.innerHTML += `<span>Cycle: ${esc(tr.cycle)}</span>`;
    if (tr.cooldown_seconds) meta.innerHTML += `<span>Cooldown: ${tr.cooldown_seconds}s</span>`;
    if (tr.max_duration && tr.max_duration !== '10m') meta.innerHTML += `<span>Max: ${esc(tr.max_duration)}</span>`;
    card.appendChild(meta);

    // Match rules — visual pills instead of raw JSON
    if (tr.match_rules && tr.match_rules !== '{}') {
      try {
        const parsed = JSON.parse(tr.match_rules);
        const keys = Object.keys(parsed).filter(k => parsed[k] !== '');
        if (keys.length > 0) {
          const rulesEl = document.createElement('div');
          rulesEl.className = 'ops-trigger-rules';
          rulesEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:6px 0;';
          for (const key of keys) {
            const val = parsed[key];
            let op = '=';
            let displayVal = val;
            if (typeof val === 'string') {
              if (val.startsWith('>')) { op = '>'; displayVal = val.slice(1); }
              else if (val.startsWith('<')) { op = '<'; displayVal = val.slice(1); }
              else if (val.startsWith('!')) { op = '\u2260'; displayVal = val.slice(1); }
              else if (val.startsWith('~')) { op = '\u2248'; displayVal = val.slice(1); }
            }
            const pill = document.createElement('span');
            pill.style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:9px;background:rgba(108,92,231,0.1);border:1px solid rgba(108,92,231,0.2);border-radius:3px;padding:2px 8px;color:#a29bfe;';
            pill.innerHTML = `<b>${esc(key)}</b> <span style="color:#636e72">${op}</span> <span style="color:#dfe6e9">${esc(displayVal)}</span>`;
            rulesEl.appendChild(pill);
          }
          card.appendChild(rulesEl);
        } else {
          const noRules = document.createElement('div');
          noRules.style.cssText = 'font-size:9px;color:#636e72;padding:4px 0;';
          noRules.textContent = 'Matches all events';
          card.appendChild(noRules);
        }
      } catch {
        // Fallback: show raw
        const rules = document.createElement('div');
        rules.className = 'ops-trigger-rules';
        rules.textContent = tr.match_rules;
        card.appendChild(rules);
      }
    }

    return card;
  }

  _renderHistoryColumn(el, history) {
    el.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'ops-history-title';
    title.textContent = 'FIRE HISTORY';
    el.appendChild(title);

    if (!history || history.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:#636e72;font-size:9px;text-align:center;padding:20px';
      empty.textContent = 'No fires yet';
      el.appendChild(empty);
      return;
    }

    for (const h of history.slice(0, 50)) {
      const item = document.createElement('div');
      item.className = `ops-history-item ${h.error ? 'error' : 'success'}`;

      let html = `<div class="ops-history-time">${fmtTime(h.fired_at || h.created_at)}</div>`;
      html += `<div class="ops-history-event">${esc(h.event_name || h.event || '')}</div>`;
      if (h.child_id) {
        html += `<div class="ops-history-child" data-child="${esc(h.child_id)}">&#8594; ${esc(h.child_id)}</div>`;
      }
      if (h.error) {
        html += `<div class="ops-history-error">${esc(h.error)}</div>`;
      }
      item.innerHTML = html;
      el.appendChild(item);
    }
  }

  async _showTriggerForm(parent, afterEl) {
    // Remove existing form if any
    const existing = parent.querySelector('.ops-form');
    if (existing) { existing.remove(); return; }

    // Fetch profiles + custom events for dropdowns
    let profiles = [];
    let customEvents = [];
    try {
      const [pRes, eRes] = await Promise.all([
        fetch(`/api/profiles?project=${encodeURIComponent(this.project)}`),
        fetch(`/api/custom-events?project=${encodeURIComponent(this.project)}`),
      ]);
      if (pRes.ok) profiles = await pRes.json();
      if (eRes.ok) customEvents = await eRes.json();
    } catch { /* ignore */ }

    // Known system events
    const EVENTS = [
      { value: 'message_received',  label: 'Message Received',  icon: '\uD83D\uDCE8', meta: ['from_agent', 'to_agent', 'subject', 'type', 'priority'] },
      { value: 'signal:interrupt',  label: 'P0 Interrupt',      icon: '\uD83D\uDEA8', meta: ['from_agent', 'to_agent', 'subject', 'priority'] },
      { value: 'task_pending',      label: 'Task Dispatched',   icon: '\uD83D\uDCCB', meta: ['task_id', 'profile', 'priority', 'dispatched_by', 'title'] },
      { value: 'task_completed',    label: 'Task Completed',    icon: '\u2705',       meta: ['task_id', 'profile', 'completed_by', 'title'] },
      { value: 'task_blocked',      label: 'Task Blocked',      icon: '\uD83D\uDED1', meta: ['task_id', 'profile', 'blocked_by', 'title', 'reason'] },
      { value: 'signal:alert',      label: 'Alert Signal',      icon: '\u26A0\uFE0F', meta: ['task_id', 'profile', 'blocked_by', 'reason'] },
    ];

    const COOLDOWNS = [
      { label: 'None', value: 0 },
      { label: '30s', value: 30 },
      { label: '1 min', value: 60 },
      { label: '5 min', value: 300 },
      { label: '10 min', value: 600 },
      { label: '30 min', value: 1800 },
      { label: '1 hour', value: 3600 },
    ];

    const form = document.createElement('div');
    form.className = 'ops-form';

    // ── Event select ──
    const eventRow = document.createElement('div');
    eventRow.className = 'ops-form-row';
    eventRow.innerHTML = '<label class="ops-form-label">WHEN THIS EVENT FIRES</label>';
    const eventSelect = document.createElement('select');
    eventSelect.id = 'ops-tf-event';
    let eventOptions = '<option value="" disabled selected>-- Choose an event --</option>'
      + '<optgroup label="System Events">'
      + EVENTS.map(e => `<option value="${e.value}">${e.icon}  ${e.label}</option>`).join('')
      + '</optgroup>';
    if (customEvents.length > 0) {
      eventOptions += '<optgroup label="Your Events">'
        + customEvents.map(e => {
          const icon = e.icon || '\uD83D\uDD36';
          return `<option value="${esc(e.name)}" data-custom="1">${icon}  ${esc(e.name)}${e.description ? ' \u2014 ' + esc(e.description) : ''}</option>`;
        }).join('')
        + '</optgroup>';
    }
    eventOptions += '<optgroup label="New">'
      + '<option value="__custom__">\u270F\uFE0F  Custom event name...</option>'
      + '<option value="__create__">\u2795  Create &amp; register new event...</option>'
      + '</optgroup>';
    eventSelect.innerHTML = eventOptions;
    eventRow.appendChild(eventSelect);

    // Custom event input (hidden by default)
    const customEventInput = document.createElement('input');
    customEventInput.type = 'text';
    customEventInput.placeholder = 'my_custom_event';
    customEventInput.style.cssText = 'display:none;margin-top:6px;';
    customEventInput.id = 'ops-tf-event-custom';
    eventRow.appendChild(customEventInput);

    // Create new event panel (hidden by default)
    const createEventPanel = document.createElement('div');
    createEventPanel.style.cssText = 'display:none;margin-top:8px;background:rgba(108,92,231,0.06);border:1px solid rgba(108,92,231,0.15);border-radius:4px;padding:10px;';
    createEventPanel.innerHTML = `
      <div style="font-size:8px;color:#636e72;font-weight:600;letter-spacing:0.5px;margin-bottom:6px;">REGISTER NEW EVENT TYPE</div>
      <input type="text" id="ops-ce-name" placeholder="event_name (e.g. deploy_done)" style="width:100%;margin-bottom:6px;font-size:10px;" />
      <input type="text" id="ops-ce-desc" placeholder="Short description (optional)" style="width:100%;margin-bottom:6px;font-size:10px;" />
      <input type="text" id="ops-ce-meta" placeholder="Meta fields, comma-separated: branch, status, author" style="width:100%;margin-bottom:6px;font-size:10px;" />
      <div style="display:flex;gap:6px;align-items:center;">
        <input type="text" id="ops-ce-icon" placeholder="Icon (emoji)" style="width:50px;font-size:10px;" maxlength="4" />
        <button class="ops-btn ops-btn-success" id="ops-ce-save" style="font-size:9px;padding:4px 10px;">REGISTER</button>
        <div id="ops-ce-status" style="font-size:9px;color:#00b894;"></div>
      </div>
      <div style="font-size:8px;color:#636e72;margin-top:6px;">Once registered, this event appears in the dropdown. Fire it via:<br><code style="color:#a29bfe;">POST /api/webhooks/{project}/{name}</code></div>
    `;
    eventRow.appendChild(createEventPanel);

    // Wire up create event button (after DOM is appended)
    setTimeout(() => {
      const saveBtn = createEventPanel.querySelector('#ops-ce-save');
      if (saveBtn) saveBtn.addEventListener('click', async () => {
        const name = createEventPanel.querySelector('#ops-ce-name').value.trim();
        if (!name) return;
        const desc = createEventPanel.querySelector('#ops-ce-desc').value.trim();
        const metaRaw = createEventPanel.querySelector('#ops-ce-meta').value.trim();
        const icon = createEventPanel.querySelector('#ops-ce-icon').value.trim();
        const metaFields = metaRaw ? JSON.stringify(metaRaw.split(',').map(s => s.trim()).filter(Boolean)) : '[]';

        const res = await fetch('/api/custom-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: this.project, name, description: desc, meta_fields: metaFields, icon: icon || '\uD83D\uDD36' }),
        });
        if (res.ok) {
          const evt = await res.json();
          customEvents.push(evt);
          // Add to dropdown
          const yourGroup = eventSelect.querySelector('optgroup[label="Your Events"]')
            || (() => { const g = document.createElement('optgroup'); g.label = 'Your Events'; eventSelect.insertBefore(g, eventSelect.lastElementChild); return g; })();
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = `${icon || '\uD83D\uDD36'}  ${name}${desc ? ' \u2014 ' + desc : ''}`;
          opt.dataset.custom = '1';
          yourGroup.appendChild(opt);
          // Auto-select it
          eventSelect.value = name;
          createEventPanel.style.display = 'none';
          updateMetaPreview(name);
          createEventPanel.querySelector('#ops-ce-status').textContent = '\u2713 Registered!';
        }
      });
    }, 0);

    // Meta preview
    const metaPreview = document.createElement('div');
    metaPreview.style.cssText = 'margin-top:6px;';
    eventRow.appendChild(metaPreview);
    form.appendChild(eventRow);

    const updateMetaPreview = (eventVal) => {
      // Check system events
      const sysDef = EVENTS.find(e => e.value === eventVal);
      if (sysDef && sysDef.meta.length) {
        renderMetaTags(sysDef.meta);
        return;
      }
      // Check custom events
      const custDef = customEvents.find(e => e.name === eventVal);
      if (custDef) {
        try {
          const fields = JSON.parse(custDef.meta_fields || '[]');
          if (fields.length) { renderMetaTags(fields); return; }
        } catch { /* ignore */ }
        metaPreview.innerHTML = '<div style="font-size:9px;color:#636e72;">No meta fields defined for this event. Edit it to add fields.</div>';
        return;
      }
      if (eventVal === '__custom__' || eventVal === '__create__') {
        metaPreview.innerHTML = '';
      } else if (eventVal) {
        metaPreview.innerHTML = '<div style="font-size:9px;color:#636e72;">Webhook body JSON keys become meta fields</div>';
      } else {
        metaPreview.innerHTML = '';
      }
    };

    function renderMetaTags(fields) {
      metaPreview.innerHTML = `<div style="font-size:8px;color:#636e72;font-weight:600;letter-spacing:0.5px;margin-bottom:4px;">AVAILABLE FIELDS \u2014 click to add as condition</div>`
        + fields.map(m => `<span style="display:inline-block;font-size:9px;background:rgba(108,92,231,0.12);color:#a29bfe;border:1px solid rgba(108,92,231,0.2);border-radius:3px;padding:2px 6px;margin:2px 3px 2px 0;cursor:pointer;" data-field="${m}">${m}</span>`).join('');
      metaPreview.querySelectorAll('[data-field]').forEach(tag => {
        tag.addEventListener('click', () => addMatchRule(tag.dataset.field, 'eq', ''));
      });
    }

    eventSelect.addEventListener('change', () => {
      if (eventSelect.value === '__custom__') {
        customEventInput.style.display = 'block';
        customEventInput.focus();
        createEventPanel.style.display = 'none';
      } else if (eventSelect.value === '__create__') {
        customEventInput.style.display = 'none';
        createEventPanel.style.display = 'block';
      } else {
        customEventInput.style.display = 'none';
        createEventPanel.style.display = 'none';
      }
      updateMetaPreview(eventSelect.value);
    });

    // ── Match rules builder ──
    const rulesRow = document.createElement('div');
    rulesRow.className = 'ops-form-row';
    rulesRow.innerHTML = '<label class="ops-form-label">ONLY IF (MATCH RULES) <span style="color:#636e72;font-weight:400;">optional</span></label>';
    const rulesContainer = document.createElement('div');
    rulesContainer.id = 'ops-tf-rules-list';
    rulesContainer.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    rulesRow.appendChild(rulesContainer);

    const addRuleBtn = document.createElement('button');
    addRuleBtn.className = 'ops-btn';
    addRuleBtn.textContent = '+ Add condition';
    addRuleBtn.style.cssText = 'margin-top:6px;font-size:9px;padding:4px 10px;';
    addRuleBtn.addEventListener('click', () => addMatchRule('', 'eq', ''));
    rulesRow.appendChild(addRuleBtn);
    form.appendChild(rulesRow);

    function addMatchRule(field, op, value) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:4px;align-items:center;';
      row.innerHTML = `
        <input type="text" class="mr-field" value="${esc(field)}" placeholder="field" style="flex:1;font-size:10px;" />
        <select class="mr-op" style="width:60px;font-size:10px;">
          <option value="eq" ${op === 'eq' ? 'selected' : ''}>=</option>
          <option value="neq" ${op === 'neq' ? 'selected' : ''}>\u2260</option>
          <option value="contains" ${op === 'contains' ? 'selected' : ''}>contains</option>
          <option value="gt" ${op === 'gt' ? 'selected' : ''}>&gt;</option>
          <option value="lt" ${op === 'lt' ? 'selected' : ''}>&lt;</option>
        </select>
        <input type="text" class="mr-value" value="${esc(value)}" placeholder="value" style="flex:1;font-size:10px;" />
      `;
      const delBtn = document.createElement('button');
      delBtn.textContent = '\u2715';
      delBtn.style.cssText = 'background:none;border:none;color:#636e72;cursor:pointer;font-size:11px;padding:2px 4px;';
      delBtn.addEventListener('click', () => row.remove());
      row.appendChild(delBtn);
      rulesContainer.appendChild(row);
    }

    // ── Profile select ──
    const profileRow = document.createElement('div');
    profileRow.className = 'ops-form-row';
    profileRow.innerHTML = '<label class="ops-form-label">SPAWN THIS PROFILE</label>';
    const profileSelect = document.createElement('select');
    profileSelect.id = 'ops-tf-profile';
    if (profiles.length > 0) {
      profileSelect.innerHTML = '<option value="" disabled selected>-- Choose a profile --</option>'
        + profiles.map(p => `<option value="${esc(p.slug)}">${esc(p.slug)} \u2014 ${esc(p.role || p.name || '')}</option>`).join('');
    } else {
      profileSelect.innerHTML = '<option value="" disabled selected>No profiles found</option>';
    }
    profileRow.appendChild(profileSelect);
    form.appendChild(profileRow);

    // ── Cycle + Cooldown row ──
    const bottomRow = document.createElement('div');
    bottomRow.className = 'ops-form-row';
    bottomRow.style.cssText = 'display:flex;gap:12px;';

    // Cycle input
    const cycleDiv = document.createElement('div');
    cycleDiv.style.cssText = 'flex:1;';
    cycleDiv.innerHTML = '<label class="ops-form-label">CYCLE</label>';
    const cycleInput = document.createElement('input');
    cycleInput.type = 'text';
    cycleInput.id = 'ops-tf-cycle';
    cycleInput.placeholder = 'default';
    cycleInput.value = 'default';
    cycleDiv.appendChild(cycleInput);
    bottomRow.appendChild(cycleDiv);

    // Cooldown select
    const cdDiv = document.createElement('div');
    cdDiv.style.cssText = 'flex:1;';
    cdDiv.innerHTML = '<label class="ops-form-label">COOLDOWN</label>';
    const cdSelect = document.createElement('select');
    cdSelect.id = 'ops-tf-cooldown';
    cdSelect.innerHTML = COOLDOWNS.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
    cdSelect.value = '60';
    cdDiv.appendChild(cdSelect);
    bottomRow.appendChild(cdDiv);

    // Max duration select
    const durDiv = document.createElement('div');
    durDiv.style.cssText = 'flex:1;';
    durDiv.innerHTML = '<label class="ops-form-label">MAX DURATION</label>';
    const durSelect = document.createElement('select');
    durSelect.id = 'ops-tf-duration';
    durSelect.innerHTML = '<option value="5m">5 min</option><option value="10m" selected>10 min</option><option value="30m">30 min</option><option value="1h">1 hour</option>';
    durDiv.appendChild(durSelect);
    bottomRow.appendChild(durDiv);

    form.appendChild(bottomRow);

    // ── Actions ──
    const actions = document.createElement('div');
    actions.className = 'ops-form-actions';
    actions.innerHTML = `
      <button class="ops-btn ops-btn-success" id="ops-tf-save">CREATE TRIGGER</button>
      <button class="ops-btn" id="ops-tf-cancel">CANCEL</button>
    `;
    form.appendChild(actions);

    afterEl.after(form);

    form.querySelector('#ops-tf-cancel').addEventListener('click', () => form.remove());
    form.querySelector('#ops-tf-save').addEventListener('click', async () => {
      // Resolve event name
      let event = eventSelect.value;
      if (event === '__custom__') event = customEventInput.value;
      if (!event) return;

      // Build match rules from visual builder
      const ruleRows = rulesContainer.querySelectorAll('div');
      const rules = {};
      ruleRows.forEach(row => {
        const field = row.querySelector('.mr-field')?.value?.trim();
        const op = row.querySelector('.mr-op')?.value;
        const value = row.querySelector('.mr-value')?.value?.trim();
        if (field && value) {
          if (op === 'gt') rules[field] = '>' + value;
          else if (op === 'lt') rules[field] = '<' + value;
          else if (op === 'neq') rules[field] = '!' + value;
          else if (op === 'contains') rules[field] = '~' + value;
          else rules[field] = value; // eq
        }
      });

      const data = {
        project: this.project,
        event: event,
        match_rules: JSON.stringify(rules),
        profile_slug: profileSelect.value,
        cycle: cycleInput.value || 'default',
        max_duration: durSelect.value,
      };

      if (!data.profile_slug) return;

      await this.client.createTrigger(data);
      form.remove();
      this._renderTriggers();
    });
  }

  // ═══════════════════════════════════════
  // POLLS TAB
  // ═══════════════════════════════════════

  async _renderPolls() {
    const content = this._contentEl;
    content.innerHTML = '<div class="ops-empty"><div class="ops-empty-icon">&#128225;</div>Loading polls...</div>';

    const polls = await this.client.fetchPollTriggers(this.project);
    content.innerHTML = '';

    const addBtn = document.createElement('button');
    addBtn.className = 'ops-btn';
    addBtn.textContent = '+ NEW POLL';
    addBtn.style.marginBottom = '12px';
    addBtn.addEventListener('click', () => this._showPollForm(content, addBtn));
    content.appendChild(addBtn);

    if (!polls || polls.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ops-empty';
      empty.innerHTML = '<div class="ops-empty-icon">&#128225;</div>No poll triggers configured';
      content.appendChild(empty);
      return;
    }

    for (const p of polls) {
      content.appendChild(this._pollCard(p));
    }

    // Auto-refresh every 10s
    const timer = setInterval(async () => {
      if (!this._visible || this.activeTab !== 'polls') return;
      const updated = await this.client.fetchPollTriggers(this.project);
      // Only refresh if still on this tab
      if (this.activeTab === 'polls') {
        const cards = content.querySelectorAll('.ops-card');
        // Simple: re-render if count changed
        if (cards.length !== (updated || []).length) {
          this._renderPolls();
        }
      }
    }, 10000);
    this._timers.push(timer);
  }

  _pollCard(p) {
    const card = document.createElement('div');
    card.className = 'ops-card';

    const header = document.createElement('div');
    header.className = 'ops-card-header';

    const left = document.createElement('div');
    left.innerHTML = `<span class="ops-card-title">${esc(p.name || p.id)}</span>`;
    if (p.url) {
      const urlEl = document.createElement('div');
      urlEl.className = 'ops-poll-url';
      urlEl.textContent = p.url;
      left.appendChild(urlEl);
    }

    const actions = document.createElement('div');
    actions.className = 'ops-trigger-actions';
    actions.style.gap = '6px';

    const testBtn = document.createElement('button');
    testBtn.className = 'ops-btn ops-btn-sm';
    testBtn.textContent = 'TEST NOW';
    testBtn.addEventListener('click', async () => {
      testBtn.textContent = '...';
      try {
        const result = await this.client.testPollTrigger(p.id);
        const badge = document.createElement('span');
        badge.className = 'ops-poll-result';
        if (result && result.matched) {
          badge.className += ' ops-badge-green';
          badge.textContent = 'MATCHED';
        } else if (result && result.error) {
          badge.className += ' ops-badge-red';
          badge.textContent = 'ERROR';
        } else {
          badge.className += ' ops-badge-gray';
          badge.textContent = 'NO MATCH';
        }
        testBtn.textContent = 'TEST NOW';
        // Insert badge after button, remove after 3s
        const existing = actions.querySelector('.ops-poll-result');
        if (existing) existing.remove();
        actions.appendChild(badge);
        setTimeout(() => badge.remove(), 3000);
      } catch {
        testBtn.textContent = 'TEST NOW';
      }
    });
    actions.appendChild(testBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'ops-btn ops-btn-danger ops-btn-sm';
    delBtn.textContent = 'DEL';
    delBtn.addEventListener('click', async () => {
      await this.client.deletePollTrigger(p.id);
      this._renderPolls();
    });
    actions.appendChild(delBtn);

    header.appendChild(left);
    header.appendChild(actions);
    card.appendChild(header);

    // Condition
    if (p.condition_path || p.condition_op) {
      const cond = document.createElement('div');
      cond.className = 'ops-poll-condition';
      cond.textContent = `${p.condition_path || ''} ${p.condition_op || ''} ${p.condition_value || ''}`;
      card.appendChild(cond);
    }

    // Meta
    const meta = document.createElement('div');
    meta.className = 'ops-trigger-meta';
    if (p.interval_secs) meta.innerHTML += `<span>Every ${p.interval_secs}s</span>`;
    if (p.fire_event) meta.innerHTML += `<span>Fires: <b>${esc(p.fire_event)}</b></span>`;
    if (p.last_status) {
      const cls = p.last_status === 'matched' ? 'green' : p.last_status === 'error' ? 'red' : 'gray';
      meta.innerHTML += `<span class="ops-badge ops-badge-${cls}">${esc(p.last_status)}</span>`;
    }
    card.appendChild(meta);

    return card;
  }

  _showPollForm(parent, afterEl) {
    const existing = parent.querySelector('.ops-form');
    if (existing) { existing.remove(); return; }

    const form = document.createElement('div');
    form.className = 'ops-form';
    form.innerHTML = `
      <div class="ops-form-row">
        <label class="ops-form-label">Name</label>
        <input type="text" id="ops-pf-name" placeholder="e.g. check-deploy-status" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">URL</label>
        <input type="text" id="ops-pf-url" placeholder="https://api.example.com/status" />
      </div>
      <div class="ops-form-row" style="display:flex;gap:8px">
        <div style="flex:2">
          <label class="ops-form-label">Condition Path</label>
          <input type="text" id="ops-pf-path" placeholder="$.status" />
        </div>
        <div style="flex:1">
          <label class="ops-form-label">Op</label>
          <select id="ops-pf-op">
            <option value="eq">eq</option>
            <option value="neq">neq</option>
            <option value="contains">contains</option>
            <option value="gt">gt</option>
            <option value="lt">lt</option>
          </select>
        </div>
        <div style="flex:1">
          <label class="ops-form-label">Value</label>
          <input type="text" id="ops-pf-value" placeholder="ready" />
        </div>
      </div>
      <div class="ops-form-row" style="display:flex;gap:8px">
        <div style="flex:1">
          <label class="ops-form-label">Interval (secs)</label>
          <input type="number" id="ops-pf-interval" value="60" />
        </div>
        <div style="flex:1">
          <label class="ops-form-label">Fire Event</label>
          <input type="text" id="ops-pf-fire" placeholder="deploy.ready" />
        </div>
      </div>
      <div class="ops-form-actions">
        <button class="ops-btn ops-btn-success" id="ops-pf-save">CREATE</button>
        <button class="ops-btn" id="ops-pf-cancel">CANCEL</button>
      </div>
    `;
    afterEl.after(form);

    form.querySelector('#ops-pf-cancel').addEventListener('click', () => form.remove());
    form.querySelector('#ops-pf-save').addEventListener('click', async () => {
      const data = {
        project: this.project,
        name: form.querySelector('#ops-pf-name').value,
        url: form.querySelector('#ops-pf-url').value,
        condition_path: form.querySelector('#ops-pf-path').value,
        condition_op: form.querySelector('#ops-pf-op').value,
        condition_value: form.querySelector('#ops-pf-value').value,
        interval_secs: parseInt(form.querySelector('#ops-pf-interval').value) || 60,
        fire_event: form.querySelector('#ops-pf-fire').value,
      };
      await this.client.createPollTrigger(data);
      form.remove();
      this._renderPolls();
    });
  }

  // ═══════════════════════════════════════
  // SKILLS TAB
  // ═══════════════════════════════════════

  async _renderSkills() {
    const content = this._contentEl;
    content.innerHTML = '<div class="ops-empty"><div class="ops-empty-icon">&#9733;</div>Loading skills...</div>';

    const skills = await this.client.fetchSkills(this.project);
    content.innerHTML = '';

    const addBtn = document.createElement('button');
    addBtn.className = 'ops-btn';
    addBtn.textContent = '+ NEW SKILL';
    addBtn.style.marginBottom = '12px';
    addBtn.addEventListener('click', () => this._showSkillForm(content, addBtn));
    content.appendChild(addBtn);

    if (!skills || skills.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ops-empty';
      empty.innerHTML = '<div class="ops-empty-icon">&#9733;</div>No skills registered';
      content.appendChild(empty);
      return;
    }

    for (const s of skills) {
      content.appendChild(this._skillCard(s));
    }
  }

  _skillCard(s) {
    const card = document.createElement('div');
    card.className = 'ops-card';

    const header = document.createElement('div');
    header.className = 'ops-card-header';

    const left = document.createElement('div');
    left.innerHTML = `<span class="ops-card-title">${esc(s.name)}</span>`;
    if (s.description) {
      const desc = document.createElement('div');
      desc.className = 'ops-card-subtitle';
      desc.textContent = s.description;
      left.appendChild(desc);
    }

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    right.style.alignItems = 'center';

    // Agent count
    if (s.agent_count !== undefined) {
      const count = document.createElement('span');
      count.className = 'ops-badge ops-badge-purple';
      count.textContent = `${s.agent_count} agents`;
      right.appendChild(count);
    }

    // Discover button
    const discoverBtn = document.createElement('button');
    discoverBtn.className = 'ops-btn ops-btn-sm';
    discoverBtn.textContent = 'DISCOVER';
    discoverBtn.addEventListener('click', () => this._discoverSkill(card, s.name));
    right.appendChild(discoverBtn);

    header.appendChild(left);
    header.appendChild(right);
    card.appendChild(header);

    // Tags
    if (s.tags && s.tags.length > 0) {
      const tagsEl = document.createElement('div');
      tagsEl.className = 'ops-skill-tags';
      const tags = typeof s.tags === 'string' ? JSON.parse(s.tags) : s.tags;
      for (const t of tags) {
        const tag = document.createElement('span');
        tag.className = 'ops-skill-tag';
        tag.textContent = t;
        tagsEl.appendChild(tag);
      }
      card.appendChild(tagsEl);
    }

    // Expandable profiles (click to load)
    const expandBtn = document.createElement('button');
    expandBtn.className = 'ops-btn ops-btn-sm';
    expandBtn.style.marginTop = '8px';
    expandBtn.textContent = 'SHOW PROFILES';
    expandBtn.addEventListener('click', async () => {
      if (card.querySelector('.ops-skill-profiles')) {
        card.querySelector('.ops-skill-profiles').remove();
        expandBtn.textContent = 'SHOW PROFILES';
        return;
      }
      expandBtn.textContent = '...';
      const profiles = await this.client.fetchSkillProfiles(s.name, this.project);
      expandBtn.textContent = 'HIDE PROFILES';
      const profilesEl = document.createElement('div');
      profilesEl.className = 'ops-skill-profiles';
      if (!profiles || profiles.length === 0) {
        profilesEl.innerHTML = '<div style="color:#3a3e52;font-size:9px">No profiles linked</div>';
      } else {
        for (const p of profiles) {
          const row = document.createElement('div');
          row.className = 'ops-skill-profile';

          const name = document.createElement('span');
          name.className = 'ops-skill-profile-name';
          name.textContent = p.profile_slug || p.name || p.profile;
          row.appendChild(name);

          // Proficiency dots (1-5)
          const dots = document.createElement('div');
          dots.className = 'ops-proficiency-dots';
          const level = p.proficiency || 0;
          for (let i = 1; i <= 5; i++) {
            const dot = document.createElement('div');
            dot.className = `ops-proficiency-dot${i <= level ? ' filled' : ''}`;
            dots.appendChild(dot);
          }
          row.appendChild(dots);

          profilesEl.appendChild(row);
        }
      }
      card.appendChild(profilesEl);
    });
    card.appendChild(expandBtn);

    return card;
  }

  async _discoverSkill(card, skillName) {
    // Remove existing result
    const existing = card.querySelector('.ops-discover-result');
    if (existing) { existing.remove(); return; }

    const result = await this.client.discoverBySkill(this.project, skillName);
    const div = document.createElement('div');
    div.className = 'ops-discover-result';

    if (!result || !result.agents || result.agents.length === 0) {
      div.innerHTML = '<div style="color:#3a3e52;font-size:9px">No active agents found</div>';
    } else {
      for (const a of result.agents) {
        const row = document.createElement('div');
        row.className = 'ops-discover-agent';

        const dot = document.createElement('div');
        dot.className = `ops-discover-dot ${a.active || a.online ? 'active' : 'inactive'}`;
        row.appendChild(dot);

        const name = document.createElement('span');
        name.className = 'ops-discover-name';
        name.textContent = a.name || a.profile_slug || a.agent;
        name.addEventListener('click', () => {
          if (this.onAgentClick) this.onAgentClick(this.project, a.name || a.profile_slug || a.agent);
        });
        row.appendChild(name);

        if (a.role) {
          const role = document.createElement('span');
          role.className = 'ops-discover-role';
          role.textContent = a.role;
          row.appendChild(role);
        }

        div.appendChild(row);
      }
    }
    card.appendChild(div);
  }

  _showSkillForm(parent, afterEl) {
    const existing = parent.querySelector('.ops-form');
    if (existing) { existing.remove(); return; }

    const form = document.createElement('div');
    form.className = 'ops-form';
    form.innerHTML = `
      <div class="ops-form-row">
        <label class="ops-form-label">Skill Name</label>
        <input type="text" id="ops-sf-name" placeholder="e.g. code-review" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Description</label>
        <input type="text" id="ops-sf-desc" placeholder="Reviews pull requests" />
      </div>
      <div class="ops-form-row">
        <label class="ops-form-label">Tags (comma-separated)</label>
        <input type="text" id="ops-sf-tags" placeholder="backend, review, go" />
      </div>
      <div class="ops-form-actions">
        <button class="ops-btn ops-btn-success" id="ops-sf-save">CREATE</button>
        <button class="ops-btn" id="ops-sf-cancel">CANCEL</button>
      </div>
    `;
    afterEl.after(form);

    form.querySelector('#ops-sf-cancel').addEventListener('click', () => form.remove());
    form.querySelector('#ops-sf-save').addEventListener('click', async () => {
      const tagsRaw = form.querySelector('#ops-sf-tags').value;
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
      const data = {
        project: this.project,
        name: form.querySelector('#ops-sf-name').value,
        description: form.querySelector('#ops-sf-desc').value,
        tags,
      };
      await this.client.createSkill(data);
      form.remove();
      this._renderSkills();
    });
  }

  // ═══════════════════════════════════════
  // QUOTAS TAB
  // ═══════════════════════════════════════

  async _renderQuotas() {
    const content = this._contentEl;
    content.innerHTML = '<div class="ops-empty"><div class="ops-empty-icon">&#9632;</div>Loading quotas...</div>';

    const quotas = await this.client.fetchQuotas(this.project);
    content.innerHTML = '';

    if (!quotas || quotas.length === 0) {
      content.innerHTML = '<div class="ops-empty"><div class="ops-empty-icon">&#9632;</div>No quotas configured</div>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'ops-quota-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>Agent</th>
      <th>Tokens/day</th>
      <th>Msgs/hr</th>
      <th>Tasks/hr</th>
      <th>Spawns/hr</th>
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const q of quotas) {
      const row = document.createElement('tr');

      // Check if any quota >80%
      const ratios = [];
      if (q.max_tokens_per_day && q.tokens_used) ratios.push(q.tokens_used / q.max_tokens_per_day);
      if (q.max_messages_per_hour && q.messages_used) ratios.push(q.messages_used / q.max_messages_per_hour);
      if (q.max_tasks_per_hour && q.tasks_used) ratios.push(q.tasks_used / q.max_tasks_per_hour);
      if (q.max_spawns_per_hour && q.spawns_used) ratios.push(q.spawns_used / q.max_spawns_per_hour);
      const maxRatio = ratios.length > 0 ? Math.max(...ratios) : 0;
      if (maxRatio > 0.8) row.className = 'warning';

      row.innerHTML = `
        <td class="ops-quota-agent">${esc(q.agent || q.profile_slug || q.name)}${maxRatio > 0.8 ? '<span class="ops-quota-warning">&#9888;</span>' : ''}</td>
        <td>${this._healthBar(q.tokens_used || 0, q.max_tokens_per_day || 0)}</td>
        <td>${this._healthBar(q.messages_used || 0, q.max_messages_per_hour || 0)}</td>
        <td>${this._healthBar(q.tasks_used || 0, q.max_tasks_per_hour || 0)}</td>
        <td>${this._healthBar(q.spawns_used || 0, q.max_spawns_per_hour || 0)}</td>
      `;

      row.addEventListener('click', () => {
        if (this.onAgentClick) this.onAgentClick(this.project, q.agent || q.profile_slug || q.name);
      });

      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    content.appendChild(table);
  }

  _healthBar(used, limit) {
    if (!limit) return '<span style="color:#3a3e52">--</span>';
    const ratio = Math.min(used / limit, 1);
    const filled = Math.round(ratio * 10);
    let html = '<div class="ops-health-bar">';
    for (let i = 0; i < 10; i++) {
      if (i < filled) {
        const cls = ratio > 0.8 ? 'danger' : ratio > 0.6 ? 'warn' : 'filled';
        html += `<div class="ops-health-seg ${cls}"></div>`;
      } else {
        html += '<div class="ops-health-seg"></div>';
      }
    }
    html += `<span class="ops-quota-text">${used}/${limit}</span></div>`;
    return html;
  }

  // ═══════════════════════════════════════
  // AGENT DETAIL ENRICHMENT (static helpers)
  // ═══════════════════════════════════════

  static renderSkillsSection(el, skills) {
    if (!el) return;
    if (!skills || skills.length === 0) {
      el.innerHTML = '<span style="color:#5a5e78">No skills</span>';
      return;
    }
    el.innerHTML = skills.map(s => {
      const level = s.proficiency || 0;
      let dots = '';
      for (let i = 1; i <= 5; i++) {
        const filled = i <= level;
        dots += `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:2px;${
          filled ? 'background:#a29bfe;box-shadow:0 0 3px rgba(162,155,254,0.4)' : 'background:rgba(108,92,231,0.15);border:1px solid rgba(108,92,231,0.2)'
        }"></span>`;
      }
      return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:10px">
        <span style="color:#dfe6e9;font-weight:600;min-width:80px">${esc(s.name || s.skill_name)}</span>
        <span>${dots}</span>
      </div>`;
    }).join('');
  }

  static renderQuotasSection(el, quota) {
    if (!el) return;
    if (!quota) {
      el.innerHTML = '<span style="color:#5a5e78">No quotas</span>';
      return;
    }

    const bars = [];
    const metrics = [
      { label: 'Tokens/day', used: quota.tokens_used || 0, limit: quota.max_tokens_per_day || 0 },
      { label: 'Msgs/hr', used: quota.messages_used || 0, limit: quota.max_messages_per_hour || 0 },
      { label: 'Tasks/hr', used: quota.tasks_used || 0, limit: quota.max_tasks_per_hour || 0 },
      { label: 'Spawns/hr', used: quota.spawns_used || 0, limit: quota.max_spawns_per_hour || 0 },
    ];

    for (const m of metrics) {
      if (!m.limit) continue;
      const ratio = Math.min(m.used / m.limit, 1);
      const filled = Math.round(ratio * 10);
      let segs = '';
      for (let i = 0; i < 10; i++) {
        if (i < filled) {
          const c = ratio > 0.8 ? '#ff6b6b' : ratio > 0.6 ? '#ffd93d' : '#00e676';
          segs += `<span style="display:inline-block;width:7px;height:9px;margin-right:1px;background:${c};border-radius:1px;box-shadow:0 0 2px ${c}44"></span>`;
        } else {
          segs += `<span style="display:inline-block;width:7px;height:9px;margin-right:1px;background:rgba(30,30,50,0.6);border:1px solid rgba(108,92,231,0.15);border-radius:0"></span>`;
        }
      }
      bars.push(`<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:9px">
        <span style="color:#7a7e98;min-width:60px;text-transform:uppercase;letter-spacing:0.5px">${m.label}</span>
        <span>${segs}</span>
        <span style="color:#5a5e78;font-size:8px">${m.used}/${m.limit}</span>
      </div>`);
    }

    el.innerHTML = bars.length > 0 ? bars.join('') : '<span style="color:#5a5e78">No limits set</span>';
  }

  // ═══════════════════════════════════════
  // CYCLES TAB
  // ═══════════════════════════════════════

  async _renderCycles() {
    const content = this._contentEl;
    content.innerHTML = '<div class="ops-empty"><div class="ops-empty-icon">&#8634;</div>Loading cycles...</div>';

    const cycles = await this.client.fetchCycles(this.project);
    content.innerHTML = '';

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'ops-btn';
    addBtn.textContent = '+ NEW CYCLE';
    addBtn.style.margin = '12px 16px';
    addBtn.addEventListener('click', () => this._showCycleForm(content, addBtn));
    content.appendChild(addBtn);

    if (!cycles || cycles.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ops-empty';
      empty.innerHTML = '<div class="ops-empty-icon">&#8634;</div>No cycles configured';
      content.appendChild(empty);
      return;
    }

    for (const c of cycles) {
      content.appendChild(this._cycleCard(c));
    }
  }

  _cycleCard(cycle) {
    const card = document.createElement('div');
    card.className = 'ops-card';
    card.style.margin = '0 16px 8px';

    const header = document.createElement('div');
    header.className = 'ops-card-header';

    const left = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'ops-trigger-event';
    nameSpan.textContent = cycle.name;
    left.appendChild(nameSpan);

    const ttlSpan = document.createElement('span');
    ttlSpan.style.cssText = 'font-size:9px;color:#636e72;margin-left:8px;';
    ttlSpan.textContent = `TTL: ${cycle.ttl || 10}m`;
    left.appendChild(ttlSpan);

    const actions = document.createElement('div');
    actions.className = 'ops-trigger-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'ops-btn ops-btn-sm';
    editBtn.textContent = 'EDIT';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showCycleForm(card.parentElement, card, cycle);
    });
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'ops-btn ops-btn-danger ops-btn-sm';
    delBtn.textContent = 'DEL';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.client.deleteCycle(cycle.name, this.project);
      this._renderCycles();
    });
    actions.appendChild(delBtn);

    header.appendChild(left);
    header.appendChild(actions);
    card.appendChild(header);

    // Prompt preview
    if (cycle.prompt) {
      const prompt = document.createElement('div');
      prompt.style.cssText = 'font-size:10px;color:#7a7e98;padding:6px 10px;max-height:60px;overflow:hidden;white-space:pre-wrap;line-height:1.4;';
      prompt.textContent = cycle.prompt.length > 200 ? cycle.prompt.slice(0, 200) + '...' : cycle.prompt;
      card.appendChild(prompt);
    }

    return card;
  }

  async _showCycleForm(parent, afterEl, existing = null) {
    // Remove existing form
    const old = parent.querySelector('.ops-form');
    if (old) { old.remove(); return; }

    const form = document.createElement('div');
    form.className = 'ops-form';
    form.style.margin = '0 16px 12px';

    const isEdit = !!existing;

    form.innerHTML = `
      <div class="ops-form-title">${isEdit ? 'EDIT' : 'NEW'} CYCLE</div>
      <div class="ops-form-row">
        <label>Name</label>
        <input type="text" class="ops-input" id="cycle-name" value="${esc(existing?.name || '')}" ${isEdit ? 'disabled' : ''} placeholder="e.g. heartbeat-5min" />
      </div>
      <div class="ops-form-row">
        <label>TTL (minutes)</label>
        <input type="number" class="ops-input" id="cycle-ttl" value="${existing?.ttl || 10}" min="1" placeholder="10" />
      </div>
      <div class="ops-form-row">
        <label>Prompt</label>
        <textarea class="ops-input" id="cycle-prompt" rows="6" placeholder="Instructions for the agent during this cycle...">${esc(existing?.prompt || '')}</textarea>
      </div>
      <div class="ops-form-actions">
        <button class="ops-btn" id="cycle-save">${isEdit ? 'UPDATE' : 'CREATE'}</button>
        <button class="ops-btn ops-btn-ghost" id="cycle-cancel">CANCEL</button>
      </div>
    `;

    if (afterEl.nextSibling) {
      parent.insertBefore(form, afterEl.nextSibling);
    } else {
      parent.appendChild(form);
    }

    form.querySelector('#cycle-cancel').addEventListener('click', () => form.remove());
    form.querySelector('#cycle-save').addEventListener('click', async () => {
      const name = form.querySelector('#cycle-name').value.trim();
      const ttl = parseInt(form.querySelector('#cycle-ttl').value) || 10;
      const prompt = form.querySelector('#cycle-prompt').value;

      if (!name) return;

      const data = { project: this.project, name, prompt, ttl };

      if (isEdit) {
        await this.client.updateCycle(name, data);
      } else {
        await this.client.createCycle(data);
      }
      this._renderCycles();
    });
  }

  // ═══════════════════════════════════════
  // FLOWS TAB
  // ═══════════════════════════════════════

  _renderFlows() {
    const content = this._contentEl;
    content.innerHTML = '';
    content.style.padding = '0';
    content.style.overflow = 'hidden';

    // Create flow editor container that fills the content area
    const flowContainer = document.createElement('div');
    flowContainer.style.cssText = 'width:100%;height:100%;position:relative;';
    content.appendChild(flowContainer);

    // Lazy-init the FlowEditor
    if (!this._flowEditor) {
      this._flowEditor = new FlowEditor(flowContainer, this.client);
    } else {
      // Re-attach to new container
      this._flowEditor.container = flowContainer;
    }
    this._flowEditor.show(this.project);
  }

  static renderElevationSection(el, elevations, client, project, agentName) {
    if (!el) return;
    if (!elevations || elevations.length === 0) {
      // Show grant button
      el.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
        <span style="color:#5a5e78;font-size:10px">No active elevation</span>
      </div>`;
      return;
    }

    el.innerHTML = elevations.map(e => {
      const remaining = e.expires_at ? Math.max(0, Math.floor((new Date(e.expires_at) - Date.now()) / 1000)) : null;
      const countdown = remaining !== null ? `${Math.floor(remaining / 60)}m ${remaining % 60}s remaining` : 'permanent';
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,215,0,0.06);border-left:2px solid rgba(255,215,0,0.4);border-radius:2px;margin-bottom:4px">
        <span style="font-size:10px">&#9812;</span>
        <span style="font-size:11px;font-weight:700;color:#ffd700">${esc(e.elevated_role || e.role)}</span>
        <span style="font-size:9px;color:#5a5e78;margin-left:auto">${countdown}</span>
      </div>
      <div style="font-size:8px;color:#5a5e78">Granted by: ${esc(e.granted_by || '?')}</div>`;
    }).join('');
  }
}
