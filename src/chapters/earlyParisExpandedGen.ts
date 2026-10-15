// Expanded Procedural 3D Brushstroke Worlds for Chapter I (Earth: Nuenen & Antwerp, 1884–1886)
// and Chapter II (Color: Paris & Montmartre, 1886–1887):
//   - weaver:  The Weaver (Nuenen, May 1884), aspect = 1.26
//   - tower:   The Old Church Tower at Nuenen (May 1885), aspect = 1.28
//   - skull:   Skull of a Skeleton with Burning Cigarette (Antwerp, Early 1886), aspect = 0.82
//   - galette: Le Moulin de la Galette (Montmartre, Autumn 1886), aspect = 1.18
//   - seine:   Bridges across the Seine at Asnières (Summer 1887), aspect = 1.27
//   - plum:    Bridge in the Rain (after Hiroshige) (Autumn 1887), aspect = 0.78
//   - tanguy:  Portrait of Père Tanguy (Autumn 1887), aspect = 0.81
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

// ============================================================================
// 1. WEAVER — The Weaver (Nuenen, May 1884), aspect = 1.26
// ============================================================================
export const WEAVER_ASPECT = 1.26;
const LOOM_OAK = 0x26180e;
const LOOM_WALNUT = 0x422a18;
const COTTAGE_PLASTER = 0x3b3528;
const LINEN_CREAM = 0xdccaa4;

export function generateWeaverChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'weaver:all');

  // 1. Bistre & charcoal Nuenen cottage interior walls + sunlit window (SKY_BAND & UNDERPAINT)
  for (let i = 0; i < 5200; i++) {
    const uP = rng.range(-0.10, 1.10);
    const v = rng.range(0.30, 1.06);
    emitCanvasStroke(
      sink, WEAVER_ASPECT, StrokeClass.UNDERPAINT, uP, v, rng.range(230000, 250000),
      rng.range(0.046, 0.085), rng.range(-0.25, 0.25), rng.range(0.022, 0.040),
      LOOM_OAK, COTTAGE_PLASTER, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 18500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.32, 1.04);
    const inWin = uP > 0.68 && uP < 0.86 && v > 0.58 && v < 0.86;
    const cA = inWin
      ? mixHex(LINEN_CREAM, P.lemon, rng.range(0.2, 0.6))
      : shadeHex(mixHex(COTTAGE_PLASTER, LOOM_OAK, rng.range(0.25, 0.75)), rng.range(0.85, 1.14));
    const cB = inWin ? P.zincWhite : LOOM_WALNUT;
    emitCanvasStroke(
      sink, WEAVER_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.015, 0.032), inWin ? rng.range(-0.1, 0.1) : rng.range(-0.22, 0.22), rng.range(0.005, 0.010),
      cA, cB, rng, { emissive: inWin ? 0.55 : 0 },
    );
  }
  emitCustomStar(sink, WEAVER_ASPECT, 0.76, 0.72, 12800, 0.022, 6, 1.1, rng, LINEN_CREAM);

  // 2. Earthen cottage floor & diagonal sunbeam dust (GROUND [205..1550 m])
  for (let i = 0; i < 16500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.36 * t;
    const d = clamp(210 + 1280 * (t * t), 205, 1520);
    const cA = shadeHex(mixHex(LOOM_OAK, LOOM_WALNUT, rng.range(0.2, 0.8)), rng.range(0.86, 1.12));
    emitCanvasStroke(
      sink, WEAVER_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.016, 0.032), rng.range(-0.15, 0.15), rng.range(0.005, 0.009),
      cA, LOOM_OAK, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Monumental 3D Oak Handloom Posts (CYPRESS [150..238 m]) & Crossbeams + Weaver + Woven Cloth (HOUSE & WINDOW)
  const posts = [0.16, 0.36, 0.62, 0.84];
  for (const uPost of posts) {
    for (let i = 0; i < 1600; i++) {
      const v = rng.range(0.04, 0.92);
      const uP = uPost + rng.range(-0.018, 0.018);
      const d = clamp(156 + 65 * ((posts.indexOf(uPost) & 1) ? 0.6 : 0.1) + rng.range(-6, 6), 150, 236);
      emitCanvasStroke(
        sink, WEAVER_ASPECT, StrokeClass.CYPRESS, uP, v, d,
        rng.range(0.024, 0.048), Math.PI * 0.5 + rng.range(-0.06, 0.06), rng.range(0.006, 0.012),
        LOOM_OAK, LOOM_WALNUT, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }
  // Horizontal loom beams & seated weaver in dark indigo smock (HOUSE [460..920 m])
  for (let i = 0; i < 6200; i++) {
    const isBeam = i < 4200;
    const uP = isBeam ? rng.range(0.10, 0.88) : 0.48 + rng.range(-0.09, 0.09);
    const v = isBeam ? (i % 3 === 0 ? rng.range(0.42, 0.48) : i % 3 === 1 ? rng.range(0.76, 0.82) : rng.range(0.22, 0.28)) : rng.range(0.38, 0.72);
    const d = isBeam ? rng.range(470, 680) : rng.range(720, 880);
    const ang = isBeam ? rng.range(-0.06, 0.06) : Math.PI * 0.5 + rng.range(-0.2, 0.2);
    const cA = isBeam ? LOOM_WALNUT : P.prussian;
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, WEAVER_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.018, 0.036), rng.range(0.005, 0.010), T_DIR, N_FRONT,
      cA, LOOM_OAK, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Luminous woven linen cloth & shuttle threads (WINDOW [465..560 m])
  for (let i = 0; i < 1800; i++) {
    const uP = rng.range(0.22, 0.62);
    const v = rng.range(0.45, 0.53);
    T_DIR.set(1, 0, 0);
    emitSurfaceStroke(
      sink, WEAVER_ASPECT, StrokeClass.WINDOW, uP, v, rng.range(468, 540),
      rng.range(0.014, 0.028), rng.range(0.004, 0.008), T_DIR, N_FRONT,
      LINEN_CREAM, P.ochre, rng, { emissive: 0.75 },
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:weaver';
  underlays.add(buildCanvasQuadMesh(
    WEAVER_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.42, 1450], [-0.04, 0.42, 1450]],
    mat, LOOM_OAK, 'weaver-floor',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: { spireTipWorld: canvasToWorld(uFromPaint(0.76, WEAVER_ASPECT), 0.72, 680), windowCount: 28, houseCount: 4 },
    timings,
  };
}

// ============================================================================
// 2. TOWER — The Old Church Tower at Nuenen (May 1885), aspect = 1.28
// ============================================================================
export const TOWER_ASPECT = 1.28;
const STONE_UMBER = 0x3b3026;
const STONE_SLATE = 0x48505a;
const TWILIGHT_SILVER = 0xa8a496;
const TWILIGHT_OCHRE = 0x9c8258;

export function generateTowerChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'tower:all');

  // 1. Stormy silver-ochre twilight sky (UNDERPAINT, SKY_BAND, EDDY)
  for (let i = 0; i < 5200; i++) {
    emitCanvasStroke(
      sink, TOWER_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.32, 1.08), rng.range(230000, 250000),
      rng.range(0.048, 0.088), rng.range(-0.2, 0.2), rng.range(0.024, 0.042),
      TWILIGHT_SILVER, STONE_SLATE, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 19000; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.34, 1.05);
    const cA = shadeHex(mixHex(TWILIGHT_SILVER, TWILIGHT_OCHRE, rng.range(0.15, 0.65)), rng.range(0.84, 1.12));
    const cB = mixHex(STONE_SLATE, P.zincWhite, rng.range(0.2, 0.7));
    emitCanvasStroke(
      sink, TOWER_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.018, 0.036), 0.14 * Math.sin(uP * 6.0 + v * 5.0) + rng.range(-0.18, 0.18), rng.range(0.0055, 0.010),
      cA, cB, rng,
    );
  }
  emitCustomStar(sink, TOWER_ASPECT, 0.48, 0.76, 13200, 0.020, 6, 0.95, rng, TWILIGHT_OCHRE);

  // 2. Peasant churchyard earth & wind-bent grass (GROUND [205..1600 m])
  for (let i = 0; i < 17500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.36 * t;
    const d = clamp(208 + 1350 * (t * t), 205, 1580);
    const cA = shadeHex(mixHex(STONE_UMBER, P.cypressGreen, rng.range(0.2, 0.65)), rng.range(0.86, 1.12));
    emitCanvasStroke(
      sink, TOWER_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.014, 0.028), 1.15 + rng.range(-0.3, 0.3), rng.range(0.0045, 0.0085),
      cA, TWILIGHT_OCHRE, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Weathered Nuenen Romanesque Church Tower (CHURCH [605..750 m] & HOUSE [500..850 m]) + Grave Crosses (CYPRESS)
  for (let i = 0; i < 6800; i++) {
    const v = rng.range(0.32, 0.88);
    const topTap = v > 0.74 ? (0.88 - v) / 0.14 : 1.0;
    const halfW = 0.11 * Math.max(0.22, topTap);
    const uP = 0.48 + rng.range(-halfW, halfW);
    const d = clamp(615 + 115 * Math.abs(uP - 0.48) / 0.12 + rng.range(-8, 8), 605, 750);
    const isBelfry = Math.abs(uP - 0.48) < 0.024 && v > 0.58 && v < 0.71;
    const cA = isBelfry ? 0x161210 : shadeHex(mixHex(STONE_UMBER, STONE_SLATE, rng.range(0.2, 0.7)), rng.range(0.84, 1.12));
    const ang = v > 0.74 ? (uP < 0.48 ? 0.95 : -0.95) : Math.PI * 0.5 + rng.range(-0.14, 0.14);
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, TOWER_ASPECT, StrokeClass.CHURCH, uP, v, d,
      rng.range(0.015, 0.030), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
      cA, TWILIGHT_OCHRE, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Wooden churchyard crosses in foreground (CYPRESS [152..236 m])
  const crosses = [0.22, 0.34, 0.64, 0.78];
  for (const uC of crosses) {
    for (let i = 0; i < 450; i++) {
      const horiz = i < 150;
      const uP = uC + (horiz ? rng.range(-0.028, 0.028) : rng.range(-0.006, 0.006));
      const v = horiz ? 0.21 + rng.range(-0.008, 0.008) : rng.range(0.08, 0.26);
      emitCanvasStroke(
        sink, TOWER_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(158, 228),
        rng.range(0.014, 0.026), horiz ? 0.08 : 1.52, rng.range(0.004, 0.0075),
        STONE_UMBER, TWILIGHT_OCHRE, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  const underlays = new Group();
  underlays.name = 'underlays:tower';
  underlays.add(buildCanvasQuadMesh(
    TOWER_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.36, 1520], [-0.04, 0.36, 1520]],
    mat, STONE_UMBER, 'tower-churchyard',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: { spireTipWorld: canvasToWorld(uFromPaint(0.48, TOWER_ASPECT), 0.88, 650), windowCount: 8, houseCount: 1 },
    timings,
  };
}

// ============================================================================
// 3. SKULL — Skull of a Skeleton with Burning Cigarette (Antwerp, 1886), aspect = 0.82
// ============================================================================
export const SKULL_ASPECT = 0.82;
const VOID_BLACK = 0x0e0b0a;
const BONE_IVORY = 0xe4d4b0;
const BONE_OCHRE = 0xb89660;
const EMBER_RED = 0xe84824;

export function generateSkullChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'skull:all');

  // 1. Chiaroscuro dark umber-indigo void & rising smoke ribbons (UNDERPAINT, SKY_BAND, EDDY)
  for (let i = 0; i < 5000; i++) {
    emitCanvasStroke(
      sink, SKULL_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(-0.04, 1.06), rng.range(230000, 250000),
      rng.range(0.050, 0.092), rng.range(-0.3, 0.3), rng.range(0.025, 0.044),
      VOID_BLACK, 0x1c1512, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 18000; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.02, 1.04);
    emitCanvasStroke(
      sink, SKULL_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.018, 0.036), rng.range(-0.4, 0.4), rng.range(0.006, 0.011),
      shadeHex(VOID_BLACK, rng.range(0.9, 1.25)), 0x241c16, rng,
    );
  }
  // Swirling cigarette smoke rising from ember (0.68, 0.42) up to (0.78, 0.88) in EDDY [46000..72000 m]
  for (let i = 0; i < 3600; i++) {
    const s = rng.next();
    const uP = 0.68 + 0.09 * s + 0.05 * Math.sin(s * 9.0) + rng.range(-0.03, 0.03);
    const v = 0.42 + 0.48 * s + rng.range(-0.02, 0.02);
    emitCanvasStroke(
      sink, SKULL_ASPECT, StrokeClass.EDDY, uP, v, rng.range(46000, 72000),
      rng.range(0.016, 0.032), 1.35 + 0.45 * Math.cos(s * 9.0), rng.range(0.0045, 0.0085),
      mixHex(P.cerulean, BONE_IVORY, 0.55), VOID_BLACK, rng,
    );
  }
  // Glowing cigarette ember at (0.68, 0.42)
  emitCustomStar(sink, SKULL_ASPECT, 0.68, 0.42, 12600, 0.020, 6, 1.25, rng, EMBER_RED);

  // 2. Sculptural Bone-Ivory Cranium, Zygomatic Arch, Jaw, and Clavicles (HOUSE [470..820 m] & CYPRESS sockets)
  for (let i = 0; i < 16500; i++) {
    const part = i % 4;
    let uP: number, v: number, d: number, ang: number;
    if (part < 2) {
      // Cranium dome centered at (0.44, 0.66)
      const th = rng.range(0, Math.PI * 2);
      const r = Math.pow(rng.next(), 0.65);
      uP = 0.44 + r * 0.22 * Math.cos(th);
      v = 0.66 + r * 0.19 * Math.sin(th);
      d = clamp(485 + 160 * r * r, 470, 690);
      ang = th + Math.PI * 0.5 + rng.range(-0.2, 0.2);
    } else if (part === 2) {
      // Jaw & teeth around (0.48, 0.44)
      uP = 0.48 + rng.range(-0.13, 0.14);
      v = 0.44 + rng.range(-0.09, 0.08);
      d = rng.range(475, 580);
      ang = rng.range(-0.3, 0.3);
    } else {
      // Cervical vertebrae & rib/clavicle cage below (v in 0.06..0.34)
      uP = 0.44 + rng.range(-0.28, 0.28);
      v = rng.range(0.06, 0.34);
      d = rng.range(520, 790);
      ang = (uP < 0.44 ? -0.45 : 0.45) + rng.range(-0.25, 0.25);
    }
    const cA = shadeHex(mixHex(BONE_IVORY, BONE_OCHRE, rng.range(0.15, 0.75)), rng.range(0.86, 1.14));
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, SKULL_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.015, 0.032), rng.range(0.005, 0.010), T_DIR, N_FRONT,
      cA, VOID_BLACK, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Hollow eye sockets & nasal cavity (CYPRESS [155..225 m]) + White cigarette stick (WINDOW [462..510 m])
  for (let i = 0; i < 2400; i++) {
    const isLeft = (i & 1) === 0;
    const th = rng.range(0, Math.PI * 2);
    const uP = (isLeft ? 0.38 : 0.55) + 0.055 * Math.cos(th) * rng.range(0.3, 1.0);
    const v = 0.58 + 0.050 * Math.sin(th) * rng.range(0.3, 1.0);
    emitCanvasStroke(
      sink, SKULL_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(158, 220),
      rng.range(0.014, 0.026), th + Math.PI * 0.5, rng.range(0.0045, 0.0085),
      VOID_BLACK, BONE_OCHRE, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  for (let i = 0; i < 900; i++) {
    const s = rng.next();
    const uP = 0.52 + 0.16 * s;
    const v = 0.44 - 0.02 * s + rng.range(-0.008, 0.008);
    T_DIR.set(0.99, -0.12, 0).normalize();
    emitSurfaceStroke(
      sink, SKULL_ASPECT, StrokeClass.WINDOW, uP, v, rng.range(465, 505),
      0.018, 0.0055, T_DIR, N_FRONT,
      s > 0.82 ? EMBER_RED : P.zincWhite, BONE_IVORY, rng, { emissive: s > 0.82 ? 1.8 : 0.65 },
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:skull';
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: { spireTipWorld: canvasToWorld(uFromPaint(0.68, SKULL_ASPECT), 0.42, 480), windowCount: 16, houseCount: 1 },
    timings,
  };
}

// ============================================================================
// 4. GALETTE — Le Moulin de la Galette (Montmartre, Autumn 1886), aspect = 1.18
// ============================================================================
export const GALETTE_ASPECT = 1.18;
const MILL_TIMBER = 0x5c3e26;
const TRICOLOR_RED = 0xd83c28;

export function generateGaletteChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'galette:all');

  // 1. Luminous Parisian autumn sky over Montmartre (UNDERPAINT & SKY_BAND)
  for (let i = 0; i < 5000; i++) {
    emitCanvasStroke(
      sink, GALETTE_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.38, 1.06), rng.range(230000, 250000),
      rng.range(0.045, 0.084), rng.range(-0.25, 0.25), rng.range(0.022, 0.038),
      0x96b6cc, P.zincWhite, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 19000; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.40, 1.04);
    const cA = shadeHex(mixHex(0x8cb8d4, P.zincWhite, rng.range(0.25, 0.78)), rng.range(0.90, 1.10));
    emitCanvasStroke(
      sink, GALETTE_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.014, 0.028), rng.range(-0.3, 0.3), rng.range(0.005, 0.009),
      cA, 0xd8cdb8, rng,
    );
  }
  emitCustomStar(sink, GALETTE_ASPECT, 0.44, 0.78, 13200, 0.022, 6, 1.1, rng, P.lemon);

  // 2. Sloping Montmartre hillside & wooden palisade fence (GROUND [205..1550 m] & CYPRESS)
  for (let i = 0; i < 18000; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.46 * t;
    const d = clamp(208 + 1320 * (t * t), 205, 1540);
    const cA = shadeHex(mixHex(P.ochre, 0x6a8c4e, rng.range(0.2, 0.7)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, GALETTE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.014, 0.028), 0.35 + rng.range(-0.25, 0.25), rng.range(0.0045, 0.0085),
      cA, MILL_TIMBER, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Timber Windmill Body (CHURCH [615..745 m] & HOUSE) + 4 Diagonal Windmill Sails (CYPRESS [155..238 m])
  for (let i = 0; i < 5800; i++) {
    const uP = 0.44 + rng.range(-0.11, 0.11);
    const v = rng.range(0.42, 0.78);
    T_DIR.set(0, 1, 0);
    emitSurfaceStroke(
      sink, GALETTE_ASPECT, StrokeClass.CHURCH, uP, v, rng.range(620, 740),
      rng.range(0.015, 0.028), rng.range(0.005, 0.009), T_DIR, N_FRONT,
      shadeHex(MILL_TIMBER, rng.range(0.85, 1.15)), P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // 4 great wooden sails radiating from hub (0.44, 0.78)
  for (let arm = 0; arm < 4; arm++) {
    const baseAng = 0.68 + arm * (Math.PI * 0.5);
    for (let i = 0; i < 950; i++) {
      const r = rng.range(0.02, 0.24);
      const lat = rng.range(-0.022, 0.022);
      const uP = 0.44 + (r * Math.cos(baseAng) - lat * Math.sin(baseAng)) / GALETTE_ASPECT;
      const v = 0.78 + r * Math.sin(baseAng) + lat * Math.cos(baseAng);
      emitCanvasStroke(
        sink, GALETTE_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(162, 232),
        rng.range(0.016, 0.032), baseAng + (i % 3 === 0 ? Math.PI * 0.5 : 0), rng.range(0.0038, 0.0072),
        i % 7 === 0 ? TRICOLOR_RED : MILL_TIMBER, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  const underlays = new Group();
  underlays.name = 'underlays:galette';
  underlays.add(buildCanvasQuadMesh(
    GALETTE_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.46, 1500], [-0.04, 0.46, 1500]],
    mat, 0x5c4a2c, 'galette-hill',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: { spireTipWorld: canvasToWorld(uFromPaint(0.44, GALETTE_ASPECT), 0.78, 640), windowCount: 14, houseCount: 3 },
    timings,
  };
}

// ============================================================================
// 5. SEINE — Bridges across the Seine at Asnières (Summer 1887), aspect = 1.27
// ============================================================================
export const SEINE_ASPECT = 1.27;
const IRON_CRIMSON = 0xb83828;
const PIER_CREAM = 0xe4d4b4;
const SEINE_AQUA = 0x5ea6c4;

export function generateSeineChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'seine:all');

  // 1. Radiant summer sky & locomotive steam cloud at (0.54, 0.64)
  for (let i = 0; i < 5000; i++) {
    emitCanvasStroke(
      sink, SEINE_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.46, 1.06), rng.range(230000, 250000),
      rng.range(0.046, 0.086), rng.range(-0.2, 0.2), rng.range(0.022, 0.038),
      SEINE_AQUA, P.zincWhite, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 18500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.48, 1.04);
    const cA = shadeHex(mixHex(SEINE_AQUA, P.zincWhite, rng.range(0.3, 0.82)), rng.range(0.92, 1.10));
    emitCanvasStroke(
      sink, SEINE_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.012, 0.025), rng.range(-0.22, 0.22), rng.range(0.0045, 0.0085),
      cA, P.lemon, rng,
    );
  }
  emitCustomStar(sink, SEINE_ASPECT, 0.54, 0.64, 13000, 0.022, 6, 1.15, rng, P.lemon);

  // 2. Shimmering broken-stroke Seine river reflections (GROUND [205..1650 m])
  for (let i = 0; i < 21000; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.48 * t;
    const d = clamp(208 + 1400 * (t * t), 205, 1640);
    const isRefl = Math.abs(uP - 0.36) < 0.07 || Math.abs(uP - 0.68) < 0.07;
    const cA = isRefl
      ? mixHex(PIER_CREAM, IRON_CRIMSON, (i & 3) === 0 ? 0.65 : 0.15)
      : (i & 1) === 0 ? SEINE_AQUA : mixHex(P.cerulean, P.zincWhite, rng.range(0.25, 0.7));
    emitCanvasStroke(
      sink, SEINE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.014, 0.028), rng.range(-0.08, 0.08), rng.range(0.004, 0.0075),
      cA, P.zincWhite, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z, emissive: 0.18 },
    );
  }

  // 3. Crimson-Iron Railway Bridge & Stone Piers (HOUSE [480..1150 m]) + Woman with Red Parasol (CYPRESS)
  for (let i = 0; i < 6400; i++) {
    const isPier = i < 2400;
    const uP = isPier
      ? ((i & 1) === 0 ? 0.36 : 0.68) + rng.range(-0.042, 0.042)
      : rng.range(-0.02, 1.02);
    const v = isPier ? rng.range(0.36, 0.58) : rng.range(0.50, 0.58);
    const d = isPier ? rng.range(520, 780) : rng.range(580, 960);
    const ang = isPier ? Math.PI * 0.5 : 0;
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, SEINE_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.014, 0.028), rng.range(0.0045, 0.0085), T_DIR, N_FRONT,
      isPier ? PIER_CREAM : IRON_CRIMSON, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Woman in white-pink dress with glowing red parasol on left embankment (CYPRESS [156..220 m])
  for (let i = 0; i < 1200; i++) {
    const uP = 0.22 + rng.range(-0.025, 0.025);
    const v = rng.range(0.24, 0.42);
    emitCanvasStroke(
      sink, SEINE_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(160, 215),
      rng.range(0.012, 0.022), v > 0.36 ? rng.range(-0.4, 0.4) : Math.PI * 0.5, rng.range(0.004, 0.0075),
      v > 0.36 ? IRON_CRIMSON : PIER_CREAM, P.zincWhite, rng,
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:seine';
  underlays.add(buildCanvasQuadMesh(
    SEINE_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.48, 1600], [-0.04, 0.48, 1600]],
    mat, 0x3b6e8c, 'seine-water',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: { spireTipWorld: canvasToWorld(uFromPaint(0.54, SEINE_ASPECT), 0.64, 680), windowCount: 12, houseCount: 3 },
    timings,
  };
}

// ============================================================================
// 6. PLUM — Bridge in the Rain (after Hiroshige) (Paris, Autumn 1887), aspect = 0.78
// ============================================================================
export const PLUM_ASPECT = 0.78;
const HIRO_INDIGO = 0x162c4e;
const HIRO_AQUA = 0x2e7e78;
const HIRO_WOOD = 0xc89248;

export function generatePlumChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'plum:all');

  // 1. Ukiyo-e Indigo-Bokashi Storm Sky & Diagonal Rain Streaks (UNDERPAINT, SKY_BAND, WIND_JET)
  for (let i = 0; i < 4800; i++) {
    emitCanvasStroke(
      sink, PLUM_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.45, 1.06), rng.range(230000, 250000),
      rng.range(0.048, 0.088), rng.range(-0.2, 0.2), rng.range(0.024, 0.040),
      HIRO_INDIGO, HIRO_AQUA, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 16500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.46, 1.04);
    const topBand = smoothstep(0.76, 0.98, v);
    const cA = mixHex(0x88b4a8, HIRO_INDIGO, topBand);
    emitCanvasStroke(
      sink, PLUM_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.016, 0.032), rng.range(-0.15, 0.15), rng.range(0.005, 0.0095),
      cA, P.zincWhite, rng,
    );
  }
  // 3,200 crisp diagonal rain filaments (WIND_JET [220..11500 m])
  for (let i = 0; i < 3200; i++) {
    const uP = rng.range(0.02, 0.98);
    const v = rng.range(0.06, 0.96);
    emitCanvasStroke(
      sink, PLUM_ASPECT, StrokeClass.WIND_JET, uP, v, rng.range(260, 9500),
      rng.range(0.035, 0.065), -1.36, rng.range(0.0018, 0.0032),
      0xd8e4dc, HIRO_INDIGO, rng, { q1: rng.next(), q2: 0, q3: 0 },
    );
  }
  emitCustomStar(sink, PLUM_ASPECT, 0.48, 0.56, 12800, 0.020, 6, 1.1, rng, P.chrome);

  // 2. Emerald-Turquoise Sumida River (GROUND [205..1600 m])
  for (let i = 0; i < 16500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.52 * t;
    const d = clamp(210 + 1350 * (t * t), 205, 1580);
    const cA = shadeHex(mixHex(HIRO_AQUA, HIRO_INDIGO, 0.25 + 0.45 * t), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, PLUM_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.030), rng.range(-0.12, 0.12), rng.range(0.0045, 0.0085),
      cA, P.cerulean, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Arched Wooden Bridge on Stilts & Umbrella Wayfarers (HOUSE & WINDOW [465..960 m]) + Japonisme Border (CYPRESS)
  for (let i = 0; i < 6800; i++) {
    const isStilt = i >= 4200;
    const s = rng.next();
    const bridgeV = 0.18 + 0.28 * s + 0.07 * Math.sin(s * Math.PI);
    const uP = isStilt ? (0.15 + 0.16 * (i % 5) + rng.range(-0.012, 0.012)) : s;
    const v = isStilt ? rng.range(0.04, bridgeV) : bridgeV + rng.range(-0.032, 0.032);
    const d = clamp(480 + 380 * s, 465, 920);
    const ang = isStilt ? Math.PI * 0.5 : 0.28 + 0.22 * Math.cos(s * Math.PI);
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, PLUM_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.015, 0.028), rng.range(0.0045, 0.0085), T_DIR, N_FRONT,
      isStilt ? 0x6e4822 : HIRO_WOOD, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Glowing paper umbrellas on bridge (WINDOW [470..820 m])
  for (let uIdx = 0; uIdx < 6; uIdx++) {
    const s = 0.18 + uIdx * 0.12;
    const vUmb = 0.21 + 0.28 * s + 0.07 * Math.sin(s * Math.PI);
    for (let j = 0; j < 180; j++) {
      T_DIR.set(1, 0, 0);
      emitSurfaceStroke(
        sink, PLUM_ASPECT, StrokeClass.WINDOW, s + rng.range(-0.022, 0.022), vUmb + rng.range(0, 0.028), 475 + uIdx * 55,
        0.014, 0.005, T_DIR, N_FRONT,
        (uIdx & 1) ? P.lemon : 0xd84828, P.zincWhite, rng, { emissive: 0.9 },
      );
    }
  }
  // Japonisme calligraphy border frame in CYPRESS [150..175 m]
  for (let i = 0; i < 2000; i++) {
    const edge = i & 3;
    const uP = edge === 0 ? rng.range(0, 0.045) : edge === 1 ? rng.range(0.955, 1.0) : rng.range(0, 1);
    const v = edge === 2 ? rng.range(0, 0.04) : edge === 3 ? rng.range(0.96, 1.0) : rng.range(0, 1);
    emitCanvasStroke(
      sink, PLUM_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(152, 172),
      0.018, edge < 2 ? Math.PI * 0.5 : 0, 0.0055,
      (i % 7 === 0) ? 0xc83824 : HIRO_WOOD, P.ochre, rng,
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:plum';
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: { spireTipWorld: canvasToWorld(uFromPaint(0.48, PLUM_ASPECT), 0.56, 560), windowCount: 18, houseCount: 2 },
    timings,
  };
}

// ============================================================================
// 7. TANGUY — Portrait of Père Tanguy (Paris, Autumn 1887), aspect = 0.81
// ============================================================================
export const TANGUY_ASPECT = 0.81;
const COAT_COBALT = 0x1e3c6e;
const HAT_STRAW = 0xdcb458;
const SAKURA_PINK = 0xe8a4b0;

export function generateTanguyChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'tanguy:all');

  // 1. Vibrant Wall of 6 Japanese Ukiyo-e Prints behind Père Tanguy (UNDERPAINT, SKY_BAND, STAR_CORE Mt. Fuji)
  for (let i = 0; i < 4800; i++) {
    emitCanvasStroke(
      sink, TANGUY_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(-0.04, 1.06), rng.range(230000, 250000),
      rng.range(0.048, 0.088), rng.range(-0.3, 0.3), rng.range(0.024, 0.042),
      SAKURA_PINK, P.cerulean, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 21000; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.04, 1.04);
    const colIdx = (uP < 0.32 ? 0 : uP > 0.68 ? 2 : 1) + (v > 0.54 ? 3 : 0);
    const palette = [0xd84830, P.cerulean, SAKURA_PINK, P.lemon, 0x489c68, P.cobalt];
    const cA = shadeHex(palette[colIdx % palette.length], rng.range(0.86, 1.14));
    emitCanvasStroke(
      sink, TANGUY_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.014, 0.028), rng.range(-0.4, 0.4), rng.range(0.005, 0.0095),
      cA, P.zincWhite, rng,
    );
  }
  // Mount Fuji snow-crown directly above Père Tanguy's hat at (0.50, 0.86)
  emitCustomStar(sink, TANGUY_ASPECT, 0.50, 0.86, 12600, 0.022, 6, 1.15, rng, P.zincWhite);

  // 2. Sculptural Seated Figure of Père Tanguy: Cobalt Coat, Straw Hat, Beard & Clasped Hands (HOUSE & CYPRESS)
  for (let i = 0; i < 18500; i++) {
    const v = rng.range(0.02, 0.82);
    let halfW = 0.34;
    let cA = COAT_COBALT;
    let cB = P.ultramarine;
    if (v > 0.68) {
      // Wide-brimmed yellow straw hat
      halfW = 0.22;
      cA = HAT_STRAW;
      cB = P.ochre;
    } else if (v > 0.48) {
      // Kind bearded face
      halfW = 0.13;
      cA = 0xdca478;
      cB = 0x8e7258;
    }
    const uP = 0.50 + rng.range(-halfW, halfW);
    const d = clamp(475 + 180 * Math.abs(uP - 0.50), 468, 720);
    const ang = v > 0.68 ? rng.range(-0.2, 0.2) : Math.PI * 0.5 + (uP - 0.50) * 0.8;
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, TANGUY_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.015, 0.030), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
      shadeHex(cA, rng.range(0.86, 1.14)), cB, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Clasped hands in foreground (CYPRESS [156..222 m]) & Red lapel lines
  for (let i = 0; i < 2600; i++) {
    const th = rng.range(0, Math.PI * 2);
    const uP = 0.50 + 0.11 * Math.cos(th) * rng.range(0.2, 1.0);
    const v = 0.16 + 0.08 * Math.sin(th) * rng.range(0.2, 1.0);
    emitCanvasStroke(
      sink, TANGUY_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(158, 218),
      rng.range(0.014, 0.026), th + Math.PI * 0.5, rng.range(0.0045, 0.0085),
      0xdca478, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:tanguy';
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: { spireTipWorld: canvasToWorld(uFromPaint(0.50, TANGUY_ASPECT), 0.86, 520), windowCount: 16, houseCount: 1 },
    timings,
  };
}
