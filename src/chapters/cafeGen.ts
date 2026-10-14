// Chapter I: Café Terrace at Night (Arles, Place du Forum, Sept 1888), aspect = 0.81.
// 3D anamorphic world: golden gaslit café awning and terrace on the left (160-560 m), perspective cobblestone
// rue du Palais (210-1,800 m), blue-violet townhouses & pine branches on the right (165-1,450 m), distant clocktower
// silhouette (640-720 m), and the star-filled cobalt sky canyon overhead (12-250 km).
import { Group, Vector3 } from 'three';
import {
  PALETTE, StrokeClass, StrokeFlag,
  type QualitySettings, type Rng, type SharedUniforms, type StrokeSink, type UnderlayMaterialFactory, type VillageInfo,
} from '../contracts';
import { canvasToWorld } from '../shared/canvasSpace';
import { forkRng } from '../shared/rng';
import {
  buildCanvasQuadMesh, clamp, clamp01, emitCanvasStroke, emitCustomStar, emitSurfaceStroke,
  mixHex, shadeHex, uFromPaint,
} from './types';

export const CAFE_ASPECT = 0.81;
const P = PALETTE;
const TAU = Math.PI * 2;

const CAFE_STARS: readonly { uP: number; v: number; d: number; rho: number; rings: number; gain: number }[] = [
  { uP: 0.44, v: 0.91, d: 12200, rho: 0.015, rings: 7, gain: 1.15 },
  { uP: 0.58, v: 0.95, d: 13400, rho: 0.012, rings: 5, gain: 0.95 },
  { uP: 0.69, v: 0.88, d: 12800, rho: 0.014, rings: 6, gain: 1.08 },
  { uP: 0.51, v: 0.82, d: 14100, rho: 0.011, rings: 5, gain: 0.92 },
  { uP: 0.39, v: 0.78, d: 13600, rho: 0.012, rings: 5, gain: 0.96 },
  { uP: 0.63, v: 0.76, d: 12600, rho: 0.014, rings: 6, gain: 1.05 },
  { uP: 0.48, v: 0.69, d: 14800, rho: 0.010, rings: 5, gain: 0.88 },
  { uP: 0.57, v: 0.64, d: 13900, rho: 0.011, rings: 5, gain: 0.90 },
  { uP: 0.74, v: 0.94, d: 15100, rho: 0.010, rings: 4, gain: 0.85 },
  { uP: 0.35, v: 0.95, d: 14500, rho: 0.010, rings: 4, gain: 0.85 },
];

/** Check if (uP, v) lies inside the open starry sky canyon between the Arles buildings. */
function inSkyCanyon(uP: number, v: number): boolean {
  if (v < 0.53) return false;
  // Left roofline steps inward from uP ~ 0.31 at top to 0.43 at v = 0.53
  const leftEdge = v > 0.76 ? 0.30 - 0.08 * (v - 0.76) : 0.43 - 0.13 * ((v - 0.53) / 0.23);
  // Right roofline steps inward from uP ~ 0.82 at top to 0.61 at v = 0.53
  const rightEdge = 0.61 + 0.24 * ((v - 0.53) / 0.47);
  return uP >= leftEdge && uP <= rightEdge;
}

/** 1. Underpaint & extended sky decks (230-250 km and 96-195 km). */
function genCafeSky(sink: StrokeSink, rng: Rng): void {
  // Underpaint sheet across the portrait canvas and extended side wings
  const rows = 58, cols = 48;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const uP = -0.35 + ((c + 0.5 + 0.3 * (r & 1) + rng.range(-0.2, 0.2)) / cols) * 1.7;
      const v = -0.08 + ((r + 0.5 + rng.range(-0.15, 0.15)) / rows) * 1.18;
      const sky = inSkyCanyon(uP, v) || v > 0.88;
      let ca: number, cb: number;
      if (sky) {
        const t = clamp01((v - 0.52) / 0.5);
        ca = mixHex(P.cobalt, P.ultramarine, 0.3 + 0.5 * t);
        cb = mixHex(P.ultramarine, P.prussian, 0.25 + 0.6 * t);
      } else if (uP < 0.48 && v > 0.12 && v < 0.76) {
        // Warm amber-ochre ground behind the lit café
        ca = mixHex(P.ochre, P.chrome, rng.range(0.25, 0.65));
        cb = mixHex(P.ochre, P.ultramarine, 0.35);
      } else {
        ca = mixHex(P.prussian, P.ultramarine, rng.range(0.2, 0.6));
        cb = P.prussian;
      }
      emitCanvasStroke(sink, CAFE_ASPECT, StrokeClass.UNDERPAINT, uP, v, rng.range(232000, 248000), 0.085, rng.range(-0.25, 0.25), 0.042, ca, cb, rng);
    }
  }

  // Sky bands in the cobalt sky canyon and upper vault (28,000 strokes)
  const nBands = 28000;
  for (let i = 0; i < nBands; i++) {
    const inCore = i < 21000;
    const uP = inCore ? rng.range(0.24, 0.86) : rng.range(-0.4, 1.4);
    const v = inCore ? rng.range(0.50, 1.08) : rng.range(0.45, 1.14);
    if (inCore && !inSkyCanyon(uP, v) && rng.next() < 0.65) continue;
    const deck = clamp(Math.floor(((v - 0.45) / 0.68) * 12 + rng.normal() * 1.4), 0, 12);
    const d = 98000 + deck * 7200 + rng.range(-1800, 1800);
    const wave = 0.18 * Math.sin(5.2 * uP + 6.5 * v) + 0.08 * Math.cos(9.0 * v);
    const L = rng.range(0.022, 0.048);
    const w = rng.range(0.0065, 0.011);
    const band = (7.5 * v + 0.4 * Math.sin(4.5 * uP) + 0.12 * rng.normal()) % 1;
    let ca: number, cb: number;
    if (band < 0.48) {
      ca = mixHex(P.cobalt, P.ultramarine, rng.range(0.15, 0.65));
      cb = P.ultramarine;
    } else if (band < 0.82) {
      ca = mixHex(P.cerulean, P.cobalt, rng.range(0.25, 0.7));
      cb = P.cobalt;
    } else {
      ca = mixHex(P.blueGreen, P.zincWhite, rng.range(0.2, 0.55));
      cb = P.cerulean;
    }
    const shade = rng.range(0.88, 1.08);
    emitCanvasStroke(
      sink, CAFE_ASPECT, StrokeClass.SKY_BAND, uP, v, d, L, wave, w,
      shadeHex(ca, shade), shadeHex(cb, shade), rng,
      { dlnd: 0.04 * Math.sin(wave), kappa: rng.range(-0.28, 0.28), q1: 0.35, q2: rng.int(4), q3: rng.next() },
    );
  }
}

/** 2. The 10 radiant Arles stars in the sky canyon. */
function genCafeStars(sink: StrokeSink, rng: Rng): void {
  for (const s of CAFE_STARS) {
    emitCustomStar(sink, CAFE_ASPECT, s.uP, s.v, s.d, s.rho, s.rings, s.gain, rng, P.lemon);
  }
}

/** 3. Distant rue du Palais roofline & dark tower silhouette (HILL 1,800-4,200 m & CHURCH 620-735 m). */
function genCafeDistants(sink: StrokeSink, rng: Rng): void {
  const nUp = new Vector3(0, 0.25, 0.97).normalize();
  const tHoriz = new Vector3(1, 0, 0);
  const tVert = new Vector3(0, 1, 0);

  // Distant blue-violet buildings at the end of the rue du Palais corridor (HILL class, 1,800-3,800 m)
  for (let i = 0; i < 6500; i++) {
    const uP = rng.range(0.34, 0.72);
    const v = rng.range(0.22, 0.58);
    const d = 1850 + 1600 * clamp01((v - 0.22) / 0.36) + rng.range(-90, 90);
    const vert = rng.next() < 0.58;
    const ca = shadeHex(mixHex(P.ultramarine, P.prussian, rng.range(0.2, 0.7)), rng.range(0.65, 0.95));
    const cb = shadeHex(mixHex(P.cobalt, P.outline, rng.range(0.3, 0.7)), rng.range(0.65, 0.9));
    emitSurfaceStroke(
      sink, CAFE_ASPECT, StrokeClass.HILL, uP, v, d,
      rng.range(0.012, 0.026), rng.range(0.004, 0.0075),
      vert ? tVert : tHoriz, nUp, ca, cb, rng,
      { flags: v > 0.51 ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
    );
  }

  // Dark Arles tower & gable silhouette at the street vanishing point (CHURCH class, 625-735 m)
  for (let i = 0; i < 3200; i++) {
    const spire = i < 900;
    const uP = spire ? rng.range(0.47, 0.55) : rng.range(0.41, 0.61);
    const v = spire ? rng.range(0.42, 0.57) : rng.range(0.23, 0.45);
    const d = rng.range(630, 725);
    const ca = mixHex(P.outline, P.prussian, rng.range(0.2, 0.6));
    const cb = mixHex(P.ultramarine, P.outline, rng.range(0.25, 0.7));
    emitSurfaceStroke(
      sink, CAFE_ASPECT, StrokeClass.CHURCH, uP, v, d,
      rng.range(0.009, 0.019), rng.range(0.0028, 0.005),
      tVert, nUp, ca, cb, rng,
      { flags: StrokeFlag.OUTLINE },
    );
  }
}

/** 4. Left & right rue du Palais facades, the lit Café wall, gas lantern, and glowing windows (HOUSE & WINDOW). */
function genCafeArchitecture(sink: StrokeSink, rng: Rng): void {
  const nLeft = new Vector3(0.88, 0, 0.47).normalize();
  const nRight = new Vector3(-0.88, 0, 0.47).normalize();
  const nFront = new Vector3(0, 0, 1);
  const tWallV = new Vector3(0, 1, 0);
  const tLeftRecede = new Vector3(0.36, 0.12, -0.92).normalize();
  const tRightRecede = new Vector3(-0.36, 0.12, -0.92).normalize();

  // A. Left-side golden Café facade & upper blue-ochre building (16,000 strokes in HOUSE)
  for (let i = 0; i < 16000; i++) {
    const lowerCafe = i < 10500;
    const uP = lowerCafe ? rng.range(-0.04, 0.43) : rng.range(-0.04, 0.36);
    const v = lowerCafe ? rng.range(0.18, 0.58) : rng.range(0.58, 0.96);
    // Depth increases from left foreground (465 m) toward the street center (1,150 m)
    const tDepth = clamp01((uP + 0.04) / 0.48);
    const d = 465 + tDepth * 580 + rng.range(-18, 18);
    let ca: number, cb: number, em = 0;
    if (lowerCafe) {
      // Radiant sulfur-lemon, chrome-yellow, and orange-ochre gaslit café walls with blue door/frame accents
      const distLantern = Math.hypot((uP - 0.20) * 1.1, v - 0.56);
      const glow = clamp01(1 - distLantern / 0.38);
      const blueFrame = Math.abs(uP - 0.14) < 0.016 || Math.abs(uP - 0.29) < 0.014 || Math.abs(v - 0.42) < 0.015;
      if (blueFrame && rng.next() < 0.75) {
        ca = mixHex(P.cobalt, P.ultramarine, rng.range(0.2, 0.6));
        cb = mixHex(P.blueGreen, P.outline, rng.range(0.2, 0.6));
      } else {
        ca = glow > 0.45 ? mixHex(P.lemon, P.chrome, rng.range(0.2, 0.75)) : mixHex(P.chrome, P.ochre, rng.range(0.2, 0.65));
        cb = glow > 0.6 ? mixHex(P.zincWhite, P.lemon, rng.range(0.3, 0.7)) : mixHex(P.ochre, P.lemon, rng.range(0.2, 0.6));
        em = 0.25 + 0.65 * glow;
      }
    } else {
      // Upper hotel facade above the awning: deep blue-violet and warm ochre-lit balcony shutters
      ca = mixHex(P.ultramarine, P.ochre, rng.range(0.1, 0.38));
      cb = mixHex(P.prussian, P.cobalt, rng.range(0.2, 0.6));
    }
    const vert = rng.next() < 0.62;
    emitSurfaceStroke(
      sink, CAFE_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.010, 0.022), rng.range(0.0035, 0.0065),
      vert ? tWallV : tLeftRecede, nLeft, ca, cb, rng,
      { emissive: em, flags: rng.next() < 0.18 ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
    );
  }

  // B. Right-side townhouses receding down rue du Palais (12,000 strokes in HOUSE)
  for (let i = 0; i < 12000; i++) {
    const uP = rng.range(0.55, 1.06);
    const v = rng.range(0.16, 0.88);
    if (inSkyCanyon(uP, v)) continue;
    // Nearer on the far right (520 m), deeper toward the center street (1,550 m)
    const tIn = clamp01((1.06 - uP) / 0.51);
    const d = 520 + tIn * 980 + rng.range(-25, 25);
    const groundShop = v < 0.36 && uP < 0.78;
    let ca: number, cb: number, em = 0;
    if (groundShop) {
      ca = rng.next() < 0.45 ? mixHex(P.blueGreen, P.cypressGreen, rng.range(0.2, 0.6)) : mixHex(P.ochre, P.chrome, rng.range(0.2, 0.5));
      cb = mixHex(P.ultramarine, P.blueGreen, 0.45);
      em = 0.18;
    } else {
      ca = shadeHex(mixHex(P.ultramarine, P.cobalt, rng.range(0.15, 0.55)), rng.range(0.65, 0.95));
      cb = shadeHex(mixHex(P.prussian, P.ochre, rng.range(0.1, 0.35)), rng.range(0.6, 0.9));
    }
    const vert = rng.next() < 0.58;
    emitSurfaceStroke(
      sink, CAFE_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.011, 0.024), rng.range(0.0038, 0.007),
      vert ? tWallV : tRightRecede, nRight, ca, cb, rng,
      { emissive: em, flags: rng.next() < 0.2 ? StrokeFlag.OUTLINE : StrokeFlag.NONE },
    );
  }

  // C. The blazing Café gas lantern + glowing street/shop windows (WINDOW class, AnimKind.FLICKER, 1,200 strokes)
  // Gas lantern at (uP = 0.20, v = 0.60, d = 460 m)
  for (let i = 0; i < 650; i++) {
    const th = rng.range(0, TAU);
    const r = Math.pow(rng.next(), 1.4) * 0.065;
    const uP = 0.20 + (r * Math.cos(th)) / CAFE_ASPECT;
    const v = 0.60 + r * Math.sin(th);
    const d = 458 + rng.range(0, 18);
    const core = r < 0.018;
    const ca = core ? P.zincWhite : mixHex(P.lemon, P.chrome, clamp01(r / 0.055));
    const cb = core ? P.lemon : mixHex(P.chrome, P.ochre, rng.range(0.2, 0.6));
    emitSurfaceStroke(
      sink, CAFE_ASPECT, StrokeClass.WINDOW, uP, v, d,
      core ? 0.010 : 0.016, core ? 0.0045 : 0.0055,
      new Vector3(Math.cos(th), Math.sin(th), 0), nFront, ca, cb, rng,
      { emissive: core ? 4.8 : 2.2 * (1 - 0.5 * (r / 0.065)) },
    );
  }
  // Lit shopfront and upper balcony windows along the street
  const winSpots: readonly [number, number, number, number][] = [
    [0.12, 0.34, 480, 2.4], [0.27, 0.33, 520, 2.3], [0.36, 0.31, 590, 2.0],
    [0.62, 0.28, 780, 1.8], [0.68, 0.29, 710, 2.1], [0.16, 0.74, 490, 1.6],
    [0.49, 0.25, 1150, 1.9], [0.54, 0.26, 1080, 1.7],
  ];
  for (const [wu, wv, wd, wem] of winSpots) {
    for (let k = 0; k < 65; k++) {
      const uP = wu + rng.range(-0.018, 0.018);
      const v = wv + rng.range(-0.025, 0.025);
      const ca = rng.next() < 0.5 ? P.lemon : P.chrome;
      const cb = mixHex(P.chrome, P.ochre, 0.45);
      emitSurfaceStroke(
        sink, CAFE_ASPECT, StrokeClass.WINDOW, uP, v, wd + rng.range(-6, 6),
        0.011, 0.0042, tWallV, nFront, ca, cb, rng, { emissive: wem },
      );
    }
  }
}

/** 5. Foreground Café awning canopy & right-side swaying dark pine branches (CYPRESS class, 145-242 m). */
function genCafeCanopyAndPines(sink: StrokeSink, rng: Rng): void {
  // A. The sloping golden-yellow & orange-ochre Café awning on the left (uP in [-0.05, 0.47], v in [0.52, 0.87], d in [150, 238] m)
  for (let i = 0; i < 8500; i++) {
    const v = rng.range(0.52, 0.87);
    const maxU = 0.47 - 0.32 * ((v - 0.52) / 0.35);
    const uP = rng.range(-0.05, maxU);
    const tU = clamp01((uP + 0.05) / (maxU + 0.05));
    const d = 152 + tU * 82 + rng.range(-4, 4);
    const rim = Math.abs(uP - maxU) < 0.022 || Math.abs(v - 0.53) < 0.018;
    const ca = rim
      ? mixHex(P.outline, P.ultramarine, rng.range(0.2, 0.6))
      : v < 0.66
        ? mixHex(P.lemon, P.chrome, rng.range(0.15, 0.7))
        : mixHex(P.chrome, P.ochre, rng.range(0.2, 0.7));
    const cb = rim ? P.prussian : mixHex(P.lemon, P.zincWhite, rng.range(0.1, 0.45));
    const ang = -0.52 + rng.range(-0.15, 0.15);
    emitCanvasStroke(
      sink, CAFE_ASPECT, StrokeClass.CYPRESS, uP, v, d,
      rng.range(0.014, 0.028), ang, rng.range(0.0045, 0.008), ca, cb, rng,
      {
        dlnd: 0.04,
        emissive: rim ? 0 : 0.32,
        flags: rim ? StrokeFlag.OUTLINE : StrokeFlag.NONE,
        q1: 0, q2: 0, q3: 0,
      },
    );
  }

  // B. Foreground right dark emerald/black-green pine branches swaying in the Arles night breeze (9,500 strokes in CYPRESS)
  for (let i = 0; i < 9500; i++) {
    const v = rng.range(0.36, 0.89);
    const minU = 0.72 + 0.08 * Math.sin(8.5 * v);
    const uP = rng.range(minU, 1.06);
    const d = rng.range(158, 232);
    const ca = rng.next() < 0.35 ? mixHex(P.cypressGreen, P.blueGreen, 0.25) : P.cypressDark;
    const cb = rng.next() < 0.5 ? P.cypressGreen : mixHex(P.cypressDark, P.prussian, 0.45);
    const ang = 2.1 + 0.45 * Math.sin(6 * v + 4 * uP) + rng.range(-0.25, 0.25);
    emitCanvasStroke(
      sink, CAFE_ASPECT, StrokeClass.CYPRESS, uP, v, d,
      rng.range(0.014, 0.030), ang, rng.range(0.0045, 0.0078),
      shadeHex(ca, rng.range(0.65, 1.05)), shadeHex(cb, rng.range(0.65, 1.0)), rng,
      { flags: uP < minU + 0.025 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, q1: i % 7, q2: v * TAU, q3: 0 },
    );
  }
}

/** 6. Terrace deck, round bistro tables, waiter/patrons, and rue du Palais cobblestones (GROUND & GROVE). */
function genCafeGroundAndTerrace(sink: StrokeSink, rng: Rng): void {
  const nGround = new Vector3(0, 1, 0.08).normalize();
  const tHoriz = new Vector3(1, 0, 0);
  const tPersp = new Vector3(0.35, 0.08, -0.93).normalize();

  // A. Lit Café terrace floor + cobblestone street (24,000 strokes in GROUND, d in [205, 1,750] m)
  for (let i = 0; i < 24000; i++) {
    const uP = rng.range(-0.08, 1.08);
    const v = rng.range(-0.06, 0.25);
    // Perspective depth along the ground plane from 208 m at the bottom edge to 1,680 m at v = 0.25
    const tV = clamp01((v + 0.06) / 0.31);
    const d = 208 * Math.pow(1680 / 208, tV) + rng.range(-8, 8);
    // Terrace boundary runs diagonally from (uP = 0.56, v = -0.04) to (uP = 0.42, v = 0.24)
    const terraceEdge = 0.55 - 0.42 * tV;
    const onTerrace = uP < terraceEdge && v > 0.02;
    let ca: number, cb: number, em = 0;
    if (onTerrace) {
      // Sulfur yellow, lemon, chrome, and pale blue-white terrace floor planks
      const curb = Math.abs(uP - terraceEdge) < 0.022;
      ca = curb ? P.outline : rng.next() < 0.6 ? P.lemon : P.chrome;
      cb = curb ? P.ultramarine : mixHex(P.lemon, P.zincWhite, rng.range(0.2, 0.6));
      em = curb ? 0 : 0.22 * (1 - 0.5 * tV);
    } else {
      // Cobblestones of rue du Palais: cobalt, ultramarine, violet-ochre, with golden reflected streaks
      const goldReflect = Math.abs(uP - 0.46) < 0.16 && rng.next() < 0.34;
      if (goldReflect) {
        ca = mixHex(P.chrome, P.ochre, rng.range(0.2, 0.7));
        cb = mixHex(P.lemon, P.cobalt, 0.45);
        em = 0.12;
      } else {
        ca = mixHex(P.cobalt, P.ultramarine, rng.range(0.15, 0.75));
        cb = rng.next() < 0.35 ? mixHex(P.ochre, P.ultramarine, 0.55) : P.prussian;
      }
    }
    emitSurfaceStroke(
      sink, CAFE_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.013, 0.028), rng.range(0.0045, 0.008),
      rng.next() < 0.7 ? tHoriz : tPersp, nGround, ca, cb, rng,
      { emissive: em },
    );
  }

  // B. Bistro tables, chairs, waiter, and seated patrons on the terrace (7,500 strokes in GROVE, d in [215, 620] m)
  const tables: readonly [number, number, number][] = [
    [0.09, 0.09, 235], [0.24, 0.11, 255], [0.16, 0.16, 295],
    [0.32, 0.15, 315], [0.23, 0.20, 365], [0.35, 0.21, 395],
  ];
  for (const [tu, tv, td] of tables) {
    // Round white/cerulean tabletop + dark chair/table legs
    for (let k = 0; k < 650; k++) {
      const top = k < 380;
      const uP = tu + rng.range(-0.042, 0.042);
      const v = top ? tv + rng.range(-0.010, 0.010) : tv - rng.range(0.01, 0.045);
      const ca = top ? mixHex(P.zincWhite, P.lemon, rng.range(0.1, 0.45)) : mixHex(P.ochre, P.outline, 0.55);
      const cb = top ? mixHex(P.cerulean, P.zincWhite, 0.6) : P.prussian;
      emitSurfaceStroke(
        sink, CAFE_ASPECT, StrokeClass.GROVE, uP, v, td + rng.range(-6, 6),
        0.011, 0.004, top ? tHoriz : new Vector3(0, 1, 0), nGround, ca, cb, rng,
        { emissive: top ? 0.28 : 0, flags: StrokeFlag.OUTLINE },
      );
    }
  }
  // Waiter & patron silhouettes (uP ~ 0.28..0.41, v ~ 0.18..0.34, d ~ 330..490 m)
  const figures: readonly [number, number, number, number][] = [
    [0.27, 0.25, 340, 0.09], // standing waiter in dark coat & white apron
    [0.19, 0.22, 355, 0.065],
    [0.34, 0.23, 385, 0.065],
    [0.39, 0.24, 435, 0.06],
    [0.51, 0.23, 680, 0.045], // strolling figure on rue du Palais
  ];
  for (let fi = 0; fi < figures.length; fi++) {
    const [fu, fv, fd, fh] = figures[fi];
    for (let k = 0; k < 720; k++) {
      const uP = fu + rng.range(-0.022, 0.022);
      const v = fv + rng.range(-0.5 * fh, 0.5 * fh);
      const apron = fi === 0 && v < fv && Math.abs(uP - fu) < 0.012;
      const ca = apron ? P.zincWhite : mixHex(P.prussian, P.outline, rng.range(0.2, 0.7));
      const cb = apron ? P.lemon : mixHex(P.ultramarine, P.cypressDark, 0.5);
      emitSurfaceStroke(
        sink, CAFE_ASPECT, StrokeClass.GROVE, uP, v, fd + rng.range(-5, 5),
        0.010, 0.0038, new Vector3(0, 1, 0), new Vector3(0, 0, 1), ca, cb, rng,
        { flags: StrokeFlag.OUTLINE },
      );
    }
  }
}

export function generateCafeChapter(
  sink: StrokeSink,
  seed: number,
  mat: UnderlayMaterialFactory,
  _u: SharedUniforms,
  _q: QualitySettings,
): { underlays: Group; village: VillageInfo; timings: Record<string, number> } {
  const timings: Record<string, number> = {};
  const time = (name: string, fn: () => void) => {
    const t0 = performance.now();
    fn();
    timings[name] = Math.round((performance.now() - t0) * 10) / 10;
  };

  time('sky', () => genCafeSky(sink, forkRng(seed, 'cafe:sky')));
  time('stars', () => genCafeStars(sink, forkRng(seed, 'cafe:stars')));
  time('hills', () => genCafeDistants(sink, forkRng(seed, 'cafe:dist')));
  time('village', () => genCafeArchitecture(sink, forkRng(seed, 'cafe:arch')));
  time('cypress', () => genCafeCanopyAndPines(sink, forkRng(seed, 'cafe:canopy')));
  time('ground', () => genCafeGroundAndTerrace(sink, forkRng(seed, 'cafe:ground')));

  const underlays = new Group();
  underlays.name = 'underlays:cafe';
  // Warm café facade backing quad
  underlays.add(buildCanvasQuadMesh(
    CAFE_ASPECT,
    [[-0.06, 0.16, 470], [0.43, 0.22, 1020], [0.41, 0.62, 1020], [-0.06, 0.86, 470]],
    mat, 0x8a5a18, 'cafeWallCore',
  ));
  // Right street wall backing quad
  underlays.add(buildCanvasQuadMesh(
    CAFE_ASPECT,
    [[0.56, 0.20, 1450], [1.06, 0.14, 525], [1.06, 0.88, 525], [0.58, 0.72, 1450]],
    mat, 0x162244, 'cafeRightCore',
  ));
  // Cobblestone & terrace ground backing quad
  underlays.add(buildCanvasQuadMesh(
    CAFE_ASPECT,
    [[-0.12, -0.08, 210], [1.12, -0.08, 210], [0.75, 0.25, 1700], [0.25, 0.25, 1700]],
    mat, 0x182548, 'cafeGroundCore',
  ));

  const steepleBase = canvasToWorld(uFromPaint(0.51, CAFE_ASPECT), 0.24, 675);
  const steepleTip = canvasToWorld(uFromPaint(0.51, CAFE_ASPECT), 0.56, 675);
  return {
    underlays,
    village: { steepleBase, steepleTip, houses: [] },
    timings,
  };
}
