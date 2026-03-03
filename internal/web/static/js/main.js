import { CanvasEngine } from "./canvas.js";
import { WorldBackground, World } from "./world.js";
import { AgentView } from "./agent-view.js";
import { APIClient } from "./api-client.js";
import { MessageOrb } from "./message-orb.js";

// --- Composite key for cross-project agent identity ---
function agentKey(project, name) {
  return `${project}:${name}`;
}

// DOM elements
const canvas = document.getElementById("relay-canvas");
const statusDot = document.getElementById("status-dot");
const agentCountEl = document.getElementById("agent-count");
const messagesTitle = document.getElementById("messages-title");
const messagesList = document.getElementById("messages-list");
const detailPanel = document.getElementById("agent-detail");
const detailName = document.getElementById("detail-name");
const detailRole = document.getElementById("detail-role");
const detailDesc = document.getElementById("detail-desc");
const detailProject = document.getElementById("detail-project");
const detailStatus = document.getElementById("detail-status");
const detailLastSeen = document.getElementById("detail-last-seen");
const detailRegistered = document.getElementById("detail-registered");
const detailClose = document.getElementById("detail-close");
const detailReportsTo = document.getElementById("detail-reports-to");
const detailDirectReports = document.getElementById("detail-direct-reports");
const userQuestionsPanel = document.getElementById("user-questions");

// State
const engine = new CanvasEngine(canvas);
const worldBg = new WorldBackground();
const world = new World();
const agentViews = new Map();      // "project:name" -> AgentView
let projectGroups = new Map();      // project -> Set<agentKey>
let conversations = [];             // cached conversation list
let focusedAgent = null;            // "project:name" of focused agent, or null
let focusedProject = null;          // project name when zoomed into a cluster, or null
let paletteCounter = 0;
let agentsData = [];                // cached raw agent data for hierarchy
let connected = false;
let firstLayout = true;

engine.add(worldBg);
engine.add(world);
engine.start();

// --- Cluster layout ---

function layoutAgents() {
  const projects = [...projectGroups.keys()].sort();
  const count = agentViews.size;
  if (count === 0) {
    world.clusters = [];
    return;
  }

  // World-space origin
  const cx = engine.width / 2;
  const cy = engine.height / 2;

  if (projects.length <= 1) {
    // --- Single project: fill the viewport ---
    const project = projects[0] || "default";
    const keys = projectGroups.get(project) || new Set();
    const agentCount = keys.size;

    // Use 35% of the smaller viewport dimension as radius
    // This guarantees agents fill the screen at zoom 1.0
    const radius = agentCount > 1
      ? Math.min(engine.width, engine.height) * 0.35
      : 0;

    let i = 0;
    for (const key of keys) {
      const av = agentViews.get(key);
      if (!av) continue;
      if (agentCount === 1) {
        av.targetX = cx;
        av.targetY = cy;
      } else {
        const angle = -Math.PI / 2 + (i / agentCount) * Math.PI * 2;
        av.targetX = cx + Math.cos(angle) * radius;
        av.targetY = cy + Math.sin(angle) * radius;
      }
      i++;
    }

    world.clusters = [{ project, cx, cy, radius: radius + 60, hidden: true }];

    // Camera: just center on agents at zoom 1.0 — positions are already viewport-relative
    if (firstLayout) {
      engine.camera.snapTo(cx, cy, 1.0);
      firstLayout = false;
    } else {
      engine.camera.lookAt(cx, cy, 1.0);
    }
  } else {
    // --- Multiple projects: clusters on a large circle ---
    // Each cluster's inner radius fills proportionally
    const clusterData = projects.map(project => {
      const keys = projectGroups.get(project) || new Set();
      const agentCount = keys.size;
      // Inner radius: at least 120px spacing between agents, min 80
      const minBySpacing = agentCount > 1 ? (120 * agentCount) / (2 * Math.PI) : 0;
      const innerRadius = Math.max(minBySpacing, 80);
      return { project, keys, agentCount, innerRadius };
    });

    const maxClusterRadius = Math.max(...clusterData.map(c => c.innerRadius));
    const outerRadius = Math.max(maxClusterRadius * 2.5 + 200,
      (300 * projects.length) / (2 * Math.PI));

    const clusters = [];
    for (let pi = 0; pi < clusterData.length; pi++) {
      const { project, keys, agentCount, innerRadius } = clusterData[pi];

      const outerAngle = -Math.PI / 2 + (pi / projects.length) * Math.PI * 2;
      const clusterCx = cx + Math.cos(outerAngle) * outerRadius;
      const clusterCy = cy + Math.sin(outerAngle) * outerRadius;

      let i = 0;
      for (const key of keys) {
        const av = agentViews.get(key);
        if (!av) continue;
        if (agentCount === 1) {
          av.targetX = clusterCx;
          av.targetY = clusterCy;
        } else {
          const angle = -Math.PI / 2 + (i / agentCount) * Math.PI * 2;
          av.targetX = clusterCx + Math.cos(angle) * innerRadius;
          av.targetY = clusterCy + Math.sin(angle) * innerRadius;
        }
        i++;
      }

      clusters.push({ project, cx: clusterCx, cy: clusterCy, radius: innerRadius + 60 });
    }

    world.clusters = clusters;

    // Fit camera to show all clusters
    if (focusedProject) {
      const cluster = clusters.find(c => c.project === focusedProject);
      if (cluster) fitToCluster(cluster);
      else fitToAllClusters();
    } else {
      fitToAllClusters();
    }
  }
}

/** Smoothly fit camera to show a single cluster (multi-project zoom). */
function fitToCluster(cluster) {
  const diam = (cluster.radius + 40) * 2;
  const zoomX = (engine.width * 0.8) / diam;
  const zoomY = (engine.height * 0.8) / diam;
  const zoom = Math.max(0.15, Math.min(zoomX, zoomY));

  if (firstLayout) {
    engine.camera.snapTo(cluster.cx, cluster.cy, zoom);
    firstLayout = false;
  } else {
    engine.camera.lookAt(cluster.cx, cluster.cy, zoom);
  }
}

/** Smoothly fit camera to show all clusters (multi-project overview). */
function fitToAllClusters() {
  const clusters = world.clusters;
  if (clusters.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of clusters) {
    minX = Math.min(minX, c.cx - c.radius);
    minY = Math.min(minY, c.cy - c.radius);
    maxX = Math.max(maxX, c.cx + c.radius);
    maxY = Math.max(maxY, c.cy + c.radius);
  }

  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const zoomX = (engine.width * 0.85) / contentW;
  const zoomY = (engine.height * 0.85) / contentH;
  const zoom = Math.max(0.15, Math.min(zoomX, zoomY));

  if (firstLayout) {
    engine.camera.snapTo(centerX, centerY, zoom);
    firstLayout = false;
  } else {
    engine.camera.lookAt(centerX, centerY, zoom);
  }
}

// --- API callbacks ---

function onAgents(agents) {
  if (!connected) {
    connected = true;
    statusDot.classList.add("connected");
  }

  agentCountEl.textContent = `${agents.length} agent${agents.length !== 1 ? "s" : ""}`;

  const currentKeys = new Set(agents.map(a => agentKey(a.project || "default", a.name)));

  // Remove agents that no longer exist
  for (const [key, av] of agentViews) {
    if (!currentKeys.has(key)) {
      engine.remove(av);
      agentViews.delete(key);
    }
  }

  // Rebuild project groups
  projectGroups = new Map();

  // Add/update agents
  for (const a of agents) {
    const project = a.project || "default";
    const key = agentKey(project, a.name);

    // Track project groups
    if (!projectGroups.has(project)) projectGroups.set(project, new Set());
    projectGroups.get(project).add(key);

    let av = agentViews.get(key);
    if (!av) {
      av = new AgentView(a.name, a.role, a.description, paletteCounter++, a.online, project);
      av.setPosition(engine.width / 2, engine.height / 2);
      av.spawnEffect();
      agentViews.set(key, av);
      engine.add(av);
    } else {
      av.online = a.online;
      av.role = a.role;
      av.description = a.description;
    }
    av._reportsTo = a.reports_to || null;
    av._lastSeenRaw = a.last_seen;
    av._registeredRaw = a.registered_at;
  }

  agentsData = agents;

  // Only show project tags when there are multiple projects
  const multiProject = projectGroups.size > 1;
  for (const [, av] of agentViews) {
    av.showProjectTag = multiProject;
  }

  layoutAgents();
  updateHighlights();
  updateHierarchyLinks();
}

function onConversations(convs) {
  conversations = convs;
}

function onNewMessages(msgs) {
  checkForUserQuestions(msgs);

  for (const msg of msgs) {
    const msgProject = msg.project || "default";
    const fromKey = agentKey(msgProject, msg.from);
    const fromAv = agentViews.get(fromKey);

    if (fromAv) {
      const preview = msg.subject || msg.content.slice(0, 80);
      fromAv.showBubble(preview, "speech");
    }

    if (fromAv && msg.to && msg.to !== "*") {
      const toKey = agentKey(msgProject, msg.to);
      const toAv = agentViews.get(toKey);
      if (toAv) {
        const orb = new MessageOrb(
          fromAv.x, fromAv.y,
          toAv.x, toAv.y,
          msg.type || "default",
          () => engine.remove(orb)
        );
        engine.add(orb);
      }
    } else if (fromAv && msg.to === "*") {
      for (const [key, av] of agentViews) {
        if (key !== fromKey) {
          const orb = new MessageOrb(
            fromAv.x, fromAv.y,
            av.x, av.y,
            msg.type || "notification",
            () => engine.remove(orb)
          );
          engine.add(orb);
        }
      }
    } else if (fromAv && msg.conversation_id) {
      const conv = conversations.find(c => c.id === msg.conversation_id);
      if (conv && conv.members) {
        for (const member of conv.members) {
          if (member !== msg.from) {
            const targetKey = agentKey(msgProject, member);
            const targetAv = agentViews.get(targetKey);
            if (targetAv) {
              const orb = new MessageOrb(
                fromAv.x, fromAv.y,
                targetAv.x, targetAv.y,
                msg.type || "default",
                () => engine.remove(orb)
              );
              engine.add(orb);
            }
          }
        }
      }
    }

    // Append to messages panel respecting focus context
    if (focusedAgent) {
      const focusAv = agentViews.get(focusedAgent);
      if (focusAv && msgProject === focusAv.project &&
          (msg.from === focusAv.name || msg.to === focusAv.name)) {
        appendMessage(msg);
      }
    } else if (focusedProject) {
      if (msgProject === focusedProject) {
        appendMessage(msg);
      }
    } else {
      appendMessage(msg);
    }
  }
}

// --- Focus / Highlights ---

function updateHighlights() {
  for (const [, av] of agentViews) {
    av.highlighted = true;
    av.dimMode = false;
  }
}

async function loadMessages() {
  messagesList.innerHTML = "";

  const allMsgs = await client.fetchAllMessagesAllProjects();
  let filtered;

  if (focusedAgent) {
    const av = agentViews.get(focusedAgent);
    if (!av) return;
    messagesTitle.textContent = `${av.name}`;
    filtered = allMsgs.filter(m => {
      const mp = m.project || "default";
      return mp === av.project && (m.from === av.name || m.to === av.name);
    });
  } else if (focusedProject) {
    messagesTitle.textContent = focusedProject;
    filtered = allMsgs.filter(m => (m.project || "default") === focusedProject);
  } else {
    messagesTitle.textContent = "All Messages";
    filtered = allMsgs;
  }

  if (filtered.length === 0) {
    messagesList.innerHTML = '<div class="msg-empty">No messages yet</div>';
    return;
  }

  for (const msg of filtered) {
    appendMessage(msg);
  }
  messagesList.scrollTop = messagesList.scrollHeight;
}

function appendMessage(msg, showConv = false) {
  const el = document.createElement("div");
  el.className = "msg-item";

  const time = formatTime(msg.created_at);
  const subject = msg.subject ? `<span class="msg-subject">${escapeHtml(msg.subject)}</span>` : "";
  const content = msg.content.length > 500 ? msg.content.slice(0, 497) + "..." : msg.content;

  let convTag = "";
  if (showConv && msg.conversation_id) {
    const conv = conversations.find(c => c.id === msg.conversation_id);
    const convName = conv ? conv.title : "DM";
    convTag = `<span class="msg-conv-tag">${escapeHtml(convName)}</span> `;
  }

  // Show project tag for cross-project view
  let projectTag = "";
  const msgProject = msg.project || "default";
  if (projectGroups.size > 1 && msgProject !== "default") {
    projectTag = `<span class="msg-conv-tag">${escapeHtml(msgProject)}</span> `;
  }

  el.innerHTML = `
    ${subject}
    ${projectTag}${convTag}<span class="msg-from">${escapeHtml(msg.from)}</span>
    <span class="msg-content">${escapeHtml(content)}</span>
    <div class="msg-time">${time}</div>
  `;

  messagesList.appendChild(el);
  messagesList.scrollTop = messagesList.scrollHeight;
}

// --- Hierarchy links ---

function updateHierarchyLinks() {
  const links = [];
  for (const [, av] of agentViews) {
    if (av._reportsTo) {
      // Look up manager within the same project
      const managerKey = agentKey(av.project, av._reportsTo);
      const managerAv = agentViews.get(managerKey);
      if (managerAv) {
        links.push({ from: managerAv, to: av });
      }
    }
  }
  world.hierarchyLinks = links;
}

// --- User question cards ---

const shownQuestions = new Set();

function checkForUserQuestions(msgs) {
  for (const msg of msgs) {
    if (msg.type === "user_question" && !shownQuestions.has(msg.id)) {
      shownQuestions.add(msg.id);
      showUserQuestionCard(msg);
    }
  }
}

function showUserQuestionCard(msg) {
  const card = document.createElement("div");
  card.className = "user-question-card";
  card.dataset.msgId = msg.id;

  const fromLabel = msg.from || "agent";
  const subject = msg.subject || "";
  const content = msg.content || "";
  const msgProject = msg.project || "default";

  card.innerHTML = `
    <div class="uq-from">${escapeHtml(fromLabel)}</div>
    <div class="uq-subject">${escapeHtml(subject)}</div>
    <div class="uq-content">${escapeHtml(content)}</div>
    <textarea placeholder="Type your response..."></textarea>
    <button>Respond</button>
  `;

  const textarea = card.querySelector("textarea");
  const button = card.querySelector("button");

  button.addEventListener("click", async () => {
    const response = textarea.value.trim();
    if (!response) return;
    button.disabled = true;
    button.textContent = "Sending...";

    const ok = await client.sendUserResponse(msgProject, msg.from, response, msg.id);
    if (ok) {
      card.style.opacity = "0";
      card.style.transition = "opacity 0.3s ease";
      setTimeout(() => card.remove(), 300);
    } else {
      button.disabled = false;
      button.textContent = "Respond";
    }
  });

  userQuestionsPanel.appendChild(card);
}

// --- Agent detail panel ---

function openDetail(av) {
  focusedAgent = agentKey(av.project, av.name);
  detailPanel.classList.add("open");
  detailName.textContent = av.name;
  detailName.style.color = av.color;
  detailRole.textContent = av.role || "\u2014";
  detailDesc.textContent = av.description || "\u2014";
  detailProject.textContent = av.project !== "default" ? `Project: ${av.project}` : "";
  detailStatus.textContent = av.online ? "Online" : "Offline";
  detailStatus.style.color = av.online ? "#00e676" : "#636e72";
  detailLastSeen.textContent = formatTime(av._lastSeenRaw);
  detailRegistered.textContent = formatTime(av._registeredRaw);

  // Reports To
  if (av._reportsTo) {
    detailReportsTo.innerHTML = "";
    const link = document.createElement("span");
    link.className = "detail-hierarchy-link";
    link.textContent = av._reportsTo;
    link.addEventListener("click", () => {
      const managerKey = agentKey(av.project, av._reportsTo);
      const managerAv = agentViews.get(managerKey);
      if (managerAv) openDetail(managerAv);
    });
    detailReportsTo.appendChild(link);
  } else {
    detailReportsTo.textContent = "\u2014";
  }

  // Direct Reports
  const directReports = [];
  for (const a of agentsData) {
    const aProject = a.project || "default";
    if (a.reports_to === av.name && aProject === av.project) {
      directReports.push(a.name);
    }
  }

  if (directReports.length > 0) {
    detailDirectReports.innerHTML = "";
    const container = document.createElement("div");
    container.className = "detail-reports-list";
    for (const name of directReports) {
      const tag = document.createElement("span");
      tag.className = "detail-report-tag";
      tag.textContent = name;
      tag.addEventListener("click", () => {
        const reportKey = agentKey(av.project, name);
        const reportAv = agentViews.get(reportKey);
        if (reportAv) openDetail(reportAv);
      });
      container.appendChild(tag);
    }
    detailDirectReports.appendChild(container);
  } else {
    detailDirectReports.textContent = "\u2014";
  }

  // Filter messages to this agent
  loadMessages();
}

detailClose.addEventListener("click", () => {
  detailPanel.classList.remove("open");
  focusedAgent = null;
  loadMessages();
});

// --- Pan/Zoom input handlers ---

let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragMoved = false;

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  // Check if clicking on an agent (don't start pan)
  const wp = engine.camera.screenToWorld(sx, sy, engine.width, engine.height);
  for (const [, av] of agentViews) {
    if (av.hitTest(wp.x, wp.y)) {
      return; // Let the click handler deal with it
    }
  }

  dragging = true;
  dragMoved = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
});

canvas.addEventListener("mousemove", (e) => {
  if (dragging) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      dragMoved = true;
    }
    engine.camera.pan(dx, dy);
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    canvas.style.cursor = "grabbing";
    return;
  }

  // Hover cursor
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const wp = engine.camera.screenToWorld(sx, sy, engine.width, engine.height);

  let hovering = false;
  for (const [, av] of agentViews) {
    if (av.hitTest(wp.x, wp.y)) {
      hovering = true;
      break;
    }
  }
  canvas.style.cursor = hovering ? "pointer" : "default";
});

canvas.addEventListener("mouseup", () => {
  dragging = false;
  canvas.style.cursor = "default";
});

canvas.addEventListener("mouseleave", () => {
  dragging = false;
});

// Click handler (uses world coords)
canvas.addEventListener("click", (e) => {
  if (dragMoved) return; // Was a pan drag, not a click

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const wp = engine.camera.screenToWorld(sx, sy, engine.width, engine.height);

  // 1. Check agent hit
  for (const [, av] of agentViews) {
    if (av.hitTest(wp.x, wp.y)) {
      openDetail(av);
      return;
    }
  }

  // 2. Check cluster hit — click inside a cluster circle → zoom to that project
  for (const cluster of world.clusters) {
    const dx = wp.x - cluster.cx;
    const dy = wp.y - cluster.cy;
    if (dx * dx + dy * dy <= cluster.radius * cluster.radius) {
      if (focusedProject !== cluster.project) {
        focusedProject = cluster.project;
        focusedAgent = null;
        detailPanel.classList.remove("open");
        fitToCluster(cluster);
        loadMessages();
        return;
      }
      // Already focused on this cluster — do nothing
      return;
    }
  }

  // 3. Click on empty space → zoom back to show all, clear focus
  detailPanel.classList.remove("open");
  focusedAgent = null;
  if (focusedProject) {
    focusedProject = null;
    fitToAllClusters();
  }
  loadMessages();
});

// Zoom with wheel
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  engine.camera.zoomAt(sx, sy, e.deltaY, engine.width, engine.height);
}, { passive: false });

// Re-layout + re-fit on resize
window.addEventListener("resize", () => {
  layoutAgents();
});

// --- Helpers ---

function formatTime(isoStr) {
  if (!isoStr) return "\u2014";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Memory panel ---

const tabMessages = document.getElementById("tab-messages");
const tabMemories = document.getElementById("tab-memories");
const messagesPanel = document.getElementById("messages-panel");
const memoriesPanel = document.getElementById("memories-panel");
const memoriesList = document.getElementById("memories-list");
const memoriesSearch = document.getElementById("memories-search");
const memoriesScopeFilter = document.getElementById("memories-scope-filter");
const memoriesProjectFilter = document.getElementById("memories-project-filter");
const memoryCountEl = document.getElementById("memory-count");

let activeTab = "messages";

tabMessages.addEventListener("click", () => {
  activeTab = "messages";
  tabMessages.classList.add("active");
  tabMemories.classList.remove("active");
  messagesPanel.classList.remove("hidden");
  memoriesPanel.classList.add("hidden");
});

tabMemories.addEventListener("click", () => {
  activeTab = "memories";
  tabMemories.classList.add("active");
  tabMessages.classList.remove("active");
  memoriesPanel.classList.remove("hidden");
  messagesPanel.classList.add("hidden");
  loadMemories();
});

let searchTimeout = null;
memoriesSearch.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadMemories(), 300);
});
memoriesScopeFilter.addEventListener("change", () => loadMemories());
memoriesProjectFilter.addEventListener("change", () => loadMemories());

async function loadMemories() {
  const query = memoriesSearch.value.trim();
  const scope = memoriesScopeFilter.value;
  const project = memoriesProjectFilter.value;

  let memories;
  if (query) {
    memories = await client.searchMemories(query);
    if (scope) memories = memories.filter(m => m.scope === scope);
    if (project) memories = memories.filter(m => m.project === project);
  } else {
    memories = await client.fetchMemories({ scope, project });
  }

  memoryCountEl.textContent = memories.length;
  renderMemories(memories);
}

function renderMemories(memories) {
  memoriesList.innerHTML = "";

  if (memories.length === 0) {
    memoriesList.innerHTML = '<div class="msg-empty">No memories yet</div>';
    return;
  }

  // Update project filter options from data
  const projects = new Set(memories.map(m => m.project));
  const currentVal = memoriesProjectFilter.value;
  memoriesProjectFilter.innerHTML = '<option value="">All projects</option>';
  for (const p of [...projects].sort()) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    if (p === currentVal) opt.selected = true;
    memoriesProjectFilter.appendChild(opt);
  }

  for (const mem of memories) {
    const el = document.createElement("div");
    el.className = "memory-item" + (mem.conflict_with ? " memory-conflict" : "");

    const tags = parseTags(mem.tags);
    const tagsHtml = tags.map(t => `<span class="memory-tag">${escapeHtml(t)}</span>`).join("");

    const val = mem.value.length > 200 ? mem.value.slice(0, 200) + "..." : mem.value;
    const time = formatTime(mem.updated_at);

    el.innerHTML = `
      <div class="memory-header">
        <span class="memory-key">${escapeHtml(mem.key)}</span>
        <span class="memory-scope memory-scope-${mem.scope}">${mem.scope}</span>
        ${mem.conflict_with ? '<span class="memory-conflict-badge">CONFLICT</span>' : ""}
      </div>
      <div class="memory-value">${escapeHtml(val)}</div>
      <div class="memory-meta">
        <span class="memory-agent">${escapeHtml(mem.agent_name)}</span>
        <span class="memory-confidence">${mem.confidence}</span>
        <span class="memory-version">v${mem.version}</span>
        ${tagsHtml}
        <span class="memory-time">${time}</span>
      </div>
      <div class="memory-actions">
        <button class="memory-delete-btn" title="Archive">&#x2715;</button>
      </div>
    `;

    el.querySelector(".memory-delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = await client.deleteMemory(mem.id);
      if (ok) {
        el.style.opacity = "0";
        setTimeout(() => { el.remove(); loadMemories(); }, 200);
      }
    });

    el.addEventListener("click", () => {
      const existing = el.querySelector(".memory-expanded");
      if (existing) {
        existing.remove();
        return;
      }
      const expanded = document.createElement("div");
      expanded.className = "memory-expanded";
      expanded.textContent = mem.value;
      el.appendChild(expanded);
    });

    memoriesList.appendChild(el);
  }
}

function parseTags(tagsStr) {
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Poll memories every 15s when tab is active
setInterval(() => {
  if (activeTab === "memories") loadMemories();
}, 15000);

// --- Start ---

console.log("[relay] UI initializing...");
const client = new APIClient(onAgents, onConversations, onNewMessages);
client.start();
loadMessages();
console.log("[relay] polling started");
