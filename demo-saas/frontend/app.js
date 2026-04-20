// BurnMeter — vanilla frontend. Wires the SSE stream and the REST API to the DOM.

const $ = (id) => document.getElementById(id);

const el = {
  amount:     $("amount"),
  clock:      $("clock"),
  ticker:     document.querySelector(".ticker"),
  startBtn:   $("start-btn"),
  pauseBtn:   $("pause-btn"),
  resetBtn:   $("reset-btn"),
  attendees:  $("attendees-input"),
  saveBtn:    $("save-btn"),
  chipList:   $("chip-list"),
  sumline:    $("sumline"),
  ouch:       $("ouch-input"),
  share:      document.querySelector(".share"),
  roomUrl:    $("room-url"),
  copyBtn:    $("copy-btn"),
  status:     $("status"),
};

const state = {
  id: null,
  running: false,
  ouchUSD: 500,
  lastCost: 0,
  lastElapsed: 0,
  stream: null,
};

// ── API ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const createMeeting = ()          => api("POST", "/api/meeting", {});
const getMeeting    = (id)        => api("GET",  `/api/meeting/${id}`);
const putAttendees  = (id, list)  => api("POST", `/api/meeting/${id}/attendees`, { attendees: list });
const startMeeting  = (id)        => api("POST", `/api/meeting/${id}/start`, {});
const pauseMeeting  = (id)        => api("POST", `/api/meeting/${id}/pause`, {});
const resetMeeting  = (id)        => api("POST", `/api/meeting/${id}/reset`, {});

// ── parsing ─────────────────────────────────────────────────────────
function parseAttendees(text) {
  return text
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter(Boolean)
    .map((ln) => {
      const [name, rateRaw] = ln.split(",").map((s) => s.trim());
      const rate = parseFloat(rateRaw);
      if (!name || !Number.isFinite(rate)) return null;
      return { name, rate };
    })
    .filter(Boolean);
}

// ── rendering ───────────────────────────────────────────────────────
function fmtMoney(n) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtClock(totalSeconds) {
  const s = Math.floor(totalSeconds);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function renderTicker(costUSD, elapsedS) {
  state.lastCost = costUSD;
  state.lastElapsed = elapsedS;
  const money = fmtMoney(costUSD);
  el.amount.textContent = `${money} burned`;
  el.clock.textContent  = fmtClock(elapsedS);

  const ouch = costUSD >= state.ouchUSD && state.ouchUSD > 0;
  el.ticker.classList.toggle("ouch", ouch);
  document.title = ouch
    ? `🔥 ${money} — BurnMeter`
    : `BurnMeter — ${money}`;
}

function renderChips(attendees) {
  el.chipList.innerHTML = "";
  let sum = 0;
  for (const a of attendees) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="name"></span><span class="rate"></span>`;
    li.querySelector(".name").textContent = a.name;
    li.querySelector(".rate").textContent = `$${a.rate}/hr`;
    el.chipList.appendChild(li);
    sum += a.rate;
  }
  el.sumline.textContent = attendees.length
    ? `${attendees.length} attendee${attendees.length === 1 ? "" : "s"} · burn rate ${fmtMoney(sum)}/hr`
    : "—";
}

function renderControls(running, hasAttendees) {
  state.running = running;
  el.startBtn.disabled = running || !hasAttendees;
  el.pauseBtn.disabled = !running;
  el.resetBtn.disabled = false;
  el.status.textContent = running ? "running" : "idle";
}

function renderShareUrl(id) {
  const url = `${location.origin}/m/${id}`;
  el.roomUrl.textContent = url;
  el.share.hidden = false;
}

// ── SSE ─────────────────────────────────────────────────────────────
function openStream(id) {
  closeStream();
  const es = new EventSource(`/api/meeting/${id}/tick`);
  es.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data);
      if (typeof d.cost_usd === "number" && typeof d.elapsed_s === "number") {
        renderTicker(d.cost_usd, d.elapsed_s);
      }
    } catch { /* ignore malformed frames */ }
  };
  es.onerror = () => { /* browser auto-retries; no-op */ };
  state.stream = es;
}

function closeStream() {
  if (state.stream) {
    state.stream.close();
    state.stream = null;
  }
}

// ── orchestration ───────────────────────────────────────────────────
function applyMeeting(m) {
  state.ouchUSD = m.ouch_usd ?? state.ouchUSD;
  renderChips(m.attendees || []);
  renderControls(!!m.running, (m.attendees || []).length > 0);
  renderTicker(m.cost_usd || 0, m.elapsed_s || 0);
}

async function boot() {
  const hashId = location.hash.replace(/^#/, "").trim();
  const pathMatch = location.pathname.match(/^\/m\/([a-f0-9]{8})$/);
  let id = pathMatch ? pathMatch[1] : (hashId || null);

  if (!id) {
    const created = await createMeeting();
    id = created.id;
    history.replaceState({}, "", `/m/${id}`);
  }

  state.id = id;
  renderShareUrl(id);

  try {
    const m = await getMeeting(id);
    applyMeeting(m);
    if (m.attendees && m.attendees.length) {
      el.attendees.value = m.attendees.map((a) => `${a.name}, ${a.rate}`).join("\n");
    }
    openStream(id);
  } catch (err) {
    el.status.textContent = `error: ${err.message}`;
  }
}

// ── events ──────────────────────────────────────────────────────────
el.saveBtn.addEventListener("click", async () => {
  const list = parseAttendees(el.attendees.value);
  if (!list.length) {
    el.status.textContent = "need at least one attendee (e.g. Priya, 180)";
    return;
  }
  try {
    const m = await putAttendees(state.id, list);
    applyMeeting(m);
    el.status.textContent = "attendees saved";
  } catch (err) {
    el.status.textContent = `error: ${err.message}`;
  }
});

el.startBtn.addEventListener("click", async () => {
  try {
    const m = await startMeeting(state.id);
    applyMeeting(m);
    openStream(state.id);
  } catch (err) {
    el.status.textContent = `error: ${err.message}`;
  }
});

el.pauseBtn.addEventListener("click", async () => {
  try {
    const m = await pauseMeeting(state.id);
    applyMeeting(m);
  } catch (err) {
    el.status.textContent = `error: ${err.message}`;
  }
});

el.resetBtn.addEventListener("click", async () => {
  try {
    const m = await resetMeeting(state.id);
    applyMeeting(m);
  } catch (err) {
    el.status.textContent = `error: ${err.message}`;
  }
});

el.ouch.addEventListener("input", () => {
  const v = parseFloat(el.ouch.value);
  if (Number.isFinite(v) && v >= 0) {
    state.ouchUSD = v;
    renderTicker(state.lastCost, state.lastElapsed);
  }
});

el.attendees.addEventListener("input", () => {
  renderChips(parseAttendees(el.attendees.value));
});

el.copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(el.roomUrl.textContent);
    el.copyBtn.textContent = "copied";
    setTimeout(() => { el.copyBtn.textContent = "copy"; }, 1200);
  } catch {
    el.copyBtn.textContent = "—";
  }
});

window.addEventListener("beforeunload", closeStream);

boot();
