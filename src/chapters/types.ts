// Multi-Punctum Chapter types and coordinate/stroke helpers for the Provençal Van Gogh Suite.
import { BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three';
import {
  AT, CANVAS_ASPECT, CLASS_INFO, PALETTE, StrokeClass, StrokeFlag, T_HALF,
  type Rng, type StrokeRecord, type StrokeSink, type UnderlayMaterialFactory,
} from '../contracts';
import { canvasToWorld, EYE, segmentToStroke } from '../shared/canvasSpace';
import { mixHex, packSrgb, rampHex, shadeHex } from '../shared/palette';

export type PaintingId =
  // Chapter I — Earth (Nuenen & Antwerp, 1884–1886)
  | 'potato'
  | 'weaver'
  | 'tower'
  | 'skull'
  // Chapter II — Color (Paris & Montmartre, 1886–1887)
  | 'shoes'
  | 'galette'
  | 'paris'
  | 'seine'
  | 'plum'
  | 'tanguy'
  | 'selfportrait'
  // Chapter III — Sun (Arles, 1888–1889)
  | 'yellowhouse'
  | 'sunflowers'
  | 'harvest'
  | 'sower'
  | 'cafe'
  | 'nightcafe'
  | 'rhone'
  | 'bedroom'
  // Chapter IV — Cosmos (Saint-Rémy, 1889–1890)
  | 'starry'
  | 'irises'
  | 'olive'
  | 'wheat'
  | 'roadcypress'
  | 'almond'
  // Chapter V — Road (Auvers-sur-Oise, 1890)
  | 'cottages'
  | 'church'
  | 'gachet'
  | 'daubigny'
  | 'crows';

export const ALL_PAINTING_IDS: readonly PaintingId[] = [
  'potato', 'weaver', 'tower', 'skull',
  'shoes', 'galette', 'paris', 'seine', 'plum', 'tanguy', 'selfportrait',
  'yellowhouse', 'sunflowers', 'harvest', 'sower', 'cafe', 'nightcafe', 'rhone', 'bedroom',
  'starry', 'irises', 'olive', 'wheat', 'roadcypress', 'almond',
  'cottages', 'church', 'gachet', 'daubigny', 'crows',
];

const PAINTING_ID_SET: ReadonlySet<string> = new Set<string>(ALL_PAINTING_IDS);

export function isPaintingId(s: string | undefined | null): s is PaintingId {
  return !!s && PAINTING_ID_SET.has(s);
}

export type ChapterId = 'earth' | 'color' | 'sun' | 'cosmos' | 'road';
export type MotifId = 'light' | 'road' | 'sky' | 'flora' | 'dwelling' | 'gaze';
export type ViewMode = 'odyssey' | 'theme' | 'atlas';

export const K_D = 2 * T_HALF;
const TAU = Math.PI * 2;

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const clamp01 = (x: number) => clamp(x, 0, 1);
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Map normalized painting horizontal coordinate uP in [0, 1] for a painting of aspect ratio `aspect` to canvas `u`. */
export function uFromPaint(uP: number, aspect: number): number {
  return 0.5 + (uP - 0.5) * (aspect / CANVAS_ASPECT);
}

/** Map canvas `u` back to normalized painting coordinate uP in [0, 1] for a painting of aspect ratio `aspect`. */
export function uToPaint(u: number, aspect: number): number {
  return 0.5 + (u - 0.5) * (CANVAS_ASPECT / aspect);
}

/** Reusable module-scoped StrokeRecord to avoid 60k+ temporary heap allocations per painting build. */
const _rec: StrokeRecord = {
  u: 0, v: 0, d: 1000, cls: StrokeClass.UNDERPAINT, flags: 0,
  du: 0, dv: 0, dlnd: 0, w: 0.01,
  colA: 0, colB: 0, emissive: 0, seed: 0,
  kappa: 0, q1: 0, q2: 0, q3: 0,
};

/**
 * HOUSE and WINDOW start at 450 m (the Starry Night village). Nearer companion-world architecture is emitted as
 * GROVE, the solid class whose range reaches 200 m, so it keeps its authored depth instead of being clamped onto
 * one 450-458 m plane (behind any GROVE wall in front of it). The Starry Night never uses these helpers.
 */
function nearSolidClass(cls: StrokeClass, d: number): StrokeClass {
  return (cls === StrokeClass.HOUSE || cls === StrokeClass.WINDOW) && d < 458 ? StrokeClass.GROVE : cls;
}

/** Push a stroke after clamping its depth safely inside CLASS_INFO[r.cls].dRange. */
export function pushChapterStroke(sink: StrokeSink, r: StrokeRecord): void {
  r.cls = nearSolidClass(r.cls, r.d);
  const [d0, d1] = CLASS_INFO[r.cls].dRange;
  r.d = clamp(r.d, d0 + 1, d1 - 1);
  sink.push(r);
}

/** Emit a canvas-space stroke (non-solid or CYPRESS/BAND/STAR_CORE/UNDERPAINT) at painting coordinate (uP, v). */
export function emitCanvasStroke(
  sink: StrokeSink,
  aspect: number,
  cls: StrokeClass,
  uP: number,
  v: number,
  d: number,
  L: number,
  ang: number,
  w: number,
  colA: number,
  colB: number,
  rng: Rng,
  opts?: {
    dlnd?: number;
    emissive?: number;
    kappa?: number;
    flags?: number;
    q1?: number;
    q2?: number;
    q3?: number;
  },
): void {
  const effCls = nearSolidClass(cls, d);
  const [d0, d1] = CLASS_INFO[effCls].dRange;
  _rec.u = uFromPaint(uP, aspect);
  _rec.v = v;
  _rec.d = clamp(d, d0 + 2, d1 - 2);
  _rec.cls = effCls;
  _rec.flags = opts?.flags ?? StrokeFlag.NONE;
  _rec.du = L * Math.cos(ang);
  _rec.dv = L * Math.sin(ang);
  _rec.dlnd = opts?.dlnd ?? 0;
  _rec.w = w;
  _rec.colA = packSrgb(colA);
  _rec.colB = packSrgb(colB);
  _rec.emissive = opts?.emissive ?? 0;
  _rec.seed = rng.next();
  _rec.kappa = opts?.kappa ?? rng.range(-0.22, 0.22);
  _rec.q1 = opts?.q1 ?? 0;
  _rec.q2 = opts?.q2 ?? 0;
  _rec.q3 = opts?.q3 ?? 0;
  sink.push(_rec);
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _t = new Vector3();
const _n = new Vector3();

/** Emit a world-space solid stroke centered at world point P (or canvas (uP, v, d)) with tangent angle on surface normal N. */
export function emitSurfaceStroke(
  sink: StrokeSink,
  aspect: number,
  cls: StrokeClass,
  uP: number,
  v: number,
  d: number,
  Lh: number,
  wh: number,
  tangentWorld: Vector3,
  normalWorld: Vector3,
  colA: number,
  colB: number,
  rng: Rng,
  opts?: { emissive?: number; kappa?: number; flags?: number },
): void {
  const effCls = nearSolidClass(cls, d);
  const [d0, d1] = CLASS_INFO[effCls].dRange;
  const dc = clamp(d, d0 + 8, d1 - 8);
  const u = uFromPaint(uP, aspect);
  canvasToWorld(u, v, dc, _c);
  _t.copy(tangentWorld).normalize();
  _n.copy(normalWorld).normalize();
  const Lw = Lh * K_D * dc;
  _a.copy(_c).addScaledVector(_t, -0.5 * Lw);
  _b.copy(_c).addScaledVector(_t, 0.5 * Lw);
  const s = segmentToStroke(_a, _b);
  const dA = s.d * Math.exp(-0.5 * s.dlnd);
  const dB = s.d * Math.exp(0.5 * s.dlnd);
  _rec.cls = effCls;
  _rec.flags = opts?.flags ?? StrokeFlag.NONE;
  _rec.w = wh;
  _rec.colA = packSrgb(colA);
  _rec.colB = packSrgb(colB);
  _rec.emissive = opts?.emissive ?? 0;
  _rec.seed = rng.next();
  _rec.kappa = opts?.kappa ?? rng.range(-0.18, 0.18);
  _rec.q1 = _n.x;
  _rec.q2 = _n.y;
  _rec.q3 = _n.z;
  if (dA < d0 + 1 || dB < d0 + 1 || dA > d1 - 1 || dB > d1 - 1 || !Number.isFinite(s.u + s.v + s.du + s.dv)) {
    _rec.u = u;
    _rec.v = v;
    _rec.d = dc;
    _rec.du = Lh * _t.x;
    _rec.dv = Lh * _t.y;
    _rec.dlnd = 0;
    sink.push(_rec);
    return;
  }
  _rec.u = s.u;
  _rec.v = s.v;
  _rec.d = s.d;
  _rec.du = s.du;
  _rec.dv = s.dv;
  _rec.dlnd = s.dlnd;
  sink.push(_rec);
}

/** Emit a multi-ring star horn at custom painting coordinate (uP, v) using STAR_CORE (12-16 km) + SKY_BAND outer rings. */
export function emitCustomStar(
  sink: StrokeSink,
  aspect: number,
  uP: number,
  v: number,
  dCore: number,
  rhoCore: number,
  rings: number,
  gain: number,
  rng: Rng,
  tintHex: number = PALETTE.lemon,
  gapHex?: number,
): void {
  const cx = uFromPaint(uP, aspect) * CANVAS_ASPECT;
  const cy = v;
  // 1. White-hot radial core spikes in STAR_CORE
  const nSpikes = Math.round(140 * gain);
  for (let j = 0; j < nSpikes; j++) {
    const th = (TAU * (j + rng.next())) / nSpikes;
    const r0 = rhoCore * 0.08 * rng.next();
    const r1 = rhoCore * rng.range(0.55, 1.05);
    const len = r1 - r0;
    const mid = 0.5 * (r0 + r1);
    const t = clamp01((r1 / rhoCore - 0.55) / 0.5);
    const ca = mixHex(PALETTE.zincWhite, tintHex, 0.08 + 0.45 * t);
    const cb = mixHex(PALETTE.zincWhite, PALETTE.chrome, 0.25 * t);
    pushChapterStroke(sink, {
      u: (cx + mid * Math.cos(th)) / CANVAS_ASPECT,
      v: cy + mid * Math.sin(th),
      d: dCore * (0.985 - 0.005 * rng.next()),
      cls: StrokeClass.STAR_CORE,
      flags: StrokeFlag.NONE,
      du: len * Math.cos(th),
      dv: len * Math.sin(th),
      dlnd: 0,
      w: rhoCore * rng.range(0.28, 0.46),
      colA: packSrgb(ca),
      colB: packSrgb(cb),
      emissive: 5.5 * gain,
      seed: rng.next(),
      kappa: rng.range(-0.18, 0.18),
      q1: 0, q2: 0, q3: 0,
    });
  }

  // 2. Concentric halo rings stepping back in depth inside STAR_CORE [11,900..16,000]
  const ringColors = gapHex !== undefined
    ? [PALETTE.lemon, PALETTE.chrome, tintHex, mixHex(tintHex, gapHex, 0.35)]
    : [PALETTE.lemon, PALETTE.chrome, tintHex, PALETTE.blueGreen];
  const gapColorA = gapHex !== undefined
    ? shadeHex(gapHex, 0.92)
    : mixHex(PALETTE.ultramarine, PALETTE.prussian, 0.35);
  const gapColorB = gapHex !== undefined
    ? mixHex(gapHex, tintHex, 0.28)
    : mixHex(PALETTE.cobalt, PALETTE.ultramarine, 0.45);
  const dRho = rhoCore * 0.58;
  for (let k = 0; k < rings; k++) {
    const rho = rhoCore * (1.05 + 0.58 * k);
    const dk = clamp(dCore * (1.01 + 0.038 * k), 11950, 15980);
    const st = clamp01((rings - k) / Math.max(1, rings * 0.45));
    // Dark backing ring just behind the bright band
    const nBack = Math.max(10, Math.round((TAU * rho) / 0.011));
    for (let j = 0; j < nBack; j++) {
      const ang = (TAU * (j + rng.next() * 0.5)) / nBack;
      const rr = rho - 0.28 * dRho;
      const tang = ang + Math.PI * 0.5;
      const L = Math.min(0.65 * rho, (TAU * rr) / nBack * 1.9);
      pushChapterStroke(sink, {
        u: (cx + rr * Math.cos(ang)) / CANVAS_ASPECT,
        v: cy + rr * Math.sin(ang),
        d: Math.min(16050, dk + 35 + 15 * rng.next()),
        cls: StrokeClass.STAR_CORE,
        flags: StrokeFlag.NONE,
        du: L * Math.cos(tang),
        dv: L * Math.sin(tang),
        dlnd: 0,
        w: dRho * 0.72,
        colA: packSrgb(gapColorA),
        colB: packSrgb(gapColorB),
        emissive: 0,
        seed: rng.next(),
        kappa: 0.22,
        q1: 0, q2: 0, q3: 0,
      });
    }
    // Bright pigment band (2 concentric rows)
    const baseCol = ringColors[k % ringColors.length];
    const partnerCol = ringColors[(k + 1) % ringColors.length];
    for (let row = -1; row <= 1; row += 2) {
      const rr = rho + row * 0.14 * dRho;
      const m = Math.max(12, Math.round((TAU * rr) / 0.0085));
      for (let j = 0; j < m; j++) {
        const ang = (TAU * (j + 0.35 * (rng.next() - 0.5))) / m;
        const tang = ang + Math.PI * 0.5;
        const L = Math.min(0.7 * rr, ((TAU * rr) / m) * 2.1);
        const ca = shadeHex(mixHex(baseCol, PALETTE.zincWhite, k === 0 ? 0.35 : 0.1), rng.range(0.9, 1.08));
        const cb = shadeHex(partnerCol, rng.range(0.88, 1.04));
        pushChapterStroke(sink, {
          u: (cx + rr * Math.cos(ang)) / CANVAS_ASPECT,
          v: cy + rr * Math.sin(ang),
          d: dk + rng.range(-12, 12),
          cls: StrokeClass.STAR_CORE,
          flags: StrokeFlag.NONE,
          du: L * Math.cos(tang),
          dv: L * Math.sin(tang),
          dlnd: 0,
          w: dRho * (0.36 + 0.16 * st) * rng.range(0.88, 1.14),
          colA: packSrgb(ca),
          colB: packSrgb(cb),
          emissive: (0.42 + 0.35 * st) * gain,
          seed: rng.next(),
          kappa: rng.range(-0.25, 0.25),
          q1: 0, q2: 0, q3: 0,
        });
      }
    }
  }
}

/** Grid resolution of buildCanvasQuadMesh, and how far behind its authored depths the backing sits. */
const QUAD_GRID = 8;
const QUAD_BACK_SCALE = 1.04;
const QUAD_BACK_METRES = 12;

/**
 * Build a canvas-mapped underlay (architectural or terrain backing) over the quad corners 0 -> 1 -> 2 -> 3.
 *
 * A 2-triangle quad between corners at different depths bows toward E (on screen it is 1/d that interpolates
 * linearly), so it can sit in front of the very strokes it backs. Instead the quad is a QUAD_GRID x QUAD_GRID grid:
 * every vertex lies on its own canvas ray at the bilinear corner depth, pushed back by 4% + 12 m. The footprint
 * seen from E is unchanged, the residual bow between neighbouring vertices is small, and the backing keeps its
 * authored slope off E (a floor stays a floor), unlike pushing every corner to one far depth.
 */
export function buildCanvasQuadMesh(
  aspect: number,
  corners: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]],
  mat: UnderlayMaterialFactory,
  colorHex: number,
  name: string,
): Mesh {
  const [c0, c1, c2, c3] = corners;
  const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
  const n = QUAD_GRID;
  const grid: Vector3[] = [];
  for (let j = 0; j <= n; j++) {
    const t = j / n; // along 0 -> 3 (and 1 -> 2)
    for (let i = 0; i <= n; i++) {
      const s = i / n; // along 0 -> 1 (and 3 -> 2)
      const uP = lerp(lerp(c0[0], c1[0], s), lerp(c3[0], c2[0], s), t);
      const v = lerp(lerp(c0[1], c1[1], s), lerp(c3[1], c2[1], s), t);
      const d = lerp(lerp(c0[2], c1[2], s), lerp(c3[2], c2[2], s), t);
      grid.push(canvasToWorld(uFromPaint(uP, aspect), v, d * QUAD_BACK_SCALE + QUAD_BACK_METRES));
    }
  }
  // Same winding as the original two triangles (0, 1, 2) and (0, 2, 3), cell by cell.
  const pos = new Float32Array(n * n * 18);
  let k = 0;
  const put = (p: Vector3): void => { pos[k++] = p.x; pos[k++] = p.y; pos[k++] = p.z; };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const p00 = grid[j * (n + 1) + i];
      const p10 = grid[j * (n + 1) + i + 1];
      const p11 = grid[(j + 1) * (n + 1) + i + 1];
      const p01 = grid[(j + 1) * (n + 1) + i];
      put(p00); put(p10); put(p11);
      put(p00); put(p11); put(p01);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new Mesh(geo, mat(colorHex));
  mesh.name = name;
  return mesh;
}

export { mixHex, packSrgb, rampHex, shadeHex, EYE, AT };
