// Chapter IV (Cosmos — 聖雷米的內在宇宙): Irises (Saint-Rémy, May 1889), aspect = 1.27.
// Painted in the garden of Saint-Paul-de-Mausole asylum with Ukiyo-e woodblock rhythm:
// - Sunlit marigold-gold upper garden meadow & violet-lavender distant flowers
// - Warm terracotta-sienna Provençal soil in the lower left foreground
// - Arching waves of sage-viridian sword-shaped iris leaves
// - 32 sculptural 3D violet-ultramarine bearded irises and the solitary Pearl-White Iris Portal (uP = 0.24, v = 0.58).
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

export const IRISES_ASPECT = 1.27;
const P = PALETTE;

const IRIS_VIOLET = 0x3b2c86;
const IRIS_COBALT = 0x4856b8;
const IRIS_LAVENDER = 0x8e92dc;
const LEAF_SAGE = 0x569668;
const LEAF_EMERALD = 0x2c6e46;
const SOIL_TERRACOTTA = 0xb85828;
const MARIGOLD_MEADOW = 0xe8a828;

/** 1. Upper Marigold-Gold Garden Meadow & Solitary White Iris Portal Halo (uP = 0.24, v = 0.58). */
function genGardenMeadowBackdrop(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < 6000; i++) {
    const uP = rng.range(-0.10, 1.10);
    const v = rng.range(0.45, 1.06);
    const d = rng.range(230000, 250000);
    const cA = mixHex(MARIGOLD_MEADOW, P.lemon, rng.range(0.25, 0.75));
    const cB = LEAF_SAGE;
    emitCanvasStroke(
      sink, IRISES_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.046, 0.086), rng.range(-0.25, 0.25), rng.range(0.022, 0.040),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // Sun-drenched upper garden marigold & wildflower meadow (SKY_BAND [98..166 km])
  for (let i = 0; i < 16500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.62, 1.04);
    const d = rng.range(98000, 166000);
    const isMarigold = uP < 0.65;
    const cA = isMarigold
      ? shadeHex(mixHex(MARIGOLD_MEADOW, P.lemon, rng.range(0.25, 0.85)), rng.range(0.92, 1.12))
      : shadeHex(mixHex(LEAF_SAGE, IRIS_LAVENDER, rng.range(0.25, 0.75)), rng.range(0.90, 1.12));
    const cB = isMarigold ? SOIL_TERRACOTTA : P.zincWhite;

    emitCanvasStroke(
      sink, IRISES_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.014, 0.028), rng.range(-0.35, 0.35), rng.range(0.0050, 0.0092),
      cA, cB, rng,
      { q1: 0.16, q2: i & 3, q3: rng.next() },
    );
  }

  // Luminous halo around the Solitary Pearl-White Iris Portal at (uP = 0.24, v = 0.58)
  emitCustomStar(sink, IRISES_ASPECT, 0.24, 0.58, 12400, 0.024, 7, 1.25, rng, P.zincWhite);
}

/** 2. Terracotta-Sienna Garden Soil & Arching Sage-Viridian Sword Leaves (GROUND & GROVE). */
function genTerracottaSoilAndLeaves(sink: StrokeSink, rng: Rng): void {
  const nUp = new Vector3(0, 1, 0.14).normalize();

  // Red-ochre and terracotta Provençal garden earth (GROUND [155..880 m])
  for (let i = 0; i < 16000; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.12);
    const v = 0.002 + 0.64 * t;
    const d = clamp(156 + 680 * t + rng.range(-8, 8), 154, 880);
    // Left-foreground exposed terracotta soil path vs right-side dense leaf bed
    const isExposedSoil = uP < 0.42 - 0.28 * t || v < 0.14;
    const cA = isExposedSoil
      ? shadeHex(mixHex(SOIL_TERRACOTTA, MARIGOLD_MEADOW, rng.range(0.18, 0.58)), rng.range(0.88, 1.14))
      : shadeHex(mixHex(LEAF_EMERALD, LEAF_SAGE, rng.range(0.25, 0.80)), rng.range(0.86, 1.12));
    const cB = isExposedSoil ? P.ochre : P.groveLight;
    const ang = isExposedSoil ? rng.range(-0.28, 0.22) : 1.25 + rng.range(-0.35, 0.35);

    emitCanvasStroke(
      sink, IRISES_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.032), ang, rng.range(0.0050, 0.0095),
      cA, cB, rng,
      { q1: nUp.x, q2: nUp.y, q3: nUp.z, emissive: 0.18 },
    );
  }

  // Sweeping sword-shaped iris blades arching in wind-blown waves across the garden (GROVE [220..920 m])
  for (let i = 0; i < 18000; i++) {
    const clumpIdx = i % 18;
    const uBase = 0.08 + (clumpIdx / 17) * 0.88 + rng.range(-0.03, 0.03);
    const vBase = 0.06 + 0.42 * ((clumpIdx * 7) % 11) / 10;
    const s = rng.next(); // 0 = base of blade, 1 = curving tip
    const bend = (clumpIdx % 2 === 0 ? 1 : -1) * (0.04 + 0.05 * s * s);
    const uP = uBase + bend + rng.range(-0.008, 0.008);
    const v = vBase + 0.26 * s + rng.range(-0.008, 0.008);
    if (v > 0.86) continue;
    const d = clamp(220 + 620 * ((vBase - 0.06) / 0.45) + rng.range(-12, 12), 210, 920);
    const ang = 1.57 - bend * 3.2 + rng.range(-0.12, 0.12);
    const cA = shadeHex(mixHex(LEAF_SAGE, LEAF_EMERALD, rng.range(0.2, 0.8)), rng.range(0.90, 1.14));
    const cB = s > 0.75 ? P.lemon : P.groveLight;

    emitCanvasStroke(
      sink, IRISES_ASPECT, StrokeClass.GROVE, uP, v, d,
      rng.range(0.014, 0.028), ang, rng.range(0.0042, 0.0078),
      cA, cB, rng,
      { flags: Math.abs(s - 0.5) > 0.42 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: 0.24 },
    );
  }
}

/** 3. Thirty-Two Sculptural 3D Violet Irises & The Solitary Pearl-White Iris (HOUSE & WINDOW [456..860 m]). */
function genIrisBlossoms(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);

  // 32 iris blossoms sweeping diagonally from lower-right foreground to upper-left & mid-ground
  const flowers: Array<{ u: number; v: number; d: number; r: number; isWhite: boolean }> = [
    // THE SOLITARY WHITE IRIS PORTAL at (0.24, 0.58)
    { u: 0.24, v: 0.58, d: 468, r: 0.068, isWhite: true },
  ];
  const fRng = forkRng(1889, 'irises:layout');
  for (let k = 0; k < 31; k++) {
    const t = k / 30;
    const u = clamp(0.14 + 0.78 * t + fRng.range(-0.09, 0.09), 0.10, 0.94);
    const v = clamp(0.20 + 0.56 * (1 - 0.45 * t) * fRng.range(0.35, 1.05), 0.18, 0.78);
    // Keep clear of the white iris so it stands out unmistakably
    if (Math.hypot(u - 0.24, v - 0.58) < 0.095) continue;
    const d = 460 + 360 * ((v - 0.18) / 0.60);
    const r = 0.052 + 0.018 * (1 - (v - 0.18) / 0.65);
    flowers.push({ u, v, d, r, isWhite: false });
  }

  for (const fl of flowers) {
    // Each bearded iris has 3 upright dome standards + 3 arching outer falls + a golden-chrome central beard
    const nPetals = fl.isWhite ? 950 : 480;
    for (let i = 0; i < nPetals; i++) {
      const lobe = i % 6;
      const isStandard = lobe < 3; // 3 upright petals vs 3 drooping falls
      const lobeAng = isStandard
        ? 0.95 + (lobe - 1) * 0.62 + rng.range(-0.18, 0.18)
        : -0.55 - (lobe - 3) * 0.95 + rng.range(-0.20, 0.20);
      const s = rng.next();
      const rad = fl.r * (0.18 + 0.88 * s);
      const uP = fl.u + Math.cos(lobeAng) * rad;
      const v = fl.v + Math.sin(lobeAng) * rad * 0.92 + (isStandard ? 0.015 * s : -0.018 * s * s);
      const d = fl.d + rng.range(-6, 6);

      const isBeard = !isStandard && s < 0.36;
      let cA: number, cB: number, em = 0.42;
      if (isBeard) {
        cA = P.chrome;
        cB = P.lemon;
        em = 1.65;
      } else if (fl.isWhite) {
        cA = shadeHex(mixHex(P.zincWhite, IRIS_LAVENDER, rng.range(0.08, 0.28)), rng.range(0.96, 1.12));
        cB = P.lemon;
        em = 1.95;
      } else {
        cA = shadeHex(
          mixHex(isStandard ? IRIS_COBALT : IRIS_VIOLET, IRIS_LAVENDER, rng.range(0.15, 0.65)),
          rng.range(0.88, 1.15),
        );
        cB = P.ultramarine;
        em = 0.48;
      }

      emitSurfaceStroke(
        sink, IRISES_ASPECT, fl.isWhite || isBeard ? StrokeClass.WINDOW : StrokeClass.HOUSE, uP, v, d,
        rng.range(0.010, 0.022), rng.range(0.0038, 0.0072),
        new Vector3(Math.cos(lobeAng), Math.sin(lobeAng), 0), nFront, cA, cB, rng,
        { flags: s > 0.82 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: em },
      );
    }
  }
}

function buildIrisesUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:irises';
  g.add(buildCanvasQuadMesh(
    IRISES_ASPECT,
    [[-0.04, 0.0, 158], [1.04, 0.0, 158], [1.02, 0.68, 860], [-0.02, 0.68, 860]],
    mat,
    0x385e42,
    'irises-garden',
  ));
  return g;
}

export function generateIrisesChapter(
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

  time('meadow', () => genGardenMeadowBackdrop(sink, forkRng(seed, 'irises:meadow')));
  time('leaves', () => genTerracottaSoilAndLeaves(sink, forkRng(seed, 'irises:leaves')));
  time('blossoms', () => genIrisBlossoms(sink, forkRng(seed, 'irises:blossoms')));

  const underlays = buildIrisesUnderlays(mat);
  const steepleTip = canvasToWorld(uFromPaint(0.24, IRISES_ASPECT), 0.58, 468);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.24, IRISES_ASPECT), 0.28, 480),
    steepleTip,
  };
  return { underlays, village, timings };
}
