// Expanded Procedural 3D Brushstroke Worlds for Chapter III (Sun: Arles, 1888):
//   - yellowhouse: The Yellow House (The Street) (Arles, Sept 1888), aspect = 1.26
//   - harvest:     The Harvest at La Crau (Arles, June 1888), aspect = 1.25
//   - sower:       The Sower at Sunset (Arles, Nov 1888), aspect = 1.25
//   - nightcafe:   The Night Café (Arles, Sept 1888), aspect = 1.26
import { Group, Vector3 } from 'three';
import {
  PALETTE, StrokeClass, StrokeFlag,
  type QualitySettings, type SharedUniforms, type StrokeSink, type UnderlayMaterialFactory, type VillageInfo,
} from '../contracts';
import { canvasToWorld } from '../shared/canvasSpace';
import { forkRng } from '../shared/rng';
import {
  buildCanvasQuadMesh, clamp, emitCanvasStroke, emitCustomStar, emitSurfaceStroke,
  mixHex, shadeHex, uFromPaint,
} from './types';

const P = PALETTE;
const N_UP = new Vector3(0, 1, 0.14).normalize();
const N_FRONT = new Vector3(0, 0, 1);
const T_DIR = new Vector3(1, 0, 0);

function makeVillage(aspect: number, uP: number, v: number, d: number): VillageInfo {
  return {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(uP, aspect), Math.max(0.05, v - 0.32), d + 10),
    steepleTip: canvasToWorld(uFromPaint(uP, aspect), v, d),
  };
}

// ============================================================================
// 1. YELLOWHOUSE — The Yellow House (The Street) (Arles, Sept 1888), aspect = 1.26
// ============================================================================
export const YELLOWHOUSE_ASPECT = 1.26;
const SKY_FIERCE_COBALT = 0x162c6e;
const HOUSE_CHROME = 0xf4c428;
const SHUTTER_GREEN = 0x267e46;
const PINK_CAFE = 0xdca08c;

export function generateYellowHouseChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'yellowhouse:all');

  // 1. Fierce, almost-black cobalt sky over Place Lamartine (UNDERPAINT & SKY_BAND)
  for (let i = 0; i < 5200; i++) {
    emitCanvasStroke(
      sink, YELLOWHOUSE_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.46, 1.06), rng.range(230000, 250000),
      rng.range(0.046, 0.088), rng.range(-0.2, 0.2), rng.range(0.022, 0.040),
      SKY_FIERCE_COBALT, P.ultramarine, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 19000; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.48, 1.04);
    const cA = shadeHex(mixHex(SKY_FIERCE_COBALT, P.cobalt, rng.range(0.15, 0.65)), rng.range(0.86, 1.12));
    emitCanvasStroke(
      sink, YELLOWHOUSE_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.015, 0.032), rng.range(-0.22, 0.22), rng.range(0.005, 0.0095),
      cA, P.ultramarine, rng,
    );
  }
  emitCustomStar(sink, YELLOWHOUSE_ASPECT, 0.48, 0.62, 12800, 0.022, 6, 1.15, rng, HOUSE_CHROME);

  // 2. Sun-baked Place Lamartine street & gas-pipe trench mounds (GROUND [205..1600 m] & CYPRESS)
  for (let i = 0; i < 19500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.46 * t;
    const d = clamp(208 + 1350 * (t * t), 205, 1580);
    const cA = shadeHex(mixHex(HOUSE_CHROME, P.ochre, rng.range(0.25, 0.85)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, YELLOWHOUSE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.014, 0.028), rng.range(-0.25, 0.25), rng.range(0.0045, 0.0085),
      cA, 0xb87832, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }
  // Foreground trench sand mounds (CYPRESS [154..232 m])
  for (let i = 0; i < 1800; i++) {
    const uP = rng.range(0.18, 0.68);
    const v = rng.range(0.06, 0.24);
    emitCanvasStroke(
      sink, YELLOWHOUSE_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(158, 228),
      rng.range(0.016, 0.032), rng.range(-0.35, 0.35), rng.range(0.005, 0.009),
      P.ochre, HOUSE_CHROME, rng,
    );
  }

  // 3. The Yellow House Corner Facade, Pink Neighbor Café & Railway Bridges (HOUSE & WINDOW [465..1250 m])
  for (let i = 0; i < 7800; i++) {
    const isBridge = i >= 6200;
    const uP = isBridge ? rng.range(0.68, 0.98) : rng.range(0.16, 0.68);
    const v = isBridge ? rng.range(0.36, 0.50) : rng.range(0.38, 0.78);
    const d = isBridge ? rng.range(850, 1220) : clamp(480 + 260 * Math.abs(uP - 0.46), 470, 820);
    const isPink = !isBridge && uP < 0.30;
    const cA = isBridge ? 0x6e6858 : isPink ? PINK_CAFE : HOUSE_CHROME;
    const ang = v > 0.70 && !isBridge ? (uP < 0.46 ? 0.45 : -0.45) : Math.PI * 0.5;
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, YELLOWHOUSE_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.015, 0.030), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
      shadeHex(cA, rng.range(0.88, 1.12)), P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Emerald-green shutters on Vincent's guest room & studio windows (WINDOW [465..620 m])
  const winCoords = [[0.38, 0.62], [0.45, 0.62], [0.53, 0.62], [0.60, 0.62], [0.45, 0.46], [0.55, 0.46]];
  for (const [wu, wv] of winCoords) {
    for (let j = 0; j < 260; j++) {
      T_DIR.set(0, 1, 0);
      emitSurfaceStroke(
        sink, YELLOWHOUSE_ASPECT, StrokeClass.WINDOW, wu + rng.range(-0.020, 0.020), wv + rng.range(-0.035, 0.035), rng.range(468, 540),
        0.015, 0.005, T_DIR, N_FRONT,
        SHUTTER_GREEN, HOUSE_CHROME, rng, { emissive: 0.7 },
      );
    }
  }

  const underlays = new Group();
  underlays.name = 'underlays:yellowhouse';
  underlays.add(buildCanvasQuadMesh(
    YELLOWHOUSE_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.46, 1550], [-0.04, 0.46, 1550]],
    mat, P.ochre, 'yellowhouse-street',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(YELLOWHOUSE_ASPECT, 0.48, 0.62, 520),
    timings,
  };
}

// ============================================================================
// 2. HARVEST — The Harvest at La Crau (Arles, June 1888), aspect = 1.25
// ============================================================================
export const HARVEST_ASPECT = 1.25;
const CRAU_GOLD = 0xecbe38;
const CRAU_TURQUOISE = 0x62b8c8;
const CART_BLUE = 0x24589c;

export function generateHarvestChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'harvest:all');

  // 1. High summer turquoise sky & distant violet Alpilles + Montmajour Abbey (UNDERPAINT, SKY_BAND, HILL)
  for (let i = 0; i < 4800; i++) {
    emitCanvasStroke(
      sink, HARVEST_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.68, 1.06), rng.range(230000, 250000),
      rng.range(0.046, 0.086), rng.range(-0.2, 0.2), rng.range(0.022, 0.038),
      CRAU_TURQUOISE, P.zincWhite, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 14500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.72, 1.04);
    emitCanvasStroke(
      sink, HARVEST_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.015, 0.030), rng.range(-0.18, 0.18), rng.range(0.005, 0.009),
      shadeHex(mixHex(CRAU_TURQUOISE, P.zincWhite, rng.range(0.2, 0.65)), rng.range(0.92, 1.08)), P.lemon, rng,
    );
  }
  emitCustomStar(sink, HARVEST_ASPECT, 0.52, 0.84, 13200, 0.022, 6, 1.15, rng, CRAU_GOLD);

  // Violet-blue Alpilles ridge along v in [0.68, 0.78] (HILL [1800..4600 m])
  for (let i = 0; i < 4800; i++) {
    const uP = rng.range(-0.04, 1.04);
    const vTop = 0.75 + 0.025 * Math.sin(uP * 8.0) + (uP < 0.28 ? 0.03 : 0);
    const v = rng.range(0.68, vTop);
    T_DIR.set(1, 0.15 * Math.cos(uP * 8.0), 0).normalize();
    emitSurfaceStroke(
      sink, HARVEST_ASPECT, StrokeClass.HILL, uP, v, rng.range(1850, 4200),
      rng.range(0.016, 0.032), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
      mixHex(P.cobalt, 0x7e6498, rng.range(0.25, 0.75)), CRAU_GOLD, rng, { flags: StrokeFlag.OUTLINE },
    );
  }

  // 2. Panoramic mosaic of La Crau wheat fields (GROUND [205..2800 m])
  for (let i = 0; i < 24500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.1);
    const v = 0.002 + 0.70 * t;
    const d = clamp(208 + 2400 * (t * t), 205, 2750);
    const patch = ((Math.floor(uP * 5) + Math.floor(v * 6)) & 3);
    const ang = patch === 0 ? 0.08 : patch === 1 ? 1.48 : patch === 2 ? -0.35 : 0.72;
    const cA = patch === 2
      ? mixHex(0x589648, CRAU_GOLD, 0.45)
      : shadeHex(mixHex(CRAU_GOLD, P.ochre, rng.range(0.15, 0.75)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, HARVEST_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.013, 0.026) * (1.15 - 0.45 * t), ang + rng.range(-0.12, 0.12), rng.range(0.004, 0.0075),
      cA, P.lemon, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Golden Haystacks, Farmhouse & Famous Blue Cart (HOUSE [480..1450 m]) + Foreground Fence (CYPRESS)
  const stacks = [[0.24, 0.42, 620], [0.32, 0.46, 680], [0.68, 0.52, 860], [0.76, 0.48, 790]];
  for (const [su, sv, sd] of stacks) {
    for (let j = 0; j < 750; j++) {
      const th = rng.range(0, Math.PI * 2);
      const uP = su + 0.045 * Math.cos(th) * rng.next();
      const v = sv + 0.055 * Math.sin(th) * rng.next();
      T_DIR.set(-Math.sin(th), Math.cos(th), 0).normalize();
      emitSurfaceStroke(
        sink, HARVEST_ASPECT, StrokeClass.HOUSE, uP, v, sd + rng.range(-25, 25),
        0.016, 0.0055, T_DIR, N_FRONT,
        CRAU_GOLD, 0xc87828, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }
  // Iconic blue cart at center (0.48, 0.38, d=540 m)
  for (let j = 0; j < 900; j++) {
    T_DIR.set(1, 0, 0);
    emitSurfaceStroke(
      sink, HARVEST_ASPECT, StrokeClass.HOUSE, 0.48 + rng.range(-0.05, 0.05), 0.38 + rng.range(-0.03, 0.03), rng.range(510, 570),
      0.015, 0.005, T_DIR, N_FRONT,
      CART_BLUE, CRAU_GOLD, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Foreground reed fence (CYPRESS [154..232 m])
  for (let i = 0; i < 1800; i++) {
    const uP = rng.range(0.05, 0.95);
    const v = 0.14 + 0.06 * uP + rng.range(-0.025, 0.025);
    emitCanvasStroke(
      sink, HARVEST_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(158, 228),
      0.018, (i & 1) ? 1.52 : 0.08, 0.0045,
      0x8e5824, CRAU_GOLD, rng,
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:harvest';
  underlays.add(buildCanvasQuadMesh(
    HARVEST_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.70, 2600], [-0.04, 0.70, 2600]],
    mat, CRAU_GOLD, 'harvest-plain',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(HARVEST_ASPECT, 0.52, 0.74, 1950),
    timings,
  };
}

// ============================================================================
// 3. SOWER — The Sower at Sunset (Arles, Nov 1888), aspect = 1.25
// ============================================================================
export const SOWER_ASPECT = 1.25;
const SUN_CHARTREUSE = 0xdce842;
const FURROW_VIOLET = 0x48386e;
const TRUNK_DARK_BLUE = 0x16223e;

export function generateSowerChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'sower:all');

  // 1. Blazing Chartreuse-Lemon Sunset Sky & Colossal Sun Disc at (0.58, 0.60)
  for (let i = 0; i < 5000; i++) {
    emitCanvasStroke(
      sink, SOWER_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.46, 1.06), rng.range(230000, 250000),
      rng.range(0.048, 0.088), rng.range(-0.2, 0.2), rng.range(0.024, 0.040),
      SUN_CHARTREUSE, P.lemon, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 18500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.48, 1.04);
    const dx = (uP - 0.58) * SOWER_ASPECT;
    const dy = v - 0.60;
    const r = Math.hypot(dx, dy);
    const ang = r < 0.34 ? Math.atan2(dy, dx) + Math.PI * 0.5 : rng.range(-0.12, 0.12);
    const cA = r < 0.22
      ? P.lemon
      : shadeHex(mixHex(SUN_CHARTREUSE, 0x98c864, clamp(r * 1.2, 0, 1)), rng.range(0.92, 1.10));
    emitCanvasStroke(
      sink, SOWER_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.016, 0.032), ang, rng.range(0.0055, 0.010),
      cA, P.chrome, rng, { emissive: r < 0.22 ? 0.65 : 0.15 },
    );
  }
  emitCustomStar(sink, SOWER_ASPECT, 0.58, 0.60, 12200, 0.042, 8, 1.45, rng, P.lemon);

  // 2. Violet-and-Ultramarine Ploughed Furrows (GROUND [205..1650 m])
  for (let i = 0; i < 19000; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.50 * t;
    const d = clamp(208 + 1400 * (t * t), 205, 1620);
    const cA = shadeHex(mixHex(FURROW_VIOLET, P.cobalt, rng.range(0.2, 0.75)), rng.range(0.85, 1.14));
    const cB = (i % 5 === 0) ? P.lemon : P.ultramarine;
    emitCanvasStroke(
      sink, SOWER_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.016, 0.032), rng.range(-0.22, 0.22), rng.range(0.005, 0.0095),
      cA, cB, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Bold Japonisme Diagonal Willow Tree (CYPRESS [148..235 m]) & Striding Sower Silhouette (HOUSE & WINDOW)
  for (let i = 0; i < 5600; i++) {
    const s = rng.next();
    // Trunk slices diagonally from lower-right (0.86, 0.02) across to upper-left (0.18, 0.94)
    const uSpine = 0.86 - 0.68 * s + 0.04 * Math.sin(s * 6.0);
    const vSpine = 0.02 + 0.92 * s;
    const halfW = 0.055 * (1 - 0.55 * s);
    const uP = uSpine + rng.range(-halfW, halfW);
    const v = vSpine + rng.range(-0.03, 0.03);
    const d = clamp(152 + 72 * s + rng.range(-5, 5), 148, 234);
    emitCanvasStroke(
      sink, SOWER_ASPECT, StrokeClass.CYPRESS, uP, v, d,
      rng.range(0.022, 0.044), 2.22 + rng.range(-0.18, 0.18), rng.range(0.006, 0.011),
      TRUNK_DARK_BLUE, FURROW_VIOLET, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Striding Sower silhouette at (0.32, 0.12..0.52) in HOUSE [470..560 m] + Golden seeds in WINDOW
  for (let i = 0; i < 2400; i++) {
    const v = rng.range(0.12, 0.52);
    const uP = 0.32 + 0.04 * Math.sin((v - 0.12) * 8.0) + rng.range(-0.045, 0.045);
    T_DIR.set(0.2, 0.98, 0).normalize();
    emitSurfaceStroke(
      sink, SOWER_ASPECT, StrokeClass.HOUSE, uP, v, rng.range(475, 550),
      0.018, 0.006, T_DIR, N_FRONT,
      TRUNK_DARK_BLUE, P.cobalt, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  for (let i = 0; i < 800; i++) {
    T_DIR.set(0.85, -0.52, 0).normalize();
    emitSurfaceStroke(
      sink, SOWER_ASPECT, StrokeClass.WINDOW, 0.22 + rng.range(-0.08, 0.08), 0.34 + rng.range(-0.08, 0.08), rng.range(465, 520),
      0.012, 0.004, T_DIR, N_FRONT,
      P.lemon, P.chrome, rng, { emissive: 1.4 },
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:sower';
  underlays.add(buildCanvasQuadMesh(
    SOWER_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.50, 1600], [-0.04, 0.50, 1600]],
    mat, FURROW_VIOLET, 'sower-field',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(SOWER_ASPECT, 0.58, 0.60, 520),
    timings,
  };
}

// ============================================================================
// 4. NIGHTCAFE — The Night Café (Arles, Sept 1888), aspect = 1.26
// ============================================================================
export const NIGHTCAFE_ASPECT = 1.26;
const WALL_BLOOD_RED = 0xb8241e;
const CEILING_VIRIDIAN = 0x267e4e;
const BILLIARD_FELT = 0x389c4e;
const FLOOR_SULFUR = 0xdcb438;

export function generateNightCafeChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'nightcafe:all');

  // 1. Acid-Viridian Ceiling & 4 Blazing Sulfur Gas Lamps with Hypnotic Halos (UNDERPAINT, SKY_BAND, STAR_CORE)
  for (let i = 0; i < 4800; i++) {
    emitCanvasStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.42, 1.06), rng.range(230000, 250000),
      rng.range(0.048, 0.088), rng.range(-0.2, 0.2), rng.range(0.024, 0.040),
      WALL_BLOOD_RED, CEILING_VIRIDIAN, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 16500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.74, 1.04);
    emitCanvasStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.015, 0.030), rng.range(-0.15, 0.15), rng.range(0.005, 0.0095),
      shadeHex(CEILING_VIRIDIAN, rng.range(0.86, 1.14)), P.lemon, rng,
    );
  }
  // 4 blazing gasoliers suspended from the ceiling
  emitCustomStar(sink, NIGHTCAFE_ASPECT, 0.28, 0.78, 12400, 0.022, 6, 1.25, rng, P.lemon);
  emitCustomStar(sink, NIGHTCAFE_ASPECT, 0.44, 0.76, 13200, 0.018, 5, 1.05, rng, P.chrome);
  emitCustomStar(sink, NIGHTCAFE_ASPECT, 0.62, 0.76, 13400, 0.018, 5, 1.05, rng, P.chrome);
  emitCustomStar(sink, NIGHTCAFE_ASPECT, 0.76, 0.78, 12600, 0.022, 6, 1.25, rng, P.lemon);

  // 2. Steeply Plunging Sulfur-Pine Floorboards radiating from Open Doorway (0.52, 0.48) (GROUND [205..1450 m])
  for (let i = 0; i < 19500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.44 * t;
    const d = clamp(208 + 1200 * (t * t), 205, 1420);
    const perspAng = Math.atan2(0.48 - v, (0.52 - uP) * NIGHTCAFE_ASPECT);
    const inShadow = uP > 0.34 && uP < 0.66 && v > 0.14 && v < 0.32;
    const cA = inShadow
      ? 0x384228
      : shadeHex(mixHex(FLOOR_SULFUR, 0xc86428, (i & 3) === 0 ? 0.55 : 0.15), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.030), perspAng + rng.range(-0.08, 0.08), rng.range(0.0045, 0.0085),
      cA, WALL_BLOOD_RED, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Blood-Red Walls, Open Curtain Doorway & Green Billiard Table (HOUSE, WINDOW, CYPRESS)
  for (let i = 0; i < 8200; i++) {
    const uP = rng.range(-0.02, 1.02);
    const v = rng.range(0.42, 0.76);
    const inDoor = Math.abs(uP - 0.52) < 0.055 && v < 0.66;
    const d = inDoor ? rng.range(920, 1250) : rng.range(640, 880);
    T_DIR.set(0, 1, 0);
    emitSurfaceStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.016, 0.032), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
      inDoor ? P.lemon : shadeHex(WALL_BLOOD_RED, rng.range(0.86, 1.14)), P.ochre, rng,
      { flags: StrokeFlag.OUTLINE, emissive: inDoor ? 0.85 : 0 },
    );
  }
  // Elevated green billiard table in center foreground (CYPRESS [156..234 m]) + Landlord in white coat
  for (let i = 0; i < 3200; i++) {
    const isTable = i < 2500;
    const uP = isTable ? rng.range(0.34, 0.66) : 0.62 + rng.range(-0.03, 0.03);
    const v = isTable ? rng.range(0.22, 0.38) : rng.range(0.32, 0.56);
    emitCanvasStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(160, 228),
      rng.range(0.015, 0.028), isTable ? rng.range(-0.15, 0.15) : Math.PI * 0.5, rng.range(0.0045, 0.0085),
      isTable ? BILLIARD_FELT : P.zincWhite, FLOOR_SULFUR, rng, { flags: StrokeFlag.OUTLINE },
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:nightcafe';
  underlays.add(buildCanvasQuadMesh(
    NIGHTCAFE_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.44, 1400], [-0.04, 0.44, 1400]],
    mat, 0x8e5c24, 'nightcafe-floor',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(NIGHTCAFE_ASPECT, 0.52, 0.50, 950),
    timings,
  };
}
