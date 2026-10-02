// M4 sky generator (SPEC §4.4, §2.4, §3): underpainting, sky decks, the two great-swirl funnels with their
// underlayer shells, the four eddies and the wind jet. Everything is authored in canvas space (u, v, d) so the
// view from E is exact; depth is spent on paint order (SWIRL/EDDY < SKY_BAND < UNDERPAINT) and on the 3D form
// of each motif (funnels flare with the arm law, decks are tilted strata, the jet climbs 220 m -> 12 km).
import {
  CANVAS_ASPECT, CLASS_INFO, GEN_U, GEN_V, MOON_DEF, PALETTE, SKY_GEN_U, SKY_GEN_V, STARS, StrokeClass, StrokeFlag, VORTICES,
  type Rng, type StrokeRecord, type StrokeSink,
} from '../contracts';
import { jetPoint, Region, regionAt } from '../shared/canvasSpace';
import { armPoint, flowField, MOON_HALO_R, ridgeV, smoothstep, starHaloSigned } from '../shared/flowField';
import { mixHex, packSrgb, rampHex, shadeHex } from '../shared/palette';
import { forkRng } from '../shared/rng';

const A = CANVAS_ASPECT;
const P = PALETTE;
const TAU = Math.PI * 2;

/** Stroke counts at High (§4.4, §7.2). SWIRL = arms + shell <= 33,000; EDDY = arms + shell <= 6,000. */
export const SKY_COUNTS = {
  underpaintRows: 60,
  underpaintCols: 50, // 3,000 over GEN_U x GEN_V
  underpaintExt: 3000, // at most, over SKY_GEN_U x SKY_GEN_V outside GEN, above the rear ridge
  band: 32000, // over GEN_U x [0.25, GEN_V[1]]
  bandExt: 12000, // at most, over SKY_GEN_U x SKY_GEN_V outside GEN, above the rear ridge
  swirl: [16000, 14000] as readonly number[], // c1, c2 arm strokes (2 arms each)
  swirlShell: [1600, 1400] as readonly number[], // UNDERLAYER funnel shell, 3,000
  eddy: 6000, // split over E1..E4 by rmax^2
  eddyShell: 0, // eddy arms overlap (pitch ratio 1.37 < 1.2/0.8), so they need no shell
  jetFilaments: 32,
  jetPerFilament: 75, // 2,400
} as const;

/** Swirl colour ramp, throat -> mouth (§4.4). */
const SWIRL_RAMP = [P.zincWhite, P.blueGreen, P.cerulean, P.cobalt, P.ultramarine] as const;
const EDDY_RAMP = [P.zincWhite, P.cerulean, P.cobalt] as const;
/** Band palette (§4.4): cobalt / cerulean / zinc white, each with a two-tone partner. */
const BAND_PAIRS: readonly (readonly number[])[] = [
  [P.cobalt, P.ultramarine, 0x22449e],
  [P.cerulean, P.cobalt, 0x4a77a8],
  [P.zincWhite, P.cerulean, P.blueGreen],
];

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const clamp01 = (x: number) => clamp(x, 0, 1);
const wrapPi = (a: number) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const fract = (x: number) => x - Math.floor(x);

// Quantised, memoised palette maths: mixHex / shadeHex cost ~9 pow() each; generation calls them ~100k times.
const mixCache = new Map<number, Float64Array>();
/** mixHex(a, b, t) with t quantised to 1/128 (colour error < 0.4 %). */
function mixQ(a: number, b: number, t: number): number {
  const key = a * 16777216 + b;
  let arr = mixCache.get(key);
  if (!arr) {
    arr = new Float64Array(129).fill(-1);
    mixCache.set(key, arr);
  }
  const q = Math.round(clamp01(t) * 128);
  if (arr[q] < 0) arr[q] = mixHex(a, b, q / 128);
  return arr[q];
}
const shadeCache = new Map<number, Float64Array>();
/** shadeHex(hex, k) for k in [0, 2], quantised to 1/128. */
function shadeQ(hex: number, k: number): number {
  let arr = shadeCache.get(hex);
  if (!arr) {
    arr = new Float64Array(257).fill(-1);
    shadeCache.set(hex, arr);
  }
  const q = Math.round(clamp(k, 0, 2) * 128);
  if (arr[q] < 0) arr[q] = shadeHex(hex, q / 128);
  return arr[q];
}
const rampCache = new Map<readonly number[], Float64Array>();
/** rampHex over a fixed stop list, 256-entry lookup table. */
function rampQ(stops: readonly number[], t: number): number {
  let lut = rampCache.get(stops);
  if (!lut) {
    lut = new Float64Array(256);
    for (let i = 0; i < 256; i++) lut[i] = rampHex(stops, i / 255);
    rampCache.set(stops, lut);
  }
  return lut[Math.round(clamp01(t) * 255)];
}

function blank(cls: StrokeClass): StrokeRecord {
  return {
    u: 0, v: 0, d: 0, cls, flags: StrokeFlag.NONE, du: 0, dv: 0, dlnd: 0, w: 0,
    colA: 0, colB: 0, emissive: 0, seed: 0, kappa: 0, q1: 0, q2: 0, q3: 0,
  };
}

const fTmp = [0, 0];
function flowAngle(x: number, y: number): number {
  flowField(x, y, fTmp);
  return Math.atan2(fTmp[1], fTmp[0]);
}

/**
 * Bow of a stroke of length L (h-units) centred at (x, y) along angle a, from the turn of the flow field over the
 * stroke (2-sample difference). kappa = sagitta / (0.25 L) = 0.5 * turn angle (M3 spine law).
 */
function fieldKappa(x: number, y: number, a: number, L: number): number {
  const hx = 0.5 * L * Math.cos(a);
  const hy = 0.5 * L * Math.sin(a);
  const turn = wrapPi(flowAngle(x + hx, y + hy) - flowAngle(x - hx, y - hy));
  return clamp(0.5 * turn, -0.6, 0.6);
}

/**
 * The band direction sampled on a 0.0125 h grid over the band region and interpolated (unit vectors, bilinear):
 * ~13k exact evaluations instead of ~96k (direction + 2-sample bow per stroke), to keep generation near the
 * 70 ms budget. The finest band-region features of the field (star halos, R >= 0.041 h) span 6+ cells.
 */
interface DirGrid { x0: number; y0: number; h: number; nx: number; ny: number; c: Float32Array; s: Float32Array }
function buildDirGrid(): DirGrid {
  const h = 0.0125;
  const x0 = GEN_U[0] * A - 0.05;
  const y0 = BAND_V0 - 0.05;
  const nx = Math.ceil((GEN_U[1] * A + 0.05 - x0) / h) + 1;
  const ny = Math.ceil((GEN_V[1] + 0.05 - y0) / h) + 1;
  const c = new Float32Array(nx * ny);
  const s = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = bandAngleExact(x0 + i * h, y0 + j * h);
      c[j * nx + i] = Math.cos(a);
      s[j * nx + i] = Math.sin(a);
    }
  }
  return { x0, y0, h, nx, ny, c, s };
}
function gridAngle(g: DirGrid, x: number, y: number): number {
  const fx = clamp((x - g.x0) / g.h, 0, g.nx - 1.001);
  const fy = clamp((y - g.y0) / g.h, 0, g.ny - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const k = j * g.nx + i;
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  const cx = g.c[k] * w00 + g.c[k + 1] * w10 + g.c[k + g.nx] * w01 + g.c[k + g.nx + 1] * w11;
  const sy = g.s[k] * w00 + g.s[k + 1] * w10 + g.s[k + g.nx] * w01 + g.s[k + g.nx + 1] * w11;
  return Math.atan2(sy, cx);
}
/** Inside a great-swirl throat the strokes curl exactly around the axis (the grid cannot resolve the centre). */
function throatAngle(x: number, y: number): number | null {
  for (let vi = 0; vi < 2; vi++) {
    const V = VORTICES[vi];
    const dx = x - V.u * A;
    const dy = y - V.v;
    const l = Math.hypot(dx, dy);
    if (l < 1.3 * V.r0) {
      const sg = Math.sign(V.gamma);
      return l < 1e-9 ? 0 : Math.atan2(dx * sg, -dy * sg);
    }
  }
  return null;
}
function bandAngle(g: DirGrid, x: number, y: number): number {
  return throatAngle(x, y) ?? gridAngle(g, x, y);
}
/** fieldKappa for band strokes, using the vortex-aware band direction. */
function bandKappa(g: DirGrid, x: number, y: number, a: number, L: number): number {
  const hx = 0.5 * L * Math.cos(a);
  const hy = 0.5 * L * Math.sin(a);
  return clamp(0.5 * wrapPi(bandAngle(g, x + hx, y + hy) - bandAngle(g, x - hx, y - hy)), -0.6, 0.6);
}

// ------------------------------------------------------------------ extended sky (SKY_GEN_U x SKY_GEN_V outside GEN)
// UNDERPAINT and SKY_BAND continue over the extended extent so wide-FOV shots near E see painted sky instead of the
// generated-canvas rectangle. Inside GEN nothing changes (same seeds, same strokes); outside it the strokes grow and
// thin out with the distance from the GEN rectangle, and the M3 stroke shader dissolves them within SKY_EDGE_FADE of
// the extent edge, where the backdrop (same palette, stripes and angular stroke size) takes over.
const GX0 = GEN_U[0] * A;
const GX1 = GEN_U[1] * A;
const GY1 = GEN_V[1];
const SX0 = SKY_GEN_U[0] * A;
const SX1 = SKY_GEN_U[1] * A;
const SY0 = SKY_GEN_V[0];
const SY1 = SKY_GEN_V[1];

/** h-unit distance of flow-space point (x, y) = (u A, v) outside the GEN rectangle (0 inside it). */
export function genDistance(x: number, y: number): number {
  const dx = Math.max(GX0 - x, 0, x - GX1);
  const dy = Math.max(0, GEN_V[0] - y, y - GY1);
  return Math.hypot(dx, dy);
}
const inGen = (x: number, y: number) => x >= GX0 && x <= GX1 && y >= GEN_V[0] && y <= GY1;
const inSkyExt = (x: number, y: number) => x >= SX0 && x <= SX1 && y >= SY0 && y <= SY1;

export interface ExtFalloff {
  /** stroke scale s = min(sMax, 1 + delta / grow) */
  grow: number; sMax: number;
  /** relative coverage cov = covMin + (1 - covMin) exp(-delta / covLen); density = rho0 cov / s^2 */
  covMin: number; covLen: number;
}
/**
 * Falloff outside GEN (delta = h-units outside the GEN rectangle). Bands: the layer count relaxes quickly from the
 * GEN value (~5.6) to 2.5 (covMin 0.45, within ~0.15 h) while the strokes grow slowly and linearly to x3.5 at 0.85 h
 * (the full side-strip width), so the GEN edge shows no size step: ~12,300 seeds over the 3.75 h^2 of extended sky,
 * trimmed to SKY_COUNTS.bandExt. Underpaint: x1.6 strokes from 0.84 h out at the GEN coverage (~3.2 layers).
 */
export const SKY_EXT_FALLOFF: { band: ExtFalloff; underpaint: ExtFalloff } = {
  band: { grow: 0.34, sMax: 3.5, covMin: 0.45, covLen: 0.06 },
  underpaint: { grow: 1.4, sMax: 1.6, covMin: 1, covLen: 1 },
};
export function extScale(f: ExtFalloff, delta: number): number {
  return Math.min(f.sMax, 1 + delta / f.grow);
}
function extDensity(f: ExtFalloff, rho0: number, delta: number): number {
  const s = extScale(f, delta);
  return (rho0 * (f.covMin + (1 - f.covMin) * Math.exp(-delta / f.covLen))) / (s * s);
}

/**
 * Variable-density stratified seeds over the extended extent outside GEN (flow-space x, y and delta). A 2:1 coarse grid
 * (0.1 x 0.05 h, aligned to the GEN edges) is split per cell into k x k jittered sub-cells, k from the cell's peak
 * density; a sub-cell keeps its seed when its R2 dither threshold is below density(sub-cell) * area, so the density
 * is smooth across cells and the kept seeds stay evenly spread (no Poisson clumps or gaps). At most N seeds (a
 * uniform random subset if over).
 */
function extSeeds(N: number, f: ExtFalloff, rho0: number, accept: (x: number, y: number) => boolean, rng: Rng): [number, number, number][] {
  const CX = 0.1;
  const CY = 0.05;
  const i0 = Math.floor((SX0 - GX0) / CX);
  const i1 = Math.ceil((SX1 - GX0) / CX);
  const j0 = Math.floor((SY0 - GY1) / CY);
  const j1 = Math.ceil((SY1 - GY1) / CY);
  const seeds: [number, number, number][] = [];
  for (let j = j0; j < j1; j++) {
    const y0 = GY1 + j * CY;
    for (let i = i0; i < i1; i++) {
      const x0 = GX0 + i * CX;
      if (x0 >= GX0 - 1e-9 && x0 + CX <= GX1 + 1e-9 && y0 + CY <= GY1 + 1e-9) continue; // inside GEN (GEN generators)
      // peak density of the cell: at its point nearest GEN (centre distance minus the half-diagonal 0.056 h)
      const peak = extDensity(f, rho0, Math.max(0, genDistance(x0 + 0.5 * CX, y0 + 0.5 * CY) - 0.056)) * CX * CY;
      const k = Math.max(1, Math.ceil(Math.sqrt(Math.max(peak, 1e-6))));
      const sw = CX / k;
      const sh = CY / k;
      const phase = rng.next();
      for (let b = 0; b < k; b++) {
        for (let a = 0; a < k; a++) {
          // R2 low-discrepancy threshold (not a coin flip): any kept fraction of the sub-cells is evenly spread, so the
          // thinned field keeps the stratified grid's even coverage instead of Poisson gaps
          const keep = fract(phase + a * 0.7548776662 + b * 0.5698402910);
          const x = x0 + (a + rng.next()) * sw;
          const y = y0 + (b + rng.next()) * sh;
          if (!inSkyExt(x, y) || inGen(x, y) || !accept(x, y)) continue;
          const delta = genDistance(x, y);
          if (keep < extDensity(f, rho0, delta) * sw * sh) seeds.push([x, y, delta]);
        }
      }
    }
  }
  if (seeds.length > N) {
    for (let i = seeds.length - 1; i > 0; i--) {
      const k = rng.int(i + 1);
      const tmp = seeds[i];
      seeds[i] = seeds[k];
      seeds[k] = tmp;
    }
    seeds.length = N;
  }
  return seeds;
}

/** Coarse (0.04 h) band-direction grid over the whole extended extent; outside GEN the field is the smooth band/hill flow. */
let extGridCache: DirGrid | null = null;
function extDirGrid(): DirGrid {
  if (extGridCache) return extGridCache;
  const h = 0.04;
  const x0 = SX0 - 0.08;
  const y0 = SY0 - 0.08;
  const nx = Math.ceil((SX1 + 0.08 - x0) / h) + 1;
  const ny = Math.ceil((SY1 + 0.08 - y0) / h) + 1;
  const c = new Float32Array(nx * ny);
  const s = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = bandAngleExact(x0 + i * h, y0 + j * h);
      c[j * nx + i] = Math.cos(a);
      s[j * nx + i] = Math.sin(a);
    }
  }
  extGridCache = { x0, y0, h, nx, ny, c, s };
  return extGridCache;
}
/** fieldKappa from a direction grid (2-sample turn over the stroke). */
function gridKappa(g: DirGrid, x: number, y: number, a: number, L: number): number {
  const hx = 0.5 * L * Math.cos(a);
  const hy = 0.5 * L * Math.sin(a);
  return clamp(0.5 * wrapPi(gridAngle(g, x + hx, y + hy) - gridAngle(g, x - hx, y - hy)), -0.6, 0.6);
}

/**
 * Same bow from the arm law, closed form: every funnel stroke lies on its log spiral (across = 0, see armOnCone),
 * whose curvature is 1 / (r sqrt(1 + beta^2)); the stroke turns CCW for a clockwise vortex (theta grows with sigma).
 */
function armKappa(vi: number, r: number, L: number): number {
  const V = VORTICES[vi];
  const turn = (-Math.sign(V.gamma) * L) / (r * Math.sqrt(1 + V.beta * V.beta));
  return clamp(0.5 * turn, -0.6, 0.6);
}

// ------------------------------------------------------------------ UNDERPAINT (230-250 km)
/** Night-earth underpainting (FIELD / VILLAGE rows, hidden from E by the ground): deep ultramarine-Prussian. */
const NIGHT_EARTH = 0x14275a;

/** Underpaint sky colour: ultramarine near the horizon -> Prussian at the top (§4.4 "sky #1b2f6e -> #0b1a3a"). */
function underpaintSky(v: number, rng: Rng): [number, number] {
  const t = clamp01(0.15 + 0.75 * (v - 0.35) / 0.75 + rng.range(-0.2, 0.2));
  return [mixQ(P.ultramarine, P.prussian, t), mixQ(P.ultramarine, P.prussian, t + rng.range(-0.35, 0.35))];
}

/**
 * Brick-grid-jittered dark ground over the whole generated canvas (3,000 strokes, 230-250 km): L 0.08 h, oriented
 * by the flow field, rows 0.0203 h apart, columns 0.04 h (L overlaps two), odd rows offset half a column, so the
 * sheet closes every hole behind the motifs from E (measured: < 0.001 % of frame pixels uncovered by it alone).
 * Then up to SKY_COUNTS.underpaintExt strokes over the extended sky outside GEN (above the rear ridge), at the same
 * coverage and up to x1.6 larger (SKY_EXT_FALLOFF.underpaint). The GEN sheet is drawn from `rng` first, unchanged.
 */
export function generateUnderpaint(sink: StrokeSink, rng: Rng): void {
  const rows = SKY_COUNTS.underpaintRows;
  const cols = SKY_COUNTS.underpaintCols;
  const x0 = GEN_U[0] * A;
  const x1 = GEN_U[1] * A;
  const y0 = GEN_V[0];
  const y1 = GEN_V[1];
  const cw = (x1 - x0) / cols;
  const rh = (y1 - y0) / rows;
  const L = 0.08;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + (c + 0.5 + 0.5 * (r & 1) + rng.range(-0.15, 0.15)) * cw;
      const y = y0 + (r + 0.5 + rng.range(-0.12, 0.12)) * rh;
      const u = x / A;
      const v = y;
      const a = flowAngle(x, y);
      const rec = blank(StrokeClass.UNDERPAINT);
      rec.u = u;
      rec.v = v;
      rec.d = rng.range(230500, 249500);
      rec.du = L * Math.cos(a);
      rec.dv = L * Math.sin(a);
      // §4.4 says W 0.03; the M3 ribbon tapers to ~0.6 W, so 0.03 leaves pin holes between the 0.0203 h rows
      rec.w = rng.range(0.038, 0.044);
      rec.kappa = fieldKappa(x, y, a, L);
      rec.seed = rng.next();
      const reg = regionAt(u, v);
      let ca: number;
      let cb: number;
      if (reg === Region.SKY) {
        [ca, cb] = underpaintSky(v, rng);
      } else if (reg === Region.HILL) {
        ca = mixQ(P.prussian, P.ultramarine, rng.range(0.2, 0.7));
        cb = P.prussian;
      } else if (reg === Region.CYPRESS) {
        // behind the cypress (hidden from E by its strokes and core, and by the bands above the ridge): the sky or the
        // night earth it stands in, not a green strip that shows across the sheet off-axis. One rng draw, as before.
        const sky = v >= ridgeV(u, 2);
        const deep = sky ? mixQ(P.ultramarine, P.prussian, clamp01(0.15 + (v - 0.35))) : NIGHT_EARTH;
        ca = rng.next() < 0.6 ? deep : P.prussian;
        cb = ca === P.prussian ? deep : P.prussian;
      } else {
        // fields and village: night earth (the same single rng draw as before, so every other stroke is unchanged)
        ca = rng.next() < 0.6 ? NIGHT_EARTH : P.prussian;
        cb = ca === P.prussian ? NIGHT_EARTH : P.prussian;
      }
      rec.colA = packSrgb(ca);
      rec.colB = packSrgb(cb);
      sink.push(rec);
    }
  }

  // extended sky: same law, larger strokes away from GEN, direction and bow from the coarse extended grid
  const f = SKY_EXT_FALLOFF.underpaint;
  const rho0 = (rows * cols) / ((x1 - x0) * (y1 - y0));
  const grid = extDirGrid();
  const accept = (x: number, y: number) => y >= ridgeV(x / A, 2) - 0.03;
  for (const [x, y, delta] of extSeeds(SKY_COUNTS.underpaintExt, f, rho0, accept, rng)) {
    const s = extScale(f, delta);
    const a = gridAngle(grid, x, y);
    const Ls = L * s;
    const rec = blank(StrokeClass.UNDERPAINT);
    rec.u = x / A;
    rec.v = y;
    rec.d = rng.range(230500, 249500);
    rec.du = Ls * Math.cos(a);
    rec.dv = Ls * Math.sin(a);
    rec.w = rng.range(0.038, 0.044) * s;
    rec.kappa = gridKappa(grid, x, y, a, Ls);
    rec.seed = rng.next();
    let ca: number;
    let cb: number;
    if (y >= ridgeV(x / A, 2)) {
      [ca, cb] = underpaintSky(y, rng);
    } else {
      ca = mixQ(P.prussian, P.ultramarine, rng.range(0.2, 0.7));
      cb = P.prussian;
    }
    rec.colA = packSrgb(ca);
    rec.colB = packSrgb(cb);
    sink.push(rec);
  }
}

// ------------------------------------------------------------------ SKY_BAND decks (96-190 km)
/**
 * Band-colour choice (§4.4): band = fract(7 (v + 0.03 sin(4 u A))) picks cobalt / cerulean / zinc white.
 * v is replaced by the band stream function psi = y - 0.022 sin(4x + 9y) - 0.012 sin(9.3x - 5y + 1.7) (§3), whose
 * streamlines the strokes follow, so the colour stripes wave with the brushwork instead of lying dead level.
 */
function bandColours(u: number, v: number, rng: Rng): [number, number] {
  const x = u * A;
  const psi = v - 0.022 * Math.sin(4 * x + 9 * v) - 0.012 * Math.sin(9.3 * x - 5 * v + 1.7);
  const band = fract(7 * (psi + 0.03 * Math.sin(4 * x)) + 0.1 * rng.normal());
  // weights ~0.50 / 0.34 / 0.16 in the middle sky; paler just above the ridge, deeper toward the top edge
  const ridge = ridgeV(u, 2);
  const low = 1 - clamp01((v - ridge) / 0.16);
  const high = clamp01((v - 0.88) / 0.22);
  const wCob = 0.5 - 0.18 * low + 0.14 * high;
  const wCer = 0.34 + 0.04 * low - 0.06 * high;
  const k = band < wCob ? 0 : band < wCob + wCer ? 1 : 2;
  const pair = BAND_PAIRS[k];
  let ca = pair[0];
  let cb = pair[1 + (rng.next() < 0.5 ? 0 : 1)];
  if (k === 0 && high > 0 && rng.next() < 0.5 * high) ca = mixQ(P.cobalt, P.ultramarine, 0.6);
  if (low > 0.5 && rng.next() < 0.3 * low) cb = P.blueGreen;
  // a little per-stroke value jitter keeps the stripes painterly
  const j = rng.range(0.9, 1.06);
  ca = shadeQ(ca, j);
  return [ca, cb];
}

/** Deck index b (0..13) for a canvas row: coherent with v (shingled strata), +-2 decks of scatter. */
function deckIndex(v: number, rng: Rng): number {
  return clamp(Math.round((13 * (v - 0.34)) / 0.76 + 1.8 * rng.normal()), 0, 13);
}

/**
 * Inside a vortex disc (r < 0.7 rmax), where the funnel strokes own the canvas. The open throat (r < 1.3 r0, where
 * the arms fade out) is left to the bands so from E the eye of each vortex is painted, not a hole to the ground.
 * Eddies keep bands down to 0.45 rmax (their ~1,500 strokes each thin out toward the rim, density ~ 1/r^2) and
 * inside 2.5 r0 (their throat strokes are ~4 px from E, under M3's lower screen-size fade, which left dark holes).
 */
function inVortexDisc(x: number, y: number): boolean {
  for (let i = 0; i < VORTICES.length; i++) {
    const V = VORTICES[i];
    const dx = x - V.u * A;
    const dy = y - V.v;
    const r2 = dx * dx + dy * dy;
    const ro = (i < 2 ? 0.7 : 0.45) * V.rmax;
    const ri = (i < 2 ? 1.3 : 2.5) * V.r0;
    if (r2 < ro * ro && r2 > ri * ri) return true;
  }
  return false;
}

/** Inside the open throat (r < 1.3 r0) of one of the two great swirls. */
function inThroat(x: number, y: number): boolean {
  for (let vi = 0; vi < 2; vi++) {
    const V = VORTICES[vi];
    if (Math.hypot(x - V.u * A, y - V.v) < 1.3 * V.r0) return true;
  }
  return false;
}

/**
 * Band stroke direction: the flow field, except around a vortex disc where the band stream cancels the vortex's
 * own circulation (under c1, whose clockwise flow runs against the bands; over c2) and only the radial sink is
 * left. There the strokes would bristle radially; instead they blend toward the vortex tangent, weighted by how
 * close (r < 1.7 rmax) and how radial the field is, so they keep wrapping the swirl as in the painting.
 */
function bandAngleExact(x: number, y: number): number {
  flowField(x, y, fTmp);
  let m = Math.hypot(fTmp[0], fTmp[1]);
  let fx = m > 1e-6 ? fTmp[0] / m : 1;
  let fy = m > 1e-6 ? fTmp[1] / m : 0;
  for (const V of VORTICES) {
    const dx = x - V.u * A;
    const dy = y - V.v;
    const l = Math.hypot(dx, dy);
    const rr = l / V.rmax;
    if (rr >= 1.7 || l < 1e-9) continue;
    let tx = -dy / l;
    let ty = dx / l;
    if (tx * fx + ty * fy < 0) { tx = -tx; ty = -ty; }
    const radial = Math.abs((fx * dx + fy * dy) / l);
    const eye = l < 1.3 * V.r0 ? 1 : 0; // the open throat: a tight curl
    const k = Math.max(eye, smoothstep(1.7, 1.0, rr) * smoothstep(0.35, 0.9, radial));
    fx = fx * (1 - k) + tx * k;
    fy = fy * (1 - k) + ty * k;
    m = Math.hypot(fx, fy) || 1;
    fx /= m;
    fy /= m;
  }
  // star and moon halos: same treatment, so the halo ground under the M5 rings is concentric
  for (const [hx, hy, R] of HALOS) {
    const dx = x - hx;
    const dy = y - hy;
    const l = Math.hypot(dx, dy);
    const rr = l / R;
    if (rr >= 1.25 || l < 1e-9) continue;
    let tx = -dy / l;
    let ty = dx / l;
    if (tx * fx + ty * fy < 0) { tx = -tx; ty = -ty; }
    const radial = Math.abs((fx * dx + fy * dy) / l);
    const k = smoothstep(1.25, 0.9, rr) * smoothstep(0.25, 0.8, radial);
    fx = fx * (1 - k) + tx * k;
    fy = fy * (1 - k) + ty * k;
    m = Math.hypot(fx, fy) || 1;
    fx /= m;
    fy /= m;
  }
  return Math.atan2(fy, fx);
}

/** Halo discs (h-units centre, outer radius) of the 11 stars and the moon, from the shared flow-field radii. */
const HALOS: readonly (readonly [number, number, number])[] = [
  ...STARS.map((st, i) => [st.u * A, st.v, Math.abs(starHaloSigned(i))] as const),
  [MOON_DEF.u * A, MOON_DEF.v, MOON_HALO_R] as const,
];

const BAND_V0 = 0.25;
const bandAccept = (u: number, v: number) => v >= ridgeV(u, 2) - 0.012 && !inVortexDisc(u * A, v);

/**
 * Stratified band seeds: one jittered seed per 2:1 cell (wide, like the strokes) over the accepted sky, sized so
 * the grid yields slightly fewer than N, topped up with uniform rejection samples. Compared with pure random
 * seeding this removes the Poisson thin spots (sky pixels under 3 layers from E).
 */
function bandSeeds(N: number, rng: Rng): [number, number][] {
  const u0 = GEN_U[0], u1 = GEN_U[1], v0 = BAND_V0, v1 = GEN_V[1];
  let hit = 0;
  const PU = 120, PV = 60;
  for (let i = 0; i < PU; i++) {
    for (let j = 0; j < PV; j++) if (bandAccept(u0 + ((i + 0.5) / PU) * (u1 - u0), v0 + ((j + 0.5) / PV) * (v1 - v0))) hit++;
  }
  const area = (u1 - u0) * A * (v1 - v0) * (hit / (PU * PV)); // h-units^2
  const ch = Math.sqrt(area / (2 * N * 1.02));
  const cw = 2 * ch;
  const nx = Math.ceil(((u1 - u0) * A) / cw);
  const ny = Math.ceil((v1 - v0) / ch);
  const seeds: [number, number][] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const u = (u0 * A + (i + rng.next()) * cw) / A;
      const v = v0 + (j + rng.next()) * ch;
      if (u <= u1 && v <= v1 && bandAccept(u, v)) seeds.push([u, v]);
    }
  }
  for (let i = seeds.length - 1; i > 0; i--) {
    const k = rng.int(i + 1);
    const tmp = seeds[i];
    seeds[i] = seeds[k];
    seeds[k] = tmp;
  }
  if (seeds.length > N) seeds.length = N;
  let guard = 0;
  while (seeds.length < N && guard++ < N * 20) {
    const u = rng.range(u0, u1);
    const v = rng.range(v0, v1);
    if (bandAccept(u, v)) seeds.push([u, v]);
  }
  if (seeds.length < N) throw new Error(`generateBands: only ${seeds.length} of ${N} seeds`);
  return seeds;
}

/**
 * 32,000 BAND strokes (§4.4) seeded over the sky, down to just under the rear crest (which the hill walls hide
 * from E), outside the vortex discs. Star/moon halo areas are deliberately kept (lead: "leave their halo areas to
 * the band field"): the strokes circle there and become the concentric ground under the M5 rings. Depth is the
 * deck law d = 100 km + 6.5 km b + 12 km (v - 0.6) +- 1.5 km with b coherent in v (shingled tilted strata).
 */
export function generateBands(sink: StrokeSink, rng: Rng): void {
  const grid = buildDirGrid();
  for (const [u, v] of bandSeeds(SKY_COUNTS.band, rng)) {
    const x = u * A;
    const y = v;
    const a = bandAngle(grid, x, y);
    // longer strokes in the strong bands of the stream function (bandFlow strength term)
    const strength = 0.62 + 0.38 * Math.sin(TAU * 7 * y + 1.3 * Math.sin(2.1 * x));
    const L = 0.025 + 0.035 * clamp01(0.55 * (strength - 0.24) / 0.76 + 0.45 * rng.next());
    const rec = blank(StrokeClass.SKY_BAND);
    rec.u = u;
    rec.v = v;
    const b = deckIndex(v, rng);
    rec.d = 100000 + 6500 * b + 12000 * (v - 0.6) + rng.range(-1500, 1500);
    rec.du = L * Math.cos(a);
    rec.dv = L * Math.sin(a);
    rec.dlnd = (12000 * rec.dv) / rec.d; // the stroke lies in its tilted deck
    rec.w = rng.range(0.006, 0.01);
    rec.kappa = bandKappa(grid, x, y, a, L);
    let [ca, cb] = bandColours(u, v, rng);
    if (inThroat(x, y)) {
      // the eye of each vortex is painted pale like the swirl core: short curled dabs that follow the eye's rotation
      // (full-length band sticks would lie across the small eye as straight chords)
      ca = rng.next() < 0.15 ? mixQ(P.zincWhite, P.lemon, 0.3) : rampQ(SWIRL_RAMP, rng.range(0, 0.35));
      cb = rampQ(SWIRL_RAMP, rng.range(0.15, 0.5));
      const V = VORTICES[Math.hypot(x - VORTICES[0].u * A, y - VORTICES[0].v) < 1.3 * VORTICES[0].r0 ? 0 : 1];
      const dx = x - V.u * A, dy = y - V.v;
      const ta = Math.atan2(dy, dx) + Math.sign(V.gamma) * (Math.PI / 2) + rng.range(-0.25, 0.25);
      const Lt = rng.range(0.4, 0.65) * 1.3 * V.r0;
      rec.du = Lt * Math.cos(ta);
      rec.dv = Lt * Math.sin(ta);
      rec.dlnd = (12000 * rec.dv) / rec.d;
      rec.w = rng.range(0.004, 0.007);
      rec.kappa = Math.sign(V.gamma) * rng.range(0.15, 0.35);
    }
    rec.colA = packSrgb(ca);
    rec.colB = packSrgb(cb);
    rec.seed = rng.next();
    rec.q1 = 0.35;
    rec.q2 = rng.int(4);
    rec.q3 = rng.next();
    sink.push(rec);
  }
  generateBandsExt(sink, rng);
}

/** Deck depth law (§2.4) kept inside the SKY_BAND dRange. */
function deckDepth(v: number, b: number, rng: Rng): number {
  const [lo, hi] = CLASS_INFO[StrokeClass.SKY_BAND].dRange;
  return clamp(100000 + 6500 * b + 12000 * (v - 0.6) + rng.range(-1500, 1500), lo + 500, hi - 500);
}

/**
 * Up to SKY_COUNTS.bandExt band strokes over the extended sky outside GEN, above the rear ridge: the same stream
 * direction, stripes, palette, deck depths and slide animation, scaled up by s(delta) and thinned by
 * SKY_EXT_FALLOFF.band. The GEN density continues across the GEN edge (s = 1, full coverage at delta = 0).
 */
function generateBandsExt(sink: StrokeSink, rng: Rng): void {
  const f = SKY_EXT_FALLOFF.band;
  // the GEN band density, measured the way bandSeeds sizes its grid
  const u0 = GEN_U[0], u1 = GEN_U[1], v0 = BAND_V0, v1 = GEN_V[1];
  let hit = 0;
  const PU = 120, PV = 60;
  for (let i = 0; i < PU; i++) {
    for (let j = 0; j < PV; j++) if (bandAccept(u0 + ((i + 0.5) / PU) * (u1 - u0), v0 + ((j + 0.5) / PV) * (v1 - v0))) hit++;
  }
  const rho0 = SKY_COUNTS.band / ((u1 - u0) * A * (v1 - v0) * (hit / (PU * PV)));
  const grid = extDirGrid();
  const accept = (x: number, y: number) => y >= ridgeV(x / A, 2) - 0.012;
  for (const [x, y, delta] of extSeeds(SKY_COUNTS.bandExt, f, rho0, accept, rng)) {
    const s = extScale(f, delta);
    // outside GEN no vortex disc or halo reaches (all lie > 0.1 h inside it): the coarse grid holds the exact field
    const a = gridAngle(grid, x, y);
    const strength = 0.62 + 0.38 * Math.sin(TAU * 7 * y + 1.3 * Math.sin(2.1 * x));
    const L = (0.025 + 0.035 * clamp01(0.55 * (strength - 0.24) / 0.76 + 0.45 * rng.next())) * s;
    const u = x / A;
    const rec = blank(StrokeClass.SKY_BAND);
    rec.u = u;
    rec.v = y;
    rec.d = deckDepth(y, deckIndex(y, rng), rng);
    rec.du = L * Math.cos(a);
    rec.dv = L * Math.sin(a);
    rec.dlnd = (12000 * rec.dv) / rec.d;
    rec.w = rng.range(0.006, 0.01) * s;
    rec.kappa = gridKappa(grid, x, y, a, L);
    const [ca, cb] = bandColours(u, y, rng);
    rec.colA = packSrgb(ca);
    rec.colB = packSrgb(cb);
    rec.seed = rng.next();
    rec.q1 = 0.35;
    rec.q2 = rng.int(4);
    rec.q3 = rng.next();
    sink.push(rec);
  }
}

// ------------------------------------------------------------------ SWIRL / EDDY funnels
interface FunnelStyle {
  cls: StrokeClass;
  /** stroke length law L(r) in h-units */
  len: (r: number) => number;
  colour: (sigma0: number, across: number, rng: Rng) => [number, number];
}

const swirlStyle: FunnelStyle = {
  cls: StrokeClass.SWIRL,
  len: (r) => 0.008 + 0.15 * r, // §4.4
  colour: (sigma0, across, rng) => {
    // Arms read as pale bands: zinc white / blue-green at the arm core, cerulean -> cobalt toward the arm edges,
    // with a gentle throat -> mouth darkening (the §4.4 ramp, compressed so the streaming arms stay pale).
    const a = Math.abs(across);
    const x = clamp(0.02 + 0.55 * a * a + 0.2 * sigma0 + rng.range(-0.12, 0.3), 0, 0.95);
    let ca = rampQ(SWIRL_RAMP, x);
    if (x < 0.25 && rng.next() < 0.08) ca = mixQ(P.zincWhite, P.lemon, rng.range(0.2, 0.45));
    const cb = rampQ(SWIRL_RAMP, x + rng.range(0.06, 0.25));
    return [ca, cb];
  },
};

const eddyStyle: FunnelStyle = {
  cls: StrokeClass.EDDY,
  // the swirl law's 0.008 floor would be 1.5 throat radii at the eddies' r0 = 0.006: scaled down
  len: (r) => 0.004 + 0.22 * r,
  colour: (sigma0, across, rng) => {
    const a = Math.abs(across);
    const x = clamp(0.22 + 0.45 * a * a + 0.15 * sigma0 + rng.range(-0.2, 0.2), 0, 0.95);
    return [rampQ(EDDY_RAMP, x), rampQ(EDDY_RAMP, x + rng.range(0.1, 0.3))];
  },
};

/**
 * Across-arm spread ON the funnel cone. The arm law sets depth from sigma alone, so the record's `across` offset
 * (q3) moves a stroke radially at constant depth: off-axis every arm becomes a radial fin and the funnel reads as
 * twisted threads. A phase offset of the (fractional) arm instead keeps r, sigma and depth on the cone
 * d = dThroat (r/r0)^expo: at fixed r, a turn of dTheta lies beta*dTheta (fraction of r) across the arm, so
 * `across * 0.2 r` maps to dArm = 0.2 across / (beta * PI). Seen from E the arm band is statistically the same.
 * Returns the arm in [0, 2) (decoded by M3 as q1 - 2 floor(q1 / 2)), kept below 1.9995 for float32.
 */
function armOnCone(vi: number, arm: number, across: number): number {
  const a = arm + (0.2 * across) / (VORTICES[vi].beta * Math.PI);
  const w = a - 2 * Math.floor(a / 2);
  return w > 1.9995 ? 0 : w;
}

/** Arm strokes of vortex vi: sigma0 stratified per arm, across ~ N(0, 0.45) clamped (§4.4), laid on the cone. */
function generateArms(sink: StrokeSink, rng: Rng, vi: number, n: number, style: FunnelStyle): void {
  const V = VORTICES[vi];
  const lnR = Math.log(V.rmax / V.r0);
  const perArm = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const across = clamp(0.45 * rng.normal(), -1, 1);
    const arm = armOnCone(vi, i & 1, across);
    const sigma0 = Math.min(0.999999, ((i >> 1) + rng.next()) / perArm);
    const ap = armPoint(vi, arm, sigma0, 0);
    const r = V.r0 * Math.exp(lnR * sigma0);
    const L = style.len(r) * rng.range(0.85, 1.2);
    const rec = blank(style.cls);
    rec.seed = rng.next();
    rec.u = ap.u;
    rec.v = ap.v;
    rec.d = ap.d * (1 + 0.02 * (rec.seed - 0.5)); // = the M3 VORTEX depth at t = 0
    rec.du = L; // VORTEX: a1 = (L, 0, 0, W); the shader recomputes the direction
    rec.w = (L / 4) * rng.range(0.85, 1.15); // §4.4 W = L/5; L/4 keeps the arms solid off-axis (1.4 px at 55 km)
    rec.kappa = armKappa(vi, r, L);
    let [ca, cb] = style.colour(sigma0, across, rng);
    if (Math.abs(across) > 0.8) {
      // arm-edge strokes: 15 % darker and outlined (OUTLINE weight 0.6 from CLASS_INFO)
      ca = shadeQ(ca, 0.85);
      cb = shadeQ(cb, 0.85);
      rec.flags = StrokeFlag.OUTLINE;
    }
    rec.colA = packSrgb(ca);
    rec.colB = packSrgb(cb);
    rec.q1 = vi * 2 + arm;
    rec.q2 = sigma0;
    rec.q3 = 0; // across is carried by the arm phase (see armOnCone)
    sink.push(rec);
  }
}

/**
 * Funnel shell (UNDERLAYER): deep-blue strokes on the funnel cone half a turn between the arms
 * (arm = 0.5 / 1.5 with a small on-cone spread, q3 = 0). M3 draws them flat at width x3 and depth x1.01, so seen
 * off-axis the funnel wall is a continuous flaring surface and from E they only fill the gaps between the arms.
 */
function generateShell(sink: StrokeSink, rng: Rng, vi: number, n: number, style: FunnelStyle): void {
  const V = VORTICES[vi];
  const lnR = Math.log(V.rmax / V.r0);
  const perArm = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const arm = armOnCone(vi, (i & 1) + 0.5, rng.range(-0.35, 0.35));
    const sigma0 = Math.min(0.999999, ((i >> 1) + rng.next()) / perArm);
    const ap = armPoint(vi, arm, sigma0, 0);
    const r = V.r0 * Math.exp(lnR * sigma0);
    const L = style.len(r) * 1.3;
    const rec = blank(style.cls);
    rec.flags = StrokeFlag.UNDERLAYER;
    rec.seed = rng.next();
    rec.u = ap.u;
    rec.v = ap.v;
    rec.d = ap.d * (1 + 0.02 * (rec.seed - 0.5)) * 1.01; // depth +1 % (applied by the M3 shader for UNDERLAYER)
    rec.du = L;
    rec.w = style.len(r) / 5; // x3 in the shader
    rec.kappa = armKappa(vi, r, L);
    // ultramarine / cobalt over Prussian (spec #0b1a3a read as black bands from E): the deep-blue paint between
    // the pale arms
    rec.colA = packSrgb(mixQ(P.ultramarine, P.cobalt, rng.range(0.2, 0.7)));
    rec.colB = packSrgb(mixQ(P.prussian, P.cobalt, rng.range(0.45, 0.8)));
    rec.q1 = vi * 2 + arm;
    rec.q2 = sigma0;
    rec.q3 = 0;
    sink.push(rec);
  }
}

export function generateFunnels(sink: StrokeSink, rng: Rng): void {
  for (let vi = 0; vi < 2; vi++) {
    generateArms(sink, rng, vi, SKY_COUNTS.swirl[vi], swirlStyle);
    generateShell(sink, rng, vi, SKY_COUNTS.swirlShell[vi], swirlStyle);
  }
  const eddies = VORTICES.slice(2);
  const wsum = eddies.reduce((s, V) => s + V.rmax * V.rmax, 0);
  let armLeft = SKY_COUNTS.eddy;
  let shellLeft = SKY_COUNTS.eddyShell;
  for (let k = 0; k < eddies.length; k++) {
    const last = k === eddies.length - 1;
    const w = (eddies[k].rmax * eddies[k].rmax) / wsum;
    const nArm = last ? armLeft : Math.round(SKY_COUNTS.eddy * w);
    const nShell = last ? shellLeft : Math.round(SKY_COUNTS.eddyShell * w);
    armLeft -= nArm;
    shellLeft -= nShell;
    generateArms(sink, rng, k + 2, nArm, eddyStyle);
    generateShell(sink, rng, k + 2, nShell, eddyStyle);
  }
}

// ------------------------------------------------------------------ WIND_JET (220 m -> 12 km)
const JET_TINTS = [P.zincWhite, P.cerulean, P.blueGreen, P.zincWhite, P.cerulean] as const;

/**
 * 32 filaments x 75 strokes along the cypress-tip -> Venus Bezier (§2.4). q1 = sigma0, q2 = filament offset
 * ~ N(0, 0.006) h-units, q3 = depth jitter +-1 %. The M3 shader ramps colour and emissive along sigma; a2.z holds
 * the Venus-end emissive (1.1) and the record colours are the per-filament tint.
 */
export function generateJet(sink: StrokeSink, rng: Rng): void {
  const nF = SKY_COUNTS.jetFilaments;
  const nS = SKY_COUNTS.jetPerFilament;
  const L = 0.012;
  for (let f = 0; f < nF; f++) {
    const off = clamp(0.006 * rng.normal(), -0.02, 0.02);
    const phase = rng.next();
    const tintA = JET_TINTS[f % JET_TINTS.length];
    const tintB = rng.pick(JET_TINTS);
    for (let j = 0; j < nS; j++) {
      const sigma0 = fract(phase + (j + rng.range(-0.3, 0.3)) / nS);
      const jp = jetPoint(sigma0, off);
      const q3 = rng.range(-0.01, 0.01);
      const rec = blank(StrokeClass.WIND_JET);
      rec.u = jp.u;
      rec.v = jp.v;
      rec.d = jp.d * (1 + q3);
      rec.du = L;
      rec.w = 0.003;
      const tl = Math.hypot(jp.tu, jp.tv);
      const ds = (0.5 * L) / Math.max(tl, 1e-9);
      const j0 = jetPoint(Math.max(0, sigma0 - ds), off);
      const j1 = jetPoint(Math.min(1, sigma0 + ds), off);
      rec.kappa = clamp(0.5 * wrapPi(Math.atan2(j1.tv, j1.tu) - Math.atan2(j0.tv, j0.tu)), -0.6, 0.6);
      rec.colA = packSrgb(tintA);
      rec.colB = packSrgb(tintB);
      rec.emissive = 1.1;
      rec.seed = rng.next();
      rec.q1 = sigma0;
      rec.q2 = off;
      rec.q3 = q3;
      sink.push(rec);
    }
  }
}

// ------------------------------------------------------------------ entry point
/**
 * All M4 strokes: UNDERPAINT, SKY_BAND, SWIRL (+ UNDERLAYER shell), EDDY (+ shell), WIND_JET.
 * Deterministic for a given rng: one draw from `rng` seeds an independent stream per class.
 */
export function generateSky(sink: StrokeSink, rng: Rng): void {
  const base = Math.floor(rng.next() * 0x7fffffff);
  generateUnderpaint(sink, forkRng(base, 'sky.underpaint'));
  generateBands(sink, forkRng(base, 'sky.band'));
  generateFunnels(sink, forkRng(base, 'sky.funnel'));
  generateJet(sink, forkRng(base, 'sky.jet'));
}

/** Classes this module emits, with their CLASS_INFO depth ranges (harness assertions). */
export const SKY_CLASSES: readonly StrokeClass[] = [
  StrokeClass.UNDERPAINT, StrokeClass.SKY_BAND, StrokeClass.SWIRL, StrokeClass.EDDY, StrokeClass.WIND_JET,
];
export function skyDepthViolations(records: readonly StrokeRecord[]): string[] {
  const out: string[] = [];
  for (const r of records) {
    const [lo, hi] = CLASS_INFO[r.cls].dRange;
    if (!(r.d >= lo && r.d <= hi)) {
      out.push(`${StrokeClass[r.cls]} d=${r.d.toFixed(0)} outside [${lo}, ${hi}]`);
      if (out.length > 20) break;
    }
  }
  return out;
}
