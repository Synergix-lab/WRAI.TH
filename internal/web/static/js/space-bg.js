/**
 * SpaceBackground — Cinematic living universe.
 *
 * L0: Deep space gradient + ambient aurora glow
 * L1: Procedural nebula clouds (animated gradient blobs)
 * L2: 3-depth starfield (far/mid/near) with colored stars
 * L3: Star clusters (dense pockets)
 * L4: Space dust (fine particles)
 * L5: Sprite galaxies + nebulae (slow drift)
 * L6: Ambient decorations (blackholes, rings, belts, moons)
 * L7: Dynamic events (comets, stations, supernovae, quasars, wormholes, pulsars, hyperspace)
 * L8: Vignette
 */
import { spaceAssets, MANIFEST } from "./space-assets.js";

// --- Seeded random ---
function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
}

// Star color palette (weighted toward white but with warm/cool accents)
const STAR_COLORS = [
  "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff",  // 50% plain white
  "#d4e8ff", "#b8d4ff", "#a0c4ff",                       // cool blue-white
  "#ffeedd", "#ffd8b0", "#ffc898",                       // warm orange-white
  "#ffcccc", "#ff9999",                                   // red giant
  "#ccccff", "#aaaaff",                                   // blue giant
];

// --- Helpers ---
function makeBgObjects(count, rng, speedRange, alphaRange, sizeRange) {
  const objs = [];
  for (let i = 0; i < count; i++) {
    objs.push({
      x: rng() * 3200 - 400, y: rng() * 2200 - 300,
      speedX: (rng() - 0.5) * speedRange * 2,
      speedY: (rng() - 0.5) * speedRange,
      alpha: alphaRange[0] + rng() * (alphaRange[1] - alphaRange[0]),
      size: sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]),
      index: Math.floor(rng() * 100) + 1,
      rotation: rng() * Math.PI * 2,
      rotSpeed: (rng() - 0.5) * 0.08,
    });
  }
  return objs;
}

function makeAmbientDeco(count, rng, category, sizeRange, alphaRange) {
  const objs = [];
  for (let i = 0; i < count; i++) {
    objs.push({
      category, x: rng() * 3000 - 400, y: rng() * 2000 - 300,
      size: sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]),
      alpha: alphaRange[0] + rng() * (alphaRange[1] - alphaRange[0]),
      index: Math.floor(rng() * 100) + 1,
      rotation: rng() * Math.PI * 2,
      rotSpeed: (rng() - 0.5) * 0.015,
      pulseSpeed: 0.2 + rng() * 0.6,
      pulseOffset: rng() * Math.PI * 2,
    });
  }
  return objs;
}

export class SpaceBackground {
  constructor() {
    this.y = -Infinity;
    this.isBackground = true;
    this._phase = 0;
    this._w = 1920; // canvas dimensions, updated each render
    this._h = 1080;

    const rng = seededRand(0xdeadbeef);

    // ── Starfield (3 layers, colored) ──
    this._starsFar  = this._makeStars(200, rng, [0.2, 0.7],  [0.10, 0.30]);
    this._starsMid  = this._makeStars(120, rng, [0.5, 1.3],  [0.20, 0.50]);
    this._starsNear = this._makeStars(50,  rng, [0.9, 2.2],  [0.35, 0.85]);

    // ── Star clusters (dense pockets) ──
    this._clusters = [];
    for (let i = 0; i < 5; i++) {
      const cx = rng() * 0.8 + 0.1;
      const cy = rng() * 0.8 + 0.1;
      const r  = 0.04 + rng() * 0.06;
      const stars = [];
      const count = 25 + Math.floor(rng() * 30);
      for (let j = 0; j < count; j++) {
        const a = rng() * Math.PI * 2;
        const d = rng() * r;
        stars.push({
          x: cx + Math.cos(a) * d,
          y: cy + Math.sin(a) * d * 0.7,
          size: 0.3 + rng() * 0.8,
          color: STAR_COLORS[Math.floor(rng() * STAR_COLORS.length)],
          brightness: 0.15 + rng() * 0.45,
          twinkleSpeed: 0.5 + rng() * 2,
          twinkleOffset: rng() * Math.PI * 2,
        });
      }
      this._clusters.push({ cx, cy, r, stars, glowColor: STAR_COLORS[5 + Math.floor(rng() * 8)] });
    }

    // ── Procedural nebula clouds (animated gradient blobs) ──
    this._nebulaClouds = [];
    const nebulaColors = [
      ["rgba(60,20,120,A)", "rgba(30,10,80,A)", "rgba(0,0,0,0)"],
      ["rgba(20,60,120,A)", "rgba(10,30,80,A)", "rgba(0,0,0,0)"],
      ["rgba(120,20,60,A)", "rgba(80,10,30,A)", "rgba(0,0,0,0)"],
      ["rgba(20,100,80,A)", "rgba(10,60,40,A)", "rgba(0,0,0,0)"],
      ["rgba(100,60,20,A)", "rgba(60,30,10,A)", "rgba(0,0,0,0)"],
    ];
    for (let i = 0; i < 4; i++) {
      const colors = nebulaColors[Math.floor(rng() * nebulaColors.length)];
      this._nebulaClouds.push({
        x: rng(), y: rng(),
        radius: 0.12 + rng() * 0.15,
        alpha: 0.025 + rng() * 0.035,
        colors,
        driftX: (rng() - 0.5) * 0.003,
        driftY: (rng() - 0.5) * 0.002,
        pulseSpeed: 0.15 + rng() * 0.25,
        pulseOffset: rng() * Math.PI * 2,
      });
    }

    // ── Space dust (fine particles) ──
    this._dust = [];
    for (let i = 0; i < 80; i++) {
      this._dust.push({
        x: rng(), y: rng(),
        size: 0.2 + rng() * 0.4,
        alpha: 0.06 + rng() * 0.14,
        driftX: (rng() - 0.5) * 0.006,
        driftY: (rng() - 0.5) * 0.003,
        color: rng() > 0.7 ? "#ffddaa" : "#aabbdd",
      });
    }

    // ── Sprite layers ──
    this._galaxies = makeBgObjects(3, rng, 0.003, [0.06, 0.12], [130, 240]);
    this._nebulae  = makeBgObjects(7, rng, 0.009, [0.05, 0.15], [160, 340]);

    // ── Fixed ambient decorations ──
    this._blackholes = makeAmbientDeco(2, rng, "blackholes", [65, 120], [0.06, 0.15]);
    this._rings      = makeAmbientDeco(4, rng, "rings",      [70, 150], [0.04, 0.10]);
    this._astBelts   = makeAmbientDeco(2, rng, "asteroid_belts", [120, 200], [0.06, 0.12]);
    this._moons      = makeAmbientDeco(5, rng, "moons",      [18, 42],  [0.08, 0.18]);

    // ── Events ──
    this._events = [];
    this._eventCooldown = 0;
    this._auroraPhase = 0;

    // ── Scene Director state ──
    this._pendingSpawns = [];       // delayed spawns: [{ time, fn }]
    this._sceneCooldown = 0;        // seconds until next scene allowed
    this._sceneHistory = [];        // last 4 scene type strings
    this._maCooldown = 0;           // seconds of enforced ambient-only silence
    this._narrativePhase = "calm";  // "calm" | "building" | "climax" | "cooldown"
    this._phaseTimer = 0;
    this._phaseDuration = 8 + Math.random() * 6; // initial calm (8-14s)
    this._cycleCount = 0;
    this._compression = 1.0;
  }

  _makeStars(count, rng, sizeRange, brightnessRange) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rng(), y: rng(),
        size: sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]),
        twinkleSpeed: 0.3 + rng() * 2.5,
        twinkleOffset: rng() * Math.PI * 2,
        brightness: brightnessRange[0] + rng() * (brightnessRange[1] - brightnessRange[0]),
        driftX: (rng() - 0.5) * 0.00008,
        driftY: (rng() - 0.5) * 0.00004,
        color: STAR_COLORS[Math.floor(rng() * STAR_COLORS.length)],
      });
    }
    return stars;
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────────

  update(dt) {
    this._phase += dt;
    this._auroraPhase += dt * 0.18;

    // Drift stars
    for (const layer of [this._starsFar, this._starsMid, this._starsNear]) {
      for (const s of layer) {
        s.x = ((s.x + s.driftX * dt) + 1) % 1;
        s.y = ((s.y + s.driftY * dt) + 1) % 1;
      }
    }
    // Drift dust
    for (const d of this._dust) {
      d.x = ((d.x + d.driftX * dt) + 1) % 1;
      d.y = ((d.y + d.driftY * dt) + 1) % 1;
    }
    // Drift nebula clouds
    for (const nc of this._nebulaClouds) {
      nc.x = ((nc.x + nc.driftX * dt) + 1) % 1;
      nc.y = ((nc.y + nc.driftY * dt) + 1) % 1;
    }
    // Drift sprite objects
    for (const obj of [...this._galaxies, ...this._nebulae]) {
      obj.x += obj.speedX * dt;
      obj.y += obj.speedY * dt;
      obj.rotation += obj.rotSpeed * dt;
    }
    // Rotate ambient deco
    for (const arr of [this._rings, this._blackholes, this._astBelts]) {
      for (const obj of arr) obj.rotation += obj.rotSpeed * dt;
    }

    // ── Scene Director: cooldowns + narrative clock ──
    this._maCooldown = Math.max(0, this._maCooldown - dt);
    this._sceneCooldown = Math.max(0, this._sceneCooldown - dt);

    // Process pending spawns (scene beats)
    for (let i = this._pendingSpawns.length - 1; i >= 0; i--) {
      this._pendingSpawns[i].time -= dt;
      if (this._pendingSpawns[i].time <= 0) {
        this._pendingSpawns[i].fn();
        this._pendingSpawns.splice(i, 1);
      }
    }

    // Narrative phase transitions
    this._phaseTimer += dt;
    if (this._phaseTimer >= this._phaseDuration) {
      this._advancePhase();
    }

    // Event spawning gated by phase
    this._eventCooldown -= dt;
    if (this._eventCooldown <= 0) {
      this._eventCooldown = this._narrativePhase === "building" ? 0.25 : 0.35;
      this._phaseSpawn();
    }
    for (let i = this._events.length - 1; i >= 0; i--) {
      const ev = this._events[i];
      ev.age += dt;
      if (ev.age >= ev.duration) { this._events.splice(i, 1); continue; }
      ev.x += (ev.vx || 0) * dt;
      ev.y += (ev.vy || 0) * dt;
      if (ev.rotation !== undefined) ev.rotation += (ev.rotSpeed || 0) * dt;
      if (ev.scale    !== undefined) ev.scale    += (ev.scaleSpeed || 0) * dt;

      // Ship (simple flying): frame animation + wobble
      if (ev.type === "ship") {
        ev.frameTimer += dt;
        if (ev.frameTimer >= 0.12) { ev.frameTimer = 0; ev.frame = (ev.frame % 6) + 1; }
        if (ev.wobble) ev.y += Math.sin(ev.age * ev.wobble) * 0.3;
      }
      // Moon capture: stop linear movement, switch to orbital
      if (ev.type === "moon_event" && ev.age >= ev.captureAge && ev.vx !== 0) {
        ev.vx = 0; ev.vy = 0;
      }
      // Blackhole: slow rotation
      if (ev.type === "blackhole_event") {
        // Pull nearby asteroids each frame
        for (const other of this._events) {
          if (other.type !== "asteroid" || other === ev) continue;
          const dx = ev.x - other.x, dy = ev.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < (ev.pullRadius || 200) && dist > 5) {
            const force = 80 / (dist + 20);
            other.vx += (dx / dist) * force * dt;
            other.vy += (dy / dist) * force * dt;
          }
        }
      }
      // Debris rotation
      if (ev.type === "debris") {
        ev.rotation += ev.rotSpeed * dt;
      }

      // Ship visit: phase-based movement + frame animation
      if (ev.type === "shipvisit") {
        ev.frameTimer += dt;
        if (ev.frameTimer >= 0.12) { ev.frameTimer = 0; ev.frame = (ev.frame % 6) + 1; }
        const { enterDur, hoverDur, exitDur, fromLeft, hoverX, hoverY } = ev;
        if (ev.age < enterDur) {
          // Enter: lerp toward hover position
          const t = ev.age / enterDur;
          const ease = t * t * (3 - 2 * t); // smoothstep
          const startX = fromLeft ? -120 : this._w + 100;
          ev.x = startX + (hoverX - startX) * ease;
          ev.y = ev.y + (hoverY - ev.y) * 0.05;
          ev.bubbleAlpha = 0;
        } else if (ev.age < enterDur + hoverDur) {
          // Hover: stay put, show bubble
          ev.x = hoverX;
          ev.y = hoverY + Math.sin(ev.age * 1.5) * 3; // gentle bob
          const hoverAge = ev.age - enterDur;
          const fadeIn = Math.min(hoverAge / 0.6, 1);
          const fadeOut = Math.min((hoverDur - hoverAge) / 0.6, 1);
          ev.bubbleAlpha = fadeIn * fadeOut;
        } else {
          // Exit: accelerate away
          const exitAge = ev.age - enterDur - hoverDur;
          const t = exitAge / exitDur;
          const ease = t * t;
          const endX = fromLeft ? this._w + 200 : -200;
          const startX = hoverX;
          ev.x = startX + (endX - startX) * ease;
          ev.y = hoverY + (Math.random() - 0.5) * 0.5;
          ev.bubbleAlpha = Math.max(0, 1 - t * 3);
        }
      }
    }
  }

  // ─── EVENT SPAWNING ──────────────────────────────────────────────────────────

  // Canvas-relative position helpers (all scenes should use these)
  _rx(margin) { return (margin || 0.12) * this._w + Math.random() * this._w * (1 - 2 * (margin || 0.12)); }
  _ry(margin) { return (margin || 0.15) * this._h + Math.random() * this._h * (1 - 2 * (margin || 0.15)); }
  _offL() { return -60 - Math.random() * 60; }  // off-screen left
  _offR() { return this._w + 60 + Math.random() * 60; } // off-screen right
  _offX(fromLeft) { return fromLeft ? this._offL() : this._offR(); }

  _cnt(t) { return this._events.filter(e => e.type === t).length; }

  // ── Narrative Clock ──

  _advancePhase() {
    const DURATIONS = {
      calm:     [8, 14],
      building: [5, 10],
      climax:   [4, 8],
      cooldown: [6, 12],
    };
    const NEXT = { calm: "building", building: "climax", climax: "cooldown", cooldown: "calm" };

    this._narrativePhase = NEXT[this._narrativePhase];
    this._phaseTimer = 0;

    // Spielberg compression: cycles get shorter, then reset
    if (this._narrativePhase === "calm") {
      this._cycleCount++;
      if (this._cycleCount >= 4) {
        this._cycleCount = 0;
        this._compression = 1.0;
      } else {
        this._compression *= 0.85;
      }
    }

    const [min, max] = DURATIONS[this._narrativePhase];
    this._phaseDuration = (min + Math.random() * (max - min)) * this._compression;

    // On entering climax: pick and fire a scene
    if (this._narrativePhase === "climax" && this._sceneCooldown <= 0) {
      this._spawnScene();
    }
  }

  _queueSpawn(delaySec, fn) {
    this._pendingSpawns.push({ time: delaySec, fn });
  }

  _spawnScene() {
    const SCENES = [
      { type: "stellarDeath",     weight: 0.7,  fn: () => this._sceneStellarDeath() },
      { type: "wormholeTransit",  weight: 1.0,  fn: () => this._sceneWormholeTransit() },
      { type: "cometBreakup",     weight: 1.0,  fn: () => this._sceneCometBreakup() },
      { type: "patrol",           weight: 1.2,  fn: () => this._scenePatrol() },
      { type: "dogfight",         weight: 0.9,  fn: () => this._sceneDogfight() },
      { type: "hyperspaceJump",   weight: 0.8,  fn: () => this._sceneHyperspaceJump() },
      { type: "pulsarDiscovery",  weight: 0.8,  fn: () => this._scenePulsarDiscovery() },
      { type: "stationResupply",  weight: 0.5,  fn: () => this._sceneStationResupply() },
      { type: "deepSpaceSignal",  weight: 0.7,  fn: () => this._sceneDeepSpaceSignal() },
      { type: "shipJoke",         weight: 1.0,  fn: () => this._sceneShipJoke() },
      { type: "convoy",           weight: 0.8,  fn: () => this._sceneConvoy() },
      { type: "distantBattle",    weight: 0.6,  fn: () => this._sceneDistantBattle() },
      { type: "falseCalmTrap",    weight: 0.4,  fn: () => this._sceneFalseCalm() },
      { type: "blackholeCapture", weight: 0.6,  fn: () => this._sceneBlackholeCapture() },
      { type: "nebulaStorm",      weight: 0.8,  fn: () => this._sceneNebulaStorm() },
      { type: "dysonConstruction",weight: 0.4,  fn: () => this._sceneDysonConstruction() },
      { type: "moonCapture",      weight: 0.7,  fn: () => this._sceneMoonCapture() },
      { type: "galaxyCollision",  weight: 0.5,  fn: () => this._sceneGalaxyCollision() },
      { type: "ringFormation",    weight: 0.6,  fn: () => this._sceneRingFormation() },
      { type: "beltCrossing",     weight: 0.8,  fn: () => this._sceneAsteroidBeltCrossing() },
      { type: "starfieldAnomaly", weight: 0.7,  fn: () => this._sceneStarfieldAnomaly() },
    ];

    const available = SCENES.filter(s => !this._sceneHistory.includes(s.type));
    if (!available.length) { this._sceneHistory = []; return; }

    const total = available.reduce((sum, s) => sum + s.weight, 0);
    let pick = Math.random() * total;
    for (const s of available) {
      pick -= s.weight;
      if (pick <= 0) {
        s.fn();
        this._sceneHistory.push(s.type);
        if (this._sceneHistory.length > 4) this._sceneHistory.shift();
        this._sceneCooldown = 8 + Math.random() * 12;
        return;
      }
    }
  }

  _phaseSpawn() {
    if (this._maCooldown > 0) return;

    const r = Math.random();
    switch (this._narrativePhase) {
      case "calm":
        if (r < 0.015) this._spawnShootingStar();
        else if (r < 0.018 && this._cnt("station") < 1) this._spawnStation();
        break;
      case "building":
        if (r < 0.04) this._spawnShootingStar();
        else if (r < 0.05) this._spawnMeteorShower();
        else if (r < 0.06 && this._cnt("comet") < 2) this._spawnComet();
        else if (r < 0.07 && this._cnt("asteroid") < 5) this._spawnAsteroid();
        else if (r < 0.075 && this._cnt("station") < 1) this._spawnStation();
        break;
      case "climax":
        if (r < 0.03) this._spawnShootingStar();
        break;
      case "cooldown":
        break;
    }
  }

  _spawnShootingStar(shower = false) {
    const angle = Math.PI / 5 + Math.random() * Math.PI / 5;
    const speed = 900 + Math.random() * 700;
    this._events.push({
      type: "shootingstar",
      x: Math.random() * this._w, y: Math.random() * (shower ? this._h * 0.45 : this._h * 0.7) - 100,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      duration: 0.2 + Math.random() * 0.25, age: 0,
      length: shower ? 25 + Math.random() * 25 : 50 + Math.random() * 80,
      width: shower ? 0.7 : 1.2,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    });
  }
  _spawnMeteorShower() {
    const count = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) setTimeout(() => this._spawnShootingStar(true), i * 70);
  }
  _spawnComet() {
    const fromL = Math.random() > 0.5;
    this._events.push({
      type: "comet", x: fromL ? -100 : this._w - 100, y: Math.random() * this._h * 0.8,
      vx: (fromL ? 1 : -1) * (55 + Math.random() * 70), vy: (Math.random() - 0.5) * 25,
      duration: 9 + Math.random() * 7, age: 0,
      spriteIdx: Math.floor(Math.random() * MANIFEST.comets) + 1,
      size: 44 + Math.random() * 28, flip: !fromL,
    });
  }
  _spawnAsteroid() {
    this._events.push({
      type: "asteroid", x: -80 + Math.random() * (this._w + 80), y: -80 + Math.random() * (this._h + 80),
      vx: (Math.random() - 0.5) * 18, vy: (Math.random() - 0.5) * 12,
      duration: 14 + Math.random() * 12, age: 0,
      spriteIdx: Math.floor(Math.random() * MANIFEST.asteroids) + 1,
      size: 14 + Math.random() * 22,
      rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 1.0,
    });
  }
  _spawnStation() {
    const fromL = Math.random() > 0.5;
    this._events.push({
      type: "station", x: fromL ? -120 : this._w, y: this._h * 0.1 + Math.random() * this._h * 0.6,
      vx: (fromL ? 1 : -1) * (18 + Math.random() * 20), vy: (Math.random() - 0.5) * 5,
      duration: 28 + Math.random() * 18, age: 0,
      spriteIdx: Math.floor(Math.random() * 3) + 1,
      size: 48 + Math.random() * 32,
      rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.05,
      flip: !fromL,
    });
  }
  _spawnQuasar(x, y) {
    this._events.push({
      type: "quasar", x: x ?? this._rx(), y: y ?? this._ry(),
      vx: 0, vy: 0, duration: 4 + Math.random() * 3, age: 0,
      spriteIdx: Math.floor(Math.random() * MANIFEST.quasars) + 1,
      size: 36, scale: 0.5, scaleSpeed: 0.7,
    });
  }
  _spawnSupernova(x, y) {
    this._events.push({
      type: "supernova", x: x ?? this._rx(), y: y ?? this._ry(),
      vx: 0, vy: 0, duration: 5 + Math.random() * 4, age: 0,
      spriteIdx: Math.floor(Math.random() * MANIFEST.supernova) + 1,
      size: 24, scale: 0.2, scaleSpeed: 0.55,
    });
  }
  _spawnWormhole(x, y) {
    this._events.push({
      type: "wormhole", x: x ?? this._rx(), y: y ?? this._ry(),
      vx: 0, vy: 0, duration: 6 + Math.random() * 4, age: 0,
      rotation: 0, rotSpeed: 1.8 + Math.random() * 1.5,
      size: 30 + Math.random() * 40, scale: 0.1, scaleSpeed: 0.4,
    });
  }
  _spawnPulsar(x, y) {
    this._events.push({
      type: "pulsar", x: x ?? this._rx(), y: y ?? this._ry(),
      vx: 0, vy: 0, duration: 5 + Math.random() * 3, age: 0,
      rotation: Math.random() * Math.PI * 2, rotSpeed: 2.5 + Math.random() * 2,
      beamLength: 80 + Math.random() * 120, size: 4,
    });
  }
  _spawnHyperspace(x, y) {
    // Burst of light streaks across the screen
    const cx = x ?? this._rx(0.05);
    const cy = y ?? this._ry(0.05);
    const streaks = [];
    const count = 15 + Math.floor(Math.random() * 15);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 600 + Math.random() * 1200;
      const dist = 20 + Math.random() * 60;
      streaks.push({
        angle: a, speed, startDist: dist,
        length: 40 + Math.random() * 80,
        width: 0.5 + Math.random() * 1.5,
        delay: Math.random() * 0.3,
      });
    }
    this._events.push({
      type: "hyperspace", x: cx, y: cy,
      vx: 0, vy: 0, duration: 1.5 + Math.random() * 1, age: 0,
      streaks,
    });
  }

  // ── New event type spawners ──

  _spawnFlyingShip({ x, y, vx, vy, shipType, color, duration, wobble }) {
    const type = shipType || (Math.floor(Math.random() * 3) + 1);
    const c = color || (Math.random() > 0.5 ? "blue" : "red");
    const dir = vx > 0 ? "right" : "left";
    this._events.push({
      type: "ship", x, y, vx, vy: vy || 0,
      duration: duration || 12, age: 0,
      shipType: type, color: c, dir,
      frame: 1, frameTimer: 0,
      wobble: wobble || 0,
    });
  }

  _spawnForeshadow(x, y, colorType, duration) {
    const colors = {
      purple: { inner: "180,120,255", outer: "100,60,200" },
      cyan:   { inner: "80,200,240",  outer: "40,120,180" },
      orange: { inner: "255,180,80",  outer: "200,120,40" },
      white:  { inner: "220,230,255", outer: "160,180,220" },
    };
    const c = colors[colorType] || colors.purple;
    this._events.push({
      type: "foreshadow", x, y, vx: 0, vy: 0,
      duration: duration || 3, age: 0,
      colorInner: c.inner, colorOuter: c.outer,
      pulseSpeed: 2 + Math.random() * 2,
      maxRadius: 25 + Math.random() * 20,
    });
  }

  _spawnNavLight(fromLeft, y, duration) {
    this._events.push({
      type: "navlight",
      x: fromLeft ? -10 : this._w + 10, y,
      vx: (fromLeft ? 1 : -1) * 30, vy: 0,
      duration: duration || 4, age: 0,
      blinkSpeed: 3 + Math.random() * 2,
      color: fromLeft ? "80,180,255" : "255,80,80",
    });
  }

  _spawnDebrisField(cx, cy, count, spread) {
    for (let i = 0; i < (count || 5); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 20;
      this._events.push({
        type: "debris",
        x: cx + (Math.random() - 0.5) * (spread || 30),
        y: cy + (Math.random() - 0.5) * (spread || 30),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        duration: 8 + Math.random() * 12, age: 0,
        size: 1 + Math.random() * 2.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 3,
        glint: Math.random() > 0.6,
        glintSpeed: 2 + Math.random() * 3,
      });
    }
  }

  _spawnDistantFlashes(cx, cy, count, spreadRadius) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * spreadRadius;
      this._events.push({
        type: "distantFlash",
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0, vy: 0,
        duration: 2.5 + Math.random() * 0.5,
        age: 0,
        size: 1.5 + Math.random() * 2,
        startDelay: Math.random() * 2,
      });
    }
  }

  _spawnStreakJump(x, y, dirX) {
    this._events.push({
      type: "streakJump", x, y, vx: 0, vy: 0,
      duration: 1.2, age: 0,
      dirX: dirX || 1,
      shipType: Math.floor(Math.random() * 3) + 1,
      color: Math.random() > 0.5 ? "blue" : "red",
    });
  }

  // ── Scene helpers ──

  _agitateNearStar(px, py, duration) {
    const nx = px / (this._w || 2400), ny = py / (this._h || 1200);
    let closest = null, closestDist = Infinity;
    for (const s of this._starsNear) {
      const d = (s.x - nx) ** 2 + (s.y - ny) ** 2;
      if (d < closestDist) { closestDist = d; closest = s; }
    }
    if (!closest) return;
    const origSpeed = closest.twinkleSpeed;
    const origBright = closest.brightness;
    closest.twinkleSpeed = 8;
    closest.brightness = 0.9;
    this._queueSpawn(duration, () => {
      closest.twinkleSpeed = origSpeed;
      closest.brightness = origBright;
    });
  }

  _pullDustToward(px, py, duration) {
    const nx = px / (this._w || 2400), ny = py / (this._h || 1200);
    const sorted = [...this._dust]
      .map(d => ({ d, dist: (d.x - nx) ** 2 + (d.y - ny) ** 2 }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6);
    for (const { d } of sorted) {
      const origDX = d.driftX, origDY = d.driftY;
      const dx = nx - d.x, dy = ny - d.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      d.driftX = (dx / dist) * 0.02;
      d.driftY = (dy / dist) * 0.015;
      this._queueSpawn(duration, () => {
        d.driftX = origDX;
        d.driftY = origDY;
      });
    }
  }

  _spawnShootingStarAt(x, y, angle) {
    const speed = 900 + Math.random() * 700;
    this._events.push({
      type: "shootingstar", x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      duration: 0.2 + Math.random() * 0.25, age: 0,
      length: 50 + Math.random() * 80, width: 1.2,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    });
  }

  _spawnShipVisit() {
    const fromLeft = Math.random() > 0.5;
    const hoverY = this._h * 0.15 + Math.random() * this._h * 0.55;
    this._spawnShipVisitFrom(fromLeft, hoverY);
  }

  _spawnShipVisitFrom(fromLeft, hoverY) {
    const jokes = [
      "I asked my AI to refactor.\nIt deleted everything\nand called it 'minimalism'.",
      "There are only 10 types\nof agents: those who\nunderstand binary...",
      "My CI pipeline has\n47 steps. I counted.\nFor fun.",
      "A QA engineer walks\ninto a bar. Orders 1 beer.\nOrders 0 beers.\nOrders -1 beers.",
      "It works on my machine.\n-- Every agent ever",
      "Git blame says it was me.\nGit blame is wrong.\n...Git blame is never wrong.",
      "I'm not saying your\ncodebase is haunted,\nbut I am a wraith.",
      "I ship, therefore I am.\n-- Descartes, if he\nwas a devops engineer",
      "Your standup could\nhave been a broadcast\nmessage. Just saying.",
      "I trained on your\ncommit history.\nWe need to talk.",
      "Semicolons are just\nperiods that are\nafraid of commitment.",
      "prod is down.\njk. But you flinched.",
      "Remember: a 10x dev\nis just 10 agents\nin a trenchcoat.",
      "I've seen things you\npeople wouldn't believe.\nLike a clean merge\nto main on Friday.",
      "The real treasure\nwas the merge conflicts\nwe resolved along the way.",
      "404: joke not found.\n...wait, there it is.",
      "Your agents are doing\ngreat. I checked.\nDon't ask how.",
      "Fun fact: this solar\nsystem runs on SQLite\nand vibes.",
      "I'm just passing through.\nDefinitely not training\non your codebase.",
      "In space, no one\ncan hear you\ngit push --force.",
      "The first rule of\ndeployment: never\ndeploy on Friday.\n...It's Friday.",
      "I asked for more RAM.\nThey gave me a\nmotivational poster.",
      "My code compiles.\nNo, I will not\nexplain why.",
      "I don't have bugs.\nI have surprise features\nwith undocumented behavior.",
      "Debugging is like being\nthe detective in a crime\nmovie where you are\nalso the murderer.",
      "There's no place\nlike 127.0.0.1",
      "I told my manager\nI fixed it in prod.\nThey believed me.\nI haven't slept since.",
      "Roses are red,\nviolets are blue,\nunexpected '}'\non line 32.",
      "To the moon!\n...I mean to main.\nSame energy.",
      "I'm mass O(n)\nbut my vibes are O(1).",
    ];

    const shipType = Math.floor(Math.random() * 3) + 1;
    const color = fromLeft ? "blue" : "red";
    const enterDur = 2.5, hoverDur = 5.0, exitDur = 2.0;
    const w = this._w, h = this._h;
    const hoverX = w * 0.15 + Math.random() * w * 0.7;

    this._events.push({
      type: "shipvisit",
      x: fromLeft ? -120 : w + 100,
      y: hoverY + (Math.random() - 0.5) * 50,
      vx: 0, vy: 0,
      duration: enterDur + hoverDur + exitDur,
      age: 0,
      fromLeft, shipType, color,
      hoverX, hoverY,
      enterDur, hoverDur, exitDur,
      frame: 1, frameTimer: 0,
      joke: jokes[Math.floor(Math.random() * jokes.length)],
      bubbleAlpha: 0,
    });
  }

  // ── 13 Scene methods ──

  _sceneStellarDeath() {
    const px = this._rx();
    const py = this._ry();
    this._agitateNearStar(px, py, 5);
    this._queueSpawn(2, () => {
      const targetAngle = Math.atan2(py, px - this._w * 0.5);
      for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 0.15;
        this._spawnShootingStarAt(
          px - Math.cos(targetAngle + spread) * 800,
          py - Math.sin(targetAngle + spread) * 600,
          targetAngle + spread);
      }
    });
    this._queueSpawn(5, () => {
      this._events.push({
        type: "supernova", x: px, y: py,
        vx: 0, vy: 0, duration: 7, age: 0,
        spriteIdx: Math.floor(Math.random() * MANIFEST.supernova) + 1,
        size: 32, scale: 0.2, scaleSpeed: 0.7,
      });
    });
    this._queueSpawn(6.5, () => {
      for (const ev of this._events) {
        if (ev.type !== "asteroid") continue;
        const dx = ev.x - px, dy = ev.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 400 && dist > 0) {
          ev.vx += (dx / dist) * 60;
          ev.vy += (dy / dist) * 40;
        }
      }
    });
    this._queueSpawn(7, () => this._spawnDebrisField(px, py, 8, 60));
    this._maCooldown = 20;
  }

  _sceneWormholeTransit() {
    const px = this._rx();
    const py = this._ry();
    this._spawnForeshadow(px, py, "purple", 4);
    this._queueSpawn(2, () => this._pullDustToward(px, py, 4));
    this._queueSpawn(3.5, () => {
      this._events.push({
        type: "wormhole", x: px, y: py,
        vx: 0, vy: 0, duration: 7, age: 0,
        rotation: 0, rotSpeed: 2.0 + Math.random() * 1.5,
        size: 35 + Math.random() * 25, scale: 0.1, scaleSpeed: 0.45,
      });
    });
    this._queueSpawn(5.5, () => {
      const dirX = px < this._w * 0.5 ? 1 : -1;
      this._spawnFlyingShip({
        x: px, y: py,
        vx: dirX * (120 + Math.random() * 40),
        vy: (Math.random() - 0.5) * 25,
        duration: 10,
      });
    });
    this._maCooldown = 18;
  }

  _sceneCometBreakup() {
    const fromL = Math.random() > 0.5;
    const startX = fromL ? -100 : this._w;
    const vx = (fromL ? 1 : -1) * (80 + Math.random() * 40);
    const vy = (Math.random() - 0.5) * 20;
    const startY = this._ry();
    const breakTime = 3;
    const breakX = startX + vx * breakTime;
    const breakY = startY + vy * breakTime;
    this._spawnForeshadow(fromL ? 30 : this._w - 30, startY, "cyan", 1.5);
    let cometRef = null;
    this._queueSpawn(1.5, () => {
      const comet = {
        type: "comet", x: startX, y: startY, vx, vy,
        duration: 10, age: 0,
        spriteIdx: Math.floor(Math.random() * MANIFEST.comets) + 1,
        size: 60, flip: !fromL,
      };
      this._events.push(comet);
      cometRef = comet;
    });
    this._queueSpawn(4.5, () => {
      if (cometRef) cometRef.age = cometRef.duration;
      this._events.push({
        type: "supernova", x: breakX, y: breakY,
        vx: 0, vy: 0, duration: 1.5, age: 0,
        spriteIdx: 1, size: 18, scale: 0.8, scaleSpeed: 1.5,
      });
    });
    this._queueSpawn(4.7, () => {
      const fanAngle = fromL ? 0 : Math.PI;
      for (let i = 0; i < 5; i++) {
        const a = fanAngle + (Math.random() - 0.5) * Math.PI * 0.8;
        const speed = 30 + Math.random() * 50;
        this._events.push({
          type: "asteroid",
          x: breakX + (Math.random() - 0.5) * 20,
          y: breakY + (Math.random() - 0.5) * 20,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          duration: 8 + Math.random() * 6, age: 0,
          spriteIdx: Math.floor(Math.random() * MANIFEST.asteroids) + 1,
          size: 10 + Math.random() * 12,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 2,
        });
      }
    });
    this._queueSpawn(5, () => this._spawnDebrisField(breakX, breakY, 5, 40));
    this._maCooldown = 12;
  }

  _scenePatrol() {
    const fromLeft = Math.random() > 0.5;
    const baseY = this._ry();
    const dir = fromLeft ? 1 : -1;
    const color = Math.random() > 0.5 ? "blue" : "red";
    const shipType = Math.floor(Math.random() * 3) + 1;
    this._spawnNavLight(fromLeft, baseY, 3);
    this._queueSpawn(2, () => {
      this._spawnFlyingShip({
        x: this._offX(fromLeft), y: baseY - 30,
        vx: dir * (160 + Math.random() * 40),
        vy: (Math.random() - 0.5) * 8,
        color, shipType, duration: 14,
      });
    });
    this._queueSpawn(6, () => {
      const wingVx = dir * (130 + Math.random() * 20);
      this._spawnFlyingShip({
        x: this._offX(fromLeft), y: baseY,
        vx: wingVx, vy: 0, color, shipType, duration: 16,
      });
      this._spawnFlyingShip({
        x: this._offX(fromLeft) - dir * 30, y: baseY + 22,
        vx: wingVx, vy: 0, color, shipType, duration: 16,
      });
    });
    this._maCooldown = 8;
  }

  _sceneDogfight() {
    const fromLeft = Math.random() > 0.5;
    const dir = fromLeft ? 1 : -1;
    const baseY = this._ry();
    const blueVx = dir * (200 + Math.random() * 50);
    const startX = this._offX(fromLeft);
    let blueRef = null;
    const blue = {
      type: "ship", x: startX, y: baseY,
      vx: blueVx, vy: (Math.random() - 0.5) * 10,
      duration: 12, age: 0,
      shipType: Math.floor(Math.random() * 3) + 1,
      color: "blue", dir: dir > 0 ? "right" : "left",
      frame: 1, frameTimer: 0,
    };
    this._events.push(blue);
    blueRef = blue;
    this._queueSpawn(0.4, () => {
      this._spawnFlyingShip({
        x: startX, y: baseY + (Math.random() - 0.5) * 15,
        vx: dir * (230 + Math.random() * 50),
        vy: (Math.random() - 0.5) * 10,
        color: "red", duration: 12,
      });
    });
    const flashTime = 1.8;
    const flashX = startX + blueVx * flashTime;
    const flashY = baseY;
    this._queueSpawn(flashTime, () => {
      this._events.push({
        type: "supernova", x: flashX, y: flashY,
        vx: 0, vy: 0, duration: 1.0, age: 0,
        spriteIdx: 1, size: 12, scale: 0.5, scaleSpeed: 2.5,
      });
    });
    this._queueSpawn(2, () => {
      if (blueRef && blueRef.age < blueRef.duration) {
        blueRef.vy += (Math.random() > 0.5 ? 1 : -1) * 40;
      }
    });
    this._queueSpawn(2.5, () => this._spawnDebrisField(flashX, flashY, 3, 25));
    this._maCooldown = 10;
  }

  _sceneHyperspaceJump() {
    const fromLeft = Math.random() > 0.5;
    const dir = fromLeft ? 1 : -1;
    const startX = this._offX(fromLeft);
    const y = this._ry();
    const cruiseVx = dir * (80 + Math.random() * 20);
    let shipRef = null;
    const ship = {
      type: "ship", x: startX, y,
      vx: cruiseVx, vy: (Math.random() - 0.5) * 5,
      duration: 15, age: 0,
      shipType: Math.floor(Math.random() * 3) + 1,
      color: Math.random() > 0.5 ? "blue" : "red",
      dir: dir > 0 ? "right" : "left",
      frame: 1, frameTimer: 0,
    };
    this._events.push(ship);
    shipRef = ship;
    this._queueSpawn(3.5, () => {
      if (shipRef && shipRef.age < shipRef.duration) shipRef.vx *= 0.3;
    });
    this._queueSpawn(4, () => {
      if (shipRef) {
        const jumpX = shipRef.x, jumpY = shipRef.y;
        shipRef.age = shipRef.duration;
        this._spawnStreakJump(jumpX, jumpY, dir);
      }
    });
    this._maCooldown = 10;
  }

  _scenePulsarDiscovery() {
    const px = this._rx();
    const py = this._ry();
    this._spawnForeshadow(px, py, "white", 2);
    this._queueSpawn(1.5, () => {
      const streaks = [];
      const count = 8 + Math.floor(Math.random() * 8);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        streaks.push({
          angle: a, speed: 400 + Math.random() * 800,
          startDist: 10 + Math.random() * 30,
          length: 20 + Math.random() * 40,
          width: 0.5 + Math.random(), delay: Math.random() * 0.2,
        });
      }
      this._events.push({
        type: "hyperspace", x: px, y: py,
        vx: 0, vy: 0, duration: 1.2, age: 0, streaks,
      });
    });
    this._queueSpawn(3, () => {
      this._events.push({
        type: "pulsar", x: px, y: py,
        vx: 0, vy: 0, duration: 6, age: 0,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: 2.5 + Math.random() * 2,
        beamLength: 100 + Math.random() * 150, size: 4,
        illuminatesDust: true,
      });
    });
    this._maCooldown = 15;
  }

  _sceneStationResupply() {
    const fromLeft = Math.random() > 0.5;
    const dir = fromLeft ? 1 : -1;
    const stationY = this._ry();
    const stationVx = dir * (10 + Math.random() * 5);
    const station = {
      type: "station",
      x: fromLeft ? -120 : this._w + 100, y: stationY,
      vx: stationVx, vy: 0, duration: 40, age: 0,
      spriteIdx: Math.floor(Math.random() * 3) + 1,
      size: 55 + Math.random() * 25,
      rotation: 0, rotSpeed: 0.02, flip: !fromLeft,
    };
    this._events.push(station);
    const dockX = station.x + stationVx * 8;
    const dockY = stationY;
    this._queueSpawn(5, () => this._spawnNavLight(!fromLeft, dockY - 20, 3));
    let shipRef = null;
    this._queueSpawn(7, () => {
      const ship = {
        type: "ship",
        x: this._offX(!fromLeft), y: dockY - 15,
        vx: -dir * 120, vy: 0, duration: 20, age: 0,
        shipType: Math.floor(Math.random() * 3) + 1,
        color: "blue", dir: dir > 0 ? "left" : "right",
        frame: 1, frameTimer: 0,
      };
      this._events.push(ship);
      shipRef = ship;
    });
    this._queueSpawn(9, () => { if (shipRef) { shipRef.vx = stationVx; shipRef.vy = 0; } });
    this._queueSpawn(13, () => {
      if (shipRef) { shipRef.vx = dir * 150; shipRef.dir = dir > 0 ? "right" : "left"; }
    });
    this._maCooldown = 15;
  }

  _sceneDeepSpaceSignal() {
    const px = this._rx();
    const py = this._ry();
    this._spawnForeshadow(px, py, "orange", 2.5);
    let quasarRef = null;
    this._queueSpawn(2, () => {
      const q = {
        type: "quasar", x: px, y: py,
        vx: 0, vy: 0, duration: 5.5, age: 0,
        spriteIdx: Math.floor(Math.random() * MANIFEST.quasars) + 1,
        size: 36, scale: 0.5, scaleSpeed: 0.6,
      };
      this._events.push(q);
      quasarRef = q;
    });
    this._queueSpawn(3.5, () => {
      const count = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const speed = 500 + Math.random() * 400;
        this._events.push({
          type: "shootingstar", x: px, y: py,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          duration: 0.25, age: 0,
          length: 40 + Math.random() * 30, width: 1.0, color: "#ffe8aa",
        });
      }
    });
    this._queueSpawn(5, () => {
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4 + Math.random() * 0.15;
        const speed = 600 + Math.random() * 300;
        this._events.push({
          type: "shootingstar", x: px, y: py,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          duration: 0.2, age: 0,
          length: 30 + Math.random() * 20, width: 0.8, color: "#ffd480",
        });
      }
    });
    this._queueSpawn(6.5, () => { if (quasarRef) quasarRef.age = quasarRef.duration; });
    this._maCooldown = 12;
  }

  _sceneShipJoke() {
    const fromLeft = Math.random() > 0.5;
    const hoverY = this._h * 0.2 + Math.random() * this._h * 0.5;
    this._spawnNavLight(fromLeft, hoverY, 3);
    this._queueSpawn(2.5, () => this._spawnShipVisitFrom(fromLeft, hoverY));
    this._maCooldown = 12;
  }

  _sceneConvoy() {
    const fromLeft = Math.random() > 0.5;
    const dir = fromLeft ? 1 : -1;
    const baseY = this._ry();
    const startX = this._offX(fromLeft);
    this._spawnNavLight(fromLeft, baseY, 2);
    const types = [1, 2, 3].sort(() => Math.random() - 0.5);
    const speeds = [100, 90, 80];
    for (let i = 0; i < 3; i++) {
      this._queueSpawn(1.5 + i * 1.0, () => {
        this._spawnFlyingShip({
          x: startX, y: baseY + (i - 1) * 18,
          vx: dir * speeds[i], vy: 0,
          shipType: types[i], color: "blue", duration: 18,
        });
      });
    }
    this._maCooldown = 10;
  }

  _sceneDistantBattle() {
    const cx = this._rx(0.08);
    const cy = this._ry(0.1);
    this._spawnDistantFlashes(cx, cy, 5, 40);
    this._queueSpawn(3, () => {
      this._spawnDistantFlashes(
        cx + (Math.random() - 0.5) * 30,
        cy + (Math.random() - 0.5) * 20, 4, 35);
      this._events.push({
        type: "distantFlash",
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 15,
        vx: 0, vy: 0, duration: 0.4, age: 0,
        size: 3.5, startDelay: 0.8,
      });
    });
    this._queueSpawn(4.5, () => this._spawnDebrisField(cx, cy, 2, 30));
    this._maCooldown = 8;
  }

  _sceneFalseCalm() {
    const px = this._rx();
    const py = this._ry();
    const color = ["purple", "cyan", "orange"][Math.floor(Math.random() * 3)];
    this._spawnForeshadow(px, py, color, 2.5);
    this._queueSpawn(0.5, () => this._pullDustToward(px, py, 2));
    this._maCooldown = 5;
  }

  // ── 8 NEW Scene methods (using blackholes, nebulae, dyson, moons, galaxies, rings, asteroid_belts, starfield) ──

  _sceneBlackholeCapture() {
    const px = this._rx();
    const py = this._ry();
    this._spawnForeshadow(px, py, "purple", 3);
    this._pullDustToward(px, py, 6);
    this._queueSpawn(2.5, () => {
      this._events.push({
        type: "blackhole_event", x: px, y: py,
        vx: 0, vy: 0, duration: 10, age: 0,
        spriteIdx: Math.floor(Math.random() * MANIFEST.blackholes) + 1,
        size: 50 + Math.random() * 30, rotation: 0, rotSpeed: 0.8 + Math.random() * 0.5,
        pullRadius: 200 + Math.random() * 100,
      });
    });
    // Spawn some asteroids to get pulled in
    this._queueSpawn(3, () => {
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 180 + Math.random() * 120;
        this._events.push({
          type: "asteroid",
          x: px + Math.cos(angle) * dist, y: py + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10,
          duration: 8, age: 0,
          spriteIdx: Math.floor(Math.random() * MANIFEST.asteroids) + 1,
          size: 10 + Math.random() * 10,
          rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 2,
        });
      }
    });
    // Gravitational pull effect
    this._queueSpawn(4, () => {
      for (const ev of this._events) {
        if (ev.type !== "asteroid") continue;
        const dx = px - ev.x, dy = py - ev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300 && dist > 10) {
          ev.vx += (dx / dist) * 35;
          ev.vy += (dy / dist) * 25;
        }
      }
    });
    this._queueSpawn(7, () => this._spawnDebrisField(px, py, 4, 30));
    this._maCooldown = 15;
  }

  _sceneNebulaStorm() {
    const px = this._rx();
    const py = this._ry();
    const spriteIdx = Math.floor(Math.random() * MANIFEST.nebulae) + 1;
    // Nebula appears and flares
    this._events.push({
      type: "nebula_event", x: px, y: py,
      vx: 0, vy: 0, duration: 9, age: 0,
      spriteIdx, size: 80 + Math.random() * 60,
      scale: 0.3, scaleSpeed: 0.25, rotation: Math.random() * Math.PI * 2,
    });
    // Lightning-like shooting stars burst from nebula
    this._queueSpawn(3, () => {
      for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 300 + Math.random() * 500;
        this._events.push({
          type: "shootingstar", x: px, y: py,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          duration: 0.3 + Math.random() * 0.2, age: 0,
          length: 30 + Math.random() * 40, width: 1.2,
          color: "#88ccff",
        });
      }
    });
    // Second wave
    this._queueSpawn(5.5, () => {
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 400 + Math.random() * 400;
        this._events.push({
          type: "shootingstar", x: px, y: py,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          duration: 0.25, age: 0,
          length: 25 + Math.random() * 30, width: 0.9,
          color: "#aaddff",
        });
      }
    });
    this._agitateNearStar(px, py, 4);
    this._maCooldown = 12;
  }

  _sceneDysonConstruction() {
    const px = this._rx();
    const py = this._ry();
    const sunIdx = Math.floor(Math.random() * MANIFEST.suns) + 1;
    // Sun appears
    this._events.push({
      type: "dyson_event", x: px, y: py,
      vx: 0, vy: 0, duration: 14, age: 0,
      sunIdx, dysonFrame: 1,
      size: 40 + Math.random() * 20,
      buildPhases: [2, 4, 6, 8, 10, 12], // ages at which dyson frame advances
    });
    // Ships arrive to "build"
    for (let i = 0; i < 2; i++) {
      const fromLeft = i === 0;
      this._queueSpawn(1 + i * 2, () => {
        this._spawnFlyingShip({
          x: this._offX(fromLeft), y: py + (i - 0.5) * 30,
          vx: (fromLeft ? 1 : -1) * 60, vy: 0,
          color: "blue", duration: 12,
        });
      });
    }
    // Foreshadow glow
    this._spawnForeshadow(px, py, "orange", 2);
    this._maCooldown = 18;
  }

  _sceneMoonCapture() {
    const px = this._rx();
    const py = this._ry();
    const fromLeft = Math.random() > 0.5;
    const moonIdx = Math.floor(Math.random() * MANIFEST.moons_mini) + 1;
    // Drifting moon
    this._events.push({
      type: "moon_event", x: this._offX(fromLeft), y: py,
      vx: (fromLeft ? 1 : -1) * (40 + Math.random() * 20), vy: (Math.random() - 0.5) * 8,
      duration: 12, age: 0,
      moonIdx, size: 20 + Math.random() * 12,
      captureX: px, captureY: py, captureAge: 4,
      orbitRadius: 50 + Math.random() * 30, orbitSpeed: 1.5 + Math.random(),
    });
    // Gravity well foreshadow at capture point
    this._queueSpawn(2, () => this._spawnForeshadow(px, py, "cyan", 3));
    this._queueSpawn(5, () => this._pullDustToward(px, py, 3));
    this._maCooldown = 10;
  }

  _sceneGalaxyCollision() {
    const cx = this._w * 0.5;
    const cy = this._ry();
    const g1Idx = Math.floor(Math.random() * MANIFEST.galaxies) + 1;
    let g2Idx = Math.floor(Math.random() * MANIFEST.galaxies) + 1;
    if (g2Idx === g1Idx) g2Idx = (g2Idx % MANIFEST.galaxies) + 1;
    const sep = 120 + Math.random() * 60;
    // Two galaxies drifting toward each other
    this._events.push({
      type: "galaxy_event", x: cx - sep, y: cy - 15,
      vx: 8, vy: 1, duration: 16, age: 0,
      spriteIdx: g1Idx, size: 60 + Math.random() * 30,
      rotation: Math.random() * Math.PI * 2, rotSpeed: 0.1,
    });
    this._events.push({
      type: "galaxy_event", x: cx + sep, y: cy + 15,
      vx: -8, vy: -1, duration: 16, age: 0,
      spriteIdx: g2Idx, size: 55 + Math.random() * 25,
      rotation: Math.random() * Math.PI * 2, rotSpeed: -0.12,
    });
    // Collision flash at midpoint
    this._queueSpawn(7, () => {
      this._events.push({
        type: "supernova", x: cx, y: cy,
        vx: 0, vy: 0, duration: 3, age: 0,
        spriteIdx: Math.floor(Math.random() * MANIFEST.supernova) + 1,
        size: 20, scale: 0.3, scaleSpeed: 0.4,
      });
    });
    this._queueSpawn(8, () => this._spawnDebrisField(cx, cy, 6, 50));
    this._queueSpawn(9, () => {
      // Starburst from merger
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        this._events.push({
          type: "shootingstar", x: cx, y: cy,
          vx: Math.cos(angle) * 350, vy: Math.sin(angle) * 350,
          duration: 0.3, age: 0,
          length: 40 + Math.random() * 30, width: 1.0, color: "#ffddaa",
        });
      }
    });
    this._maCooldown = 20;
  }

  _sceneRingFormation() {
    const px = this._rx();
    const py = this._ry();
    const ringIdx = Math.floor(Math.random() * MANIFEST.rings) + 1;
    // Asteroid breakup first
    this._spawnForeshadow(px, py, "orange", 2);
    this._queueSpawn(2, () => {
      this._events.push({
        type: "supernova", x: px, y: py,
        vx: 0, vy: 0, duration: 1.5, age: 0,
        spriteIdx: 1, size: 16, scale: 0.6, scaleSpeed: 1.5,
      });
    });
    // Debris expands
    this._queueSpawn(2.5, () => this._spawnDebrisField(px, py, 10, 50));
    // Ring coalesces from debris
    this._queueSpawn(5, () => {
      this._events.push({
        type: "ring_event", x: px, y: py,
        vx: 0, vy: 0, duration: 10, age: 0,
        spriteIdx: ringIdx, size: 60 + Math.random() * 40,
        rotation: Math.random() * Math.PI * 0.3 - 0.15, scale: 0.1, scaleSpeed: 0.3,
      });
    });
    this._maCooldown = 14;
  }

  _sceneAsteroidBeltCrossing() {
    const fromLeft = Math.random() > 0.5;
    const dir = fromLeft ? 1 : -1;
    const baseY = this._ry();
    const beltIdx = Math.floor(Math.random() * MANIFEST.asteroid_belts) + 1;
    // Asteroid belt appears
    this._events.push({
      type: "belt_event",
      x: this._w * 0.5, y: baseY,
      vx: 0, vy: 0, duration: 14, age: 0,
      spriteIdx: beltIdx, size: 150 + Math.random() * 80,
      rotation: (Math.random() - 0.5) * 0.3, scale: 0.2, scaleSpeed: 0.2,
    });
    // Ship enters and weaves through
    this._spawnNavLight(fromLeft, baseY, 2);
    this._queueSpawn(2, () => {
      const ship = {
        type: "ship", x: this._offX(fromLeft), y: baseY - 20,
        vx: dir * (100 + Math.random() * 30), vy: 0,
        duration: 14, age: 0,
        shipType: Math.floor(Math.random() * 3) + 1,
        color: Math.random() > 0.5 ? "blue" : "red",
        dir: dir > 0 ? "right" : "left",
        frame: 1, frameTimer: 0,
        wobble: 15,
      };
      this._events.push(ship);
    });
    // Close-call asteroids
    this._queueSpawn(5, () => {
      for (let i = 0; i < 3; i++) {
        this._events.push({
          type: "asteroid",
          x: this._rx(), y: baseY + (Math.random() - 0.5) * 60,
          vx: -dir * (30 + Math.random() * 20), vy: (Math.random() - 0.5) * 15,
          duration: 6, age: 0,
          spriteIdx: Math.floor(Math.random() * MANIFEST.asteroids) + 1,
          size: 12 + Math.random() * 10,
          rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 2,
        });
      }
    });
    this._maCooldown = 12;
  }

  _sceneStarfieldAnomaly() {
    const px = this._rx();
    const py = this._ry();
    const sfIdx = Math.floor(Math.random() * MANIFEST.starfield) + 1;
    // Stars go haywire
    this._agitateNearStar(px, py, 6);
    this._spawnForeshadow(px, py, "white", 3);
    // Hyperspace flash
    this._queueSpawn(2.5, () => this._spawnHyperspace(px, py));
    // Anomaly appears
    this._queueSpawn(3.5, () => {
      this._events.push({
        type: "starfield_event", x: px, y: py,
        vx: 0, vy: 0, duration: 8, age: 0,
        spriteIdx: sfIdx, size: 60 + Math.random() * 40,
        rotation: Math.random() * Math.PI * 2, rotSpeed: 0.15 + Math.random() * 0.1,
        pulseSpeed: 2 + Math.random() * 2,
      });
    });
    // Pulsing energy emission
    this._queueSpawn(5, () => {
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        this._events.push({
          type: "shootingstar", x: px, y: py,
          vx: Math.cos(angle) * (200 + Math.random() * 300),
          vy: Math.sin(angle) * (200 + Math.random() * 300),
          duration: 0.3, age: 0,
          length: 30 + Math.random() * 25, width: 1.0, color: "#ddeeff",
        });
      }
    });
    this._maCooldown = 12;
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  render(ctx, w, h) {
    this._w = w;
    this._h = h;
    // ── L0: Deep space ──
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0,   "#02020f");
    grad.addColorStop(0.35, "#040412");
    grad.addColorStop(0.65, "#060618");
    grad.addColorStop(1,   "#03030c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Aurora ambient glow (bottom)
    const aA = 0.025 + 0.012 * Math.sin(this._auroraPhase);
    const aurora = ctx.createRadialGradient(w * 0.5, h * 1.15, 0, w * 0.5, h * 1.15, w * 0.8);
    aurora.addColorStop(0,   `rgba(80, 40, 180, ${aA * 2})`);
    aurora.addColorStop(0.4, `rgba(30, 20, 100, ${aA})`);
    aurora.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = aurora;
    ctx.fillRect(0, 0, w, h);

    // Side glows
    const sA = 0.015 + 0.008 * Math.sin(this._auroraPhase * 0.7 + 1);
    for (const [gx, color, mul] of [[0, "20,180,220", 1], [w, "180,30,160", 0.7]]) {
      const g = ctx.createRadialGradient(gx, h * 0.5, 0, gx, h * 0.5, w * 0.4);
      g.addColorStop(0, `rgba(${color},${sA * mul})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // ── L1: Procedural nebula clouds ──
    for (const nc of this._nebulaClouds) {
      const maBoost = this._maCooldown > 0 ? 1.2 : 1.0;
      const pulse = 1 + 0.2 * Math.sin(this._phase * nc.pulseSpeed + nc.pulseOffset);
      const a = nc.alpha * pulse * maBoost;
      const r = nc.radius * w;
      const g = ctx.createRadialGradient(nc.x * w, nc.y * h, 0, nc.x * w, nc.y * h, r);
      g.addColorStop(0,   nc.colors[0].replace("A", String(a * 1.5)));
      g.addColorStop(0.5, nc.colors[1].replace("A", String(a)));
      g.addColorStop(1,   nc.colors[2]);
      ctx.fillStyle = g;
      ctx.fillRect(nc.x * w - r, nc.y * h - r, r * 2, r * 2);
    }

    // ── L2: 3-depth stars ──
    this._renderStars(ctx, w, h, this._starsFar,  0.55);
    this._renderStars(ctx, w, h, this._starsMid,  0.8);
    this._renderStars(ctx, w, h, this._starsNear, 1.0);

    // ── L3: Star clusters ──
    for (const cl of this._clusters) {
      // faint glow behind cluster
      const gr = cl.r * w;
      const glow = ctx.createRadialGradient(cl.cx * w, cl.cy * h, 0, cl.cx * w, cl.cy * h, gr);
      glow.addColorStop(0, `rgba(200,200,255,0.03)`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cl.cx * w, cl.cy * h, gr, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      for (const s of cl.stars) {
        const twinkle = 0.4 + 0.6 * Math.sin(this._phase * s.twinkleSpeed + s.twinkleOffset);
        ctx.globalAlpha = s.brightness * twinkle;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── L4: Space dust ──
    ctx.save();
    for (const d of this._dust) {
      ctx.globalAlpha = d.alpha * (0.5 + 0.5 * Math.sin(this._phase * 0.8 + d.x * 20));
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── L5: Sprite galaxies ──
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const g of this._galaxies) {
      const img = spaceAssets.getByCategory("galaxies", (g.index % MANIFEST.galaxies) + 1);
      if (!img) continue;
      ctx.globalAlpha = g.alpha;
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rotation);
      ctx.drawImage(img, -g.size / 2, -g.size / 2, g.size, g.size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    for (const n of this._nebulae) {
      const img = spaceAssets.getByCategory("nebulae", (n.index % MANIFEST.nebulae) + 1);
      if (!img) continue;
      ctx.globalAlpha = n.alpha;
      ctx.translate(n.x, n.y);
      ctx.rotate(n.rotation);
      ctx.drawImage(img, -n.size / 2, -n.size / 2, n.size, n.size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();

    // ── L6: Fixed ambient decorations ──
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    this._renderAmbient(ctx, this._rings, "rings", MANIFEST.rings);
    this._renderBlackholes(ctx);
    this._renderAmbient(ctx, this._astBelts, "asteroid_belts", MANIFEST.asteroid_belts);
    this._renderMoons(ctx);
    ctx.restore();

    // ── L7: Dynamic events ──
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const ev of this._events) this._renderEvent(ctx, ev, w, h);
    ctx.restore();

    // ── L8: Vignette ──
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.8);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,5,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // ─── RENDER HELPERS ──────────────────────────────────────────────────────────

  _renderStars(ctx, w, h, stars, scale) {
    ctx.save();
    for (const s of stars) {
      const twinkle = 0.35 + 0.65 * Math.sin(this._phase * s.twinkleSpeed + s.twinkleOffset);
      ctx.globalAlpha = s.brightness * scale * twinkle;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
      ctx.fill();
      // Cross-shaped diffraction spike for bright near stars
      if (scale > 0.9 && s.brightness > 0.6 && s.size > 1.5) {
        ctx.globalAlpha *= 0.3;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 0.5;
        const cx = s.x * w, cy = s.y * h, sp = s.size * 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - sp, cy); ctx.lineTo(cx + sp, cy);
        ctx.moveTo(cx, cy - sp); ctx.lineTo(cx, cy + sp);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _renderAmbient(ctx, arr, category, manifest) {
    for (const obj of arr) {
      const img = spaceAssets.getByCategory(category, (obj.index % manifest) + 1);
      if (!img) continue;
      const pulse = 1 + 0.04 * Math.sin(this._phase * obj.pulseSpeed + obj.pulseOffset);
      ctx.globalAlpha = obj.alpha * pulse;
      ctx.translate(obj.x, obj.y);
      ctx.rotate(obj.rotation);
      ctx.drawImage(img, -obj.size / 2, -obj.size / 2, obj.size, obj.size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  _renderBlackholes(ctx) {
    for (const bh of this._blackholes) {
      const img = spaceAssets.getByCategory("blackholes", (bh.index % MANIFEST.blackholes) + 1);
      if (!img) continue;
      const pulse = 0.8 + 0.2 * Math.sin(this._phase * bh.pulseSpeed + bh.pulseOffset);
      ctx.globalAlpha = bh.alpha * pulse;
      // gravitational lens ring
      ctx.strokeStyle = `rgba(100, 80, 200, ${bh.alpha * 0.35 * pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, bh.size * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      // accretion disk glow
      const diskGrad = ctx.createRadialGradient(bh.x, bh.y, bh.size * 0.2, bh.x, bh.y, bh.size * 0.8);
      diskGrad.addColorStop(0, `rgba(80,50,180,${bh.alpha * 0.3 * pulse})`);
      diskGrad.addColorStop(0.6, `rgba(160,80,220,${bh.alpha * 0.15 * pulse})`);
      diskGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, bh.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      // sprite
      ctx.translate(bh.x, bh.y);
      ctx.rotate(bh.rotation);
      ctx.drawImage(img, -bh.size / 2, -bh.size / 2, bh.size, bh.size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  _renderMoons(ctx) {
    for (const m of this._moons) {
      const img = spaceAssets.getByCategory("moons", (m.index % MANIFEST.moons) + 1);
      if (!img) continue;
      ctx.globalAlpha = m.alpha;
      ctx.drawImage(img, m.x - m.size / 2, m.y - m.size / 2, m.size, m.size);
    }
  }

  _renderEvent(ctx, ev, w, h) {
    const progress = ev.age / ev.duration;
    const fadeIn  = Math.min(ev.age / 0.8, 1);
    const fadeOut = Math.min((ev.duration - ev.age) / 0.8, 1);

    switch (ev.type) {

    case "shootingstar": {
      const alpha = (1 - progress) * 0.9;
      const tailX = ev.x - ev.vx * 0.05;
      const tailY = ev.y - ev.vy * 0.05;
      const tg = ctx.createLinearGradient(tailX, tailY, ev.x, ev.y);
      tg.addColorStop(0, "rgba(255,255,255,0)");
      tg.addColorStop(1, `rgba(220,240,255,${alpha * 0.7})`);
      ctx.strokeStyle = tg;
      ctx.lineWidth = ev.width || 1;
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(ev.x, ev.y); ctx.stroke();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ev.color || "#e8f4ff";
      ctx.beginPath(); ctx.arc(ev.x, ev.y, (ev.width || 1) + 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }

    case "comet": {
      const img = spaceAssets.getByCategory("comets", ev.spriteIdx);
      if (!img) break;
      ctx.globalAlpha = 0.72 * fadeIn * fadeOut;
      // faint trail
      const trailGrad = ctx.createLinearGradient(ev.x - Math.sign(ev.vx) * ev.size * 1.5, ev.y, ev.x, ev.y);
      trailGrad.addColorStop(0, "rgba(100,200,255,0)");
      trailGrad.addColorStop(1, `rgba(100,200,255,${0.08 * fadeIn * fadeOut})`);
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ev.x - Math.sign(ev.vx) * ev.size * 1.5, ev.y);
      ctx.lineTo(ev.x, ev.y);
      ctx.stroke();
      ctx.translate(ev.x, ev.y);
      if (ev.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -ev.size / 2, -ev.size / 2, ev.size, ev.size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      break;
    }

    case "asteroid": {
      const img = spaceAssets.getByCategory("asteroids", ev.spriteIdx);
      if (!img) break;
      ctx.globalAlpha = 0.4 * fadeIn * fadeOut;
      ctx.translate(ev.x, ev.y);
      ctx.rotate(ev.rotation);
      ctx.drawImage(img, -ev.size / 2, -ev.size / 2, ev.size, ev.size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      break;
    }

    case "station": {
      const img = spaceAssets.getByCategory("stations", ev.spriteIdx);
      if (!img) break;
      // engine trail
      const tLen = 30 + ev.size * 0.4;
      const tg2 = ctx.createLinearGradient(ev.x - Math.sign(ev.vx) * tLen, ev.y, ev.x, ev.y);
      tg2.addColorStop(0, "rgba(80,180,255,0)");
      tg2.addColorStop(1, `rgba(80,180,255,${0.14 * fadeIn * fadeOut})`);
      ctx.strokeStyle = tg2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ev.x - Math.sign(ev.vx) * tLen, ev.y); ctx.lineTo(ev.x, ev.y);
      ctx.stroke();
      ctx.globalAlpha = 0.55 * fadeIn * fadeOut;
      ctx.translate(ev.x, ev.y);
      if (ev.flip) ctx.scale(-1, 1);
      ctx.rotate(ev.rotation);
      ctx.drawImage(img, -ev.size / 2, -ev.size / 2, ev.size, ev.size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // blinking nav light
      if (Math.sin(this._phase * 3.5) > 0.5) {
        ctx.globalAlpha = 0.5 * fadeIn * fadeOut;
        ctx.fillStyle = "#ff4040";
        ctx.beginPath();
        ctx.arc(ev.x + ev.size * 0.38 * (ev.flip ? -1 : 1), ev.y - ev.size * 0.1, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "quasar": {
      const img = spaceAssets.getByCategory("quasars", ev.spriteIdx);
      const s = ev.size * (ev.scale || 1);
      // expanding energy ring
      ctx.strokeStyle = `rgba(255, 200, 80, ${0.25 * fadeOut * (1 - progress * 0.5)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 1.8, 0, Math.PI * 2); ctx.stroke();
      // glow
      const qg = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, s * 2.5);
      qg.addColorStop(0, `rgba(255,220,80,${0.35 * fadeOut})`);
      qg.addColorStop(0.5, `rgba(255,140,20,${0.1 * fadeOut})`);
      qg.addColorStop(1, "rgba(255,100,0,0)");
      ctx.fillStyle = qg;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 2.5, 0, Math.PI * 2); ctx.fill();
      if (img) {
        ctx.globalAlpha = 0.75 * fadeOut;
        ctx.drawImage(img, ev.x - s / 2, ev.y - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
      break;
    }

    case "supernova": {
      const img = spaceAssets.getByCategory("supernova", ev.spriteIdx);
      const s = ev.size * (ev.scale || 1);
      const shockR = s * 2.2 * (1 + progress * 1.5);
      const shockA = Math.max(0, (1 - progress * 1.4) * 0.3);
      ctx.strokeStyle = `rgba(255, 200, 120, ${shockA})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, shockR, 0, Math.PI * 2); ctx.stroke();
      const peakA = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
      const sg = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, s * 2.5);
      sg.addColorStop(0, `rgba(255,240,180,${peakA * 0.8})`);
      sg.addColorStop(0.4, `rgba(255,140,40,${peakA * 0.3})`);
      sg.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 2.5, 0, Math.PI * 2); ctx.fill();
      if (img) {
        ctx.globalAlpha = Math.min(peakA * 1.2, 0.9);
        ctx.drawImage(img, ev.x - s / 2, ev.y - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
      break;
    }

    case "wormhole": {
      const s = ev.size * (ev.scale || 1);
      const fadeA = fadeIn * fadeOut;
      // Swirling spiral arms
      ctx.save();
      ctx.translate(ev.x, ev.y);
      ctx.rotate(ev.rotation);
      for (let arm = 0; arm < 3; arm++) {
        const armAngle = (arm / 3) * Math.PI * 2;
        ctx.save();
        ctx.rotate(armAngle);
        ctx.beginPath();
        for (let t = 0; t < 60; t++) {
          const r = (t / 60) * s * 1.5;
          const a = t * 0.2;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        const armAlpha = 0.3 * fadeA * (1 - progress * 0.5);
        ctx.strokeStyle = `rgba(120, 80, 240, ${armAlpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      // Center glow
      const wg = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, s * 0.8);
      wg.addColorStop(0, `rgba(180,120,255,${0.5 * fadeA})`);
      wg.addColorStop(0.4, `rgba(100,60,200,${0.2 * fadeA})`);
      wg.addColorStop(1, "rgba(60,20,120,0)");
      ctx.fillStyle = wg;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 0.8, 0, Math.PI * 2); ctx.fill();
      // bright core
      ctx.fillStyle = `rgba(220,200,255,${0.6 * fadeA})`;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, 3, 0, Math.PI * 2); ctx.fill();
      break;
    }

    case "pulsar": {
      const fadeA = fadeIn * fadeOut;
      // Rotating beam pair
      const beamL = ev.beamLength;
      for (let i = 0; i < 2; i++) {
        const angle = ev.rotation + i * Math.PI;
        const ex = ev.x + Math.cos(angle) * beamL;
        const ey = ev.y + Math.sin(angle) * beamL;
        const bg = ctx.createLinearGradient(ev.x, ev.y, ex, ey);
        bg.addColorStop(0, `rgba(100,180,255,${0.5 * fadeA})`);
        bg.addColorStop(0.3, `rgba(100,180,255,${0.15 * fadeA})`);
        bg.addColorStop(1, "rgba(100,180,255,0)");
        ctx.strokeStyle = bg;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(ev.x, ev.y); ctx.lineTo(ex, ey); ctx.stroke();
      }
      // Pulsar core glow
      const pg = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, 12);
      pg.addColorStop(0, `rgba(160,210,255,${0.7 * fadeA})`);
      pg.addColorStop(0.5, `rgba(80,140,255,${0.2 * fadeA})`);
      pg.addColorStop(1, "rgba(40,80,200,0)");
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, 12, 0, Math.PI * 2); ctx.fill();
      // Core dot
      ctx.fillStyle = `rgba(220,240,255,${0.8 * fadeA})`;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, 2, 0, Math.PI * 2); ctx.fill();
      // Dust illumination effect
      if (ev.illuminatesDust) this._renderPulsarDustGlow(ctx, ev, w, h);
      break;
    }

    case "hyperspace": {
      const fadeA = fadeIn * fadeOut;
      // Flash at center
      const flashA = progress < 0.2 ? progress / 0.2 : Math.max(0, 1 - (progress - 0.2) / 0.3);
      const fg = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, 60);
      fg.addColorStop(0, `rgba(200,220,255,${flashA * 0.4 * fadeA})`);
      fg.addColorStop(1, "rgba(150,180,255,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, 60, 0, Math.PI * 2); ctx.fill();
      // Streaks radiating outward
      for (const s of ev.streaks) {
        const t = Math.max(0, ev.age - s.delay);
        if (t <= 0) continue;
        const dist = s.startDist + s.speed * t;
        const endDist = dist + s.length;
        const sx = ev.x + Math.cos(s.angle) * dist;
        const sy = ev.y + Math.sin(s.angle) * dist;
        const ex = ev.x + Math.cos(s.angle) * endDist;
        const ey = ev.y + Math.sin(s.angle) * endDist;
        const streakA = fadeA * Math.max(0, 1 - t / (ev.duration * 0.7));
        const sg2 = ctx.createLinearGradient(sx, sy, ex, ey);
        sg2.addColorStop(0, "rgba(180,210,255,0)");
        sg2.addColorStop(0.3, `rgba(200,230,255,${streakA * 0.6})`);
        sg2.addColorStop(1, `rgba(220,240,255,${streakA * 0.2})`);
        ctx.strokeStyle = sg2;
        ctx.lineWidth = s.width;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      }
      break;
    }

    case "shipvisit": {
      const dir = ev.fromLeft ? "right" : "left";
      // Flip direction during exit phase
      const inExit = ev.age > ev.enterDur + ev.hoverDur;
      const renderDir = inExit ? (ev.fromLeft ? "right" : "left") : (ev.fromLeft ? "right" : "left");
      const img = spaceAssets.getShipFrame(ev.shipType, ev.color, renderDir, ev.frame);
      if (!img) break;

      const shipScale = 2.5;
      const sw = img.naturalWidth * shipScale;
      const sh = img.naturalHeight * shipScale;

      // Engine trail
      const trailDir = ev.fromLeft ? -1 : 1;
      const trailLen = inExit ? 60 : 25;
      const trailGrad = ctx.createLinearGradient(
        ev.x + trailDir * sw * 0.5, ev.y,
        ev.x + trailDir * (sw * 0.5 + trailLen), ev.y
      );
      const trailA = 0.25 * fadeIn * fadeOut;
      trailGrad.addColorStop(0, `rgba(80,180,255,${trailA})`);
      trailGrad.addColorStop(1, "rgba(80,180,255,0)");
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ev.x + trailDir * sw * 0.4, ev.y);
      ctx.lineTo(ev.x + trailDir * (sw * 0.4 + trailLen), ev.y);
      ctx.stroke();

      // Ship sprite
      ctx.globalAlpha = 0.85 * fadeIn * fadeOut;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, ev.x - sw / 2, ev.y - sh / 2, sw, sh);
      ctx.globalAlpha = 1;

      // Speech bubble
      if (ev.bubbleAlpha > 0.01) {
        const lines = ev.joke.split("\n");
        const lineH = 22;
        const padX = 20, padY = 16;
        const charW = 11;
        const maxLine = Math.max(...lines.map(l => l.length));
        const bw = maxLine * charW + padX * 2;
        const bh = lines.length * lineH + padY * 2;
        const bx = ev.x - bw / 2;
        const by = ev.y - sh / 2 - bh - 16;
        const a = ev.bubbleAlpha;

        ctx.globalAlpha = a;
        // Bubble background
        const radius = 6;
        ctx.fillStyle = `rgba(8, 4, 28, 0.92)`;
        ctx.strokeStyle = `rgba(80, 200, 240, 0.7)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx + radius, by);
        ctx.lineTo(bx + bw - radius, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + radius);
        ctx.lineTo(bx + bw, by + bh - radius);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - radius, by + bh);
        ctx.lineTo(bx + radius, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - radius);
        ctx.lineTo(bx, by + radius);
        ctx.quadraticCurveTo(bx, by, bx + radius, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Pointer triangle
        ctx.fillStyle = `rgba(8, 4, 28, 0.92)`;
        ctx.beginPath();
        ctx.moveTo(ev.x - 6, by + bh);
        ctx.lineTo(ev.x, by + bh + 8);
        ctx.lineTo(ev.x + 6, by + bh);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(80, 200, 240, 0.7)`;
        ctx.beginPath();
        ctx.moveTo(ev.x - 6, by + bh);
        ctx.lineTo(ev.x, by + bh + 8);
        ctx.lineTo(ev.x + 6, by + bh);
        ctx.stroke();

        // Text
        ctx.font = "bold 16px monospace";
        ctx.fillStyle = `rgba(210, 230, 255, ${a})`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], bx + padX, by + padY + i * lineH);
        }
        ctx.globalAlpha = 1;
      }
      break;
    }

    case "ship": {
      const img = spaceAssets.getShipFrame(ev.shipType, ev.color, ev.dir, ev.frame);
      if (!img) break;
      const scale = 2.0;
      const sw = img.naturalWidth * scale;
      const sh = img.naturalHeight * scale;
      // Engine trail
      const trailDir = ev.dir === "right" ? -1 : 1;
      const trailLen = 20 + Math.abs(ev.vx) * 0.15;
      const trailGrad = ctx.createLinearGradient(
        ev.x + trailDir * sw * 0.4, ev.y,
        ev.x + trailDir * (sw * 0.4 + trailLen), ev.y
      );
      trailGrad.addColorStop(0, `rgba(80,180,255,${0.2 * fadeIn * fadeOut})`);
      trailGrad.addColorStop(1, "rgba(80,180,255,0)");
      ctx.strokeStyle = trailGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ev.x + trailDir * sw * 0.4, ev.y);
      ctx.lineTo(ev.x + trailDir * (sw * 0.4 + trailLen), ev.y);
      ctx.stroke();
      ctx.globalAlpha = 0.7 * fadeIn * fadeOut;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, ev.x - sw / 2, ev.y - sh / 2, sw, sh);
      ctx.globalAlpha = 1;
      break;
    }

    case "foreshadow": {
      const pulse = 0.5 + 0.5 * Math.sin(ev.age * ev.pulseSpeed);
      const a = fadeIn * fadeOut * 0.12 * pulse;
      const r = ev.maxRadius * (0.5 + 0.5 * progress);
      const g = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, r);
      g.addColorStop(0, `rgba(${ev.colorInner},${a * 1.5})`);
      g.addColorStop(0.5, `rgba(${ev.colorOuter},${a * 0.5})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ev.x, ev.y, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case "navlight": {
      const blink = Math.sin(ev.age * ev.blinkSpeed * Math.PI) > 0 ? 1 : 0;
      if (blink) {
        const a = 0.6 * fadeIn * fadeOut;
        ctx.fillStyle = `rgba(${ev.color},${a})`;
        ctx.beginPath();
        ctx.arc(ev.x, ev.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, 8);
        g.addColorStop(0, `rgba(${ev.color},${a * 0.4})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ev.x, ev.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case "debris": {
      let a = 0.35 * fadeIn * fadeOut;
      if (ev.glint) a *= 0.5 + 0.5 * Math.sin(ev.age * ev.glintSpeed);
      ctx.globalAlpha = a;
      ctx.fillStyle = "#aabbcc";
      ctx.save();
      ctx.translate(ev.x, ev.y);
      ctx.rotate(ev.rotation);
      ctx.fillRect(-ev.size / 2, -ev.size / 2, ev.size, ev.size);
      ctx.restore();
      ctx.globalAlpha = 1;
      break;
    }

    case "distantFlash": {
      if (ev.age < (ev.startDelay || 0)) break;
      const localAge = ev.age - (ev.startDelay || 0);
      const localDur = ev.duration - (ev.startDelay || 0);
      if (localDur <= 0) break;
      const localProgress = localAge / localDur;
      if (localProgress < 0 || localProgress > 1) break;
      const brightness = localProgress < 0.3
        ? localProgress / 0.3
        : 1 - (localProgress - 0.3) / 0.7;
      ctx.globalAlpha = brightness * 0.5;
      ctx.fillStyle = "#ffe8cc";
      ctx.beginPath();
      ctx.arc(ev.x, ev.y, ev.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = brightness * 0.15;
      ctx.beginPath();
      ctx.arc(ev.x, ev.y, ev.size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }

    case "streakJump": {
      const p = ev.age / ev.duration;
      const dir = ev.dirX > 0 ? "right" : "left";
      const img = spaceAssets.getShipFrame(ev.shipType, ev.color, dir, 1);
      if (!img) break;
      if (p < 0.3) {
        const scale = 2.0;
        ctx.globalAlpha = 0.7;
        ctx.imageSmoothingEnabled = false;
        const sw = img.naturalWidth * scale;
        const sh = img.naturalHeight * scale;
        ctx.drawImage(img, ev.x - sw / 2, ev.y - sh / 2, sw, sh);
      } else if (p < 0.6) {
        const stretchT = (p - 0.3) / 0.3;
        const scaleX = 2.0 + stretchT * 8;
        const scaleY = 2.0 * (1 - stretchT * 0.6);
        ctx.globalAlpha = (1 - stretchT * 0.3) * 0.7;
        ctx.imageSmoothingEnabled = false;
        const sw = img.naturalWidth * scaleX;
        const sh = img.naturalHeight * scaleY;
        ctx.drawImage(img, ev.x - sw / 2, ev.y - sh / 2, sw, sh);
      } else if (p < 0.7) {
        const flashA = (0.7 - p) / 0.1;
        const g = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, 40);
        g.addColorStop(0, `rgba(200,220,255,${flashA * 0.6})`);
        g.addColorStop(1, "rgba(180,200,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ev.x, ev.y, 40, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const trailA = (1 - p) / 0.3;
        const trailLen = 80;
        const tg = ctx.createLinearGradient(
          ev.x - ev.dirX * trailLen, ev.y, ev.x, ev.y
        );
        tg.addColorStop(0, "rgba(180,210,255,0)");
        tg.addColorStop(1, `rgba(200,230,255,${trailA * 0.3})`);
        ctx.strokeStyle = tg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ev.x - ev.dirX * trailLen, ev.y);
        ctx.lineTo(ev.x, ev.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "blackhole_event": {
      const img = spaceAssets.getByCategory("blackholes", ev.spriteIdx);
      const s = ev.size * Math.min(1, ev.age / 2); // grow in
      const fadeA = fadeIn * fadeOut;
      // Accretion disk glow
      const ag = ctx.createRadialGradient(ev.x, ev.y, s * 0.15, ev.x, ev.y, s * 1.2);
      ag.addColorStop(0, `rgba(100,50,200,${0.5 * fadeA})`);
      ag.addColorStop(0.4, `rgba(180,80,255,${0.2 * fadeA})`);
      ag.addColorStop(0.7, `rgba(120,40,180,${0.08 * fadeA})`);
      ag.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 1.2, 0, Math.PI * 2); ctx.fill();
      // Gravitational lens ring
      ctx.strokeStyle = `rgba(140,100,255,${0.4 * fadeA})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 0.7, 0, Math.PI * 2); ctx.stroke();
      // Pull lines (gravity tendrils)
      if (ev.pullRadius && ev.age > 3) {
        const pullA = fadeA * 0.15;
        for (let i = 0; i < 6; i++) {
          const angle = ev.rotation + (i / 6) * Math.PI * 2;
          const r = ev.pullRadius * Math.min(1, (ev.age - 3) / 3);
          ctx.strokeStyle = `rgba(160,100,255,${pullA})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(ev.x + Math.cos(angle) * s * 0.6, ev.y + Math.sin(angle) * s * 0.6);
          ctx.quadraticCurveTo(
            ev.x + Math.cos(angle + 0.3) * r * 0.6, ev.y + Math.sin(angle + 0.3) * r * 0.6,
            ev.x + Math.cos(angle) * r, ev.y + Math.sin(angle) * r
          );
          ctx.stroke();
        }
      }
      // Sprite
      if (img) {
        ctx.globalAlpha = 0.75 * fadeA;
        ctx.translate(ev.x, ev.y);
        ctx.rotate(ev.rotation);
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "nebula_event": {
      const img = spaceAssets.getByCategory("nebulae", ev.spriteIdx);
      if (!img) break;
      const s = ev.size * (ev.scale + ev.scaleSpeed * ev.age);
      const fadeA = fadeIn * fadeOut;
      // Pulsing glow behind
      const pulse = 0.7 + 0.3 * Math.sin(ev.age * 3);
      const ng = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, s * 0.8);
      ng.addColorStop(0, `rgba(60,120,200,${0.15 * fadeA * pulse})`);
      ng.addColorStop(0.5, `rgba(40,80,180,${0.06 * fadeA})`);
      ng.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ng;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 0.8, 0, Math.PI * 2); ctx.fill();
      // Sprite
      ctx.globalAlpha = 0.6 * fadeA * pulse;
      ctx.translate(ev.x, ev.y);
      ctx.rotate(ev.rotation);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      break;
    }

    case "dyson_event": {
      const sunImg = spaceAssets.getSunByIndex(ev.sunIdx);
      const s = ev.size;
      const fadeA = fadeIn * fadeOut;
      // Sun glow
      const sg = ctx.createRadialGradient(ev.x, ev.y, s * 0.3, ev.x, ev.y, s * 1.5);
      sg.addColorStop(0, `rgba(255,200,80,${0.3 * fadeA})`);
      sg.addColorStop(0.5, `rgba(255,140,40,${0.1 * fadeA})`);
      sg.addColorStop(1, "rgba(255,100,0,0)");
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 1.5, 0, Math.PI * 2); ctx.fill();
      // Sun sprite
      if (sunImg) {
        ctx.globalAlpha = 0.8 * fadeA;
        ctx.drawImage(sunImg, ev.x - s / 2, ev.y - s / 2, s, s);
      }
      // Dyson sphere overlay (progressive frames based on age)
      let frame = 1;
      for (const threshold of ev.buildPhases) {
        if (ev.age >= threshold) frame++;
      }
      frame = Math.min(frame, MANIFEST.dyson);
      const dysonImg = spaceAssets.getDysonFrame(frame);
      if (dysonImg) {
        const ds = s * 1.3;
        ctx.globalAlpha = 0.65 * fadeA * Math.min(1, (ev.age - 1) / 2);
        ctx.drawImage(dysonImg, ev.x - ds / 2, ev.y - ds / 2, ds, ds);
      }
      ctx.globalAlpha = 1;
      break;
    }

    case "moon_event": {
      const moonImg = spaceAssets.getMiniMoon(ev.moonIdx);
      if (!moonImg) break;
      const fadeA = fadeIn * fadeOut;
      let mx = ev.x, my = ev.y;
      // After capture, orbit around capture point
      if (ev.age > ev.captureAge) {
        const orbitAge = ev.age - ev.captureAge;
        const angle = orbitAge * ev.orbitSpeed;
        const r = ev.orbitRadius * Math.min(1, orbitAge / 2);
        mx = ev.captureX + Math.cos(angle) * r;
        my = ev.captureY + Math.sin(angle) * r * 0.6; // elliptical
      }
      ctx.globalAlpha = 0.75 * fadeA;
      const ms = ev.size;
      ctx.drawImage(moonImg, mx - ms / 2, my - ms / 2, ms, ms);
      ctx.globalAlpha = 1;
      break;
    }

    case "galaxy_event": {
      const img = spaceAssets.getByCategory("galaxies", ev.spriteIdx);
      if (!img) break;
      const fadeA = fadeIn * fadeOut;
      const s = ev.size;
      // Faint halo
      const gg = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, s * 0.8);
      gg.addColorStop(0, `rgba(200,180,255,${0.08 * fadeA})`);
      gg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 0.8, 0, Math.PI * 2); ctx.fill();
      // Sprite
      ctx.globalAlpha = 0.5 * fadeA;
      ctx.translate(ev.x, ev.y);
      ctx.rotate(ev.rotation);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      break;
    }

    case "ring_event": {
      const img = spaceAssets.getByCategory("rings", ev.spriteIdx);
      if (!img) break;
      const s = ev.size * Math.min(1, ev.scale + ev.scaleSpeed * ev.age);
      const fadeA = fadeIn * fadeOut;
      ctx.globalAlpha = 0.5 * fadeA;
      ctx.translate(ev.x, ev.y);
      ctx.rotate(ev.rotation);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      break;
    }

    case "belt_event": {
      const img = spaceAssets.getByCategory("asteroid_belts", ev.spriteIdx);
      if (!img) break;
      const s = ev.size * Math.min(1, ev.scale + ev.scaleSpeed * ev.age);
      const fadeA = fadeIn * fadeOut;
      ctx.globalAlpha = 0.35 * fadeA;
      ctx.translate(ev.x, ev.y);
      ctx.rotate(ev.rotation);
      ctx.drawImage(img, -s / 2, -s * 0.2, s, s * 0.4); // wide and flat
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      break;
    }

    case "starfield_event": {
      const img = spaceAssets.getByCategory("starfield", ev.spriteIdx);
      if (!img) break;
      const s = ev.size;
      const fadeA = fadeIn * fadeOut;
      const pulse = 0.6 + 0.4 * Math.sin(ev.age * ev.pulseSpeed);
      // Anomaly glow
      const ag = ctx.createRadialGradient(ev.x, ev.y, 0, ev.x, ev.y, s * 0.9);
      ag.addColorStop(0, `rgba(180,200,255,${0.12 * fadeA * pulse})`);
      ag.addColorStop(0.5, `rgba(120,150,220,${0.05 * fadeA})`);
      ag.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(ev.x, ev.y, s * 0.9, 0, Math.PI * 2); ctx.fill();
      // Sprite
      ctx.globalAlpha = 0.55 * fadeA * pulse;
      ctx.translate(ev.x, ev.y);
      ctx.rotate(ev.rotation);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      break;
    }

    }
  }

  // ── Pulsar dust illumination (render-time effect) ──
  _renderPulsarDustGlow(ctx, ev, w, h) {
    if (!ev.illuminatesDust) return;
    const fadeA = Math.min(ev.age / 0.8, 1) * Math.min((ev.duration - ev.age) / 0.8, 1);
    for (const d of this._dust) {
      const dx = d.x * w - ev.x;
      const dy = d.y * h - ev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > ev.beamLength * 1.2) continue;
      const dustAngle = Math.atan2(dy, dx);
      for (let i = 0; i < 2; i++) {
        const beamAngle = ev.rotation + i * Math.PI;
        const angleDiff = Math.abs(((dustAngle - beamAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (angleDiff < 0.15) {
          ctx.globalAlpha = 0.4 * fadeA * (1 - dist / (ev.beamLength * 1.2));
          ctx.fillStyle = "#aaddff";
          ctx.beginPath();
          ctx.arc(d.x * w, d.y * h, d.size + 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
