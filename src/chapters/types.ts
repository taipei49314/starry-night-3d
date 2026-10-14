// Multi-Punctum Chapter types and coordinate/stroke helpers for the Provençal Van Gogh Suite.
import { BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three';
import {
  AT, CANVAS_ASPECT, CLASS_INFO, PALETTE, StrokeClass, StrokeFlag, T_HALF,
  type Rng, type StrokeRecord, type StrokeSink, type UnderlayMaterialFactory,
} from '../contracts';
import { canvasToWorld, EYE, segmentToStroke } from '../shared/canvasSpace';
import { mixHex, packSrgb, rampHex, shadeHex } from '../shared/palette';

export type PaintingId =
  | 'cafe'
  | 'rhone'
  | 'bedroom'
  | 'starry'
  | 'wheat'
  | 'almond'
  | 'church'
  | 'crows';

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

/** Push a stroke after clamping its depth safely inside CLASS_INFO[r.cls].dRange. */
export function pushChapterStroke(sink: StrokeSink, r: StrokeRecord): void {
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
  const [d0, d1] = CLASS_INFO[cls].dRange;
  const dc = clamp(d, d0 + 2, d1 - 2);
  sink.push({
    u: uFromPaint(uP, aspect),
    v,
    d: dc,
    cls,
    flags: opts?.flags ?? StrokeFlag.NONE,
    du: L * Math.cos(ang),
    dv: L * Math.sin(ang),
    dlnd: opts?.dlnd ?? 0,
    w,
    colA: packSrgb(colA),
    colB: packSrgb(colB),
    emissive: opts?.emissive ?? 0,
    seed: rng.next(),
    kappa: opts?.kappa ?? rng.range(-0.22, 0.22),
    q1: opts?.q1 ?? 0,
    q2: opts?.q2 ?? 0,
    q3: opts?.q3 ?? 0,
  });
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
  const [d0, d1] = CLASS_INFO[cls].dRange;
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
  if (dA < d0 + 1 || dB < d0 + 1 || dA > d1 - 1 || dB > d1 - 1 || !Number.isFinite(s.u + s.v + s.du + s.dv)) {
    // Fallback to safe in-plane canvas stroke with surface normal
    sink.push({
      u, v, d: dc, cls, flags: opts?.flags ?? StrokeFlag.NONE,
      du: Lh * _t.x, dv: Lh * _t.y, dlnd: 0, w: wh,
      colA: packSrgb(colA), colB: packSrgb(colB), emissive: opts?.emissive ?? 0, seed: rng.next(),
      kappa: opts?.kappa ?? rng.range(-0.18, 0.18), q1: _n.x, q2: _n.y, q3: _n.z,
    });
    return;
  }
  sink.push({
    u: s.u, v: s.v, d: s.d, cls, flags: opts?.flags ?? StrokeFlag.NONE,
    du: s.du, dv: s.dv, dlnd: s.dlnd, w: wh,
    colA: packSrgb(colA), colB: packSrgb(colB), emissive: opts?.emissive ?? 0, seed: rng.next(),
    kappa: opts?.kappa ?? rng.range(-0.18, 0.18), q1: _n.x, q2: _n.y, q3: _n.z,
  });
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
  const ringColors = [PALETTE.lemon, PALETTE.chrome, tintHex, PALETTE.blueGreen];
  const gapColorA = mixHex(PALETTE.ultramarine, PALETTE.prussian, 0.35);
  const gapColorB = mixHex(PALETTE.cobalt, PALETTE.ultramarine, 0.45);
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

/** Build a simple canvas-mapped quad underlay mesh (two triangles) for architectural or terrain backing. */
export function buildCanvasQuadMesh(
  aspect: number,
  corners: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]],
  mat: UnderlayMaterialFactory,
  colorHex: number,
  name: string,
): Mesh {
  const pts = corners.map(([uP, v, d]) => canvasToWorld(uFromPaint(uP, aspect), v, d));
  const pos = new Float32Array([
    pts[0].x, pts[0].y, pts[0].z,
    pts[1].x, pts[1].y, pts[1].z,
    pts[2].x, pts[2].y, pts[2].z,
    pts[0].x, pts[0].y, pts[0].z,
    pts[2].x, pts[2].y, pts[2].z,
    pts[3].x, pts[3].y, pts[3].z,
  ]);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new Mesh(geo, mat(colorHex));
  mesh.name = name;
  return mesh;
}

export { mixHex, packSrgb, rampHex, shadeHex, EYE, AT };
