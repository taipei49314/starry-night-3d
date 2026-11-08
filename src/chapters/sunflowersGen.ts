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
  buildCanvasQuadMesh, clamp, emitCanvasStroke, emitPathStrokes, emitSurfaceStroke,
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
      { emissive: 0.25 },
    );
  }
  // Bold Cloisonnist cobalt-blue & sienna contours framing the two-toned vase and table horizon
  emitPathStrokes(
    sink, SUNFLOWERS_ASPECT, StrokeClass.HOUSE,
    [[0.365, 0.08], [0.305, 0.22], [0.295, 0.30], [0.345, 0.41]],
    460, 120, 0.015, 0.0052, P.cobalt, P.prussian, rng, { spread: 0.003 },
  );
  emitPathStrokes(
    sink, SUNFLOWERS_ASPECT, StrokeClass.HOUSE,
    [[0.635, 0.08], [0.695, 0.22], [0.705, 0.30], [0.655, 0.41]],
    460, 120, 0.015, 0.0052, 0x8e4218, P.cobalt, rng, { spread: 0.003 },
  );
  emitPathStrokes(
    sink, SUNFLOWERS_ASPECT, StrokeClass.HOUSE,
    [[0.30, 0.255], [0.50, 0.245], [0.70, 0.255]],
    458, 110, 0.015, 0.005, P.cobalt, STEM_EMERALD, rng, { spread: 0.0025 },
  );
  emitPathStrokes(
    sink, SUNFLOWERS_ASPECT, StrokeClass.HOUSE,
    [[0.365, 0.08], [0.50, 0.072], [0.635, 0.08]],
    458, 90, 0.015, 0.005, 0x5c2412, P.cobalt, rng, { spread: 0.0025 },
  );
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
        { emissive: 0.08 },
      );
    }
  }

  // Sculptural Sunflower Seed Discs & Flaming Ray Petals (HOUSE & WINDOW [456..645 m])
  const GOLDEN_ANGLE = 2.399963229728653;
  for (const bl of blooms) {
    // 1) Central seed disc arranged in a Fibonacci phyllotaxis spiral (zero blowout, rich mahogany/amber/emerald relief)
    const nDisc = 620;
    for (let i = 0; i < nDisc; i++) {
      const f = (i + 0.5) / nDisc;
      const ang = i * GOLDEN_ANGLE + rng.range(-0.08, 0.08);
      const rad = Math.sqrt(f) * bl.r * 0.56;
      const uP = bl.u + Math.cos(ang) * rad;
      const v = bl.v + Math.sin(ang) * rad * 0.88;
      const d = bl.d - 4 + rng.range(-4, 4);
      const isOuterRing = f > 0.72;
      const cA = bl.darkCore
        ? (isOuterRing
          ? shadeHex(mixHex(AMBER_ORANGE, SEED_MAHOGANY, rng.range(0.25, 0.75)), rng.range(0.88, 1.12))
          : shadeHex(mixHex(SEED_MAHOGANY, 0x2e1208, rng.range(0.2, 0.65)), rng.range(0.84, 1.12)))
        : (isOuterRing
          ? shadeHex(mixHex(STEM_EMERALD, AMBER_ORANGE, rng.range(0.3, 0.75)), rng.range(0.88, 1.12))
          : shadeHex(mixHex(AMBER_ORANGE, 0xb85814, rng.range(0.25, 0.75)), rng.range(0.88, 1.12)));
      const cB = bl.darkCore ? AMBER_ORANGE : SEED_MAHOGANY;
      const swirlTang = ang + Math.PI * 0.35;
      tRad.set(Math.cos(swirlTang), Math.sin(swirlTang), 0).normalize();

      emitSurfaceStroke(
        sink, SUNFLOWERS_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.009, 0.018), rng.range(0.0040, 0.0072),
        tRad, nFront, cA, cB, rng,
        { flags: isOuterRing ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: 0.08, kappa: 0.28 },
      );
    }

    // 2) Flaming outer ray petals radiating around the seed disc with S-curve twist & warm sienna/amber Cloisonnist tips
    const nPetals = 880;
    for (let i = 0; i < nPetals; i++) {
      const petalIdx = i % 24;
      const rFrac = rng.range(0.42, 1.14);
      const sTwist = 0.22 * Math.sin((rFrac - 0.42) * 4.2 + petalIdx * 0.7);
      const baseAng = (petalIdx / 24) * Math.PI * 2 + sTwist + rng.range(-0.07, 0.07);
      const rad = bl.r * rFrac;
      const droop = bl.hanging ? -0.016 * rFrac * rFrac : 0;
      const uP = bl.u + Math.cos(baseAng) * rad;
      const v = bl.v + Math.sin(baseAng) * rad * 0.88 + droop;
      const d = bl.d + rng.range(-6, 8);
      const isTip = rFrac > 0.88;
      const cA = isTip
        ? shadeHex(mixHex(AMBER_ORANGE, 0xb85414, rng.range(0.25, 0.7)), rng.range(0.88, 1.10))
        : shadeHex(mixHex(CHROME_DEEP, AMBER_ORANGE, rng.range(0.15, 0.55)), rng.range(0.90, 1.12));
      const cB = isTip ? SEED_MAHOGANY : P.lemon;
      const tangAng = baseAng + 0.28 * Math.cos((rFrac - 0.42) * 4.2);

      emitSurfaceStroke(
        sink, SUNFLOWERS_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.013, 0.026), rng.range(0.0044, 0.0082),
        new Vector3(Math.cos(tangAng), Math.sin(tangAng), 0), nFront, cA, cB, rng,
        { flags: isTip ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: 0.10, kappa: 0.34 },
      );
    }
  }
}

function buildSunflowersUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:sunflowers';
  // Radiant sulfur-lemon wall backing placed behind SKY_BAND (98-166 km) so the 18,500 basket-weave wall strokes shine
  g.add(buildCanvasQuadMesh(
    SUNFLOWERS_ASPECT,
    [[-0.08, 0.22, 220000], [1.08, 0.22, 220000], [1.08, 1.06, 220000], [-0.08, 1.06, 220000]],
    mat,
    SULFUR_WALL,
    'sunflowers-wall-backing',
    220000,
  ));
  // Golden-ochre tabletop backing quad below the horizon line (v <= 0.25)
  g.add(buildCanvasQuadMesh(
    SUNFLOWERS_ASPECT,
    [[-0.06, -0.02, 160], [1.06, -0.02, 160], [1.06, 0.25, 520], [-0.06, 0.25, 520]],
    mat,
    VASE_OCHRE,
    'sunflowers-table-backing',
    540,
  ));
  // Warm cream-gold ceramic vase core backing (confined strictly inside the vase body so no dark trapezoid protrudes behind the blooms)
  g.add(buildCanvasQuadMesh(
    SUNFLOWERS_ASPECT,
    [[0.38, 0.16, 515], [0.62, 0.16, 515], [0.64, 0.42, 535], [0.36, 0.42, 535]],
    mat,
    0xf4e478,
    'sunflowers-bouquet-backing',
    545,
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
