// M8 DOM overlay (§4.8): end-of-loop hint, the H HUD and the free-mode gold ring at E's projection.
// One injected <style>; everything is pointer-events: none so it never steals input from the canvas.
import { type PerspectiveCamera, Vector3 } from 'three';
import { EYE, FORWARD } from '../shared/canvasSpace';

export const HINT_TEXT = 'drag to explore · Space returns to the eye';

const STYLE_ID = 'pn-director-ui-style';
const CSS = `
.pn-ui{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:20;overflow:hidden;
  font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e8edf0;-webkit-user-select:none;user-select:none}
.pn-hint{position:absolute;left:50%;bottom:6.5%;transform:translateX(-50%);max-width:calc(100% - 32px);box-sizing:border-box;
  padding:6px 14px;border-radius:999px;background:rgba(5,10,24,.58);box-shadow:0 0 0 1px rgba(232,237,240,.10);
  letter-spacing:.02em;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.8);
  opacity:0;transition:opacity .25s linear}
.pn-hud{position:absolute;left:10px;top:10px;max-width:calc(100% - 20px);box-sizing:border-box;padding:6px 9px;border-radius:6px;
  background:rgba(5,10,24,.66);box-shadow:0 0 0 1px rgba(232,237,240,.10);
  font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;white-space:pre-wrap;word-break:break-word;display:none}
.pn-hud b{color:#f2c230;font-weight:600}
.pn-ring{position:absolute;left:0;top:0;border-radius:50%;border:1.5px solid #f2c230;box-sizing:border-box;
  box-shadow:0 0 6px rgba(242,194,48,.55),inset 0 0 4px rgba(242,194,48,.35);display:none;will-change:transform}
.pn-ring::after{content:"";position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;background:#f2c230}
.pn-focusable:focus{outline:none}
.pn-focusable:focus-visible{outline:2px solid #f2c230;outline-offset:-3px}
@media (prefers-reduced-motion:reduce){.pn-hint{transition:none}}
`;

export interface RingState { x: number; y: number; r: number; visible: boolean; opacity: number }
export interface UiState {
  hud: boolean;
  /** director line shown under the integrator's HUD text */
  hudLine: string;
  /** 0..1 */
  hintOpacity: number;
  ring: RingState;
}

/** Self-contained overlay. Positions follow the input element's client rect (it need not be full-window). */
export class DirectorUI {
  readonly root: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly hudExtern: HTMLSpanElement;
  private readonly hudLine: HTMLSpanElement;
  private readonly ring: HTMLDivElement;
  private hudText = '';
  private last = { hud: false, hint: -1, hudLine: '', ring: '' , rect: '' };

  constructor(private readonly input: HTMLElement) {
    const doc = input.ownerDocument;
    if (!doc.getElementById(STYLE_ID)) {
      const st = doc.createElement('style');
      st.id = STYLE_ID;
      st.textContent = CSS;
      doc.head.appendChild(st);
    }
    // keyboard reachable canvas with a visible focus ring
    if (!input.hasAttribute('tabindex')) input.tabIndex = 0;
    input.classList.add('pn-focusable');
    this.root = doc.createElement('div');
    this.root.className = 'pn-ui';
    this.hint = doc.createElement('div');
    this.hint.className = 'pn-hint';
    this.hint.setAttribute('role', 'status');
    this.hint.textContent = HINT_TEXT;
    this.hud = doc.createElement('div');
    this.hud.className = 'pn-hud';
    this.hud.setAttribute('aria-live', 'off');
    this.hudExtern = doc.createElement('span');
    this.hudLine = doc.createElement('span');
    this.hud.append(this.hudExtern, doc.createElement('br'), this.hudLine);
    this.ring = doc.createElement('div');
    this.ring.className = 'pn-ring';
    this.ring.setAttribute('aria-hidden', 'true');
    this.root.append(this.ring, this.hint, this.hud);
    doc.body.appendChild(this.root);
  }

  /** Text from the integrator (fps, tier, render scale ...). Shown while the HUD is on. */
  setHudText(text: string): void {
    if (text === this.hudText) return;
    this.hudText = text;
    this.hudExtern.textContent = text;
  }

  render(s: UiState): void {
    const r = this.input.getBoundingClientRect();
    const rectKey = `${r.left}|${r.top}|${r.width}|${r.height}`;
    if (rectKey !== this.last.rect) {
      this.last.rect = rectKey;
      const st = this.root.style;
      st.left = `${r.left}px`;
      st.top = `${r.top}px`;
      st.width = `${r.width}px`;
      st.height = `${r.height}px`;
    }
    if (s.hud !== this.last.hud) {
      this.last.hud = s.hud;
      this.hud.style.display = s.hud ? 'block' : 'none';
    }
    if (s.hud && s.hudLine !== this.last.hudLine) {
      this.last.hudLine = s.hudLine;
      this.hudLine.textContent = s.hudLine;
    }
    const h = Math.round(s.hintOpacity * 100) / 100;
    if (h !== this.last.hint) {
      this.last.hint = h;
      this.hint.style.opacity = String(h);
      this.hint.style.visibility = h > 0 ? 'visible' : 'hidden';
    }
    const g = s.ring;
    const ringKey = g.visible ? `${g.x.toFixed(1)}|${g.y.toFixed(1)}|${g.r.toFixed(1)}|${g.opacity.toFixed(2)}` : 'off';
    if (ringKey !== this.last.ring) {
      this.last.ring = ringKey;
      const st = this.ring.style;
      if (!g.visible) st.display = 'none';
      else {
        const d = 2 * g.r;
        st.display = 'block';
        st.width = `${d}px`;
        st.height = `${d}px`;
        st.opacity = String(g.opacity);
        st.transform = `translate(${g.x - g.r}px, ${g.y - g.r}px)`;
      }
    }
  }

  dispose(): void {
    this.root.remove();
    this.input.classList.remove('pn-focusable');
  }
}

const tmpP = new Vector3();
/**
 * The free-mode alignment ring: E's projection on screen (E + 1000 F when the camera is within 1 m of E, where E's own
 * projection is unstable), radius growing with misalignment, hidden when align > 0.95. Off-screen or behind-camera
 * targets are pinned to the frame edge (16 px inset) at reduced opacity. Coordinates are CSS px in the input's rect.
 */
export function projectEyeRing(camera: PerspectiveCamera, widthPx: number, heightPx: number, align: number): RingState {
  const hidden: RingState = { x: 0, y: 0, r: 0, visible: false, opacity: 0 };
  if (align > 0.95 || widthPx <= 0 || heightPx <= 0) return hidden;
  const near = camera.position.distanceTo(EYE) < 1;
  if (near) tmpP.copy(EYE).addScaledVector(FORWARD, 1000);
  else tmpP.copy(EYE);
  tmpP.applyMatrix4(camera.matrixWorldInverse);
  const behind = tmpP.z > -1e-6;
  tmpP.applyMatrix4(camera.projectionMatrix);
  let nx = tmpP.x, ny = tmpP.y;
  if (behind) { nx = -nx; ny = -ny; }
  const r = 10 + 34 * Math.min(1, 1 - align);
  const inset = 16 + r;
  let x = (nx * 0.5 + 0.5) * widthPx;
  let y = (-ny * 0.5 + 0.5) * heightPx;
  let opacity = 0.9 * Math.min(1, (0.95 - align) / 0.1 + 0.15);
  const off = behind || x < inset || x > widthPx - inset || y < inset || y > heightPx - inset;
  if (off) {
    // pin to the edge along the direction from the centre
    const cx = widthPx / 2, cy = heightPx / 2;
    let dx = x - cx, dy = y - cy;
    if (behind && Math.abs(dx) + Math.abs(dy) < 1e-3) dy = heightPx; // straight behind: point down
    const sx = (cx - inset) / Math.max(Math.abs(dx), 1e-6);
    const sy = (cy - inset) / Math.max(Math.abs(dy), 1e-6);
    const s = Math.min(sx, sy);
    if (s < 1 || behind) { dx *= s; dy *= s; }
    x = cx + dx;
    y = cy + dy;
    opacity *= 0.55;
  }
  return { x, y, r, visible: true, opacity };
}
