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
  buildCanvasQuadMesh, clamp, emitCanvasStroke, emitCustomStar, emitPathStrokes, emitSurfaceStroke,
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

  // 2. Distant Undulating Alpilles Ridge & Rose-Ochre Earth with Cobalt Tree Shadows (HILL & GROUND)
  for (let i = 0; i < 1800; i++) {
    const uP = rng.range(-0.04, 1.04);
    const vTop = 0.61 + 0.025 * Math.sin(uP * 9.0 + 0.8);
    const v = rng.range(0.55, vTop);
    T_DIR.set(1, 0.22 * Math.cos(uP * 9.0 + 0.8), 0).normalize();
    emitSurfaceStroke(
      sink, OLIVE_ASPECT, StrokeClass.HILL, uP, v, rng.range(1850, 3200),
      rng.range(0.015, 0.030), rng.range(0.005, 0.009), T_DIR, N_FRONT,
      mixHex(P.ochre, 0x8e6878, rng.range(0.25, 0.7)), P.lemon, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
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
    const cls = tr.near ? StrokeClass.CYPRESS : StrokeClass.HOUSE;
    // Spreading gnarled roots, full writhing trunk up to canopy base, and forked branches
    emitPathStrokes(
      sink, OLIVE_ASPECT, cls,
      [
        [tr.u - 0.035, tr.v0 - 0.03],
        [tr.u, tr.v0 + 0.02],
        [tr.u + 0.024, (tr.v0 + tr.v1) * 0.5],
        [tr.u - 0.012, tr.v1 - 0.04],
      ],
      tr.d, 260, 0.020, 0.0065, 0x3b2c22, EARTH_ROSE, rng, { spread: 0.016 },
    );
    emitPathStrokes(
      sink, OLIVE_ASPECT, cls,
      [[tr.u + 0.032, tr.v0 - 0.025], [tr.u, tr.v0 + 0.03]],
      tr.d - 2, 65, 0.018, 0.0055, 0x2e2018, EARTH_ROSE, rng, { spread: 0.008 },
    );
    // Forked limbs reaching into the olive foliage
    emitPathStrokes(
      sink, OLIVE_ASPECT, cls,
      [[tr.u - 0.012, tr.v1 - 0.05], [tr.u - 0.055, tr.v1 + 0.01], [tr.u - 0.085, tr.v1 + 0.045]],
      tr.d + 4, 95, 0.017, 0.0052, 0x3b2c22, OLIVE_SAGE, rng, { spread: 0.008 },
    );
    emitPathStrokes(
      sink, OLIVE_ASPECT, cls,
      [[tr.u - 0.008, tr.v1 - 0.05], [tr.u + 0.045, tr.v1 + 0.015], [tr.u + 0.078, tr.v1 + 0.05]],
      tr.d + 4, 95, 0.017, 0.0052, 0x3b2c22, OLIVE_SAGE, rng, { spread: 0.008 },
    );
    // Swirling silver-sage olive foliage canopy in GROVE [260..1200 m]
    for (let j = 0; j < 1850; j++) {
      const th = rng.range(0, Math.PI * 2);
      const r = Math.pow(rng.next(), 0.7);
      const uP = tr.u + r * 0.145 * Math.cos(th);
      const v = tr.v1 + r * 0.115 * Math.sin(th);
      const tang = th + Math.PI * 0.5 + rng.range(-0.2, 0.2);
      T_DIR.set(Math.cos(tang), Math.sin(tang), 0).normalize();
      emitSurfaceStroke(
        sink, OLIVE_ASPECT, StrokeClass.GROVE, uP, v, clamp(tr.d + 120 + rng.range(-30, 30), 260, 1180),
        rng.range(0.016, 0.032), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
        shadeHex(mixHex(OLIVE_SAGE, OLIVE_SILVER, rng.range(0.2, 0.8)), rng.range(0.88, 1.12)), P.lemon, rng,
      );
    }
    // Cloisonnist dark olive-emerald wave contour around top of each billowy crown
    emitPathStrokes(
      sink, OLIVE_ASPECT, StrokeClass.GROVE,
      [
        [tr.u - 0.13, tr.v1 - 0.01],
        [tr.u - 0.07, tr.v1 + 0.085],
        [tr.u, tr.v1 + 0.105],
        [tr.u + 0.07, tr.v1 + 0.085],
        [tr.u + 0.13, tr.v1 - 0.01],
      ],
      clamp(tr.d + 95, 260, 1160), 110, 0.016, 0.005, 0x243b24, OLIVE_SILVER, rng, { spread: 0.006 },
    );
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
  // Crisp golden-orange Crescent Moon arc at (0.76, 0.78) inside the moon halo
  for (let j = 0; j < 180; j++) {
    const th = rng.range(-1.85, 0.85);
    const r = rng.range(0.016, 0.032);
    const uP = 0.76 + (r / ROADCYPRESS_ASPECT) * Math.cos(th);
    const v = 0.78 + r * Math.sin(th);
    emitCanvasStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.STAR_CORE, uP, v, 11900,
      0.014, th + Math.PI * 0.5, 0.0048, 0xf2781c, P.lemon, rng, { emissive: 0.75 },
    );
  }

  // 2. Distant Undulating Blue-Violet Alpilles Hills across Horizon (HILL [1850..3550 m])
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
  // Cloisonnist dark cobalt border edges along the winding road
  emitPathStrokes(
    sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE,
    [[0.22, 0.01], [0.21, 0.12], [0.26, 0.24], [0.36, 0.33]],
    420, 140, 0.015, 0.005, P.prussian, P.cobalt, rng, { spread: 0.005 },
  );
  emitPathStrokes(
    sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE,
    [[0.78, 0.01], [0.64, 0.12], [0.58, 0.24], [0.56, 0.33]],
    420, 140, 0.015, 0.005, P.prussian, P.cobalt, rng, { spread: 0.005 },
  );

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
  // Two wayfarers walking side by side at uP = 0.335 & 0.39, v = 0.09..0.24, d = 340 m
  for (const wu of [0.335, 0.39]) {
    // Striding legs & cobalt jacket
    emitPathStrokes(
      sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE,
      [[wu - 0.01, 0.09], [wu, 0.15], [wu, 0.21]],
      338, 120, 0.014, 0.005, P.cobalt, P.prussian, rng, { spread: 0.010 },
    );
    emitPathStrokes(
      sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE,
      [[wu + 0.012, 0.09], [wu, 0.15]],
      340, 45, 0.013, 0.0045, P.prussian, P.cobalt, rng, { spread: 0.006 },
    );
    // Wide-brimmed yellow hat
    emitPathStrokes(
      sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE,
      [[wu - 0.02, 0.225], [wu, 0.238], [wu + 0.02, 0.225]],
      335, 55, 0.013, 0.0045, P.chrome, P.lemon, rng, { spread: 0.004 },
    );
  }
  // Yellow horse-drawn carriage at uP = 0.60..0.74, v = 0.20..0.31, d = 660 m
  for (let i = 0; i < 950; i++) {
    const isHorse = i < 340;
    const uP = isHorse ? rng.range(0.60, 0.655) : rng.range(0.66, 0.735);
    const v = isHorse ? rng.range(0.20, 0.265) : rng.range(0.215, 0.305);
    T_DIR.set(isHorse ? 1 : 0, isHorse ? 0.2 : 1, 0).normalize();
    emitSurfaceStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE, uP, v, 660 + rng.range(-15, 15),
      0.014, 0.0048, T_DIR, N_FRONT,
      isHorse ? 0xd8d4c8 : P.chrome, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Carriage wheels & dark contour
  for (const [wu, wv] of [[0.672, 0.205], [0.72, 0.208]]) {
    for (let j = 0; j < 75; j++) {
      const th = rng.range(0, Math.PI * 2);
      const r = 0.018;
      T_DIR.set(-Math.sin(th), Math.cos(th), 0).normalize();
      emitSurfaceStroke(
        sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE, wu + (r / ROADCYPRESS_ASPECT) * Math.cos(th), wv + r * Math.sin(th), 648,
        0.011, 0.0038, T_DIR, N_FRONT, P.prussian, P.chrome, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
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
  emitPathStrokes(
    sink, ROADCYPRESS_ASPECT, StrokeClass.HOUSE,
    [[0.795, 0.38], [0.87, 0.445], [0.945, 0.38]],
    805, 85, 0.014, 0.0045, P.prussian, 0xb85228, rng, { spread: 0.003 },
  );
  for (let j = 0; j < 180; j++) {
    T_DIR.set(0, 1, 0);
    emitSurfaceStroke(
      sink, ROADCYPRESS_ASPECT, StrokeClass.WINDOW, 0.85 + rng.range(-0.016, 0.016), 0.33 + rng.range(-0.02, 0.02), 802,
      0.013, 0.0045, T_DIR, N_FRONT, P.lemon, P.chrome, rng, { emissive: 0.45 },
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
    const onLane = Math.abs(uP - (0.48 - 0.14 * Math.sin(v * 6.5))) < 0.11 * (1 - 0.4 * t);
    const cA = onLane
      ? shadeHex(mixHex(0xd4b878, WALL_LIME, 0.35), rng.range(0.88, 1.12))
      : shadeHex(mixHex(THATCH_MOSS, THATCH_GOLD, rng.range(0.2, 0.7)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, COTTAGES_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.030), 1.15 + 0.35 * Math.sin(uP * 9.0) + rng.range(-0.15, 0.15), rng.range(0.0045, 0.0085),
      cA, P.cypressGreen, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Sculpted Twin Cordeville Cottages with Pitched Gables, Moss-Thatch Roofs, Chimneys & Casement Windows (HOUSE, WINDOW)
  for (let i = 0; i < 8600; i++) {
    const uP = rng.range(0.16, 0.86);
    const inLeftCottage = uP < 0.54;
    const gablePeak = inLeftCottage
      ? 0.69 - 0.85 * Math.abs(uP - 0.35) + 0.018 * Math.sin(uP * 18.0)
      : 0.62 - 0.78 * Math.abs(uP - 0.69) + 0.015 * Math.sin(uP * 18.0);
    const eaveV = inLeftCottage ? 0.485 : 0.465;
    const v = rng.range(0.35, Math.max(eaveV + 0.03, gablePeak));
    const isRoof = v > eaveV;
    const d = clamp(505 + 340 * (uP - 0.16), 485, 880);
    const slopeAng = isRoof
      ? (inLeftCottage ? (uP < 0.35 ? 0.62 : -0.62) : (uP < 0.69 ? 0.56 : -0.56))
      : Math.PI * 0.5;
    T_DIR.set(Math.cos(slopeAng), Math.sin(slopeAng), 0).normalize();
    const isShadowWall = !isRoof && ((inLeftCottage && uP > 0.42) || (!inLeftCottage && uP > 0.75));
    const cA = isRoof
      ? shadeHex(mixHex(THATCH_GOLD, (i % 3 === 0) ? THATCH_MOSS : 0xc86428, rng.range(0.2, 0.72)), rng.range(0.88, 1.12))
      : isShadowWall
        ? mixHex(WALL_LIME, P.cobalt, 0.32)
        : shadeHex(WALL_LIME, rng.range(0.92, 1.08));
    emitSurfaceStroke(
      sink, COTTAGES_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.015, 0.030), rng.range(0.005, 0.009), T_DIR, N_FRONT,
      cA, 0x8e4220, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Brick chimneys jutting from the thatched roof ridges
  for (const [cu, cv0, cv1, cd] of [[0.34, 0.66, 0.74, 540], [0.68, 0.59, 0.67, 680]]) {
    emitPathStrokes(
      sink, COTTAGES_ASPECT, StrokeClass.HOUSE,
      [[cu, cv0], [cu, cv1]],
      cd, 75, 0.015, 0.0055, 0xc84c28, P.ochre, rng, { spread: 0.012 },
    );
  }
  // Cloisonnist dark timber eaves, gable ridges & wall corner contours
  emitPathStrokes(
    sink, COTTAGES_ASPECT, StrokeClass.HOUSE,
    [[0.155, 0.485], [0.35, 0.69], [0.54, 0.485], [0.69, 0.62], [0.865, 0.465]],
    495, 240, 0.016, 0.005, 0x241c18, THATCH_GOLD, rng, { spread: 0.004 },
  );
  emitPathStrokes(
    sink, COTTAGES_ASPECT, StrokeClass.HOUSE,
    [[0.16, 0.485], [0.54, 0.485], [0.86, 0.465]],
    492, 180, 0.015, 0.0048, 0x241c18, WALL_LIME, rng, { spread: 0.003 },
  );
  // Dark-framed cottage casement windows & wooden door (low emissive so daytime cottages don't blow out)
  for (const [wu, wv, wd] of [[0.25, 0.42, 500], [0.36, 0.42, 520], [0.35, 0.56, 515], [0.62, 0.41, 640], [0.73, 0.41, 680]]) {
    for (let j = 0; j < 110; j++) {
      T_DIR.set(0, 1, 0);
      emitSurfaceStroke(
        sink, COTTAGES_ASPECT, StrokeClass.WINDOW, wu + rng.range(-0.018, 0.018), wv + rng.range(-0.024, 0.024), wd,
        0.013, 0.0045, T_DIR, N_FRONT, (j & 1) ? 0x243448 : P.ochre, P.lemon, rng, { emissive: 0.22 },
      );
    }
    emitPathStrokes(
      sink, COTTAGES_ASPECT, StrokeClass.HOUSE,
      [[wu - 0.019, wv - 0.025], [wu - 0.019, wv + 0.025], [wu + 0.019, wv + 0.025], [wu + 0.019, wv - 0.025], [wu - 0.019, wv - 0.025]],
      wd - 4, 60, 0.012, 0.0038, 0x1c1814, WALL_LIME, rng, { spread: 0.0018 },
    );
  }
  // Wooden cottage door at uP = 0.47, v = 0.35..0.46
  emitPathStrokes(
    sink, COTTAGES_ASPECT, StrokeClass.HOUSE,
    [[0.47, 0.35], [0.47, 0.455]],
    535, 95, 0.015, 0.0055, 0x5c341c, 0x241810, rng, { spread: 0.012 },
  );

  // 4. Wind-Tossed Auvers Trees & Billowy Foliage Framing Left & Right (CYPRESS [152..236 m])
  for (const [tu, tv0, tv1] of [[0.11, 0.30, 0.86], [0.82, 0.32, 0.84]]) {
    // Writhing dark trunk & branches
    emitPathStrokes(
      sink, COTTAGES_ASPECT, StrokeClass.CYPRESS,
      [[tu, tv0], [tu + 0.02, (tv0 + tv1) * 0.5], [tu - 0.015, tv1 - 0.08]],
      168, 220, 0.018, 0.006, 0x2e2018, P.cypressGreen, rng, { spread: 0.014 },
    );
    // Swirling wind-tossed leaf crown
    for (let j = 0; j < 1350; j++) {
      const th = rng.range(0, Math.PI * 2);
      const r = Math.pow(rng.next(), 0.72);
      const uP = tu + r * 0.095 * Math.cos(th);
      const v = (tv0 + tv1) * 0.56 + r * 0.24 * Math.sin(th);
      const curl = th + Math.PI * 0.5 + 0.3 * Math.sin(v * 9.0);
      emitCanvasStroke(
        sink, COTTAGES_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(155, 228),
        rng.range(0.018, 0.036), curl, rng.range(0.005, 0.009),
        (j % 4 === 0) ? THATCH_MOSS : P.cypressGreen, P.cerulean, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
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
    const uP = rng.range(-0.10, 1.10);
    const v = rng.range(0.58, 1.04);
    emitCanvasStroke(
      sink, DAUBIGNY_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.015, 0.030), rng.range(-0.18, 0.18), rng.range(0.005, 0.0095),
      shadeHex(mixHex(0xa8dcd2, P.zincWhite, rng.range(0.25, 0.78)), rng.range(0.92, 1.08)), P.lemon, rng,
    );
  }

  // 2. Sweeping 2:1 Garden Lawn, Rose Flowerbeds & Curving Ochre Gravel Paths (GROUND [205..1650 m])
  for (let i = 0; i < 23500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.58 * t;
    const d = clamp(208 + 1400 * (t * t), 205, 1620);
    const inCentralBed = Math.hypot((uP - 0.52) * 1.4, v - 0.27) < 0.16;
    const inLeftBed = Math.hypot((uP - 0.18) * 1.4, v - 0.23) < 0.12;
    const onGravelPath = Math.abs(Math.hypot((uP - 0.52) * 1.35, v - 0.27) - 0.21) < 0.048
      || Math.abs(uP - (0.76 - 0.18 * v)) < 0.045;
    const cA = (inCentralBed || inLeftBed)
      ? ((i % 3 === 0) ? ROSE_BED : (i % 3 === 1) ? P.lemon : 0x3b7842)
      : onGravelPath
        ? shadeHex(mixHex(VILLA_CREAM, 0xd8b478, rng.range(0.25, 0.65)), rng.range(0.92, 1.08))
        : shadeHex(mixHex(LAWN_CELADON, VILLA_CREAM, rng.range(0.12, 0.45)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, DAUBIGNY_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.013, 0.026), rng.range(-0.35, 0.35), rng.range(0.004, 0.0075),
      cA, 0x3b7842, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }
  // Cloisonnist border around the circular central rosebed
  emitPathStrokes(
    sink, DAUBIGNY_ASPECT, StrokeClass.GROVE,
    [[0.40, 0.24], [0.45, 0.37], [0.52, 0.41], [0.59, 0.37], [0.64, 0.24], [0.58, 0.14], [0.46, 0.14], [0.40, 0.24]],
    420, 180, 0.014, 0.0048, 0x2e6438, ROSE_BED, rng, { spread: 0.006 },
  );

  // 3. Daubigny's Villa with Steep Slate Roof, Turret, Shutters & Auvers Church Belfry (HOUSE, CHURCH)
  // Main villa walls & steep mansard slate roof (uP = 0.36..0.64, v = 0.54..0.85, d = 780 m)
  for (let i = 0; i < 3600; i++) {
    const uP = rng.range(0.36, 0.64);
    const roofPeak = uP < 0.43 ? 0.87 - 1.2 * Math.abs(uP - 0.395) : 0.83 - 0.35 * Math.abs(uP - 0.52);
    const v = rng.range(0.54, roofPeak);
    const isRoof = v > 0.71;
    T_DIR.set(isRoof ? 1 : 0, isRoof ? -0.15 : 1, 0).normalize();
    const cA = isRoof
      ? shadeHex(0x34465e, rng.range(0.86, 1.14))
      : shadeHex(mixHex(VILLA_CREAM, 0xe8c4b0, 0.35), rng.range(0.92, 1.08));
    emitSurfaceStroke(
      sink, DAUBIGNY_ASPECT, StrokeClass.HOUSE, uP, v, rng.range(760, 860),
      rng.range(0.014, 0.026), rng.range(0.0045, 0.008), T_DIR, N_FRONT,
      cA, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Villa roof ridge, turret spire, red brick chimneys & green-shuttered windows
  emitPathStrokes(
    sink, DAUBIGNY_ASPECT, StrokeClass.HOUSE,
    [[0.358, 0.71], [0.395, 0.87], [0.43, 0.74], [0.60, 0.74], [0.642, 0.71]],
    745, 160, 0.014, 0.0045, 0x1c2838, 0x34465e, rng, { spread: 0.003 },
  );
  for (const cu of [0.46, 0.57]) {
    emitPathStrokes(
      sink, DAUBIGNY_ASPECT, StrokeClass.HOUSE,
      [[cu, 0.80], [cu, 0.86]],
      748, 45, 0.013, 0.0048, 0xc84c28, P.ochre, rng, { spread: 0.006 },
    );
  }
  for (const wu of [0.395, 0.455, 0.515, 0.575, 0.615]) {
    for (const wv of [0.60, 0.67]) {
      for (let j = 0; j < 28; j++) {
        T_DIR.set(0, 1, 0);
        emitSurfaceStroke(
          sink, DAUBIGNY_ASPECT, StrokeClass.HOUSE, wu + rng.range(-0.009, 0.009), wv + rng.range(-0.018, 0.018), 742,
          0.011, 0.0038, T_DIR, N_FRONT, (j & 1) ? 0x265c3e : 0x243044, VILLA_CREAM, rng, { flags: StrokeFlag.OUTLINE },
        );
      }
    }
  }
  // Distant Romanesque church belfry on the left (uP = 0.16..0.20, v = 0.56..0.78, d = 920 m)
  emitPathStrokes(
    sink, DAUBIGNY_ASPECT, StrokeClass.CHURCH,
    [[0.18, 0.56], [0.18, 0.70], [0.18, 0.79]],
    920, 160, 0.015, 0.0055, 0xc8bca0, 0x48586e, rng, { spread: 0.012 },
  );

  // 4. Billowy Garden Trees & Weeping Willows Framing the Horizon (GROVE [380..860 m])
  const gardenTrees = [
    { u: 0.08, v: 0.62, rx: 0.075, ry: 0.16, d: 480, c: 0x265e38 },
    { u: 0.25, v: 0.60, rx: 0.085, ry: 0.15, d: 560, c: 0x3b7844 },
    { u: 0.70, v: 0.62, rx: 0.080, ry: 0.16, d: 540, c: 0x2e6e3e },
    { u: 0.82, v: 0.64, rx: 0.090, ry: 0.18, d: 460, c: 0x48884e },
    { u: 0.93, v: 0.60, rx: 0.075, ry: 0.16, d: 420, c: 0x265e38 },
  ];
  for (const gt of gardenTrees) {
    // Trunk
    emitPathStrokes(
      sink, DAUBIGNY_ASPECT, StrokeClass.GROVE,
      [[gt.u, gt.v - gt.ry * 0.95], [gt.u, gt.v - gt.ry * 0.2]],
      gt.d + 10, 75, 0.015, 0.005, 0x3b281c, gt.c, rng, { spread: 0.008 },
    );
    // Rounded billowy foliage crown
    for (let j = 0; j < 780; j++) {
      const th = rng.range(0, Math.PI * 2);
      const r = Math.pow(rng.next(), 0.68);
      const uP = gt.u + r * gt.rx * Math.cos(th);
      const v = gt.v + r * gt.ry * Math.sin(th);
      const tang = th + Math.PI * 0.5 + rng.range(-0.2, 0.2);
      T_DIR.set(Math.cos(tang), Math.sin(tang), 0).normalize();
      emitSurfaceStroke(
        sink, DAUBIGNY_ASPECT, StrokeClass.GROVE, uP, v, gt.d + rng.range(-25, 25),
        rng.range(0.015, 0.028), rng.range(0.005, 0.0085), T_DIR, N_FRONT,
        shadeHex(mixHex(gt.c, LAWN_CELADON, rng.range(0.15, 0.65)), rng.range(0.88, 1.12)), P.lemon, rng,
      );
    }
  }
  // Madame Daubigny strolling in dark dress & straw hat on the right path (0.74, 0.36..0.50)
  emitPathStrokes(
    sink, DAUBIGNY_ASPECT, StrokeClass.HOUSE,
    [[0.74, 0.36], [0.74, 0.44], [0.74, 0.485]],
    520, 95, 0.013, 0.0048, P.prussian, P.cobalt, rng, { spread: 0.009 },
  );
  emitPathStrokes(
    sink, DAUBIGNY_ASPECT, StrokeClass.HOUSE,
    [[0.728, 0.495], [0.74, 0.508], [0.752, 0.495]],
    516, 40, 0.012, 0.004, P.chrome, VILLA_CREAM, rng, { spread: 0.003 },
  );

  // 5. Foreground Flowering Rosebushes & Sculpted Black Cat (CYPRESS [155..225 m])
  for (const [bu, bv, brx, bry] of [[0.12, 0.22, 0.065, 0.14], [0.86, 0.24, 0.075, 0.15]]) {
    for (let j = 0; j < 650; j++) {
      const th = rng.range(0, Math.PI * 2);
      const r = Math.pow(rng.next(), 0.7);
      const uP = bu + r * brx * Math.cos(th);
      const v = bv + r * bry * Math.sin(th);
      const isRose = j % 4 === 0;
      emitCanvasStroke(
        sink, DAUBIGNY_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(160, 222),
        rng.range(0.014, 0.026), th + Math.PI * 0.5, rng.range(0.0045, 0.008),
        isRose ? ROSE_BED : 0x265c34, LAWN_CELADON, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }
  // Iconic black cat prowling across the foreground lawn at (0.32, 0.18): arched back, legs, head & raised tail
  emitPathStrokes(
    sink, DAUBIGNY_ASPECT, StrokeClass.CYPRESS,
    [[0.295, 0.18], [0.315, 0.192], [0.335, 0.182]],
    158, 95, 0.013, 0.0048, 0x0c1018, 0x243044, rng, { spread: 0.008 },
  );
  emitPathStrokes(
    sink, DAUBIGNY_ASPECT, StrokeClass.CYPRESS,
    [[0.295, 0.182], [0.282, 0.215], [0.278, 0.242]],
    156, 45, 0.011, 0.0038, 0x0c1018, 0x243044, rng, { spread: 0.003 },
  );
  emitPathStrokes(
    sink, DAUBIGNY_ASPECT, StrokeClass.CYPRESS,
    [[0.302, 0.175], [0.298, 0.145], [0.330, 0.175], [0.336, 0.145]],
    157, 50, 0.011, 0.0038, 0x0c1018, LAWN_CELADON, rng, { spread: 0.003 },
  );

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
