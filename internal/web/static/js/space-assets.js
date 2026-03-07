/**
 * SpaceAssets — Preloads and assigns space pixel art sprites.
 *
 * Project sun  -> Animated Sun (30 frames) in focused view; static icon in global view
 * Agent planet -> Solar system planet (Mercury..Neptune) in focused project view
 *              -> Animated 48x48 planet (from DB planet_type) in global view
 * Background   -> static icon pack (nebulae, comets, asteroids, galaxies...)
 */

// Solar system planets in orbital order (closest to furthest)
export const SOLAR_PLANETS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
const SOLAR_FRAMES = 8;   // each solar planet has 8 animation frames
const SUN_FRAMES   = 30;  // animated sun

// --- Animated planet manifest (48x48, 60 frames each) ---
const ANIMATED_PLANETS = {
  barren:    4,  // variants
  desert:    2,
  forest:    2,
  gas_giant: 4,
  ice:       1,
  lava:      3,
  ocean:     1,
  terran:    2,
  tundra:    2,
};
const FRAMES_PER_PLANET = 60;

// --- Ships manifest (pixel art shooter kit) ---
const SHIP_TYPES = 3;
const SHIP_FRAMES = 6;
const SHIP_COLORS = ["blue", "red"];
const SHIP_DIRS = ["left", "right"];

// --- Static icon manifest (for decoration / background) ---
const MANIFEST = {
  suns: 28,
  nebulae: 8,
  starfield: 8,
  comets: 8,
  asteroids: 16,
  galaxies: 4,
  blackholes: 8,
  quasars: 4,
  supernova: 2,
  rings: 18,
  asteroid_belts: 4,
  moons: 16,
  moons_mini: 16,
  dyson: 7,
  stations: 3,
  ships: SHIP_TYPES,
};

// Static planet icons (for canvas decoration, NOT for agents)
const PLANET_CATEGORIES = {
  terran:    16,
  forest:    14,
  ocean:      8,
  gas_giant: 16,
  tech:      12,
  lava:      12,
  ice:        4,
  tundra:     8,
  barren:    16,
  rocky:     12,
  desert:     8,
};

// Solar planet → landscape biome mapping
const PLANET_BIOME = {
  mercury: "Barren",
  venus: "Lava",
  earth: "Terran",
  mars: "Desert",
  jupiter: "Gas_giant_rings",
  saturn: "Gas_giant_rings",
  uranus: "Arctic",
  neptune: "Ocean",
};

function nameHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Build a flat list of all animated planet [category, variant] pairs.
 * Total: 21 unique planets. Each agent gets one deterministically.
 */
function buildPlanetPool() {
  const pool = [];
  for (const [cat, variants] of Object.entries(ANIMATED_PLANETS)) {
    for (let v = 1; v <= variants; v++) {
      pool.push({ cat, variant: v });
    }
  }
  return pool;
}

const PLANET_POOL = buildPlanetPool(); // 21 entries

class SpaceAssets {
  constructor() {
    this._cache = new Map(); // path -> Image
    this._loadCount = 0;
    this._totalCount = 0;
    // Agent -> cached array of 60 Image frames
    this._agentFrames = new Map(); // agentName -> Image[]
  }

  /** Preload all assets. */
  preload() {
    // Animated sun (project view)
    for (let i = 1; i <= SUN_FRAMES; i++) this._load(`/img/space/solar/sun/${i}.png`);

    // Solar system planets (project view)
    for (const planet of SOLAR_PLANETS) {
      for (let i = 1; i <= SOLAR_FRAMES; i++) this._load(`/img/space/solar/${planet}/${i}.png`);
    }

    // Static sun icons (global view fallback)
    for (let i = 1; i <= MANIFEST.suns; i++) this._load(`/img/space/suns/${i}.png`);

    // Animated planets (48x48, 60 frames each)
    for (const { cat, variant } of PLANET_POOL) {
      for (let f = 1; f <= FRAMES_PER_PLANET; f++) {
        this._load(`/img/space/animated/${cat}/${variant}/${f}.png`);
      }
    }

    // Background decorations (static icons)
    for (let i = 1; i <= MANIFEST.nebulae; i++) this._load(`/img/space/nebulae/${i}.png`);
    for (let i = 1; i <= MANIFEST.starfield; i++) this._load(`/img/space/starfield/${i}.png`);
    for (let i = 1; i <= MANIFEST.galaxies; i++) this._load(`/img/space/galaxies/${i}.png`);
    for (let i = 1; i <= MANIFEST.comets; i++) this._load(`/img/space/comets/${i}.png`);
    for (let i = 1; i <= MANIFEST.asteroids; i++) this._load(`/img/space/asteroids/${i}.png`);
    for (let i = 1; i <= MANIFEST.supernova; i++) this._load(`/img/space/supernova/${i}.png`);
    for (let i = 1; i <= MANIFEST.quasars; i++) this._load(`/img/space/quasars/Quasar${i}.png`);
    this._load("/img/space/stations/Station1.png");
    this._load("/img/space/stations/Station2.png");
    this._load("/img/space/stations/Station3.png");

    // Dyson sphere overlays (7 frames, overlay on sun)
    for (let i = 1; i <= MANIFEST.dyson; i++) this._load(`/img/space/dyson/${i}.png`);

    // Mini moons (16x16, for orbiting project planets)
    for (let i = 1; i <= MANIFEST.moons_mini; i++) this._load(`/img/space/moons_mini/${i}.png`);

    // Ships (pixel art shooter kit — 3 types, 2 colors, 2 dirs, 6 frames)
    for (let t = 1; t <= SHIP_TYPES; t++) {
      for (const color of SHIP_COLORS) {
        for (const dir of SHIP_DIRS) {
          for (let f = 1; f <= SHIP_FRAMES; f++) {
            this._load(`/img/space/ships/${t}/${color}/${dir}/${f}.png`);
          }
        }
      }
    }

    // Landscape panoramas (256x48, for colony surface view)
    const LANDSCAPES = {
      Barren: 4, Desert: 2, Forest: 2, Terran: 2, Lava: 2,
      Ocean: 1, Arctic: 1, Tundra: 1, Gas_giant_rings: 4, Space_station: 4,
    };
    for (const [biome, count] of Object.entries(LANDSCAPES)) {
      for (let i = 1; i <= count; i++) this._load(`/img/space/landscapes/${biome}/${i}.png`);
    }
  }

  _load(path) {
    if (this._cache.has(path)) return;
    this._totalCount++;
    const img = new Image();
    img.onload = () => { this._loadCount++; };
    img.src = path;
    this._cache.set(path, img);
  }

  get(path) {
    const img = this._cache.get(path);
    if (img && img.complete && img.naturalWidth > 0) return img;
    return null;
  }

  get progress() {
    return this._totalCount > 0 ? this._loadCount / this._totalCount : 0;
  }

  /** Get animated sun frame (project focused view). */
  getSunFrame(frameIndex) {
    const f = (frameIndex % SUN_FRAMES) + 1;
    return this.get(`/img/space/solar/sun/${f}.png`);
  }

  /** Get solar system planet frame (project focused view). */
  getSolarPlanetFrame(planetName, frameIndex) {
    const f = (frameIndex % SOLAR_FRAMES) + 1;
    return this.get(`/img/space/solar/${planetName}/${f}.png`);
  }

  /** Get static sun image for a project name (global view). */
  getSun(projectName) {
    const idx = (nameHash(projectName) % MANIFEST.suns) + 1;
    return this.get(`/img/space/suns/${idx}.png`);
  }

  /** Get static sun image by index (1-28). */
  getSunByIndex(idx) {
    return this.get(`/img/space/suns/${idx}.png`);
  }

  /** Total number of static sun types. */
  get sunCount() { return MANIFEST.suns; }

  /** All animated planet type keys (e.g. ["barren/1", "barren/2", ...]). */
  get planetTypes() { return PLANET_POOL.map(p => `${p.cat}/${p.variant}`); }

  /** Get Dyson sphere overlay frame (1-7). */
  getDysonFrame(frameIndex) {
    const f = (frameIndex % MANIFEST.dyson) + 1;
    return this.get(`/img/space/dyson/${f}.png`);
  }

  /** Get mini moon by index (1-16). */
  getMiniMoon(index) {
    return this.get(`/img/space/moons_mini/${index}.png`);
  }

  /** Total mini moon count. */
  get miniMoonCount() { return MANIFEST.moons_mini; }

  /**
   * Get the current frame for a planet_type (e.g. "terran/1").
   * frameIndex: 0..59, cycling over time.
   */
  getPlanetFrame(planetType, frameIndex) {
    if (!planetType) return null;
    const f = (frameIndex % FRAMES_PER_PLANET) + 1;
    return this.get(`/img/space/animated/${planetType}/${f}.png`);
  }

  /**
   * Fallback planet type from name hash (for agents not yet in DB).
   */
  fallbackPlanetType(agentName) {
    const h = nameHash(agentName);
    const p = PLANET_POOL[h % PLANET_POOL.length];
    return `${p.cat}/${p.variant}`;
  }

  /** Get landscape image for a solar planet biome. */
  getLandscape(solarPlanet, variant = 1) {
    const biome = PLANET_BIOME[solarPlanet] || "Barren";
    return this.get(`/img/space/landscapes/${biome}/${variant}.png`);
  }

  /** Get ship frame. type: 1-3, color: "blue"|"red", dir: "left"|"right", frame: 1-6 */
  getShipFrame(type, color, dir, frame) {
    const f = ((frame - 1) % SHIP_FRAMES) + 1;
    return this.get(`/img/space/ships/${type}/${color}/${dir}/${f}.png`);
  }

  /** Get a specific decoration asset by category and index. */
  getByCategory(category, index) {
    if (category === "quasars") return this.get(`/img/space/quasars/Quasar${index}.png`);
    if (category === "stations") return this.get(`/img/space/stations/Station${index}.png`);
    return this.get(`/img/space/${category}/${index}.png`);
  }

  /** Get random decoration asset from a category. */
  getRandom(category) {
    const count = MANIFEST[category];
    if (!count) return null;
    const idx = Math.floor(Math.random() * count) + 1;
    return this.getByCategory(category, idx);
  }
}

// Singleton
export const spaceAssets = new SpaceAssets();
export { nameHash, MANIFEST, PLANET_CATEGORIES, ANIMATED_PLANETS, FRAMES_PER_PLANET, PLANET_BIOME };
