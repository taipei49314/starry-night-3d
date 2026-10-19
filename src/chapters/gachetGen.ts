// Chapter V (Road — 奧維爾的路與風): Portrait of Dr. Gachet (Auvers-sur-Oise, June 1890), aspect = 0.81.
// "The heartbroken expression of our time":
// - Undulating two-toned ultramarine and cerulean-lilac Auvers backdrop swirls
// - Steeply tilted vermilion-red tabletop in the lower left foreground
// - Two chrome-yellow French novels & a sprig of purple-crimson Foxglove (Digitalis) in a glass
// - Dr. Gachet in his deep Prussian-blue coat and white peaked cap, leaning on his right hand in melancholic contemplation (Portal: uP = 0.54, v = 0.60).
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

export const GACHET_ASPECT = 0.81;
const P = PALETTE;

const TABLE_VERMILION = 0xd83e26;
const TABLE_CRIMSON = 0xa82418;
const COAT_PRUSSIAN = 0x162852;
const COAT_ULTRAMARINE = 0x28468c;
const CAP_WHITE = 0xe8edf2;
const FOXGLOVE_PURPLE = 0x9e3886;
const BOOK_YELLOW = 0xf2c830;
const FLESH_PALE = 0xe6c8b0;

/** 1. Undulating Two-Toned Ultramarine & Cerulean-Lilac Backdrop (UNDERPAINT & SKY_SWIRL). */
function genUndulatingBlueBackdrop(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < 6000; i++) {
    const uP = rng.range(-0.12, 1.12);
    const v = rng.range(0.20, 1.06);
    const d = rng.range(230000, 250000);
    const cA = mixHex(COAT_ULTRAMARINE, P.cerulean, rng.range(0.25, 0.75));
    const cB = P.cobalt;
    emitCanvasStroke(
      sink, GACHET_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.048, 0.088), rng.range(-0.3, 0.3), rng.range(0.024, 0.042),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // Diagonal wave-like Auvers background curves (SKY_SWIRL [98..166 km])
  for (let i = 0; i < 19500; i++) {
    const uP = rng.range(-0.08, 1.08);
    const v = rng.range(0.26, 1.04);
    const d = rng.range(98000, 166000);
    // Diagonal wave boundary separating deeper cobalt upper-left from lighter cerulean-lilac right
    const waveBoundary = 0.52 + 0.22 * (uP - 0.5) + 0.06 * Math.sin(uP * 9.0);
    const isUpperWave = v > waveBoundary;
    const ang = 0.42 + 0.35 * Math.cos(uP * 8.0 + v * 5.0) + rng.range(-0.12, 0.12);
    const cA = isUpperWave
      ? shadeHex(mixHex(COAT_ULTRAMARINE, P.cobalt, rng.range(0.25, 0.80)), rng.range(0.88, 1.14))
      : shadeHex(mixHex(P.cerulean, P.blueGreen, rng.range(0.25, 0.75)), rng.range(0.90, 1.14));
    const cB = isUpperWave ? COAT_PRUSSIAN : CAP_WHITE;

    emitCanvasStroke(
      sink, GACHET_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.015, 0.030), ang, rng.range(0.0050, 0.0095),
      cA, cB, rng,
      { q1: 0.24, q2: i & 3, q3: rng.next() },
    );
  }
}

/** 2. Tilted Vermilion-Red Tabletop, Two Yellow Novels & Purple Foxglove Stem (GROUND, HOUSE, GROVE & WINDOW). */
function genVermilionTableAndFoxglove(sink: StrokeSink, rng: Rng): void {
  const nUp = new Vector3(0.18, 0.92, 0.35).normalize();
  const nFront = new Vector3(0, 0, 1);
  const tHoriz = new Vector3(1, 0.22, 0).normalize();

  // Tilted vermilion-crimson tabletop occupying the lower-left diagonal (uP < 0.64, v < 0.45 - 0.28 * uP, GROUND [201..510 m])
  for (let i = 0; i < 12500; i++) {
    const uP = rng.range(-0.04, 0.66);
    const vMax = 0.44 - 0.30 * Math.max(0, uP);
    const t = rng.next();
    const v = 0.002 + vMax * t;
    const d = clamp(206 + 298 * t + rng.range(-5, 5), 201, 510);
    const cA = shadeHex(mixHex(TABLE_VERMILION, TABLE_CRIMSON, rng.range(0.2, 0.75)), rng.range(0.88, 1.14));
    const cB = mixHex(P.ochre, BOOK_YELLOW, 0.35);

    emitCanvasStroke(
      sink, GACHET_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.016, 0.032), -0.32 + rng.range(-0.14, 0.14), rng.range(0.0052, 0.0096),
      cA, cB, rng,
      { q1: nUp.x, q2: nUp.y, q3: nUp.z, emissive: 0.24 },
    );
  }

  // Two Chrome-Yellow Paperback Novels on the red table (uP = 0.12..0.38, v = 0.10..0.28, d = 460..485 m, HOUSE)
  for (let i = 0; i < 1800; i++) {
    const uP = rng.range(0.12, 0.38);
    const v = rng.range(0.10, 0.27) - 0.12 * (uP - 0.25);
    const d = rng.range(460, 482);
    const cA = shadeHex(mixHex(BOOK_YELLOW, P.lemon, rng.range(0.25, 0.85)), rng.range(0.92, 1.12));
    emitSurfaceStroke(
      sink, GACHET_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.012, 0.022), rng.range(0.0042, 0.0076),
      tHoriz, nUp, cA, P.ochre, rng,
      { emissive: 0.48 },
    );
  }

  // Sprig of Medicinal Foxglove (Digitalis purpurea): emerald stem/leaves (GROVE) & bell-shaped purple blossoms (WINDOW)
  for (let i = 0; i < 1400; i++) {
    const s = rng.next();
    const uP = 0.24 + 0.18 * s + rng.range(-0.025, 0.025);
    const v = 0.18 + 0.28 * s + 0.03 * Math.sin(s * 6.0) + rng.range(-0.02, 0.02);
    const d = 458 + 18 * (1 - s);
    const isBlossom = s > 0.38 && (i % 3 !== 0);
    if (isBlossom) {
      const cA = shadeHex(mixHex(FOXGLOVE_PURPLE, CAP_WHITE, rng.range(0.15, 0.55)), rng.range(0.90, 1.15));
      emitSurfaceStroke(
        sink, GACHET_ASPECT, StrokeClass.WINDOW, uP, v, d,
        0.011, 0.0042,
        tHoriz, nFront, cA, TABLE_VERMILION, rng,
        { emissive: 1.55 },
      );
    } else {
      emitCanvasStroke(
        sink, GACHET_ASPECT, StrokeClass.GROVE, uP, v, d,
        0.014, 0.85 + rng.range(-0.2, 0.2), 0.0045,
        P.groveLight, P.grove, rng,
        { emissive: 0.25 },
      );
    }
  }
}

/** 3. Dr. Gachet: Prussian-Blue Coat, Leaning Hand, Melancholic Face & White Peaked Cap (HOUSE & WINDOW). */
function genDoctorGachetFigure(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);
  const tDir = new Vector3(0, 1, 0);
  const tHoriz = new Vector3(1, 0, 0);

  // Deep Prussian & Ultramarine Double-Breasted Coat + Leaning Right Forearm Sleeve (uP = 0.34..0.92, v = 0.02..0.54, d = 468..535 m, HOUSE)
  for (let i = 0; i < 13000; i++) {
    const isRightSleeve = i >= 10500;
    let uP: number, v: number, d: number, strokeAng: number, cA: number, cB: number, isOutline = false;

    if (isRightSleeve) {
      // Right elbow resting on red table at (0.43, 0.20) rising to wrist at (0.49, 0.45)
      const s = rng.next();
      const sleeveW = 0.056 - 0.016 * s;
      const uRel = rng.range(-1, 1);
      uP = 0.43 + 0.06 * s + uRel * sleeveW;
      v = 0.19 + 0.26 * s + rng.range(-0.012, 0.012);
      d = 464 + 18 * (uRel * uRel) + rng.range(-4, 4);
      strokeAng = Math.atan2(0.26, 0.06 * GACHET_ASPECT) + 0.25 * uRel + rng.range(-0.14, 0.14);
      cA = shadeHex(mixHex(COAT_PRUSSIAN, COAT_ULTRAMARINE, 0.35 + 0.45 * Math.max(0, -uRel)), rng.range(0.88, 1.14));
      cB = P.cerulean;
      isOutline = Math.abs(uRel) > 0.78;
    } else {
      const tV = rng.next(); // 0 = bottom torso (0.02), 1 = rounded shoulders/collar (0.54)
      v = 0.02 + 0.52 * tV;
      // Curved shoulder contour tapering smoothly at top
      const shoulderArc = Math.sin(Math.min(1, (1 - tV * 0.78) * 1.22) * Math.PI * 0.5);
      const uMin = 0.36 + 0.11 * (1 - shoulderArc);
      const uMax = 0.92 - 0.18 * (1 - shoulderArc);
      uP = rng.range(uMin, uMax);
      d = 472 + 45 * Math.abs(uP - 0.62) + rng.range(-7, 7);

      // Expressive undulating contour folds along the sleeves and lapels
      const isLapelEdge = Math.abs(uP - (0.55 + 0.04 * tV)) < 0.032 && tV > 0.38;
      cA = isLapelEdge
        ? P.prussian
        : shadeHex(mixHex(COAT_PRUSSIAN, COAT_ULTRAMARINE, rng.range(0.2, 0.85)), rng.range(0.86, 1.15));
      cB = P.cerulean;
      strokeAng = 1.72 - 0.35 * (uP - 0.62) + 0.15 * Math.sin(tV * 8.0) + rng.range(-0.14, 0.14);
      isOutline = isLapelEdge || uP < uMin + 0.022 || uP > uMax - 0.022;
    }

    tDir.set(Math.cos(strokeAng), Math.sin(strokeAng), 0).normalize();
    emitSurfaceStroke(
      sink, GACHET_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.014, 0.027), rng.range(0.0046, 0.0086),
      tDir, nFront, cA, cB, rng,
      { flags: isOutline ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: 0.16 },
    );
  }

  // Tilted Head, Supporting Right Hand, Red-Gold Mustache & Curved White Peaked Cap (uP = 0.42..0.74, v = 0.42..0.86, d = 458..498 m, HOUSE)
  for (let i = 0; i < 10200; i++) {
    const tV = rng.next(); // 0 = supporting hand & wrist (0.42), 1 = white cap crown (0.86)
    const v = 0.42 + 0.44 * tV;
    const uRel = rng.range(-1, 1);

    // Smoothly contoured width & center curve for hand -> tilted oval face -> curved cap
    let uCenter: number;
    let halfW: number;
    if (tV < 0.25) {
      // Supporting right hand & curled fingers against the doctor's right cheek/temple
      const hT = tV / 0.25;
      uCenter = 0.49 + 0.02 * hT;
      halfW = 0.048 + 0.024 * Math.sin(hT * Math.PI);
    } else if (tV <= 0.71) {
      // Tilted oval melancholic face
      const fT = (tV - 0.25) / 0.46; // 0 = chin/goatee, 0.55 = cheekbones/eyes, 1 = brow under visor
      uCenter = 0.54 + 0.045 * fT;
      const oval = Math.sqrt(Math.max(0.14, 1 - Math.pow(fT * 2 - 1, 2)));
      halfW = 0.112 * (0.66 + 0.34 * oval);
    } else {
      // Curved white peaked cap dome
      const cT = (tV - 0.71) / 0.29;
      uCenter = 0.585 + 0.015 * cT;
      halfW = 0.136 * Math.sqrt(Math.max(0.16, 1 - cT * cT * 0.85));
    }

    const uP = uCenter + uRel * halfW;
    const d = 461 + 26 * (uRel * uRel) + rng.range(-5, 5);

    const isWhiteCap = tV > 0.71;
    const isVisor = tV > 0.66 && tV <= 0.72 && uRel < 0.42;
    const isSupportingHand = tV < 0.25 || (tV < 0.48 && uRel < -0.52);
    const isMustacheOrHair =
      (!isSupportingHand && tV > 0.34 && tV < 0.45 && Math.abs(uRel) < 0.46)
      || (tV > 0.54 && tV <= 0.71 && uRel > 0.44);
    const isNoseBridge = !isSupportingHand && tV >= 0.44 && tV <= 0.62 && Math.abs(uRel + 0.10) < 0.15;

    let cA: number, cB: number, em = 0.28;
    let strokeAng = 1.72;
    if (isWhiteCap) {
      cA = shadeHex(mixHex(CAP_WHITE, P.cerulean, rng.range(0.10, 0.35)), rng.range(0.94, 1.10));
      cB = BOOK_YELLOW;
      em = 0.46;
      strokeAng = -0.25 * uRel + rng.range(-0.15, 0.15);
    } else if (isVisor) {
      cA = COAT_PRUSSIAN;
      cB = P.cobalt;
      em = 0.14;
      strokeAng = -0.18 + rng.range(-0.10, 0.10);
    } else if (isSupportingHand) {
      const isFingerCrease = Math.abs((uRel * 4) - Math.round(uRel * 4)) < 0.16;
      cA = shadeHex(mixHex(FLESH_PALE, isFingerCrease ? TABLE_VERMILION : P.lemon, isFingerCrease ? 0.28 : 0.22), rng.range(0.88, 1.12));
      cB = P.ochre;
      em = 0.30;
      strokeAng = Math.PI * 0.5 - 0.22 * uRel + rng.range(-0.14, 0.14);
    } else if (isMustacheOrHair) {
      cA = shadeHex(mixHex(TABLE_VERMILION, BOOK_YELLOW, rng.range(0.3, 0.75)), rng.range(0.90, 1.12));
      cB = P.ochre;
      em = 0.35;
      strokeAng = Math.PI * 0.5 + 0.48 * uRel + rng.range(-0.16, 0.16);
    } else if (isNoseBridge) {
      cA = shadeHex(mixHex(FLESH_PALE, CAP_WHITE, 0.35), rng.range(0.95, 1.12));
      cB = P.lemon;
      em = 0.38;
      strokeAng = 1.45 + rng.range(-0.08, 0.08);
    } else {
      cA = shadeHex(mixHex(FLESH_PALE, P.lemon, rng.range(0.12, 0.38)), rng.range(0.90, 1.12));
      cB = P.cerulean;
      em = 0.32;
      strokeAng = 1.65 - 0.32 * uRel + rng.range(-0.14, 0.14);
    }

    tDir.set(Math.cos(strokeAng), Math.sin(strokeAng), 0).normalize();
    emitSurfaceStroke(
      sink, GACHET_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.0095, 0.019), rng.range(0.0035, 0.0066),
      tDir, nFront, cA, cB, rng,
      { flags: Math.abs(uRel) > 0.84 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: em },
    );
  }

  // Dr. Gachet's Melancholic Cobalt Eyes & Coat Buttons (WINDOW [455..465 m])
  const accents = [
    { u0: 0.52, v0: 0.60, r: 0.020, eye: true },
    { u0: 0.61, v0: 0.61, r: 0.020, eye: true },
    { u0: 0.55, v0: 0.32, r: 0.015, eye: false },
    { u0: 0.56, v0: 0.22, r: 0.015, eye: false },
  ];
  for (const ac of accents) {
    for (let i = 0; i < 320; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const rad = rng.range(0.002, ac.r);
      const uP = ac.u0 + Math.cos(ang) * rad;
      const v = ac.v0 + Math.sin(ang) * rad * 0.72;
      const d = 456 + rng.range(0, 5);
      const cA = ac.eye ? (rad < 0.006 ? CAP_WHITE : P.cobalt) : BOOK_YELLOW;
      const cB = ac.eye ? P.cerulean : P.lemon;
      emitSurfaceStroke(
        sink, GACHET_ASPECT, StrokeClass.WINDOW, uP, v, d,
        0.008, 0.0032,
        tHoriz, nFront, cA, cB, rng,
        { emissive: ac.eye && rad < 0.006 ? 2.8 : 1.55 },
      );
    }
  }
}

function buildGachetUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:gachet';
  g.add(buildCanvasQuadMesh(
    GACHET_ASPECT,
    [[-0.04, 0.0, 165], [1.04, 0.0, 165], [0.96, 0.86, 540], [0.04, 0.86, 540]],
    mat,
    0x1c2f5e,
    'gachet-backing',
  ));
  return g;
}

export function generateGachetChapter(
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

  time('backdrop', () => genUndulatingBlueBackdrop(sink, forkRng(seed, 'gachet:backdrop')));
  time('table', () => genVermilionTableAndFoxglove(sink, forkRng(seed, 'gachet:table')));
  time('figure', () => genDoctorGachetFigure(sink, forkRng(seed, 'gachet:figure')));

  const underlays = buildGachetUnderlays(mat);
  const steepleTip = canvasToWorld(uFromPaint(0.54, GACHET_ASPECT), 0.60, 460);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.54, GACHET_ASPECT), 0.32, 472),
    steepleTip,
  };
  return { underlays, village, timings };
}
