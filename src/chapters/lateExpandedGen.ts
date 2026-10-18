// Expanded Procedural 3D Brushstroke Worlds for Chapter IV (Cosmos: Saint-Rémy, 1889–1890)
// and Chapter V (Road: Auvers-sur-Oise, 1890):
//   - olive:       Olive Trees with Yellow Sky and Sun (Saint-Rémy, Nov 1889), aspect = 1.24
//   - roadcypress: Road with Cypress and Star (Saint-Rémy, May 1890), aspect = 0.79
//   - cottages:    Thatched Cottages at Cordeville (Auvers, May 1890), aspect = 1.26
//   - daubigny:    Daubigny's Garden (Auvers, July 1890), aspect = 1.98
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
// 1. OLIVE — Olive Trees with Yellow Sky and Sun (Saint-Rémy, Nov 1889), aspect = 1.24
// ============================================================================
export const OLIVE_ASPECT = 1.24;
const OLIVE_SAGE = 0x5c8258;
const OLIVE_SILVER = 0x8ea884;
const EARTH_ROSE = 0xb87458;

export function generateOliveChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'olive:all');

  // 1. Incandescent Yellow-Ochre Sky & Concentric Afternoon Sun at (0.54, 0.80)
  for (let i = 0; i < 4800; i++) {
    emitCanvasStroke(
      sink, OLIVE_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.56, 1.06), rng.range(230000, 250000),
      rng.range(0.048, 0.088), rng.range(-0.2, 0.2), rng.range(0.024, 0.040),
      P.lemon, P.chrome, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 16500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.58, 1.04);
    const dx = (uP - 0.54) * OLIVE_ASPECT;
    const dy = v - 0.80;
    const r = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) + Math.PI * 0.5 + rng.range(-0.15, 0.15);
    const cA = shadeHex(mixHex(P.lemon, P.chrome, clamp(r * 1.4, 0, 1)), rng.range(0.92, 1.10));
    emitCanvasStroke(
      sink, OLIVE_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.016, 0.032), ang, rng.range(0.0055, 0.010),
      cA, P.zincWhite, rng,
    );
  }
  emitCustomStar(sink, OLIVE_ASPECT, 0.54, 0.80, 12400, 0.034, 7, 1.35, rng, P.lemon, P.chrome);

  // 2. Undulating Rose-Ochre Earth & Cobalt Tree Shadows (GROUND [205..1650 m])
  for (let i = 0; i < 19500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.58 * t;
    const d = clamp(208 + 1400 * (t * t), 205, 1620);
    const waveAng = 0.28 * Math.sin(uP * 8.0 + v * 6.0);
    const inShadow = Math.sin(uP * 14.0 + v * 5.0) > 0.25;
    const cA = inShadow
      ? mixHex(P.cobalt, OLIVE_SAGE, 0.45)
      : shadeHex(mixHex(EARTH_ROSE, P.ochre, rng.range(0.25, 0.75)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, OLIVE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.016, 0.032), waveAng + rng.range(-0.14, 0.14), rng.range(0.005, 0.009),
      cA, P.lemon, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Five Writhing Gnarled Olive Trees & Swirling Silver-Green Canopies (CYPRESS, HOUSE, GROVE)
  const trees = [
    { u: 0.18, v0: 0.14, v1: 0.52, d: 175, near: true },
    { u: 0.38, v0: 0.22, v1: 0.58, d: 215, near: true },
    { u: 0.64, v0: 0.18, v1: 0.56, d: 192, near: true },
    { u: 0.82, v0: 0.28, v1: 0.62, d: 540, near: false },
    { u: 0.50, v0: 0.34, v1: 0.64, d: 680, near: false },
  ];
  for (const tr of trees) {
    // Gnarled trunk
    for (let j = 0; j < 750; j++) {
      const s = rng.next();
      const v = tr.v0 + (tr.v1 - tr.v0) * 0.55 * s;
      const uP = tr.u + 0.03 * Math.sin(s * 5.5) + rng.range(-0.022, 0.022);
      const ang = 1.52 + 0.35 * Math.cos(s * 5.5);
      if (tr.near) {
        emitCanvasStroke(
          sink, OLIVE_ASPECT, StrokeClass.CYPRESS, uP, v, tr.d + rng.range(-8, 8),
          0.022, ang, 0.006, 0x3b2c22, EARTH_ROSE, rng, { flags: StrokeFlag.OUTLINE },
        );
      } else {
        T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
        emitSurfaceStroke(
          sink, OLIVE_ASPECT, StrokeClass.HOUSE, uP, v, tr.d + rng.range(-15, 15),
          0.020, 0.0055, T_DIR, N_FRONT, 0x3b2c22, EARTH_ROSE, rng, { flags: StrokeFlag.OUTLINE },
        );
      }
    }
    // Swirling silver-sage olive foliage canopy in GROVE [260..1200 m]
    for (let j = 0; j < 1850; j++) {
      const th = rng.range(0, Math.PI * 2);
      const r = Math.pow(rng.next(), 0.7);
      const uP = tr.u + r * 0.14 * Math.cos(th);
      const v = tr.v1 + r * 0.11 * Math.sin(th);
      const tang = th + Math.PI * 0.5 + rng.range(-0.2, 0.2);
      T_DIR.set(Math.cos(tang), Math.sin(tang), 0).normalize();
      emitSurfaceStroke(
        sink, OLIVE_ASPECT, StrokeClass.GROVE, uP, v, clamp(tr.d + 120 + rng.range(-30, 30), 260, 1180),
        rng.range(0.016, 0.032), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
        shadeHex(mixHex(OLIVE_SAGE, OLIVE_SILVER, rng.range(0.2, 0.8)), rng.range(0.88, 1.12)), P.lemon, rng,
      );
    }
  }

  const underlays = new Group();
  underlays.name = 'underlays:olive';
  underlays.add(buildCanvasQuadMesh(
    OLIVE_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.58, 1600], [-0.04, 0.58, 1600]],
    mat, EARTH_ROSE, 'olive-grove-earth',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(OLIVE_ASPECT, 0.54, 0.80, 560),
    timings,
  };
}

// ============================================================================
// 2. ROADCYPRESS — Road with Cypress and Star (Saint-Rémy, May 1890), aspect = 0.79
// ============================================================================
export const ROADCYPRESS_ASPECT = 0.79;
const CYPRESS_FLAME = 0x0e241c;
const ROAD_OCHRE = 0xdcb864;

export function generateRoadCypressChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'roadcypress:all');

  // 1. Swirling Cobalt-Cerulean Nocturnal Sky, Crescent Moon (0.76, 0.78) & Evening Star (0.22, 0.74)
  for (let i = 0; i < 4800; i++) {
    emitCanvasStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.32, 1.06), rng.range(230000, 250000),
      rng.range(0.048, 0.088), rng.range(-0.25, 0.25), rng.range(0.024, 0.042),
      P.prussian, P.cobalt, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 18500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.34, 1.04);
    const wave = 0.35 * Math.sin(uP * 7.5 + v * 5.5);
    const cA = shadeHex(mixHex(P.cobalt, P.cerulean, rng.range(0.15, 0.65)), rng.range(0.86, 1.14));
    emitCanvasStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.018, 0.036), wave + rng.range(-0.15, 0.15), rng.range(0.0055, 0.010),
      cA, P.zincWhite, rng,
    );
  }
  emitCustomStar(sink, ROADCYPRESS_ASPECT, 0.76, 0.78, 12200, 0.026, 7, 1.3, rng, P.chrome);
  emitCustomStar(sink, ROADCYPRESS_ASPECT, 0.22, 0.74, 12800, 0.022, 6, 1.15, rng, P.lemon);

  // 2. Distant Undulating Blue-Violet Alpilles Hills across Horizon (HILL [1850..3600 m])
  for (let i = 0; i < 2400; i++) {
    const uP = rng.range(-0.04, 1.04);
    const ridgeTop = 0.41 + 0.035 * Math.sin(uP * 8.5 + 0.6);
    const v = rng.range(0.32, ridgeTop);
    const d = rng.range(1850, 3550);
    const slope = 0.28 * Math.cos(uP * 8.5 + 0.6);
    emitCanvasStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.HILL, uP, v, d,
      rng.range(0.016, 0.032), slope + rng.range(-0.12, 0.12), rng.range(0.005, 0.009),
      shadeHex(mixHex(P.prussian, P.cobalt, rng.range(0.25, 0.75)), rng.range(0.85, 1.12)), P.cerulean, rng,
      { flags: StrokeFlag.OUTLINE },
    );
  }

  // 3. Winding Provençal Road & Golden Wheat Shoulder (GROUND [205..1580 m])
  for (let i = 0; i < 17500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.36 * t;
    const d = clamp(208 + 1340 * (t * t), 205, 1560);
    const roadCenter = 0.52 - 0.18 * Math.sin(v * 7.5);
    const onRoad = Math.abs(uP - roadCenter) < 0.22 * (1 - 0.55 * t);
    const cA = onRoad
      ? shadeHex(mixHex(ROAD_OCHRE, P.cerulean, 0.25), rng.range(0.88, 1.12))
      : shadeHex(mixHex(P.chrome, P.cypressGreen, rng.range(0.2, 0.6)), rng.range(0.86, 1.12));
    emitCanvasStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.030), 1.25 + rng.range(-0.25, 0.25), rng.range(0.0045, 0.0085),
      cA, P.cobalt, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 4. One Towering Cypress Flame at Center (CYPRESS [146..238 m]). The painting has a single cypress, which Van Gogh
  //    described as 'very tall, very straight, very dark'; it splits the sky between the star and the crescent moon.
  //    uCenter ~ 0.48, v = 0.20..1.00, d ~ 160..220 m (front at the spine, back at the flanks).
  const cypressTrees = [
    { uBase: 0.48, vMin: 0.20, vSpan: 0.80, width: 0.105, dBase: 160, dSpan: 60, count: 9000, swayPhase: 0.0 },
  ];
  for (const tree of cypressTrees) {
    // Trunk at base of each cypress
    for (let j = 0; j < 280; j++) {
      const uP = tree.uBase + rng.range(-0.018, 0.018);
      const v = rng.range(tree.vMin - 0.04, tree.vMin + 0.08);
      emitCanvasStroke(
        sink, ROADCYPRESS_ASPECT, StrokeClass.CYPRESS, uP, v, tree.dBase + rng.range(-6, 6),
        0.018, Math.PI * 0.5 + rng.range(-0.08, 0.08), 0.005,
        0x3b281c, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
    // Surging dark-emerald and bronze-black flame foliage
    for (let i = 0; i < tree.count; i++) {
      const s = Math.pow(rng.next(), 0.85);
      const v = tree.vMin + tree.vSpan * s;
      const taper = Math.max(0.012, tree.width * (1 - 0.82 * s));
      const spineU = tree.uBase + 0.020 * Math.sin(v * 9.0 + tree.swayPhase);
      const offset = rng.range(-taper, taper);
      const uP = spineU + offset;
      const d = clamp(tree.dBase + tree.dSpan * (Math.abs(offset) / Math.max(0.01, taper)) + rng.range(-4, 4), 146, 238);
      const curl = 1.57 + 0.32 * Math.sin(v * 14.0 + uP * 10.0 + tree.swayPhase);
      const cA = (i % 5 === 0) ? mixHex(P.cypressGreen, P.ochre, 0.35) : CYPRESS_FLAME;
      emitCanvasStroke(
        sink, ROADCYPRESS_ASPECT, StrokeClass.CYPRESS, uP, v, d,
        rng.range(0.020, 0.040), curl, rng.range(0.005, 0.0092),
        cA, P.cypressGreen, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  // 5. Two Nocturnal Wayfarers (d = 340 m), Horse-Drawn Yellow Carriage (d = 660 m) & Roadside Inn (d = 820 m)
  // Two wayfarers walking side by side at uP = 0.34 & 0.39, v = 0.11..0.23, d = 340 m (promoted to GROVE)
  for (const wu of [0.34, 0.39]) {
    for (let j = 0; j < 320; j++) {
      const s = rng.next();
      const v = 0.11 + 0.12 * s;
      const uP = wu + rng.range(-0.016, 0.016);
      const isHat = s > 0.82;
      T_DIR.set(0, 1, 0);
      emitSurfaceStroke(
        sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE, uP, v, 340 + rng.range(-12, 12),
        0.014, 0.0048, T_DIR, N_FRONT,
        isHat ? P.chrome : P.cobalt, P.prussian, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }
  // Yellow horse-drawn carriage at uP = 0.62..0.73, v = 0.20..0.31, d = 660 m
  for (let i = 0; i < 1100; i++) {
    const isHorse = i < 380;
    const uP = isHorse ? rng.range(0.61, 0.66) : rng.range(0.66, 0.73);
    const v = isHorse ? rng.range(0.20, 0.27) : rng.range(0.21, 0.31);
    T_DIR.set(isHorse ? 1 : 0, isHorse ? 0.2 : 1, 0).normalize();
    emitSurfaceStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE, uP, v, 660 + rng.range(-18, 18),
      0.015, 0.005, T_DIR, N_FRONT,
      isHorse ? 0xd8d4c8 : P.chrome, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Roadside cottage/inn on right horizon (uP = 0.80..0.94, v = 0.28..0.44, d = 820 m) + glowing window
  for (let i = 0; i < 950; i++) {
    const uP = rng.range(0.80, 0.94);
    const v = rng.range(0.28, 0.44);
    const isRoof = v > 0.38;
    T_DIR.set(isRoof ? 1 : 0, isRoof ? -0.25 : 1, 0).normalize();
    emitSurfaceStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE, uP, v, 820 + rng.range(-22, 22),
      0.016, 0.0052, T_DIR, N_FRONT,
      isRoof ? 0xb85228 : 0xd8cfa8, P.cobalt, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  for (let j = 0; j < 220; j++) {
    T_DIR.set(0, 1, 0);
    emitSurfaceStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.WINDOW, 0.85 + rng.range(-0.016, 0.016), 0.33 + rng.range(-0.02, 0.02), 805,
      0.013, 0.0045, T_DIR, N_FRONT, P.lemon, P.chrome, rng, { emissive: 1.25 },
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:roadcypress';
  underlays.add(buildCanvasQuadMesh(
    ROADCYPRESS_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.32, 1300], [-0.04, 0.32, 1300]], // stops where the Alpilles start (v >= 0.32)
    mat, 0x3b3422, 'roadcypress-road',
  ));
  underlays.add(buildCanvasQuadMesh(
    ROADCYPRESS_ASPECT,
    [[0.44, 0.20, 196], [0.52, 0.20, 196], [0.505, 0.94, 200], [0.48, 0.94, 200]], // inside the swaying foliage at every height
    mat, CYPRESS_FLAME, 'roadcypress-cypress-core',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(ROADCYPRESS_ASPECT, 0.48, 0.96, 175),
    timings,
  };
}

// ============================================================================
// 3. COTTAGES — Thatched Cottages at Cordeville (Auvers, May 1890), aspect = 1.26
// ============================================================================
export const COTTAGES_ASPECT = 1.26;
const THATCH_MOSS = 0x4e7838;
const THATCH_GOLD = 0xc89e3c;
const WALL_LIME = 0xdcd4b8;

export function generateCottagesChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'cottages:all');

  // 1. Boiling Cobalt & Cerulean Auvers Cloud Eddies (UNDERPAINT, SKY_BAND, EDDY)
  for (let i = 0; i < 4800; i++) {
    emitCanvasStroke(
      sink, COTTAGES_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.52, 1.06), rng.range(230000, 250000),
      rng.range(0.048, 0.088), rng.range(-0.25, 0.25), rng.range(0.024, 0.040),
      P.cobalt, P.zincWhite, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 17500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.54, 1.04);
    const wave = 0.42 * Math.sin(uP * 8.0 + v * 6.0);
    const cA = shadeHex(mixHex(P.cerulean, P.zincWhite, rng.range(0.2, 0.75)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, COTTAGES_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.016, 0.034), wave, rng.range(0.0055, 0.010),
      cA, P.cobalt, rng,
    );
  }

  // 2. Waving Auvers Spring Meadow & Rain-Washed Path (GROUND [205..1600 m])
  for (let i = 0; i < 19000; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.44 * t;
    const d = clamp(208 + 1350 * (t * t), 205, 1580);
    const cA = shadeHex(mixHex(THATCH_MOSS, THATCH_GOLD, rng.range(0.2, 0.7)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, COTTAGES_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.030), 1.15 + 0.35 * Math.sin(uP * 9.0) + rng.range(-0.15, 0.15), rng.range(0.0045, 0.0085),
      cA, P.cypressGreen, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Heaving Moss-Covered Thatched Cottage Roofs & Walls (HOUSE, WINDOW) + Wind-Tossed Trees (CYPRESS)
  for (let i = 0; i < 8200; i++) {
    const uP = rng.range(0.14, 0.88);
    const roofTop = 0.64 + 0.06 * Math.sin(uP * 9.5) - 0.12 * Math.max(0, uP - 0.58);
    const v = rng.range(0.36, roofTop);
    const isRoof = v > 0.48;
    const d = clamp(510 + 380 * (uP - 0.14), 480, 920);
    const ang = isRoof ? 0.32 * Math.cos(uP * 9.5) : Math.PI * 0.5;
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, COTTAGES_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.016, 0.032), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
      isRoof ? mixHex(THATCH_GOLD, THATCH_MOSS, rng.range(0.2, 0.7)) : WALL_LIME,
      0xc85428, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Glowing cottage windows (WINDOW [485..780 m]) & Wind-whipped dark trees (CYPRESS [152..236 m])
  for (const [wu, wv] of [[0.28, 0.44], [0.42, 0.44], [0.64, 0.42]]) {
    for (let j = 0; j < 240; j++) {
      T_DIR.set(0, 1, 0);
      emitSurfaceStroke(
        sink, COTTAGES_ASPECT, StrokeClass.WINDOW, wu + rng.range(-0.02, 0.02), wv + rng.range(-0.025, 0.025), 500,
        0.015, 0.005, T_DIR, N_FRONT, P.lemon, P.chrome, rng, { emissive: 1.1 },
      );
    }
  }
  for (let i = 0; i < 3200; i++) {
    const s = rng.next();
    const uP = (i < 1600 ? 0.12 : 0.78) + 0.04 * Math.sin(s * 7.0) + rng.range(-0.04, 0.04);
    const v = 0.32 + 0.56 * s;
    emitCanvasStroke(
      sink, COTTAGES_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(155, 232),
      rng.range(0.020, 0.038), 1.45 + 0.35 * Math.cos(s * 7.0), rng.range(0.005, 0.0095),
      P.cypressGreen, THATCH_MOSS, rng, { flags: StrokeFlag.OUTLINE },
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:cottages';
  underlays.add(buildCanvasQuadMesh(
    COTTAGES_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.44, 1550], [-0.04, 0.44, 1550]],
    mat, THATCH_MOSS, 'cottages-meadow',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(COTTAGES_ASPECT, 0.34, 0.68, 560),
    timings,
  };
}

// ============================================================================
// 4. DAUBIGNY — Daubigny's Garden (Auvers-sur-Oise, July 1890), aspect = 1.98
// ============================================================================
export const DAUBIGNY_ASPECT = 1.98;
const LAWN_CELADON = 0x8ec868;
const ROSE_BED = 0xe86878;
const VILLA_CREAM = 0xe8dcc0;

export function generateDaubignyChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'daubigny:all');

  // 1. Pale Celadon-Turquoise Summer Sky over Auvers (UNDERPAINT & SKY_BAND)
  for (let i = 0; i < 4800; i++) {
    emitCanvasStroke(
      sink, DAUBIGNY_ASPECT, StrokeClass.UNDERPAINT, rng.range(-0.10, 1.10), rng.range(0.60, 1.06), rng.range(230000, 250000),
      rng.range(0.048, 0.088), rng.range(-0.2, 0.2), rng.range(0.024, 0.040),
      0xb8e0d8, P.zincWhite, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }
  for (let i = 0; i < 15500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.62, 1.04);
    emitCanvasStroke(
      sink, DAUBIGNY_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.015, 0.030), rng.range(-0.18, 0.18), rng.range(0.005, 0.0095),
      shadeHex(mixHex(0xa8dcd2, P.zincWhite, rng.range(0.25, 0.78)), rng.range(0.92, 1.08)), P.lemon, rng,
    );
  }

  // 2. Sweeping 2:1 Garden Lawn, Rose Flowerbeds & Ochre Gravel Paths (GROUND [205..1650 m])
  for (let i = 0; i < 23500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.58 * t;
    const d = clamp(208 + 1400 * (t * t), 205, 1620);
    const inRoseBed = Math.hypot((uP - 0.54) * 1.4, v - 0.28) < 0.18 || Math.hypot((uP - 0.18) * 1.4, v - 0.24) < 0.14;
    const cA = inRoseBed
      ? ((i & 1) ? ROSE_BED : P.lemon)
      : shadeHex(mixHex(LAWN_CELADON, VILLA_CREAM, rng.range(0.15, 0.55)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, DAUBIGNY_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.013, 0.026), rng.range(-0.35, 0.35), rng.range(0.004, 0.0075),
      cA, 0x3b7842, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Daubigny's Villa, Romanesque Belfry & Garden Trees (HOUSE, CHURCH, GROVE) + Foreground Black Cat (CYPRESS)
  for (let i = 0; i < 7200; i++) {
    const isVilla = i < 3600;
    const uP = isVilla ? rng.range(0.36, 0.68) : rng.range(0.04, 0.96);
    const v = isVilla ? rng.range(0.54, 0.82) : rng.range(0.46, 0.78);
    const d = isVilla ? rng.range(720, 980) : rng.range(420, 880);
    const cls = isVilla ? StrokeClass.HOUSE : StrokeClass.GROVE;
    const cA = isVilla ? (v > 0.70 ? 0x3b485c : VILLA_CREAM) : mixHex(0x2e6e3e, LAWN_CELADON, rng.range(0.2, 0.7));
    T_DIR.set(0, 1, 0);
    emitSurfaceStroke(
      sink, DAUBIGNY_ASPECT, cls, uP, v, d,
      rng.range(0.015, 0.030), rng.range(0.005, 0.009), T_DIR, N_FRONT,
      cA, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Iconic little black cat prowling across the foreground lawn at (0.32, 0.18) + Foreground rosebushes (CYPRESS)
  for (let i = 0; i < 1600; i++) {
    const isCat = i < 350;
    const uP = isCat ? 0.32 + rng.range(-0.025, 0.025) : (i < 950 ? 0.12 : 0.86) + rng.range(-0.06, 0.06);
    const v = isCat ? 0.18 + rng.range(-0.02, 0.02) : rng.range(0.08, 0.42);
    emitCanvasStroke(
      sink, DAUBIGNY_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(155, 222),
      rng.range(0.014, 0.026), isCat ? 0.15 : 1.48, rng.range(0.004, 0.008),
      isCat ? 0x0c1018 : 0x265c34, ROSE_BED, rng, { flags: StrokeFlag.OUTLINE },
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:daubigny';
  underlays.add(buildCanvasQuadMesh(
    DAUBIGNY_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.58, 1600], [-0.04, 0.58, 1600]],
    mat, LAWN_CELADON, 'daubigny-lawn',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(DAUBIGNY_ASPECT, 0.52, 0.74, 780),
    timings,
  };
}
