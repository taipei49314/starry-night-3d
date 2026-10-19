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
  buildCanvasQuadMesh, clamp, emitCanvasStroke, emitSurfaceStroke,
  mixHex, shadeHex, smoothstep, uFromPaint,
} from './types';

const P = PALETTE;
const N_UP = new Vector3(0, 1, 0.14).normalize();
const N_FRONT = new Vector3(0, 0, 1);
// Flank normals of a body that recedes toward both sides (world x grows with canvas u, E looks down -z): the left
// flank faces left-front (-x), the right flank right-front (+x).
const N_LEFT = new Vector3(-0.78, 0, 0.62).normalize();
const N_RIGHT = new Vector3(0.78, 0, 0.62).normalize();
const T_DIR = new Vector3(1, 0, 0);

function makeVillage(aspect: number, uP: number, v: number, d: number): VillageInfo {
  return {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(uP, aspect), Math.max(0.05, v - 0.32), d + 10),
    steepleTip: canvasToWorld(uFromPaint(uP, aspect), v, d),
  };
}

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

  // 3. Monumental 3D Oak Handloom Posts (CYPRESS [150..238 m]) & Crossbeams + Contoured Weaver + Woven Cloth (HOUSE & WINDOW)
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
  // Horizontal loom beams, diagonal heddle harness cords & contoured seated weaver in dark indigo smock (HOUSE [460..920 m])
  for (let i = 0; i < 6800; i++) {
    if (i < 3800) {
      // Horizontal oak beams, pulley crossbar & vertical heddle frames
      const isHeddle = i >= 3000;
      const uP = isHeddle ? rng.range(0.28, 0.56) : rng.range(0.10, 0.88);
      const v = isHeddle
        ? rng.range(0.46, 0.78)
        : (i % 3 === 0 ? rng.range(0.42, 0.47) : i % 3 === 1 ? rng.range(0.76, 0.82) : rng.range(0.22, 0.27));
      const d = isHeddle ? rng.range(510, 640) : rng.range(470, 680);
      const ang = isHeddle ? Math.PI * 0.5 + rng.range(-0.08, 0.08) : rng.range(-0.05, 0.05);
      T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
      emitSurfaceStroke(
        sink, WEAVER_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.015, 0.032), rng.range(0.0045, 0.0090), T_DIR, N_FRONT,
        isHeddle ? mixHex(LOOM_WALNUT, LINEN_CREAM, 0.25) : LOOM_WALNUT, LOOM_OAK, rng, { flags: StrokeFlag.OUTLINE },
      );
    } else {
      // Contoured seated weaver behind the loom (head, sloped shoulders, indigo smock torso & outstretched arm throwing shuttle)
      const isArm = i >= 6100;
      let uP: number, v: number, d: number, ang: number, cA: number, cB: number;
      if (isArm) {
        const s = rng.next();
        uP = 0.50 - 0.13 * s + rng.range(-0.012, 0.012);
        v = 0.55 - 0.07 * s + 0.018 * Math.sin(s * Math.PI) + rng.range(-0.010, 0.010);
        d = 735 - 30 * s + rng.range(-6, 6);
        ang = Math.atan2(-0.07, -0.13 * WEAVER_ASPECT) + rng.range(-0.18, 0.18);
        cA = s > 0.74 ? mixHex(LINEN_CREAM, P.ochre, 0.55) : P.prussian;
        cB = LOOM_OAK;
      } else {
        const tH = rng.next(); // 0 = lower torso (0.34), 0.68 = neck, 0.72..1.0 = head & cap (0.73)
        v = 0.34 + 0.39 * tH;
        let halfW: number;
        if (tH > 0.70) {
          const hRel = (tH - 0.85) / 0.15;
          halfW = 0.044 * Math.sqrt(Math.max(0.12, 1 - hRel * hRel));
        } else if (tH > 0.63) {
          halfW = 0.026;
        } else {
          halfW = 0.082 * (0.72 + 0.28 * Math.sin(Math.min(1, tH / 0.58) * Math.PI * 0.5));
        }
        const uRel = rng.range(-1, 1);
        const lean = -0.016 * Math.max(0, tH - 0.45);
        uP = 0.51 + lean + uRel * halfW;
        d = 755 + 35 * (uRel * uRel) + rng.range(-8, 8);
        const isFace = tH > 0.70 && tH < 0.90 && uRel < 0.25;
        cA = isFace
          ? shadeHex(mixHex(LINEN_CREAM, P.ochre, rng.range(0.35, 0.75)), rng.range(0.85, 1.10))
          : shadeHex(mixHex(P.prussian, LOOM_OAK, rng.range(0.20, 0.65)), rng.range(0.86, 1.14));
        cB = isFace ? LOOM_WALNUT : LOOM_OAK;
        ang = Math.PI * 0.5 - 0.32 * uRel + rng.range(-0.18, 0.18);
      }
      T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
      emitSurfaceStroke(
        sink, WEAVER_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.013, 0.026), rng.range(0.0042, 0.0082), T_DIR, N_FRONT,
        cA, cB, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }
  // Luminous woven linen cloth, taut warp threads & wooden shuttle (WINDOW [465..560 m])
  for (let i = 0; i < 2000; i++) {
    const uP = rng.range(0.22, 0.62);
    const v = rng.range(0.45, 0.53);
    const isWarp = (i & 3) === 0;
    const ang = isWarp ? 0.18 * (uP - 0.42) : rng.range(-0.04, 0.04);
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, WEAVER_ASPECT, StrokeClass.WINDOW, uP, v, rng.range(468, 540),
      rng.range(0.013, 0.026), rng.range(0.0038, 0.0075), T_DIR, N_FRONT,
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
    village: makeVillage(WEAVER_ASPECT, 0.76, 0.72, 680),
    timings,
  };
}

// ============================================================================
// 2. TOWER — The Old Church Tower at Nuenen (May 1885), aspect = 1.28
// ============================================================================
export const TOWER_ASPECT = 1.28;
const STONE_UMBER = 0x3b3026;
const STONE_BRICK = 0x5c3c2c;
const STONE_SLATE = 0x48505a;
const TWILIGHT_SILVER = 0xa8a496;
const TWILIGHT_OCHRE = 0x9c8258;
const JACKDAW_BLACK = 0x101116;

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

  // 1. Stormy silver-ochre twilight sky over Brabant (UNDERPAINT & SKY_BAND)
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
    const glow = Math.max(0, 1 - Math.hypot((uP - 0.48) * TOWER_ASPECT, v - 0.68) / 0.52);
    const cA = shadeHex(mixHex(TWILIGHT_SILVER, TWILIGHT_OCHRE, 0.15 + 0.55 * glow), rng.range(0.84, 1.12));
    const cB = mixHex(STONE_SLATE, P.zincWhite, 0.25 + 0.45 * glow);
    emitCanvasStroke(
      sink, TOWER_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.018, 0.036), 0.14 * Math.sin(uP * 6.0 + v * 5.0) + rng.range(-0.18, 0.18), rng.range(0.0055, 0.010),
      cA, cB, rng,
    );
  }

  // 2. Peasant churchyard earth, sunken grave mounds & wind-bent grass (GROUND [205..1580 m])
  for (let i = 0; i < 17500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.36 * t;
    const d = clamp(208 + 1350 * (t * t), 205, 1580);
    const onPath = Math.abs(uP - (0.46 - 0.12 * (1 - t))) < 0.11 * (1 - 0.4 * t);
    const cA = onPath
      ? shadeHex(mixHex(TWILIGHT_OCHRE, STONE_UMBER, rng.range(0.3, 0.7)), rng.range(0.88, 1.12))
      : shadeHex(mixHex(STONE_UMBER, P.cypressGreen, rng.range(0.2, 0.65)), rng.range(0.86, 1.12));
    emitCanvasStroke(
      sink, TOWER_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.014, 0.028), (onPath ? 1.35 : 1.15) + rng.range(-0.28, 0.28), rng.range(0.0045, 0.0085),
      cA, TWILIGHT_OCHRE, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z },
    );
  }

  // 3. Low churchyard brick enclosure wall & wind-tossed churchyard trees (wall 520..590 m, trees 420..780 m)
  for (let i = 0; i < 2400; i++) {
    const isWall = i < 1100;
    if (isWall) {
      const uP = rng.range(0.04, 0.96);
      if (Math.abs(uP - 0.48) < 0.13) continue;
      const v = 0.31 + 0.035 * rng.next();
      const d = rng.range(520, 590);
      T_DIR.set(1, 0, 0);
      emitSurfaceStroke(
        sink, TOWER_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.014, 0.026), rng.range(0.0045, 0.008), T_DIR, N_FRONT,
        STONE_BRICK, STONE_UMBER, rng, { flags: StrokeFlag.OUTLINE },
      );
    } else {
      const side = (i & 1) === 0 ? 0.18 : 0.80;
      const uP = side + rng.range(-0.12, 0.12);
      const v = rng.range(0.32, 0.56);
      const d = rng.range(420, 780);
      const ang = 1.25 + rng.range(-0.35, 0.35);
      T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
      emitSurfaceStroke(
        sink, TOWER_ASPECT, StrokeClass.GROVE, uP, v, d,
        rng.range(0.014, 0.028), rng.range(0.0045, 0.0085), T_DIR, N_FRONT,
        mixHex(STONE_UMBER, P.cypressGreen, rng.range(0.25, 0.65)), TWILIGHT_OCHRE, rng,
      );
    }
  }

  // 4. Multi-depth Nuenen Romanesque Church Tower: stepped buttresses (585..635 m), brick tiers & belfry louvers (605..740 m), and slate spire
  for (let i = 0; i < 8200; i++) {
    const v = rng.range(0.31, 0.89);
    const inSpire = v > 0.73;
    const tierStep = v < 0.48 ? 1.0 : v < 0.62 ? 0.88 : 0.78;
    const topTap = inSpire ? Math.max(0.06, (0.89 - v) / 0.16) * 0.72 : tierStep;
    const halfW = 0.125 * topTap;
    const uRel = rng.range(-1, 1);
    const uP = 0.48 + uRel * halfW;
    const isButtress = !inSpire && Math.abs(uRel) > 0.72;
    const d = isButtress
      ? clamp(602 + 22 * Math.abs(uRel) + rng.range(-5, 5), 601, 640)
      : clamp(618 + 95 * (uRel * uRel) + rng.range(-6, 6), 608, 745);
    // Twin arched belfry sound-louvers at v in [0.58, 0.70]
    const isLouver = !inSpire && v > 0.58 && v < 0.70 && (Math.abs(uP - 0.455) < 0.016 || Math.abs(uP - 0.505) < 0.016);
    const isStringCourse = Math.abs(v - 0.48) < 0.010 || Math.abs(v - 0.62) < 0.010 || Math.abs(v - 0.73) < 0.012;
    let cA: number;
    if (isLouver) {
      cA = 0x161210;
    } else if (inSpire) {
      cA = shadeHex(mixHex(STONE_SLATE, STONE_UMBER, rng.range(0.2, 0.6)), rng.range(0.82, 1.10));
    } else if (isStringCourse) {
      cA = TWILIGHT_OCHRE;
    } else {
      cA = shadeHex(mixHex(STONE_UMBER, STONE_BRICK, rng.range(0.25, 0.75)), rng.range(0.84, 1.14));
    }
    const ang = inSpire
      ? (uRel < 0 ? 1.05 : -1.05) + rng.range(-0.08, 0.08)
      : isStringCourse
        ? rng.range(-0.06, 0.06)
        : Math.PI * 0.5 + rng.range(-0.12, 0.12);
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    const faceN = uRel < -0.35 ? N_LEFT : uRel > 0.35 ? N_RIGHT : N_FRONT;
    emitSurfaceStroke(
      sink, TOWER_ASPECT, StrokeClass.CHURCH, uP, v, d,
      rng.range(0.014, 0.028), rng.range(0.0048, 0.0092), T_DIR, faceN,
      cA, TWILIGHT_OCHRE, rng, { flags: StrokeFlag.OUTLINE },
    );
  }

  // 5. Flock of 34 Circling Black Jackdaws (寒鴉) wheeling around the belfry and twilight sky (d = 460..760 m)
  for (let b = 0; b < 34; b++) {
    const orbitAng = (b / 34) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const rx = rng.range(0.09, 0.34);
    const ry = rng.range(0.05, 0.16);
    const uBird = 0.48 + rx * Math.cos(orbitAng);
    const vBird = 0.73 + ry * Math.sin(orbitAng);
    const dBird = clamp(610 + 130 * Math.sin(orbitAng) + rng.range(-18, 18), 465, 760);
    const wingSpan = rng.range(0.011, 0.020);
    const bank = rng.range(-0.28, 0.28);
    for (let w = 0; w < 14; w++) {
      const side = w < 7 ? -1 : 1;
      const s = ((w % 7) + 0.5) / 7;
      const uW = uBird + side * s * wingSpan;
      const vW = vBird + Math.sin(s * Math.PI) * 0.0065 + side * bank * s * 0.008;
      const flapAng = side * (0.42 - 0.65 * s) + bank;
      T_DIR.set(Math.cos(flapAng), Math.sin(flapAng), 0).normalize();
      emitSurfaceStroke(
        sink, TOWER_ASPECT, StrokeClass.HOUSE, uW, vW, dBird,
        0.009, 0.0032, T_DIR, N_FRONT,
        JACKDAW_BLACK, STONE_SLATE, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  // 6. Tilted wooden churchyard grave crosses across foreground & midground (158..380 m)
  const crosses = [
    { u: 0.18, v0: 0.06, v1: 0.25, d: 168, tilt: 0.09 },
    { u: 0.31, v0: 0.09, v1: 0.27, d: 196, tilt: -0.07 },
    { u: 0.63, v0: 0.08, v1: 0.26, d: 182, tilt: 0.06 },
    { u: 0.77, v0: 0.07, v1: 0.24, d: 214, tilt: -0.10 },
    { u: 0.26, v0: 0.18, v1: 0.31, d: 310, tilt: 0.05 },
    { u: 0.70, v0: 0.19, v1: 0.32, d: 345, tilt: -0.06 },
  ];
  for (const cr of crosses) {
    const vCrossbar = cr.v0 + 0.68 * (cr.v1 - cr.v0);
    for (let i = 0; i < 360; i++) {
      const horiz = i < 120;
      const uP = cr.u + (horiz ? rng.range(-0.026, 0.026) : rng.range(-0.0055, 0.0055));
      const v = horiz ? vCrossbar + rng.range(-0.007, 0.007) : rng.range(cr.v0, cr.v1);
      const ang = horiz ? cr.tilt : Math.PI * 0.5 + cr.tilt;
      if (cr.d < 235) {
        emitCanvasStroke(
          sink, TOWER_ASPECT, StrokeClass.CYPRESS, uP, v, cr.d + rng.range(-5, 5),
          rng.range(0.013, 0.024), ang, rng.range(0.0038, 0.0070),
          STONE_UMBER, TWILIGHT_OCHRE, rng, { flags: StrokeFlag.OUTLINE },
        );
      } else {
        T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
        emitSurfaceStroke(
          sink, TOWER_ASPECT, StrokeClass.HOUSE, uP, v, cr.d + rng.range(-6, 6),
          0.015, 0.0045, T_DIR, N_FRONT,
          STONE_UMBER, TWILIGHT_OCHRE, rng, { flags: StrokeFlag.OUTLINE },
        );
      }
    }
  }

  const underlays = new Group();
  underlays.name = 'underlays:tower';
  underlays.add(buildCanvasQuadMesh(
    TOWER_ASPECT,
    [[-0.04, 0.0, 210], [1.04, 0.0, 210], [1.04, 0.36, 1520], [-0.04, 0.36, 1520]],
    mat, STONE_UMBER, 'tower-churchyard',
  ));
  underlays.add(buildCanvasQuadMesh(
    TOWER_ASPECT,
    [[0.37, 0.31, 635], [0.59, 0.31, 635], [0.55, 0.74, 650], [0.41, 0.74, 650]],
    mat, 0x2c221a, 'tower-shaft',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(TOWER_ASPECT, 0.48, 0.88, 650),
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
  _mat: UnderlayMaterialFactory,
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
  // Hollow eye sockets & nasal cavity (CYPRESS [155..225 m]) + White cigarette stick & glowing ember tip (WINDOW [462..510 m])
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
  for (let i = 0; i < 1200; i++) {
    const s = rng.next();
    const uP = 0.52 + 0.16 * s + (s > 0.85 ? rng.range(-0.014, 0.014) : 0);
    const v = 0.44 - 0.02 * s + rng.range(-0.008, 0.008) + (s > 0.85 ? rng.range(-0.012, 0.012) : 0);
    T_DIR.set(0.99, -0.12, 0).normalize();
    emitSurfaceStroke(
      sink, SKULL_ASPECT, StrokeClass.WINDOW, uP, v, rng.range(462, 505),
      0.018, 0.0055, T_DIR, N_FRONT,
      s > 0.80 ? EMBER_RED : P.zincWhite, s > 0.80 ? P.lemon : BONE_IVORY, rng, { emissive: s > 0.80 ? 2.4 : 0.65 },
    );
  }

  const underlays = new Group();
  underlays.name = 'underlays:skull';
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(SKULL_ASPECT, 0.68, 0.42, 480),
    timings,
  };
}

// ============================================================================
// 4. GALETTE — Le Moulin de la Galette (Montmartre, Autumn 1886), aspect = 1.18
// ============================================================================
export const GALETTE_ASPECT = 1.18;
const MILL_TIMBER = 0x5c3e26;
const FENCE_OCHRE = 0xb88446;
const TRICOLOR_BLUE = 0x1e3f88;
const TRICOLOR_RED = 0xd83c28;
const RADET_PLASTER = 0xdfd0b4;

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

  // 2. Sloping Montmartre hillside earth & sandy path (GROUND [205..1540 m])
  for (let i = 0; i < 16500; i++) {
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

  // 3. Diagonal Montmartre Wooden Palisade Fence (山坡木欄杆, d = 175..460 m) + Strolling Couple & Lantern
  const nSlats = 36;
  for (let sIdx = 0; sIdx < nSlats; sIdx++) {
    const s = sIdx / (nSlats - 1); // 0 = foreground right (uP=0.94, d=180m), 1 = midground left (uP=0.08, d=455m)
    const uSlat = 0.94 - 0.86 * s;
    const vBot = 0.06 + 0.28 * s;
    const vTop = vBot + 0.16 * (1 - 0.32 * s);
    const dSlat = 180 + 275 * s;
    for (let j = 0; j < 75; j++) {
      const v = rng.range(vBot, vTop);
      const uP = uSlat + rng.range(-0.0055, 0.0055);
      const cA = shadeHex(mixHex(FENCE_OCHRE, MILL_TIMBER, rng.range(0.2, 0.75)), rng.range(0.86, 1.14));
      if (dSlat < 235) {
        emitCanvasStroke(
          sink, GALETTE_ASPECT, StrokeClass.CYPRESS, uP, v, dSlat + rng.range(-4, 4),
          0.015, Math.PI * 0.5 + rng.range(-0.04, 0.04), 0.0042,
          cA, MILL_TIMBER, rng, { flags: StrokeFlag.OUTLINE },
        );
      } else {
        T_DIR.set(0, 1, 0);
        emitSurfaceStroke(
          sink, GALETTE_ASPECT, StrokeClass.HOUSE, uP, v, dSlat + rng.range(-5, 5),
          0.015, 0.0042, T_DIR, N_FRONT,
          cA, MILL_TIMBER, rng, { flags: StrokeFlag.OUTLINE },
        );
      }
    }
  }
  // Twin horizontal fence rails binding the palisade slats
  for (let i = 0; i < 1100; i++) {
    const s = rng.next();
    const uP = 0.94 - 0.86 * s;
    const vRail = (0.09 + 0.28 * s) + ((i & 1) ? 0.09 * (1 - 0.3 * s) : 0.02);
    const dRail = 180 + 275 * s;
    T_DIR.set(-0.95, 0.31, 0).normalize();
    emitSurfaceStroke(
      sink, GALETTE_ASPECT, StrokeClass.HOUSE, uP, vRail + rng.range(-0.005, 0.005), Math.max(210, dRail),
      0.018, 0.0045, T_DIR, N_FRONT,
      MILL_TIMBER, FENCE_OCHRE, rng, { flags: StrokeFlag.OUTLINE },
    );
  }

  // 4. Autumn Montmartre Trees (GROVE [320..680 m]), Radet Mill House & Viewing Terrace (HOUSE [510..660 m])
  for (let i = 0; i < 3600; i++) {
    const isTree = i < 1800;
    if (isTree) {
      const uP = (i < 900 ? rng.range(0.06, 0.34) : rng.range(0.56, 0.92));
      const v = rng.range(0.32, 0.58);
      const d = rng.range(340, 620);
      const ang = rng.range(0, Math.PI * 2);
      T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
      emitSurfaceStroke(
        sink, GALETTE_ASPECT, StrokeClass.GROVE, uP, v, d,
        rng.range(0.014, 0.026), rng.range(0.0045, 0.0082), T_DIR, N_FRONT,
        mixHex(0x6e8c48, P.ochre, rng.range(0.2, 0.75)), MILL_TIMBER, rng,
      );
    } else {
      // Adjoining Radet building & wooden viewing deck on the left of the windmill (uP = 0.16..0.38)
      const uP = rng.range(0.16, 0.38);
      const v = rng.range(0.38, 0.66);
      const d = rng.range(520, 650);
      const isRoof = v > 0.58;
      T_DIR.set(isRoof ? 1 : 0, isRoof ? 0 : 1, 0);
      emitSurfaceStroke(
        sink, GALETTE_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.014, 0.026), rng.range(0.0045, 0.0082), T_DIR, N_FRONT,
        isRoof ? TRICOLOR_RED : RADET_PLASTER, MILL_TIMBER, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  // 5. French Tricolor Flag (巴黎紅白藍三色旗) fluttering on its mast at (uP = 0.29..0.36, v = 0.66..0.80, d = 545..575 m)
  for (let i = 0; i < 950; i++) {
    const isMast = i < 200;
    if (isMast) {
      T_DIR.set(0, 1, 0);
      emitSurfaceStroke(
        sink, GALETTE_ASPECT, StrokeClass.HOUSE, 0.36 + rng.range(-0.003, 0.003), rng.range(0.60, 0.82), 555,
        0.014, 0.0038, T_DIR, N_FRONT, MILL_TIMBER, P.ochre, rng, { flags: StrokeFlag.OUTLINE },
      );
    } else {
      const sU = rng.next(); // 0 = blue (near mast at 0.36), 0.5 = white, 1 = red (fluttering left to 0.29)
      const uP = 0.36 - 0.07 * sU;
      const wave = 0.008 * Math.sin(sU * 6.0);
      const v = rng.range(0.71, 0.79) + wave;
      const bandColor = sU < 0.33 ? TRICOLOR_BLUE : sU < 0.66 ? P.zincWhite : TRICOLOR_RED;
      T_DIR.set(1, 0.18 * Math.cos(sU * 6.0), 0).normalize();
      // A daylight flag is cloth, not a lamp: a static solid (HOUSE) in its own colours, no emissive flicker.
      emitSurfaceStroke(
        sink, GALETTE_ASPECT, StrokeClass.HOUSE, uP, v, rng.range(548, 568),
        0.012, 0.0042, T_DIR, N_FRONT,
        bandColor, bandColor, rng,
      );
    }
  }

  // 6. Blute-Fin Timber Windmill Body & Trestle Base (CHURCH [615..745 m]) + 4 Lattice Windmill Sails (CYPRESS [155..238 m])
  for (let i = 0; i < 5800; i++) {
    const v = rng.range(0.40, 0.79);
    const halfW = v < 0.52 ? 0.12 : 0.095;
    const uP = 0.46 + rng.range(-halfW, halfW);
    const isTrestle = v < 0.52;
    const ang = isTrestle ? ((i & 1) ? 1.15 : -1.15) : Math.PI * 0.5;
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, GALETTE_ASPECT, StrokeClass.CHURCH, uP, v, rng.range(620, 740),
      rng.range(0.015, 0.028), rng.range(0.005, 0.009), T_DIR, N_FRONT,
      shadeHex(MILL_TIMBER, rng.range(0.85, 1.15)), P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }
  // 4 great wooden lattice sails radiating from hub (0.46, 0.76)
  for (let arm = 0; arm < 4; arm++) {
    const baseAng = 0.68 + arm * (Math.PI * 0.5);
    for (let i = 0; i < 1050; i++) {
      const r = rng.range(0.02, 0.25);
      const isSpine = i < 320;
      const lat = isSpine ? rng.range(-0.004, 0.004) : rng.range(-0.024, 0.024);
      const uP = 0.46 + (r * Math.cos(baseAng) - lat * Math.sin(baseAng)) / GALETTE_ASPECT;
      const v = 0.76 + r * Math.sin(baseAng) + lat * Math.cos(baseAng);
      emitCanvasStroke(
        sink, GALETTE_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(162, 232),
        rng.range(0.015, 0.030), baseAng + (isSpine ? 0 : Math.PI * 0.5), rng.range(0.0036, 0.0068),
        MILL_TIMBER, FENCE_OCHRE, rng, { flags: StrokeFlag.OUTLINE },
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
  underlays.add(buildCanvasQuadMesh(
    GALETTE_ASPECT,
    [[0.37, 0.42, 650], [0.55, 0.42, 650], [0.53, 0.78, 660], [0.39, 0.78, 660]],
    mat, 0x3e2818, 'galette-mill-core',
  ));
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(GALETTE_ASPECT, 0.46, 0.76, 640),
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
const LOCO_IRON = 0x1c222a;
const STEAM_WHITE = 0xf2f5f7;

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

  // 1. Radiant summer sky over Asnières (UNDERPAINT & SKY_BAND)
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

  // 2. Shimmering broken-stroke Seine river reflections & stone embankment on left (GROUND [205..1640 m])
  for (let i = 0; i < 20000; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.48 * t;
    const d = clamp(208 + 1400 * (t * t), 205, 1640);
    const onLeftBank = uP < 0.30 - 0.14 * t;
    const isRefl = !onLeftBank && (Math.abs(uP - 0.36) < 0.075 || Math.abs(uP - 0.68) < 0.075);
    const cA = onLeftBank
      ? shadeHex(mixHex(PIER_CREAM, P.ochre, rng.range(0.25, 0.7)), rng.range(0.90, 1.12))
      : isRefl
        ? mixHex(PIER_CREAM, IRON_CRIMSON, (i & 3) === 0 ? 0.65 : 0.15)
        : (i & 1) === 0 ? SEINE_AQUA : mixHex(P.cerulean, P.zincWhite, rng.range(0.25, 0.7));
    emitCanvasStroke(
      sink, SEINE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.014, 0.028), onLeftBank ? 0.48 + rng.range(-0.15, 0.15) : rng.range(-0.08, 0.08), rng.range(0.004, 0.0075),
      cA, P.zincWhite, rng, { q1: N_UP.x, q2: N_UP.y, q3: N_UP.z, emissive: 0.18 },
    );
  }

  // 3. Foreground Crimson-Iron Railway Bridge, Stone Masonry Piers, & Second Background Bridge (HOUSE [480..1220 m])
  for (let i = 0; i < 7200; i++) {
    const isPier = i < 2600;
    const isBackBridge = i >= 5800;
    const uP = isPier
      ? ((i & 1) === 0 ? 0.36 : 0.68) + rng.range(-0.044, 0.044)
      : isBackBridge
        ? rng.range(0.36, 0.68)
        : rng.range(-0.02, 1.02);
    const v = isPier
      ? rng.range(0.36, 0.59)
      : isBackBridge
        ? rng.range(0.46, 0.51)
        : rng.range(0.51, 0.58);
    const d = isPier
      ? rng.range(510, 760)
      : isBackBridge
        ? rng.range(960, 1220)
        : rng.range(560, 880);
    const ang = isPier ? Math.PI * 0.5 : 0;
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, SEINE_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.014, 0.028), rng.range(0.0045, 0.0085), T_DIR, N_FRONT,
      isPier ? PIER_CREAM : isBackBridge ? mixHex(PIER_CREAM, SEINE_AQUA, 0.35) : IRON_CRIMSON,
      P.ochre, rng, { flags: StrokeFlag.OUTLINE },
    );
  }

  // 4. Steam Locomotive & Carriages on the Railway Bridge (uP = 0.44..0.66, v = 0.57..0.64, d = 575..660 m)
  //    + Volumetric White Steam Plume rising into the summer sky (uP = 0.48..0.64, v = 0.62..0.82, d = 560..920 m)
  for (let i = 0; i < 1800; i++) {
    const isStack = i < 260;
    const isHeadlight = i >= 260 && i < 420;
    const uP = isStack
      ? 0.51 + rng.range(-0.012, 0.012)
      : isHeadlight
        ? 0.49 + rng.range(-0.010, 0.010)
        : rng.range(0.45, 0.66);
    const v = isStack
      ? rng.range(0.61, 0.66)
      : isHeadlight
        ? rng.range(0.58, 0.61)
        : rng.range(0.57, 0.62);
    const d = rng.range(575, 650);
    T_DIR.set(isStack ? 0 : 1, isStack ? 1 : 0, 0);
    if (isHeadlight) {
      emitSurfaceStroke(
        sink, SEINE_ASPECT, StrokeClass.WINDOW, uP, v, d,
        0.012, 0.0045, T_DIR, N_FRONT,
        P.lemon, IRON_CRIMSON, rng, { emissive: 1.5 },
      );
    } else {
      emitSurfaceStroke(
        sink, SEINE_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.012, 0.024), rng.range(0.0045, 0.0080), T_DIR, N_FRONT,
        LOCO_IRON, IRON_CRIMSON, rng, { flags: StrokeFlag.OUTLINE },
      );
    }
  }
  // Billowing white-and-pearl locomotive steam cloud (GROVE [560..920 m])
  for (let i = 0; i < 2400; i++) {
    const s = Math.pow(rng.next(), 0.85); // 0 = smokestack (0.51, 0.64), 1 = high drifting puff (0.61, 0.80)
    const th = rng.range(0, Math.PI * 2);
    const rad = (0.018 + 0.055 * s) * Math.sqrt(rng.next());
    const uP = 0.51 + 0.09 * s + rad * Math.cos(th);
    const v = 0.64 + 0.15 * s + rad * Math.sin(th) * 0.78;
    const d = 580 + 320 * s + rng.range(-20, 20);
    T_DIR.set(-Math.sin(th), Math.cos(th), 0).normalize();
    const cA = shadeHex(mixHex(STEAM_WHITE, P.lemon, rng.range(0.05, 0.25)), rng.range(0.95, 1.08));
    const cB = mixHex(SEINE_AQUA, STEAM_WHITE, 0.65);
    emitSurfaceStroke(
      sink, SEINE_ASPECT, StrokeClass.GROVE, uP, v, d,
      rng.range(0.014, 0.028), rng.range(0.005, 0.0095), T_DIR, N_FRONT,
      cA, cB, rng, { emissive: 0.35 },
    );
  }

  // 5. Woman in white-pink dress with glowing red parasol on left embankment (CYPRESS [160..215 m]) + Moored Rowboat (GROVE [245..320 m])
  for (let i = 0; i < 1200; i++) {
    const uP = 0.22 + rng.range(-0.025, 0.025);
    const v = rng.range(0.24, 0.42);
    emitCanvasStroke(
      sink, SEINE_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(160, 215),
      rng.range(0.012, 0.022), v > 0.36 ? rng.range(-0.4, 0.4) : Math.PI * 0.5, rng.range(0.004, 0.0075),
      v > 0.36 ? IRON_CRIMSON : PIER_CREAM, P.zincWhite, rng,
    );
  }
  for (let i = 0; i < 850; i++) {
    const uP = 0.78 + rng.range(-0.065, 0.065);
    const v = 0.16 + rng.range(-0.022, 0.022);
    T_DIR.set(0.96, 0.22, 0).normalize();
    emitSurfaceStroke(
      sink, SEINE_ASPECT, StrokeClass.GROVE, uP, v, rng.range(245, 320),
      0.016, 0.005, T_DIR, N_FRONT,
      0x5c3e26, IRON_CRIMSON, rng, { flags: StrokeFlag.OUTLINE },
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
    village: makeVillage(SEINE_ASPECT, 0.54, 0.64, 620),
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
  _mat: UnderlayMaterialFactory,
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
    village: makeVillage(PLUM_ASPECT, 0.48, 0.56, 560),
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
  _mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const t0 = performance.now();
  const rng = forkRng(seed, 'tanguy:all');

  // 1. Vibrant Wall of 6 Japanese Ukiyo-e Prints behind Père Tanguy (UNDERPAINT & SKY_BAND)
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
    // Woodblock print border frames at uP ≈ 0.32, 0.68 and v ≈ 0.54
    const onPrintBorder = Math.abs(uP - 0.32) < 0.012 || Math.abs(uP - 0.68) < 0.012 || Math.abs(v - 0.54) < 0.012;
    // Mount Fuji snow-cone in the upper-center Ukiyo-e print above Tanguy's hat (uP in 0.38..0.62, v in 0.80..0.94)
    const inFuji = v > 0.80 && v < 0.94 && Math.abs(uP - 0.50) < (0.95 - v) * 0.85;
    const cA = onPrintBorder
      ? 0x3a281c
      : inFuji
        ? P.zincWhite
        : shadeHex(palette[colIdx % palette.length], rng.range(0.86, 1.14));
    const ang = onPrintBorder
      ? (Math.abs(v - 0.54) < 0.012 ? 0 : Math.PI * 0.5)
      : inFuji
        ? (uP < 0.50 ? 0.65 : -0.65)
        : rng.range(-0.4, 0.4);
    emitCanvasStroke(
      sink, TANGUY_ASPECT, StrokeClass.SKY_BAND, uP, v, rng.range(98000, 168000),
      rng.range(0.014, 0.028), ang, rng.range(0.005, 0.0095),
      cA, onPrintBorder ? P.ochre : P.zincWhite, rng,
    );
  }

  // 2. Sculptural Seated Figure of Père Tanguy: Contoured Straw Hat, Bearded Oval Face & Sloped Cobalt Coat (HOUSE & WINDOW)
  for (let i = 0; i < 19200; i++) {
    const vBase = rng.range(0.02, 0.82);
    const uRel = rng.range(-1, 1);
    let halfW: number;
    let v = vBase;
    let cA: number;
    let cB: number;
    let ang: number;

    if (vBase > 0.67) {
      // Upturned yellow straw hat brim (0.67..0.73) & pinched crown (0.73..0.82)
      const hT = (vBase - 0.67) / 0.15;
      const isBrim = hT < 0.42;
      halfW = isBrim
        ? 0.215 * Math.sqrt(Math.max(0.18, 1 - Math.pow((hT - 0.20) / 0.28, 2)))
        : 0.135 * (1 - 0.32 * Math.pow((hT - 0.42) / 0.58, 1.4));
      v = vBase + (isBrim ? 0.024 * (uRel * uRel) : -0.008 * (uRel * uRel));
      const isBand = hT >= 0.36 && hT <= 0.48;
      cA = isBand ? P.prussian : shadeHex(mixHex(HAT_STRAW, P.lemon, rng.range(0.20, 0.65)), rng.range(0.88, 1.14));
      cB = isBand ? 0xa82820 : P.ochre;
      ang = isBrim ? 0.24 * uRel + rng.range(-0.14, 0.14) : rng.range(-0.22, 0.22);
    } else if (vBase > 0.46) {
      // Contoured oval face (0.46..0.67) with warm cheek planes, nose bridge & grey-white beard
      const fT = (vBase - 0.46) / 0.21; // 0 = beard tip, 0.5 = cheeks/nose, 1 = forehead under brim
      const oval = Math.sqrt(Math.max(0.15, 1 - Math.pow(fT * 2 - 1, 2)));
      halfW = 0.128 * (0.68 + 0.32 * oval);
      const isBeardOrMoustache = fT < 0.38 || (fT < 0.58 && Math.abs(uRel) > 0.56) || (fT > 0.36 && fT < 0.48 && Math.abs(uRel) < 0.45);
      const isNoseBridge = fT >= 0.45 && fT <= 0.76 && Math.abs(uRel) < 0.16;
      if (isBeardOrMoustache) {
        cA = shadeHex(mixHex(0xd8d2c4, 0x8e7e6c, rng.range(0.2, 0.8)), rng.range(0.88, 1.12));
        cB = P.cerulean;
        ang = Math.PI * 0.5 + 0.38 * uRel + rng.range(-0.16, 0.16);
      } else if (isNoseBridge) {
        cA = mixHex(0xeac09a, P.lemon, 0.35);
        cB = 0xdca478;
        ang = Math.PI * 0.5 + rng.range(-0.08, 0.08);
      } else {
        cA = shadeHex(mixHex(0xdca478, SAKURA_PINK, rng.range(0.15, 0.45)), rng.range(0.88, 1.12));
        cB = 0x8e7258;
        ang = Math.PI * 0.5 + 0.45 * uRel + rng.range(-0.18, 0.18);
      }
    } else {
      // Sloped rounded cobalt-blue coat shoulders & double-breasted lapels (0.02..0.46)
      const cT = (vBase - 0.02) / 0.44; // 0 = bottom hem/arms, 1 = neck/collar
      const shoulderCurve = Math.sin(Math.min(1, (1 - cT) * 1.35) * Math.PI * 0.5);
      halfW = 0.13 + 0.22 * shoulderCurve;
      const isCrimsonLapel = cT > 0.32 && Math.abs(Math.abs(uRel) - (0.34 - 0.20 * cT)) < 0.055;
      const isSleeveFold = Math.abs(uRel) > 0.62 && cT < 0.55;
      cA = isCrimsonLapel
        ? 0xa82820
        : shadeHex(mixHex(COAT_COBALT, isSleeveFold ? P.prussian : P.ultramarine, rng.range(0.2, 0.75)), rng.range(0.86, 1.14));
      cB = isCrimsonLapel ? P.ochre : P.cerulean;
      ang = Math.PI * 0.5 + (uRel * 0.65) + rng.range(-0.15, 0.15);
    }

    const uP = 0.50 + uRel * halfW;
    const d = clamp(475 + 165 * Math.abs(uP - 0.50) + rng.range(-6, 6), 468, 720);
    T_DIR.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, TANGUY_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.013, 0.026), rng.range(0.0044, 0.0088), T_DIR, N_FRONT,
      cA, cB, rng, { flags: Math.abs(uRel) > 0.82 ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
    );
  }

  // Père Tanguy's kind eyes & double-breasted coat buttons (WINDOW [458..466 m])
  const tanguyAccents = [
    { u0: 0.46, v0: 0.59, r: 0.016, eye: true },
    { u0: 0.54, v0: 0.59, r: 0.016, eye: true },
    { u0: 0.44, v0: 0.36, r: 0.013, eye: false },
    { u0: 0.56, v0: 0.36, r: 0.013, eye: false },
    { u0: 0.44, v0: 0.27, r: 0.013, eye: false },
    { u0: 0.56, v0: 0.27, r: 0.013, eye: false },
  ];
  for (const ac of tanguyAccents) {
    for (let i = 0; i < 160; i++) {
      const th = rng.range(0, Math.PI * 2);
      const rad = rng.range(0.002, ac.r);
      const uP = ac.u0 + Math.cos(th) * rad;
      const v = ac.v0 + Math.sin(th) * rad * 0.72;
      T_DIR.set(1, 0, 0);
      emitSurfaceStroke(
        sink, TANGUY_ASPECT, StrokeClass.WINDOW, uP, v, 460 + rng.range(0, 5),
        0.008, 0.0032, T_DIR, N_FRONT,
        ac.eye ? (rad < 0.005 ? P.zincWhite : P.prussian) : 0x2a1812,
        ac.eye ? P.cerulean : P.ochre, rng,
        { emissive: ac.eye && rad < 0.005 ? 2.2 : 0.85 },
      );
    }
  }

  // Interlocked clasped hands & cobalt sleeve cuffs in foreground (CYPRESS [156..222 m])
  for (let i = 0; i < 2800; i++) {
    const isCuff = i < 700;
    if (isCuff) {
      const side = (i & 1) ? 1 : -1;
      const uP = 0.50 + side * rng.range(0.085, 0.145);
      const v = 0.14 + rng.range(-0.045, 0.045);
      emitCanvasStroke(
        sink, TANGUY_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(185, 220),
        rng.range(0.015, 0.028), Math.PI * 0.5 + side * 0.35, rng.range(0.005, 0.009),
        COAT_COBALT, P.prussian, rng, { flags: StrokeFlag.OUTLINE },
      );
    } else {
      // Articulated interlocked fingers across 4 horizontal finger bands
      const fingerIdx = i & 3;
      const s = rng.range(-1, 1);
      const uP = 0.50 + s * 0.088;
      const v = 0.115 + fingerIdx * 0.022 + 0.012 * Math.cos(s * Math.PI) + rng.range(-0.007, 0.007);
      const ang = -0.25 * Math.sin(s * Math.PI) + rng.range(-0.12, 0.12);
      const isKnuckle = Math.abs(s) < 0.25 || Math.abs(s) > 0.78;
      emitCanvasStroke(
        sink, TANGUY_ASPECT, StrokeClass.CYPRESS, uP, v, rng.range(158, 196),
        rng.range(0.012, 0.022), ang, rng.range(0.0042, 0.0078),
        isKnuckle ? 0xe8b88c : 0xdca478, isKnuckle ? P.ochre : 0x9e6848, rng,
        { flags: StrokeFlag.OUTLINE },
      );
    }
  }

  const underlays = new Group();
  underlays.name = 'underlays:tanguy';
  timings.total = Math.round((performance.now() - t0) * 10) / 10;
  return {
    underlays,
    village: makeVillage(TANGUY_ASPECT, 0.50, 0.86, 520),
    timings,
  };
}
