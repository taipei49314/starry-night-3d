// Chapter II: Starry Night Over the Rhône (Arles, Trinquetaille Bank, Sept 1888), aspect = 1.28.
// 3D anamorphic world: Prussian/cobalt/aqua night sky (96-250 km), the 7 haloed stars of the Big Dipper / Ursa Major
// (12-16 km), the distant Arles embankment & gas lamps (1,800-4,200 m), the 3D Rhône river surface with shimmering
// golden reflection pillars (260-2,800 m), moored wooden boats (175-540 m), and the wet sandy shore with the two lovers.
import { Group, Vector3 } from 'three';
import {
  PALETTE, StrokeClass, StrokeFlag,
  type QualitySettings, type Rng, type SharedUniforms, type StrokeSink, type UnderlayMaterialFactory, type VillageInfo,
} from '../contracts';
import { canvasToWorld } from '../shared/canvasSpace';
import { forkRng } from '../shared/rng';
import {
  buildCanvasQuadMesh, clamp, clamp01, emitCanvasStroke, emitCustomStar, emitSurfaceStroke,
  mixHex, shadeHex, uFromPaint,
} from './types';

export const RHONE_ASPECT = 1.28;
const P = PALETTE;
const TAU = Math.PI * 2;

/** Ursa Major (The Plough / Big Dipper) + companion Arles stars in painting coordinates (uP, v). */
const RHONE_STARS: readonly { name: string; uP: number; v: number; d: number; rho: number; rings: number; gain: number }[] = [
  // Big Dipper handle: Alkaid, Mizar, Alioth
  { name: 'Alkaid', uP: 0.23, v: 0.77, d: 12400, rho: 0.015, rings: 7, gain: 1.12 },
  { name: 'Mizar',  uP: 0.34, v: 0.80, d: 12800, rho: 0.014, rings: 6, gain: 1.06 },
  { name: 'Alioth', uP: 0.43, v: 0.76, d: 12200, rho: 0.015, rings: 7, gain: 1.10 },
  // Big Dipper bowl: Megrez, Phecda, Merak, Dubhe
  { name: 'Megrez', uP: 0.52, v: 0.72, d: 13200, rho: 0.013, rings: 6, gain: 1.00 },
  { name: 'Phecda', uP: 0.55, v: 0.63, d: 13500, rho: 0.014, rings: 6, gain: 1.04 },
  { name: 'Merak',  uP: 0.68, v: 0.65, d: 12600, rho: 0.015, rings: 7, gain: 1.12 },
  { name: 'Dubhe',  uP: 0.70, v: 0.76, d: 12100, rho: 0.016, rings: 8, gain: 1.18 },
  // Companion stars across the Rhône sky
  { name: 'R1', uP: 0.11, v: 0.85, d: 14200, rho: 0.012, rings: 5, gain: 0.92 },
  { name: 'R2', uP: 0.16, v: 0.66, d: 14600, rho: 0.011, rings: 5, gain: 0.88 },
  { name: 'R3', uP: 0.48, v: 0.90, d: 14900, rho: 0.011, rings: 5, gain: 0.90 },
  { name: 'R4', uP: 0.83, v: 0.84, d: 13600, rho: 0.013, rings: 6, gain: 0.98 },
  { name: 'R5', uP: 0.90, v: 0.69, d: 14100, rho: 0.012, rings: 5, gain: 0.92 },
  { name: 'R6', uP: 0.30, v: 0.61, d: 15100, rho: 0.010, rings: 4, gain: 0.84 },
  { name: 'R7', uP: 0.78, v: 0.58, d: 14800, rho: 0.011, rings: 5, gain: 0.86 },
];

/** The 10 gas lamps along the distant Arles quay (uP, horizon v, intensity). */
const GAS_LAMPS: readonly { uP: number; v: number; power: number }[] = [
  { uP: 0.08, v: 0.445, power: 0.75 },
  { uP: 0.18, v: 0.442, power: 0.92 },
  { uP: 0.28, v: 0.440, power: 1.05 },
  { uP: 0.38, v: 0.438, power: 1.15 },
  { uP: 0.47, v: 0.437, power: 1.08 },
  { uP: 0.56, v: 0.438, power: 1.18 },
  { uP: 0.65, v: 0.440, power: 1.12 },
  { uP: 0.74, v: 0.442, power: 1.00 },
  { uP: 0.83, v: 0.444, power: 0.95 },
  { uP: 0.92, v: 0.446, power: 0.80 },
];

/** Foreground sandy riverbank curve vShore(uP): rises from left (0.04) toward the right-hand cove (0.17). */
function shoreV(uP: number): number {
  return 0.03 + 0.13 * clamp01((uP - 0.15) / 0.85) + 0.025 * Math.sin(5.5 * uP);
}

/** 1. Underpaint & Prussian/aqua sky strata (UNDERPAINT & SKY_BAND). */
function genRhoneSky(sink: StrokeSink, rng: Rng): void {
  const rows = 56, cols = 52;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const uP = -0.28 + ((c + 0.5 + 0.3 * (r & 1) + rng.range(-0.18, 0.18)) / cols) * 1.56;
      const v = -0.08 + ((r + 0.5 + rng.range(-0.15, 0.15)) / rows) * 1.18;
      let ca: number, cb: number;
      if (v >= 0.44) {
        const t = clamp01((v - 0.44) / 0.56);
        ca = mixHex(P.cobalt, P.prussian, 0.25 + 0.55 * t);
        cb = mixHex(P.ultramarine, P.blueGreen, 0.2 * (1 - t));
      } else {
        ca = mixHex(P.prussian, P.ultramarine, rng.range(0.2, 0.6));
        cb = P.prussian;
      }
      emitCanvasStroke(sink, RHONE_ASPECT, StrokeClass.UNDERPAINT, uP, v, rng.range(231000, 249000), 0.085, rng.range(-0.12, 0.12), 0.042, ca, cb, rng);
    }
  }

  // Sweeping Prussian, cobalt, cerulean, and pale-aqua night sky bands above the Rhône (34,000 strokes)
  const nBands = 34000;
  for (let i = 0; i < nBands; i++) {
    const inCore = i < 27000;
    const uP = inCore ? rng.range(-0.04, 1.04) : rng.range(-0.32, 1.32);
    const v = rng.range(0.45, 1.08);
    const deck = clamp(Math.floor(((v - 0.45) / 0.63) * 13 + rng.normal() * 1.5), 0, 13);
    const d = 97000 + deck * 6800 + rng.range(-1600, 1600);
    // Gentle undulation across the sky, wrapping slightly around the Big Dipper
    const ang = 0.09 * Math.sin(4.2 * uP + 6.0 * v) + 0.05 * Math.cos(8.5 * uP - 4.0 * v);
    const L = rng.range(0.026, 0.054);
    const w = rng.range(0.0065, 0.011);
    const stripe = (6.5 * v + 0.25 * Math.sin(3.8 * uP) + 0.12 * rng.normal()) % 1;
    let ca: number, cb: number;
    if (stripe < 0.44) {
      ca = mixHex(P.prussian, P.cobalt, rng.range(0.35, 0.8));
      cb = P.ultramarine;
    } else if (stripe < 0.78) {
      ca = mixHex(P.cobalt, P.cerulean, rng.range(0.25, 0.75));
      cb = mixHex(P.cobalt, P.blueGreen, 0.35);
    } else {
      // Van Gogh's signature "aquamarine / pale blue-green" sky glow
      ca = mixHex(P.blueGreen, P.cerulean, rng.range(0.2, 0.65));
      cb = mixHex(P.zincWhite, P.blueGreen, 0.55);
    }
    const sh = rng.range(0.88, 1.08);
    emitCanvasStroke(
      sink, RHONE_ASPECT, StrokeClass.SKY_BAND, uP, v, d, L, ang, w,
      shadeHex(ca, sh), shadeHex(cb, sh), rng,
      { dlnd: 0.03 * Math.sin(ang), kappa: rng.range(-0.22, 0.22), q1: 0.32, q2: rng.int(4), q3: rng.next() },
    );
  }
}

/** 2. The 7 stars of Ursa Major (Big Dipper) + companion stars. */
function genRhoneStars(sink: StrokeSink, rng: Rng): void {
  for (const s of RHONE_STARS) {
    emitCustomStar(sink, RHONE_ASPECT, s.uP, s.v, s.d, s.rho, s.rings, s.gain, rng, P.lemon);
  }
}

/** 3. Distant Arles embankment, horizon skyline & towers (HILL 2,200-4,600 m, HOUSE 1,200-2,600 m, CHURCH 640-730 m). */
function genRhoneHorizon(sink: StrokeSink, rng: Rng): void {
  const nBank = new Vector3(0, 0.25, 0.97).normalize();
  const tHoriz = new Vector3(1, 0, 0);
  const tVert = new Vector3(0, 1, 0);

  // Low dark silhouette of Arles across the river (HILL, 8,000 strokes)
  for (let i = 0; i < 8000; i++) {
    const uP = rng.range(-0.15, 1.15);
    const crest = 0.485 + 0.022 * Math.sin(5.2 * uP + 0.6) + 0.012 * Math.cos(13.0 * uP);
    const v = rng.range(0.435, crest);
    const d = 2400 + 1600 * ((v - 0.435) / 0.08) + rng.range(-120, 120);
    const ca = mixHex(P.prussian, P.ultramarine, rng.range(0.15, 0.55));
    const cb = mixHex(P.outline, P.cobalt, rng.range(0.15, 0.45));
    emitSurfaceStroke(
      sink, RHONE_ASPECT, StrokeClass.HILL, uP, v, d,
      rng.range(0.014, 0.030), rng.range(0.004, 0.0075),
      tHoriz, nBank, ca, cb, rng,
      { flags: v > crest - 0.01 ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
    );
  }

  // Arles waterfront buildings & Trinquetaille bridge arches on the left (HOUSE, 6,500 strokes)
  for (let i = 0; i < 6500; i++) {
    const uP = rng.range(0.02, 0.96);
    const v = rng.range(0.435, 0.485);
    const d = rng.range(1650, 2650);
    const warmTint = rng.next() < 0.28;
    const ca = warmTint ? mixHex(P.ochre, P.ultramarine, 0.55) : mixHex(P.ultramarine, P.prussian, 0.45);
    const cb = warmTint ? mixHex(P.chrome, P.outline, 0.65) : P.outline;
    emitSurfaceStroke(
      sink, RHONE_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.010, 0.022), rng.range(0.0035, 0.006),
      rng.next() < 0.5 ? tVert : tHoriz, nBank, ca, cb, rng,
      { flags: StrokeFlag.OUTLINE },
    );
  }

  // Distant Arles church towers / spires on the horizon (CHURCH, 1,800 strokes)
  const towers = [0.36, 0.61, 0.77];
  for (const tu of towers) {
    for (let k = 0; k < 600; k++) {
      const uP = tu + rng.range(-0.012, 0.012);
      const v = rng.range(0.46, 0.535);
      const d = rng.range(645, 735);
      emitSurfaceStroke(
        sink, RHONE_ASPECT, StrokeClass.CHURCH, uP, v, d,
        0.011, 0.0032, tVert, nBank, P.outline, P.ultramarine, rng,
        { flags: StrokeFlag.OUTLINE },
      );
    }
  }
}

/** 4. Quayside gas lamps & shimmering golden reflection pillars across the 3D Rhône water (WINDOW & HOUSE). */
function genRhoneReflections(sink: StrokeSink, rng: Rng): void {
  const nWater = new Vector3(0, 0.95, 0.31).normalize();
  const nFront = new Vector3(0, 0, 1);
  const tWave = new Vector3(1, 0, 0);

  // A. Blazing gas lamps along the Arles shoreline at v ~ 0.44
  for (const lamp of GAS_LAMPS) {
    for (let k = 0; k < 95; k++) {
      const th = rng.range(0, TAU);
      const r = Math.pow(rng.next(), 1.5) * 0.022 * lamp.power;
      const uP = lamp.uP + (r * Math.cos(th)) / RHONE_ASPECT;
      const v = lamp.v + 0.65 * r * Math.sin(th);
      const d = 2350 + rng.range(-40, 40);
      const core = r < 0.006;
      const ca = core ? P.zincWhite : P.lemon;
      const cb = core ? P.lemon : mixHex(P.chrome, P.ochre, 0.45);
      emitSurfaceStroke(
        sink, RHONE_ASPECT, StrokeClass.WINDOW, uP, v, d,
        0.010, 0.004, tWave, nFront, ca, cb, rng,
        { emissive: (core ? 4.5 : 2.4) * lamp.power },
      );
    }

    // B. Shimmering golden reflection pillar stretching down the 3D river surface (v from 0.435 down to shoreV + 0.03)
    const vBot = Math.max(shoreV(lamp.uP) + 0.02, 0.11);
    const nBars = Math.round(520 * lamp.power);
    for (let k = 0; k < nBars; k++) {
      const tV = rng.next(); // 0 near shore, 1 at far bank
      const v = vBot + (lamp.v - 0.008 - vBot) * tV;
      // Depth along the water plane from 470 m in foreground to 2,550 m at the far bank
      const d = 470 * Math.pow(2550 / 470, tV) + rng.range(-15, 15);
      // Width of the reflection columnzig-zags with water waves
      const colSpread = (0.012 + 0.024 * (1 - 0.5 * tV)) * lamp.power;
      const wiggle = 0.007 * Math.sin(42.0 * v + 9.0 * lamp.uP);
      const uP = lamp.uP + wiggle + rng.range(-colSpread, colSpread);
      const centerWeight = 1 - Math.min(1, Math.abs(uP - lamp.uP - wiggle) / (colSpread + 1e-4));
      const ca = centerWeight > 0.55 ? mixHex(P.lemon, P.chrome, rng.range(0.15, 0.65)) : mixHex(P.chrome, P.ochre, rng.range(0.25, 0.75));
      const cb = mixHex(P.ochre, P.lemon, rng.range(0.2, 0.7));
      // Alternate between flickering WINDOW strokes (emissive shimmer) and HOUSE/GROUND impasto bars
      const cls = k % 3 === 0 ? StrokeClass.WINDOW : StrokeClass.HOUSE;
      emitSurfaceStroke(
        sink, RHONE_ASPECT, cls, uP, v, d,
        rng.range(0.015, 0.034), rng.range(0.0038, 0.0068),
        tWave, nWater, ca, cb, rng,
        { emissive: (0.85 + 1.45 * centerWeight) * lamp.power * (0.55 + 0.45 * tV) },
      );
    }
  }
}

/** 5. The 3D Rhône water plane, wet sandy foreground bank, moored boats, and the two lovers. */
function genRhoneWaterAndShore(sink: StrokeSink, rng: Rng): void {
  const nWater = new Vector3(0, 0.96, 0.28).normalize();
  const nShore = new Vector3(0, 0.92, 0.39).normalize();
  const tHoriz = new Vector3(1, 0, 0);

  // A. The broad Rhône river surface (26,000 horizontal wave dashes in GROUND, d in [240, 3,200] m)
  for (let i = 0; i < 26000; i++) {
    const uP = rng.range(-0.08, 1.08);
    const vMin = shoreV(uP);
    const v = rng.range(vMin, 0.44);
    const tV = clamp01((v - 0.03) / 0.41);
    const d = 240 * Math.pow(3100 / 240, tV) + rng.range(-12, 12);
    // Check if near a gas-lamp reflection column for warm golden-green water tint
    let nearLamp = false;
    for (const l of GAS_LAMPS) {
      if (Math.abs(uP - l.uP) < 0.028 * l.power && v > vMin + 0.03) {
        nearLamp = true;
        break;
      }
    }
    let ca: number, cb: number;
    if (nearLamp && rng.next() < 0.42) {
      ca = mixHex(P.ochre, P.cobalt, rng.range(0.25, 0.65));
      cb = mixHex(P.chrome, P.ultramarine, 0.45);
    } else {
      const waveBand = (18.0 * v + 0.35 * Math.sin(9.0 * uP) + 0.2 * rng.normal()) % 1;
      if (waveBand < 0.45) {
        ca = mixHex(P.prussian, P.ultramarine, rng.range(0.2, 0.75));
        cb = P.prussian;
      } else if (waveBand < 0.80) {
        ca = mixHex(P.cobalt, P.ultramarine, rng.range(0.2, 0.7));
        cb = mixHex(P.cerulean, P.prussian, 0.5);
      } else {
        ca = mixHex(P.blueGreen, P.cobalt, rng.range(0.3, 0.7));
        cb = P.ultramarine;
      }
    }
    emitSurfaceStroke(
      sink, RHONE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.016, 0.038), rng.range(0.0042, 0.0078),
      tHoriz, nWater, shadeHex(ca, rng.range(0.8, 1.08)), shadeHex(cb, rng.range(0.8, 1.05)), rng,
    );
  }

  // B. Foreground wet sandy riverbank (8,500 strokes in GROUND, d in [205, 360] m)
  for (let i = 0; i < 8500; i++) {
    const uP = rng.range(-0.08, 1.08);
    const vMax = shoreV(uP) + 0.015;
    const v = rng.range(-0.07, vMax);
    const tV = clamp01((v + 0.07) / 0.26);
    const d = 205 + tV * 145 + rng.range(-6, 6);
    const r = rng.next();
    const ca = r < 0.42
      ? mixHex(P.ochre, P.cypressGreen, rng.range(0.3, 0.7))
      : r < 0.75
        ? mixHex(P.blueGreen, P.ultramarine, rng.range(0.35, 0.75))
        : mixHex(P.chrome, P.ochre, rng.range(0.4, 0.8));
    const cb = mixHex(P.prussian, P.ochre, rng.range(0.2, 0.55));
    const shoreAng = new Vector3(0.96, 0.14, -0.24).normalize();
    emitSurfaceStroke(
      sink, RHONE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.032), rng.range(0.005, 0.0085),
      shoreAng, nShore, shadeHex(ca, rng.range(0.65, 0.95)), shadeHex(cb, rng.range(0.65, 0.92)), rng,
    );
  }

  // C. Two moored wooden boats on the right (uP in [0.54, 0.84], v in [0.11, 0.24], GROVE & CYPRESS)
  const boats: readonly { uP: number; v: number; d: number; lenU: number; hV: number }[] = [
    { uP: 0.65, v: 0.175, d: 340, lenU: 0.16, hV: 0.042 },
    { uP: 0.74, v: 0.145, d: 285, lenU: 0.15, hV: 0.045 },
  ];
  for (const b of boats) {
    for (let k = 0; k < 2200; k++) {
      const s = rng.range(-0.5, 0.5);
      const uP = b.uP + s * b.lenU;
      const bowCurve = 4 * s * s * 0.014;
      const v = b.v + bowCurve + rng.range(-0.5 * b.hV, 0.5 * b.hV);
      const gunwale = rng.next() < 0.25;
      const ca = gunwale ? mixHex(P.ochre, P.chrome, 0.35) : mixHex(P.prussian, P.cypressDark, 0.5);
      const cb = gunwale ? mixHex(P.cerulean, P.ultramarine, 0.5) : P.outline;
      emitSurfaceStroke(
        sink, RHONE_ASPECT, StrokeClass.GROVE, uP, v, b.d + rng.range(-12, 12),
        rng.range(0.012, 0.025), rng.range(0.0038, 0.0065),
        new Vector3(0.95, 0.18, -0.25).normalize(), nShore, ca, cb, rng,
        { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  // D. Foreground lovers strolling on the right shore + boat stern/rigging accents (CYPRESS class, d in [155, 235] m)
  const lovers: readonly { uP: number; vBase: number; vTop: number; d: number; coat: number; accent: number }[] = [
    { uP: 0.79, vBase: 0.01, vTop: 0.135, d: 185, coat: P.prussian, accent: P.cerulean },
    { uP: 0.835, vBase: 0.005, vTop: 0.128, d: 182, coat: P.ultramarine, accent: P.ochre },
  ];
  for (const lv of lovers) {
    for (let k = 0; k < 1600; k++) {
      const v = rng.range(lv.vBase, lv.vTop);
      const tH = (v - lv.vBase) / (lv.vTop - lv.vBase);
      const widthU = tH > 0.78 ? 0.012 : 0.022 * (1 - 0.35 * tH);
      const uP = lv.uP + rng.range(-widthU, widthU);
      const hatOrFace = tH > 0.78;
      const ca = hatOrFace ? mixHex(P.lemon, P.ochre, 0.55) : mixHex(lv.coat, P.outline, 0.4);
      const cb = hatOrFace ? P.ochre : lv.accent;
      emitCanvasStroke(
        sink, RHONE_ASPECT, StrokeClass.CYPRESS, uP, v, lv.d + rng.range(-4, 4),
        rng.range(0.010, 0.020), Math.PI * 0.5 + rng.range(-0.22, 0.22), rng.range(0.0038, 0.0062),
        ca, cb, rng,
        { flags: StrokeFlag.OUTLINE, q1: 1, q2: v * TAU, q3: 0 },
      );
    }
  }
}

export function generateRhoneChapter(
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

  time('sky', () => genRhoneSky(sink, forkRng(seed, 'rhone:sky')));
  time('stars', () => genRhoneStars(sink, forkRng(seed, 'rhone:stars')));
  time('hills', () => genRhoneHorizon(sink, forkRng(seed, 'rhone:horizon')));
  time('village', () => genRhoneReflections(sink, forkRng(seed, 'rhone:reflect')));
  time('ground', () => genRhoneWaterAndShore(sink, forkRng(seed, 'rhone:water')));

  const underlays = new Group();
  underlays.name = 'underlays:rhone';
  // Rhône river & shore underlay quad
  underlays.add(buildCanvasQuadMesh(
    RHONE_ASPECT,
    [[-0.12, -0.08, 208], [1.12, -0.08, 208], [1.12, 0.44, 2800], [-0.12, 0.44, 2800]],
    mat, 0x0d1d3a, 'rhoneWaterCore',
  ));
  // Distant Arles embankment underlay quad
  underlays.add(buildCanvasQuadMesh(
    RHONE_ASPECT,
    [[-0.12, 0.43, 2750], [1.12, 0.43, 2750], [1.12, 0.50, 3600], [-0.12, 0.50, 3600]],
    mat, 0x111a30, 'rhoneBankCore',
  ));

  const steepleBase = canvasToWorld(uFromPaint(0.61, RHONE_ASPECT), 0.44, 680);
  const steepleTip = canvasToWorld(uFromPaint(0.61, RHONE_ASPECT), 0.535, 680);
  return {
    underlays,
    village: { steepleBase, steepleTip, houses: [] },
    timings,
  };
}
