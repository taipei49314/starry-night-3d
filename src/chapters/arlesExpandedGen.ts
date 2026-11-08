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
  buildCanvasQuadMesh, clamp, emitCanvasStroke, emitCustomStar, emitPathStrokes, emitSurfaceStroke,
  mixHex, shadeHex, uFromPaint,
} from './types';

const P = PALETTE;
const N_UP = new Vector3(0, 1, 0.14).normalize();
const N_FRONT = new Vector3(0, 0, 1);
// The Yellow House right wing recedes to the right (d grows with u; world x grows with u, E looks down -z), so its
// face points right-front (+x).
const N_RIGHT = new Vector3(0.74, 0, 0.67).normalize();
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
const ROOF_TERRACOTTA = 0xd85c28;

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

  // 1. Fierce, almost-black cobalt midday sky over Place Lamartine (UNDERPAINT & SKY_BAND)
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

  // 2. Sun-baked Place Lamartine street & gas-pipe trench mounds (GROUND [205..1580 m] & CYPRESS)
  for (let i = 0; i < 19500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.46 * t;
    const d = clamp(208 + 1350 * (t * t), 205, 1580);
    const inTrench = uP > 0.20 && uP < 0.64 && v > 0.08 && v < 0.28;
    const cA = inTrench
      ? shadeHex(mixHex(0xb87832, P.ochre, rng.range(0.2, 0.7)), rng.range(0.82, 1.10))
      : shadeHex(mixHex(HOUSE_CHROME, P.ochre, rng.range(0.25, 0.85)), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, YELLOWHOUSE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.014, 0.028), rng.range(-0.25, 0.25), rng.range(0.0045, 0.0085),
      cA, 0xb87832, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }
  // Foreground curving trench sand mounds & workmen/pedestrian figures (CYPRESS [156..232 m] & GROVE [280..440 m])
  for (let i = 0; i < 2400; i++) {
    const isPedestrian = i >= 1850;
    if (isPedestrian) {
      const pIdx = i % 3;
      const uP = (pIdx === 0 ? 0.34 : pIdx === 1 ? 0.52 : 0.72) + rng.range(-0.015, 0.015);
      const v = rng.range(0.26, 0.38);
      T_DIR.set(0, 1, 0);
      emitSurfaceStroke(
        sink, YELLOWHOUSE_ASPECT, StrokeClass.GROVE, uP, v, 360 + pIdx * 40,
        0.012, 0.004, T_DIR, N_FRONT,
        pIdx === 1 ? P.zincWhite : P.prussian, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
      );
    } else {
      const s = rng.next();
      const uCenter = 0.22 + 0.44 * s;
      const vCenter = 0.14 + 0.08 * Math.sin(s * Math.PI * 1.4);
      const uP = uCenter + rng.range(-0.045, 0.045);
      const v = vCenter + rng.range(-0.04, 0.04);
      emitCanvasStroke(
        sink, YELLOWHOUSE_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(158, 228),
        rng.range(0.016, 0.032), 0.25 * Math.cos(s * Math.PI * 1.4) + rng.range(-0.28, 0.28), rng.range(0.005, 0.009),
        (i & 3) === 0 ? 0xa86424 : P.ochre, HOUSE_CHROME, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  // 3. Multi-plane Architecture: Yellow House Left Wing (470..530 m), Receding Right Wing (500..660 m),
  //    Pink Neighbor Restaurant (540..640 m), Terracotta Roofs, Plane Trees (GROVE), & Railway Bridges (820..1280 m)
  for (let i = 0; i < 9200; i++) {
    const isBridge = i >= 7200;
    const uP = isBridge ? rng.range(0.68, 0.98) : rng.range(0.12, 0.68);
    const roofPeak = uP < 0.32 ? 0.72 : 0.78 - 0.14 * Math.abs(uP - 0.48);
    const v = isBridge ? rng.range(0.36, 0.51) : rng.range(0.36, roofPeak);
    const isPink = !isBridge && uP < 0.32;
    const isRightWing = !isBridge && uP > 0.49;
    const isRoof = !isBridge && v > roofPeak - 0.065;
    const d = isBridge
      ? rng.range(850, 1250)
      : isPink
        ? rng.range(540, 630)
        : isRightWing
          ? 495 + (uP - 0.49) * 820 + rng.range(-8, 8)
          : 472 + Math.abs(uP - 0.44) * 280 + rng.range(-8, 8);
    const cA = isBridge
      ? (v > 0.48 ? 0x2a2e38 : 0x6e6858)
      : isRoof
        ? ROOF_TERRACOTTA
        : isPink
          ? PINK_CAFE
          : HOUSE_CHROME;
    const ang = isRoof ? (uP < 0.48 ? 0.38 : -0.38) : isBridge ? 0 : Math.PI * 0.5;
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    const faceN = isRightWing ? N_RIGHT : N_FRONT;
    emitSurfaceStroke(
      sink, YELLOWHOUSE_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.014, 0.028), rng.range(0.0048, 0.0090), T_DIR, faceN,
      shadeHex(cA, rng.range(0.88, 1.12)), P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Cloisonnist architectural contours of the Yellow House V-corner, roof eaves, café awning & green front door
  emitPathStrokes(sink, YELLOWHOUSE_ASPECT, StrokeClass.HOUSE, [[0.32, 0.36], [0.32, 0.70], [0.48, 0.76], [0.68, 0.70], [0.68, 0.36]], 470, 14, 0.022, 0.006, 0x2c1e12, ROOF_TERRACOTTA, rng);
  emitPathStrokes(sink, YELLOWHOUSE_ASPECT, StrokeClass.HOUSE, [[0.485, 0.36], [0.485, 0.75]], 470, 18, 0.022, 0.006, 0x6e4814, HOUSE_CHROME, rng);
  emitPathStrokes(sink, YELLOWHOUSE_ASPECT, StrokeClass.HOUSE, [[0.14, 0.46], [0.32, 0.46]], 535, 14, 0.022, 0.0065, P.zincWhite, PINK_CAFE, rng);
  // Place Lamartine avenue rounded plane tree crowns & train steam puff over the right railway bridge (GROVE [380..980 m])
  const yhTrees = [
    { u: 0.09, v: 0.48, rx: 0.055, ry: 0.09 },
    { u: 0.71, v: 0.48, rx: 0.055, ry: 0.09 },
    { u: 0.78, v: 0.45, rx: 0.048, ry: 0.075 },
  ];
  for (let i = 0; i < 1600; i++) {
    const isSteam = i >= 1200;
    const tc = yhTrees[i % yhTrees.length];
    const th = rng.range(0, Math.PI * 2);
    const r = Math.pow(rng.next(), 0.65);
    const uP = isSteam ? 0.84 + r * 0.065 * Math.cos(th) : tc.u + r * tc.rx * Math.cos(th);
    const v = isSteam ? 0.54 + r * 0.035 * Math.sin(th) : tc.v + r * tc.ry * Math.sin(th);
    const d = isSteam ? rng.range(860, 980) : rng.range(420, 740);
    const ang = th + Math.PI * 0.5;
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, YELLOWHOUSE_ASPECT, StrokeClass.GROVE, uP, v, d,
      0.015, 0.005, T_DIR, N_FRONT,
      isSteam ? P.zincWhite : mixHex(SHUTTER_GREEN, P.ochre, rng.range(0.15, 0.55)), P.lemon, rng,
    );
  }
  // Emerald-green shutters on Vincent's guest room (0.45, 0.62) & studio windows (WINDOW [465..620 m])
  const winCoords = [[0.38, 0.62, 495], [0.45, 0.62, 475], [0.53, 0.62, 525], [0.60, 0.62, 575], [0.45, 0.45, 475], [0.55, 0.45, 540]];
  for (const [wu, wv, wd] of winCoords) {
    for (let j = 0; j < 260; j++) {
      T_DIR.set(0, 1, 0);
      emitSurfaceStroke(
        sink, YELLOWHOUSE_ASPECT, StrokeClass.WINDOW, wu + rng.range(-0.020, 0.020), wv + rng.range(-0.035, 0.035), wd + rng.range(-6, 6),
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
  underlays.add(buildCanvasQuadMesh(
    YELLOWHOUSE_ASPECT,
    [[0.32, 0.36, 485], [0.66, 0.36, 620], [0.66, 0.74, 620], [0.32, 0.74, 485]],
    mat, 0xc8981e, 'yellowhouse-facade',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(YELLOWHOUSE_ASPECT, 0.48, 0.62, 485),
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

  // 3. Field Boundary Hedges, Farmhouse, Haystacks & Sculpted Blue Cart (HOUSE, GROVE, CYPRESS)
  // Stone walls & hedgerow paths dividing the La Crau plain
  emitPathStrokes(
    sink, HARVEST_ASPECT, StrokeClass.GROVE,
    [[0.02, 0.48], [0.28, 0.50], [0.56, 0.49], [0.96, 0.52]],
    760, 260, 0.015, 0.0055, 0x3b6434, CRAU_GOLD, rng, { spread: 0.008 },
  );
  emitPathStrokes(
    sink, HARVEST_ASPECT, StrokeClass.GROVE,
    [[0.12, 0.32], [0.42, 0.34], [0.74, 0.36], [0.98, 0.33]],
    480, 240, 0.015, 0.0055, 0x487238, P.ochre, rng, { spread: 0.008 },
  );
  // Whitewashed Provençal farmhouse with terracotta roof in midground (0.55..0.64, 0.54..0.65)
  for (let j = 0; j < 780; j++) {
    const uP = rng.range(0.55, 0.64);
    const v = rng.range(0.54, 0.64);
    const isRoof = v > 0.605;
    T_DIR.set(isRoof ? 1 : 0, isRoof ? -0.15 : 1, 0).normalize();
    emitSurfaceStroke(
      sink, HARVEST_ASPECT, StrokeClass.HOUSE, uP, v, rng.range(920, 1040),
      0.015, 0.005, T_DIR, N_FRONT,
      isRoof ? 0xc84c28 : 0xede4c8, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  emitPathStrokes(
    sink, HARVEST_ASPECT, StrokeClass.HOUSE,
    [[0.548, 0.605], [0.595, 0.645], [0.642, 0.605]],
    905, 70, 0.014, 0.0045, 0x241c18, 0xc84c28, rng, { spread: 0.003 },
  );

  // Domed Golden Haystacks with umber shadow bases & Cloisonnist dome outlines
  const stacks = [[0.24, 0.42, 620], [0.32, 0.46, 680], [0.68, 0.52, 860], [0.76, 0.48, 790]];
  for (const [su, sv, sd] of stacks) {
    for (let j = 0; j < 750; j++) {
      const th = rng.range(0, Math.PI * 2);
      const r = Math.pow(rng.next(), 0.68);
      const uP = su + 0.042 * Math.cos(th) * r;
      const v = sv + (Math.sin(th) > 0 ? 0.058 : 0.028) * Math.sin(th) * r;
      T_DIR.set(-Math.sin(th), Math.cos(th), 0).normalize();
      const cA = uP > su + 0.01 ? 0xc87824 : CRAU_GOLD;
      emitSurfaceStroke(
        sink, HARVEST_ASPECT, StrokeClass.HOUSE, uP, v, sd + rng.range(-20, 20),
        0.015, 0.0052, T_DIR, N_FRONT,
        cA, 0x985418, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
    emitPathStrokes(
      sink, HARVEST_ASPECT, StrokeClass.HOUSE,
      [[su - 0.042, sv - 0.015], [su - 0.032, sv + 0.038], [su, sv + 0.058], [su + 0.032, sv + 0.038], [su + 0.042, sv - 0.015]],
      sd - 12, 95, 0.014, 0.0045, 0x5c3414, CRAU_GOLD, rng, { spread: 0.003 },
    );
  }

  // Iconic Blue Hay-Cart at center (0.48, 0.38, d=520 m): body bed, two spoked wheels, and shafts
  for (let j = 0; j < 520; j++) {
    const uP = rng.range(0.44, 0.53);
    const v = rng.range(0.372, 0.412);
    T_DIR.set(1, 0.08, 0).normalize();
    emitSurfaceStroke(
      sink, HARVEST_ASPECT, StrokeClass.HOUSE, uP, v, rng.range(515, 545),
      0.014, 0.0048, T_DIR, N_FRONT,
      CART_BLUE, P.ultramarine, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Cart frame & long wooden shafts jutting left
  emitPathStrokes(
    sink, HARVEST_ASPECT, StrokeClass.HOUSE,
    [[0.44, 0.412], [0.53, 0.416], [0.53, 0.372], [0.44, 0.370], [0.44, 0.412]],
    508, 110, 0.014, 0.0045, 0x14284c, CART_BLUE, rng, { spread: 0.0025 },
  );
  emitPathStrokes(
    sink, HARVEST_ASPECT, StrokeClass.HOUSE,
    [[0.44, 0.382], [0.39, 0.365], [0.355, 0.350]],
    506, 75, 0.014, 0.0042, 0xc86424, P.ochre, rng, { spread: 0.0025 },
  );
  // Two spoked wheels at (0.46, 0.355) and (0.512, 0.358)
  for (const [wu, wv] of [[0.46, 0.355], [0.512, 0.358]]) {
    for (let j = 0; j < 160; j++) {
      const th = rng.range(0, Math.PI * 2);
      const onRim = j < 110;
      const r = onRim ? 0.024 : rng.range(0.004, 0.022);
      const uP = wu + (r / HARVEST_ASPECT) * Math.cos(th);
      const v = wv + r * Math.sin(th);
      const tang = onRim ? th + Math.PI * 0.5 : th;
      T_DIR.set(Math.cos(tang), Math.sin(tang), 0).normalize();
      emitSurfaceStroke(
        sink, HARVEST_ASPECT, StrokeClass.HOUSE, uP, v, 502,
        0.012, 0.0038, T_DIR, N_FRONT,
        onRim ? 0x1c2838 : 0xc86424, CRAU_GOLD, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }
  // Harvester peasant figure beside the haystacks (0.37, 0.39..0.46)
  emitPathStrokes(
    sink, HARVEST_ASPECT, StrokeClass.HOUSE,
    [[0.368, 0.39], [0.37, 0.43], [0.37, 0.455]],
    590, 65, 0.014, 0.005, P.cobalt, P.lemon, rng, { spread: 0.004 },
  );

  // Foreground reed fence & stone wall (CYPRESS [154..232 m])
  for (let i = 0; i < 1800; i++) {
    const uP = rng.range(0.05, 0.95);
    const v = 0.14 + 0.06 * uP + rng.range(-0.025, 0.025);
    emitCanvasStroke(
      sink, HARVEST_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(158, 228),
      0.018, (i & 1) ? 1.52 : 0.08, 0.0045,
      0x8e5824, CRAU_GOLD, rng,
    );
  }
  emitPathStrokes(
    sink, HARVEST_ASPECT, StrokeClass.CYPRESS,
    [[0.05, 0.165], [0.50, 0.195], [0.95, 0.225]],
    155, 160, 0.016, 0.0048, 0x3b2414, 0x8e5824, rng, { spread: 0.003 },
  );

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
      cA, P.chrome, rng, { emissive: r < 0.22 ? 0.16 : 0.05 },
    );
  }
  emitCustomStar(sink, SOWER_ASPECT, 0.58, 0.60, 12200, 0.042, 8, 1.25, rng, P.lemon, P.chrome);

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
  // Crisp horizon line separating the violet field from the chartreuse sun
  emitPathStrokes(
    sink, SOWER_ASPECT, StrokeClass.HOUSE,
    [[-0.02, 0.495], [0.35, 0.50], [0.72, 0.498], [1.02, 0.495]],
    1550, 180, 0.016, 0.005, TRUNK_DARK_BLUE, FURROW_VIOLET, rng, { spread: 0.004 },
  );

  // 3. Bold Japonisme Diagonal Willow Tree (CYPRESS [148..235 m]) with Sprouting Branches & Leaves
  for (let i = 0; i < 4800; i++) {
    const s = rng.next();
    // Trunk slices diagonally from lower-right (0.86, 0.02) across to upper-left (0.18, 0.94)
    const uSpine = 0.86 - 0.68 * s + 0.04 * Math.sin(s * 6.0);
    const vSpine = 0.02 + 0.92 * s;
    const halfW = 0.052 * (1 - 0.52 * s);
    const uP = uSpine + rng.range(-halfW, halfW);
    const v = vSpine + rng.range(-0.028, 0.028);
    const d = clamp(152 + 72 * s + rng.range(-5, 5), 148, 234);
    const isBarkHighlight = uP < uSpine - halfW * 0.35;
    emitCanvasStroke(
      sink, SOWER_ASPECT, StrokeClass.CYPRESS, uP, v, d,
      rng.range(0.022, 0.042), 2.22 + rng.range(-0.15, 0.15), rng.range(0.006, 0.010),
      isBarkHighlight ? 0x385878 : TRUNK_DARK_BLUE, FURROW_VIOLET, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Sprouting diagonal willow branches & autumn blossom/leaf clusters
  const branches: [number, number][][] = [
    [[0.52, 0.48], [0.42, 0.62], [0.30, 0.76]],
    [[0.45, 0.58], [0.56, 0.72], [0.68, 0.86]],
    [[0.34, 0.72], [0.22, 0.84], [0.10, 0.95]],
  ];
  for (const br of branches) {
    emitPathStrokes(
      sink, SOWER_ASPECT, StrokeClass.CYPRESS,
      br, 165, 140, 0.018, 0.0055, TRUNK_DARK_BLUE, 0x385878, rng, { spread: 0.008 },
    );
    const tip = br[br.length - 1];
    for (let j = 0; j < 180; j++) {
      const th = rng.range(0, Math.PI * 2);
      const r = rng.range(0.01, 0.065);
      emitCanvasStroke(
        sink, SOWER_ASPECT, StrokeClass.CYPRESS, tip[0] + r * Math.cos(th), tip[1] + r * Math.sin(th), rng.range(158, 185),
        0.016, th, 0.005, (j & 1) ? 0xd88828 : 0x386e58, P.lemon, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  // 4. Sculpted Striding Sower Silhouette at uP = 0.31: wide straw hat, torso, sowing arm, and striding V-legs
  // Torso & grain apron (0.285..0.34, 0.27..0.45)
  emitPathStrokes(
    sink, SOWER_ASPECT, StrokeClass.HOUSE,
    [[0.315, 0.27], [0.31, 0.36], [0.305, 0.45]],
    485, 360, 0.018, 0.0065, TRUNK_DARK_BLUE, P.cobalt, rng, { spread: 0.022 },
  );
  // Forward left leg striding to (0.23, 0.10) & trailing right leg pushing off from (0.39, 0.11)
  emitPathStrokes(
    sink, SOWER_ASPECT, StrokeClass.HOUSE,
    [[0.30, 0.28], [0.265, 0.19], [0.23, 0.10]],
    482, 260, 0.017, 0.0058, TRUNK_DARK_BLUE, FURROW_VIOLET, rng, { spread: 0.013 },
  );
  emitPathStrokes(
    sink, SOWER_ASPECT, StrokeClass.HOUSE,
    [[0.325, 0.28], [0.36, 0.19], [0.395, 0.11]],
    488, 260, 0.017, 0.0058, TRUNK_DARK_BLUE, P.cobalt, rng, { spread: 0.013 },
  );
  // Outstretched sowing arm flinging seed to the left ((0.31, 0.43) -> (0.18, 0.38))
  emitPathStrokes(
    sink, SOWER_ASPECT, StrokeClass.HOUSE,
    [[0.31, 0.43], [0.24, 0.40], [0.175, 0.38]],
    480, 180, 0.016, 0.0052, TRUNK_DARK_BLUE, P.cobalt, rng, { spread: 0.010 },
  );
  // Head & wide-brimmed yellow straw hat backlit against the sun (0.305, 0.46..0.52)
  emitPathStrokes(
    sink, SOWER_ASPECT, StrokeClass.HOUSE,
    [[0.27, 0.505], [0.305, 0.525], [0.345, 0.500]],
    476, 140, 0.015, 0.005, P.chrome, TRUNK_DARK_BLUE, rng, { spread: 0.008 },
  );
  // Golden seeds arcing from the sower's hand
  for (let i = 0; i < 420; i++) {
    const s = rng.next();
    const uP = 0.17 - 0.09 * s + rng.range(-0.025, 0.025);
    const v = 0.38 - 0.12 * s * s + rng.range(-0.03, 0.03);
    T_DIR.set(-0.75, -0.65, 0).normalize();
    emitSurfaceStroke(
      sink, SOWER_ASPECT, StrokeClass.WINDOW, uP, v, rng.range(465, 505),
      0.011, 0.0038, T_DIR, N_FRONT,
      P.lemon, P.chrome, rng, { emissive: 0.35 },
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
  // 4 blazing gasoliers suspended from the viridian ceiling (with viridian/sulfur halo rings, not Prussian blue)
  emitCustomStar(sink, NIGHTCAFE_ASPECT, 0.28, 0.78, 12400, 0.020, 5, 1.18, rng, P.lemon, CEILING_VIRIDIAN);
  emitCustomStar(sink, NIGHTCAFE_ASPECT, 0.44, 0.76, 13200, 0.016, 4, 1.00, rng, P.chrome, CEILING_VIRIDIAN);
  emitCustomStar(sink, NIGHTCAFE_ASPECT, 0.62, 0.76, 13400, 0.016, 4, 1.00, rng, P.chrome, CEILING_VIRIDIAN);
  emitCustomStar(sink, NIGHTCAFE_ASPECT, 0.76, 0.78, 12600, 0.020, 5, 1.18, rng, P.lemon, CEILING_VIRIDIAN);

  // 2. Steeply Plunging Sulfur-Pine Floorboards radiating from Open Doorway (0.52, 0.48) (GROUND [205..1450 m])
  for (let i = 0; i < 19500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.44 * t;
    const d = clamp(208 + 1200 * (t * t), 205, 1420);
    const perspAng = Math.atan2(0.48 - v, (0.52 - uP) * NIGHTCAFE_ASPECT);
    const inShadow = uP > 0.34 && uP < 0.66 && v > 0.11 && v < 0.25;
    const cA = inShadow
      ? 0x2e381e
      : shadeHex(mixHex(FLOOR_SULFUR, 0xc86428, (i & 3) === 0 ? 0.55 : 0.15), rng.range(0.88, 1.12));
    emitCanvasStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.030), perspAng + rng.range(-0.08, 0.08), rng.range(0.0045, 0.0085),
      cA, WALL_BLOOD_RED, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Blood-Red Upper Walls, Viridian Dado Wainscoting, Clock & Open Curtain Doorway (HOUSE)
  for (let i = 0; i < 8200; i++) {
    const uP = rng.range(-0.02, 1.02);
    const v = rng.range(0.42, 0.76);
    const inDoor = Math.abs(uP - 0.52) < 0.055 && v < 0.66;
    const isDado = !inDoor && v < 0.51;
    const d = inDoor ? rng.range(920, 1250) : rng.range(640, 880);
    T_DIR.set(0, 1, 0);
    const cA = inDoor
      ? P.lemon
      : isDado
        ? shadeHex(0x2e6840, rng.range(0.86, 1.12))
        : shadeHex(WALL_BLOOD_RED, rng.range(0.86, 1.14));
    emitSurfaceStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.016, 0.032), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
      cA, P.ochre, rng,
      { flags: StrokeFlag.OUTLINE, emissive: inDoor ? 0.35 : 0 },
    );
  }
  // Chair-rail moulding & doorway timber frame + wall clock above doorway
  emitPathStrokes(
    sink, NIGHTCAFE_ASPECT, StrokeClass.HOUSE,
    [[-0.02, 0.51], [0.465, 0.51]],
    625, 90, 0.015, 0.0045, 0x5c2414, FLOOR_SULFUR, rng, { spread: 0.0025 },
  );
  emitPathStrokes(
    sink, NIGHTCAFE_ASPECT, StrokeClass.HOUSE,
    [[0.575, 0.51], [1.02, 0.51]],
    625, 90, 0.015, 0.0045, 0x5c2414, FLOOR_SULFUR, rng, { spread: 0.0025 },
  );
  emitPathStrokes(
    sink, NIGHTCAFE_ASPECT, StrokeClass.HOUSE,
    [[0.465, 0.42], [0.465, 0.665], [0.575, 0.665], [0.575, 0.42]],
    620, 140, 0.015, 0.0048, 0x2e1810, FLOOR_SULFUR, rng, { spread: 0.0025 },
  );
  // Wall clock at (0.52, 0.705)
  for (let j = 0; j < 95; j++) {
    const th = rng.range(0, Math.PI * 2);
    const r = rng.range(0, 0.022);
    T_DIR.set(-Math.sin(th), Math.cos(th), 0).normalize();
    emitSurfaceStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.HOUSE, 0.52 + (r / NIGHTCAFE_ASPECT) * Math.cos(th), 0.705 + r * Math.sin(th), 618,
      0.011, 0.0038, T_DIR, N_FRONT, r > 0.016 ? 0x2e1810 : P.zincWhite, P.lemon, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Marble-topped bistrot tables & chairs along the left (0.06..0.24) and right (0.76..0.94) walls
  for (const [tu, tv] of [[0.10, 0.26], [0.18, 0.36], [0.82, 0.36], [0.90, 0.26]]) {
    for (let j = 0; j < 140; j++) {
      const isTop = j < 85;
      const uP = tu + rng.range(-0.042, 0.042);
      const v = isTop ? tv + rng.range(-0.014, 0.014) : tv - rng.range(0.015, 0.065);
      T_DIR.set(isTop ? 1 : 0, isTop ? 0 : 1, 0);
      emitSurfaceStroke(
        sink, NIGHTCAFE_ASPECT, StrokeClass.HOUSE, uP, v, 420 + rng.range(-15, 15),
        0.014, 0.0045, T_DIR, N_FRONT,
        isTop ? 0xe8e4d8 : 0x3b2014, FLOOR_SULFUR, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  // 4. Sculpted 3D Perspective Billiard Table in Center Foreground & White-Coated Landlord (CYPRESS [156..234 m])
  // Trapezoidal green felt surface (wider at front v=0.24, narrower at back v=0.38)
  for (let i = 0; i < 2100; i++) {
    const s = rng.next();
    const v = 0.235 + 0.145 * s;
    const halfW = 0.165 - 0.048 * s;
    const uP = 0.495 + rng.range(-halfW, halfW);
    emitCanvasStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(168, 212),
      rng.range(0.014, 0.026), rng.range(-0.12, 0.12), rng.range(0.0045, 0.008),
      shadeHex(BILLIARD_FELT, rng.range(0.90, 1.12)), P.lemon, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // Mahogany cushion rails framing the trapezoidal billiard table
  emitPathStrokes(
    sink, NIGHTCAFE_ASPECT, StrokeClass.CYPRESS,
    [[0.33, 0.235], [0.66, 0.235], [0.612, 0.38], [0.378, 0.38], [0.33, 0.235]],
    162, 240, 0.016, 0.0052, 0x5c2414, 0x8e4220, rng, { spread: 0.004 },
  );
  // 4 turned mahogany table legs descending from corners to the floor
  for (const [lu, lvTop, lvBot] of [[0.345, 0.235, 0.115], [0.645, 0.235, 0.115], [0.39, 0.36, 0.21], [0.60, 0.36, 0.21]]) {
    emitPathStrokes(
      sink, NIGHTCAFE_ASPECT, StrokeClass.CYPRESS,
      [[lu, lvTop], [lu, lvBot]],
      164, 55, 0.015, 0.0055, 0x3b180e, 0x6e3018, rng, { spread: 0.004 },
    );
  }
  // Billiard balls (red & white) and diagonal cue stick on the green felt
  emitPathStrokes(
    sink, NIGHTCAFE_ASPECT, StrokeClass.CYPRESS,
    [[0.41, 0.27], [0.52, 0.33]],
    158, 45, 0.012, 0.0035, 0xd8b478, P.zincWhite, rng, { spread: 0.0015 },
  );
  for (const [bu, bv, bc] of [[0.46, 0.29, P.zincWhite], [0.485, 0.305, WALL_BLOOD_RED], [0.53, 0.285, P.zincWhite]]) {
    for (let j = 0; j < 24; j++) {
      emitCanvasStroke(
        sink, NIGHTCAFE_ASPECT, StrokeClass.CYPRESS, bu + rng.range(-0.005, 0.005), bv + rng.range(-0.005, 0.005), 157,
        0.010, rng.range(0, Math.PI), 0.0038, bc, P.lemon, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }
  // Landlord in white coat standing beside the billiard table (0.635, 0.25..0.54)
  emitPathStrokes(
    sink, NIGHTCAFE_ASPECT, StrokeClass.CYPRESS,
    [[0.635, 0.25], [0.635, 0.38], [0.635, 0.49]],
    174, 240, 0.016, 0.0055, P.zincWhite, FLOOR_SULFUR, rng, { spread: 0.018 },
  );
  emitPathStrokes(
    sink, NIGHTCAFE_ASPECT, StrokeClass.CYPRESS,
    [[0.618, 0.26], [0.618, 0.48], [0.635, 0.50], [0.652, 0.48], [0.652, 0.26]],
    170, 95, 0.013, 0.004, 0x243048, P.zincWhite, rng, { spread: 0.0025 },
  );
  // Landlord's head & dark hair at (0.635, 0.525)
  for (let j = 0; j < 65; j++) {
    emitCanvasStroke(
      sink, NIGHTCAFE_ASPECT, StrokeClass.CYPRESS, 0.635 + rng.range(-0.014, 0.014), 0.525 + rng.range(-0.02, 0.02), 170,
      0.012, Math.PI * 0.5, 0.0042, j < 45 ? 0xd89e72 : 0x241c18, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
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
