// Chapter I (Earth — 黑土與人): The Potato Eaters (Nuenen, April 1885), aspect = 1.38.
// 3D anamorphic peasant cottage interior: heavy palette-knife impasto in peat-umber, coal-slate, dark olive,
// and warm oil-lamp ochre. Features low timber ceiling rafters, the central hanging oil lamp portal (uP=0.50, v=0.78, d=310m),
// the wooden table with steaming platter of potatoes & coffee pot, and the five peasant figures lit by chiaroscuro.
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

export const POTATO_ASPECT = 1.38;
const P = PALETTE;

const PEAT_DARK = 0x171410;
const PEAT_UMBER = 0x2c2218;
const COAL_OLIVE = 0x2a2f20;
const EARTH_OCHRE = 0x8e6635;
const POTATO_GOLD = 0xd8a452;
const LAMP_AMBER = 0xf4c454;
const BONNET_CREAM = 0xd8cdb4;

/** 1. Dark Nuenen cottage ceiling rafters, peat-plaster walls & left night window. */
function genCottageEnvelope(sink: StrokeSink, rng: Rng): void {
  // Deep coal-and-peat backing underlayer
  for (let i = 0; i < 6000; i++) {
    const uP = rng.range(-0.10, 1.10);
    const v = rng.range(0.18, 1.06);
    const d = rng.range(230000, 250000);
    const cA = mixHex(PEAT_DARK, PEAT_UMBER, rng.range(0.2, 0.8));
    const cB = COAL_OLIVE;
    emitCanvasStroke(
      sink, POTATO_ASPECT, StrokeClass.UNDERPAINT, uP, v, d,
      rng.range(0.050, 0.092), rng.range(-0.15, 0.15), rng.range(0.025, 0.044),
      cA, cB, rng, { flags: StrokeFlag.UNDERLAYER },
    );
  }

  // Heavy low-ceiling timber beams converging in perspective above the table (SKY_BAND & HILL)
  for (let i = 0; i < 16500; i++) {
    const uP = rng.range(-0.06, 1.06);
    const v = rng.range(0.45, 1.04);
    const d = rng.range(98000, 165000);
    const distLamp = Math.hypot((uP - 0.50) * POTATO_ASPECT, v - 0.78);
    const lampWarmth = Math.max(0, 1 - distLamp / 0.42);
    const beamIdx = Math.floor((uP - 0.50) * 11);
    const isRafter = v > 0.76 && Math.abs((uP - 0.50) * 11 - beamIdx - 0.5) < 0.18;
    const perspAng = isRafter ? Math.atan2(0.58 - v, (0.50 - uP) * POTATO_ASPECT) : rng.range(-0.12, 0.12);
    const cA = shadeHex(
      mixHex(isRafter ? PEAT_DARK : PEAT_UMBER, EARTH_OCHRE, 0.55 * lampWarmth),
      rng.range(0.84, 1.14),
    );
    const cB = mixHex(COAL_OLIVE, POTATO_GOLD, 0.35 * lampWarmth);
    emitCanvasStroke(
      sink, POTATO_ASPECT, StrokeClass.SKY_BAND, uP, v, d,
      rng.range(0.020, 0.040), perspAng, rng.range(0.0065, 0.0125),
      cA, cB, rng,
      { q1: 0.08, q2: i & 3, q3: rng.next() },
    );
  }

  // The Hanging Oil Lamp Portal at (uP = 0.50, v = 0.78) — warm amber oil-lamp glow against peat-umber rafters
  emitCustomStar(sink, POTATO_ASPECT, 0.50, 0.78, 12200, 0.016, 5, 1.05, rng, LAMP_AMBER, PEAT_UMBER);
}

/** 2. Earthen cottage floor, perspective wooden table, steaming potato platter, coffee pot & oil lamp frame. */
function genTableAndEarthFloor(sink: StrokeSink, rng: Rng): void {
  const nUp = new Vector3(0, 1, 0.15).normalize();
  const nFront = new Vector3(0, 0, 1);
  const tDir = new Vector3(1, 0, 0);

  // Dark beaten-earth floor in the foreground (GROUND [201..515 m])
  for (let i = 0; i < 13500; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.34 * t;
    const d = clamp(206 + 304 * t + rng.range(-5, 5), 201, 515);
    const centerGlow = Math.max(0, 1 - Math.hypot((uP - 0.50) * POTATO_ASPECT, v - 0.28) / 0.46);
    const cA = shadeHex(mixHex(PEAT_DARK, PEAT_UMBER, 0.3 + 0.5 * centerGlow), rng.range(0.86, 1.12));
    const cB = mixHex(COAL_OLIVE, EARTH_OCHRE, 0.35 * centerGlow);
    emitCanvasStroke(
      sink, POTATO_ASPECT, StrokeClass.GROUND, uP, v, d,
      rng.range(0.018, 0.036), rng.range(-0.22, 0.22), rng.range(0.0055, 0.0105),
      cA, cB, rng,
      { q1: nUp.x, q2: nUp.y, q3: nUp.z },
    );
  }

  // Perspective trapezoidal wooden table + steaming platter of potatoes (center-left) & coffee cups (right)
  for (let i = 0; i < 6800; i++) {
    const tV = rng.next();
    const v = 0.22 + 0.16 * tV;
    const halfSpan = 0.24 - 0.05 * tV; // perspective taper toward back of table
    const uP = 0.49 + rng.range(-halfSpan, halfSpan);
    const d = 460 + 68 * tV + rng.range(-5, 5);

    const distPlatter = Math.hypot((uP - 0.43) * POTATO_ASPECT, (v - 0.32) * 2.1);
    const distCoffee = Math.hypot((uP - 0.62) * POTATO_ASPECT, (v - 0.31) * 2.3);
    const isPotato = distPlatter < 0.095;
    const isPlatterRim = distPlatter >= 0.095 && distPlatter < 0.125;
    const isCoffeePot = distCoffee < 0.055;

    let cA: number, cB: number, em = 0.22;
    let ang = rng.range(-0.08, 0.08);
    if (isPotato) {
      // Gnarled golden-ochre potatoes heaped on the platter
      cA = shadeHex(mixHex(POTATO_GOLD, LAMP_AMBER, rng.range(0.25, 0.80)), rng.range(0.90, 1.15));
      cB = EARTH_OCHRE;
      em = 0.65;
      ang = Math.atan2(v - 0.32, uP - 0.43) + Math.PI * 0.5 + rng.range(-0.3, 0.3);
    } else if (isPlatterRim || isCoffeePot) {
      cA = shadeHex(mixHex(BONNET_CREAM, POTATO_GOLD, rng.range(0.3, 0.7)), rng.range(0.88, 1.12));
      cB = PEAT_UMBER;
      em = 0.42;
    } else {
      // Sun/lamp-bleached wooden tabletop planks
      const lampFalloff = Math.max(0, 1 - Math.hypot((uP - 0.48) * POTATO_ASPECT, v - 0.33) / 0.30);
      cA = shadeHex(mixHex(PEAT_UMBER, EARTH_OCHRE, 0.25 + 0.60 * lampFalloff), rng.range(0.88, 1.12));
      cB = lampFalloff > 0.4 ? POTATO_GOLD : PEAT_DARK;
      em = 0.16 + 0.28 * lampFalloff;
    }
    tDir.set(Math.cos(ang), Math.sin(ang), 0).normalize();
    emitSurfaceStroke(
      sink, POTATO_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.012, 0.024), rng.range(0.0042, 0.0080),
      tDir, nUp, cA, cB, rng,
      { emissive: em },
    );
  }

  // Hanging brass oil lamp shade, glowing flame & rising potato steam wisps (WINDOW class [455..560 m])
  for (let i = 0; i < 1800; i++) {
    const isLamp = i < 1050;
    if (isLamp) {
      const tL = rng.next();
      const v = 0.71 + 0.15 * tL;
      const shadeW = tL < 0.45 ? 0.024 + 0.032 * (1 - tL / 0.45) : 0.012;
      const uP = 0.50 + rng.range(-shadeW, shadeW);
      const d = rng.range(458, 490);
      const isFlame = tL < 0.32 && Math.abs(uP - 0.50) < 0.022;
      const ang = isFlame ? Math.PI * 0.5 + rng.range(-0.2, 0.2) : rng.range(-0.15, 0.15);
      tDir.set(Math.cos(ang), Math.sin(ang), 0).normalize();
      emitSurfaceStroke(
        sink, POTATO_ASPECT, StrokeClass.WINDOW, uP, v, d,
        rng.range(0.010, 0.020), rng.range(0.0038, 0.0068),
        tDir, nFront, isFlame ? P.lemon : LAMP_AMBER, isFlame ? LAMP_AMBER : EARTH_OCHRE, rng,
        { emissive: isFlame ? 3.8 : 2.1 },
      );
    } else {
      const s = rng.next();
      const uP = 0.43 + 0.02 * Math.sin(s * 7.0) + rng.range(-0.045, 0.045);
      const v = 0.34 + 0.18 * s;
      tDir.set(0.25 * Math.cos(s * 7.0), 1, 0).normalize();
      emitSurfaceStroke(
        sink, POTATO_ASPECT, StrokeClass.WINDOW, uP, v, rng.range(465, 515),
        rng.range(0.011, 0.021), rng.range(0.0036, 0.0064),
        tDir, nFront, mixHex(BONNET_CREAM, EARTH_OCHRE, 0.5), PEAT_UMBER, rng,
        { emissive: 0.45 * (1 - 0.5 * s) },
      );
    }
  }
}

/** 3. The Five Peasant Figures gathered around the table with contoured heads, bonnets, shoulders & reaching hands. */
function genPeasantFigures(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);
  const tDir = new Vector3(0, 1, 0);

  // Five figures around the table:
  //  0: Left-profile young peasant woman/man reaching toward platter
  //  1: Back-left man in peaked cap holding cup & fork
  //  2: Center-foreground child/figure seen from the back (silhouette against the table glow)
  //  3: Back-right older peasant man/woman reaching with fork
  //  4: Right peasant woman in large white Dutch bonnet pouring coffee
  const figures = [
    { u0: 0.17, v0: 0.12, v1: 0.63, w: 0.088, d: 472, faceDir: 1, bonnet: true, cap: false, reachU: 0.37, reachV: 0.34 },
    { u0: 0.34, v0: 0.34, v1: 0.68, w: 0.072, d: 542, faceDir: 1, bonnet: false, cap: true, reachU: 0.42, reachV: 0.36 },
    { u0: 0.49, v0: 0.04, v1: 0.50, w: 0.086, d: 452, faceDir: 0, bonnet: true, cap: false, reachU: 0.49, reachV: 0.28 },
    { u0: 0.64, v0: 0.35, v1: 0.69, w: 0.074, d: 538, faceDir: -1, bonnet: false, cap: false, reachU: 0.51, reachV: 0.36 },
    { u0: 0.81, v0: 0.12, v1: 0.64, w: 0.090, d: 478, faceDir: -1, bonnet: true, cap: false, reachU: 0.64, reachV: 0.33 },
  ];

  for (const fig of figures) {
    // A. Anatomical body & head silhouette strokes
    for (let i = 0; i < 3100; i++) {
      const tH = rng.next(); // 0 = lower torso/skirt, 0.64 = neck, 0.68..1.0 = head & bonnet/cap
      const v = fig.v0 + (fig.v1 - fig.v0) * tH;

      // Contoured width profile: rounded head oval, narrow neck, sloped rounded shoulders, draped torso
      let widthFactor: number;
      let headRelY = 0;
      if (tH > 0.68) {
        headRelY = (tH - 0.84) / 0.16; // -1 at chin, 0 at cheekbones, +1 at crown
        const oval = Math.sqrt(Math.max(0.08, 1 - headRelY * headRelY));
        widthFactor = (fig.bonnet ? 0.64 : 0.52) * oval;
      } else if (tH > 0.61) {
        // Neck transition
        widthFactor = 0.34;
      } else {
        // Sloped shoulders (peak around tH = 0.48) tapering gently down
        const shoulderCurve = Math.sin(Math.min(1, tH / 0.58) * Math.PI * 0.5);
        widthFactor = 0.78 + 0.22 * shoulderCurve;
      }

      const uRel = rng.range(-1, 1);
      // Slight forward lean of head/upper torso toward the table center
      const leanOffset = fig.faceDir * 0.018 * Math.max(0, tH - 0.45);
      const uP = fig.u0 + leanOffset + uRel * fig.w * widthFactor;
      const d = fig.d + 12 * (uRel * uRel) + rng.range(-7, 7);

      const isHead = tH > 0.68;
      const lampSide = fig.faceDir > 0 ? uRel > 0.05 : fig.faceDir < 0 ? uRel < -0.05 : tH > 0.82;
      let cA: number, cB: number, em = 0.08;
      let ang = Math.PI * 0.5 + rng.range(-0.22, 0.22);

      if (isHead) {
        const inBonnetBack = fig.bonnet && (headRelY > 0.22 || (fig.faceDir > 0 && uRel < -0.10) || (fig.faceDir < 0 && uRel > 0.10) || fig.faceDir === 0);
        const inCap = fig.cap && headRelY > 0.28;
        if (inBonnetBack) {
          // Curved white/cream Dutch peasant linen bonnet catching warm amber lamplight
          cA = shadeHex(mixHex(BONNET_CREAM, POTATO_GOLD, fig.faceDir === 0 ? 0.20 : 0.38), rng.range(0.86, 1.14));
          cB = EARTH_OCHRE;
          em = fig.faceDir === 0 ? 0.18 : 0.36;
          ang = Math.atan2(headRelY, uRel) + Math.PI * 0.5 + rng.range(-0.2, 0.2);
        } else if (inCap) {
          cA = PEAT_DARK;
          cB = EARTH_OCHRE;
          ang = rng.range(-0.25, 0.25);
        } else if (lampSide) {
          // Sculpted peasant cheekbones, brow ridge, nose & jaw in warm chiaroscuro
          const isEyeOrShadow = Math.abs(headRelY - 0.12) < 0.16 && Math.abs(uRel - 0.35 * fig.faceDir) < 0.22;
          cA = isEyeOrShadow
            ? PEAT_UMBER
            : shadeHex(mixHex(EARTH_OCHRE, POTATO_GOLD, rng.range(0.35, 0.82)), rng.range(0.88, 1.15));
          cB = PEAT_UMBER;
          em = isEyeOrShadow ? 0.08 : 0.44;
          ang = Math.PI * 0.5 + 0.35 * headRelY * fig.faceDir + rng.range(-0.2, 0.2);
        } else {
          cA = shadeHex(mixHex(PEAT_UMBER, EARTH_OCHRE, 0.35), rng.range(0.85, 1.10));
          cB = PEAT_DARK;
          em = 0.14;
        }
      } else {
        // Draped coarse wool & linen garments with shoulder fold directions
        cA = shadeHex(mixHex(PEAT_DARK, COAL_OLIVE, rng.range(0.2, 0.78)), rng.range(0.85, 1.15));
        cB = lampSide ? EARTH_OCHRE : PEAT_UMBER;
        em = lampSide && fig.faceDir !== 0 ? 0.16 : 0.06;
        ang = Math.PI * 0.5 - 0.38 * uRel + rng.range(-0.18, 0.18);
      }

      tDir.set(Math.cos(ang), Math.sin(ang), 0).normalize();
      emitSurfaceStroke(
        sink, POTATO_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.013, 0.025), rng.range(0.0044, 0.0085),
        tDir, nFront, cA, cB, rng,
        { flags: Math.abs(uRel) > 0.80 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: em },
      );
    }

    // B. Outstretched forearm & gnarled working hand ("those very hands they put in the dish")
    if (fig.faceDir !== 0) {
      const shoulderU = fig.u0 + fig.faceDir * 0.035;
      const shoulderV = fig.v0 + (fig.v1 - fig.v0) * 0.46;
      for (let j = 0; j < 420; j++) {
        const s = rng.next(); // 0 = shoulder/elbow, 1 = gnarled hand over platter/cup
        const uP = shoulderU + (fig.reachU - shoulderU) * s + rng.range(-0.014, 0.014);
        const v = shoulderV + (fig.reachV - shoulderV) * s - 0.025 * Math.sin(s * Math.PI) + rng.range(-0.012, 0.012);
        const d = fig.d - 8 * s + rng.range(-5, 5);
        const isHand = s > 0.72;
        const cA = isHand
          ? shadeHex(mixHex(EARTH_OCHRE, POTATO_GOLD, rng.range(0.35, 0.80)), rng.range(0.90, 1.14))
          : shadeHex(mixHex(PEAT_UMBER, COAL_OLIVE, 0.5), rng.range(0.88, 1.12));
        const cB = isHand ? PEAT_UMBER : EARTH_OCHRE;
        const armAng = Math.atan2(fig.reachV - shoulderV, (fig.reachU - shoulderU) * POTATO_ASPECT) + rng.range(-0.18, 0.18);
        tDir.set(Math.cos(armAng), Math.sin(armAng), 0).normalize();
        emitSurfaceStroke(
          sink, POTATO_ASPECT, StrokeClass.HOUSE, uP, v, d,
          isHand ? 0.014 : 0.020, isHand ? 0.0045 : 0.0065,
          tDir, nFront, cA, cB, rng,
          { flags: StrokeFlag.OUTLINE, emissive: isHand ? 0.46 : 0.15 },
        );
      }
    }
  }
}

function buildPotatoUnderlays(mat: UnderlayMaterialFactory): Group {
  const g = new Group();
  g.name = 'underlays:potato';
  g.add(buildCanvasQuadMesh(
    POTATO_ASPECT,
    [[-0.04, 0.0, 160], [1.04, 0.0, 160], [0.96, 0.68, 550], [0.04, 0.68, 550]],
    mat,
    0x18130e,
    'potato-cottage',
  ));
  return g;
}

export function generatePotatoChapter(
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

  time('cottage', () => genCottageEnvelope(sink, forkRng(seed, 'potato:cottage')));
  time('table', () => genTableAndEarthFloor(sink, forkRng(seed, 'potato:table')));
  time('figures', () => genPeasantFigures(sink, forkRng(seed, 'potato:figures')));

  const underlays = buildPotatoUnderlays(mat);
  const steepleTip = canvasToWorld(uFromPaint(0.50, POTATO_ASPECT), 0.78, 470);
  const village: VillageInfo = {
    houses: [],
    steepleBase: canvasToWorld(uFromPaint(0.50, POTATO_ASPECT), 0.32, 480),
    steepleTip,
  };
  return { underlays, village, timings };
}
