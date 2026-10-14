// Chapter II (Color — 巴黎與覺醒): Boulevard de Clichy (Paris, Feb–Mar 1887), aspect = 1.29.
// The awakening of color: Van Gogh's eyes open to Impressionism and Pointillism in Paris.
// Short, rhythmic divisionist strokes in luminous lavender-blue, peach-coral, turquoise, lemon, and spring viridian:
// wide Parisian avenue converging toward the sunlit horizon portal (uP=0.46, v=0.42), Haussmann apartment facades,
// budding boulevard trees, and strolling Parisian silhouettes.
import { Group, Vector3 } from 'three';
import {
  PALETTE, StrokeClass, StrokeFlag,
  type QualitySettings, type Rng, type SharedUniforms, type StrokeSink, type UnderlayMaterialFactory, type VillageInfo,
} from '../contracts';
import { canvasToWorld } from '../shared/canvasSpace';
import { forkRng } from '../shared/rng';
import {
  buildCanvasQuadMesh, clamp, emitCanvasStroke, emitCustomStar, emitSurfaceStroke,
  mixHex, shadeHex, uFromPaint,
} from './types';

export const PARIS_ASPECT = 1.29;
const P = PALETTE;

const SKY_PASTEL_BLUE = 0x8ec2dc;
const SKY_PEACH = 0xf4d4be;
const SKY_LAVENDER = 0x9eb2dc;
const PAVEMENT_LILAC = 0x8e9ec6;
const PAVEMENT_CORAL = 0xe8b694;
const HAUSSMANN_CREAM = 0xdfd0b8;
const HAUSSMANN_SLATE = 0x627c9e;
const SPRING_BUD = 0x68b474;
const VERMILION_ACCENT = 0xd84e38;

/** 1. Luminous Parisian Divisionist Sky & Sunlit Horizon Portal (uP = 0.46, v = 0.56). */
function genParisSky(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < 6000; i++) {
    const uP = rng.range(-0.12, 1.12);
    const v = rng.range(0.38, 1.08);
    const d = rng.range(230000, 250000);
    const cA = mixHex(SKY_PASTEL_BLUE, P.zincWhite, rng.range(0.25, 0.75));
    const cB = mixHex(SKY_PEACH, SKY_LAVENDER, rng.range(0.2, 0.8));
    emitCanvasStroke(
      sink, PARIS_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.044, 0.082), rng.range(-0.3, 0.3), rng.range(0.022, 0.038),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // Short, rhythmic Pointillist / Divisionist sky dabs (SKY_BAND [96..168 km])
  const nSky = 23000;
  for (let i = 0; i < nSky; i++) {
    const uP = rng.range(-0.08, 1.08);
    const v = rng.range(0.40, 1.05);
    const d = rng.range(98000, 166000);
    // Complementary color vibration: alternating cool turquoise/lavender and warm peach/cream dabs
    const warmDab = (i & 3) === 0;
    const cA = warmDab
      ? shadeHex(mixHex(SKY_PEACH, P.lemon, rng.range(0.15, 0.55)), rng.range(0.94, 1.10))
      : shadeHex(mixHex(SKY_PASTEL_BLUE, P.zincWhite, rng.range(0.25, 0.75)), rng.range(0.92, 1.08));
    const cB = warmDab ? P.zincWhite : SKY_LAVENDER;
    const ang = rng.range(-0.35, 0.35);
    emitCanvasStroke(
      sink, PARIS_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.011, 0.022), ang, rng.range(0.0045, 0.0085),
      cA, cB, rng,
      { q1: 0.14, q2: i & 3, q3: rng.next() },
    );
  }

  // Radiant Parisian morning sun-haze at the end of the boulevard (uP = 0.46, v = 0.56)
  emitCustomStar(sink, PARIS_ASPECT, 0.46, 0.56, 13200, 0.024, 7, 1.15, rng, P.lemon);
}

/** 2. Pointillist Boulevard Pavement converging toward (0.46, 0.42) & Strolling Parisian Figures. */
function genBoulevardAndFigures(sink: StrokeSink, rng: Rng): void {
  const nUp = new Vector3(0, 1, 0.14).normalize();

  // Wide avenue floor in shimmering divisionist strokes of lilac-blue, coral-peach, and sunlit ochre (GROUND [155..1,650 m])
  const nGround = 24000;
  for (let i = 0; i < nGround; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.42 * t;
    const d = clamp(156 + 1420 * (t * t) + rng.range(-8, 8), 154, 1650);

    // Perspective lines radiating from vanishing point (0.46, 0.42)
    const dx = (0.46 - uP) * PARIS_ASPECT;
    const dy = 0.42 - v;
    const perspAng = Math.atan2(dy, dx);

    const mode = i % 5;
    const cA = mode === 0
      ? PAVEMENT_CORAL
      : mode === 1
        ? PAVEMENT_LILAC
        : mode === 2
          ? mixHex(P.lemon, HAUSSMANN_CREAM, 0.6)
          : mode === 3
            ? SKY_PASTEL_BLUE
            : mixHex(P.ochre, PAVEMENT_CORAL, 0.5);
    const cB = mode < 2 ? P.zincWhite : PAVEMENT_LILAC;

    emitCanvasStroke(
      sink, PARIS_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.010, 0.021), perspAng + rng.range(-0.12, 0.12), rng.range(0.0038, 0.0072),
      cA, cB, rng,
      { q1: nUp.x, q2: nUp.y, q3: nUp.z, emissive: 0.15 },
    );
  }

  // Strolling Parisian pedestrians & horse-drawn carriage silhouettes along the boulevard (HOUSE [455..1,250 m])
  const walkers = [
    { u0: 0.34, v0: 0.18, h: 0.16, w: 0.022, d: 465, accent: VERMILION_ACCENT },
    { u0: 0.39, v0: 0.20, h: 0.15, w: 0.020, d: 495, accent: P.cobalt },
    { u0: 0.54, v0: 0.24, h: 0.13, w: 0.018, d: 580, accent: P.lemon },
    { u0: 0.62, v0: 0.21, h: 0.14, w: 0.020, d: 520, accent: VERMILION_ACCENT },
    { u0: 0.47, v0: 0.30, h: 0.09, w: 0.014, d: 820, accent: P.cerulean },
    { u0: 0.43, v0: 0.33, h: 0.08, w: 0.012, d: 960, accent: P.chrome },
  ];
  for (const wk of walkers) {
    for (let i = 0; i < 360; i++) {
      const tH = rng.next();
      const v = wk.v0 + wk.h * tH;
      const uP = wk.u0 + rng.range(-wk.w, wk.w) * (tH > 0.75 ? 0.65 : 1.0);
      const isHatOrParasol = tH > 0.78;
      const cA = isHatOrParasol ? wk.accent : mixHex(P.prussian, P.ultramarine, rng.range(0.2, 0.8));
      const cB = isHatOrParasol ? P.lemon : HAUSSMANN_SLATE;
      emitCanvasStroke(
        sink, PARIS_ASPECT, StrokeClass.HOUSE, uP, v, wk.d + rng.range(-6, 6),
        0.009, 1.57 + rng.range(-0.18, 0.18), 0.0032,
        cA, cB, rng,
        { emissive: isHatOrParasol ? 0.35 : 0.08 },
      );
    }
  }
}

/** 3. Haussmann Apartment Facades & Budding Spring Boulevard Trees (HOUSE, WINDOW, GROVE). */
function genHaussmannAndTrees(sink: StrokeSink, rng: Rng): void {
  const nLeft = new Vector3(0.84, 0, 0.54).normalize();
  const nRight = new Vector3(-0.84, 0, 0.54).normalize();
  const tVert = new Vector3(0, 1, 0);
  const tHoriz = new Vector3(1, 0, 0);

  // Receding Haussmannian limestone buildings on left (uP < 0.36) and right (uP > 0.58)
  for (let i = 0; i < 14000; i++) {
    const side = rng.next() < 0.54 ? -1 : 1;
    const tRecede = rng.next(); // 0 = foreground (460 m), 1 = far avenue (1,550 m)
    const uP = side < 0
      ? 0.02 + 0.36 * tRecede + rng.range(-0.04, 0.02)
      : 0.98 - 0.42 * tRecede + rng.range(-0.02, 0.04);
    const vBase = 0.24 + 0.18 * tRecede;
    const vTop = 0.86 - 0.32 * tRecede;
    const v = rng.range(vBase, vTop);
    const d = 460 + 1080 * tRecede + rng.range(-12, 12);
    const isRoof = v > vTop - 0.08;
    const isAwning = v < vBase + 0.07;
    const cA = isRoof
      ? HAUSSMANN_SLATE
      : isAwning
        ? (rng.next() < 0.5 ? VERMILION_ACCENT : P.chrome)
        : shadeHex(mixHex(HAUSSMANN_CREAM, PAVEMENT_CORAL, rng.range(0.15, 0.55)), rng.range(0.90, 1.12));
    const cB = isRoof ? P.cobalt : P.zincWhite;

    emitSurfaceStroke(
      sink, PARIS_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.011, 0.022), rng.range(0.0036, 0.0068),
      isAwning ? tHoriz : tVert, side < 0 ? nLeft : nRight, cA, cB, rng,
      { emissive: isAwning ? 0.42 : 0.16 },
    );
  }

  // Sunlit Parisian balcony windows & shopfronts (WINDOW [460..1,450 m])
  for (let i = 0; i < 1600; i++) {
    const side = rng.next() < 0.5 ? -1 : 1;
    const tRecede = rng.next();
    const uP = side < 0 ? 0.06 + 0.32 * tRecede : 0.94 - 0.38 * tRecede;
    const v = rng.range(0.30 + 0.12 * tRecede, 0.72 - 0.22 * tRecede);
    const d = 465 + 980 * tRecede;
    const cA = rng.next() < 0.6 ? P.lemon : SKY_PASTEL_BLUE;
    emitCanvasStroke(
      sink, PARIS_ASPECT, StrokeClass.WINDOW, uP, v, d,
      0.010, 1.57, 0.0035,
      cA, P.zincWhite, rng, { emissive: 1.6 },
    );
  }

  // Rows of budding spring boulevard trees lining both sidewalks (GROVE [240..1,450 m])
  for (let i = 0; i < 9500; i++) {
    const side = rng.next() < 0.5 ? -1 : 1;
    const tRecede = rng.next();
    const uCenter = side < 0 ? 0.16 + 0.24 * tRecede : 0.82 - 0.28 * tRecede;
    const vBase = 0.22 + 0.19 * tRecede;
    const isCrown = rng.next() < 0.76;
    const uP = uCenter + rng.range(-0.055, 0.055) * (1 - 0.55 * tRecede) * (isCrown ? 1 : 0.18);
    const v = isCrown
      ? vBase + rng.range(0.10, 0.34) * (1 - 0.45 * tRecede)
      : vBase + rng.range(0.0, 0.12) * (1 - 0.45 * tRecede);
    const d = 260 + 1080 * tRecede + rng.range(-10, 10);
    const cA = isCrown
      ? shadeHex(mixHex(SPRING_BUD, P.lemon, rng.range(0.15, 0.55)), rng.range(0.90, 1.14))
      : HAUSSMANN_SLATE;
    const cB = isCrown ? SKY_PASTEL_BLUE : P.ochre;
    const ang = isCrown ? rng.range(0, Math.PI * 2) : 1.57 + rng.range(-0.1, 0.1);

    emitCanvasStroke(
      sink, PARIS_ASPECT, StrokeClass.GROVE, uP, v, d,
      rng.range(0.010, 0.020), ang, rng.range(0.0035, 0.0065),
      cA, cB, rng,
      { emissive: isCrown ? 0.28 : 0.08 },
    );
  }
}

function buildParisUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:paris';
  g.add(buildCanvasQuadMesh(
    PARIS_ASPECT,
    [[-0.04, 0.0, 155], [1.04, 0.0, 155], [0.68, 0.42, 1600], [0.24, 0.42, 1600]],
    mat,
    0x78829c,
    'paris-boulevard',
  ));
  return g;
}

export function generateParisChapter(
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

  time('sky', () => genParisSky(sink, forkRng(seed, 'paris:sky')));
  time('boulevard', () => genBoulevardAndFigures(sink, forkRng(seed, 'paris:blvd')));
  time('trees', () => genHaussmannAndTrees(sink, forkRng(seed, 'paris:trees')));

  const underlays = buildParisUnderlays(mat);
  const steepleTip = canvasToWorld(uFromPaint(0.46, PARIS_ASPECT), 0.56, 980);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.46, PARIS_ASPECT), 0.42, 980),
    steepleTip,
  };
  return { underlays, village, timings };
}
