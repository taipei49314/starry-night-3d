// M6: the cypress (§2.3, §4.6): a black-green flame of seven twisted tubes around a dark twisted lathe core.
//
// Tongue j (j = slot, 0 = leftmost):
//   trunk (v <= V_SPLIT)
//     centreline  u_j(v) = u0_j(v) + wob_j (0.02 sin(7v + phi_j) + lean_j v), u0_j spread over the silhouette interval,
//                 softly clamped so the bundle fills cypressSilhouette(v)
//     half-width  w_j(v) = 0.5 (uR - uL) / 2.6                                        (u-fraction units)
//   crown (v > V_SPLIT): the tongues regroup into three flames, left {0, 1}, main {2, 3, 4}, right {5, 6}. At V_SPLIT
//     the flames partition the silhouette 2 : 3 : 2; above it each flame narrows, sways and runs to its own tip, so the
//     top splits into three flame tips with sky between them: left ~(0.14, 0.98) and right ~(0.25, 0.94) inside the
//     frame, the main flame past the top edge (v ~ 1.15, y ~ 165 m). The tubes of one flame share its depth.
//   tube        u = u_j + w_j cos(phi),  d = 192 + dd_j(v) + Rw_j sin(phi),  Rw_j = w_j 2 AT (192 + dd_j),  phi = phi0 + 2.6 v
//               dd_j(v) = dd_j * clamp(silhouette width / 0.2, 0.3, 1): the bundle converges in depth toward the top
// Strokes run along the twisted tube: each is the chord of the helix (phi0 fixed) over a v-span chosen so its world
// length equals L h-units at its depth; endpoints lie on the tube, so du, dv, dlnd come from d(tube point)/dv.
// Edge licks: flame tongues along both outer edges (and the flames' outer sides). Each lick is a bundle of curved
// strands that start on the edge tube's front surface, rise and curl outward to a pointed tip up to ~0.02 beyond
// CYPRESS_SIL (much less on the right next to Venus), so the outline is ragged flame instead of a smooth lens.
// Palette: near-black green, with olive, deep blue and brown accents.
import { LatheGeometry, Mesh, Vector2, Vector3, type Material } from 'three';
import {
  AT, CANVAS_ASPECT, CLASS_INFO, CYPRESS_AXIS_D, JET_CTRL, PALETTE, STARS, StrokeClass, StrokeFlag, T_HALF,
  type Rng, type StrokeRecord, type StrokeSink,
} from '../contracts';
import { canvasToWorld, cypressSilhouette } from '../shared/canvasSpace';
import { mixHex, packSrgb, shadeHex } from '../shared/palette';

const TAU = Math.PI * 2;
export const CYPRESS_TONGUES = 7;
/** Tube strokes + edge-lick strokes + UNDERLAYER strokes = 19,500 (CLASS_INFO budgetHigh). */
export const CYPRESS_STROKES = 16900;
export const CYPRESS_LICK_STROKES = 1100;
export const CYPRESS_UNDERLAYER_STROKES = 1500;
/** Colour of the core lathe and the underlayer fill. */
export const CYPRESS_CORE_COLOR = 0x0f1712;

const V_BOT = -0.12; // below the bottom edge, inside the knoll (y ~ 7 m)
/** The trunk splits into the three crown flames above this row (blend over V_SPLIT..V_SPLIT + SPLIT_BLEND). */
export const V_SPLIT = 0.77;
const SPLIT_BLEND = 0.05;
const SIL_TOP = 1.08;
const TWIST = 2.6;
const CLAMP_K = 0.008;
/** Clamp bounds sit this far outside the tube-edge limits: centres the E outline error on the table (u-units). */
const SIL_MARGIN = 0.0015;
const TAB_N = 512;
const UNDERLAYER_RADIUS = 0.45;
const UNDERLAYER_V_MAX = 0.97;
/** The core lathe follows the silhouette up to here, then closes (elliptically) at CORE_TOP, below the crown notches. */
const CORE_TAPER_V0 = 0.6;
const CORE_TOP = 0.83;
/**
 * Core radius / silhouette width and its axis set-back (m). The tubes' front surfaces lie between ~168 m and ~202 m
 * (dd +-18 m, tube depth radius ~7 m); a core of 0.25 x width on the 192 m axis came in front of the deeper tubes and
 * showed from E as a smooth black seam. At 0.2 x width, 6 m back, it stays behind the visible tube surfaces from E
 * and still fills the bundle's interior seen from the side.
 */
const CORE_R = 0.2;
const CORE_SETBACK = 6;
/** Depth of the core lathe's axis (m from E). */
export const CYPRESS_CORE_AXIS_D = CYPRESS_AXIS_D + CORE_SETBACK;

/** Crown flame of each slot, and the flames: share of the silhouette at V_SPLIT, tip u offset / v, sway. */
const GROUP = [0, 0, 1, 1, 1, 2, 2] as const;
interface FlameDef { share: number; tipU: number; vTop: number; sway: number }
const FLAMES: readonly FlameDef[] = [
  { share: 2 / 7, tipU: 0.141, vTop: 0.975, sway: 0.006 }, // left flame
  { share: 3 / 7, tipU: 0.197, vTop: 1.13, sway: 0.007 }, //  main flame, past the top edge (the jet starts at its tip)
  { share: 2 / 7, tipU: 0.243, vTop: 0.95, sway: 0.005 }, //  right flame, tops out above Venus's halo
];

interface Flame { c0: number; h0: number; tipU: number; vTop: number; sway: number; phase: number; ddMean: number }
interface Tongue {
  slot: number; group: number; inGroup: number; groupSize: number;
  phase: number; lean: number; wob: number; dd: number; vTop: number; tipOff: number; tone: number;
  /** centreline / half-width / depth-offset tables over [tabV0, tabV0 + TAB_N * tabStep] (filled by buildTable) */
  tabV0: number; tabStep: number; tabU: Float64Array; tabW: Float64Array; tabD: Float64Array;
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Polynomial smooth min / max (k = blend width). */
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

/** shadeHex memoised on a 1/64 grid of k (a handful of pigments x ~40 levels). */
const shadeCache = new Map<number, number>();
function shade(hex: number, k: number): number {
  const q = Math.round(k * 64);
  const key = hex * 256 + q;
  let c = shadeCache.get(key);
  if (c === undefined) {
    c = shadeHex(hex, q / 64);
    shadeCache.set(key, c);
  }
  return c;
}

function pushChecked(sink: StrokeSink, r: StrokeRecord): void {
  const [d0, d1] = CLASS_INFO[r.cls].dRange;
  if (!(r.d >= d0 && r.d <= d1)) {
    throw new Error(`${StrokeClass[r.cls]} stroke depth ${r.d.toFixed(1)} m outside dRange [${d0}, ${d1}]`);
  }
  sink.push(r);
}

/** CYPRESS_SIL lightly smoothed (5-tap, removes the table's corner kinks; < 0.002 off the table), tabulated once. */
const SIL_V0 = V_BOT - 0.12;
const SIL_STEP = 0.0025;
const SIL_N = Math.ceil((SIL_TOP - SIL_V0) / SIL_STEP);
let silTab: Float64Array | null = null;
function sil(v: number): [number, number] {
  if (!silTab) {
    silTab = new Float64Array((SIL_N + 1) * 2);
    const W = [1, 2, 3, 2, 1];
    for (let j = 0; j <= SIL_N; j++) {
      let l = 0, r = 0;
      for (let i = 0; i < 5; i++) {
        const s = cypressSilhouette(Math.min(SIL_V0 + j * SIL_STEP + (i - 2) * 0.01, SIL_TOP - 1e-6));
        l += W[i] * s[0];
        r += W[i] * s[1];
      }
      silTab[2 * j] = l / 9;
      silTab[2 * j + 1] = r / 9;
    }
  }
  const x = clamp((v - SIL_V0) / SIL_STEP, 0, SIL_N - 1e-9);
  const i = Math.floor(x);
  const f = x - i;
  return [silTab[2 * i] + (silTab[2 * i + 2] - silTab[2 * i]) * f, silTab[2 * i + 1] + (silTab[2 * i + 3] - silTab[2 * i + 1]) * f];
}

/** Depth-offset scale with the silhouette width (full below v ~ 0.6, 0.3 at the top). */
function ddScale(v: number): number {
  const [uL, uR] = sil(Math.min(v, SIL_TOP - 1e-6));
  return clamp((uR - uL) / 0.2, 0.3, 1);
}

function makeFlames(rng: Rng, ddBase: readonly number[]): Flame[] {
  const [uL, uR] = sil(V_SPLIT);
  const span = uR - uL;
  let e = uL;
  return FLAMES.map((f, g) => {
    const h0 = 0.5 * f.share * span;
    const c0 = e + h0;
    e += 2 * h0;
    const members = GROUP.map((gg, j) => (gg === g ? ddBase[j] : NaN)).filter((x) => !Number.isNaN(x));
    return {
      c0, h0,
      tipU: f.tipU + rng.range(-0.002, 0.002),
      vTop: f.vTop + rng.range(-0.008, 0.008),
      sway: f.sway, phase: rng.range(0, TAU),
      ddMean: members.reduce((a, b) => a + b, 0) / members.length,
    };
  });
}

let flames: Flame[] = [];

function makeTongues(rng: Rng): Tongue[] {
  // dd_j in [-18, 18] m: neighbouring tongues differ by >= 12 m so they read as separate tubes off-axis, while the
  // sorted depths are <= 6 m apart (tube radius ~7.5 m) so the bundle has no front/back split from the side.
  const ddBase = [-6, 12, -17, 5, 17, -12, 0];
  const tone = [0.98, 0.8, 1.06, 0.84, 1.02, 0.8, 0.98];
  const dd = ddBase.map((x) => clamp(x + rng.range(-1.5, 1.5), -18, 18));
  flames = makeFlames(rng, dd);
  const out: Tongue[] = [];
  for (let slot = 0; slot < CYPRESS_TONGUES; slot++) {
    const edge = slot === 0 || slot === CYPRESS_TONGUES - 1;
    const nearEdge = slot === 1 || slot === CYPRESS_TONGUES - 2;
    const group = GROUP[slot];
    const groupSize = GROUP.filter((g) => g === group).length;
    const inGroup = GROUP.slice(0, slot).filter((g) => g === group).length;
    out.push({
      slot, group, inGroup, groupSize,
      phase: rng.range(0, TAU),
      lean: rng.range(-0.02, 0.02),
      // edge tubes sway less (the licks break the outline instead), inner tubes writhe
      wob: edge ? 0.3 : nearEdge ? 0.8 : 1,
      dd: dd[slot],
      // the tubes of one flame end a little apart: ragged double / triple tips
      vTop: flames[group].vTop - (inGroup === Math.floor(groupSize / 2) ? 0 : rng.range(0.012, 0.03)),
      tipOff: (inGroup - (groupSize - 1) / 2) * rng.range(0.002, 0.005),
      tone: tone[slot],
      tabV0: 0, tabStep: 0, tabU: new Float64Array(TAB_N + 1), tabW: new Float64Array(TAB_N + 1), tabD: new Float64Array(TAB_N + 1),
    });
    buildTable(out[slot]);
  }
  return out;
}

/** Centre u and half-width w (u-fractions) of tongue t in the trunk layout at canvas row v. */
function frameBody(t: Tongue, v: number): { uc: number; w: number } {
  const [uL, uR] = sil(Math.min(v, SIL_TOP - 1e-6));
  const span = uR - uL;
  const w = (0.5 * span) / 2.6;
  const lo = uL + w - SIL_MARGIN;
  const hi = uR - w + SIL_MARGIN;
  const base = lo + (t.slot / (CYPRESS_TONGUES - 1)) * (hi - lo);
  const raw = base + t.wob * (0.02 * Math.sin(7 * v + t.phase) + t.lean * v);
  return { uc: clamp(smax(lo, smin(hi, raw, CLAMP_K), CLAMP_K), lo, hi), w };
}

/** Centre and half-width of tongue t in its crown flame at row v >= V_SPLIT (w -> 0 at the tongue's own tip). */
function frameFlame(t: Tongue, v: number): { uc: number; w: number } {
  const f = flames[t.group];
  const x = clamp((v - V_SPLIT) / (t.vTop - V_SPLIT), 0, 1);
  const e = smoothstep(0, 1, x);
  // the flame's spine: from its slot in the trunk to its tip, with an S-sway (writhe) that vanishes at both ends
  const cF = f.c0 + (f.tipU + t.tipOff - f.c0) * e + f.sway * Math.sin(1.6 * Math.PI * x + f.phase) * Math.sin(Math.PI * x);
  const hF = f.h0 * Math.pow(Math.max(0, 1 - Math.pow(x, 1.15)), 0.9) * (1 + 0.1 * Math.sin(2.4 * Math.PI * x + f.phase));
  const w = 0.75 * hF;
  const off = t.groupSize > 1 ? (2 * t.inGroup) / (t.groupSize - 1) - 1 : 0;
  return { uc: cF + off * (hF - w), w };
}

/** Centre and half-width at any v: trunk layout below V_SPLIT, blended into the crown flame above it. */
function frameExact(t: Tongue, v: number): { uc: number; w: number } {
  if (v <= V_SPLIT) return frameBody(t, v);
  const b = frameBody(t, v);
  const f = frameFlame(t, v);
  const k = smoothstep(V_SPLIT, V_SPLIT + SPLIT_BLEND, v);
  return { uc: b.uc + (f.uc - b.uc) * k, w: b.w + (f.w - b.w) * k };
}

/**
 * Depth offset of tongue t at row v: dd_j scaled with the silhouette width, so the bundle stays roughly round in world
 * and the thinning tongues converge in depth as well as in u. In the crown each flame's tubes pull together to the
 * flame's mean depth, so a flame never splits front / back seen from the side.
 */
function ddAt(t: Tongue, v: number): number {
  const s = ddScale(v);
  const body = t.dd * s;
  if (v <= V_SPLIT) return body;
  const m = flames[t.group].ddMean * s;
  const flame = m + (body - m) * 0.3;
  return body + (flame - body) * smoothstep(V_SPLIT, V_SPLIT + 2 * SPLIT_BLEND, v);
}

function buildTable(t: Tongue): void {
  t.tabV0 = V_BOT - 0.06;
  t.tabStep = (t.vTop + 0.03 - t.tabV0) / TAB_N;
  for (let i = 0; i <= TAB_N; i++) {
    const v = t.tabV0 + i * t.tabStep;
    const f = frameExact(t, v);
    t.tabU[i] = f.uc;
    t.tabW[i] = f.w;
    t.tabD[i] = ddAt(t, v);
  }
}

const fr = { uc: 0, w: 0, dd: 0 };
/** Table lookup of frameExact (linear interpolation): keeps generation inside its 20 ms budget. */
function frame(t: Tongue, v: number, out = fr): typeof fr {
  const x = clamp((v - t.tabV0) / t.tabStep, 0, TAB_N - 1e-9);
  const i = Math.floor(x);
  const f = x - i;
  out.uc = t.tabU[i] + (t.tabU[i + 1] - t.tabU[i]) * f;
  out.w = t.tabW[i] + (t.tabW[i + 1] - t.tabW[i]) * f;
  out.dd = t.tabD[i] + (t.tabD[i + 1] - t.tabD[i]) * f;
  return out;
}

const tp = { u: 0, d: 0, phi: 0 };
/** Tube point of tongue t at row v and base angle phi0, radius scaled by rs (1 = surface). */
function tubePoint(t: Tongue, v: number, phi0: number, rs: number, out = tp): typeof tp {
  const f = frame(t, v);
  const phi = phi0 + TWIST * v;
  const w = f.w * rs;
  const dAxis = CYPRESS_AXIS_D + f.dd;
  out.u = f.uc + w * Math.cos(phi);
  out.d = dAxis + w * 2 * AT * dAxis * Math.sin(phi);
  out.phi = phi;
  return out;
}

const pa = { u: 0, d: 0, phi: 0 };
const pb = { u: 0, d: 0, phi: 0 };
/**
 * A stroke of world length L (h-units at its depth) along the helix through (v, phi0): the chord between two tube
 * points, so canvasToWorld of its endpoints lies exactly on the tube.
 */
function helixStroke(t: Tongue, v: number, phi0: number, rs: number, L: number) {
  const h = 0.002;
  tubePoint(t, v - h, phi0, rs, pa);
  tubePoint(t, v + h, phi0, rs, pb);
  const dc = 0.5 * (pa.d + pb.d);
  const du = ((pb.u - pa.u) / (2 * h)) * CANVAS_ASPECT;
  const dd = (pb.d - pa.d) / (2 * h) / (2 * T_HALF * dc); // depth rate expressed in h-units at depth dc
  const lam = Math.sqrt(du * du + 1 + dd * dd);
  const half = (0.5 * L) / lam;
  tubePoint(t, v - half, phi0, rs, pa);
  tubePoint(t, v + half, phi0, rs, pb);
  return {
    u: 0.5 * (pa.u + pb.u), v, d: Math.sqrt(pa.d * pb.d),
    du: (pb.u - pa.u) * CANVAS_ASPECT, dv: 2 * half, dlnd: Math.log(pb.d / pa.d),
    phi: phi0 + TWIST * v,
  };
}

/** Rotate (du, dv) up to maxDeg toward the wind-jet start (tip strokes lean into the wind). */
function leanToJet(s: { u: number; v: number; du: number; dv: number }, maxDeg: number): void {
  if (maxDeg <= 0) return;
  const gx = (JET_CTRL[0][0] - s.u) * CANVAS_ASPECT, gy = JET_CTRL[0][1] - s.v;
  const ang = Math.atan2(s.du * gy - s.dv * gx, s.du * gx + s.dv * gy);
  const rot = Math.sign(ang) * Math.min(Math.abs(ang), (maxDeg * Math.PI) / 180);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const du = s.du * c - s.dv * sn;
  const dv = s.du * sn + s.dv * c;
  s.du = du;
  s.dv = dv;
}

/** Area-ish weight of a tongue (integral of its half-width over v) and its max half-width. */
function tongueStats(t: Tongue): { area: number; wMax: number } {
  let area = 0, wMax = 0;
  const n = 240;
  for (let i = 0; i < n; i++) {
    const v = V_BOT + ((i + 0.5) / n) * (t.vTop - V_BOT);
    const w = frame(t, v).w;
    area += w;
    wMax = Math.max(wMax, w);
  }
  return { area: (area * (t.vTop - V_BOT)) / n, wMax };
}

function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((total * w) / sum));
  let left = total - out.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % out.length, left--) out[i]++;
  return out;
}

/**
 * Sample (v, phi0) over the tube surface of tongue t with density proportional to the circumference (R2 sequence +
 * rejection on w(v)), calling emit for each accepted sample.
 */
function sampleTube(t: Tongue, n: number, wMax: number, rng: Rng, emit: (v: number, phi0: number) => void, vMax = t.vTop): void {
  const o1 = rng.next(), o2 = rng.next();
  let k = 0;
  for (let i = 0; k < n && i < n * 40; i++) {
    const x = (o1 + i * 0.7548776662466927) % 1;
    const y = (o2 + i * 0.5698402909980532) % 1;
    const v = V_BOT + x * (vMax - V_BOT);
    if (rng.next() * wMax > frame(t, v).w) continue;
    emit(v, y * TAU);
    k++;
  }
}

// ---------------------------------------------------------------- pigments
// Near-black green body; olive, deep blue and brown accents (the painting's cypress is almost black, its strokes
// separated by a few lighter olive and blue-green streaks).
const C_BLACK = mixHex(PALETTE.cypressDark, PALETTE.voidDeep, 0.45);
const C_OLIVE = mixHex(PALETTE.cypressGreen, PALETTE.lemon, 0.06);
const C_OLIVE_B = mixHex(PALETTE.groveLight, PALETTE.lemon, 0.04);
const C_BLUE = mixHex(PALETTE.ultramarine, PALETTE.prussian, 0.3);
const C_BLUE_B = mixHex(PALETTE.ultramarine, PALETTE.cypressDark, 0.5);
const C_BROWN = mixHex(PALETTE.cypressDark, PALETTE.ochre, 0.09);

/** [colA, colB] of a cypress stroke: light tongues carry more olive, dark ones more black. */
function pigment(rng: Rng, light: boolean): [number, number] {
  const r = rng.next();
  if (r < 0.07) return [C_BLUE, C_BLUE_B];
  if (r < 0.115) return [C_BROWN, PALETTE.cypressDark];
  if (r < (light ? 0.2 : 0.155)) return [C_OLIVE, rng.next() < 0.3 ? C_OLIVE_B : PALETTE.cypressGreen];
  const q = rng.next();
  if (q < (light ? 0.42 : 0.6)) return [C_BLACK, PALETTE.cypressDark];
  if (q < 0.86) return [PALETTE.cypressDark, PALETTE.cypressGreen];
  return [PALETTE.cypressGreen, PALETTE.cypressDark];
}

const tongueSeed = (j: number, rng: Rng) => (j / CYPRESS_TONGUES + 0.22 * rng.next()) % 1;

// ---------------------------------------------------------------- edge licks
const VENUS = STARS[0];
/** Lick tips end at most this far beyond the CYPRESS_SIL table (u-fractions; strokes add their half width). */
const LICK_MAX = 0.016;
/** Lick protrusion scale: full on the left; on the right it shrinks next to Venus (the edge stays just left of her). */
function lickScale(side: number, v: number): number {
  if (side < 0) return 1;
  return 0.25 + 0.75 * smoothstep(0.04, 0.12, Math.abs(v - VENUS.v));
}

interface Lick { side: -1 | 1; t: Tongue; v0: number; h: number; p: number; tipJ: number }

/**
 * Flame-tongue licks along the outer edges. A lick is a pointed tongue: strands whose bases are spread up the edge
 * (over the lower half of the lick, inset into the trunk on the edge tube's front surface) all rise and curl outward
 * to one shared tip p beyond the tube edge, so together they fill a curved flame that breaks the outline. Strands are
 * polylines of 3 straight strokes thinning toward the tip; depth runs from the front surface to the silhouette plane
 * of the edge tube (its axis depth).
 */
function emitLicks(sink: StrokeSink, rng: Rng, tongues: Tongue[]): void {
  const licks: Lick[] = [];
  for (const side of [-1, 1] as const) {
    const t = side < 0 ? tongues[0] : tongues[CYPRESS_TONGUES - 1];
    const vEnd = t.vTop - 0.06;
    let v = -0.1 + 0.03 * rng.next();
    while (v < vEnd) {
      const crown = smoothstep(0.7, 0.95, v);
      const h = rng.range(0.07, 0.12) * (1 - 0.35 * crown);
      const p = rng.range(0.009, 0.019) * lickScale(side, v + h) * (1 - 0.35 * crown);
      licks.push({ side, t, v0: v, h, p, tipJ: rng.range(-0.002, 0.002) });
      v += rng.range(0.045, 0.07) * (1 - 0.3 * crown);
    }
  }
  const f0 = { uc: 0, w: 0, dd: 0 };
  let left = CYPRESS_LICK_STROKES;
  // round-robin over the licks, one strand (3 strokes) at a time, until the budget is used exactly
  for (let pass = 0; left > 0; pass++) {
    for (let i = 0; i < licks.length && left > 0; i++) {
      const L = licks[i];
      const s = L.side;
      // strand base: spread over the lower half of the lick, deeper inside the trunk the lower it starts
      const fb0 = rng.next();
      const vb = L.v0 + 0.5 * L.h * fb0;
      const vT = L.v0 + L.h;
      const inset = (0.003 + 0.016 * (1 - fb0)) * rng.range(0.7, 1.2);
      const fb = frame(L.t, vb, f0);
      const ubC = fb.uc, ubW = fb.w, ddB = fb.dd;
      const ub = ubC + s * ubW - s * inset;
      const ft = frame(L.t, vT, f0);
      const edgeT = ft.uc + s * ft.w;
      const tab = cypressSilhouette(Math.min(vT, SIL_TOP - 1e-6))[s < 0 ? 0 : 1];
      const p = clamp(Math.min(L.p, LICK_MAX + s * (tab - edgeT)), 0.003, LICK_MAX + 0.01);
      const uT = edgeT + s * p + L.tipJ;
      const dEdgeT = CYPRESS_AXIS_D + ft.dd;
      // base on the front surface of the edge tube: cos(phi) = (ub - uc) / w, sin(phi) < 0 faces E
      const cphi = clamp((ub - ubC) / Math.max(ubW, 1e-6), -1, 1);
      const dAxisB = CYPRESS_AXIS_D + ddB;
      const dBase = dAxisB - ubW * 2 * AT * dAxisB * Math.sqrt(1 - cphi * cphi) * 0.9;
      // u runs out fast and then rises to the tip: 1 - (1 - x)^curl (the tip points up, the outer flank bulges)
      const curl = rng.range(1.3, 1.9);
      const bow = s * rng.range(0.0, 0.003);
      const w0 = rng.range(0.006, 0.0095);
      const [ca, cb] = pigment(rng, rng.next() < 0.5);
      const lit = rng.range(0.55, 0.9);
      const seed = tongueSeed(L.t.slot, rng);
      const pt = (x: number) => ({
        u: ub + (uT - ub) * (1 - Math.pow(1 - x, curl)) + bow * Math.sin(Math.PI * x),
        v: vb + (vT - vb) * x,
        d: dBase + (dEdgeT - dBase) * smoothstep(0, 0.4, x),
      });
      const knots = [0, 0.3, 0.66, 1];
      for (let k = 0; k < 3 && left > 0; k++) {
        const A = pt(knots[k]), B = pt(knots[k + 1]);
        const xm = 0.5 * (knots[k] + knots[k + 1]);
        pushChecked(sink, {
          u: 0.5 * (A.u + B.u), v: 0.5 * (A.v + B.v), d: Math.sqrt(A.d * B.d),
          cls: StrokeClass.CYPRESS, flags: StrokeFlag.OUTLINE,
          du: (B.u - A.u) * CANVAS_ASPECT, dv: B.v - A.v, dlnd: Math.log(B.d / A.d),
          w: w0 * (1 - 0.55 * xm * xm),
          colA: packSrgb(shade(ca, lit)), colB: packSrgb(shade(cb, lit)), emissive: 0,
          seed, kappa: rng.range(-0.15, 0.15), q1: L.t.slot, q2: s < 0 ? Math.PI : 0, q3: 0,
        });
        left--;
      }
    }
  }
}

/** CYPRESS strokes (16,900 tube + 1,100 edge-lick + 1,500 UNDERLAYER-flagged inner fill). Deterministic for a given rng. */
export function generateCypress(sink: StrokeSink, rng: Rng): void {
  const tongues = makeTongues(rng);
  const stats = tongues.map(tongueStats);
  const nSurf = allocate(CYPRESS_STROKES, stats.map((s) => s.area));
  const nUnder = allocate(CYPRESS_UNDERLAYER_STROKES, stats.map((s) => s.area));

  tongues.forEach((t, j) => {
    // Surface strokes.
    sampleTube(t, nSurf[j], stats[j].wMax, rng, (v, phi0) => {
      const tip = smoothstep(0.85, 1.12, v);
      const L = (0.012 + 0.023 * Math.sqrt(rng.next())) * (1 - 0.45 * tip); // L in [0.012, 0.035], long-biased
      const s = helixStroke(t, v, phi0, 1, L);
      // the main flame's tip leans into the wind toward the jet start
      if (t.group === 1) leanToJet(s, 20 * smoothstep(0.95, 1.02, v));
      // Even tongues lean light (more olive), odd ones dark (more black), so the overlapping tubes separate.
      const [a, b] = pigment(rng, t.slot % 2 === 0);
      // Baked tube shading (the ribbon shader has no tube normal): light from the moon side (right / back), so from
      // E each tube is darker on its left; per-tongue tone alternates; three helical paint stripes follow the twist.
      const stripe = 0.88 + 0.24 * (0.5 + 0.5 * Math.cos(3 * phi0 + t.phase));
      const lit = (0.45 + 0.45 * (0.5 + 0.5 * Math.cos(s.phi - 0.6))) * t.tone * stripe;
      const phi = ((s.phi % TAU) + TAU) % TAU;
      pushChecked(sink, {
        u: s.u, v: s.v, d: s.d * (1 + 0.003 * (2 * rng.next() - 1)),
        cls: StrokeClass.CYPRESS, flags: Math.abs(Math.cos(s.phi)) > 0.85 ? StrokeFlag.OUTLINE : StrokeFlag.NONE,
        du: s.du, dv: s.dv, dlnd: s.dlnd, w: rng.range(0.004, 0.007),
        colA: packSrgb(shade(a, lit)), colB: packSrgb(shade(b, lit)), emissive: 0,
        // Seeds cluster per tongue so the CYPRESS writhe (phase 2 pi seed) sways each tongue coherently.
        seed: tongueSeed(j, rng),
        kappa: rng.range(-0.15, 0.15), q1: t.slot, q2: phi, q3: 0,
      });
    });
    // Underlayer: flat dark strokes inside the tube (0.45 radius) that close see-through gaps off-axis. Body and lower
    // crown only, and no wider (x3 in the shader) than the inner tube, so they never poke through the thin tips.
    sampleTube(t, nUnder[j], stats[j].wMax, rng, (v, phi0) => {
      const s = helixStroke(t, v, phi0, UNDERLAYER_RADIUS, rng.range(0.02, 0.04));
      const phi = ((s.phi % TAU) + TAU) % TAU;
      const wInner = 0.3 * frame(t, v).w * CANVAS_ASPECT;
      pushChecked(sink, {
        u: s.u, v: s.v, d: s.d, cls: StrokeClass.CYPRESS, flags: StrokeFlag.UNDERLAYER,
        du: s.du, dv: s.dv, dlnd: s.dlnd, w: Math.min(rng.range(0.004, 0.006), wInner),
        colA: packSrgb(CYPRESS_CORE_COLOR), colB: packSrgb(CYPRESS_CORE_COLOR), emissive: 0,
        seed: tongueSeed(j, rng),
        kappa: 0, q1: t.slot, q2: phi, q3: 0,
      });
    }, Math.min(UNDERLAYER_V_MAX, t.vTop - 0.04));
  });
  emitLicks(sink, rng, tongues);
}

/**
 * The dark twisted core: a LatheGeometry (97 profile points = 96 segments along v, 48 around) whose rings follow
 * the silhouette centre at 0.4 x half-width, mapped through canvasToWorld about d = 198 (round in world: the depth
 * radius is the u radius times 2 AT d). A 3-lobe cross-section twists with the tongues (2.6 rad per unit v).
 * It runs from v = -0.12 (inside the knoll) and closes at CORE_TOP = 0.83, just above the crown split, so it never
 * shows in the notches between the three crown flames.
 * The integrator passes M3's makeUnderlayMaterial(CYPRESS_CORE_COLOR, uniforms).
 */
export function createCypressCore(material: Material): Mesh {
  const NV = 96;
  const NR = 48;
  const pts: Vector2[] = [];
  for (let j = 0; j <= NV; j++) pts.push(new Vector2(1, j));
  const geo = new LatheGeometry(pts, NR);
  const pos = geo.getAttribute('position');
  const P = new Vector3();
  for (let i = 0; i <= NR; i++) {
    const th = (TAU * i) / NR;
    for (let j = 0; j <= NV; j++) {
      const v = V_BOT + ((CORE_TOP - V_BOT) * j) / NV;
      const [uL, uR] = cypressSilhouette(v);
      const uc = 0.5 * (uL + uR);
      const close = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, v - CORE_TAPER_V0) / (CORE_TOP - CORE_TAPER_V0), 2)));
      const r = CORE_R * (uR - uL) * close * (1 + 0.12 * Math.cos(3 * (th - TWIST * v)));
      const dAxis = CYPRESS_CORE_AXIS_D;
      canvasToWorld(uc + r * Math.cos(th), v, dAxis * (1 + 2 * AT * r * Math.sin(th)), P);
      pos.setXYZ(i * (NV + 1) + j, P.x, P.y, P.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new Mesh(geo, material);
  mesh.name = 'cypressCore';
  return mesh;
}
