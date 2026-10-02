// ?overlay: canvas grid, landmark crosses and CPU streamlines drawn over the canvas pose, for tuning at E (§9.1 step 5).
import { Vector3, type PerspectiveCamera } from 'three';
import { CANVAS_ASPECT, CHURCH, CYPRESS_SIL, MOON_DEF, STARS, VORTICES } from '../contracts';
import { canvasToWorld } from '../shared/canvasSpace';
import { ridgeV, streamline } from '../shared/flowField';

export class DebugOverlay {
  private readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly lines: Float32Array[] = [];

  constructor(parent: HTMLElement) {
    this.el = document.createElement('canvas');
    Object.assign(this.el.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '5' });
    parent.appendChild(this.el);
    this.ctx = this.el.getContext('2d')!;
    for (let i = 0; i < 200; i++) {
      const x = ((i % 20) / 19) * 1.5 * CANVAS_ASPECT - 0.25 * CANVAS_ASPECT;
      const y = 0.35 + (Math.floor(i / 20) / 9) * 0.7;
      this.lines.push(streamline(x, y, 40, 0.006));
    }
  }

  /** Draws in world space projected through the live camera, so it also shows how far the camera is from E. */
  draw(camera: PerspectiveCamera): void {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    if (this.el.width !== w || this.el.height !== h) {
      this.el.width = w;
      this.el.height = h;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    const p = new Vector3();
    const toScreen = (u: number, v: number): [number, number] | null => {
      canvasToWorld(u, v, 1000, p).project(camera);
      if (p.z > 1) return null;
      return [(p.x * 0.5 + 0.5) * w, (0.5 - p.y * 0.5) * h];
    };
    const path = (pts: [number, number][], color: string, width = 1) => {
      const s = pts.map(([u, v]) => toScreen(u, v));
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      let pen = false;
      for (const q of s) {
        if (!q) { pen = false; continue; }
        if (pen) ctx.lineTo(q[0], q[1]);
        else ctx.moveTo(q[0], q[1]);
        pen = true;
      }
      ctx.stroke();
    };
    for (let i = 0; i <= 10; i++) {
      path([[i / 10, 0], [i / 10, 1]], 'rgba(255,0,255,0.25)');
      path([[0, i / 10], [1, i / 10]], 'rgba(255,0,255,0.25)');
    }
    path([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], 'rgba(255,0,255,0.8)', 2);
    for (const line of this.lines) {
      const pts: [number, number][] = [];
      for (let k = 0; k < line.length; k += 2) pts.push([line[k] / CANVAS_ASPECT, line[k + 1]]);
      path(pts, 'rgba(120,255,200,0.35)');
    }
    for (let k = 0; k < 3; k++) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 80; i++) pts.push([-0.3 + (i / 80) * 1.6, ridgeV(-0.3 + (i / 80) * 1.6, k)]);
      path(pts, 'rgba(120,160,255,0.7)');
    }
    path(CYPRESS_SIL.map((r) => [r[1], r[0]] as [number, number]).concat(CYPRESS_SIL.slice().reverse().map((r) => [r[2], r[0]] as [number, number])), 'rgba(80,255,80,0.8)', 1.5);
    const cross = (u: number, v: number, label: string, color: string) => {
      const q = toScreen(u, v);
      if (!q) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(q[0] - 6, q[1]); ctx.lineTo(q[0] + 6, q[1]);
      ctx.moveTo(q[0], q[1] - 6); ctx.lineTo(q[0], q[1] + 6);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = '11px ui-monospace, Consolas, monospace';
      ctx.fillText(label, q[0] + 7, q[1] - 5);
    };
    STARS.forEach((s) => cross(s.u, s.v, s.name, '#ffe066'));
    cross(MOON_DEF.u, MOON_DEF.v, 'moon', '#ffb347');
    VORTICES.forEach((V) => cross(V.u, V.v, V.name, '#9fd3ff'));
    cross(CHURCH.u, 0.446, 'spire', '#ff8080');
  }

  dispose(): void {
    this.el.remove();
  }
}
