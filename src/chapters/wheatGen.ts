// Chapter IV: Wheat Field with Cypresses (Saint-Rémy-de-Provence, July 1889), aspect = 1.27.
// The sunlit daytime counterpart to The Starry Night at Saint-Rémy: rolling white & turquoise cumulus cloud vortices
// (39-195 km), sunlit cerulean/cobalt Alpilles ridges (2,000-5,600 m), billowing silver-olive bushes (340-1,650 m),
// the twin dark-emerald cypresses on the right writhing in the Mistral (155-238 m), and the wind-swept sea of golden wheat.
import { Group, Vector3 } from 'three';
import {
  CANVAS_ASPECT, PALETTE, StrokeClass, StrokeFlag, VORTICES,
  type QualitySettings, type Rng, type SharedUniforms, type StrokeSink, type UnderlayMaterialFactory, type VillageInfo,
} from '../contracts';
import { canvasToWorld } from '../shared/canvasSpace';
import { armPoint } from '../shared/flowField';
import { forkRng } from '../shared/rng';
import {
  buildCanvasQuadMesh, clamp, clamp01, emitCanvasStroke, emitSurfaceStroke,
  mixHex, packSrgb, pushChapterStroke, rampHex, shadeHex, smoothstep, uFromPaint,
} from './types';

export const WHEAT_ASPECT = 1.27;
const P = PALETTE;
const TAU = Math.PI * 2;

const CUMULUS_RAMP = [P.zincWhite, 0xf7f3d8, P.blueGreen, P.cerulean, P.cobalt] as const;

/** Alpilles daytime ridge profile vRidge(uP, k) for wall k = 0 (front), 1 (mid), 2 (rear). */
function wheatRidgeV(uP: number, k: number): number {
  const base = 0.29 + 0.045 * k;
  const swell = 0.055 * Math.sin(3.4 * uP + 0.7 * k) + 0.028 * Math.cos(7.8 * uP - 1.1 * k) + 0.015 * Math.sin(13.0 * uP + k);
  // Rise toward the left-center peak as in Van Gogh's Saint-Rémy Alpilles profile
  const peak = 0.05 * Math.exp(-Math.pow((uP - 0.34) / 0.26, 2));
  return base + swell + peak;
}

/** Check if (uP, v) lies inside the right-hand twin cypress silhouette. */
function inRightCypress(uP: number, v: number): boolean {
  if (v < 0.04 || v > 0.96) return false;
  // Main cypress at uP ~ 0.80, companion at uP ~ 0.67
  const tMain = clamp01((v - 0.04) / 0.92);
  const halfMain = 0.075 * Math.pow(1 - 0.82 * tMain, 0.85);
  const cMain = 0.805 + 0.014 * Math.sin(6.5 * v);
  if (Math.abs(uP - cMain) <= halfMain) return true;
  if (v <= 0.68) {
    const tSub = clamp01((v - 0.08) / 0.60);
    const halfSub = 0.046 * Math.pow(1 - 0.8 * tSub, 0.9);
    const cSub = 0.675 + 0.010 * Math.cos(7.0 * v);
    if (Math.abs(uP - cSub) <= halfSub) return true;
  }
  return false;
}

/** 1. Daytime underpaint, turquoise/cerulean sky bands, and billowing white cumulus vortex funnels (SWIRL/EDDY/SKY_BAND). */
function genWheatSky(sink: StrokeSink, rng: Rng): void {
  // A. Sunlit underpainting (230-250 km)
  const rows = 56, cols = 52;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const uP = -0.30 + ((c + 0.5 + 0.3 * (r & 1) + rng.range(-0.18, 0.18)) / cols) * 1.60;
      const v = -0.08 + ((r + 0.5 + rng.range(-0.15, 0.15)) / rows) * 1.18;
      let ca: number, cb: number;
      if (v >= wheatRidgeV(uP, 2) - 0.02) {
        const t = clamp01((v - 0.35) / 0.65);
        ca = mixHex(P.blueGreen, P.cerulean, 0.3 + 0.55 * t);
        cb = mixHex(P.zincWhite, P.cerulean, 0.35 + 0.45 * t);
      } else {
        ca = mixHex(P.ochre, P.chrome, rng.range(0.25, 0.65));
        cb = mixHex(P.ochre, P.grove, 0.4);
      }
      emitCanvasStroke(
        sink, WHEAT_ASPECT, StrokeClass.UNDERPAINT, uP, v, rng.range(231000, 249000),
        0.085, rng.range(-0.18, 0.18), 0.042, ca, cb, rng, { emissive: 0.15 },
      );
    }
  }

  // B. Rolling white & cream cumulus cloud vortices (SWIRL & EDDY, AnimKind.VORTEX, 24,000 strokes)
  const swirlCounts = [11000, 9500];
  for (let vi = 0; vi < VORTICES.length; vi++) {
    const V = VORTICES[vi];
    const isGreat = vi < 2;
    const cls = isGreat ? StrokeClass.SWIRL : StrokeClass.EDDY;
    const n = isGreat ? swirlCounts[vi] : 900;
    const lnR = Math.log(V.rmax / V.r0);
    const perArm = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const across = clamp(0.45 * rng.normal(), -1, 1);
      const aRaw = (i & 1) + (0.2 * across) / (V.beta * Math.PI);
      const arm = aRaw - 2 * Math.floor(aRaw / 2);
      const sigma0 = Math.min(0.999999, ((i >> 1) + rng.next()) / perArm);
      const ap = armPoint(vi, arm > 1.9995 ? 0 : arm, sigma0, 0);
      const r = V.r0 * Math.exp(lnR * sigma0);
      const L = (isGreat ? 0.008 + 0.15 * r : 0.004 + 0.22 * r) * rng.range(0.85, 1.2);
      const turn = (-Math.sign(V.gamma) * L) / (r * Math.sqrt(1 + V.beta * V.beta));
      const xRamp = clamp(0.04 + 0.42 * across * across + 0.22 * sigma0 + rng.range(-0.1, 0.22), 0, 0.92);
      const ca = rampHex(CUMULUS_RAMP, xRamp);
      const cb = rampHex(CUMULUS_RAMP, clamp01(xRamp + rng.range(0.08, 0.24)));
      pushChapterStroke(sink, {
        u: ap.u,
        v: ap.v,
        d: ap.d * (1 + 0.02 * (rng.next() - 0.5)),
        cls,
        flags: Math.abs(across) > 0.82 ? StrokeFlag.OUTLINE : StrokeFlag.NONE,
        du: L,
        dv: 0,
        dlnd: 0,
        w: (L / 4) * rng.range(0.88, 1.15),
        colA: packSrgb(ca),
        colB: packSrgb(cb),
        emissive: xRamp < 0.35 ? 0.28 : 0.12,
        seed: rng.next(),
        kappa: clamp(0.5 * turn, -0.6, 0.6),
        q1: vi * 2 + (arm > 1.9995 ? 0 : arm),
        q2: sigma0,
        q3: 0,
      });
    }
  }

  // C. Swirling turquoise, cerulean, and zinc-white cumulus sky bands (32,000 strokes in SKY_BAND)
  for (let i = 0; i < 32000; i++) {
    const inCore = i < 25000;
    const uP = inCore ? rng.range(-0.04, 1.04) : rng.range(-0.32, 1.32);
    const vMin = wheatRidgeV(uP, 2) - 0.015;
    const v = rng.range(vMin, 1.08);
    const deck = clamp(Math.floor(((v - 0.32) / 0.76) * 13 + rng.normal() * 1.4), 0, 13);
    const d = 98000 + deck * 6600 + rng.range(-1500, 1500);
    // Billowing cumulus curl wave across the Saint-Rémy sky
    const curl = 0.38 * Math.sin(5.6 * uP + 4.2 * v) + 0.24 * Math.cos(9.2 * uP - 6.5 * v);
    const L = rng.range(0.025, 0.052);
    const w = rng.range(0.0068, 0.0115);
    const cloud = 0.5 + 0.5 * Math.sin(6.2 * v + 1.8 * Math.sin(4.4 * uP) + 0.5 * Math.cos(8.0 * uP + 5.0 * v));
    let ca: number, cb: number, em = 0.12;
    if (cloud > 0.58) {
      // Sunlit white & cream cumulus cloud billow
      ca = mixHex(P.zincWhite, P.lemon, rng.range(0.04, 0.18));
      cb = mixHex(P.zincWhite, P.blueGreen, rng.range(0.15, 0.45));
      em = 0.26;
    } else if (cloud > 0.28) {
      // Turquoise / aquamarine sky current
      ca = mixHex(P.blueGreen, P.cerulean, rng.range(0.15, 0.65));
      cb = mixHex(P.zincWhite, P.blueGreen, rng.range(0.25, 0.6));
      em = 0.16;
    } else {
      // Deeper cerulean-cobalt upper sky trough
      ca = mixHex(P.cerulean, P.cobalt, rng.range(0.2, 0.7));
      cb = P.cerulean;
    }
    emitCanvasStroke(
      sink, WHEAT_ASPECT, StrokeClass.SKY_BAND, uP, v, d, L, curl, w, ca, cb, rng,
      { dlnd: 0.03 * Math.sin(curl), emissive: em, kappa: rng.range(-0.32, 0.32), q1: 0.38, q2: rng.int(4), q3: rng.next() },
    );
  }
}

/** 2. Sunlit blue & violet Alpilles mountain waves (HILL, 14,500 strokes, 2,000-5,600 m). */
function genWheatHills(sink: StrokeSink, rng: Rng): void {
  const nHill = new Vector3(0, 0.45, 0.89).normalize();
  const wallDepths = [2600, 3900, 5200];
  for (let k = 0; k < 3; k++) {
    const nStrokes = k === 0 ? 5200 : k === 1 ? 4800 : 4500;
    for (let i = 0; i < nStrokes; i++) {
      const uP = rng.range(-0.18, 1.18);
      const top = wheatRidgeV(uP, k);
      const bot = k === 0 ? 0.22 : wheatRidgeV(uP, k - 1) - 0.025;
      if (top <= bot) continue;
      const v = rng.range(bot, top);
      const d = wallDepths[k] + 350 * Math.sin(2.8 * uP + k) - 650 * ((top - v) / Math.max(0.05, top - bot));
      const slope = 0.18 * Math.cos(3.4 * uP + 0.7 * k) + rng.range(-0.18, 0.18);
      const tang = new Vector3(Math.cos(slope), Math.sin(slope), -0.15).normalize();
      const crest = v > top - 0.014;
      let ca: number, cb: number;
      if (crest) {
        ca = mixHex(P.ultramarine, P.outline, 0.5);
        cb = P.cobalt;
      } else if (k === 0) {
        ca = mixHex(P.cobalt, P.blueGreen, rng.range(0.25, 0.65));
        cb = mixHex(P.cerulean, P.ultramarine, rng.range(0.2, 0.55));
      } else if (k === 1) {
        ca = mixHex(P.cerulean, P.cobalt, rng.range(0.25, 0.7));
        cb = mixHex(P.blueGreen, P.zincWhite, rng.range(0.15, 0.45));
      } else {
        ca = mixHex(P.cerulean, P.zincWhite, rng.range(0.15, 0.45));
        cb = mixHex(P.cobalt, P.cerulean, 0.5);
      }
      emitSurfaceStroke(
        sink, WHEAT_ASPECT, StrokeClass.HILL, uP, v, d,
        rng.range(0.013, 0.028), rng.range(0.0042, 0.0078),
        tang, nHill, ca, cb, rng,
        { emissive: crest ? 0 : 0.12, flags: crest ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
      );
    }
  }
}

/** 3. Right-hand twin dark-emerald cypresses writhing in the Mistral wind (CYPRESS, 18,500 strokes, 150-238 m). */
function genWheatCypresses(sink: StrokeSink, rng: Rng): void {
  // Main tall cypress on the right (uP ~ 0.805, v in [0.04, 0.95], d in [158, 226] m)
  // + smaller companion cypress just to its left (uP ~ 0.675, v in [0.08, 0.67], d in [195, 238] m)
  for (let i = 0; i < 18500; i++) {
    const main = i < 14200;
    const v = main ? rng.range(0.04, 0.95) : rng.range(0.08, 0.67);
    const tV = main ? clamp01((v - 0.04) / 0.91) : clamp01((v - 0.08) / 0.59);
    const halfW = (main ? 0.074 : 0.044) * Math.pow(1 - 0.82 * tV, 0.85);
    const cU = main
      ? 0.805 + 0.015 * Math.sin(6.5 * v) - 0.018 * Math.pow(tV, 1.6)
      : 0.675 + 0.011 * Math.cos(7.2 * v) - 0.010 * tV;
    const phi = rng.range(0, TAU);
    const uP = cU + halfW * Math.sin(phi) + rng.range(-0.006, 0.006);
    const dAxis = main ? 186 : 216;
    const d = dAxis + 18 * Math.cos(phi) * (1 - 0.5 * tV) + rng.range(-4, 4);
    // Sunlit right/upper flanks carry warm olive, blue-green, and ochre notes; core is deep cypressDark / emerald
    const sunlit = Math.sin(phi + 0.5) > 0.25;
    const r = rng.next();
    let ca: number, cb: number;
    if (r < 0.22 && sunlit) {
      ca = mixHex(P.groveLight, P.lemon, rng.range(0.12, 0.32));
      cb = P.cypressGreen;
    } else if (r < 0.42) {
      ca = mixHex(P.cypressGreen, P.blueGreen, rng.range(0.15, 0.4));
      cb = P.cypressDark;
    } else if (r < 0.56) {
      ca = mixHex(P.cypressDark, P.ochre, rng.range(0.12, 0.28));
      cb = P.cypressGreen;
    } else {
      ca = P.cypressDark;
      cb = mixHex(P.cypressDark, P.ultramarine, 0.35);
    }
    const ang = Math.PI * 0.5 + 0.28 * Math.sin(9.0 * v + phi) + rng.range(-0.18, 0.18);
    const edge = Math.abs(Math.sin(phi)) > 0.84;
    emitCanvasStroke(
      sink, WHEAT_ASPECT, StrokeClass.CYPRESS, uP, v, d,
      rng.range(0.013, 0.030) * (1 - 0.35 * tV), ang, rng.range(0.0042, 0.0072),
      shadeHex(ca, sunlit ? rng.range(0.85, 1.15) : rng.range(0.55, 0.88)),
      shadeHex(cb, rng.range(0.65, 1.0)), rng,
      {
        dlnd: 0.03 * Math.cos(phi),
        flags: edge ? StrokeFlag.OUTLINE : StrokeFlag.NONE,
        q1: i % 7,
        q2: phi,
        q3: 0,
      },
    );
  }
}

/** 4. Wind-swept sea of golden wheat, billowing silver-olive bushes, and cottage accents (GROUND, GROVE, HOUSE). */
function genWheatFieldsAndOlives(sink: StrokeSink, rng: Rng): void {
  const nField = new Vector3(0, 0.94, 0.34).normalize();
  const nBush = new Vector3(0, 0.65, 0.76).normalize();

  // A. The golden wheat field (28,000 wind-bent stalks & swirling swathes in GROUND, d in [205, 1,480] m)
  for (let i = 0; i < 28000; i++) {
    const uP = rng.range(-0.08, 1.08);
    const v = rng.range(-0.07, 0.25);
    if (inRightCypress(uP, v) && rng.next() < 0.7) continue;
    const tV = clamp01((v + 0.07) / 0.32);
    const d = 206 * Math.pow(1450 / 206, tV) + rng.range(-10, 10);
    // Wind-whipped wheat wave angle: stalks bend from vertical toward the right/left in undulating gusts
    const gust = 0.55 * Math.sin(6.5 * uP + 11.0 * v) + 0.35 * Math.cos(14.0 * uP - 8.0 * v);
    const tang = new Vector3(Math.cos(0.45 + gust), 0.35 * Math.sin(0.45 + gust), -0.35).normalize();
    // Foreground green-ochre path on the left-center (uP in [0.05, 0.38], v < 0.08) + wildflowers
    const onPath = v < 0.085 && Math.abs(uP - (0.18 + 1.4 * v)) < 0.055;
    let ca: number, cb: number, em = 0.14;
    if (onPath && rng.next() < 0.65) {
      ca = mixHex(P.groveLight, P.blueGreen, rng.range(0.25, 0.65));
      cb = mixHex(P.ochre, P.lemon, 0.45);
    } else if (v < 0.06 && rng.next() < 0.06) {
      // Wildflower dabs (red-orange poppies & cobalt cornflowers in the foreground)
      ca = rng.next() < 0.55 ? 0xd94826 : P.cobalt;
      cb = P.lemon;
      em = 0.25;
    } else {
      const wave = (9.0 * v + 0.3 * Math.sin(7.0 * uP) + 0.2 * rng.normal()) % 1;
      if (wave < 0.42) {
        ca = mixHex(P.chrome, P.lemon, rng.range(0.2, 0.75));
        cb = mixHex(P.ochre, P.chrome, 0.5);
        em = 0.22;
      } else if (wave < 0.78) {
        ca = mixHex(P.ochre, P.chrome, rng.range(0.2, 0.7));
        cb = mixHex(P.lemon, P.ochre, 0.4);
      } else {
        ca = mixHex(P.lemon, P.zincWhite, rng.range(0.15, 0.45));
        cb = P.chrome;
        em = 0.26;
      }
    }
    emitSurfaceStroke(
      sink, WHEAT_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.032), rng.range(0.0042, 0.0076),
      tang, nField, ca, cb, rng,
      { emissive: em, kappa: rng.range(-0.32, 0.32) },
    );
  }

  // B. Billowing silver-green & blue-green olive bushes across the midground (10,500 strokes in GROVE, d in [340, 1,680] m)
  const bushes: readonly { uP: number; v: number; rU: number; rV: number; d: number }[] = [
    { uP: 0.10, v: 0.22, rU: 0.09, rV: 0.055, d: 520 },
    { uP: 0.24, v: 0.24, rU: 0.11, rV: 0.065, d: 610 },
    { uP: 0.39, v: 0.23, rU: 0.10, rV: 0.060, d: 580 },
    { uP: 0.53, v: 0.25, rU: 0.11, rV: 0.065, d: 680 },
    { uP: 0.64, v: 0.22, rU: 0.08, rV: 0.050, d: 460 },
    { uP: 0.92, v: 0.23, rU: 0.09, rV: 0.055, d: 540 },
    { uP: 0.18, v: 0.28, rU: 0.12, rV: 0.050, d: 980 },
    { uP: 0.46, v: 0.29, rU: 0.13, rV: 0.055, d: 1120 },
  ];
  for (const b of bushes) {
    for (let k = 0; k < 1300; k++) {
      const th = rng.range(0, TAU);
      const rad = Math.sqrt(rng.next());
      const uP = b.uP + rad * b.rU * Math.cos(th);
      const v = b.v + rad * b.rV * Math.sin(th);
      const d = b.d + rng.range(-35, 35);
      const rim = rad > 0.82;
      const top = Math.sin(th) > 0.2;
      const ca = rim
        ? mixHex(P.ultramarine, P.cypressDark, 0.5)
        : top
          ? mixHex(P.blueGreen, P.groveLight, rng.range(0.25, 0.7))
          : mixHex(P.grove, P.cypressGreen, rng.range(0.2, 0.65));
      const cb = top ? mixHex(P.zincWhite, P.blueGreen, 0.55) : P.cypressDark;
      const swirlTang = new Vector3(-Math.sin(th), Math.cos(th), 0.15).normalize();
      emitSurfaceStroke(
        sink, WHEAT_ASPECT, StrokeClass.GROVE, uP, v, d,
        rng.range(0.012, 0.025), rng.range(0.0042, 0.0072),
        swirlTang, nBush, ca, cb, rng,
        { emissive: top ? 0.14 : 0, kappa: 0.28, flags: rim ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
      );
    }
  }

  // C. Small sunlit Provençal farmhouse nestled by the olive grove (HOUSE & CHURCH accents, 2,400 strokes)
  for (let i = 0; i < 2400; i++) {
    const roof = i < 950;
    const uP = 0.56 + rng.range(-0.045, 0.045);
    const v = roof ? rng.range(0.275, 0.305) : rng.range(0.245, 0.278);
    const d = rng.range(645, 720);
    const ca = roof ? mixHex(P.ochre, 0xc85228, rng.range(0.3, 0.7)) : mixHex(P.zincWhite, P.lemon, 0.35);
    const cb = roof ? P.ochre : mixHex(P.cerulean, P.zincWhite, 0.5);
    emitSurfaceStroke(
      sink, WHEAT_ASPECT, StrokeClass.CHURCH, uP, v, d,
      0.012, 0.0042, new Vector3(1, 0, 0), nBush, ca, cb, rng,
      { emissive: 0.18, flags: StrokeFlag.OUTLINE },
    );
  }
}

export function generateWheatChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const time = (name: string, fn: () => void) => {
    const t0 = performance.now();
    fn();
    timings[name] = Math.round((performance.now() - t0) * 10) / 10;
  };

  time('sky', () => genWheatSky(sink, forkRng(seed, 'wheat:sky')));
  time('hills', () => genWheatHills(sink, forkRng(seed, 'wheat:hills')));
  time('cypress', () => genWheatCypresses(sink, forkRng(seed, 'wheat:cypress')));
  time('ground', () => genWheatFieldsAndOlives(sink, forkRng(seed, 'wheat:ground')));

  const underlays = new Group();
  underlays.name = 'underlays:wheat';
  // Golden wheat field underlay quad
  underlays.add(buildCanvasQuadMesh(
    WHEAT_ASPECT,
    [[-0.12, -0.08, 208], [1.12, -0.08, 208], [1.12, 0.26, 1500], [-0.12, 0.26, 1500]],
    mat, 0xb88420, 'wheatFieldCore',
  ));
  // Blue Alpilles underlay quad
  underlays.add(buildCanvasQuadMesh(
    WHEAT_ASPECT,
    [[-0.12, 0.24, 2400], [1.12, 0.24, 2400], [1.12, 0.44, 4800], [-0.12, 0.44, 4800]],
    mat, 0x2e5894, 'wheatHillsCore',
  ));
  // Right-hand cypress core quad
  underlays.add(buildCanvasQuadMesh(
    WHEAT_ASPECT,
    [[0.75, 0.04, 192], [0.85, 0.04, 192], [0.82, 0.86, 192], [0.78, 0.86, 192]],
    mat, 0x152418, 'wheatCypressCore',
  ));

  const steepleBase = canvasToWorld(uFromPaint(0.805, WHEAT_ASPECT), 0.10, 186);
  const steepleTip = canvasToWorld(uFromPaint(0.805, WHEAT_ASPECT), 0.92, 186);
  return {
    underlays,
    village: { steepleBase, steepleTip, houses: [] },
    timings,
  };
}
