// Chapter VI: Almond Blossom (Saint-Rémy-de-Provence, Feb 1890), aspect = 1.26.
// Painted to celebrate the birth of Van Gogh's nephew and namesake Vincent Willem:
// luminous turquoise & cerulean spring sky (96-250 km), a 3D canopy of gnarled dark-umber and Prussian-outlined
// almond branches spanning 158 m to 4,200 m, and hundreds of 5-petal pearl-white and blush-rose blossom clusters
// with glowing golden-crimson stamens and drifting petals in the spring breeze.
import { Group, Vector3 } from 'three';
import {
  PALETTE, StrokeClass, StrokeFlag,
  type QualitySettings, type Rng, type SharedUniforms, type StrokeSink, type UnderlayMaterialFactory, type VillageInfo,
} from '../contracts';
import { canvasToWorld } from '../shared/canvasSpace';
import { forkRng } from '../shared/rng';
import {
  clamp, emitCanvasStroke, emitSurfaceStroke, mixHex, shadeHex, uFromPaint,
} from './types';

export const ALMOND_ASPECT = 1.26;
const P = PALETTE;
const TAU = Math.PI * 2;

const TURQUOISE_A = 0x5eb2bc;
const TURQUOISE_B = 0x4596a6;
const TURQUOISE_LIGHT = 0x84c9cc;
const BARK_DARK = 0x261d18;
const BARK_MID = 0x4a3828;
const BARK_OLIVE = 0x4e5c3e;
const PETAL_WHITE = 0xf5f7f5;
const PETAL_CREAM = 0xf7f0d8;
const PETAL_BLUSH = 0xf2cad0;
const STAMEN_CRIMSON = 0xc83a32;

interface BranchSeg {
  u0: number; v0: number; d0: number;
  u1: number; v1: number; d1: number;
  w0: number; w1: number;
  cls: StrokeClass;
}

const BRANCH_TREE: readonly BranchSeg[] = [
  // Primary foreground bough sweeping from bottom-right across center to top-left (CYPRESS [150..240 m])
  { u0: 0.88, v0: -0.02, d0: 162, u1: 0.62, v1: 0.34, d1: 184, w0: 0.036, w1: 0.026, cls: StrokeClass.CYPRESS },
  { u0: 0.62, v0: 0.34,  d0: 184, u1: 0.44, v1: 0.56, d1: 205, w0: 0.026, w1: 0.019, cls: StrokeClass.CYPRESS },
  { u0: 0.44, v0: 0.56,  d0: 205, u1: 0.18, v1: 0.82, d1: 226, w0: 0.019, w1: 0.011, cls: StrokeClass.CYPRESS },
  { u0: 0.62, v0: 0.34,  d0: 184, u1: 0.84, v1: 0.62, d1: 214, w0: 0.020, w1: 0.012, cls: StrokeClass.CYPRESS },
  { u0: 0.84, v0: 0.62,  d0: 214, u1: 0.96, v1: 0.86, d1: 232, w0: 0.012, w1: 0.008, cls: StrokeClass.CYPRESS },
  { u0: 0.44, v0: 0.56,  d0: 205, u1: 0.54, v1: 0.88, d1: 228, w0: 0.015, w1: 0.009, cls: StrokeClass.CYPRESS },

  // Mid-ground bough system from bottom-left sweeping right and upward (GROVE [320..1,750 m])
  { u0: 0.12, v0: 0.02,  d0: 360, u1: 0.34, v1: 0.36, d1: 520, w0: 0.030, w1: 0.022, cls: StrokeClass.GROVE },
  { u0: 0.34, v0: 0.36,  d0: 520, u1: 0.56, v1: 0.52, d1: 680, w0: 0.022, w1: 0.016, cls: StrokeClass.GROVE },
  { u0: 0.56, v0: 0.52,  d0: 680, u1: 0.78, v1: 0.78, d1: 860, w0: 0.016, w1: 0.010, cls: StrokeClass.GROVE },
  { u0: 0.34, v0: 0.36,  d0: 520, u1: 0.14, v1: 0.64, d1: 710, w0: 0.018, w1: 0.010, cls: StrokeClass.GROVE },
  { u0: 0.14, v0: 0.64,  d0: 710, u1: 0.04, v1: 0.88, d1: 890, w0: 0.010, w1: 0.007, cls: StrokeClass.GROVE },
  { u0: 0.56, v0: 0.52,  d0: 680, u1: 0.42, v1: 0.78, d1: 920, w0: 0.014, w1: 0.008, cls: StrokeClass.GROVE },
  { u0: 0.28, v0: 0.18,  d0: 440, u1: 0.48, v1: 0.24, d1: 640, w0: 0.016, w1: 0.009, cls: StrokeClass.GROVE },
  { u0: 0.72, v0: 0.22,  d0: 480, u1: 0.92, v1: 0.38, d1: 720, w0: 0.016, w1: 0.009, cls: StrokeClass.GROVE },

  // Deep background branches framing the sky portal (HILL [1,900..5,800 m])
  { u0: 0.24, v0: 0.42,  d0: 2150, u1: 0.38, v1: 0.72, d1: 2850, w0: 0.015, w1: 0.009, cls: StrokeClass.HILL },
  { u0: 0.38, v0: 0.72,  d0: 2850, u1: 0.32, v1: 0.95, d1: 3400, w0: 0.009, w1: 0.006, cls: StrokeClass.HILL },
  { u0: 0.64, v0: 0.46,  d0: 2300, u1: 0.70, v1: 0.84, d1: 3100, w0: 0.014, w1: 0.008, cls: StrokeClass.HILL },
  { u0: 0.48, v0: 0.32,  d0: 2200, u1: 0.66, v1: 0.44, d1: 2900, w0: 0.013, w1: 0.008, cls: StrokeClass.HILL },
];

/** 1. Luminous turquoise-cerulean spring sky in criss-crossing basket-weave impasto. */
function genAlmondSky(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < 6500; i++) {
    const uP = rng.range(-0.14, 1.14);
    const v = rng.range(-0.06, 1.08);
    const d = rng.range(230000, 250000);
    const cA = mixHex(TURQUOISE_A, TURQUOISE_LIGHT, rng.range(0.15, 0.75));
    const cB = mixHex(TURQUOISE_B, P.cerulean, rng.range(0.2, 0.7));
    emitCanvasStroke(
      sink, ALMOND_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.048, 0.090), rng.range(-0.4, 0.4), rng.range(0.024, 0.042),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // Basket-weave turquoise & pale-zinc sky strokes (SKY_BAND [96..170 km])
  const nSky = 22000;
  for (let i = 0; i < nSky; i++) {
    const uP = rng.range(-0.10, 1.10);
    const v = rng.range(-0.04, 1.06);
    const d = rng.range(98000, 166000);
    // Radiant glow around the central sky portal (0.50, 0.56)
    const distPortal = Math.hypot((uP - 0.50) * ALMOND_ASPECT, v - 0.56);
    const portalLift = Math.max(0, 1 - distPortal / 0.48);
    const hatchAng = (i & 1 ? 0.32 : -0.28) + rng.range(-0.18, 0.18);
    const cA = shadeHex(mixHex(TURQUOISE_A, TURQUOISE_LIGHT, 0.35 * portalLift + rng.range(0, 0.45)), rng.range(0.92, 1.10));
    const cB = shadeHex(mixHex(TURQUOISE_B, P.zincWhite, 0.25 * portalLift + rng.range(0, 0.3)), rng.range(0.90, 1.08));
    emitCanvasStroke(
      sink, ALMOND_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.016, 0.034), hatchAng, rng.range(0.0052, 0.010),
      cA, cB, rng,
      { q1: 0.16, q2: i & 3, q3: rng.next() },
    );
  }
}

/** 2. 3D gnarled almond branches with dark Prussian-umber outlines and warm ochre-olive bark. */
function genAlmondBranches(sink: StrokeSink, rng: Rng): void {
  for (const seg of BRANCH_TREE) {
    const dx = (seg.u1 - seg.u0) * ALMOND_ASPECT;
    const dy = seg.v1 - seg.v0;
    const segLen = Math.hypot(dx, dy);
    const baseAng = Math.atan2(dy, dx);
    const nStrokes = Math.max(280, Math.round(segLen * 2800));

    for (let i = 0; i < nStrokes; i++) {
      const t = rng.next();
      // Slight organic gnarl wave along the branch
      const wave = 0.012 * Math.sin(t * Math.PI * 3.0 + seg.u0 * 11.0);
      const uP = seg.u0 + (seg.u1 - seg.u0) * t - (dy / Math.max(1e-4, segLen)) * wave;
      const v = seg.v0 + (seg.v1 - seg.v0) * t + (dx / Math.max(1e-4, segLen)) * wave;
      const d = seg.d0 + (seg.d1 - seg.d0) * t + rng.range(-3, 3);
      const wHalf = 0.5 * (seg.w0 + (seg.w1 - seg.w0) * t);
      const cross = rng.range(-1, 1);
      const nx = -dy / Math.max(1e-4, segLen);
      const ny = dx / Math.max(1e-4, segLen);
      const uS = uP + (nx * cross * wHalf) / ALMOND_ASPECT;
      const vS = v + ny * cross * wHalf;
      const isEdge = Math.abs(cross) > 0.72;
      const cA = isEdge
        ? mixHex(BARK_DARK, P.prussian, rng.range(0.25, 0.65))
        : shadeHex(mixHex(BARK_MID, BARK_OLIVE, rng.range(0.15, 0.65)), rng.range(0.85, 1.15));
      const cB = isEdge
        ? P.outline
        : mixHex(BARK_DARK, P.ochre, rng.range(0.2, 0.65));
      emitCanvasStroke(
        sink, ALMOND_ASPECT, seg.cls, uS, vS, d,
        rng.range(0.012, 0.025), baseAng + rng.range(-0.14, 0.14), rng.range(0.0032, 0.0062),
        cA, cB, rng,
        { flags: isEdge ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
      );
    }
  }
}

/** 3. Multi-petal 3D Almond Blossoms along every branch + floating spring petals in mid-air. */
function genAlmondBlossoms(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);
  const tVec = new Vector3(1, 0, 0);

  // Place 175 5-petal blossom clusters along the branches + twig tips
  for (let bIdx = 0; bIdx < BRANCH_TREE.length; bIdx++) {
    const seg = BRANCH_TREE[bIdx];
    const nClusters = bIdx < 6 ? 14 : bIdx < 14 ? 10 : 7;
    for (let c = 0; c < nClusters; c++) {
      const t = clamp((c + 0.15 + 0.7 * rng.next()) / nClusters, 0.05, 1.0);
      const spread = (seg.w0 + (seg.w1 - seg.w0) * t) * 1.45;
      const uCenter = seg.u0 + (seg.u1 - seg.u0) * t + rng.range(-spread, spread);
      const vCenter = seg.v0 + (seg.v1 - seg.v0) * t + rng.range(-spread, spread);
      // Map blossom depth into HOUSE [250..1,600 m] so CYPRESS < HOUSE paint order holds cleanly
      const dCluster = clamp(Math.max(255, seg.d0 + (seg.d1 - seg.d0) * t - 8), 255, 1550);
      const flowerScale = clamp(420 / dCluster, 0.45, 1.35);
      const petalRadius = rng.range(0.014, 0.024) * flowerScale;
      const isBud = rng.next() < 0.22;

      if (isBud) {
        // Unopened pink-blush almond bud
        for (let k = 0; k < 12; k++) {
          const ang = rng.range(0, TAU);
          emitCanvasStroke(
            sink, ALMOND_ASPECT, StrokeClass.HOUSE,
            uCenter + rng.range(-0.005, 0.005), vCenter + rng.range(-0.005, 0.005),
            dCluster + rng.range(-3, 3),
            0.011 * flowerScale, ang, 0.0045 * flowerScale,
            PETAL_BLUSH, STAMEN_CRIMSON, rng, { emissive: 0.35 },
          );
        }
        continue;
      }

      // 5 rounded petals arranged radially around (uCenter, vCenter)
      const phase0 = rng.range(0, TAU);
      for (let p = 0; p < 5; p++) {
        const pAng = phase0 + (p * TAU) / 5 + rng.range(-0.12, 0.12);
        const uPetal = uCenter + (Math.cos(pAng) * petalRadius * 0.72) / ALMOND_ASPECT;
        const vPetal = vCenter + Math.sin(pAng) * petalRadius * 0.72;
        // 8 overlapping thick impasto strokes per petal
        for (let s = 0; s < 8; s++) {
          const jAng = pAng + rng.range(-0.38, 0.38);
          const rOff = petalRadius * rng.range(-0.22, 0.28);
          const uS = uPetal + (Math.cos(jAng) * rOff) / ALMOND_ASPECT;
          const vS = vPetal + Math.sin(jAng) * rOff;
          const isBlush = s < 2 || rng.next() < 0.28;
          const cA = isBlush ? mixHex(PETAL_WHITE, PETAL_BLUSH, rng.range(0.35, 0.85)) : PETAL_WHITE;
          const cB = isBlush ? PETAL_BLUSH : PETAL_CREAM;
          tVec.set(Math.cos(jAng), Math.sin(jAng), 0).normalize();
          emitSurfaceStroke(
            sink, ALMOND_ASPECT, StrokeClass.HOUSE,
            uS, vS, dCluster + rng.range(-4, 4),
            petalRadius * rng.range(0.75, 1.10), petalRadius * rng.range(0.36, 0.54),
            tVec, nFront, cA, cB, rng,
            { emissive: 0.42 },
          );
        }
      }

      // Glowing crimson-and-lemon stamen heart in WINDOW class ([250..1,450 m])
      const dStamen = clamp(dCluster - 3, 250, 1440);
      for (let st = 0; st < 6; st++) {
        const sAng = rng.range(0, TAU);
        emitCanvasStroke(
          sink, ALMOND_ASPECT, StrokeClass.WINDOW,
          uCenter + rng.range(-0.003, 0.003), vCenter + rng.range(-0.003, 0.003),
          dStamen,
          0.007 * flowerScale, sAng, 0.0028 * flowerScale,
          st < 3 ? P.lemon : STAMEN_CRIMSON, P.chrome, rng,
          { emissive: 1.8 },
        );
      }
    }
  }

  // Drifting loose petals floating through the 3D volume (GROUND [165..1,650 m])
  for (let i = 0; i < 1800; i++) {
    const uP = rng.range(0.02, 0.98);
    const v = rng.range(0.04, 0.96);
    const d = rng.range(165, 1650);
    const cA = rng.next() < 0.65 ? PETAL_WHITE : PETAL_BLUSH;
    const cB = PETAL_CREAM;
    emitCanvasStroke(
      sink, ALMOND_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.007, 0.014), rng.range(0, TAU), rng.range(0.0032, 0.0055),
      cA, cB, rng, { emissive: 0.45 },
    );
  }
}

export function generateAlmondChapter(
  sink: StrokeSink,
  seed: number,
  _mat: UnderlayMaterialFactory,
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

  time('sky', () => genAlmondSky(sink, forkRng(seed, 'almond:sky')));
  time('branches', () => genAlmondBranches(sink, forkRng(seed, 'almond:branches')));
  time('blossoms', () => genAlmondBlossoms(sink, forkRng(seed, 'almond:blossoms')));

  const underlays = new Group();
  underlays.name = 'underlays:almond';
  const steepleTip = canvasToWorld(uFromPaint(0.50, ALMOND_ASPECT), 0.56, 680);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.50, ALMOND_ASPECT), 0.36, 520),
    steepleTip,
  };
  return { underlays, village, timings };
}
