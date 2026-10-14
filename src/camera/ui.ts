// M8 DOM overlay (§4.8) + Multi-Punctum Provençal Suite Bar & Continuous Odyssey Scrubber Timeline:
// end-of-loop hint, the H HUD, the free-mode gold ring at E's projection, the interactive 4-painting Suite Bar,
// the bottom Continuous 4-Act Odyssey Scrubber Bar, and the museum chapter title card.
import { type PerspectiveCamera, Vector3 } from 'three';
import { EYE, FORWARD } from '../shared/canvasSpace';
import type { PaintingId } from '../chapters/types';

export const HINT_TEXT = '拖曳探索 3D 筆觸 · Space 歸位凝視點 · [ ] 切換梵谷畫作';

const STYLE_ID = 'pn-director-ui-style';
const CSS = `
.pn-ui{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:20;overflow:hidden;
  font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans TC",sans-serif;color:#e8edf0;-webkit-user-select:none;user-select:none}
.pn-hint{position:absolute;left:50%;bottom:74px;transform:translateX(-50%);max-width:calc(100% - 32px);box-sizing:border-box;
  padding:6px 14px;border-radius:999px;background:rgba(5,10,24,.62);box-shadow:0 0 0 1px rgba(232,237,240,.12);
  letter-spacing:.03em;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.8);
  opacity:0;transition:opacity .25s linear}
.pn-hud{position:absolute;left:10px;top:54px;max-width:calc(100% - 20px);box-sizing:border-box;padding:6px 9px;border-radius:6px;
  background:rgba(5,10,24,.68);box-shadow:0 0 0 1px rgba(232,237,240,.10);
  font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;white-space:pre-wrap;word-break:break-word;display:none}
.pn-hud b{color:#f2c230;font-weight:600}
.pn-ring{position:absolute;left:0;top:0;border-radius:50%;border:1.5px solid #f2c230;box-sizing:border-box;
  box-shadow:0 0 6px rgba(242,194,48,.55),inset 0 0 4px rgba(242,194,48,.35);display:none;will-change:transform}
.pn-ring::after{content:"";position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;background:#f2c230}
.pn-suite{position:absolute;left:50%;top:12px;transform:translateX(-50%);pointer-events:auto;display:flex;align-items:center;gap:4px;
  padding:4px 6px;border-radius:999px;background:rgba(5,10,24,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  box-shadow:0 4px 20px rgba(0,0,0,.45),0 0 0 1px rgba(232,237,240,.14);max-width:calc(100% - 16px);overflow-x:auto}
.pn-suite-btn{appearance:none;border:0;background:transparent;color:rgba(232,237,240,.78);padding:4px 11px;border-radius:999px;
  font:500 12px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;letter-spacing:.02em;cursor:pointer;
  white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease}
.pn-suite-btn:hover{color:#fff;background:rgba(232,237,240,.10)}
.pn-suite-btn[data-active="1"]{color:#f5e27a;background:rgba(242,194,48,.18);box-shadow:inset 0 0 0 1px rgba(242,194,48,.52)}
.pn-suite-sep{width:1px;height:14px;background:rgba(232,237,240,.16);margin:0 2px;flex-shrink:0}
.pn-odyssey-btn{appearance:none;border:0;background:rgba(232,237,240,.07);color:rgba(232,237,240,.72);padding:4px 10px;border-radius:999px;
  font:500 11.5px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;letter-spacing:.02em;cursor:pointer;
  white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease}
.pn-odyssey-btn:hover{color:#fff;background:rgba(232,237,240,.14)}
.pn-odyssey-btn[data-on="1"]{color:#f5e27a;background:rgba(242,194,48,.16);box-shadow:inset 0 0 0 1px rgba(242,194,48,.45)}
.pn-card{position:absolute;left:50%;bottom:84px;transform:translateX(-50%);text-align:center;pointer-events:none;
  padding:10px 22px;border-radius:14px;background:rgba(5,10,24,.66);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  box-shadow:0 8px 28px rgba(0,0,0,.45),0 0 0 1px rgba(242,194,48,.24);opacity:0;transition:opacity .45s ease}
.pn-card-sub{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#f2c230;margin-bottom:3px;opacity:.92}
.pn-card-title{font-size:15px;font-weight:600;letter-spacing:.04em;color:#f4f7f9;text-shadow:0 1px 3px rgba(0,0,0,.85)}
.pn-tl{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:min(680px,calc(100% - 24px));box-sizing:border-box;
  padding:7px 14px 8px;border-radius:14px;background:rgba(5,10,24,.68);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  box-shadow:0 4px 20px rgba(0,0,0,.42),0 0 0 1px rgba(232,237,240,.13);pointer-events:auto;display:none}
.pn-tl-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-size:11.5px;letter-spacing:.02em}
.pn-tl-shot{color:#f5e27a;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:75%}
.pn-tl-time{color:rgba(232,237,240,.72);font:11px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;flex-shrink:0}
.pn-tl-track{position:relative;height:7px;border-radius:999px;background:rgba(232,237,240,.15);cursor:pointer;touch-action:none}
.pn-tl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#d98a1e,#f2c230,#f5e27a);width:0%}
.pn-tl-thumb{position:absolute;top:50%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;background:#f5e27a;
  box-shadow:0 0 8px rgba(242,194,48,.85),0 0 0 1.5px #050a18;left:0%}
.pn-tl-mark{position:absolute;top:-1px;bottom:-1px;width:1.5px;background:rgba(5,10,24,.85);z-index:1}
.pn-tl-acts{display:grid;grid-template-columns:repeat(4,1fr);margin-top:4px;font-size:10.5px;color:rgba(232,237,240,.58)}
.pn-tl-act{text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px}
.pn-tl-act[data-active="1"]{color:#f5e27a;font-weight:600}
.pn-focusable:focus{outline:none}
.pn-focusable:focus-visible{outline:2px solid #f2c230;outline-offset:-3px}
@media (prefers-reduced-motion:reduce){.pn-hint,.pn-card{transition:none}}
`;

export interface RingState { x: number; y: number; r: number; visible: boolean; opacity: number }
export interface UiState {
  hud: boolean;
  /** director line shown under the integrator's HUD text */
  hudLine: string;
  /** 0..1 */
  hintOpacity: number;
  ring: RingState;
  loopTime?: number;
  loopSeconds?: number;
  shotName?: string;
}

export interface SuiteItem {
  id: PaintingId;
  roman: string;
  shortZh: string;
  titleZh: string;
  titleEn: string;
  placeZh: string;
  year: string;
}

export const SUITE_ITEMS: readonly SuiteItem[] = [
  { id: 'cafe',   roman: 'I',   shortZh: '夜間咖啡座', titleZh: '夜間露天咖啡座', titleEn: 'Café Terrace at Night',       placeZh: '亞爾 · 論壇廣場',     year: '1888.09' },
  { id: 'rhone',  roman: 'II',  shortZh: '隆河星夜',   titleZh: '隆河上的星夜',   titleEn: 'Starry Night Over the Rhône', placeZh: '亞爾 · 隆河河畔',     year: '1888.09' },
  { id: 'starry', roman: 'III', shortZh: '星夜',       titleZh: '星夜',           titleEn: 'The Starry Night',            placeZh: '聖雷米 · 聖保羅療養院', year: '1889.06' },
  { id: 'wheat',  roman: 'IV',  shortZh: '絲柏麥田',   titleZh: '有絲柏的麥田',   titleEn: 'Wheat Field with Cypresses',  placeZh: '聖雷米 · 阿爾皮耶山麓', year: '1889.07' },
];

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

/** Self-contained overlay. Positions follow the input element's client rect (it need not be full-window). */
export class DirectorUI {
  readonly root: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly hudExtern: HTMLSpanElement;
  private readonly hudLine: HTMLSpanElement;
  private readonly ring: HTMLDivElement;
  private readonly suiteBar: HTMLDivElement;
  private readonly chapterBtns = new Map<PaintingId, HTMLButtonElement>();
  private readonly odysseyBtn: HTMLButtonElement;
  private readonly card: HTMLDivElement;
  private readonly cardSub: HTMLDivElement;
  private readonly cardTitle: HTMLDivElement;
  private readonly tlRoot: HTMLDivElement;
  private readonly tlShot: HTMLSpanElement;
  private readonly tlTime: HTMLSpanElement;
  private readonly tlTrack: HTMLDivElement;
  private readonly tlFill: HTMLDivElement;
  private readonly tlThumb: HTMLDivElement;
  private readonly tlMarks: HTMLDivElement[] = [];
  private readonly tlActsRow: HTMLDivElement;
  private readonly tlActEls = new Map<PaintingId, HTMLDivElement>();
  private cardTimer: number | null = null;
  private hudText = '';
  private last = { hud: false, hint: -1, hudLine: '', ring: '', rect: '', tlPct: -1, tlShot: '', tlTime: '' };
  private onSelectPainting: ((id: PaintingId) => void) | null = null;
  private onToggleOdyssey: (() => void) | null = null;
  private onSeek: ((fraction: number) => void) | null = null;
  private scrubbing = false;

  constructor(private readonly input: HTMLElement) {
    const doc = input.ownerDocument;
    if (!doc.getElementById(STYLE_ID)) {
      const st = doc.createElement('style');
      st.id = STYLE_ID;
      st.textContent = CSS;
      doc.head.appendChild(st);
    }
    if (!input.hasAttribute('tabindex')) input.tabIndex = 0;
    input.classList.add('pn-focusable');
    this.root = doc.createElement('div');
    this.root.className = 'pn-ui';

    // Top-center Provençal Suite Bar
    this.suiteBar = doc.createElement('div');
    this.suiteBar.className = 'pn-suite';
    this.suiteBar.style.display = 'none';
    for (const item of SUITE_ITEMS) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pn-suite-btn';
      btn.textContent = `${item.roman} · ${item.shortZh}`;
      btn.title = `${item.titleZh} (${item.titleEn}, ${item.year})`;
      btn.dataset.active = item.id === 'cafe' ? '1' : '0';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelectPainting?.(item.id);
        this.input.focus();
      });
      this.chapterBtns.set(item.id, btn);
      this.suiteBar.appendChild(btn);
    }
    const sep = doc.createElement('div');
    sep.className = 'pn-suite-sep';
    this.odysseyBtn = doc.createElement('button');
    this.odysseyBtn.type = 'button';
    this.odysseyBtn.className = 'pn-odyssey-btn';
    this.odysseyBtn.textContent = '∞ 四畫連貫動畫：開';
    this.odysseyBtn.title = '切換四幅畫一鏡到底連貫動畫 / 單幅循環 (快捷鍵 O)';
    this.odysseyBtn.dataset.on = '1';
    this.odysseyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onToggleOdyssey?.();
      this.input.focus();
    });
    this.suiteBar.append(sep, this.odysseyBtn);

    // Bottom Continuous Odyssey Scrubber Timeline Bar
    this.tlRoot = doc.createElement('div');
    this.tlRoot.className = 'pn-tl';
    const tlHead = doc.createElement('div');
    tlHead.className = 'pn-tl-head';
    this.tlShot = doc.createElement('span');
    this.tlShot.className = 'pn-tl-shot';
    this.tlTime = doc.createElement('span');
    this.tlTime.className = 'pn-tl-time';
    tlHead.append(this.tlShot, this.tlTime);

    this.tlTrack = doc.createElement('div');
    this.tlTrack.className = 'pn-tl-track';
    this.tlFill = doc.createElement('div');
    this.tlFill.className = 'pn-tl-fill';
    this.tlThumb = doc.createElement('div');
    this.tlThumb.className = 'pn-tl-thumb';
    for (const pct of [25, 50, 75]) {
      const m = doc.createElement('div');
      m.className = 'pn-tl-mark';
      m.style.left = `${pct}%`;
      this.tlMarks.push(m);
      this.tlTrack.appendChild(m);
    }
    this.tlTrack.append(this.tlFill, this.tlThumb);

    const seekFromEvent = (clientX: number) => {
      const rect = this.tlTrack.getBoundingClientRect();
      if (rect.width <= 0) return;
      const frac = Math.max(0, Math.min(0.9999, (clientX - rect.left) / rect.width));
      this.onSeek?.(frac);
    };
    this.tlTrack.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.scrubbing = true;
      this.tlTrack.setPointerCapture(e.pointerId);
      seekFromEvent(e.clientX);
    });
    this.tlTrack.addEventListener('pointermove', (e) => {
      if (!this.scrubbing) return;
      e.stopPropagation();
      seekFromEvent(e.clientX);
    });
    const endScrub = (e: PointerEvent) => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      try { this.tlTrack.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      this.input.focus();
    };
    this.tlTrack.addEventListener('pointerup', endScrub);
    this.tlTrack.addEventListener('pointercancel', endScrub);

    this.tlActsRow = doc.createElement('div');
    this.tlActsRow.className = 'pn-tl-acts';
    for (const item of SUITE_ITEMS) {
      const a = doc.createElement('div');
      a.className = 'pn-tl-act';
      a.textContent = `${item.roman} · ${item.shortZh}`;
      this.tlActEls.set(item.id, a);
      this.tlActsRow.appendChild(a);
    }
    this.tlRoot.append(tlHead, this.tlTrack, this.tlActsRow);

    // Museum Chapter Title Card
    this.card = doc.createElement('div');
    this.card.className = 'pn-card';
    this.cardSub = doc.createElement('div');
    this.cardSub.className = 'pn-card-sub';
    this.cardTitle = doc.createElement('div');
    this.cardTitle.className = 'pn-card-title';
    this.card.append(this.cardSub, this.cardTitle);

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
    this.root.append(this.ring, this.suiteBar, this.card, this.tlRoot, this.hint, this.hud);
    doc.body.appendChild(this.root);
  }

  /** Wire the Multi-Punctum Suite Bar and bottom Odyssey timeline callbacks. */
  wireSuite(opts: {
    active: PaintingId;
    odyssey: boolean;
    showBar?: boolean;
    onSelect: (id: PaintingId) => void;
    onToggleOdyssey: () => void;
    onSeek?: (fraction: number) => void;
  }): void {
    this.onSelectPainting = opts.onSelect;
    this.onToggleOdyssey = opts.onToggleOdyssey;
    this.onSeek = opts.onSeek ?? null;
    const vis = opts.showBar === false ? 'none' : 'flex';
    this.suiteBar.style.display = vis;
    this.tlRoot.style.display = opts.showBar === false ? 'none' : 'block';
    this.setSuiteState(opts.active, opts.odyssey, true);
  }

  /** Update active painting pill, Odyssey toggle state, and optionally flash the museum title card. */
  setSuiteState(active: PaintingId, odyssey: boolean, showCard = false): void {
    for (const [id, btn] of this.chapterBtns) {
      btn.dataset.active = id === active ? '1' : '0';
    }
    for (const [id, el] of this.tlActEls) {
      el.dataset.active = id === active ? '1' : '0';
    }
    for (const m of this.tlMarks) {
      m.style.display = odyssey ? 'block' : 'none';
    }
    this.tlActsRow.style.display = odyssey ? 'grid' : 'none';
    this.odysseyBtn.dataset.on = odyssey ? '1' : '0';
    this.odysseyBtn.textContent = odyssey ? '∞ 四畫連貫動畫：開' : '∞ 單幅循環模式';
    if (showCard) {
      const item = SUITE_ITEMS.find((x) => x.id === active);
      if (item) {
        this.cardSub.textContent = `ACT ${item.roman} · ${item.placeZh} · ${item.year}`;
        this.cardTitle.textContent = `${item.titleZh}  ·  ${item.titleEn}`;
        this.card.style.opacity = '1';
        if (this.cardTimer !== null) window.clearTimeout(this.cardTimer);
        this.cardTimer = window.setTimeout(() => {
          this.card.style.opacity = '0';
        }, 3800);
      }
    }
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
    if (s.loopTime !== undefined && s.loopSeconds !== undefined && s.loopSeconds > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((s.loopTime / s.loopSeconds) * 1000) / 10));
      if (pct !== this.last.tlPct) {
        this.last.tlPct = pct;
        this.tlFill.style.width = `${pct}%`;
        this.tlThumb.style.left = `${pct}%`;
      }
      const shotStr = s.shotName ?? '';
      if (shotStr !== this.last.tlShot) {
        this.last.tlShot = shotStr;
        this.tlShot.textContent = shotStr;
      }
      const timeStr = `${fmtTime(s.loopTime)} / ${fmtTime(s.loopSeconds)}`;
      if (timeStr !== this.last.tlTime) {
        this.last.tlTime = timeStr;
        this.tlTime.textContent = timeStr;
      }
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
    if (this.cardTimer !== null) window.clearTimeout(this.cardTimer);
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
