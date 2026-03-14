// flow-editor.js — Visual Workflow Builder (n8n-style DAG editor)
// DOM-based nodes + SVG edges, purple neon pixel art aesthetic

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

const NODE_TYPES = {
  'trigger:event':     { label: 'Event Trigger',  color: '#6c5ce7', icon: '\u26A1', category: 'trigger',   inputs: 0, outputs: 1 },
  'trigger:cron':      { label: 'Cron Schedule',   color: '#6c5ce7', icon: '\uD83D\uDD50', category: 'trigger',   inputs: 0, outputs: 1 },
  'trigger:webhook':   { label: 'Webhook',         color: '#6c5ce7', icon: '\uD83D\uDD17', category: 'trigger',   inputs: 0, outputs: 1 },
  'condition:match':   { label: 'Match',            color: '#0984e3', icon: '\u2753', category: 'condition', inputs: 1, outputs: 2 },
  'condition:switch':  { label: 'Switch',           color: '#0984e3', icon: '\uD83D\uDD00', category: 'condition', inputs: 1, outputs: 4 },
  'action:spawn':      { label: 'Spawn Agent',      color: '#00b894', icon: '\uD83E\uDD16', category: 'action',   inputs: 1, outputs: 1 },
  'action:message':    { label: 'Send Message',     color: '#00b894', icon: '\uD83D\uDCAC', category: 'action',   inputs: 1, outputs: 1 },
  'action:task':       { label: 'Dispatch Task',    color: '#00b894', icon: '\uD83D\uDCCB', category: 'action',   inputs: 1, outputs: 1 },
  'action:team_notify':{ label: 'Team Notify',      color: '#00b894', icon: '\uD83D\uDCE2', category: 'action',   inputs: 1, outputs: 1 },
  'action:broadcast':  { label: 'Broadcast',        color: '#00b894', icon: '\uD83D\uDCE1', category: 'action',   inputs: 1, outputs: 1 },
  'action:webhook_out':{ label: 'HTTP Request',     color: '#00b894', icon: '\uD83C\uDF10', category: 'action',   inputs: 1, outputs: 1 },
  'action:elevate':    { label: 'Elevate',          color: '#00b894', icon: '\u2B06\uFE0F', category: 'action',   inputs: 1, outputs: 1 },
  'action:schedule':   { label: 'Schedule',         color: '#00b894', icon: '\uD83D\uDCC5', category: 'action',   inputs: 1, outputs: 1 },
};

const CATEGORY_LABELS = {
  trigger:   'TRIGGERS',
  condition: 'CONDITIONS',
  action:    'ACTIONS',
};

const CATEGORY_ORDER = ['trigger', 'condition', 'action'];

// ── Embedded styles ──

const FLOW_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');

@keyframes flowSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes edgeFlow {
  from { stroke-dashoffset: 20; }
  to   { stroke-dashoffset: 0; }
}

/* ── Root layout ── */
.flow-root {
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

/* ── Toolbar ── */
.flow-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(15, 15, 26, 0.95);
  border-bottom: 1px solid rgba(108, 92, 231, 0.2);
  flex-shrink: 0;
  z-index: 10;
}
.flow-toolbar select,
.flow-toolbar input {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  background: #1a1a2e;
  color: #dfe6e9;
  border: 1px solid rgba(108, 92, 231, 0.3);
  border-radius: 3px;
  padding: 4px 8px;
  outline: none;
}
.flow-toolbar select:focus,
.flow-toolbar input:focus {
  border-color: #6c5ce7;
  box-shadow: 0 0 6px rgba(108, 92, 231, 0.3);
}
.flow-toolbar input.flow-wf-name {
  width: 180px;
}
.flow-toolbar-spacer {
  flex: 1;
}
.flow-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  padding: 4px 12px;
  border: 1px solid rgba(108, 92, 231, 0.4);
  border-radius: 3px;
  background: rgba(108, 92, 231, 0.1);
  color: #a29bfe;
  cursor: pointer;
  transition: all 0.15s;
}
.flow-btn:hover {
  background: rgba(108, 92, 231, 0.25);
  color: #dfe6e9;
  box-shadow: 0 0 8px rgba(108, 92, 231, 0.3);
}
.flow-btn.danger {
  border-color: rgba(214, 48, 49, 0.4);
  background: rgba(214, 48, 49, 0.1);
  color: #ff7675;
}
.flow-btn.danger:hover {
  background: rgba(214, 48, 49, 0.25);
  color: #fab1a0;
}
.flow-btn.primary {
  border-color: rgba(0, 184, 148, 0.5);
  background: rgba(0, 184, 148, 0.15);
  color: #55efc4;
}
.flow-btn.primary:hover {
  background: rgba(0, 184, 148, 0.3);
  color: #fff;
}

/* ── Body: palette + canvas + config ── */
.flow-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Left palette ── */
.flow-palette {
  width: 180px;
  flex-shrink: 0;
  background: #0f0f1a;
  border-right: 1px solid rgba(108, 92, 231, 0.15);
  overflow-y: auto;
  padding: 8px 0;
}
.flow-palette-group {
  padding: 8px 12px 4px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #636e72;
}
.flow-palette-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 9px;
  color: #b2bec3;
  cursor: pointer;
  transition: all 0.12s;
  border-left: 2px solid transparent;
}
.flow-palette-item:hover {
  background: rgba(108, 92, 231, 0.08);
  color: #dfe6e9;
  border-left-color: var(--node-color);
}
.flow-palette-item .pi-icon {
  font-size: 12px;
  width: 18px;
  text-align: center;
}
.flow-palette-item .pi-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Canvas wrapper ── */
.flow-canvas-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #0a0a12;
  cursor: grab;
}
.flow-canvas-wrap.grabbing {
  cursor: grabbing;
}
.flow-canvas-wrap.connecting {
  cursor: crosshair;
}

/* Grid background */
.flow-canvas-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, rgba(108, 92, 231, 0.06) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
  z-index: 0;
}

/* ── SVG edge layer ── */
.flow-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  overflow: visible;
}
.flow-svg .flow-edge {
  fill: none;
  stroke: #6c5ce7;
  stroke-width: 2;
  pointer-events: stroke;
  cursor: pointer;
  transition: stroke 0.15s, stroke-width 0.15s;
}
.flow-svg .flow-edge:hover {
  stroke: #a29bfe;
  stroke-width: 3;
  filter: url(#neon-glow);
}
.flow-svg .flow-edge.selected {
  stroke: #a29bfe;
  stroke-width: 2.5;
  stroke-dasharray: 8 4;
  animation: edgeFlow 0.6s linear infinite;
  filter: url(#neon-glow);
}
.flow-svg .flow-edge-temp {
  fill: none;
  stroke: rgba(108, 92, 231, 0.5);
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}

/* ── Nodes layer ── */
.flow-nodes {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  transform-origin: 0 0;
  z-index: 2;
}

/* ── Node ── */
.flow-node {
  position: absolute;
  width: 180px;
  background: #1a1a2e;
  border: 1px solid rgba(108, 92, 231, 0.2);
  border-radius: 6px;
  overflow: visible;
  cursor: default;
  transition: box-shadow 0.15s, border-color 0.15s;
  animation: flowSlideIn 0.2s ease-out;
  user-select: none;
}
.flow-node:hover {
  border-color: var(--node-color, rgba(108, 92, 231, 0.5));
  box-shadow: 0 0 12px color-mix(in srgb, var(--node-color, #6c5ce7) 30%, transparent);
}
.flow-node.selected {
  border-color: var(--node-color, #6c5ce7);
  box-shadow: 0 0 18px color-mix(in srgb, var(--node-color, #6c5ce7) 40%, transparent),
              0 0 4px color-mix(in srgb, var(--node-color, #6c5ce7) 20%, transparent);
}

.flow-node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--node-color, #6c5ce7);
  border-radius: 5px 5px 0 0;
  cursor: grab;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.3px;
}
.flow-node-header .nh-icon {
  font-size: 12px;
}
.flow-node-header .nh-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.flow-node-body {
  padding: 8px 10px;
  font-size: 8px;
  color: #636e72;
  min-height: 20px;
  line-height: 1.4;
}

/* ── Ports ── */
.flow-port {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2d3436;
  border: 2px solid var(--node-color, #6c5ce7);
  cursor: crosshair;
  z-index: 5;
  transition: all 0.12s;
}
.flow-port.port-input {
  left: -5px;
}
.flow-port.port-output {
  right: -5px;
}
.flow-port:hover {
  background: var(--node-color, #6c5ce7);
  box-shadow: 0 0 8px var(--node-color, #6c5ce7);
  transform: scale(1.3);
}

/* ── Right config panel ── */
.flow-config {
  width: 260px;
  flex-shrink: 0;
  background: #0f0f1a;
  border-left: 1px solid rgba(108, 92, 231, 0.15);
  overflow-y: auto;
  padding: 0;
  display: none;
}
.flow-config.open {
  display: block;
}
.flow-config-header {
  padding: 10px 14px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #6c5ce7;
  border-bottom: 1px solid rgba(108, 92, 231, 0.15);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.flow-config-close {
  font-size: 14px;
  cursor: pointer;
  color: #636e72;
  background: none;
  border: none;
  font-family: inherit;
  line-height: 1;
  padding: 2px 4px;
}
.flow-config-close:hover {
  color: #dfe6e9;
}
.flow-config-body {
  padding: 12px 14px;
}
.flow-config-field {
  margin-bottom: 10px;
}
.flow-config-field label {
  display: block;
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.8px;
  color: #636e72;
  margin-bottom: 4px;
  text-transform: uppercase;
}
.flow-config-field input,
.flow-config-field select,
.flow-config-field textarea {
  width: 100%;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  background: #1a1a2e;
  color: #dfe6e9;
  border: 1px solid rgba(108, 92, 231, 0.2);
  border-radius: 3px;
  padding: 5px 8px;
  outline: none;
  transition: border-color 0.15s;
}
.flow-config-field input:focus,
.flow-config-field select:focus,
.flow-config-field textarea:focus {
  border-color: #6c5ce7;
  box-shadow: 0 0 6px rgba(108, 92, 231, 0.2);
}
.flow-config-field textarea {
  resize: vertical;
  min-height: 60px;
}

/* ── Meta preview & webhook URL ── */
.flow-meta-preview {
  background: rgba(108, 92, 231, 0.06);
  border: 1px solid rgba(108, 92, 231, 0.15);
  border-radius: 4px;
  padding: 8px 10px;
  margin-top: 6px;
}
.flow-meta-title {
  font-size: 8px;
  font-weight: 600;
  color: #636e72;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}
.flow-meta-tag {
  display: inline-block;
  font-size: 9px;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(108, 92, 231, 0.12);
  color: #a29bfe;
  border: 1px solid rgba(108, 92, 231, 0.2);
  border-radius: 3px;
  padding: 2px 6px;
  margin: 2px 3px 2px 0;
  cursor: pointer;
  transition: background 0.15s;
}
.flow-meta-tag:hover {
  background: rgba(108, 92, 231, 0.25);
}
.flow-webhook-url {
  margin-top: 6px;
}
.flow-webhook-code {
  display: block;
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(0, 184, 148, 0.08);
  color: #00b894;
  border: 1px solid rgba(0, 184, 148, 0.2);
  border-radius: 3px;
  padding: 6px 10px;
  margin-top: 4px;
  word-break: break-all;
  user-select: all;
}
.flow-config-field select optgroup {
  font-size: 10px;
  color: #636e72;
}
.flow-config-field select option {
  font-size: 10px;
  color: #dfe6e9;
  background: #1a1a2e;
  padding: 4px;
}

/* ── Context menu ── */
.flow-context-menu {
  position: fixed;
  background: #1a1a2e;
  border: 1px solid rgba(108, 92, 231, 0.3);
  border-radius: 4px;
  padding: 4px 0;
  z-index: 100;
  min-width: 140px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}
.flow-context-item {
  padding: 6px 14px;
  font-size: 9px;
  color: #b2bec3;
  cursor: pointer;
  transition: all 0.1s;
}
.flow-context-item:hover {
  background: rgba(108, 92, 231, 0.15);
  color: #dfe6e9;
}
.flow-context-item.danger {
  color: #ff7675;
}
.flow-context-item.danger:hover {
  background: rgba(214, 48, 49, 0.15);
}

/* ── Scrollbar ── */
.flow-palette::-webkit-scrollbar,
.flow-config::-webkit-scrollbar {
  width: 4px;
}
.flow-palette::-webkit-scrollbar-track,
.flow-config::-webkit-scrollbar-track {
  background: transparent;
}
.flow-palette::-webkit-scrollbar-thumb,
.flow-config::-webkit-scrollbar-thumb {
  background: rgba(108, 92, 231, 0.2);
  border-radius: 2px;
}

/* ── Empty state ── */
.flow-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #636e72;
  font-size: 10px;
  pointer-events: none;
  z-index: 0;
}
.flow-empty .fe-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.4;
}
.flow-empty .fe-text {
  letter-spacing: 0.5px;
}
`;

// ── Config field definitions per node type ──

// ── Known system events with their meta fields ──
const KNOWN_EVENTS = {
  'message_received':  { label: 'Message Received',  icon: '\uD83D\uDCE8', meta: ['from_agent', 'to_agent', 'subject', 'type', 'priority', 'conversation_id'] },
  'signal:interrupt':  { label: 'P0 Interrupt',      icon: '\uD83D\uDEA8', meta: ['from_agent', 'to_agent', 'subject', 'type', 'priority'] },
  'task_pending':      { label: 'Task Dispatched',   icon: '\uD83D\uDCCB', meta: ['task_id', 'profile', 'priority', 'dispatched_by', 'title'] },
  'task_completed':    { label: 'Task Completed',    icon: '\u2705',       meta: ['task_id', 'profile', 'completed_by', 'title'] },
  'task_blocked':      { label: 'Task Blocked',      icon: '\uD83D\uDED1', meta: ['task_id', 'profile', 'blocked_by', 'title', 'reason'] },
  'signal:alert':      { label: 'Alert Signal',      icon: '\u26A0\uFE0F', meta: ['task_id', 'profile', 'blocked_by', 'title', 'reason'] },
  '*':                 { label: 'Any Event',          icon: '\uD83C\uDF10', meta: [] },
};

// ── Cron presets ──
const CRON_PRESETS = [
  { label: 'Every minute',      value: '* * * * *' },
  { label: 'Every 5 minutes',   value: '*/5 * * * *' },
  { label: 'Every 15 minutes',  value: '*/15 * * * *' },
  { label: 'Every hour',        value: '0 * * * *' },
  { label: 'Every 6 hours',     value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 9am',      value: '0 9 * * *' },
  { label: 'Weekly (Monday)',   value: '0 9 * * 1' },
  { label: 'Custom...',         value: '__custom__' },
];

const NODE_CONFIG_FIELDS = {
  'trigger:event':     [{ key: 'event',   label: 'Event Name',   type: 'event_select' }],
  'trigger:cron':      [{ key: 'cron',    label: 'Schedule', type: 'cron_select' }],
  'trigger:webhook':   [{ key: 'event',   label: 'Webhook Event', type: 'webhook_config' }],
  'condition:match':   [
    { key: 'field', label: 'Field',    type: 'text',   placeholder: 'e.g. payload.status' },
    { key: 'op',    label: 'Operator', type: 'select', options: ['eq', 'neq', 'contains', 'gt', 'lt'] },
    { key: 'value', label: 'Value',    type: 'text',   placeholder: 'match value' },
  ],
  'condition:switch':  [
    { key: 'field', label: 'Field', type: 'text', placeholder: 'e.g. payload.type' },
    { key: 'cases', label: 'Cases (one per line)', type: 'textarea', placeholder: 'value1\nvalue2\nvalue3\nvalue4' },
  ],
  'action:spawn':      [
    { key: 'profile', label: 'Profile',  type: 'text', placeholder: 'agent profile name' },
    { key: 'cycle',   label: 'Cycle',    type: 'text', placeholder: 'cycle name' },
    { key: 'task_id', label: 'Task ID',  type: 'text', placeholder: '(optional)' },
  ],
  'action:message':    [
    { key: 'to',      label: 'To',       type: 'text',     placeholder: 'recipient agent' },
    { key: 'subject', label: 'Subject',  type: 'text',     placeholder: 'message subject' },
    { key: 'content', label: 'Content',  type: 'textarea', placeholder: 'message body' },
    { key: 'type',    label: 'Type',     type: 'select',   options: ['text', 'json', 'directive'] },
  ],
  'action:task':       [
    { key: 'profile',     label: 'Assignee',    type: 'text',     placeholder: 'agent profile' },
    { key: 'title',       label: 'Title',       type: 'text',     placeholder: 'task title' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'task description' },
  ],
  'action:team_notify':  [{ key: 'channel', label: 'Channel', type: 'text', placeholder: 'notification channel' }],
  'action:broadcast':    [{ key: 'event',   label: 'Event',   type: 'text', placeholder: 'broadcast event' }],
  'action:webhook_out':  [
    { key: 'url',    label: 'URL',    type: 'text',   placeholder: 'https://...' },
    { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
  ],
  'action:elevate':      [
    { key: 'role',     label: 'Role',     type: 'text', placeholder: 'target role' },
    { key: 'duration', label: 'Duration', type: 'text', placeholder: 'e.g. 30m' },
  ],
  'action:schedule':     [
    { key: 'cron',   label: 'Cron Expression', type: 'text', placeholder: '*/10 * * * *' },
    { key: 'action', label: 'Action',          type: 'text', placeholder: 'action to schedule' },
  ],
};


// ── Utility: unique ID ──

let _flowUid = 0;
function flowUid() { return `fn_${++_flowUid}_${Date.now().toString(36)}`; }
let _edgeUid = 0;
function edgeUid() { return `fe_${++_edgeUid}_${Date.now().toString(36)}`; }


// ── FlowEditor class ──

export class FlowEditor {
  constructor(container, apiClient) {
    this.container = container;
    this.api = apiClient;
    this.project = null;

    // State
    this.workflows = [];
    this.currentWorkflow = null;
    this.nodes = new Map();   // nodeId -> { el, data, portEls }
    this.edges = [];          // { id, source, target, sourcePort, targetPort, pathEl }

    // Interaction state
    this.dragState = null;    // { type: 'node'|'edge'|'pan', ... }
    this.selectedNode = null;
    this.selectedEdge = null;
    this.panOffset = { x: 0, y: 0 };
    this.zoom = 1;

    // DOM refs (created in _build)
    this.root = null;
    this.palette = null;
    this.canvas = null;
    this.svgLayer = null;
    this.nodesLayer = null;
    this.configPanel = null;
    this.toolbar = null;
    this.workflowSelect = null;
    this.nameInput = null;

    this._nextNodeId = 1;
    this._boundHandlers = {};
    this._contextMenu = null;
    this._styleEl = null;
    this._tempEdgePath = null;
  }

  // ── Public API ──

  show(project) {
    this.project = project;
    this._build();
    this._loadWorkflows();
  }

  hide() {
    this._removeContextMenu();
    // Remove event listeners
    if (this._boundHandlers.keydown) {
      document.removeEventListener('keydown', this._boundHandlers.keydown);
    }
    if (this._styleEl && this._styleEl.parentNode) {
      this._styleEl.parentNode.removeChild(this._styleEl);
    }
    this.container.innerHTML = '';
    this.nodes.clear();
    this.edges = [];
    this.currentWorkflow = null;
  }

  // ── Build DOM ──

  _build() {
    this.container.innerHTML = '';

    // Inject styles
    this._styleEl = document.createElement('style');
    this._styleEl.textContent = FLOW_STYLES;
    document.head.appendChild(this._styleEl);

    // Root
    this.root = document.createElement('div');
    this.root.className = 'flow-root';
    this.container.appendChild(this.root);

    // Toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'flow-toolbar';
    this.toolbar.innerHTML = `
      <select class="flow-wf-select"></select>
      <input class="flow-wf-name" type="text" placeholder="Workflow name..." />
      <span class="flow-toolbar-spacer"></span>
      <button class="flow-btn primary flow-btn-save">SAVE</button>
      <button class="flow-btn flow-btn-run">RUN</button>
      <button class="flow-btn danger flow-btn-delete">DELETE</button>
    `;
    this.root.appendChild(this.toolbar);

    this.workflowSelect = this.toolbar.querySelector('.flow-wf-select');
    this.nameInput = this.toolbar.querySelector('.flow-wf-name');

    this.workflowSelect.addEventListener('change', () => this._onWorkflowSelect());
    this.toolbar.querySelector('.flow-btn-save').addEventListener('click', () => this._saveWorkflow());
    this.toolbar.querySelector('.flow-btn-run').addEventListener('click', () => this._runWorkflow());
    this.toolbar.querySelector('.flow-btn-delete').addEventListener('click', () => this._deleteWorkflow());

    // Body: palette + canvas + config
    const body = document.createElement('div');
    body.className = 'flow-body';
    this.root.appendChild(body);

    // Palette
    this.palette = document.createElement('div');
    this.palette.className = 'flow-palette';
    this._buildPalette();
    body.appendChild(this.palette);

    // Canvas wrapper
    this.canvas = document.createElement('div');
    this.canvas.className = 'flow-canvas-wrap';
    body.appendChild(this.canvas);

    // SVG layer
    this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgLayer.classList.add('flow-svg');
    // Neon glow filter
    this.svgLayer.innerHTML = `
      <defs>
        <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    `;
    this.canvas.appendChild(this.svgLayer);

    // Nodes layer
    this.nodesLayer = document.createElement('div');
    this.nodesLayer.className = 'flow-nodes';
    this.canvas.appendChild(this.nodesLayer);

    // Empty state
    this._emptyEl = document.createElement('div');
    this._emptyEl.className = 'flow-empty';
    this._emptyEl.innerHTML = `
      <div class="fe-icon">\u2B21</div>
      <div class="fe-text">Select or create a workflow</div>
    `;
    this.canvas.appendChild(this._emptyEl);

    // Config panel
    this.configPanel = document.createElement('div');
    this.configPanel.className = 'flow-config';
    body.appendChild(this.configPanel);

    // Event bindings
    this._boundHandlers.mousedown = (e) => this._onCanvasMouseDown(e);
    this._boundHandlers.mousemove = (e) => this._onMouseMove(e);
    this._boundHandlers.mouseup = (e) => this._onMouseUp(e);
    this._boundHandlers.wheel = (e) => this._onWheel(e);
    this._boundHandlers.contextmenu = (e) => this._onContextMenu(e);
    this._boundHandlers.keydown = (e) => this._onKeyDown(e);

    this.canvas.addEventListener('mousedown', this._boundHandlers.mousedown);
    window.addEventListener('mousemove', this._boundHandlers.mousemove);
    window.addEventListener('mouseup', this._boundHandlers.mouseup);
    this.canvas.addEventListener('wheel', this._boundHandlers.wheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this._boundHandlers.contextmenu);
    document.addEventListener('keydown', this._boundHandlers.keydown);
  }

  _buildPalette() {
    this.palette.innerHTML = '';
    for (const cat of CATEGORY_ORDER) {
      const group = document.createElement('div');
      group.className = 'flow-palette-group';
      group.textContent = CATEGORY_LABELS[cat];
      this.palette.appendChild(group);

      for (const [typeKey, def] of Object.entries(NODE_TYPES)) {
        if (def.category !== cat) continue;
        const item = document.createElement('div');
        item.className = 'flow-palette-item';
        item.style.setProperty('--node-color', def.color);
        item.innerHTML = `<span class="pi-icon">${def.icon}</span><span class="pi-label">${esc(def.label)}</span>`;
        item.addEventListener('click', () => this._addNodeAtCenter(typeKey));
        this.palette.appendChild(item);
      }
    }
  }

  // ── Workflow CRUD ──

  async _loadWorkflows() {
    try {
      this.workflows = await this.api.fetchWorkflows(this.project) || [];
    } catch {
      this.workflows = [];
    }
    this._renderWorkflowList();
  }

  _renderWorkflowList() {
    this.workflowSelect.innerHTML = '';

    const opt0 = document.createElement('option');
    opt0.value = '__new';
    opt0.textContent = '+ New Workflow';
    this.workflowSelect.appendChild(opt0);

    for (const wf of this.workflows) {
      const opt = document.createElement('option');
      opt.value = wf.id;
      opt.textContent = wf.name || `Workflow #${wf.id}`;
      if (this.currentWorkflow && this.currentWorkflow.id === wf.id) {
        opt.selected = true;
      }
      this.workflowSelect.appendChild(opt);
    }
  }

  async _onWorkflowSelect() {
    const val = this.workflowSelect.value;
    if (val === '__new') {
      this._newWorkflow();
    } else {
      await this._loadWorkflow(val);
    }
  }

  async _loadWorkflow(id) {
    try {
      this.currentWorkflow = await this.api.fetchWorkflow(id);
    } catch {
      this.currentWorkflow = null;
    }
    if (this.currentWorkflow) {
      this.nameInput.value = this.currentWorkflow.name || '';
      this._renderWorkflow();
    }
  }

  async _saveWorkflow() {
    const name = this.nameInput.value.trim() || 'Untitled';
    const definition = this._serializeWorkflow();

    if (this.currentWorkflow && this.currentWorkflow.id) {
      try {
        this.currentWorkflow = await this.api.updateWorkflow(this.currentWorkflow.id, {
          name,
          definition,
        });
      } catch (err) {
        console.error('Save workflow failed:', err);
      }
    } else {
      try {
        this.currentWorkflow = await this.api.createWorkflow({
          project: this.project,
          name,
          definition,
        });
      } catch (err) {
        console.error('Create workflow failed:', err);
      }
    }
    await this._loadWorkflows();
  }

  _newWorkflow() {
    this.currentWorkflow = { id: null, name: '', definition: { nodes: [], edges: [] } };
    this.nameInput.value = '';
    this._renderWorkflow();
  }

  async _deleteWorkflow() {
    if (!this.currentWorkflow || !this.currentWorkflow.id) return;
    if (!confirm('Delete this workflow?')) return;
    try {
      await this.api.deleteWorkflow(this.currentWorkflow.id);
    } catch (err) {
      console.error('Delete workflow failed:', err);
    }
    this.currentWorkflow = null;
    this.nameInput.value = '';
    this._clearCanvas();
    await this._loadWorkflows();
  }

  async _runWorkflow() {
    if (!this.currentWorkflow || !this.currentWorkflow.id) return;
    try {
      await this.api.executeWorkflow(this.currentWorkflow.id, {});
    } catch (err) {
      console.error('Run workflow failed:', err);
    }
  }

  // ── Serialization ──

  _serializeWorkflow() {
    const nodes = [];
    for (const [id, entry] of this.nodes) {
      nodes.push({
        id,
        type: entry.data.type,
        x: entry.data.x,
        y: entry.data.y,
        config: { ...entry.data.config },
      });
    }
    const edges = this.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourcePort: e.sourcePort,
      targetPort: e.targetPort,
    }));
    return { nodes, edges };
  }

  // ── Render workflow ──

  _renderWorkflow() {
    this._clearCanvas();

    if (!this.currentWorkflow) {
      this._emptyEl.style.display = '';
      return;
    }
    this._emptyEl.style.display = 'none';

    const def = this.currentWorkflow.definition || { nodes: [], edges: [] };

    // Render nodes
    for (const nd of def.nodes || []) {
      this._addNode(nd.type, nd.x, nd.y, nd.id, nd.config);
    }

    // Render edges
    for (const ed of def.edges || []) {
      this._addEdge(ed.source, ed.target, ed.sourcePort, ed.targetPort, ed.id);
    }

    this._updateTransform();
  }

  _clearCanvas() {
    this.nodesLayer.innerHTML = '';
    // Clear SVG edges (keep <defs>)
    const defs = this.svgLayer.querySelector('defs');
    this.svgLayer.innerHTML = '';
    if (defs) this.svgLayer.appendChild(defs);

    this.nodes.clear();
    this.edges = [];
    this.selectedNode = null;
    this.selectedEdge = null;
    this._hideConfig();
    this._emptyEl.style.display = '';
  }

  // ── Node operations ──

  _addNodeAtCenter(type) {
    if (!this.currentWorkflow) {
      this._newWorkflow();
      this._emptyEl.style.display = 'none';
    }
    const rect = this.canvas.getBoundingClientRect();
    const cx = (rect.width / 2 - this.panOffset.x) / this.zoom - 90;
    const cy = (rect.height / 2 - this.panOffset.y) / this.zoom - 30;
    this._addNode(type, Math.round(cx), Math.round(cy));
  }

  _addNode(type, x, y, id, config) {
    const nodeId = id || flowUid();
    const typeDef = NODE_TYPES[type];
    if (!typeDef) return null;

    const data = {
      id: nodeId,
      type,
      x,
      y,
      config: config || {},
    };

    const el = this._renderNodeElement(data, typeDef);
    this.nodesLayer.appendChild(el);

    const portEls = {
      inputs: Array.from(el.querySelectorAll('.port-input')),
      outputs: Array.from(el.querySelectorAll('.port-output')),
    };

    this.nodes.set(nodeId, { el, data, portEls });
    return nodeId;
  }

  _renderNodeElement(data, typeDef) {
    const el = document.createElement('div');
    el.className = 'flow-node';
    el.dataset.nodeId = data.id;
    el.style.left = `${data.x}px`;
    el.style.top = `${data.y}px`;
    el.style.setProperty('--node-color', typeDef.color);

    // Header
    const header = document.createElement('div');
    header.className = 'flow-node-header';
    header.innerHTML = `<span class="nh-icon">${typeDef.icon}</span><span class="nh-label">${esc(typeDef.label)}</span>`;
    header.addEventListener('mousedown', (e) => this._onNodeMouseDown(e, data.id));
    el.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'flow-node-body';
    body.textContent = this._getNodeSummary(data);
    el.appendChild(body);

    // Input ports
    for (let i = 0; i < typeDef.inputs; i++) {
      const port = document.createElement('div');
      port.className = 'flow-port port-input';
      const totalPorts = typeDef.inputs;
      const spacing = 60 / (totalPorts + 1);
      port.style.top = `${20 + spacing * (i + 1)}px`;
      port.dataset.portType = 'input';
      port.dataset.portIndex = i;
      port.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._onPortMouseDown(e, data.id, 'input', i);
      });
      el.appendChild(port);
    }

    // Output ports
    for (let i = 0; i < typeDef.outputs; i++) {
      const port = document.createElement('div');
      port.className = 'flow-port port-output';
      const totalPorts = typeDef.outputs;
      const spacing = 60 / (totalPorts + 1);
      port.style.top = `${20 + spacing * (i + 1)}px`;
      port.dataset.portType = 'output';
      port.dataset.portIndex = i;
      port.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this._onPortMouseDown(e, data.id, 'output', i);
      });
      el.appendChild(port);
    }

    // Click to select
    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('flow-port')) return;
      this._selectNode(data.id);
    });

    return el;
  }

  _getNodeSummary(data) {
    const cfg = data.config || {};
    switch (data.type) {
      case 'trigger:event':    return cfg.event ? `event: ${cfg.event}` : 'no event set';
      case 'trigger:cron':     return cfg.cron || 'no schedule';
      case 'trigger:webhook':  return cfg.event ? `hook: ${cfg.event}` : 'no event set';
      case 'condition:match':  return cfg.field ? `${cfg.field} ${cfg.op || '=='} ${cfg.value || '?'}` : 'not configured';
      case 'condition:switch': return cfg.field ? `switch: ${cfg.field}` : 'not configured';
      case 'action:spawn':     return cfg.profile || 'no profile';
      case 'action:message':   return cfg.to ? `to: ${cfg.to}` : 'no recipient';
      case 'action:task':      return cfg.title || cfg.profile || 'no task';
      default:                 return Object.keys(cfg).length ? JSON.stringify(cfg).slice(0, 30) : 'configure...';
    }
  }

  _removeNode(nodeId) {
    const entry = this.nodes.get(nodeId);
    if (!entry) return;

    // Remove connected edges
    this.edges = this.edges.filter(e => {
      if (e.source === nodeId || e.target === nodeId) {
        if (e.pathEl && e.pathEl.parentNode) e.pathEl.parentNode.removeChild(e.pathEl);
        return false;
      }
      return true;
    });

    if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    this.nodes.delete(nodeId);

    if (this.selectedNode === nodeId) {
      this.selectedNode = null;
      this._hideConfig();
    }
  }

  _updateNodePosition(nodeId, x, y) {
    const entry = this.nodes.get(nodeId);
    if (!entry) return;
    entry.data.x = x;
    entry.data.y = y;
    entry.el.style.left = `${x}px`;
    entry.el.style.top = `${y}px`;
    this._updateEdges();
  }

  _selectNode(nodeId) {
    // Deselect previous
    if (this.selectedNode) {
      const prev = this.nodes.get(this.selectedNode);
      if (prev) prev.el.classList.remove('selected');
    }
    // Deselect edge
    this._deselectEdge();

    this.selectedNode = nodeId;
    const entry = this.nodes.get(nodeId);
    if (entry) {
      entry.el.classList.add('selected');
      this._showConfig(nodeId);
    }
  }

  _deselectAll() {
    if (this.selectedNode) {
      const prev = this.nodes.get(this.selectedNode);
      if (prev) prev.el.classList.remove('selected');
      this.selectedNode = null;
    }
    this._deselectEdge();
    this._hideConfig();
  }

  // ── Edge operations ──

  _addEdge(source, target, sourcePort, targetPort, id) {
    // Prevent duplicate edges
    const exists = this.edges.find(e =>
      e.source === source && e.target === target &&
      e.sourcePort === sourcePort && e.targetPort === targetPort
    );
    if (exists) return;

    // Prevent self-loops
    if (source === target) return;

    const edgeId = id || edgeUid();
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.classList.add('flow-edge');
    pathEl.dataset.edgeId = edgeId;

    pathEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this._selectEdge(edgeId);
    });

    this.svgLayer.appendChild(pathEl);

    const edge = { id: edgeId, source, target, sourcePort, targetPort, pathEl };
    this.edges.push(edge);
    this._renderEdgePath(edge);
    return edgeId;
  }

  _removeEdge(edgeId) {
    const idx = this.edges.findIndex(e => e.id === edgeId);
    if (idx === -1) return;
    const edge = this.edges[idx];
    if (edge.pathEl && edge.pathEl.parentNode) edge.pathEl.parentNode.removeChild(edge.pathEl);
    this.edges.splice(idx, 1);
    if (this.selectedEdge === edgeId) {
      this.selectedEdge = null;
    }
  }

  _renderEdgePath(edge) {
    const p1 = this._getPortPosition(edge.source, 'output', edge.sourcePort);
    const p2 = this._getPortPosition(edge.target, 'input', edge.targetPort);
    if (!p1 || !p2) return;

    const dx = Math.abs(p2.x - p1.x) * 0.5;
    const offset = Math.max(80, dx);
    const d = `M ${p1.x},${p1.y} C ${p1.x + offset},${p1.y} ${p2.x - offset},${p2.y} ${p2.x},${p2.y}`;
    edge.pathEl.setAttribute('d', d);
  }

  _updateEdges() {
    for (const edge of this.edges) {
      this._renderEdgePath(edge);
    }
  }

  _selectEdge(edgeId) {
    this._deselectEdge();
    // Deselect node
    if (this.selectedNode) {
      const prev = this.nodes.get(this.selectedNode);
      if (prev) prev.el.classList.remove('selected');
      this.selectedNode = null;
      this._hideConfig();
    }

    this.selectedEdge = edgeId;
    const edge = this.edges.find(e => e.id === edgeId);
    if (edge && edge.pathEl) {
      edge.pathEl.classList.add('selected');
    }
  }

  _deselectEdge() {
    if (this.selectedEdge) {
      const edge = this.edges.find(e => e.id === this.selectedEdge);
      if (edge && edge.pathEl) edge.pathEl.classList.remove('selected');
      this.selectedEdge = null;
    }
  }

  // ── Port positions ──

  _getPortPosition(nodeId, portType, portIndex) {
    const entry = this.nodes.get(nodeId);
    if (!entry) return null;

    const typeDef = NODE_TYPES[entry.data.type];
    if (!typeDef) return null;

    const totalPorts = portType === 'input' ? typeDef.inputs : typeDef.outputs;
    const spacing = 60 / (totalPorts + 1);
    const portY = 20 + spacing * (portIndex + 1);

    const x = portType === 'output' ? entry.data.x + 180 : entry.data.x;
    const y = entry.data.y + portY;

    return { x, y };
  }

  // ── Config panel ──

  _showConfig(nodeId) {
    const entry = this.nodes.get(nodeId);
    if (!entry) return;

    const typeDef = NODE_TYPES[entry.data.type];
    const fields = NODE_CONFIG_FIELDS[entry.data.type] || [];

    this.configPanel.classList.add('open');
    this.configPanel.innerHTML = '';

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'flow-config-header';
    hdr.innerHTML = `<span>${typeDef ? esc(typeDef.label) : 'Node'}</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'flow-config-close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => this._hideConfig());
    hdr.appendChild(closeBtn);
    this.configPanel.appendChild(hdr);

    // Body
    const body = document.createElement('div');
    body.className = 'flow-config-body';

    for (const field of fields) {
      const wrap = document.createElement('div');
      wrap.className = 'flow-config-field';

      const label = document.createElement('label');
      label.textContent = field.label;
      wrap.appendChild(label);

      // ── Smart field renderers ──

      if (field.type === 'event_select') {
        // Dropdown of known events + custom
        this._renderEventSelect(wrap, entry, field.key);
      } else if (field.type === 'cron_select') {
        // Cron presets + custom input
        this._renderCronSelect(wrap, entry, field.key);
      } else if (field.type === 'webhook_config') {
        // Webhook event + auto URL display
        this._renderWebhookConfig(wrap, entry, field.key);
      } else {
        // Standard field types
        let input;
        if (field.type === 'select') {
          input = document.createElement('select');
          for (const opt of field.options) {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if (entry.data.config[field.key] === opt) o.selected = true;
            input.appendChild(o);
          }
        } else if (field.type === 'textarea') {
          input = document.createElement('textarea');
          input.value = entry.data.config[field.key] || '';
          input.placeholder = field.placeholder || '';
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.value = entry.data.config[field.key] || '';
          input.placeholder = field.placeholder || '';
        }

        const fieldKey = field.key;
        const updateFn = () => {
          entry.data.config[fieldKey] = input.value;
          const bodyEl = entry.el.querySelector('.flow-node-body');
          if (bodyEl) bodyEl.textContent = this._getNodeSummary(entry.data);
        };
        input.addEventListener('input', updateFn);
        input.addEventListener('change', updateFn);
        wrap.appendChild(input);
      }

      body.appendChild(wrap);
    }

    // If no config fields, show generic key-value editor
    if (fields.length === 0) {
      const note = document.createElement('div');
      note.style.cssText = 'font-size: 9px; color: #636e72; padding: 8px 0;';
      note.textContent = 'No specific configuration for this node type.';
      body.appendChild(note);
    }

    this.configPanel.appendChild(body);
  }

  // ── Smart trigger config renderers ──

  _renderEventSelect(wrap, entry, key) {
    const currentVal = entry.data.config[key] || '';
    const isCustom = currentVal && !KNOWN_EVENTS[currentVal];

    // Select dropdown
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;margin-bottom:6px;';

    // "Choose an event..." placeholder
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Choose an event --';
    placeholder.disabled = true;
    if (!currentVal) placeholder.selected = true;
    select.appendChild(placeholder);

    // Known events
    const knownGroup = document.createElement('optgroup');
    knownGroup.label = 'System Events';
    for (const [eventName, def] of Object.entries(KNOWN_EVENTS)) {
      const o = document.createElement('option');
      o.value = eventName;
      o.textContent = `${def.icon}  ${def.label}  (${eventName})`;
      if (currentVal === eventName) o.selected = true;
      knownGroup.appendChild(o);
    }
    select.appendChild(knownGroup);

    // Custom option
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'Custom';
    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = '\u270F\uFE0F  Custom event name...';
    if (isCustom) customOpt.selected = true;
    customGroup.appendChild(customOpt);
    select.appendChild(customGroup);

    wrap.appendChild(select);

    // Custom input (hidden unless "custom" selected)
    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = 'my_custom_event';
    customInput.value = isCustom ? currentVal : '';
    customInput.style.cssText = `display:${isCustom ? 'block' : 'none'};margin-bottom:6px;`;
    wrap.appendChild(customInput);

    // Meta fields preview
    const metaBox = document.createElement('div');
    metaBox.className = 'flow-meta-preview';
    wrap.appendChild(metaBox);

    const updateMeta = (eventName) => {
      const def = KNOWN_EVENTS[eventName];
      if (def && def.meta.length > 0) {
        metaBox.innerHTML = `<div class="flow-meta-title">Available fields:</div>` +
          def.meta.map(m => `<span class="flow-meta-tag">{{.meta.${m}}}</span>`).join('');
        metaBox.style.display = 'block';
      } else if (eventName === '__custom__' || (eventName && !def)) {
        metaBox.innerHTML = `<div class="flow-meta-title">Custom event \u2014 fields depend on the sender</div>
          <div style="font-size:9px;color:#636e72;margin-top:4px;">Webhook: POST /api/webhooks/{project}/${eventName === '__custom__' ? '{event}' : eventName}<br>Body JSON keys become meta fields</div>`;
        metaBox.style.display = 'block';
      } else {
        metaBox.style.display = 'none';
      }
    };

    const updateNode = () => {
      const bodyEl = entry.el.querySelector('.flow-node-body');
      if (bodyEl) bodyEl.textContent = this._getNodeSummary(entry.data);
    };

    select.addEventListener('change', () => {
      if (select.value === '__custom__') {
        customInput.style.display = 'block';
        customInput.focus();
        entry.data.config[key] = customInput.value || '';
      } else {
        customInput.style.display = 'none';
        entry.data.config[key] = select.value;
      }
      updateMeta(select.value === '__custom__' ? (customInput.value || '__custom__') : select.value);
      updateNode();
    });

    customInput.addEventListener('input', () => {
      entry.data.config[key] = customInput.value;
      updateMeta(customInput.value || '__custom__');
      updateNode();
    });

    // Init meta display
    updateMeta(isCustom ? '__custom__' : currentVal);
  }

  _renderCronSelect(wrap, entry, key) {
    const currentVal = entry.data.config[key] || '';
    const isPreset = CRON_PRESETS.some(p => p.value === currentVal);

    // Preset dropdown
    const select = document.createElement('select');
    select.style.cssText = 'width:100%;margin-bottom:6px;';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Choose a schedule --';
    placeholder.disabled = true;
    if (!currentVal) placeholder.selected = true;
    select.appendChild(placeholder);

    for (const preset of CRON_PRESETS) {
      const o = document.createElement('option');
      o.value = preset.value;
      o.textContent = preset.value === '__custom__' ? preset.label : `${preset.label}  (${preset.value})`;
      if (preset.value === currentVal) o.selected = true;
      if (preset.value === '__custom__' && !isPreset && currentVal) o.selected = true;
      select.appendChild(o);
    }
    wrap.appendChild(select);

    // Custom cron input
    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.placeholder = '*/10 * * * *';
    customInput.value = (!isPreset && currentVal) ? currentVal : '';
    customInput.style.cssText = `display:${(!isPreset && currentVal) ? 'block' : 'none'};margin-bottom:6px;`;
    wrap.appendChild(customInput);

    // Explanation
    const helpBox = document.createElement('div');
    helpBox.style.cssText = 'font-size:9px;color:#636e72;padding:4px 0;';
    helpBox.textContent = currentVal && currentVal !== '__custom__' ? this._cronToHuman(currentVal) : '';
    wrap.appendChild(helpBox);

    const updateNode = () => {
      const bodyEl = entry.el.querySelector('.flow-node-body');
      if (bodyEl) bodyEl.textContent = this._getNodeSummary(entry.data);
    };

    select.addEventListener('change', () => {
      if (select.value === '__custom__') {
        customInput.style.display = 'block';
        customInput.focus();
        entry.data.config[key] = customInput.value || '';
        helpBox.textContent = '';
      } else {
        customInput.style.display = 'none';
        entry.data.config[key] = select.value;
        helpBox.textContent = this._cronToHuman(select.value);
      }
      updateNode();
    });

    customInput.addEventListener('input', () => {
      entry.data.config[key] = customInput.value;
      helpBox.textContent = this._cronToHuman(customInput.value);
      updateNode();
    });
  }

  _renderWebhookConfig(wrap, entry, key) {
    const currentVal = entry.data.config[key] || '';

    // Event name input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'e.g. deploy_done, github_push';
    input.value = currentVal;
    input.style.cssText = 'width:100%;margin-bottom:8px;';
    wrap.appendChild(input);

    // Auto-generated URL display
    const urlBox = document.createElement('div');
    urlBox.className = 'flow-webhook-url';
    const updateUrl = (val) => {
      if (val) {
        urlBox.innerHTML = `<div class="flow-meta-title">Webhook URL:</div>
          <code class="flow-webhook-code">POST /api/webhooks/{project}/${esc(val)}</code>
          <div style="font-size:9px;color:#636e72;margin-top:6px;">Send a JSON body \u2014 all top-level keys become meta fields available in downstream nodes.</div>
          <div style="font-size:9px;color:#a29bfe;margin-top:4px;">Example: <code>{"branch":"main","status":"ok"}</code><br>\u2192 <code>{{.meta.branch}}</code>, <code>{{.meta.status}}</code></div>`;
      } else {
        urlBox.innerHTML = '<div style="font-size:9px;color:#636e72;">Enter an event name to generate the webhook URL</div>';
      }
    };
    wrap.appendChild(urlBox);
    updateUrl(currentVal);

    const updateNode = () => {
      const bodyEl = entry.el.querySelector('.flow-node-body');
      if (bodyEl) bodyEl.textContent = this._getNodeSummary(entry.data);
    };

    input.addEventListener('input', () => {
      entry.data.config[key] = input.value;
      updateUrl(input.value);
      updateNode();
    });
  }

  _cronToHuman(expr) {
    if (!expr) return '';
    const parts = expr.split(' ');
    if (parts.length !== 5) return expr;
    const [min, hour, dom, mon, dow] = parts;
    if (min === '*' && hour === '*') return 'Every minute';
    if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`;
    if (hour.startsWith('*/') && min === '0') return `Every ${hour.slice(2)} hours`;
    if (hour !== '*' && min !== '*' && dom === '*' && mon === '*' && dow === '*') return `Daily at ${hour.padStart(2,'0')}:${min.padStart(2,'0')}`;
    if (dow !== '*' && dom === '*') { const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; return `${days[dow] || 'Day '+dow} at ${hour.padStart(2,'0')}:${min.padStart(2,'0')}`; }
    return expr;
  }

  _hideConfig() {
    if (this.configPanel) {
      this.configPanel.classList.remove('open');
      this.configPanel.innerHTML = '';
    }
  }

  // ── Interaction: Node drag ──

  _onNodeMouseDown(e, nodeId) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    this._selectNode(nodeId);

    const entry = this.nodes.get(nodeId);
    if (!entry) return;

    this.dragState = {
      type: 'node',
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      origX: entry.data.x,
      origY: entry.data.y,
    };
  }

  // ── Interaction: Port drag (edge creation) ──

  _onPortMouseDown(e, nodeId, portType, portIndex) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Only start edge from output ports
    if (portType !== 'output') return;

    const pos = this._getPortPosition(nodeId, 'output', portIndex);
    if (!pos) return;

    // Create temp SVG path
    this._tempEdgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._tempEdgePath.classList.add('flow-edge-temp');
    this.svgLayer.appendChild(this._tempEdgePath);

    this.canvas.classList.add('connecting');

    this.dragState = {
      type: 'edge',
      sourceNode: nodeId,
      sourcePort: portIndex,
      startPos: pos,
    };
  }

  // ── Interaction: Canvas pan ──

  _onCanvasMouseDown(e) {
    if (e.target !== this.canvas && !e.target.classList.contains('flow-canvas-wrap')) return;
    if (e.button !== 0) return;
    e.preventDefault();

    this._deselectAll();
    this._removeContextMenu();

    this.dragState = {
      type: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      origPanX: this.panOffset.x,
      origPanY: this.panOffset.y,
    };
    this.canvas.classList.add('grabbing');
  }

  _onMouseMove(e) {
    if (!this.dragState) return;

    const dx = e.clientX - this.dragState.startX;
    const dy = e.clientY - this.dragState.startY;

    if (this.dragState.type === 'node') {
      const nx = this.dragState.origX + dx / this.zoom;
      const ny = this.dragState.origY + dy / this.zoom;
      this._updateNodePosition(this.dragState.nodeId, Math.round(nx), Math.round(ny));

    } else if (this.dragState.type === 'pan') {
      this.panOffset.x = this.dragState.origPanX + dx;
      this.panOffset.y = this.dragState.origPanY + dy;
      this._updateTransform();

    } else if (this.dragState.type === 'edge') {
      // Update temp edge path to follow cursor
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - this.panOffset.x) / this.zoom;
      const my = (e.clientY - rect.top - this.panOffset.y) / this.zoom;
      const sp = this.dragState.startPos;
      const offset = Math.max(80, Math.abs(mx - sp.x) * 0.5);
      const d = `M ${sp.x},${sp.y} C ${sp.x + offset},${sp.y} ${mx - offset},${my} ${mx},${my}`;
      if (this._tempEdgePath) this._tempEdgePath.setAttribute('d', d);
    }
  }

  _onMouseUp(e) {
    if (!this.dragState) return;

    if (this.dragState.type === 'edge') {
      // Check if released over an input port
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target && target.classList.contains('port-input')) {
        const targetNodeId = target.closest('.flow-node')?.dataset.nodeId;
        const targetPortIndex = parseInt(target.dataset.portIndex, 10);
        if (targetNodeId && targetNodeId !== this.dragState.sourceNode) {
          this._addEdge(
            this.dragState.sourceNode,
            targetNodeId,
            this.dragState.sourcePort,
            targetPortIndex
          );
        }
      }
      // Remove temp path
      if (this._tempEdgePath && this._tempEdgePath.parentNode) {
        this._tempEdgePath.parentNode.removeChild(this._tempEdgePath);
      }
      this._tempEdgePath = null;
      this.canvas.classList.remove('connecting');
    }

    if (this.dragState.type === 'pan') {
      this.canvas.classList.remove('grabbing');
    }

    this.dragState = null;
  }

  // ── Zoom ──

  _onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    const newZoom = Math.max(0.25, Math.min(2.0, this.zoom + delta));

    // Zoom toward cursor
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const scale = newZoom / this.zoom;
    this.panOffset.x = mx - scale * (mx - this.panOffset.x);
    this.panOffset.y = my - scale * (my - this.panOffset.y);
    this.zoom = newZoom;

    this._updateTransform();
  }

  _updateTransform() {
    const t = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoom})`;
    this.nodesLayer.style.transform = t;
    this.svgLayer.style.transform = t;
  }

  // ── Context menu ──

  _onContextMenu(e) {
    e.preventDefault();
    this._removeContextMenu();

    const items = [];
    const nodeEl = e.target.closest('.flow-node');

    if (nodeEl) {
      const nodeId = nodeEl.dataset.nodeId;
      items.push({ label: 'Configure', action: () => this._selectNode(nodeId) });
      items.push({ label: 'Duplicate', action: () => this._duplicateNode(nodeId) });
      items.push({ label: 'Delete Node', cls: 'danger', action: () => this._removeNode(nodeId) });
    } else {
      // Canvas context menu: add node submenu by category
      for (const [typeKey, def] of Object.entries(NODE_TYPES)) {
        items.push({
          label: `${def.icon} ${def.label}`,
          action: () => {
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.panOffset.x) / this.zoom;
            const y = (e.clientY - rect.top - this.panOffset.y) / this.zoom;
            if (!this.currentWorkflow) {
              this._newWorkflow();
              this._emptyEl.style.display = 'none';
            }
            this._addNode(typeKey, Math.round(x), Math.round(y));
          },
        });
      }
    }

    const menu = document.createElement('div');
    menu.className = 'flow-context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    for (const item of items) {
      const el = document.createElement('div');
      el.className = `flow-context-item${item.cls ? ' ' + item.cls : ''}`;
      el.textContent = item.label;
      el.addEventListener('click', () => {
        this._removeContextMenu();
        item.action();
      });
      menu.appendChild(el);
    }

    document.body.appendChild(menu);
    this._contextMenu = menu;

    // Close on next click
    const close = (ev) => {
      if (!menu.contains(ev.target)) {
        this._removeContextMenu();
        document.removeEventListener('mousedown', close);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
  }

  _removeContextMenu() {
    if (this._contextMenu && this._contextMenu.parentNode) {
      this._contextMenu.parentNode.removeChild(this._contextMenu);
    }
    this._contextMenu = null;
  }

  // ── Keyboard ──

  _onKeyDown(e) {
    // Only handle when flow editor is visible
    if (!this.root || !this.root.offsetParent) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (this.selectedNode) {
        this._removeNode(this.selectedNode);
      } else if (this.selectedEdge) {
        this._removeEdge(this.selectedEdge);
      }
    }

    if (e.key === 'Escape') {
      this._deselectAll();
      this._removeContextMenu();
    }
  }

  // ── Helpers ──

  _duplicateNode(nodeId) {
    const entry = this.nodes.get(nodeId);
    if (!entry) return;
    this._addNode(entry.data.type, entry.data.x + 30, entry.data.y + 30, null, { ...entry.data.config });
  }
}
