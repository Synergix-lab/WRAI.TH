/**
 * ConnectionOverlay — renders hierarchy lines between agents.
 * Team zones removed — teams shown as badges on agent sprites instead.
 */
export class ConnectionOverlay {
  constructor() {
    this.agentViews = null;
    this.teams = [];
    this.y = -99999;
    this._pulsePhase = 0;
    this.showHierarchy = true;
  }

  setData(agentViews, teams) {
    this.agentViews = agentViews;
    this.teams = teams || [];
  }

  update(dt) {
    this._pulsePhase += dt * 1.5;
  }

  render(ctx) {
    if (!this.agentViews || this.agentViews.size === 0) return;
    if (this.showHierarchy) this._renderHierarchy(ctx);
  }

  _renderHierarchy(ctx) {
    if (!this.agentViews) return;

    ctx.save();
    const alpha = 0.18 + 0.07 * Math.sin(this._pulsePhase);

    for (const [, av] of this.agentViews) {
      if (!av._reportsTo) continue;
      const managerKey = `${av.project}:${av._reportsTo}`;
      const manager = this.agentViews.get(managerKey);
      if (!manager) continue;

      ctx.strokeStyle = `rgba(162, 155, 254, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.moveTo(av.x, av.y - 20);
      ctx.lineTo(manager.x, manager.y + 20);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }
}
