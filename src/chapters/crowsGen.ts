// Chapter VIII: Wheatfield with Crows (Auvers-sur-Oise, July 1890), aspect = 1.98 (double-square widescreen).
// The tempestuous finale of the 8-Act Van Gogh Odyssey: midnight Prussian & cobalt storm sky with bruised white
// cloud eddies (42-250 km), three diverging crimson-sienna & emerald paths cutting through 25,000 wind-lashed
// golden-ochre wheat stalks (154-1,800 m), and a flock of 52 3D black crows rising from the wheat into the storm.
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

export const CROWS_ASPECT = 1.98;
const P = PALETTE;

const STORM_BLACK = 0x081026;
const CROW_BLACK = 0x060911;
const CROW_SLATE = 0x16223c;
const PATH_CRIMSON = 0xb83c24;
const PATH_SIENNA = 0x8e421e;
const GRASS_VIRIDIAN = 0x2a763b;
const GRASS_LIME = 0x4e9642;

/**Horizon line vH(uP) separating the golden wheat sea from the storm sky. */
function crowsHorizonV(uP: number): number {
  return 0.47 + 0.025 * Math.sin(uP * 5.8 + 0.4) - 0.018 * Math.cos(uP * 11.2);
}

/** 1. Tempestuous Prussian-Blue & Cobalt Storm Sky with Bruised White Cloud Eddies. */
function genStormSky(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < 6500; i++) {
    const uP = rng.range(-0.10, 1.10);
    const v = rng.range(0.42, 1.08);
    const d = rng.range(180000, 246000);
    const cA = mixHex(STORM_BLACK, P.prussian, rng.range(0.2, 0.8));
    const cB = mixHex(P.ultramarine, P.cobalt, rng.range(0.15, 0.55));
    emitCanvasStroke(
      sink, CROWS_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.048, 0.090), rng.range(-0.35, 0.35), rng.range(0.024, 0.042),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // Slashing turbulent sky strokes (SKY_BAND [96..170 km])
  const nSky = 21000;
  for (let i = 0; i < nSky; i++) {
    const uP = rng.range(-0.06, 1.06);
    const vH = crowsHorizonV(uP);
    const v = vH + rng.range(-0.02, 1.05 - vH);
    const d = rng.range(98000, 166000);
    const ang = 0.26 * Math.sin(uP * 8.5 + v * 6.0) + rng.range(-0.22, 0.22);
    const high = clamp((v - vH) / 0.55, 0, 1);
    const cA = shadeHex(mixHex(P.cobalt, STORM_BLACK, 0.35 + 0.55 * high), rng.range(0.85, 1.14));
    const cB = shadeHex(mixHex(P.ultramarine, P.prussian, rng.range(0.2, 0.8)), rng.range(0.88, 1.10));
    emitCanvasStroke(
      sink, CROWS_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.018, 0.038), ang, rng.range(0.0055, 0.0105),
      cA, cB, rng,
      { q1: 0.25, q2: i & 3, q3: rng.next() },
    );
  }

  // Three bruised white-and-cerulean storm cloud eddies (EDDY class [42..92 km])
  const cloudCenters = [
    { uP: 0.22, v: 0.78, rx: 0.14, ry: 0.09, d: 52000 },
    { uP: 0.58, v: 0.72, rx: 0.16, ry: 0.10, d: 46000 },
    { uP: 0.84, v: 0.82, rx: 0.13, ry: 0.08, d: 58000 },
  ];
  for (const cl of cloudCenters) {
    for (let i = 0; i < 2200; i++) {
      const r = Math.pow(rng.next(), 0.7);
      const th = rng.range(0, Math.PI * 2);
      const uP = cl.uP + r * cl.rx * Math.cos(th);
      const v = cl.v + r * cl.ry * Math.sin(th);
      const d = cl.d + rng.range(-3500, 3500);
      const tang = th + Math.PI * 0.5 + rng.range(-0.25, 0.25);
      const cA = mixHex(P.zincWhite, P.cerulean, 0.25 + 0.55 * r);
      const cB = mixHex(P.cobalt, P.ultramarine, rng.range(0.2, 0.7));
      emitCanvasStroke(
        sink, CROWS_ASPECT, StrokeClass.EDDY, uP, v, d,
        rng.range(0.016, 0.032), tang, rng.range(0.005, 0.0095),
        cA, cB, rng,
      );
    }
  }
}

/** 2. Three Diverging Crimson-Sienna & Emerald Paths cutting through the violent sea of golden wheat. */
function genWheatAndPaths(sink: StrokeSink, rng: Rng): void {
  const N = new Vector3(0, 1, 0.14).normalize();

  // Golden-ochre & sienna underlayer across the field (GROUND [154..1,800 m])
  for (let i = 0; i < 5500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const vH = crowsHorizonV(uP);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + vH * t;
    const d = clamp(156 + 1550 * (t * t), 154, 1780);
    const cA = mixHex(P.ochre, P.chrome, rng.range(0.2, 0.8));
    const cB = mixHex(PATH_SIENNA, P.cypressGreen, rng.range(0.2, 0.6));
    emitCanvasStroke(
      sink, CROWS_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.030, 0.056), rng.range(-0.2, 0.2), rng.range(0.013, 0.024),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // 26,000 wind-lashed wheat stalks + 3 diverging crimson/emerald paths
  const nField = 26000;
  for (let i = 0; i < nField; i++) {
    const uP = rng.range(-0.04, 1.04);
    const vH = crowsHorizonV(uP);
    const t = Math.pow(rng.next(), 1.2);
    const v = 0.002 + vH * t;
    const d = clamp(155 + 1600 * (t * t) + rng.range(-10, 10), 154, 1820);

    // Evaluate distance to the 3 iconic paths:
    // Left path: uL(v) = 0.22 - 0.56 * v (for v < 0.34)
    // Center path: uC(v) = 0.49 + 0.045 * Math.sin(v * 11.0) (for v < 0.43)
    // Right path: uR(v) = 0.78 + 0.52 * v (for v < 0.35)
    const wScale = Math.max(0.18, 1 - t * 0.78);
    const dL = v < 0.34 ? Math.abs(uP - (0.22 - 0.56 * v)) / (0.065 * wScale) : 99;
    const dC = v < 0.43 ? Math.abs(uP - (0.49 + 0.045 * Math.sin(v * 11.0))) / (0.075 * wScale) : 99;
    const dR = v < 0.35 ? Math.abs(uP - (0.78 + 0.52 * v)) / (0.065 * wScale) : 99;
    const minP = Math.min(dL, dC, dR);

    let cA: number, cB: number, ang: number;
    if (minP < 0.68) {
      // Crimson-sienna dirt track
      const pathDir = dL === minP ? 2.15 : dR === minP ? 0.98 : 1.57 - 0.35 * Math.cos(v * 11.0);
      ang = pathDir + rng.range(-0.16, 0.16);
      cA = shadeHex(mixHex(PATH_CRIMSON, PATH_SIENNA, rng.range(0.2, 0.8)), rng.range(0.88, 1.15));
      cB = mixHex(P.ochre, GRASS_VIRIDIAN, rng.range(0.2, 0.6));
    } else if (minP < 1.18) {
      // Viridian-emerald grass shoulder bordering each path
      ang = 1.35 + rng.range(-0.35, 0.35);
      cA = shadeHex(mixHex(GRASS_VIRIDIAN, GRASS_LIME, rng.range(0.2, 0.8)), rng.range(0.88, 1.14));
      cB = mixHex(P.cypressGreen, P.ochre, rng.range(0.2, 0.6));
    } else {
      // Wind-lashed golden wheat stalks
      const windWave = 0.42 * Math.sin(uP * 9.0 + v * 7.0);
      ang = 0.85 + windWave + rng.range(-0.18, 0.18);
      const rCol = rng.next();
      cA = rCol < 0.48
        ? shadeHex(P.chrome, rng.range(0.90, 1.12))
        : rCol < 0.82
          ? shadeHex(P.ochre, rng.range(0.88, 1.12))
          : shadeHex(mixHex(P.lemon, PATH_SIENNA, 0.45), rng.range(0.90, 1.08));
      cB = shadeHex(mixHex(P.ochre, PATH_SIENNA, rng.range(0.25, 0.75)), rng.range(0.85, 1.08));
    }

    const scale = clamp(1.22 - 0.52 * t, 0.48, 1.22);
    emitCanvasStroke(
      sink, CROWS_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.013, 0.027) * scale, ang, rng.range(0.0036, 0.0068) * scale,
      cA, cB, rng,
      { q1: N.x, q2: N.y, q3: N.z },
    );
  }
}

/** 3. The Flock of 52 3D Black Crows rising from the wheat into the storm sky. */
function genFlockOfCrows(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);
  const tWing = new Vector3(1, 0, 0);

  // Murder of 52 crows streaming diagonally from lower-left wheat (0.18, 0.34, d=168 m)
  // across the center path (0.52, 0.54, d=340 m) into the upper-right storm portal (0.76, 0.78, d=980 m)
  const nCrows = 52;
  for (let c = 0; c < nCrows; c++) {
    const s = c / (nCrows - 1); // [0, 1] along the flock stream
    const uCenter = clamp(0.14 + 0.74 * s + rng.range(-0.11, 0.11), 0.05, 0.95);
    const vCenter = clamp(0.32 + 0.48 * s + 0.06 * Math.sin(s * 9.0) + rng.range(-0.08, 0.08), 0.24, 0.88);
    // Near crows sit in CYPRESS class [150..240 m] so they undulate/flap; mid/far crows sit in HOUSE [250..1,200 m]
    const isNear = s < 0.42;
    const dCrow = isNear
      ? clamp(162 + 170 * s + rng.range(-8, 8), 156, 236)
      : clamp(260 + 820 * (s - 0.42) + rng.range(-25, 25), 250, 1150);
    const cls = isNear ? StrokeClass.CYPRESS : StrokeClass.HOUSE;
    const wingSpan = clamp(0.036 * (1.18 - 0.62 * s), 0.012, 0.040);
    const tilt = rng.range(-0.28, 0.28);

    // Each crow is a gull-winged V-silhouette made of 18 bold black impasto strokes (left wing + right wing + body)
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 0; k < 9; k++) {
        const f = (k + 0.5) / 9; // 0 = body center, 1 = wingtip
        // Arching wing curve: rises then dips at the wingtip
        const wx = side * f * wingSpan;
        const wy = Math.sin(f * Math.PI * 0.82) * wingSpan * 0.42;
        const rx = wx * Math.cos(tilt) - wy * Math.sin(tilt);
        const ry = wx * Math.sin(tilt) + wy * Math.cos(tilt);
        const uS = uCenter + rx / CROWS_ASPECT;
        const vS = vCenter + ry;
        const slope = side * 0.42 * Math.cos(f * Math.PI * 0.82);
        const strokeAng = Math.atan2(slope, side) + tilt + rng.range(-0.08, 0.08);
        const wStroke = wingSpan * (0.22 - 0.10 * f);
        const lStroke = wingSpan * 0.36;

        if (isNear) {
          emitCanvasStroke(
            sink, CROWS_ASPECT, cls, uS, vS, dCrow + rng.range(-2, 2),
            lStroke, strokeAng, wStroke,
            CROW_BLACK, CROW_SLATE, rng,
            { flags: StrokeFlag.OUTLINE },
          );
        } else {
          tWing.set(Math.cos(strokeAng), Math.sin(strokeAng), 0).normalize();
          emitSurfaceStroke(
            sink, CROWS_ASPECT, cls, uS, vS, dCrow + rng.range(-4, 4),
            lStroke, wStroke, tWing, nFront,
            CROW_BLACK, CROW_SLATE, rng,
            { flags: StrokeFlag.OUTLINE },
          );
        }
      }
    }
  }
}

function buildCrowsUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:crows';
  g.add(buildCanvasQuadMesh(
    CROWS_ASPECT,
    [[-0.04, 0.0, 155], [1.04, 0.0, 155], [1.04, 0.47, 1750], [-0.04, 0.47, 1750]],
    mat,
    0x4a3414,
    'crows-wheatfield',
  ));
  return g;
}

export function generateCrowsChapter(
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

  time('sky', () => genStormSky(sink, forkRng(seed, 'crows:sky')));
  time('wheat', () => genWheatAndPaths(sink, forkRng(seed, 'crows:wheat')));
  time('crows', () => genFlockOfCrows(sink, forkRng(seed, 'crows:flock')));

  const underlays = buildCrowsUnderlays(mat);
  const spireTip = canvasToWorld(uFromPaint(0.58, CROWS_ASPECT), 0.72, 680);
  const village: VillageInfo = {
    houses: [],
    spireBase: canvasToWorld(uFromPaint(0.49, CROWS_ASPECT), 0.25, 320),
    spireTip,
  };
  return { underlays, village, timings };
}
