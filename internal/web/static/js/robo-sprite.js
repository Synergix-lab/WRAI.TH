/**
 * RoboSprite — Tilesheet parser for 32x32 robot character sprites.
 *
 * Tilesheet: /img/characters/robo.png (320x352, 10 cols x 11 rows)
 *
 * Animations (row-based):
 *   idle:    row 0, 4 frames   — standing
 *   walk:    row 7, 4 frames   — walk right with tool
 *   work:    row 4, 3 frames   — action/building
 *   spawn:   row 6, 4 frames   — teleport effect (blue particles)
 */

const FRAME_W = 32;
const FRAME_H = 32;
const COLS = 10;

const ANIMATIONS = {
  idle:  { row: 0, frames: 4, speed: 0.25 },  // slow idle
  walk:  { row: 7, frames: 4, speed: 0.12 },  // brisk walk
  work:  { row: 4, frames: 3, speed: 0.18 },  // working
  spawn: { row: 6, frames: 4, speed: 0.10 },  // teleport in
};

class RoboSpriteSheet {
  constructor() {
    this._img = null;
    this._loaded = false;
  }

  preload() {
    this._img = new Image();
    this._img.onload = () => { this._loaded = true; };
    this._img.src = "/img/characters/robo.png";
  }

  get ready() { return this._loaded && this._img; }

  /**
   * Draw a specific frame from the tilesheet.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} anim - animation name (idle, walk, work, spawn)
   * @param {number} frameIndex - current frame in the animation cycle
   * @param {number} x - center x
   * @param {number} y - bottom y (feet position)
   * @param {number} scale - render scale (default 2 = 64px)
   * @param {boolean} flipX - mirror horizontally
   */
  draw(ctx, anim, frameIndex, x, y, scale = 2, flipX = false) {
    if (!this._loaded || !this._img) return;
    const def = ANIMATIONS[anim] || ANIMATIONS.idle;
    const frame = frameIndex % def.frames;
    const sx = frame * FRAME_W;
    const sy = def.row * FRAME_H;
    const dw = FRAME_W * scale;
    const dh = FRAME_H * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flipX) {
      ctx.translate(x, y - dh);
      ctx.scale(-1, 1);
      ctx.drawImage(this._img, sx, sy, FRAME_W, FRAME_H, -dw / 2, 0, dw, dh);
    } else {
      ctx.drawImage(this._img, sx, sy, FRAME_W, FRAME_H, x - dw / 2, y - dh, dw, dh);
    }
    ctx.restore();
  }

  /** Get animation speed (seconds per frame) */
  getSpeed(anim) {
    return (ANIMATIONS[anim] || ANIMATIONS.idle).speed;
  }

  /** Get frame count for animation */
  getFrameCount(anim) {
    return (ANIMATIONS[anim] || ANIMATIONS.idle).frames;
  }
}

// Singleton
export const roboSprite = new RoboSpriteSheet();
export { ANIMATIONS };
