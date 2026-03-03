export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;

    // Smooth lerp targets
    this._targetX = 0;
    this._targetY = 0;
    this._targetZoom = 1;
  }

  update(dt) {
    const speed = 6 * dt;
    this.x += (this._targetX - this.x) * speed;
    this.y += (this._targetY - this.y) * speed;
    this.zoom += (this._targetZoom - this.zoom) * speed;
  }

  /** Apply camera transform to the canvas context. */
  apply(ctx, viewW, viewH) {
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  /** Convert screen (mouse) coordinates to world coordinates. */
  screenToWorld(sx, sy, viewW, viewH) {
    return {
      x: (sx - viewW / 2) / this.zoom + this.x,
      y: (sy - viewH / 2) / this.zoom + this.y,
    };
  }

  /** Pan by screen-space delta. */
  pan(dx, dy) {
    this._targetX -= dx / this.zoom;
    this._targetY -= dy / this.zoom;
  }

  /** Zoom at a screen position. */
  zoomAt(sx, sy, delta, viewW, viewH) {
    const factor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(5, this._targetZoom * factor));

    // Zoom toward mouse position
    const worldBefore = this.screenToWorld(sx, sy, viewW, viewH);
    this._targetZoom = newZoom;
    // After zoom change, adjust position so worldBefore stays under the mouse
    const worldAfter = {
      x: (sx - viewW / 2) / newZoom + this._targetX,
      y: (sy - viewH / 2) / newZoom + this._targetY,
    };
    this._targetX += worldBefore.x - worldAfter.x;
    this._targetY += worldBefore.y - worldAfter.y;
  }

  /** Snap to a position and zoom (used for auto-fit). */
  lookAt(x, y, zoom) {
    this._targetX = x;
    this._targetY = y;
    if (zoom !== undefined) this._targetZoom = zoom;
  }

  /** Immediate snap without lerp. */
  snapTo(x, y, zoom) {
    this.x = this._targetX = x;
    this.y = this._targetY = y;
    if (zoom !== undefined) this.zoom = this._targetZoom = zoom;
  }
}
