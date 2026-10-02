// M7 hills (§2.3, §4.7): three sloped ridge walls (the Alpilles) drawn with contour strokes, crest outlines and an
// underlayer, plus the shared solid-stroke emitter used by every M7 generator (terrain.ts, villageGen.ts).
//
// Wall k is the surface S_k(u, v) = canvasToWorld(u, v, d_k(u, v)) with
//   d_k(u, v) = D_k + 300 sin(2.6u + k) - 900 (ridgeV(u,k) - v) / (ridgeV(u,k) - 0.20)
// for v between the wall foot (where S_k meets the ground, ~0.19-0.21) and the crest ridgeV(u, k).
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import {
  AT, CANVAS_ASPECT, CLASS_INFO, HILL_WALL_D, PALETTE, SKY_GEN_U, StrokeClass, StrokeFlag, T_HALF, type Rng, type StrokeSink,
} from '../contracts';
import { canvasToWorld, EYE, segmentToStroke } from '../shared/canvasSpace';
import { ridgeV } from '../shared/flowField';
import { mixHex, packSrgb } from '../shared/palette';

// ------------------------------------------------------------------ shared solid-stroke emitter

export interface SolidStrokeParams {
  /** Canvas width (h-units) the stroke should have when seen face-on from E. */
  w: number;
  colA: number;
  colB: number;
  seed: number;
  kappa?: number;
  flags?: number;
  emissive?: number;
  /**
   * Faces seen obliquely from E (ground, hill walls, roofs) foreshorten the ribbon width. The emitter widens the
   * world ribbon so the canvas width from E stays `w`, by at most this factor (1 disables the compensation).
   */
  maxComp?: number;
}

/** Per-class generator statistics of the last run (read by harness/land.ts). */
export const LAND_STATS: Record<string, { emitted: number; rejected: number; dMin: number; dMax: number }> = {};

const _t = new Vector3();
const _bv = new Vector3();
const _pa = [0, 0];
const _pb = [0, 0];
const CP = Math.cos((10 * Math.PI) / 180);
const SP = Math.sin((10 * Math.PI) / 180);
/** worldToCanvas without allocation, in flow-space h-units: out = (u * A, v). */
function project(p: Vector3, out: number[]): void {
  const x = p.x - EYE.x;
  const y = p.y - EYE.y;
  const z = p.z - EYE.z;
  const d = SP * y - CP * z;
  out[0] = CANVAS_ASPECT * (0.5 + x / (2 * AT * d));
  out[1] = 0.5 + (CP * y + SP * z) / (2 * T_HALF * d);
}
const _m = new Vector3();
const _q = new Vector3();

/**
 * Turns world segments lying on a solid face into StrokeRecords (segmentToStroke, so canvasToWorld reproduces the
 * endpoints exactly from E). The face normal goes to q1..q3. Strokes with an endpoint outside
 * CLASS_INFO[cls].dRange are dropped and counted, so every emitted record honours the paint-order table.
 */
export class SolidEmitter {
  readonly lo: number;
  readonly hi: number;
  emitted = 0;
  rejected = 0;
  dMin = Infinity;
  dMax = -Infinity;
  constructor(private readonly sink: StrokeSink, readonly cls: StrokeClass) {
    [this.lo, this.hi] = CLASS_INFO[cls].dRange;
  }

  emit(a: Vector3, b: Vector3, n: Vector3, p: SolidStrokeParams): boolean {
    const s = segmentToStroke(a, b);
    const dA = s.d * Math.exp(-0.5 * s.dlnd);
    const dB = s.d * Math.exp(0.5 * s.dlnd);
    if (!(dA >= this.lo && dB >= this.lo && dA <= this.hi && dB <= this.hi) || !Number.isFinite(s.u + s.v + s.du + s.dv)) {
      this.rejected++;
      return false;
    }
    const comp = (p.maxComp ?? 1) > 1 ? widthCompensation(a, b, n, s.d, p.maxComp!) : 1;
    const nl = n.length() || 1;
    this.sink.push({
      u: s.u, v: s.v, d: s.d, cls: this.cls, flags: p.flags ?? StrokeFlag.NONE,
      du: s.du, dv: s.dv, dlnd: s.dlnd, w: p.w * comp,
      colA: packSrgb(p.colA), colB: packSrgb(p.colB), emissive: p.emissive ?? 0, seed: p.seed,
      kappa: p.kappa ?? 0, q1: n.x / nl, q2: n.y / nl, q3: n.z / nl,
    });
    this.emitted++;
    this.dMin = Math.min(this.dMin, dA, dB);
    this.dMax = Math.max(this.dMax, dA, dB);
    return true;
  }

  /** Record this run's statistics; warn if anything was dropped by the dRange guard. */
  finish(): void {
    const name = StrokeClass[this.cls];
    LAND_STATS[name] = { emitted: this.emitted, rejected: this.rejected, dMin: this.dMin, dMax: this.dMax };
    if (this.rejected > 0) console.warn(`[M7] ${name}: ${this.rejected} stroke(s) outside dRange [${this.lo}, ${this.hi}] dropped`);
  }
}

/**
 * Factor by which the world ribbon must widen so that, seen from E, its canvas width equals the face-on width.
 * The ribbon lies in the face (M3: B = normalize(cross(N, T))); only faces turned toward E are compensated.
 */
export function widthCompensation(a: Vector3, b: Vector3, n: Vector3, d: number, maxComp: number): number {
  _t.subVectors(b, a);
  const len = _t.length();
  if (len < 1e-9) return 1;
  _t.divideScalar(len);
  _bv.crossVectors(n, _t);
  const bl = _bv.length();
  if (bl < 1e-6) return 1;
  _bv.divideScalar(bl);
  _m.addVectors(a, b).multiplyScalar(0.5);
  _q.subVectors(EYE, _m);
  if (_q.dot(n) <= 0) return 1;
  project(a, _pa);
  project(b, _pb);
  let tx = _pb[0] - _pa[0];
  let ty = _pb[1] - _pa[1];
  const tl = Math.hypot(tx, ty);
  if (tl < 1e-12) return 1;
  tx /= tl;
  ty /= tl;
  const eps = 1e-3 * d;
  _q.copy(_m).addScaledVector(_bv, -0.5 * eps);
  project(_q, _pa);
  _q.copy(_m).addScaledVector(_bv, 0.5 * eps);
  project(_q, _pb);
  const gx = (_pb[0] - _pa[0]) / eps;
  const gy = (_pb[1] - _pa[1]) / eps;
  const perp = Math.abs(gx * ty - gy * tx); // canvas h-units per metre of ribbon width
  const ref = 1 / (2 * T_HALF * d); // face-on value
  if (perp < 1e-12) return maxComp;
  return Math.max(0.7, Math.min(maxComp, ref / perp));
}

// ------------------------------------------------------------------ wall geometry

export const HILL_COUNT = 3;
/** The wall law's reference foot row (§2.3). */
export const HILL_V0 = 0.2;

/** Depth d_k(u, v) of wall k (metres from E along the eye axis). Valid for v <= ridgeV(u, k); linear below 0.20. */
export function hillDepth(u: number, v: number, k: number): number {
  const r = ridgeV(u, k);
  return HILL_WALL_D[k] + 300 * Math.sin(2.6 * u + k) - (900 * (r - v)) / (r - HILL_V0);
}

/** World point of wall k at canvas (u, v), optionally pushed back along the eye ray by `scale`. */
export function hillPoint(u: number, v: number, k: number, scale = 1, out = new Vector3()): Vector3 {
  return canvasToWorld(u, v, hillDepth(u, v, k) * scale, out);
}

// Eye-ray height per metre of depth is linear in v (independent of u): dirY(v) = C1 v + C0.
const C1 = 2 * T_HALF * Math.cos((10 * Math.PI) / 180);
const C0 = Math.sin((10 * Math.PI) / 180) - T_HALF * Math.cos((10 * Math.PI) / 180);
/**
 * Canvas row where wall k reaches world height y (the foot for y = 0), clamped to [0.16, ridgeV]. Closed form:
 * the wall depth is linear in v, so the height E.y + d(v) dirY(v) is quadratic in v; take the rising root.
 */
export function solveHillRow(u: number, k: number, y: number): number {
  const r = ridgeV(u, k);
  const B0 = 900 / (r - HILL_V0);
  const A0 = HILL_WALL_D[k] + 300 * Math.sin(2.6 * u + k) - B0 * r;
  const a = B0 * C1;
  const b = A0 * C1 + B0 * C0;
  const c = A0 * C0 + EYE.y - y;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0.16;
  const v = (-b + Math.sqrt(disc)) / (2 * a);
  return Math.max(0.16, Math.min(r, v));
}

const FOOT_U0 = -1.42;
const FOOT_DU = 0.004;
const FOOT_N = 961; // to u = 2.42
let footTab: Float64Array[] | null = null;
/** Canvas row where wall k meets the plain (y = 0), table-interpolated. */
export function hillFootV(u: number, k: number): number {
  if (!footTab) {
    footTab = [0, 1, 2].map((kk) => {
      const t = new Float64Array(FOOT_N);
      for (let i = 0; i < FOOT_N; i++) t[i] = solveHillRow(FOOT_U0 + i * FOOT_DU, kk, 0);
      return t;
    });
  }
  const x = Math.max(0, Math.min(FOOT_N - 1.000001, (u - FOOT_U0) / FOOT_DU));
  const i = Math.floor(x);
  const f = x - i;
  const t = footTab[k];
  return t[i] + (t[i + 1] - t[i]) * f;
}

/** Highest crest in front of wall k at column u (walls with smaller k are nearer to E). */
export function ridgeInFront(u: number, k: number): number {
  let m = -Infinity;
  for (let j = 0; j < k; j++) m = Math.max(m, ridgeV(u, j));
  return m;
}

/**
 * Column ranges of the walls. HILL_U_CANVAS: the generated canvas, full stroke density. HILL_U_FULL (= SKY_GEN_U):
 * full-height walls with sparser, larger strokes, so wide-FOV shots near E see the range all the way across.
 * HILL_U_EXT: beyond HILL_U_FULL the crest sinks to the plain and the underlay dissolves (the walls end in the void,
 * where the extended sky dissolves too).
 */
export const HILL_U_CANVAS: readonly [number, number] = [-0.3, 1.3];
export const HILL_U_FULL: readonly [number, number] = [SKY_GEN_U[0], SKY_GEN_U[1]];
export const HILL_U_EXT: readonly [number, number] = [SKY_GEN_U[0] - 0.3, SKY_GEN_U[1] + 0.3];
function sstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
export function hillTaper(u: number): number {
  if (u < HILL_U_FULL[0]) return sstep(HILL_U_EXT[0], HILL_U_FULL[0], u);
  if (u > HILL_U_FULL[1]) return sstep(HILL_U_EXT[1], HILL_U_FULL[1], u);
  return 1;
}
/** Top row of wall k: the crest ridgeV(u, k) across HILL_U_FULL, sinking to the foot beyond it. */
export function hillTopV(u: number, k: number): number {
  const r = ridgeV(u, k);
  const t = hillTaper(u);
  if (t >= 1) return r;
  const f = hillFootV(u, k);
  return f + (r - f) * t;
}

const _su = new Vector3();
const _sv = new Vector3();
const _dir = new Vector3();
const TAU = 2 * Math.PI;
/**
 * Unit face normal of wall k at (u, v), turned toward E. Analytic: S = E + D(u,v) dir(u,v) with dir linear in (u, v),
 * so S_u = D_u dir + D dir_u and S_v = D_v dir + D dir_v.
 */
export function hillNormal(u: number, v: number, k: number, out = new Vector3()): Vector3 {
  const a1 = TAU * (1.6 * u + 0.15 + 0.21 * k);
  const a2 = TAU * (4.7 * u + 0.4 - 0.3 * k);
  const r = 0.3 + 0.03 * k + 0.028 * Math.sin(a1) + 0.011 * Math.sin(a2);
  const rp = 0.028 * TAU * 1.6 * Math.cos(a1) + 0.011 * TAU * 4.7 * Math.cos(a2);
  const den = r - HILL_V0;
  const D = HILL_WALL_D[k] + 300 * Math.sin(2.6 * u + k) - (900 * (r - v)) / den;
  const Du = 780 * Math.cos(2.6 * u + k) - (900 * rp * (v - HILL_V0)) / (den * den);
  const Dv = 900 / den;
  canvasToWorld(u, v, 1, _dir).sub(EYE); // dir(u, v)
  const cp = Math.cos((10 * Math.PI) / 180);
  const sp = Math.sin((10 * Math.PI) / 180);
  _su.copy(_dir).multiplyScalar(Du);
  _su.x += D * 2 * CANVAS_ASPECT * T_HALF;
  _sv.copy(_dir).multiplyScalar(Dv);
  _sv.y += D * 2 * T_HALF * cp;
  _sv.z += D * 2 * T_HALF * sp;
  out.crossVectors(_su, _sv).normalize();
  // dir points from E to the surface: the face looks at E when n . dir < 0.
  if (out.dot(_dir) > 0) out.negate();
  return out;
}

// ------------------------------------------------------------------ strokes

const P = PALETTE;
/**
 * Contour strokes on the wall faces, crest outline strokes and underlayer fill (§4.7: 15,000 + 1,500; HILL budget
 * 16,500). With the walls extended across HILL_U_FULL, 180 underlayer strokes moved to the crest so the outline density
 * seen from E stays where it was (the hill underlay mesh closes the holes the underlayer strokes used to).
 */
export const HILL_COUNTS = { contour: 13800, crest: 1380, underlayer: 1320 } as const;
/**
 * Hidden-from-E parts of the rear walls (behind a nearer crest) keep this fraction of the stroke density. Lowered from
 * 0.35 to 0.2 to pay for the walls beyond the canvas columns: the visible-from-E density inside them is unchanged.
 */
const HIDDEN_KEEP = 0.2;
const HILL_D_MIN = CLASS_INFO[StrokeClass.HILL].dRange[0] + 80;
const H_MAX = 0.21;

const _a = new Vector3();
const _b = new Vector3();
const _n = new Vector3();

function contourLevelV(u: number, k: number, s: number): number {
  const f = hillFootV(u, k);
  return f + s * (hillTopV(u, k) - f);
}

/**
 * Beyond the canvas columns (seen only in wide shots near E and off-axis) the walls keep EXT_KEEP of the stroke density
 * with strokes EXT_SIZE larger (about 0.5 of the canvas coverage), ramped in over EXT_RAMP columns so no seam shows.
 */
const EXT_KEEP = 0.15;
const EXT_SIZE = 1.75;
const EXT_RAMP = 0.15;
/** 0 inside the canvas columns, 1 from EXT_RAMP beyond them. */
function extT(u: number): number {
  return sstep(0, EXT_RAMP, Math.max(HILL_U_CANVAS[0] - u, u - HILL_U_CANVAS[1], 0));
}
const keepAt = (u: number) => 1 + (EXT_KEEP - 1) * extT(u);
const sizeAt = (u: number) => 1 + (EXT_SIZE - 1) * extT(u);

/** Samples a wall point with uniform canvas density (hidden parts thinned). Returns null when rejected. */
function sampleWall(rng: Rng, sMax: number): { u: number; v: number; k: number; s: number; vis: boolean } | null {
  const k = rng.int(HILL_COUNT);
  const u = rng.range(HILL_U_EXT[0], HILL_U_EXT[1]);
  const keep = keepAt(u);
  if (keep < 1 && rng.next() > keep) return null;
  const f = hillFootV(u, k);
  const h = hillTopV(u, k) - f;
  if (h <= 0.002 || rng.next() > h / H_MAX) return null;
  const s = rng.next() * sMax;
  const v = f + s * h;
  // The tapered wall ends (k = 0 near u = -0.6) dip under the HILL dRange: keep a margin.
  if (hillDepth(u, v, k) < HILL_D_MIN) return null;
  const vis = v > ridgeInFront(u, k);
  if (!vis && rng.next() > HIDDEN_KEEP) return null;
  return { u, v, k, s, vis };
}

/** Canvas tangent (h-units, unit) of the contour through (u, level s) on wall k. */
function contourTangent(u: number, k: number, s: number): [number, number] {
  const e = 0.002;
  const dv = contourLevelV(u + e, k, s) - contourLevelV(u - e, k, s);
  const tx = 2 * e * CANVAS_ASPECT;
  const l = Math.hypot(tx, dv);
  return [tx / l, dv / l];
}

/** World endpoints of a canvas stroke on wall k centred at (u, v) with canvas direction t and length L. */
function wallSegment(u: number, v: number, k: number, tx: number, ty: number, L: number, scale: number, dOffset = 0): void {
  const ua = u - (0.5 * L * tx) / CANVAS_ASPECT;
  const va = v - 0.5 * L * ty;
  const ub = u + (0.5 * L * tx) / CANVAS_ASPECT;
  const vb = v + 0.5 * L * ty;
  canvasToWorld(ua, va, hillDepth(ua, va, k) * scale + dOffset, _a);
  canvasToWorld(ub, vb, hillDepth(ub, vb, k) * scale + dOffset, _b);
}

const [HILL_LO, HILL_HI] = CLASS_INFO[StrokeClass.HILL].dRange;
/** Both endpoints of the last wallSegment inside the HILL dRange (forward depth from E), so the emitter never drops one. */
function segmentFits(): boolean {
  const da = SP * (_a.y - EYE.y) - CP * (_a.z - EYE.z);
  const db = SP * (_b.y - EYE.y) - CP * (_b.z - EYE.z);
  return da >= HILL_LO && db >= HILL_LO && da <= HILL_HI && db <= HILL_HI;
}

/** Wall tints: the rear walls drift toward cerulean so the three layers separate. */
const tint = (hex: number, k: number) => mixHex(hex, P.cerulean, 0.1 * k);

export type Pair = [number, number];
/** Precomputed colour pairs (mixHex per stroke costs ~10 pow calls; the swatches keep generation cheap). */
export function swatches(n: number, fn: () => Pair): Pair[] {
  return Array.from({ length: n }, fn);
}

export function generateHills(sink: StrokeSink, rng: Rng): void {
  const em = new SolidEmitter(sink, StrokeClass.HILL);
  const SW = [0, 1, 2].map((k) => {
    const t = (a: number, b: number): Pair => [tint(a, k), tint(b, k)];
    return {
      top: swatches(10, () => t(mixHex(P.cobalt, P.ultramarine, rng.range(0, 0.4)), mixHex(P.cerulean, P.cobalt, rng.range(0.25, 0.7)))),
      dark: swatches(6, () => t(P.outline, mixHex(P.ultramarine, P.outline, rng.range(0, 0.5)))),
      body: swatches(10, () => t(P.ultramarine, mixHex(P.ultramarine, P.cobalt, rng.range(0.25, 0.75)))),
      body2: swatches(10, () => t(mixHex(P.ultramarine, P.cobalt, rng.range(0.2, 0.6)), mixHex(P.ultramarine, P.outline, rng.range(0, 0.35)))),
      crest: swatches(6, () => [P.outline, mixHex(P.outline, P.ultramarine, rng.range(0.2, 0.5))]),
      under: [t(mixHex(P.ultramarine, P.outline, 0.5), P.outline)],
    };
  });

  // Contour strokes: parallel to the crest near the top, flattening toward the foot.
  let guard = 0;
  let n = 0;
  while (n < HILL_COUNTS.contour && guard++ < 400000) {
    const p = sampleWall(rng, 0.985);
    if (!p) continue;
    const [tx0, ty0] = contourTangent(p.u, p.k, p.s);
    const jit = rng.normal() * 0.07;
    const c = Math.cos(jit);
    const sn = Math.sin(jit);
    const tx = tx0 * c - ty0 * sn;
    const ty = tx0 * sn + ty0 * c;
    const sz = sizeAt(p.u);
    const L = rng.range(0.02, 0.045) * sz;
    wallSegment(p.u, p.v, p.k, tx, ty, L, 1 + rng.range(-0.003, 0.0012));
    if (!segmentFits()) continue;
    hillNormal(p.u, p.v, p.k, _n);
    // Colour: ultramarine/cobalt body, cerulean on the upper third, dark shading strokes low on the wall.
    const r = rng.next();
    const sw = SW[p.k];
    const [ca, cb] = rng.pick(p.s > 0.66 && r < 0.4 ? sw.top : p.s < 0.55 && r < 0.18 ? sw.dark : r < 0.62 ? sw.body : sw.body2);
    if (em.emit(_a, _b, _n, {
      w: rng.range(0.0042, 0.0068) * sz, colA: ca, colB: cb, seed: rng.next(), kappa: rng.range(-0.12, 0.12), maxComp: 4,
    })) n++;
  }

  // Crest outline: dark strokes straddling the crest with +-150 m depth thickness along the eye rays.
  guard = 0;
  n = 0;
  while (n < HILL_COUNTS.crest && guard++ < 100000) {
    const k = rng.int(HILL_COUNT);
    const u = rng.range(HILL_U_EXT[0], HILL_U_EXT[1]);
    const keep = keepAt(u);
    if (keep < 1 && rng.next() > keep) continue;
    const r = hillTopV(u, k);
    if (r - hillFootV(u, k) < 0.004 || hillDepth(u, r, k) < HILL_D_MIN + 150) continue;
    if (r <= ridgeInFront(u, k) + 0.001 && rng.next() > HIDDEN_KEEP) continue;
    const e = 0.002;
    let tx = 2 * e * CANVAS_ASPECT;
    let ty = hillTopV(u + e, k) - hillTopV(u - e, k);
    const tl = Math.hypot(tx, ty);
    tx /= tl;
    ty /= tl;
    // Centred a little below the crest so most of the dark ribbon lies on the wall (the sky behind is dark too).
    const sz = sizeAt(u);
    const v = r - 0.0024 * sz;
    const L = rng.range(0.022, 0.04) * sz;
    // Keep both endpoints on the wall (below their own crest).
    const ua = u - (0.5 * L * tx) / CANVAS_ASPECT;
    const ub = u + (0.5 * L * tx) / CANVAS_ASPECT;
    const sag = Math.max(v - 0.5 * L * ty - hillTopV(ua, k), v + 0.5 * L * ty - hillTopV(ub, k), 0);
    wallSegment(u, v - sag, k, tx, ty, L, 1, rng.range(-150, 150));
    if (!segmentFits()) continue;
    hillNormal(u, v - sag, k, _n);
    const [ca, cb] = rng.pick(SW[k].crest);
    if (em.emit(_a, _b, _n, {
      w: rng.range(0.0045, 0.007) * sz, colA: ca, colB: cb, seed: rng.next(), kappa: rng.range(-0.06, 0.06), flags: StrokeFlag.OUTLINE, maxComp: 3,
    })) n++;
  }

  // Underlayer: long flat dark strokes just behind the contours (closes holes when seen off-axis).
  guard = 0;
  n = 0;
  while (n < HILL_COUNTS.underlayer && guard++ < 100000) {
    const p = sampleWall(rng, 0.97);
    if (!p) continue;
    const [tx, ty] = contourTangent(p.u, p.k, p.s);
    const sz = sizeAt(p.u);
    wallSegment(p.u, p.v, p.k, tx, ty, rng.range(0.04, 0.07) * sz, 1.0025);
    if (!segmentFits()) continue;
    hillNormal(p.u, p.v, p.k, _n);
    const [ca, cb] = SW[p.k].under[0];
    if (em.emit(_a, _b, _n, { w: rng.range(0.006, 0.009) * sz, colA: ca, colB: cb, seed: rng.next(), flags: StrokeFlag.UNDERLAYER, maxComp: 3 })) n++;
  }
  em.finish();
}

// ------------------------------------------------------------------ dissolve noise (shared with the ground underlay)

function hash2(i: number, j: number): number {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 2D value noise in [-1, 1] (deterministic, integer lattice). */
export function valueNoise2(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j);
  const b = hash2(i + 1, j);
  const c = hash2(i, j + 1);
  const d = hash2(i + 1, j + 1);
  return 2 * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) - 1;
}

/** Paint-streak noise (about [-1, 1]) on the ground plane: long along x like the field swathes, short along z. */
export function streakNoise(x: number, z: number): number {
  return 0.6 * valueNoise2(x / 1900, z / 420) + 0.4 * valueNoise2(x / 800 + 17.3, z / 250 - 4.1);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * aFade of the hill underlay front face at column u: 1 across HILL_U_FULL (every column a wide shot near E can see),
 * dissolving in streaks through the taper zone where the crest sinks into the plain.
 */
export function hillEndFade(u: number, x: number, z: number): number {
  const t = hillTaper(u);
  if (t >= 1) return 1;
  return clamp01((t - 0.12) / 0.6 + 0.22 * streakNoise(x, z));
}

// ------------------------------------------------------------------ underlay geometry (hill wall faces + backs)

/** Underlay surfaces sit this far behind the stroke surface along the eye rays (strokes jitter to at most +0.25 %). */
export const HILL_UNDERLAY_SCALE = 1.004;

/** Underlay columns: 0.005 apart over the canvas columns (+ margin), 0.008 beyond. */
function underlayColumns(): number[] {
  const us: number[] = [];
  const c0 = HILL_U_CANVAS[0] - 0.05;
  const c1 = HILL_U_CANVAS[1] + 0.05;
  const push = (a: number, b: number, step: number) => {
    const n = Math.max(1, Math.ceil((b - a) / step));
    for (let i = 0; i < n; i++) us.push(a + ((b - a) * i) / n);
  };
  push(HILL_U_EXT[0] - 0.01, c0, 0.008);
  push(c0, c1, 0.005);
  push(c1, HILL_U_EXT[1] + 0.01, 0.008);
  us.push(HILL_U_EXT[1] + 0.01);
  return us;
}

/**
 * One indexed geometry for the three walls: the front face (foot slightly below ground to crest, pushed back by
 * HILL_UNDERLAY_SCALE) folding over the crest into a rounded back slope that descends below the plain.
 * Winding: outward (front toward E, back away from E).
 * aFade (UnderlayOptions.vertexFade): the front face is opaque across HILL_U_FULL and dissolves where the walls sink
 * into the plain beyond it; the back slope (only seen from behind / above) stays solid near the crest and melts in
 * streaks toward its foot, so from altitude the ridges do not read as dark slabs.
 */
export function buildHillUnderlayGeometry(): BufferGeometry {
  const us = underlayColumns();
  const NU = us.length - 1;
  const NF = 10; // front rows (NF + 1 vertex rows; the face is quadratic in v, chord error < 0.3 m)
  const NB = 7; // back rows
  const rows = NF + 1 + NB;
  const pos: number[] = [];
  const fade: number[] = [];
  const idx: number[] = [];
  const C = new Vector3();
  const h = new Vector3();
  for (let k = 0; k < HILL_COUNT; k++) {
    const base = pos.length / 3;
    for (let i = 0; i <= NU; i++) {
      const u = us[i];
      const r = hillTopV(u, k);
      const f = solveHillRow(u, k, -8);
      for (let j = 0; j <= NF; j++) {
        hillPoint(u, f + ((r - f) * j) / NF, k, HILL_UNDERLAY_SCALE, C);
        pos.push(C.x, C.y, C.z);
        fade.push(hillEndFade(u, C.x, C.z));
      }
      hillPoint(u, r, k, HILL_UNDERLAY_SCALE, C);
      const front = hillEndFade(u, C.x, C.z);
      h.set(C.x - EYE.x, 0, C.z - EYE.z).normalize();
      const H = C.y + 8;
      const run = 1.5 * H;
      for (let j = 1; j <= NB; j++) {
        const t = j / NB;
        const x = C.x + h.x * run * t;
        const z = C.z + h.z * run * t;
        pos.push(x, C.y + H * (Math.cos(0.5 * Math.PI * t) - 1), z);
        // Solid over the shoulder, gone by the foot of the back slope (the ground underlay or the void shows there).
        const n = streakNoise(x + 9100 * k, z);
        fade.push(front * clamp01(1 - (t - 0.3 + 0.3 * n) / 0.55));
      }
    }
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < rows - 1; j++) {
        const a = base + i * rows + j;
        const b = base + (i + 1) * rows + j;
        if (fade[a] + fade[b] + fade[a + 1] + fade[b + 1] <= 0) continue; // fully dissolved quad
        // (u, v) -> (u+1, v) -> (u, v+1): counter-clockwise seen from E on the front face.
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aFade', new BufferAttribute(new Float32Array(fade), 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
