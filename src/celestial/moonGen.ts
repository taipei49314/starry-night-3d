// M5: the crescent moon and its halo bell (§2.4, §4.5).
//  MOON: a thick crescent = outer disc (radius 0.035 h) minus an inner disc shifted toward the lower-left, so the
//        lit limb is upper-right (0.73 R thick) and the hollow opens lower-left. Strokes follow the crescent bands:
//        the pencil of circles through the two horn points (the outer and inner rims are members), so every band
//        converges on the horns. The crescent is the brightest element of the moon: orange on its concave edge,
//        chrome, lemon to near-white on the limb (emissive 0.55..0.8: display peak ~1.6, which keeps its hue through
//        the Neutral shoulder; only the limb crosses the bloom threshold, so the glow does not fill the hollow). The
//        unlit hollow is a dark burnt ochre (emissive 0.12) so the crescent shape reads against it. All MOON depths
//        are < the bell's (MOON < MOON_RING where they overlap).
//  MOON_RING: the bell, 10 rings rho_k = 0.035 + 0.0095 k at d_k = 11 km (1 + 0.13 k), two layers per ring:
//        bands   rings 1..9, orange (inner) -> chrome -> pale lemon (outer), ~55 % of the ring spacing, below the bloom
//                threshold so they stay saturated and darker than the crescent
//        backing rings 0..9, one wide row of dark ochre on the inner side of each ring, just behind its band: it fills
//                the gap to the previous ring and sits behind both bands (see starsGen), so the darker gaps make the
//                rings countable; ring 0 (the moon's rim) is backing only, on its outer side: a dark rim that outlines
//                the crescent's limb.
import { CANVAS_ASPECT, MOON_DEF, MOON_INDEX, PALETTE, StrokeClass, StrokeFlag, type Rng, type StrokeSink } from '../contracts';
import { ringGeom } from '../shared/flowField';
import { mixHex, packSrgb, shadeHex } from '../shared/palette';
import { allocate, emitHalo, mixQ, pushChecked, RING_BACK_DEPTH, RING_BAND_DEPTH, shadeQ, type HaloLayer } from './starsGen';

export const MOON_CRESCENT_STROKES = 1350;
export const MOON_HOLLOW_STROKES = 450;
export const MOON_RING_STROKES = 4200;

/** Crescent shape (h-units): the inner disc is offset by HOLLOW_SHIFT*R toward HOLLOW_DIR with radius HOLLOW_R*R. */
const HOLLOW_DIR = (225 * Math.PI) / 180;
const HOLLOW_SHIFT = 0.45;
const HOLLOW_R = 0.72;

export interface CrescentGeom {
  cx: number; cy: number; r: number; ix: number; iy: number; ir: number;
  /** horn points */ h1: [number, number]; h2: [number, number];
}

/** Crescent geometry in flow space (h-units), shared with the harness overlay. */
export function crescentGeom(): CrescentGeom {
  const cx = MOON_DEF.u * CANVAS_ASPECT;
  const cy = MOON_DEF.v;
  const r = MOON_DEF.rCrescent;
  const ex = Math.cos(HOLLOW_DIR), ey = Math.sin(HOLLOW_DIR);
  const delta = HOLLOW_SHIFT * r;
  const ir = HOLLOW_R * r;
  const ix = cx + delta * ex, iy = cy + delta * ey;
  // Circle-circle intersection: a along the axis from the outer centre, h across it.
  const a = (delta * delta + r * r - ir * ir) / (2 * delta);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  return {
    cx, cy, r, ix, iy, ir,
    h1: [cx + a * ex - h * ey, cy + a * ey + h * ex],
    h2: [cx + a * ex + h * ey, cy + a * ey - h * ex],
  };
}

/**
 * Pencil parameter of point p: the circle through both horns and p has its centre at I + b (C - I).
 * b = 0 is the inner rim, b = 1 the outer rim; 0 < b < 1 inside the crescent. Returns b and the band tangent (CCW).
 */
function pencil(g: CrescentGeom, px: number, py: number): { b: number; tx: number; ty: number } {
  const [hx, hy] = g.h1;
  const ax = hx - px, ay = hy - py;
  const ex = g.cx - g.ix, ey = g.cy - g.iy;
  const num = hx * hx + hy * hy - px * px - py * py - 2 * (ax * g.ix + ay * g.iy);
  const den = 2 * (ax * ex + ay * ey);
  const b = Math.abs(den) < 1e-12 ? 1e6 : num / den;
  // centre of that circle; |b| huge = the chord between the horns (a straight line)
  let tx: number, ty: number;
  if (Math.abs(b) > 1e4) {
    const l = Math.hypot(g.h2[0] - hx, g.h2[1] - hy);
    tx = (g.h2[0] - hx) / l; ty = (g.h2[1] - hy) / l;
  } else {
    const ox = g.ix + b * ex, oy = g.iy + b * ey;
    const rx = px - ox, ry = py - oy;
    const l = Math.hypot(rx, ry) || 1;
    tx = -ry / l; ty = rx / l;
  }
  return { b, tx, ty };
}

/** R2 low-discrepancy sequence: even coverage without clumps or holes. */
function r2(n: number, o1: number, o2: number): [number, number] {
  return [(o1 + n * 0.7548776662466927) % 1, (o2 + n * 0.5698402909980532) % 1];
}

// Crescent ramp across the band (b = 0 concave edge -> 1 limb): orange, chrome, lemon, near-white glints on the limb.
const CR_ORANGE = mixHex(PALETTE.chrome, PALETTE.ochre, 0.6);
const CR_LIMB = mixHex(PALETTE.lemon, PALETTE.zincWhite, 0.35);
const HOLLOW_A = mixHex(shadeHex(PALETTE.ochre, 0.3), PALETTE.chrome, 0.06);
const HOLLOW_B = mixHex(shadeHex(PALETTE.ochre, 0.22), PALETTE.ultramarine, 0.12);
/** MOON depth / d (dRange [10,800, 11,200]): crescent in front of the hollow, both in front of the bell. */
const CRESCENT_DEPTH = [0.9825, 0.9865] as const;
const HOLLOW_DEPTH = [0.988, 0.992] as const;

function crescentColour(b: number, rng: Rng): [number, number] {
  let a: number;
  if (b < 0.35) a = mixQ(CR_ORANGE, PALETTE.chrome, b / 0.35);
  else if (b < 0.7) a = mixQ(PALETTE.chrome, PALETTE.lemon, (b - 0.35) / 0.35);
  else a = mixQ(PALETTE.lemon, CR_LIMB, (b - 0.7) / 0.3);
  const r = rng.next();
  const second = r < 0.2 ? CR_ORANGE : r < 0.55 ? PALETTE.lemon : PALETTE.chrome;
  return [a, mixQ(a, second, 0.5)];
}

function emitCrescent(sink: StrokeSink, rng: Rng): void {
  const g = crescentGeom();
  const o1 = rng.next(), o2 = rng.next();
  let lit = 0, hollow = 0;
  for (let n = 0; n < 200000 && (lit < MOON_CRESCENT_STROKES || hollow < MOON_HOLLOW_STROKES); n++) {
    const [x, y] = r2(n, o1, o2);
    const px = g.cx + (2 * x - 1) * g.r, py = g.cy + (2 * y - 1) * g.r;
    const ro = Math.hypot(px - g.cx, py - g.cy);
    if (ro > g.r) continue;
    const inHollow = Math.hypot(px - g.ix, py - g.iy) < g.ir;
    if (inHollow ? hollow >= MOON_HOLLOW_STROKES : lit >= MOON_CRESCENT_STROKES) continue;
    const p = pencil(g, px, py);
    let L: number, W: number, ca: number, cb: number, em: number, d: number;
    if (!inHollow) {
      const b = Math.min(1, Math.max(0, p.b));
      L = rng.range(0.007, 0.013);
      W = rng.range(0.0028, 0.0042);
      [ca, cb] = crescentColour(b, rng);
      em = 0.55 + 0.25 * b;
      d = MOON_DEF.d * rng.range(CRESCENT_DEPTH[0], CRESCENT_DEPTH[1]);
      lit++;
    } else {
      L = rng.range(0.006, 0.011);
      W = rng.range(0.003, 0.0045);
      ca = HOLLOW_A;
      cb = HOLLOW_B;
      em = 0.12;
      d = MOON_DEF.d * rng.range(HOLLOW_DEPTH[0], HOLLOW_DEPTH[1]);
      hollow++;
    }
    pushChecked(sink, {
      u: px / CANVAS_ASPECT, v: py, d, cls: StrokeClass.MOON, flags: StrokeFlag.NONE,
      du: p.tx * L, dv: p.ty * L, dlnd: 0, w: W,
      colA: packSrgb(ca), colB: packSrgb(cb), emissive: em, seed: rng.next(),
      kappa: rng.range(-0.25, 0.25), q1: 0, q2: 0, q3: 0,
    });
  }
}

const N_RINGS = MOON_DEF.rings;
const TAU = Math.PI * 2;
// Band pigments by ring: orange next to the moon, chrome through the middle, pale lemon at the rim.
const BAND_ORANGE = mixHex(PALETTE.chrome, PALETTE.ochre, 0.5);
function bandBase(k: number): number {
  if (k <= 1) return BAND_ORANGE;
  if (k === 2) return mixHex(PALETTE.chrome, PALETTE.ochre, 0.25);
  if (k <= 6) return PALETTE.chrome;
  if (k <= 8) return mixHex(PALETTE.chrome, PALETTE.lemon, 0.45);
  return mixHex(PALETTE.lemon, PALETTE.zincWhite, 0.3);
}
const BAND_BASE = Array.from({ length: N_RINGS }, (_, k) => bandBase(k));
// Dark gaps: burnt ochre with a little olive; the outer gaps lean toward the sky's ultramarine so the bell's rim melts.
const GAP_IN = mixHex(shadeHex(PALETTE.ochre, 0.36), PALETTE.cypressGreen, 0.2);
const GAP_OUT = mixHex(shadeHex(PALETTE.ochre, 0.3), PALETTE.ultramarine, 0.45);
const gapColour = (k: number) => mixQ(GAP_IN, GAP_OUT, Math.max(0, (k - 5) / (N_RINGS - 5)));

function bellLayers(): [HaloLayer, HaloLayer] {
  const geoms = Array.from({ length: N_RINGS }, (_, k) => ringGeom(MOON_INDEX, k));
  const dRho = geoms[1].rho - geoms[0].rho;
  // backing offset (signed, h-units) and width per ring: ring 0 outside the moon's rim, the others on their inner side
  const backOff = (k: number) => (k === 0 ? 0.04 * geoms[0].rho : -Math.min(0.04 * geoms[k].rho, 0.5 * dRho));
  const backW = (k: number) => (2 * (k === 0 ? 0.35 * dRho : 0.75 * dRho - Math.abs(backOff(k)))) / 0.88;
  const backL = (k: number) => Math.min(3 * backW(k), 0.75 * geoms[k].rho);
  const back = geoms.map((g, k) => Math.ceil((TAU * g.rho) / (0.4 * backL(k))));
  const nBack = back.reduce((a, b) => a + b, 0);
  // ring 0 is the moon's rim (backing only); the outermost band is a thinner, sparser fringe
  const band = allocate(MOON_RING_STROKES - nBack, geoms.map((g, k) => (k === 0 ? 0 : k === N_RINGS - 1 ? 0.6 : 1) * g.rho));
  const bands: HaloLayer = {
    counts: band,
    rows: 3,
    width: (k) => (k === N_RINGS - 1 ? 0.24 : 0.34) * dRho,
    rowOff: () => 0.12 * dRho,
    len: (_k, spacing, w) => Math.max(2.4 * spacing, 2.6 * w), // overlap keeps the rings whole at lower tiers
    colours: (k, rng) => {
      const base = BAND_BASE[k];
      const r = rng.next();
      // second tones: lemon glints on alternate rings, ochre on the others; 10 % of dashes run lemon for sparkle
      const a = r < 0.1 ? mixQ(base, PALETTE.lemon, 0.6) : base;
      const partner = k % 2 === 0 ? PALETTE.lemon : PALETTE.ochre;
      // bands at 78 % value: the bell glows a clear step below the crescent
      return [shadeQ(a, 0.78), shadeQ(mixQ(base, partner, 0.45), 0.78)];
    },
    emissive: (k) => 0.24 - (0.1 * k) / (N_RINGS - 1),
    depth: RING_BAND_DEPTH,
  };
  const backing: HaloLayer = {
    counts: back,
    rows: 1,
    width: (k) => backW(k),
    rowOff: (k) => backOff(k),
    len: (k) => backL(k),
    colours: (k, rng) => {
      const c = gapColour(k);
      return [c, rng.next() < 0.3 ? mixQ(c, PALETTE.ochre, 0.25) : c];
    },
    emissive: () => 0.08,
    depth: RING_BACK_DEPTH,
  };
  return [bands, backing];
}
/** MOON crescent + hollow (1,800) and the MOON_RING bell (4,200, q1 = MOON_INDEX). Deterministic for a given rng. */
export function generateMoon(sink: StrokeSink, rng: Rng): void {
  emitCrescent(sink, rng);
  const [bands, backing] = bellLayers();
  emitHalo(sink, rng, StrokeClass.MOON_RING, MOON_INDEX, bands);
  emitHalo(sink, rng, StrokeClass.MOON_RING, MOON_INDEX, backing);
}
