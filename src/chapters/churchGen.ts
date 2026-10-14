// Chapter VII: The Church at Auvers (Auvers-sur-Oise, June 1890), aspect = 0.78.
// 3D anamorphic portrait world: deep brooding ultramarine-cobalt sky (42-250 km), the forking golden-ochre
// sandy paths and emerald grassy bank in the foreground (154-520 m) with the walking peasant woman (310 m),
// the writhing Gothic apse & buttresses (310-540 m), cobalt-and-emerald lancet stained-glass windows (330-460 m),
// terracotta-orange roof tiles, and the soaring bell-tower & spire (610-715 m).
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

export const CHURCH_ASPECT = 0.78;
const P = PALETTE;

const SKY_DEEP = 0x111e4f;
const TERRACOTTA = 0xd85e24;
const GRASS_EMERALD = 0x38783c;
const STONE_BLUE = 0x60769e;
const STONE_WARM = 0xb8a278;

/** 1. Deep, brooding Ultramarine & Prussian sky over Auvers (UNDERPAINT + SKY_BAND + EDDY). */
function genAuversSky(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < 6000; i++) {
    const uP = rng.range(-0.16, 1.16);
    const v = rng.range(0.32, 1.08);
    const d = rng.range(230000, 250000);
    const cA = mixHex(P.prussian, SKY_DEEP, rng.range(0.2, 0.8));
    const cB = mixHex(P.ultramarine, P.cobalt, rng.range(0.15, 0.55));
    emitCanvasStroke(
      sink, CHURCH_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.048, 0.088), rng.range(-0.4, 0.4), rng.range(0.024, 0.040),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  const nSky = 19500;
  for (let i = 0; i < nSky; i++) {
    const uP = rng.range(-0.10, 1.10);
    const v = rng.range(0.36, 1.05);
    // Leave silhouette pocket around the upper church & bell-tower
    const inTower = uP > 0.36 && uP < 0.58 && v > 0.52 && v < 0.88;
    const d = rng.range(98000, 166000);
    const waveAng = 0.28 * Math.sin(uP * 5.5 + v * 4.2) + (uP < 0.48 ? 0.35 : -0.35);
    const cA = shadeHex(mixHex(SKY_DEEP, P.ultramarine, rng.range(0.25, 0.85)), rng.range(0.86, 1.12));
    const cB = shadeHex(mixHex(P.prussian, P.cobalt, inTower ? 0.65 : rng.range(0.15, 0.6)), rng.range(0.88, 1.10));
    emitCanvasStroke(
      sink, CHURCH_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.018, 0.036), waveAng + rng.range(-0.12, 0.12), rng.range(0.0055, 0.0105),
      cA, cB, rng,
      { q1: 0.22, q2: i & 3, q3: rng.next() },
    );
  }

  // Swirling storm-sky eddies around the spire portal (uP = 0.48, v = 0.82, EDDY class [44..88 km])
  for (let i = 0; i < 4200; i++) {
    const r = rng.range(0.03, 0.26);
    const th = rng.range(0, Math.PI * 2);
    const uP = 0.48 + (r * Math.cos(th)) / CHURCH_ASPECT;
    const v = 0.80 + r * Math.sin(th);
    if (v < 0.45 || v > 1.04) continue;
    const d = rng.range(44000, 88000);
    const tang = th + Math.PI * 0.5 + 0.25;
    const cA = mixHex(P.cobalt, P.ultramarine, rng.range(0.2, 0.8));
    const cB = mixHex(P.prussian, P.cerulean, rng.range(0.15, 0.45));
    emitCanvasStroke(
      sink, CHURCH_ASPECT, StrokeClass.EDDY, uP, v, d,
      rng.range(0.016, 0.032), tang, rng.range(0.005, 0.009),
      cA, cB, rng,
    );
  }
}

/** 2. The Forking Golden-Ochre Sand Paths, Emerald Grassy Bank, and Walking Peasant Woman (GROUND & GROVE). */
function genForkingPathsAndGrass(sink: StrokeSink, rng: Rng): void {
  const N = new Vector3(0, 1, 0.16).normalize();

  // Foreground grassy wedge & diverging paths (GROUND [154..540 m])
  const nGround = 22000;
  for (let i = 0; i < nGround; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.12);
    const v = 0.002 + 0.38 * t;
    const d = clamp(155 + 365 * t + rng.range(-6, 6), 154, 535);

    // Center grassy wedge sits inside |uP - 0.50| < 0.22 * (1 - v / 0.26)
    const wedgeHalf = Math.max(0, 0.24 * (1 - v / 0.25));
    const inGrassWedge = Math.abs(uP - 0.50) < wedgeHalf;
    // Left path centerline: uL(v) = 0.40 - 0.82 * v; Right path centerline: uR(v) = 0.60 + 0.78 * v
    const dLeft = Math.abs(uP - (0.40 - 0.82 * v));
    const dRight = Math.abs(uP - (0.60 + 0.78 * v));
    const onPath = !inGrassWedge && (dLeft < 0.14 || dRight < 0.14);
    // Cast shadow from the church across the right/center foreground
    const inShadow = v > 0.14 && v < 0.30 && uP > 0.34 && uP < 0.78;

    let cA: number, cB: number, ang: number;
    if (inGrassWedge || !onPath) {
      ang = 1.35 + rng.range(-0.35, 0.35);
      const isFlower = rng.next() < 0.14;
      cA = isFlower ? TERRACOTTA : shadeHex(mixHex(GRASS_EMERALD, P.groveLight, rng.range(0.2, 0.8)), rng.range(0.88, 1.14));
      cB = isFlower ? P.lemon : mixHex(P.cypressGreen, P.ochre, rng.range(0.2, 0.6));
    } else if (inShadow) {
      ang = dLeft < dRight ? 2.15 : 0.95;
      cA = mixHex(P.ultramarine, STONE_BLUE, rng.range(0.25, 0.75));
      cB = mixHex(P.cobalt, P.ochre, rng.range(0.2, 0.5));
    } else {
      ang = (dLeft < dRight ? 2.18 : 0.96) + rng.range(-0.14, 0.14);
      cA = shadeHex(mixHex(P.ochre, P.chrome, rng.range(0.25, 0.78)), rng.range(0.90, 1.12));
      cB = shadeHex(mixHex(STONE_WARM, P.lemon, rng.range(0.2, 0.65)), rng.range(0.88, 1.08));
    }

    emitCanvasStroke(
      sink, CHURCH_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.014, 0.028), ang, rng.range(0.0040, 0.0075),
      cA, cB, rng,
      { q1: N.x, q2: N.y, q3: N.z },
    );
  }

  // Peasant woman walking up the left sandy path (uP = 0.17, v = 0.22..0.33, d = 315 m, HOUSE class)
  for (let i = 0; i < 650; i++) {
    const t = rng.next();
    const v = 0.22 + 0.11 * t;
    const w = t > 0.72 ? 0.016 : t > 0.42 ? 0.022 : 0.028;
    const uP = 0.17 + rng.range(-w, w);
    const isBonnet = t > 0.74;
    const cA = isBonnet ? P.zincWhite : t > 0.42 ? P.cobalt : P.ultramarine;
    const cB = isBonnet ? P.lemon : P.prussian;
    emitCanvasStroke(
      sink, CHURCH_ASPECT, StrokeClass.HOUSE, uP, v, 315 + rng.range(-4, 4),
      0.010, 1.57 + rng.range(-0.2, 0.2), 0.0035,
      cA, cB, rng,
      { emissive: isBonnet ? 0.45 : 0.1 },
    );
  }

  // Surrounding Auvers hedges & trees on left and right flanks (GROVE class [340..1,600 m])
  for (let i = 0; i < 5200; i++) {
    const side = rng.next() < 0.5 ? -1 : 1;
    const uP = side < 0 ? rng.range(-0.04, 0.24) : rng.range(0.76, 1.04);
    const v = rng.range(0.28, 0.52);
    const d = rng.range(380, 920);
    const cA = shadeHex(mixHex(GRASS_EMERALD, P.cypressGreen, rng.range(0.2, 0.8)), rng.range(0.85, 1.12));
    const cB = mixHex(P.grove, P.cobalt, rng.range(0.2, 0.5));
    emitCanvasStroke(
      sink, CHURCH_ASPECT, StrokeClass.GROVE, uP, v, d,
      rng.range(0.014, 0.028), rng.range(0.4, 2.6), rng.range(0.0045, 0.0082),
      cA, cB, rng,
    );
  }
}

/** 3. The Writhing Gothic Church: rounded apse, buttresses, stained-glass windows, terracotta roof & bell-tower. */
function genAuversChurchBody(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);
  const tVert = new Vector3(0, 1, 0);
  const tHoriz = new Vector3(1, 0, 0);

  // 3a. Rounded apse & nave walls with undulating stone buttresses (HOUSE [280..560 m])
  for (let i = 0; i < 14000; i++) {
    const uP = rng.range(0.22, 0.78);
    const v = rng.range(0.24, 0.58);
    const uRel = (uP - 0.50) / 0.28; // [-1, 1]
    const d = 320 + 140 * (uRel * uRel) + rng.range(-8, 8); // rounded apse curves forward toward E!
    const isButtress = Math.abs(Math.sin(uP * 28)) > 0.78;
    const cA = isButtress
      ? shadeHex(mixHex(STONE_WARM, P.ochre, rng.range(0.2, 0.6)), rng.range(0.88, 1.12))
      : shadeHex(mixHex(STONE_BLUE, P.cerulean, rng.range(0.15, 0.65)), rng.range(0.85, 1.12));
    const cB = isButtress
      ? P.outline
      : mixHex(P.cobalt, STONE_WARM, rng.range(0.2, 0.65));
    emitSurfaceStroke(
      sink, CHURCH_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.013, 0.026), rng.range(0.0040, 0.0072),
      isButtress ? tVert : tHoriz, nFront, cA, cB, rng,
      { flags: isButtress ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
    );
  }

  // 3b. Glowing Gothic Lancet Stained-Glass Windows (WINDOW [300..480 m])
  const windows = [
    { uP: 0.34, v0: 0.32, v1: 0.46, d: 345 },
    { uP: 0.44, v0: 0.31, v1: 0.46, d: 318 },
    { uP: 0.55, v0: 0.31, v1: 0.46, d: 320 },
    { uP: 0.65, v0: 0.32, v1: 0.46, d: 348 },
    // Upper rose/lancet window on the nave
    { uP: 0.47, v0: 0.58, v1: 0.69, d: 520 },
  ];
  for (const w of windows) {
    for (let i = 0; i < 420; i++) {
      const uP = w.uP + rng.range(-0.022, 0.022);
      const v = rng.range(w.v0, w.v1);
      const cA = rng.next() < 0.6 ? P.cerulean : P.blueGreen;
      const cB = P.cobalt;
      emitCanvasStroke(
        sink, CHURCH_ASPECT, StrokeClass.WINDOW, uP, v, w.d + rng.range(-4, 4),
        0.011, 1.57 + rng.range(-0.15, 0.15), 0.0038,
        cA, cB, rng, { emissive: 2.1 },
      );
    }
  }

  // 3c. Terracotta-Orange & Cobalt Tiled Roofs (HOUSE [310..590 m])
  for (let i = 0; i < 6800; i++) {
    const uP = rng.range(0.21, 0.79);
    const roofBase = 0.47 + 0.04 * Math.cos((uP - 0.50) * 5.0);
    const v = roofBase + rng.range(0.0, 0.13);
    const d = 335 + 150 * Math.abs(uP - 0.50) + rng.range(-8, 8);
    const isOrangeTile = rng.next() < 0.68;
    const cA = isOrangeTile ? shadeHex(TERRACOTTA, rng.range(0.88, 1.14)) : P.roof;
    const cB = isOrangeTile ? P.ochre : P.ultramarine;
    emitSurfaceStroke(
      sink, CHURCH_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.013, 0.025), rng.range(0.0040, 0.0072),
      tHoriz, nFront, cA, cB, rng,
      { emissive: isOrangeTile ? 0.25 : 0.08 },
    );
  }

  // 3d. Soaring Gothic Bell-Tower & Spire (CHURCH class [580..750 m])
  for (let i = 0; i < 5400; i++) {
    const t = rng.next(); // 0 = tower base (v=0.52), 1 = spire tip (v=0.89)
    const v = 0.52 + 0.37 * t;
    const halfW = t < 0.55 ? 0.075 : 0.075 * (1 - (t - 0.55) / 0.45);
    const uP = 0.47 + rng.range(-halfW, halfW);
    const d = clamp(620 + 65 * t + rng.range(-8, 8), 590, 740);
    const isEdge = Math.abs(uP - 0.47) > halfW * 0.74;
    const cA = isEdge ? P.outline : shadeHex(mixHex(STONE_BLUE, STONE_WARM, rng.range(0.25, 0.75)), rng.range(0.88, 1.12));
    const cB = isEdge ? P.prussian : P.cobalt;
    emitSurfaceStroke(
      sink, CHURCH_ASPECT, StrokeClass.CHURCH, uP, v, d,
      rng.range(0.012, 0.024), rng.range(0.0035, 0.0065),
      tVert, nFront, cA, cB, rng,
      { flags: isEdge ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: t > 0.75 ? 0.35 : 0.12 },
    );
  }
}

function buildChurchUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:church';
  g.add(buildCanvasQuadMesh(
    CHURCH_ASPECT,
    [[-0.04, 0.0, 155], [1.04, 0.0, 155], [0.92, 0.38, 520], [0.08, 0.38, 520]],
    mat,
    0x3a3220,
    'auvers-paths',
  ));
  g.add(buildCanvasQuadMesh(
    CHURCH_ASPECT,
    [[0.23, 0.24, 340], [0.77, 0.24, 340], [0.74, 0.58, 480], [0.26, 0.58, 480]],
    mat,
    0x2a3858,
    'auvers-apse',
  ));
  g.add(buildCanvasQuadMesh(
    CHURCH_ASPECT,
    [[0.40, 0.52, 630], [0.54, 0.52, 630], [0.47, 0.89, 690], [0.47, 0.89, 690]],
    mat,
    0x24304c,
    'auvers-tower',
  ));
  return g;
}

export function generateChurchChapter(
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

  time('sky', () => genAuversSky(sink, forkRng(seed, 'church:sky')));
  time('paths', () => genForkingPathsAndGrass(sink, forkRng(seed, 'church:paths')));
  time('church', () => genAuversChurchBody(sink, forkRng(seed, 'church:body')));

  const underlays = buildChurchUnderlays(mat);
  const steepleTip = canvasToWorld(uFromPaint(0.47, CHURCH_ASPECT), 0.89, 690);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.47, CHURCH_ASPECT), 0.52, 630),
    steepleTip,
  };
  return { underlays, village, timings };
}
