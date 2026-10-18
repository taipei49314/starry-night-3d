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

/** 2. Earthen cottage floor, wooden table, steaming potato platter & oil lamp frame. */
function genTableAndEarthFloor(sink: StrokeSink, rng: Rng): void {
  const nUp = new Vector3(0, 1, 0.15).normalize();
  const nFront = new Vector3(0, 0, 1);
  const tHoriz = new Vector3(1, 0, 0);
  const tVert = new Vector3(0, 1, 0);

  // Dark beaten-earth floor in the foreground (GROUND [155..520 m])
  for (let i = 0; i < 14000; i++) {
    const uP = rng.range(-0.04, 1.04);
    const t = Math.pow(rng.next(), 1.15);
    const v = 0.002 + 0.34 * t;
    const d = clamp(156 + 340 * t + rng.range(-6, 6), 154, 510);
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

  // Central wooden table (uP = 0.28..0.72, v = 0.22..0.38, d = 290..375 m, HOUSE class)
  for (let i = 0; i < 6500; i++) {
    const uP = rng.range(0.28, 0.72);
    const v = rng.range(0.22, 0.38);
    const d = rng.range(455, 535);
    const distPlatter = Math.hypot((uP - 0.47) * POTATO_ASPECT, (v - 0.33) * 1.8);
    const isPotato = distPlatter < 0.11;
    const cA = isPotato
      ? shadeHex(mixHex(POTATO_GOLD, LAMP_AMBER, rng.range(0.25, 0.75)), rng.range(0.90, 1.14))
      : shadeHex(mixHex(PEAT_UMBER, EARTH_OCHRE, rng.range(0.3, 0.75)), rng.range(0.88, 1.12));
    const cB = isPotato ? P.lemon : PEAT_DARK;
    emitSurfaceStroke(
      sink, POTATO_ASPECT, StrokeClass.HOUSE, uP, v, d,
      rng.range(0.013, 0.026), rng.range(0.0045, 0.0085),
      tHoriz, nUp, cA, cB, rng,
      { emissive: isPotato ? 0.55 : 0.22 },
    );
  }

  // Rising steam wisps above the potato platter + hanging brass oil lamp body (WINDOW class [455..560 m])
  for (let i = 0; i < 1600; i++) {
    const isLamp = i < 950;
    const uP = isLamp ? 0.50 + rng.range(-0.035, 0.035) : 0.47 + rng.range(-0.06, 0.06);
    const v = isLamp ? rng.range(0.72, 0.86) : rng.range(0.35, 0.52);
    const d = isLamp ? rng.range(460, 495) : rng.range(465, 515);
    const cA = isLamp ? LAMP_AMBER : mixHex(BONNET_CREAM, EARTH_OCHRE, 0.5);
    const cB = isLamp ? P.lemon : PEAT_UMBER;
    emitSurfaceStroke(
      sink, POTATO_ASPECT, StrokeClass.WINDOW, uP, v, d,
      rng.range(0.011, 0.022), rng.range(0.0038, 0.0068),
      tVert, nFront, cA, cB, rng,
      { emissive: isLamp ? 3.4 : 0.45 },
    );
  }
}

/** 3. The Five Peasant Figures gathered around the table in sculptural chiaroscuro. */
function genPeasantFigures(sink: StrokeSink, rng: Rng): void {
  const nFront = new Vector3(0, 0, 1);
  const tVert = new Vector3(0, 1, 0);

  // Five figures around the table: [left-profile man, back-left man, center-foreground woman (back), back-right woman, right woman]
  const figures = [
    { u0: 0.16, v0: 0.14, v1: 0.64, w: 0.085, d: 475, faceDir: 1, bonnet: false },
    { u0: 0.34, v0: 0.36, v1: 0.68, w: 0.070, d: 545, faceDir: 1, bonnet: false },
    { u0: 0.50, v0: 0.06, v1: 0.54, w: 0.095, d: 455, faceDir: 0, bonnet: true },
    { u0: 0.65, v0: 0.36, v1: 0.68, w: 0.075, d: 540, faceDir: -1, bonnet: true },
    { u0: 0.81, v0: 0.14, v1: 0.64, w: 0.085, d: 480, faceDir: -1, bonnet: true },
  ];

  for (const fig of figures) {
    for (let i = 0; i < 3200; i++) {
      const tH = rng.next(); // 0 = lower coat/skirt, 1 = head/bonnet
      const v = fig.v0 + (fig.v1 - fig.v0) * tH;
      const widthAtV = tH > 0.72 ? fig.w * 0.58 : fig.w * (1 - 0.18 * tH);
      const uRel = rng.range(-1, 1);
      const uP = fig.u0 + uRel * widthAtV;
      const d = fig.d + rng.range(-10, 10);

      // Lamp-facing side of the figure catches warm ochre-gold chiaroscuro light!
      const lampSide = fig.u0 < 0.50 ? uRel > 0.15 : fig.u0 > 0.50 ? uRel < -0.15 : tH > 0.76;
      const isHead = tH > 0.72;
      let cA: number, cB: number, em = 0.08;

      if (isHead && fig.bonnet && (!lampSide || tH > 0.82)) {
        cA = shadeHex(mixHex(BONNET_CREAM, POTATO_GOLD, 0.35), rng.range(0.85, 1.12));
        cB = EARTH_OCHRE;
        em = 0.32;
      } else if (isHead && lampSide) {
        // Sculpted peasant cheekbones & gnarled hands in warm lamp light
        cA = shadeHex(mixHex(EARTH_OCHRE, POTATO_GOLD, rng.range(0.3, 0.75)), rng.range(0.88, 1.14));
        cB = PEAT_UMBER;
        em = 0.38;
      } else {
        // Dark coarse wool & linen garments
        cA = shadeHex(mixHex(PEAT_DARK, COAL_OLIVE, rng.range(0.2, 0.75)), rng.range(0.85, 1.15));
        cB = lampSide ? EARTH_OCHRE : PEAT_UMBER;
      }

      emitSurfaceStroke(
        sink, POTATO_ASPECT, StrokeClass.HOUSE, uP, v, d,
        rng.range(0.014, 0.028), rng.range(0.0048, 0.0092),
        tVert, nFront, cA, cB, rng,
        { flags: Math.abs(uRel) > 0.78 ? StrokeFlag.OUTLINE : StrokeFlag.NONE, emissive: em },
      );
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
