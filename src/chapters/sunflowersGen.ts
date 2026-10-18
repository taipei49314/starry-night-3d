// Chapter III (Sun — 亞爾的黃金時代): Sunflowers (Arles, August 1888), aspect = 0.79.
// A symphony of yellow-on-yellow impasto:
// - Radiant sulfur-lemon basket-weave wall backdrop
// - Golden-ochre table surface with a cobalt-blue horizon line
// - Two-toned glazed earthenware vase signed "Vincent" in cobalt blue
// - 15 sculptural 3D sunflowers (full-petalled golden suns, flame-petalled blooms, and mahogany-amber seed discs)
//   centered around the Crown Sunflower Portal (uP = 0.50, v = 0.72).
import { Group, Vector3 } from 'three';
import {
  PALETTE, StrokeClass, StrokeFlag,
  type QualitySettings, type Rng, type SharedUniforms, type StrokeSink, type UnderlayMaterialFactory, type VillageInfo,
} from '../contracts';
import { canvasToWorld } from '../shared/canvasSpace';
import { forkRng } from '../shared/rng';
import {
  buildCanvasQuadMesh, clamp, emitCanvasStroke, emitSurfaceStroke,
  mixHex, shadeHex, uFromPaint,
} from './types';

export const SUNFLOWERS_ASPECT = 0.79;
const P = PALETTE;

const SULFUR_WALL = 0xf7e678;
const LEMON_CREAM = 0xfaf0a8;
const CHROME_DEEP = 0xf2b418;
const AMBER_ORANGE = 0xe27218;
const SEED_MAHOGANY = 0x5c2412;
const STEM_EMERALD = 0x2f7c44;
const VASE_OCHRE = 0xd89628;

/** 1. Radiant Sulfur-Lemon Basket-Weave Wall & Solar Crown Portal (uP = 0.50, v = 0.72). */
function genSulfurWallBackdrop(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < 6000; i++) {
    const uP = rng.range(-0.12, 1.12);
    const v = rng.range(0.20, 1.06);
    const d = rng.range(230000, 250000);
    const cA = mixHex(SULFUR_WALL, LEMON_CREAM, rng.range(0.25, 0.85));
    const cB = CHROME_DEEP;
    emitCanvasStroke(
      sink, SUNFLOWERS_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.048, 0.088), rng.range(-0.2, 0.2), rng.range(0.024, 0.042),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // Basket-weave cross-hatched yellow wall strokes (SKY_BAND [98..166 km])
  for (let i = 0; i < 18500; i++) {
    const uP = rng.range(-0.08, 1.08);
    const v = rng.range(0.24, 1.05);
    const d = rng.range(98000, 166000);
    const weaveHoriz = (i & 1) === 0;
    const ang = (weaveHoriz ? 0 : 1.57) + rng.range(-0.14, 0.14);
    const cA = shadeHex(mixHex(SULFUR_WALL, LEMON_CREAM, rng.range(0.2, 0.85)), rng.range(0.94, 1.08));
    const cB = mixHex(CHROME_DEEP, P.lemon, rng.range(0.4, 0.8));

    emitCanvasStroke(
      sink, SUNFLOWERS_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.014, 0.028), ang, rng.range(0.0052, 0.0095),
      cA, cB, rng,
      { q1: 0.12, q2: i & 3, q3: rng.next() },
    );
  }
}

/** 2. Golden-Ochre Table Surface & Two-Toned Glazed Earthenware Vase (GROUND & HOUSE). */
function genTableAndVase(sink: StrokeSink, rng: Rng): void {
  const nUp = new Vector3(0, 1, 0.15).normalize();
  const nFront = new Vector3(0, 0, 1);
  const tHoriz = new Vector3(1, 0, 0);

  // Golden-ochre tabletop below v = 0.25 with crisp cobalt-blue divider line (GROUND [155..520 m])
  for (let i = 0; i < 13000; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = rng.next();
    const v = 0.002 + 0.25 * t;
    const d = clamp(158 + 345 * t + rng.range(-6, 6), 154, 515);
    const isHorizonLine = v > 0.232;
    const cA = isHorizonLine
      ? P.cobalt
      : shadeHex(mixHex(VASE_OCHRE, CHROME_DEEP, rng.range(0.25, 0.75)), rng.range(0.88, 1.12));
    const cB = isHorizonLine ? P.prussian : AMBER_ORANGE;

    emitCanvasStroke(
      sink, SUNFLOWERS_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.016, 0.032), rng.range(-0.12, 0.12), rng.range(0.0052, 0.0096),
      cA, cB, rng,
      { q1: nUp.x, q2: nUp.y, q3: nUp.z, emissive: 0.22 },
    );
  }

  // Rounded Two-Toned Earthenware Vase (uP = 0.30..0.70, v = 0.08..0.42, d = 465..535 m, HOUSE)
  for (let i = 0; i < 7500; i++) {
    const tV = rng.next(); // 0 = base (0.08), 1 = rim (0.42)
    const v = 0.08 + 0.34 * tV;
    // Bulging belly profile peaking around tV = 0.52
    const profileW = 0.13 + 0.075 * Math.sin(Math.PI * Math.pow(tV, 0.85));
    const uRel = rng.range(-1, 1);
    const uP = 0.50 + uRel * profileW;
    const d = 468 + 48 * (uRel * uRel) + rng.range(-6, 6);

    const isUpperGlaze = tV > 0.52;
    const isDivideLine = Math.abs(tV - 0.52) < 0.025;
    const isHighlight = uRel > 0.25 && uRel < 0.68;

    let cA: number, cB: number, em = 0.28;
    if (isDivideLine) {
      cA = P.cobalt;
      cB = STEM_EMERALD;
      em = 0.15;
    } else if (isUpperGlaze) {
      cA = shadeHex(mixHex(LEMON_CREAM, SULFUR_WALL, rng.range(0.2, 0.8)), isHighlight ? 1.10 : 0.96);
      cB = CHROME_DEEP;
      em = 0.42;
    } else {
      cA = shadeHex(mixHex(VASE_OCHRE, AMBER_ORANGE, rng.range(0.2, 0.65)), isHighlight ? 1.12 : 0.92);
      cB = CHROME_DEEP;
      em = 0.32;
    }

    emitSurfaceStroke(
      sink, SUNFLOWERS_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.012, 0.025), rng.range(0.0045, 0.0085),
      tHoriz, nFront, cA, cB, rng,
      { flags: Math.abs(uRel) > 0.84 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: em },
    );
  }

  // Cobalt "Vincent" signature along the upper-left curve of the vase (uP = 0.35..0.44, v = 0.29..0.33, WINDOW)
  for (let i = 0; i < 240; i++) {
    const s = i / 240;
    const uP = 0.35 + 0.09 * s + rng.range(-0.004, 0.004);
    const v = 0.32 - 0.022 * s + 0.006 * Math.sin(s * 24) + rng.range(-0.004, 0.004);
    emitSurfaceStroke(
      sink, SUNFLOWERS_ASPECT, StrokeClass.WINDOW, uP, v, 462,
      0.008, 0.0030,
      tHoriz, nFront, P.cobalt, P.prussian, rng,
      { emissive: 0.85 },
    );
  }
}

/** 3. Fifteen Sculptural 3D Sunflowers & Viridian Stems (GROVE, HOUSE & WINDOW). */
function genFifteenSunflowers(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);
  const tRad = new Vector3(1, 0, 0);

  // 15 iconic sunflower heads arranged in depth (d = 458..640 m)
  const blooms: Array<{ u: number; v: number; r: number; d: number; darkCore: boolean; hanging: boolean }> = [
    // Central high crown portal bloom
    { u: 0.50, v: 0.72, r: 0.088, d: 468, darkCore: true, hanging: false },
    // Upper tier
    { u: 0.32, v: 0.82, r: 0.076, d: 520, darkCore: false, hanging: false },
    { u: 0.66, v: 0.84, r: 0.078, d: 535, darkCore: true, hanging: false },
    { u: 0.46, v: 0.88, r: 0.072, d: 580, darkCore: false, hanging: false },
    // Middle tier
    { u: 0.22, v: 0.66, r: 0.078, d: 495, darkCore: true, hanging: false },
    { u: 0.37, v: 0.64, r: 0.082, d: 475, darkCore: false, hanging: false },
    { u: 0.64, v: 0.66, r: 0.084, d: 482, darkCore: false, hanging: false },
    { u: 0.79, v: 0.63, r: 0.074, d: 515, darkCore: true, hanging: false },
    // Lower rim tier & cascading blooms
    { u: 0.18, v: 0.49, r: 0.072, d: 485, darkCore: false, hanging: true },
    { u: 0.31, v: 0.48, r: 0.076, d: 462, darkCore: true, hanging: false },
    { u: 0.46, v: 0.52, r: 0.080, d: 458, darkCore: false, hanging: false },
    { u: 0.59, v: 0.50, r: 0.078, d: 464, darkCore: true, hanging: false },
    { u: 0.73, v: 0.47, r: 0.075, d: 478, darkCore: false, hanging: true },
    { u: 0.84, v: 0.42, r: 0.068, d: 505, darkCore: false, hanging: true },
    { u: 0.26, v: 0.36, r: 0.066, d: 460, darkCore: true, hanging: true },
  ];

  // Stems & emerald calyx leaves connecting vase rim (0.50, 0.40) to each bloom (GROVE [380..620 m])
  for (const bl of blooms) {
    for (let k = 0; k < 280; k++) {
      const s = rng.next();
      const uP = 0.50 + (bl.u - 0.50) * s + 0.025 * Math.sin(s * Math.PI) * (bl.u < 0.5 ? -1 : 1) + rng.range(-0.008, 0.008);
      const v = 0.40 + (bl.v - 0.40) * s + rng.range(-0.008, 0.008);
      const d = bl.d + 18 * (1 - s);
      const ang = Math.atan2(bl.v - 0.40, (bl.u - 0.50) * SUNFLOWERS_ASPECT) + rng.range(-0.2, 0.2);
      const cA = shadeHex(mixHex(STEM_EMERALD, P.groveLight, rng.range(0.2, 0.8)), rng.range(0.88, 1.14));
      emitCanvasStroke(
        sink, SUNFLOWERS_ASPECT, StrokeClass.GROVE, uP, v, d,
        rng.range(0.011, 0.022), ang, rng.range(0.0038, 0.0068),
        cA, CHROME_DEEP, rng,
        { emissive: 0.22 },
      );
    }
  }

  // Sculptural Sunflower Seed Discs & Flaming Ray Petals (HOUSE & WINDOW [456..645 m])
  for (const bl of blooms) {
    // 1) Central seed disc
    const nDisc = 520;
    for (let i = 0; i < nDisc; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const rad = Math.sqrt(rng.next()) * bl.r * 0.54;
      const uP = bl.u + Math.cos(ang) * rad;
      const v = bl.v + Math.sin(ang) * rad * 0.88;
      const d = bl.d - 4 + rng.range(-4, 4);
      const cA = bl.darkCore
        ? shadeHex(mixHex(SEED_MAHOGANY, AMBER_ORANGE, rng.range(0.15, 0.65)), rng.range(0.88, 1.15))
        : shadeHex(mixHex(AMBER_ORANGE, CHROME_DEEP, rng.range(0.25, 0.75)), rng.range(0.92, 1.14));
      const cB = bl.darkCore ? AMBER_ORANGE : STEM_EMERALD;

      emitSurfaceStroke(
        sink, SUNFLOWERS_ASPECT, StrokeClass.WINDOW, uP, v, d,
        rng.range(0.009, 0.018), rng.range(0.0038, 0.0068),
        tRad, nFront, cA, cB, rng,
        { emissive: bl.darkCore ? 1.35 : 1.75 },
      );
    }

    // 2) Flaming outer ray petals radiating around the seed disc
    const nPetals = 760;
    for (let i = 0; i < nPetals; i++) {
      const petalIdx = i % 22;
      const baseAng = (petalIdx / 22) * Math.PI * 2 + rng.range(-0.09, 0.09);
      const rFrac = rng.range(0.45, 1.12);
      const rad = bl.r * rFrac;
      const droop = bl.hanging ? -0.015 * rFrac : 0;
      const uP = bl.u + Math.cos(baseAng) * rad;
      const v = bl.v + Math.sin(baseAng) * rad * 0.88 + droop;
      const d = bl.d + rng.range(-6, 8);
      const cA = shadeHex(mixHex(CHROME_DEEP, P.lemon, rng.range(0.25, 0.85)), rng.range(0.92, 1.14));
      const cB = AMBER_ORANGE;

      emitSurfaceStroke(
        sink, SUNFLOWERS_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.012, 0.024), rng.range(0.0040, 0.0075),
        new Vector3(Math.cos(baseAng), Math.sin(baseAng), 0), nFront, cA, cB, rng,
        { flags: rFrac > 0.92 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: 0.55 },
      );
    }
  }
}

function buildSunflowersUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:sunflowers';
  g.add(buildCanvasQuadMesh(
    SUNFLOWERS_ASPECT,
    [[-0.04, 0.0, 160], [1.04, 0.0, 160], [0.96, 0.88, 560], [0.04, 0.88, 560]],
    mat,
    0xdba628,
    'sunflowers-backing',
  ));
  return g;
}

export function generateSunflowersChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const time = <T>(name: string, fn: () => T): T => {
    const t0 = performance.now();
    const r = fn();
    timings[name] = Math.round((performance.now() - t0) * 10) / 10;
    return r;
  };

  time('wall', () => genSulfurWallBackdrop(sink, forkRng(seed, 'sunflowers:wall')));
  time('vase', () => genTableAndVase(sink, forkRng(seed, 'sunflowers:vase')));
  time('blooms', () => genFifteenSunflowers(sink, forkRng(seed, 'sunflowers:blooms')));

  const underlays = buildSunflowersUnderlays(mat);
  const steepleTip = canvasToWorld(uFromPaint(0.50, SUNFLOWERS_ASPECT), 0.72, 468);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.50, SUNFLOWERS_ASPECT), 0.25, 475),
    steepleTip,
  };
  return { underlays, village, timings };
}
