// M5: the 11 stars and Venus (§2.4, §4.5).
//  STAR_CORE: a small white-hot core of radial spikes from each star centre out to LOOK[i].core * rho_core, at
//             d_core*(0.99 - 0.0065*hash) so every core sits in front of its ring 0 and inside CLASS_INFO dRange.
//  STAR_RING: tangent dashes on the ring horn (RING anim). Ring k of star i is the canvas circle of radius
//             rho_k = rho_core (1 + 0.62 k) at depth d_k = d_core (1 + 0.12 k) (ringGeom), so every ring axis is
//             exactly the ray from E. The shader applies the spin; records only carry the t = 0 placement.
//             Two layers per ring (both on ring k, so both spin with it):
//               bright band  chrome / lemon / blue-green by k mod 3, ~55 % of the ring spacing wide, d = d_k (0.993..0.999)
//               dark backing one wide dark-ultramarine row on the INNER side of ring k (q3 < 0), just behind its band
//                            (d_k (1.012..1.024)): it fills the gap between ring k-1 and ring k and sits behind both
//                            bands (d_k-1 < d_k), so it can be wide enough to close the gap (the shader tapers each
//                            stroke's width along its length) without hiding any band. Ring 0's backing fills the gap
//                            between the core and ring 0. The gaps read as dark paint, not as the sky behind.
//                            The backing is thinned with the bands at lower tiers (not UNDERLAYER-flagged: an
//                            always-drawn backing would outweigh the thinned bands and turn the stars into dark discs).
//             Emissives stay low (the bands sit below the bloom threshold), so the rings keep their pigment through
//             Neutral tone mapping instead of washing out to cream; only the cores bloom.
import {
  CANVAS_ASPECT, CLASS_INFO, PALETTE, STARS, StrokeClass, StrokeFlag,
  type Rng, type StrokeRecord, type StrokeSink,
} from '../contracts';
import { ringGeom } from '../shared/flowField';
import { mixHex, packSrgb, shadeHex } from '../shared/palette';

const TAU = Math.PI * 2;

/** Stroke budgets at High (§4.5): cores 400 + 10 x 180 = 2,200; rings 3,000 + 10 x 1,100 = 14,000 (bands + backing). */
export const STAR_CORE_STROKES = { venus: 400, other: 180 } as const;
export const STAR_RING_STROKES = { venus: 3000, other: 1100 } as const;

/** Record depth / d_k of the two ring layers (the M3 RING shader honours a record jitter within +-3 %). */
export const RING_BAND_DEPTH: readonly [number, number] = [0.993, 0.999];
export const RING_BACK_DEPTH: readonly [number, number] = [1.012, 1.024];

/** Push after asserting the class depth range (§2.2). Throws: generation is analytic, so a miss is a bug. */
export function pushChecked(sink: StrokeSink, r: StrokeRecord): void {
  const [d0, d1] = CLASS_INFO[r.cls].dRange;
  if (!(r.d >= d0 && r.d <= d1)) {
    throw new Error(`${StrokeClass[r.cls]} stroke depth ${r.d.toFixed(1)} m outside dRange [${d0}, ${d1}]`);
  }
  sink.push(r);
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

// Colour helpers memoised on a 1/64 grid of the mix / shade factor: the per-stroke pow() calls of mixHex / shadeHex
// otherwise dominate generation time (budget 25 ms for stars + moon).
const mixMemo = new Map<number, Int32Array>();
const shadeMemo = new Map<number, Int32Array>();
function slot(m: Map<number, Int32Array>, key: number, n: number): Int32Array {
  let arr = m.get(key);
  if (!arr) m.set(key, (arr = new Int32Array(n).fill(-1)));
  return arr;
}
/** mixHex(a, b, t) with t quantised to 1/64. */
export function mixQ(a: number, b: number, t: number): number {
  const q = Math.round(clamp(t, 0, 1) * 64);
  const arr = slot(mixMemo, a * 16777216 + b, 65);
  if (arr[q] < 0) arr[q] = mixHex(a, b, q / 64);
  return arr[q];
}
/** shadeHex(hex, k) with k in [0, 4) quantised to 1/64. */
export function shadeQ(hex: number, k: number): number {
  const q = Math.round(clamp(k, 0, 3.98) * 64);
  const arr = slot(shadeMemo, hex, 256);
  if (arr[q] < 0) arr[q] = shadeHex(hex, q / 64);
  return arr[q];
}

/** Split `total` over weights with the largest-remainder rule (sums exactly to total). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (sum > 0 ? (total * w) / sum : 0));
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).filter((o) => weights[o[1]] > 0).sort((a, b) => b[0] - a[0]);
  for (let i = 0; left > 0 && order.length; i = (i + 1) % order.length, left--) out[order[i][1]]++;
  return out;
}

/** One layer of a halo (star horn or moon bell): per-ring stroke counts and look. Lengths and widths in h-units. */
export interface HaloLayer {
  /** Strokes on ring k (0 = ring skipped in this layer). */
  counts: readonly number[];
  /** Rows per ring: 3 radial rows (bands) or 1 (backing). */
  rows: 1 | 3;
  /** Stroke width on ring k (radius rho, ring spacing dRho). */
  width(k: number, rho: number, dRho: number): number;
  /**
   * Radial offset of the rows (h-units); the record carries it as q3 = off / (0.04 rho), |q3| <= 1. Three rows sit at
   * -|off|, 0, +|off|; a single row sits at the signed offset (negative = inner side of the ring).
   */
  rowOff(k: number, rho: number, dRho: number): number;
  /** Dash length from the along-row spacing and the width (capped at 0.8 rho so the straight dash follows the ring). */
  len(k: number, spacing: number, w: number): number;
  colours(k: number, rng: Rng): [number, number];
  emissive(k: number): number;
  /** Record depth range as a factor of d_k. */
  depth: readonly [number, number];
}

/**
 * Emit the RING strokes of one layer of halo `si` (star index, or MOON_INDEX): tangent dashes on ring k at
 * u, v = the t = 0 position at radius rho_k (1 + 0.04 q3), d = d_k * depth factor. a1 = (L, 0, 0, W);
 * a3 = (kappa, si, k, q3). kappa is a small random bow along the camera-facing ribbon normal (invisible from E).
 */
export function emitHalo(sink: StrokeSink, rng: Rng, cls: StrokeClass, si: number, layer: HaloLayer): void {
  const n = layer.counts.length;
  const geoms = Array.from({ length: n }, (_, k) => ringGeom(si, k));
  const dRho = n > 1 ? geoms[1].rho - geoms[0].rho : geoms[0].rho * 0.5;
  for (let k = 0; k < n; k++) {
    const total = layer.counts[k];
    if (total <= 0) continue;
    const g = geoms[k];
    const w = layer.width(k, g.rho, dRho);
    const a = clamp(layer.rowOff(k, g.rho, dRho) / (0.04 * g.rho), -1, 1);
    const em = layer.emissive(k);
    for (let row = 0; row < layer.rows; row++) {
      const m = Math.floor((total + row) / layer.rows);
      if (m <= 0) continue;
      const spacing = (TAU * g.rho) / m;
      const L = Math.min(layer.len(k, spacing, w), 0.8 * g.rho);
      const phase = rng.next();
      for (let j = 0; j < m; j++) {
        const ang = (TAU * (j + phase + 0.35 * (rng.next() - 0.5))) / m;
        // ragged rows and dash sizes: the bands stay concentric but read as dabbed paint
        const q3 = layer.rows === 3
          ? clamp((row - 1) * Math.abs(a) + 0.3 * Math.abs(a) * (2 * rng.next() - 1), -1, 1)
          : clamp(a + 0.15 * Math.abs(a) * (2 * rng.next() - 1), -1, 1);
        const rr = g.rho * (1 + 0.04 * q3);
        const [ca, cb] = layer.colours(k, rng);
        const val = rng.range(0.88, 1.06);
        pushChecked(sink, {
          u: (g.cx + rr * Math.cos(ang)) / CANVAS_ASPECT, v: g.cy + rr * Math.sin(ang),
          d: g.d * rng.range(layer.depth[0], layer.depth[1]),
          cls, flags: StrokeFlag.NONE,
          du: L * rng.range(0.8, 1.25), dv: 0, dlnd: 0, w: w * rng.range(0.85, 1.15),
          colA: packSrgb(shadeQ(ca, val)), colB: packSrgb(shadeQ(cb, val)), emissive: em, seed: rng.next(),
          kappa: rng.range(-0.3, 0.3), q1: si, q2: k, q3,
        });
      }
    }
  }
}

/**
 * Per-star look (sizes vary as in the painting; positions and ring radii stay the §2.4 table):
 *  core   white-hot core radius / rho_core
 *  rings  rings painted at full strength; rings beyond fade into a sparse, dim fringe without dark backing, so the
 *         apparent halo size differs per star (Venus by far the largest)
 *  gain   brightness of the bands
 */
interface StarLook { core: number; rings: number; gain: number }
const LOOK: readonly StarLook[] = [
  { core: 0.62, rings: 9, gain: 1.12 }, // Venus
  { core: 0.54, rings: 4.4, gain: 0.88 }, // S2
  { core: 0.57, rings: 5.5, gain: 0.97 }, // S3
  { core: 0.6, rings: 6, gain: 1.02 }, // S4
  { core: 0.56, rings: 5, gain: 0.95 }, // S5
  { core: 0.54, rings: 4.2, gain: 0.88 }, // S6
  { core: 0.6, rings: 6.6, gain: 1.05 }, // S7
  { core: 0.55, rings: 4.8, gain: 0.92 }, // S8
  { core: 0.58, rings: 6, gain: 1.0 }, // S9
  { core: 0.55, rings: 4.6, gain: 0.9 }, // S10
  { core: 0.54, rings: 4, gain: 0.86 }, // S11
];

// Band colours cycle chrome / lemon / blue-green by k mod 3 (§4.5); colB is the bristle second tone.
const RING_A = [PALETTE.chrome, PALETTE.lemon, PALETTE.blueGreen] as const;
const RING_B = [mixHex(PALETTE.chrome, PALETTE.ochre, 0.35), mixHex(PALETTE.lemon, PALETTE.chrome, 0.4), mixHex(PALETTE.blueGreen, PALETTE.cerulean, 0.35)] as const;
/** Emissive per pigment: display peaks ~1.3 (below the Neutral desaturation and, but for lemon, the bloom threshold). */
const RING_EM = [0.55, 0.42, 0.7] as const;
const GAP_A = mixHex(PALETTE.ultramarine, PALETTE.prussian, 0.35);
const GAP_B = mixHex(PALETTE.ultramarine, PALETTE.cobalt, 0.25);
const FRINGE_A = mixHex(PALETTE.blueGreen, PALETTE.cerulean, 0.5);

/** Band (k < rings) strength in [0, 1]: 1 = full ring, 0 = fringe. */
const strength = (look: StarLook, k: number) => clamp(look.rings - k, 0, 1);

/**
 * Dark backing of ring k on its inner side: centre offset (negative, h-units) and width. Ring k >= 1 covers the gap
 * down to under ring k-1's band (0.75 dRho inward); ring 0 reaches in to the core. 0.88 = the shader's mean width
 * profile over the wide part of a stroke; the outward reach (~0.63 dRho) stays short of ring k+1's band.
 */
function backOff(k: number, rho: number, dRho: number): number {
  return k === 0 ? -0.04 * rho : -Math.min(0.04 * rho, 0.5 * dRho);
}
function backWidth(look: StarLook, k: number, rho: number, dRho: number): number {
  const off = -backOff(k, rho, dRho);
  const h = k === 0 ? (1 - look.core) * rho : 0.75 * dRho - off;
  return (2 * h) / 0.88;
}
const backLen = (w: number, rho: number) => Math.min(3 * w, 0.75 * rho);

function starLayers(i: number): [HaloLayer, HaloLayer] {
  const s = STARS[i];
  const look = LOOK[i];
  const total = i === 0 ? STAR_RING_STROKES.venus : STAR_RING_STROKES.other;
  const geoms = Array.from({ length: s.rings }, (_, k) => ringGeom(i, k));
  const dRho = geoms[1].rho - geoms[0].rho;
  // backing: one row of long overlapping dashes per painted ring (fixed by geometry), bands get the rest
  const back = geoms.map((g, k) => {
    if (strength(look, k) <= 0) return 0;
    const w = backWidth(look, k, g.rho, dRho);
    return Math.ceil((TAU * g.rho) / (0.55 * backLen(w, g.rho)));
  });
  const nBack = back.reduce((a, b) => a + b, 0);
  const band = allocate(total - nBack, geoms.map((g, k) => g.rho * (0.4 + 0.6 * strength(look, k))));
  const bandLayer: HaloLayer = {
    counts: band,
    rows: 3,
    // ~55 % of the ring spacing: band + dark gap of about equal weight, so the rings are countable
    width: (k, rho, dRho) => {
      const st = strength(look, k);
      const full = Math.max(0.3 * dRho, 0.55 * dRho - 1.6 * Math.min(0.04 * rho, 0.12 * dRho));
      return full * (0.55 + 0.45 * st);
    },
    rowOff: (_k, rho, dRho) => Math.min(0.04 * rho, 0.12 * dRho),
    // ~2.4x overlap along each row: the rings stay continuous when lower tiers keep only 60 % / 35 % of the dashes
    len: (_k, spacing, w) => Math.max(2.4 * spacing, 2.4 * w),
    colours: (k, rng) => {
      const st = strength(look, k);
      // 4 % of dashes borrow the neighbouring ring's pigment so the bands interlock like dabbed paint.
      const kk = rng.next() < 0.04 ? k + (rng.next() < 0.5 ? 1 : 2) : k;
      const a = RING_A[kk % 3], b = RING_B[kk % 3];
      if (st >= 1) return [a, b];
      // fringe: the pigment thins toward a dim blue-green that melts into the sky
      return [mixQ(FRINGE_A, a, 0.3 + 0.7 * st), mixQ(PALETTE.cerulean, b, 0.3 + 0.7 * st)];
    },
    emissive: (k) => RING_EM[k % 3] * look.gain * (1 - 0.035 * k) * (0.45 + 0.55 * strength(look, k)),
    depth: RING_BAND_DEPTH,
  };
  const backLayer: HaloLayer = {
    counts: back,
    rows: 1,
    width: (k, rho, dRho) => backWidth(look, k, rho, dRho),
    rowOff: (k, rho, dRho) => backOff(k, rho, dRho),
    len: (k, _spacing, w) => backLen(w, geoms[k].rho),
    colours: (_k, rng) => (rng.next() < 0.15 ? [GAP_B, GAP_A] : [GAP_A, GAP_B]),
    emissive: () => 0,
    depth: RING_BACK_DEPTH,
  };
  return [bandLayer, backLayer];
}

function emitCore(sink: StrokeSink, rng: Rng, i: number): void {
  const s = STARS[i];
  const n = i === 0 ? STAR_CORE_STROKES.venus : STAR_CORE_STROKES.other;
  const cx = s.u * CANVAS_ASPECT;
  const rc = s.rhoCore * LOOK[i].core;
  const emissive = i === 0 ? 8 : 6;
  for (let j = 0; j < n; j++) {
    const th = (TAU * (j + rng.next())) / n;
    const r0 = rc * 0.1 * rng.next();
    const r1 = rc * rng.range(0.55, 1.0);
    const len = r1 - r0;
    const mid = 0.5 * (r0 + r1);
    const t = (r1 / rc - 0.55) / 0.45; // long spikes lemon-tipped, short ones white: a white-hot centre
    pushChecked(sink, {
      u: (cx + mid * Math.cos(th)) / CANVAS_ASPECT, v: s.v + mid * Math.sin(th),
      d: s.dCore * (0.99 - 0.0065 * rng.next()),
      cls: StrokeClass.STAR_CORE, flags: StrokeFlag.NONE,
      du: len * Math.cos(th), dv: len * Math.sin(th), dlnd: 0, w: rc * rng.range(0.3, 0.5),
      colA: packSrgb(mixQ(PALETTE.zincWhite, PALETTE.lemon, 0.05 + 0.4 * t)),
      colB: packSrgb(mixQ(PALETTE.zincWhite, PALETTE.lemon, 0.2 * t)),
      emissive, seed: rng.next(), kappa: rng.range(-0.2, 0.2), q1: i, q2: 0, q3: 0,
    });
  }
}

/** STAR_CORE (2,200) + STAR_RING (14,000) for the 11 stars of §2.4. Deterministic for a given rng. */
export function generateStars(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < STARS.length; i++) emitCore(sink, rng, i);
  for (let i = 0; i < STARS.length; i++) {
    const [bands, back] = starLayers(i);
    emitHalo(sink, rng, StrokeClass.STAR_RING, i, bands);
    emitHalo(sink, rng, StrokeClass.STAR_RING, i, back);
  }
}
