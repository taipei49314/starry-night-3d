// Chapter II (Color — 巴黎與覺醒): Self-Portrait with Straw Hat (Paris, Summer 1887), aspect = 0.81.
// 3D anamorphic self-portrait built from radial rhythmic divisionist brushstrokes:
// - Swirling cobalt-cerulean-gold aura background radiating around the painter's head
// - Wide woven golden-yellow straw hat brim & crown
// - Sculpted facial planes, fiery vermilion-ginger beard, blue painter's jacket, and the piercing emerald-viridian gaze portal (uP = 0.49, v = 0.56).
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

export const SELFPORTRAIT_ASPECT = 0.81;
const P = PALETTE;

const STRAW_GOLD = 0xf2c838;
const STRAW_OCHRE = 0xc88a28;
const BEARD_VERMILION = 0xd85224;
const BEARD_GINGER = 0xe87c32;
const FLESH_PEACH = 0xe8bfa0;
const FLESH_SAGE = 0x8eb49c;
const EYE_EMERALD = 0x2ea878;
const JACKET_COBALT = 0x264886;

/** 1. Radial Swirling Cobalt, Turquoise & Gold Aura Backdrop (UNDERPAINT & SKY_SWIRL). */
function genRadialAuraBackdrop(sink: StrokeSink, rng: Rng): void {
  for (let i = 0; i < 6000; i++) {
    const uP = rng.range(-0.12, 1.12);
    const v = rng.range(0.18, 1.06);
    const d = rng.range(230000, 250000);
    const cA = mixHex(P.cobalt, P.cerulean, rng.range(0.2, 0.8));
    const cB = STRAW_GOLD;
    emitCanvasStroke(
      sink, SELFPORTRAIT_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.048, 0.088), rng.range(-0.4, 0.4), rng.range(0.024, 0.042),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // Rhythmic divisionist aura dabs radiating tangentially around (0.50, 0.58) (SKY_SWIRL [98..166 km])
  for (let i = 0; i < 20000; i++) {
    const uP = rng.range(-0.08, 1.08);
    const v = rng.range(0.22, 1.04);
    const d = rng.range(98000, 166000);
    const dx = (uP - 0.50) * SELFPORTRAIT_ASPECT;
    const dy = v - 0.58;
    const r = Math.hypot(dx, dy);
    // Tangential + slight outward spiral angle around the head
    const ang = Math.atan2(dy, dx) + 1.35 + rng.range(-0.16, 0.16);
    const nearBrim = Math.max(0, 1 - Math.abs(r - 0.34) / 0.16);
    const warmDash = (i % 5) === 0;
    const cA = warmDash
      ? shadeHex(mixHex(STRAW_GOLD, P.lemon, rng.range(0.2, 0.8)), rng.range(0.92, 1.12))
      : shadeHex(mixHex(P.cobalt, P.blueGreen, clamp(0.25 + 0.55 * nearBrim, 0, 1)), rng.range(0.88, 1.14));
    const cB = warmDash ? STRAW_OCHRE : P.cerulean;

    emitCanvasStroke(
      sink, SELFPORTRAIT_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.013, 0.026), ang, rng.range(0.0048, 0.0092),
      cA, cB, rng,
      { q1: 0.25, q2: i & 3, q3: rng.next() },
    );
  }
}

/** 2. Blue Cobalt Painter's Jacket & Collar in the Foreground (GROUND [201..510 m]). */
function genPainterJacket(sink: StrokeSink, rng: Rng): void {
  const nUp = new Vector3(0, 0.5, 0.86).normalize();

  for (let i = 0; i < 14500; i++) {
    const t = Math.pow(rng.next(), 1.1);
    const v = 0.002 + 0.36 * t;
    // Smooth rounded anatomical shoulder curve tapering into the collar at v = 0.36
    const shoulderSpan = 0.14 + 0.32 * Math.sin(Math.min(1, (1 - t * 0.82) * 1.18) * Math.PI * 0.5);
    const uRel = rng.range(-1, 1);
    const uP = 0.50 + uRel * shoulderSpan;
    const d = clamp(206 + 298 * t + rng.range(-5, 5), 201, 510);

    // V-neck lapel diagonal strokes converging toward the throat (0.49, 0.31)
    const lapelEdge = 0.12 + 0.34 * (1 - t);
    const isThroatShirt = t > 0.58 && Math.abs(uRel) < 0.22;
    const isLapel = !isThroatShirt && Math.abs(uRel) < lapelEdge && v > 0.10;
    const ang = isThroatShirt
      ? rng.range(-0.25, 0.25)
      : uRel < 0
        ? 1.18 + 0.22 * uRel + rng.range(-0.14, 0.14)
        : 1.96 + 0.22 * uRel + rng.range(-0.14, 0.14);
    const cA = isThroatShirt
      ? shadeHex(mixHex(P.cerulean, FLESH_SAGE, rng.range(0.25, 0.75)), rng.range(0.92, 1.12))
      : isLapel
        ? shadeHex(mixHex(P.ultramarine, EYE_EMERALD, rng.range(0.15, 0.55)), rng.range(0.88, 1.14))
        : shadeHex(mixHex(JACKET_COBALT, P.prussian, rng.range(0.2, 0.75)), rng.range(0.85, 1.12));
    const cB = isThroatShirt ? P.lemon : isLapel ? P.lemon : P.cerulean;

    emitCanvasStroke(
      sink, SELFPORTRAIT_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.015, 0.030), ang, rng.range(0.0052, 0.0096),
      cA, cB, rng,
      { q1: nUp.x, q2: nUp.y, q3: nUp.z, emissive: 0.18 },
    );
  }
}

/** 3. Woven Golden Straw Hat, Sculpted Facial Contours, Fiery Red Beard & Piercing Emerald Eyes (HOUSE & WINDOW). */
function genStrawHatAndFace(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);
  const tDir = new Vector3(1, 0, 0);
  const tHoriz = new Vector3(1, 0, 0);

  // Golden Woven Straw Hat Brim & Crown (uP = 0.14..0.86, v = 0.50..0.91, d = 505..575 m, HOUSE)
  for (let i = 0; i < 12000; i++) {
    const theta = rng.range(0, Math.PI * 2);
    const rad = rng.range(0.14, 0.37);
    // Slight three-quarter tilt of the straw hat brim
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const uP = 0.50 + cosT * rad;
    const v = 0.65 + sinT * rad * 0.66 - 0.018 * cosT * rad;
    if (v < 0.48 || v > 0.92) continue;
    // Skip central facial oval so the hat frames the head cleanly
    const inFace = Math.hypot((uP - 0.49) / 0.152, (v - 0.525) / 0.175) < 0.94;
    if (inFace && v < 0.69) continue;

    const d = 510 + 55 * rad + rng.range(-8, 8);
    const isCrown = rad < 0.21 && v > 0.63;
    const isBand = Math.abs(rad - 0.21) < 0.022 && v > 0.61;
    const cA = isBand
      ? P.prussian
      : shadeHex(mixHex(STRAW_GOLD, P.lemon, rng.range(0.25, 0.85)), rng.range(0.90, 1.15));
    const cB = isBand ? BEARD_VERMILION : STRAW_OCHRE;

    // Tangential woven straw brushwork along the brim, radial/arched weave on the crown
    const strokeAng = isCrown
      ? Math.PI * 0.5 - 0.45 * cosT + rng.range(-0.16, 0.16)
      : theta + Math.PI * 0.5 + rng.range(-0.14, 0.14);
    tDir.set(Math.cos(strokeAng), Math.sin(strokeAng), 0).normalize();

    emitSurfaceStroke(
      sink, SELFPORTRAIT_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.013, 0.025), rng.range(0.0044, 0.0082),
      tDir, nFront, cA, cB, rng,
      { emissive: isBand ? 0.12 : 0.45 },
    );
  }

  // Sculpted Facial Contours & Fiery Ginger-Vermilion Beard (uP = 0.34..0.65, v = 0.31..0.70, d = 462..502 m, HOUSE)
  for (let i = 0; i < 10200; i++) {
    const tV = rng.next(); // 0 = chin/beard tip (0.31), 1 = forehead (0.70)
    const v = 0.31 + 0.39 * tV;
    // Smooth anatomical jaw-to-cheekbone-to-temple contour
    const cheekCurve = Math.sin(Math.min(1, tV * 1.15) * Math.PI);
    const halfW = tV < 0.32
      ? 0.065 + 0.24 * tV
      : 0.142 + 0.018 * cheekCurve - 0.022 * Math.max(0, tV - 0.72);
    const uRel = rng.range(-1, 1);
    const uP = 0.49 + uRel * halfW;
    const d = 464 + 34 * (uRel * uRel) + rng.range(-5, 5);

    const isBeardOrMoustache =
      tV < 0.37
      || (tV < 0.55 && Math.abs(uRel) > 0.56)
      || (v > 0.42 && v < 0.475 && Math.abs(uP - 0.485) < 0.078);
    const isBrowOrHair = tV > 0.82 || (Math.abs(v - 0.595) < 0.020 && Math.abs(uP - 0.49) < 0.115 && Math.abs(uP - 0.485) > 0.018);
    const isNoseBridge = v >= 0.475 && v <= 0.585 && Math.abs(uP - 0.482) < 0.022;
    const isEar = tV >= 0.44 && tV <= 0.64 && uRel > 0.76;
    const isCoolShadow = uRel < -0.22 && !isBeardOrMoustache && !isNoseBridge;

    let cA: number, cB: number, em = 0.25;
    let strokeAng = Math.PI * 0.5;
    if (isBeardOrMoustache || isBrowOrHair) {
      cA = shadeHex(mixHex(BEARD_VERMILION, BEARD_GINGER, rng.range(0.2, 0.85)), rng.range(0.88, 1.15));
      cB = STRAW_GOLD;
      em = 0.38;
      // Whiskers fan outward from the philtrum/chin; brows arch over the eyes
      strokeAng = isBrowOrHair && v < 0.63
        ? (uP < 0.49 ? 0.28 : -0.28) + rng.range(-0.12, 0.12)
        : Math.PI * 0.5 + 0.52 * uRel + rng.range(-0.15, 0.15);
    } else if (isNoseBridge) {
      cA = shadeHex(mixHex(FLESH_PEACH, P.lemon, rng.range(0.35, 0.70)), rng.range(0.96, 1.14));
      cB = STRAW_GOLD;
      em = 0.40;
      strokeAng = Math.PI * 0.5 + 0.06 + rng.range(-0.06, 0.06);
    } else if (isEar) {
      cA = shadeHex(mixHex(FLESH_PEACH, BEARD_VERMILION, 0.35), rng.range(0.90, 1.10));
      cB = STRAW_OCHRE;
      strokeAng = Math.PI * 0.5 - 0.25 + rng.range(-0.12, 0.12);
    } else if (isCoolShadow) {
      // Complementary divisionist cool sage-green / cerulean cheek plane shadow
      cA = shadeHex(mixHex(FLESH_SAGE, FLESH_PEACH, rng.range(0.3, 0.7)), rng.range(0.88, 1.12));
      cB = P.cerulean;
      strokeAng = Math.PI * 0.5 + 0.38 * uRel + rng.range(-0.14, 0.14);
    } else {
      cA = shadeHex(mixHex(FLESH_PEACH, P.lemon, rng.range(0.15, 0.45)), rng.range(0.92, 1.12));
      cB = BEARD_GINGER;
      em = 0.32;
      strokeAng = Math.PI * 0.5 - 0.34 * uRel + rng.range(-0.14, 0.14);
    }

    tDir.set(Math.cos(strokeAng), Math.sin(strokeAng), 0).normalize();
    emitSurfaceStroke(
      sink, SELFPORTRAIT_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.0095, 0.019), rng.range(0.0035, 0.0066),
      tDir, nFront, cA, cB, rng,
      { flags: Math.abs(uRel) > 0.84 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: em },
    );
  }

  // The Two Piercing Emerald-Viridian Eyes & Catchlight Portals (uP = 0.43 & 0.55, v = 0.56, d = 456..464 m, WINDOW)
  const eyes = [
    { u0: 0.43, v0: 0.56 },
    { u0: 0.55, v0: 0.56 },
  ];
  for (const eye of eyes) {
    for (let i = 0; i < 650; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const r = rng.range(0.002, 0.026);
      const uP = eye.u0 + Math.cos(ang) * r;
      const v = eye.v0 + Math.sin(ang) * r * 0.68;
      const d = 456 + rng.range(0, 6);
      const isCatchlight = r < 0.007;
      const cA = isCatchlight ? P.zincWhite : r < 0.016 ? EYE_EMERALD : P.prussian;
      const cB = isCatchlight ? P.lemon : STRAW_GOLD;
      emitSurfaceStroke(
        sink, SELFPORTRAIT_ASPECT, StrokeClass.WINDOW, uP, v, d,
        0.008, 0.0032,
        tHoriz, nFront, cA, cB, rng,
        { emissive: isCatchlight ? 3.2 : 1.65 },
      );
    }
  }
}

function buildSelfPortraitUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:selfportrait';
  g.add(buildCanvasQuadMesh(
    SELFPORTRAIT_ASPECT,
    [[-0.08, -0.02, 590], [1.08, -0.02, 590], [1.08, 1.04, 590], [-0.08, 1.04, 590]],
    mat,
    0x33536e,
    'selfportrait-backing',
  ));
  return g;
}

export function generateSelfPortraitChapter(
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

  time('aura', () => genRadialAuraBackdrop(sink, forkRng(seed, 'selfportrait:aura')));
  time('jacket', () => genPainterJacket(sink, forkRng(seed, 'selfportrait:jacket')));
  time('face', () => genStrawHatAndFace(sink, forkRng(seed, 'selfportrait:face')));

  const underlays = buildSelfPortraitUnderlays(mat);
  const steepleTip = canvasToWorld(uFromPaint(0.49, SELFPORTRAIT_ASPECT), 0.56, 460);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.49, SELFPORTRAIT_ASPECT), 0.34, 470),
    steepleTip,
  };
  return { underlays, village, timings };
}
