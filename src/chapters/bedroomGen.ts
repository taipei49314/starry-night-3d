// Chapter III: The Bedroom in Arles (Arles, Yellow House, Oct 1888 / Saint-Rémy 1889), aspect = 1.26.
// 3D anamorphic interior: perspective ochre-and-olive floorboards (208-520 m), pale violet-blue plaster walls (215-590 m),
// the scarlet-blanketed golden-oak bed on the right (208-485 m), two yellow cane chairs (245 m & 395 m), washstand table
// with ceramic pitcher (445 m), framed portraits on the walls, and the half-open green shuttered window portal (506-555 m).
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

export const BEDROOM_ASPECT = 1.26;
const P = PALETTE;

const WALL_LAVENDER = 0x6a86ba;
const WALL_COBALT = 0x526ea4;
const WALL_LILAC = 0x7e96c6;
const SCARLET_A = 0xd82e20;
const SCARLET_B = 0xb51e14;
const SHUTTER_GREEN = 0x2c6e44;
const SHUTTER_LIGHT = 0x428a58;
const FLOOR_SIENNA = 0xc68252;
const FLOOR_OLIVE = 0x7c8652;
const WOOD_DARK = 0x5c3a1e;

/** Outer sunlit Provençal garden & sky glow visible through the half-open green window portal (uP in [0.35, 0.45], v in [0.48, 0.80]). */
function genWindowPortalSky(sink: StrokeSink, rng: Rng): void {
  // Warm sunlit yellow-green casement glow behind the window frame + subtle lavender wall backing
  for (let i = 0; i < 6500; i++) {
    const uP = rng.range(-0.08, 1.08);
    const v = rng.range(0.20, 1.04);
    const inPortal = uP > 0.30 && uP < 0.50 && v > 0.44 && v < 0.84;
    const d = rng.range(230000, 250000);
    const cA = inPortal ? mixHex(SHUTTER_LIGHT, P.lemon, rng.range(0.35, 0.78)) : shadeHex(WALL_LAVENDER, rng.range(0.82, 1.05));
    const cB = inPortal ? P.chrome : WALL_COBALT;
    emitCanvasStroke(sink, BEDROOM_ASPECT, StrokeClass.UNDERPAINT, uP, v, d, rng.range(0.045, 0.085), rng.range(-0.2, 0.2), rng.range(0.022, 0.038), cA, cB, rng, {
      flags: StrokeFlag.UNDERLAYER,
    });
  }

  // Impasto lavender-blue plaster strokes across the upper room envelope (HILL class 2,000-5,600 m for distant wall depth)
  const nWallFar = 14000;
  for (let i = 0; i < nWallFar; i++) {
    const uP = rng.range(-0.04, 1.04);
    const v = rng.range(0.32, 1.02);
    if (uP > 0.34 && uP < 0.46 && v > 0.48 && v < 0.80) continue; // leave window portal open
    const d = rng.range(2200, 4800);
    const cA = shadeHex(rng.next() < 0.55 ? WALL_LAVENDER : WALL_LILAC, rng.range(0.88, 1.12));
    const cB = shadeHex(WALL_COBALT, rng.range(0.88, 1.08));
    emitCanvasStroke(sink, BEDROOM_ASPECT, StrokeClass.HILL, uP, v, d, rng.range(0.016, 0.034), rng.range(-0.18, 0.18), rng.range(0.0055, 0.0105), cA, cB, rng);
  }
}

/** Perspective wooden floorboards (GROUND class [205..520 m]). */
function genBedroomFloor(sink: StrokeSink, rng: Rng): void {
  const N = new Vector3(0, 1, 0.14).normalize();
  const T = new Vector3(0.15, 0.25, -0.95).normalize();

  // Base floor underlayers
  for (let i = 0; i < 4800; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.0 + 0.36 * t;
    const d = clamp(208 + 306 * t + rng.range(-5, 5), 204, 520);
    const cA = mixHex(FLOOR_SIENNA, P.ochre, rng.range(0.2, 0.7));
    const cB = mixHex(FLOOR_OLIVE, P.varnish, rng.range(0.2, 0.6));
    emitCanvasStroke(sink, BEDROOM_ASPECT, StrokeClass.GROUND, uP, v, d, rng.range(0.028, 0.052), rng.range(-0.15, 0.15), rng.range(0.012, 0.022), cA, cB, rng, {
      flags: StrokeFlag.UNDERLAYER,
    });
  }

  // Converging wooden floor planks and dark green/brown plank seams
  const nPlanks = 21000;
  for (let i = 0; i < nPlanks; i++) {
    const uP = rng.range(-0.02, 1.02);
    const t = Math.pow(rng.next(), 1.1);
    const v = 0.002 + 0.35 * t;
    const d = clamp(208 + 304 * t + rng.range(-4, 4), 205, 515);
    // Perspective angle converging toward vanishing point (0.42, 0.58)
    const dx = (0.42 - uP) * BEDROOM_ASPECT;
    const dy = 0.58 - v;
    const perspAng = Math.atan2(dy, dx);
    const plankIdx = Math.floor((uP - 0.42) * 14);
    const isSeam = Math.abs((uP - 0.42) * 14 - plankIdx - 0.5) < 0.09;
    const cA = isSeam
      ? mixHex(WOOD_DARK, P.cypressGreen, rng.range(0.25, 0.65))
      : shadeHex(mixHex(FLOOR_SIENNA, P.ochre, 0.35 + 0.35 * Math.sin(plankIdx * 1.7)), rng.range(0.88, 1.12));
    const cB = isSeam
      ? P.outline
      : shadeHex(mixHex(FLOOR_OLIVE, P.chrome, rng.range(0.2, 0.65)), rng.range(0.88, 1.10));
    emitCanvasStroke(
      sink, BEDROOM_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.014, 0.030), perspAng + rng.range(-0.06, 0.06), rng.range(0.0038, 0.0072),
      cA, cB, rng,
      { flags: isSeam ? StrokeFlag.OUTLINE : StrokeFlag.NONE, q1: N.x, q2: N.y, q3: N.z },
    );
  }

  // Red-brown baseboard along the back and left walls
  for (let i = 0; i < 1600; i++) {
    const uP = rng.range(0.0, 0.78);
    const isLeft = uP < 0.18;
    const v = isLeft ? 0.18 + (uP / 0.18) * 0.17 + rng.range(-0.012, 0.012) : 0.35 + rng.range(-0.012, 0.012);
    const d = isLeft ? 210 + (uP / 0.18) * 300 : 510 + rng.range(-8, 8);
    emitSurfaceStroke(
      sink, BEDROOM_ASPECT, StrokeClass.GROUND, uP, v, d,
      0.016, 0.0045, T, N, WOOD_DARK, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
}

/** Interior plaster walls, half-open green shuttered window portal, scarlet bed, yellow chairs, table & portraits. */
function genBedroomFurnitureAndWalls(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);
  const nLeft = new Vector3(0.82, 0, 0.57).normalize();
  const nRight = new Vector3(-0.82, 0, 0.57).normalize();
  const nUp = new Vector3(0, 1, 0.15).normalize();
  const tHoriz = new Vector3(1, 0, 0);
  const tVert = new Vector3(0, 1, 0);
  const tDepth = new Vector3(0, 0.12, -1).normalize();

  // 1. Interior Lavender-Blue Walls (HOUSE [180..1,800 m])
  for (let i = 0; i < 16500; i++) {
    const uP = rng.range(0.0, 1.0);
    const v = rng.range(0.24, 0.98);
    // Skip the open window portal gap so the starry sky shines through
    if (uP > 0.35 && uP < 0.45 && v > 0.48 && v < 0.80) continue;
    const isLeft = uP < 0.18;
    const isRight = uP > 0.76;
    if (!isLeft && !isRight && v < 0.35) continue;
    const d = isLeft
      ? 220 + (uP / 0.18) * 310 + rng.range(-8, 8)
      : isRight
        ? 530 - ((uP - 0.76) / 0.24) * 310 + rng.range(-8, 8)
        : 535 + rng.range(-12, 12);
    const N = isLeft ? nLeft : isRight ? nRight : nFront;
    const cA = shadeHex(rng.next() < 0.6 ? WALL_LAVENDER : WALL_LILAC, rng.range(0.86, 1.14));
    const cB = shadeHex(mixHex(WALL_COBALT, P.cerulean, rng.range(0.2, 0.6)), rng.range(0.88, 1.10));
    emitSurfaceStroke(
      sink, BEDROOM_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.015, 0.032), rng.range(0.0045, 0.0082),
      rng.next() < 0.5 ? tHoriz : tVert, N, cA, cB, rng,
    );
  }

  // 2. The Half-Open Green Shuttered Window Portal (uP in [0.30, 0.50], v in [0.46, 0.83], d = 505..545 m)
  for (let i = 0; i < 4200; i++) {
    const side = rng.next() < 0.5 ? -1 : 1;
    const uP = side < 0 ? rng.range(0.30, 0.37) : rng.range(0.43, 0.50);
    const v = rng.range(0.46, 0.83);
    const sEdge = side < 0 ? (uP - 0.30) / 0.07 : (0.50 - uP) / 0.07;
    const d = 532 - sEdge * 26 + rng.range(-4, 4); // shutters swing inward into the room!
    const isFrame = v < 0.48 || v > 0.81 || sEdge < 0.14 || sEdge > 0.86;
    const cA = isFrame ? WOOD_DARK : shadeHex(side < 0 ? SHUTTER_LIGHT : SHUTTER_GREEN, rng.range(0.88, 1.12));
    const cB = isFrame ? P.ochre : P.cypressGreen;
    emitSurfaceStroke(
      sink, BEDROOM_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.012, 0.024), rng.range(0.0038, 0.0068),
      isFrame ? tHoriz : tVert, nFront, cA, cB, rng,
      { flags: isFrame ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
    );
  }
  // Glowing golden-and-starlight window aperture strokes (WINDOW class [240..1,450 m])
  for (let i = 0; i < 1800; i++) {
    const uP = rng.range(0.365, 0.435);
    const v = rng.range(0.47, 0.81);
    const d = rng.range(515, 548);
    const isSillGlow = v < 0.54;
    const cA = isSillGlow ? P.lemon : mixHex(P.cerulean, P.lemon, rng.range(0.25, 0.75));
    const cB = isSillGlow ? P.chrome : P.cobalt;
    emitCanvasStroke(
      sink, BEDROOM_ASPECT, StrokeClass.WINDOW, uP, v, d,
      rng.range(0.010, 0.022), rng.range(-0.3, 0.3), rng.range(0.0035, 0.0065),
      cA, cB, rng, { emissive: isSillGlow ? 3.2 : 1.8 },
    );
  }

  // 3. The Famous Scarlet & Golden-Oak Bed on the Right (uP = 0.56..0.96, v = 0.08..0.64, d = 190..485 m)
  // 3a. Scarlet blanket & mattress (HOUSE class)
  for (let i = 0; i < 9500; i++) {
    const tD = rng.next(); // 0 = near footboard (215 m), 1 = near headboard (455 m)
    const d = 215 + 240 * tD + rng.range(-6, 6);
    const uP = rng.range(0.58, 0.93);
    const vBase = 0.16 + 0.22 * tD;
    const v = vBase + rng.range(0.0, 0.15);
    const isPillow = tD > 0.74 && v > vBase + 0.06;
    const cA = isPillow
      ? shadeHex(mixHex(P.lemon, P.zincWhite, rng.range(0.35, 0.75)), rng.range(0.92, 1.08))
      : shadeHex(SCARLET_A, rng.range(0.86, 1.14));
    const cB = isPillow
      ? P.chrome
      : shadeHex(SCARLET_B, rng.range(0.85, 1.10));
    emitSurfaceStroke(
      sink, BEDROOM_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.014, 0.028), rng.range(0.0045, 0.0085),
      isPillow ? tHoriz : tDepth, nUp, cA, cB, rng,
      { emissive: isPillow ? 0.35 : 0.18 },
    );
  }
  // 3b. Golden-oak headboard (d ~ 465 m), footboard (d ~ 214 m), and side rail (GROVE/HOUSE class)
  for (let i = 0; i < 6200; i++) {
    const part = rng.next();
    let uP: number, v: number, d: number;
    if (part < 0.42) {
      // Foreground footboard
      uP = rng.range(0.60, 0.95);
      const arch = 0.04 * Math.sin(Math.PI * ((uP - 0.60) / 0.35));
      v = rng.range(0.06, 0.34 + arch);
      d = rng.range(208, 224);
    } else if (part < 0.78) {
      // Back headboard
      uP = rng.range(0.57, 0.91);
      const arch = 0.05 * Math.sin(Math.PI * ((uP - 0.57) / 0.34));
      v = rng.range(0.36, 0.62 + arch);
      d = rng.range(455, 485);
    } else {
      // Left wooden side rail connecting footboard to headboard
      const t = rng.next();
      uP = 0.58 + 0.02 * (1 - t) + rng.range(-0.012, 0.012);
      v = 0.14 + 0.22 * t + rng.range(-0.03, 0.04);
      d = 210 + 250 * t;
    }
    const isPost = uP < 0.61 || uP > 0.91;
    const cA = shadeHex(mixHex(P.chrome, P.ochre, rng.range(0.25, 0.75)), rng.range(0.88, 1.12));
    const cB = isPost ? WOOD_DARK : P.lemon;
    emitSurfaceStroke(
      sink, BEDROOM_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.013, 0.026), rng.range(0.0040, 0.0075),
      isPost ? tVert : tHoriz, nFront, cA, cB, rng,
      { flags: isPost ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: 0.22 },
    );
  }

  // 4. Two Yellow Cane Bistro Chairs (left foreground d ~ 245 m, mid-room d ~ 395 m)
  const chairs = [
    { u0: 0.07, u1: 0.21, v0: 0.14, v1: 0.44, d: 245 },
    { u0: 0.45, u1: 0.56, v0: 0.27, v1: 0.50, d: 395 },
  ];
  for (const ch of chairs) {
    for (let i = 0; i < 1800; i++) {
      const uP = rng.range(ch.u0, ch.u1);
      const v = rng.range(ch.v0, ch.v1);
      const isSeat = Math.abs(v - (ch.v0 + 0.45 * (ch.v1 - ch.v0))) < 0.035;
      const cA = isSeat ? P.lemon : mixHex(P.chrome, P.ochre, rng.range(0.2, 0.7));
      const cB = isSeat ? P.ochre : WOOD_DARK;
      emitSurfaceStroke(
        sink, BEDROOM_ASPECT, StrokeClass.HOUSE, uP, v, ch.d + rng.range(-10, 10),
        rng.range(0.010, 0.020), rng.range(0.0032, 0.0058),
        isSeat ? tHoriz : tVert, nFront, cA, cB, rng,
        { emissive: 0.25 },
      );
    }
  }

  // 5. Wooden Washstand Table & White Ceramic Pitcher (uP = 0.21..0.35, v = 0.24..0.52, d = 445 m)
  for (let i = 0; i < 2200; i++) {
    const uP = rng.range(0.21, 0.35);
    const v = rng.range(0.24, 0.52);
    const isPitcher = v > 0.43 && uP > 0.24 && uP < 0.32;
    const cA = isPitcher ? P.zincWhite : mixHex(P.ochre, WOOD_DARK, rng.range(0.2, 0.65));
    const cB = isPitcher ? P.cerulean : P.chrome;
    emitSurfaceStroke(
      sink, BEDROOM_ASPECT, StrokeClass.HOUSE, uP, v, 445 + rng.range(-12, 12),
      rng.range(0.010, 0.020), rng.range(0.0032, 0.0058),
      isPitcher ? tVert : tHoriz, nFront, cA, cB, rng,
      { emissive: isPitcher ? 0.35 : 0.12 },
    );
  }

  // 6. Framed Portraits & Mirror on the Walls (HOUSE class)
  const frames = [
    // Portraits on the right wall above the bed
    { u0: 0.62, u1: 0.72, v0: 0.68, v1: 0.84, d: 420, fillA: P.ochre, fillB: P.cypressGreen },
    { u0: 0.75, u1: 0.86, v0: 0.64, v1: 0.80, d: 340, fillA: P.cerulean, fillB: FLOOR_SIENNA },
    // Mirror to the right of the window
    { u0: 0.51, u1: 0.57, v0: 0.58, v1: 0.76, d: 515, fillA: P.zincWhite, fillB: P.cerulean },
    // Hanging towel on the left wall
    { u0: 0.13, u1: 0.17, v0: 0.48, v1: 0.72, d: 380, fillA: P.zincWhite, fillB: P.lemon },
  ];
  for (const fr of frames) {
    for (let i = 0; i < 900; i++) {
      const uP = rng.range(fr.u0, fr.u1);
      const v = rng.range(fr.v0, fr.v1);
      const border = uP - fr.u0 < 0.012 || fr.u1 - uP < 0.012 || v - fr.v0 < 0.016 || fr.v1 - v < 0.016;
      const cA = border ? P.ochre : fr.fillA;
      const cB = border ? WOOD_DARK : fr.fillB;
      emitSurfaceStroke(
        sink, BEDROOM_ASPECT, StrokeClass.HOUSE, uP, v, fr.d + rng.range(-5, 5),
        0.011, 0.0035, border ? tHoriz : tVert, nFront, cA, cB, rng,
        { flags: border ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: 0.2 },
      );
    }
  }
}

function buildBedroomUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:bedroom';
  // Floor quad
  g.add(buildCanvasQuadMesh(
    BEDROOM_ASPECT,
    [[-0.04, 0.0, 208], [1.04, 0.0, 208], [0.80, 0.36, 520], [0.16, 0.36, 520]],
    mat,
    0x6e4c30,
    'bedroom-floor',
  ));
  // Left wall quad
  g.add(buildCanvasQuadMesh(
    BEDROOM_ASPECT,
    [[-0.04, 0.16, 215], [0.18, 0.35, 525], [0.18, 0.98, 525], [-0.04, 0.98, 215]],
    mat,
    0x415682,
    'bedroom-wall-left',
  ));
  // Right wall quad
  g.add(buildCanvasQuadMesh(
    BEDROOM_ASPECT,
    [[0.76, 0.35, 525], [1.04, 0.16, 215], [1.04, 0.98, 215], [0.76, 0.98, 525]],
    mat,
    0x415682,
    'bedroom-wall-right',
  ));
  // Scarlet bed core quad
  g.add(buildCanvasQuadMesh(
    BEDROOM_ASPECT,
    [[0.58, 0.10, 210], [0.95, 0.10, 210], [0.92, 0.56, 470], [0.57, 0.56, 470]],
    mat,
    0x7a1a12,
    'bedroom-bed',
  ));
  return g;
}

export function generateBedroomChapter(
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

  time('portalSky', () => genWindowPortalSky(sink, forkRng(seed, 'bed:sky')));
  time('floor', () => genBedroomFloor(sink, forkRng(seed, 'bed:floor')));
  time('furniture', () => genBedroomFurnitureAndWalls(sink, forkRng(seed, 'bed:furn')));

  const underlays = buildBedroomUnderlays(mat);
  const steepleTip = canvasToWorld(uFromPaint(0.40, BEDROOM_ASPECT), 0.65, 530);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.40, BEDROOM_ASPECT), 0.48, 530),
    steepleTip,
  };
  return { underlays, village, timings };
}
