// Chapter II (Color — 巴黎與覺醒): A Pair of Shoes (Paris, Autumn 1886), aspect = 1.25.
// 3D anamorphic still-life of two mud-caked, deeply creased peasant leather work boots resting on a Parisian studio floor.
// Heavy diagonal palette-knife strokes in burnt umber, raw sienna, olive-bronze, copper-rust, and warm golden-ochre
// light streaming from the upper right portal (uP = 0.62, v = 0.72), with untied laces snaking forward like a road.
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

export const SHOES_ASPECT = 1.25;
const P = PALETTE;

const UMBER_DARK = 0x1a1510;
const LEATHER_BROWN = 0x3b2a1c;
const LEATHER_RUST = 0x6e4326;
const SIENNA_WARM = 0x9c6b36;
const BURLAP_GOLD = 0xc89a4e;
const SOLE_COPPER = 0x7e4828;
const LACE_CREAM = 0xd6bfa0;

/** 1. Warm burlap-and-umber studio wall backdrop with upper-right golden threshold portal (uP = 0.62, v = 0.72). */
function genStudioBackdrop(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < 6000; i++) {
    const uP = rng.range(-0.10, 1.10);
    const v = rng.range(0.24, 1.06);
    const d = rng.range(230000, 250000);
    const cA = mixHex(UMBER_DARK, LEATHER_BROWN, rng.range(0.2, 0.85));
    const cB = SIENNA_WARM;
    emitCanvasStroke(
      sink, SHOES_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.048, 0.088), rng.range(-0.25, 0.25), rng.range(0.024, 0.042),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // Diagonal expressive studio background strokes (SKY_BAND [98..166 km])
  for (let i = 0; i < 16500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.42, 1.04);
    const d = rng.range(98000, 166000);
    const distPortal = Math.hypot((uP - 0.62) * SHOES_ASPECT, v - 0.72);
    const glow = Math.max(0, 1 - distPortal / 0.52);
    const ang = -0.32 + rng.range(-0.18, 0.18);
    const cA = shadeHex(
      mixHex(LEATHER_BROWN, BURLAP_GOLD, 0.18 + 0.68 * glow),
      rng.range(0.86, 1.14),
    );
    const cB = mixHex(UMBER_DARK, SIENNA_WARM, 0.35 + 0.5 * glow);
    emitCanvasStroke(
      sink, SHOES_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.018, 0.036), ang, rng.range(0.0060, 0.0115),
      cA, cB, rng,
      { q1: 0.10, q2: i & 3, q3: rng.next() },
    );
  }
}

/** 2. Earthen studio floor planks & cast shadows beneath the boots (GROUND [530..930 m]). */
function genEarthenStudioFloor(sink: StrokeSink, rng: Rng): void {
  const nUp = new Vector3(0, 1, 0.16).normalize();

  for (let i = 0; i < 18500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.12);
    const v = 0.002 + 0.46 * t;
    const d = clamp(540 + 380 * t + rng.range(-6, 6), 530, 930);

    // Deep grounding shadow directly under the two boots
    const inLeftShadow = Math.hypot((uP - 0.36) * 1.3, (v - 0.21) * 2.4) < 0.22;
    const inRightShadow = Math.hypot((uP - 0.61) * 1.2, (v - 0.19) * 2.4) < 0.24;
    const isShadow = inLeftShadow || inRightShadow;

    const cA = isShadow
      ? shadeHex(UMBER_DARK, rng.range(0.80, 1.08))
      : shadeHex(mixHex(LEATHER_BROWN, BURLAP_GOLD, rng.range(0.22, 0.68)), rng.range(0.88, 1.14));
    const cB = isShadow ? LEATHER_BROWN : SIENNA_WARM;
    const ang = rng.range(-0.26, 0.22);

    emitCanvasStroke(
      sink, SHOES_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.016, 0.034), ang, rng.range(0.0052, 0.0098),
      cA, cB, rng,
      { q1: nUp.x, q2: nUp.y, q3: nUp.z, emissive: isShadow ? 0.04 : 0.16 },
    );
  }
}

/** 3. The Two Sculptural Peasant Leather Boots & Untied Trailing Laces (HOUSE & WINDOW [455..560 m]). */
function genLeatherBootsAndLaces(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0.15, 0.99).normalize();
  const tVert = new Vector3(0.12, 0.99, 0).normalize();
  const tHoriz = new Vector3(0.96, -0.22, 0).normalize();

  // Left Boot (upright, uP = 0.24..0.48, v = 0.20..0.64, d = 460..520 m): deep ankle folds & rounded worn toe box
  for (let i = 0; i < 8200; i++) {
    const tH = rng.next(); // 0 = sole/toe, 1 = open folded cuff
    const v = 0.20 + 0.44 * tH;
    const uCenter = tH < 0.38 ? 0.35 - 0.04 * (1 - tH / 0.38) : 0.37 + 0.02 * Math.sin(tH * 5.0);
    const halfW = tH < 0.35 ? 0.115 : tH > 0.78 ? 0.095 : 0.082;
    const uRel = rng.range(-1, 1);
    const uP = uCenter + uRel * halfW;
    const d = 462 + 48 * tH + rng.range(-8, 8);

    // Creased leather ridges across the vamp and warm ochre toe-highlight
    const creaseWave = Math.sin((v - 0.22) * 48 + uRel * 2.5);
    const isToeHighlight = tH < 0.32 && Math.abs(uRel + 0.15) < 0.48;
    const isOpenCuff = tH > 0.82 && Math.abs(uRel) < 0.65;
    const isSoleEdge = tH < 0.08;

    let cA: number, cB: number, em = 0.14;
    if (isOpenCuff) {
      cA = mixHex(UMBER_DARK, SOLE_COPPER, 0.45);
      cB = LEATHER_RUST;
    } else if (isSoleEdge) {
      cA = SOLE_COPPER;
      cB = UMBER_DARK;
      em = 0.22;
    } else if (isToeHighlight || creaseWave > 0.55) {
      cA = shadeHex(mixHex(SIENNA_WARM, BURLAP_GOLD, rng.range(0.25, 0.75)), rng.range(0.90, 1.15));
      cB = LEATHER_RUST;
      em = 0.34;
    } else {
      cA = shadeHex(mixHex(UMBER_DARK, LEATHER_BROWN, rng.range(0.25, 0.85)), rng.range(0.85, 1.12));
      cB = LEATHER_RUST;
    }

    emitSurfaceStroke(
      sink, SHOES_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.012, 0.025), rng.range(0.0042, 0.0082),
      tH < 0.42 ? tHoriz : tVert, nFront, cA, cB, rng,
      { flags: Math.abs(uRel) > 0.82 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: em },
    );
  }

  // Right Boot (tilted slightly sideways showing the worn copper-rust sole & heel, uP = 0.49..0.76, v = 0.16..0.56)
  for (let i = 0; i < 8200; i++) {
    const tH = rng.next();
    const v = 0.16 + 0.40 * tH;
    const uCenter = 0.62 - 0.05 * tH + 0.02 * Math.cos(tH * 4.2);
    const halfW = tH < 0.42 ? 0.125 : 0.088;
    const uRel = rng.range(-1, 1);
    const uP = uCenter + uRel * halfW;
    const d = 458 + 52 * tH + rng.range(-8, 8);

    const isHobnailSole = tH < 0.26 && uRel > -0.25;
    const isHobnailStud = isHobnailSole && ((i % 7) === 0);
    const isSunlightEdge = uRel > 0.35 && tH > 0.28;

    let cA: number, cB: number, em = 0.15;
    if (isHobnailStud) {
      cA = P.lemon;
      cB = BURLAP_GOLD;
      em = 0.65;
    } else if (isHobnailSole) {
      cA = shadeHex(mixHex(SOLE_COPPER, SIENNA_WARM, rng.range(0.2, 0.65)), rng.range(0.88, 1.12));
      cB = UMBER_DARK;
      em = 0.28;
    } else if (isSunlightEdge) {
      cA = shadeHex(mixHex(BURLAP_GOLD, SIENNA_WARM, rng.range(0.3, 0.8)), rng.range(0.92, 1.14));
      cB = LEATHER_RUST;
      em = 0.38;
    } else {
      cA = shadeHex(mixHex(UMBER_DARK, LEATHER_BROWN, rng.range(0.2, 0.8)), rng.range(0.86, 1.12));
      cB = SOLE_COPPER;
    }

    emitSurfaceStroke(
      sink, SHOES_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.012, 0.024), rng.range(0.0040, 0.0078),
      tH < 0.35 ? tHoriz : tVert, nFront, cA, cB, rng,
      { flags: Math.abs(uRel) > 0.82 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: em },
    );
  }

  // Untied leather shoelaces snaking across the foreground floor & brass eyelets (HOUSE [442..470 m])
  for (let i = 0; i < 1600; i++) {
    const s = i / 1600;
    const isLeftLace = (i & 1) === 0;
    const uP = isLeftLace
      ? 0.41 + 0.14 * s + 0.03 * Math.sin(s * 9.0) + rng.range(-0.006, 0.006)
      : 0.56 + 0.18 * s - 0.03 * Math.cos(s * 8.0) + rng.range(-0.006, 0.006);
    const v = isLeftLace
      ? 0.42 - 0.26 * s + 0.02 * Math.cos(s * 7.0) + rng.range(-0.005, 0.005)
      : 0.38 - 0.22 * s + 0.02 * Math.sin(s * 10.0) + rng.range(-0.005, 0.005);
    const d = 442 + 25 * (1 - s);
    const cA = mixHex(LACE_CREAM, BURLAP_GOLD, rng.range(0.25, 0.75));
    emitSurfaceStroke(
      sink, SHOES_ASPECT, StrokeClass.HOUSE, uP, v, d,
      0.012, 0.0038,
      tHoriz, nFront, cA, SIENNA_WARM, rng,
      { emissive: 0.22 },
    );
  }
  // Cloisonnist dark umber & copper-sole contours around both peasant leather boots + trailing laces
  emitPathStrokes(
    sink, SHOES_ASPECT, StrokeClass.HOUSE,
    [[0.27, 0.63], [0.26, 0.38], [0.22, 0.24], [0.26, 0.19], [0.45, 0.20], [0.46, 0.62]],
    452, 180, 0.015, 0.0052, UMBER_DARK, SOLE_COPPER, rng, { spread: 0.003 },
  );
  emitPathStrokes(
    sink, SHOES_ASPECT, StrokeClass.HOUSE,
    [[0.51, 0.55], [0.49, 0.22], [0.54, 0.16], [0.74, 0.20], [0.72, 0.34], [0.66, 0.55]],
    450, 180, 0.015, 0.0052, UMBER_DARK, SOLE_COPPER, rng, { spread: 0.003 },
  );
  emitPathStrokes(
    sink, SHOES_ASPECT, StrokeClass.HOUSE,
    [[0.42, 0.40], [0.47, 0.28], [0.44, 0.18], [0.54, 0.12]],
    440, 85, 0.012, 0.0038, LACE_CREAM, UMBER_DARK, rng, { spread: 0.002 },
  );
  emitPathStrokes(
    sink, SHOES_ASPECT, StrokeClass.HOUSE,
    [[0.58, 0.36], [0.68, 0.26], [0.77, 0.16], [0.72, 0.11]],
    440, 85, 0.012, 0.0038, LACE_CREAM, UMBER_DARK, rng, { spread: 0.002 },
  );
}

function buildShoesUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:shoes';
  // Warm burlap studio wall backing placed behind SKY_BAND (98-166 km) so the golden portal backdrop shines
  g.add(buildCanvasQuadMesh(
    SHOES_ASPECT,
    [[-0.06, 0.40, 220000], [1.06, 0.40, 220000], [1.06, 1.04, 220000], [-0.06, 1.04, 220000]],
    mat,
    0x3b2a1c,
    'shoes-wall',
    220000,
  ));
  // Earthen studio floor backing below v = 0.46 (behind GROUND 530..930 m)
  g.add(buildCanvasQuadMesh(
    SHOES_ASPECT,
    [[-0.04, 0.0, 540], [1.04, 0.0, 540], [1.02, 0.45, 940], [-0.02, 0.45, 940]],
    mat,
    0x261c14,
    'shoes-floor',
    960,
  ));
  return g;
}

export function generateShoesChapter(
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

  time('backdrop', () => genStudioBackdrop(sink, forkRng(seed, 'shoes:backdrop')));
  time('floor', () => genEarthenStudioFloor(sink, forkRng(seed, 'shoes:floor')));
  time('boots', () => genLeatherBootsAndLaces(sink, forkRng(seed, 'shoes:boots')));

  const underlays = buildShoesUnderlays(mat);
  const steepleTip = canvasToWorld(uFromPaint(0.62, SHOES_ASPECT), 0.72, 470);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.48, SHOES_ASPECT), 0.26, 475),
    steepleTip,
  };
  return { underlays, village, timings };
}
