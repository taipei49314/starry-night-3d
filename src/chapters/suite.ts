// Multi-Punctum Suite Registry: defines the 4 Provençal Van Gogh chapters
// (I. Café Terrace -> II. Rhône -> III. Starry Night -> IV. Wheat Field),
// their analytic 3D camera tracks (ChapterTrack), and their procedural world generators.
import { Group, Vector3 } from 'three';
import {
  CANVAS_ASPECT, LOOP_SECONDS, MOON_DEF, PALETTE,
  type QualitySettings, type SharedUniforms, type StrokeSink, type UnderlayMaterialFactory, type VillageInfo,
} from '../contracts';
import { canvasToWorld, EYE, FORWARD } from '../shared/canvasSpace';
import { dollyZoomFov, ease, hermite } from '../camera/paths';
import {
  SHOT_STARTS, SHOTS, Timeline, timelineEnv, type CamPose, type EnvSample, type ShotDef,
} from '../camera/shots';
import { forkRng } from '../shared/rng';
import { generateSky } from '../sky/skyGen';
import { generateStars } from '../celestial/starsGen';
import { generateMoon } from '../celestial/moonGen';
import { createCypressCore, generateCypress } from '../earth/cypressGen';
import { generateGround } from '../earth/terrain';
import { generateHills } from '../earth/hillsGen';
import { createLandUnderlays, generateVillage } from '../earth/villageGen';
import { CAFE_ASPECT, generateCafeChapter } from './cafeGen';
import { RHONE_ASPECT, generateRhoneChapter } from './rhoneGen';
import { WHEAT_ASPECT, generateWheatChapter } from './wheatGen';
import { clamp, clamp01, smoothstep, uFromPaint, type PaintingId } from './types';

export interface ChapterTrack {
  readonly loopSeconds: number;
  readonly aspect: number;
  readonly shots: readonly ShotDef[];
  readonly shotStarts: readonly number[];
  pose(t: number, out: CamPose): CamPose;
  position(t: number, out: Vector3): Vector3;
  velocity(t: number, out: Vector3): Vector3;
  env(t: number, camDistFromE: number, calm: boolean, out: EnvSample): EnvSample;
}

export interface PaintingSpec {
  id: PaintingId;
  roman: string;
  titleZh: string;
  titleEn: string;
  placeZh: string;
  year: string;
  aspect: number;
  skyMode: number;
  fogNearHex: number;
  fogFarHex: number;
  moonUVD: readonly [number, number, number];
  track: ChapterTrack;
  generate(
    sink: StrokeSink,
    seed: number,
    mat: UnderlayMaterialFactory,
    u: SharedUniforms,
    q: QualitySettings,
  ): { underlays: Group; village: VillageInfo; timings: Record<string, number> };
}

function pt(aspect: number, uP: number, v: number, d: number): Vector3 {
  return canvasToWorld(uFromPaint(uP, aspect), v, d);
}

interface Waypoint {
  t: number;
  pos: Vector3;
  lookAt: Vector3;
  fov: number;
  roll: number;
}

const _p0 = new Vector3();
const _p1 = new Vector3();
const _m0 = new Vector3();
const _m1 = new Vector3();
const _look = new Vector3();
const H0 = EYE.clone().addScaledVector(FORWARD, 360);
const E_TARGET = EYE.clone().addScaledVector(FORWARD, 1000);

/**
 * Analytic C1 Catmull-Rom + Homecoming track for a 48-second companion painting chapter:
 *  - Shot 1 (0..6 s): Locked at EYE in the painting's matte frame.
 *  - Shots 2..4 (6..40 s): Smooth C1 spline through the painting's 3D landmarks, ending at H0 = E + 360 F.
 *  - Shot 5 (40..48 s): Reverse dolly-zoom homecoming H0 -> E along F; storm snaps into registration at t = 40 s.
 */
class CompanionTrack implements ChapterTrack {
  readonly loopSeconds = 48;
  readonly shotStarts: readonly number[];
  constructor(
    readonly aspect: number,
    readonly shots: readonly ShotDef[],
    private readonly waypoints: readonly Waypoint[],
    private readonly baseBloom = 0.5,
  ) {
    this.shotStarts = shots.map((s) => s.t0);
  }

  position(t: number, out: Vector3): Vector3 {
    const tc = clamp(t, 0, this.loopSeconds);
    if (tc <= 6) return out.copy(EYE);
    if (tc >= 40) {
      const s = tc >= 47.5 ? 0 : 360 * (1 - ease.inOutCubic((tc - 40) / 7.5));
      return out.copy(EYE).addScaledVector(FORWARD, s);
    }
    this.evalSplinePos(tc, out);
    return out;
  }

  pose(t: number, out: CamPose): CamPose {
    const tc = clamp(t, 0, this.loopSeconds);
    if (tc <= 6) {
      out.p.copy(EYE);
      out.d.copy(FORWARD);
      out.roll = 0;
      out.fov = 36;
      return out;
    }
    if (tc >= 40) {
      const s = tc >= 47.5 ? 0 : 360 * (1 - ease.inOutCubic((tc - 40) / 7.5));
      out.p.copy(EYE).addScaledVector(FORWARD, s);
      out.d.copy(FORWARD);
      out.roll = 0;
      out.fov = s === 0 ? 36 : dollyZoomFov(36, 675, 675 - s);
      return out;
    }
    this.evalSplinePose(tc, out);
    return out;
  }

  velocity(t: number, out: Vector3): Vector3 {
    const h = 1e-3;
    const t0 = Math.max(0, t - h);
    const t1 = Math.min(this.loopSeconds, t + h);
    this.position(t0, _p0);
    this.position(t1, _p1);
    return out.subVectors(_p1, _p0).divideScalar(Math.max(1e-6, t1 - t0));
  }

  env(t: number, camDistFromE: number, calm: boolean, out: EnvSample): EnvSample {
    const tc = clamp(t, 0, this.loopSeconds);
    // Matte: 1 over 0..6 s, opens 6..8 s, closes 45..47.5 s
    out.matte = tc <= 6 ? 1 : tc < 8 ? 1 - ease.inOutCubic((tc - 6) / 2) : tc < 45 ? 0 : tc < 47.5 ? ease.inOutCubic((tc - 45) / 2.5) : 1;
    // Storm: wakes 33..35.5 s, holds 1 until 40.5 s so the snap ripple fires as |C-E| crosses 360 m at t = 40.0 s!
    out.storm = tc < 33 ? 0 : tc < 35.5 ? smoothstep(33, 35.5, tc) : tc < 40.5 ? 1 : tc < 41.2 ? 1 - smoothstep(40.5, 41.2, tc) : 0;
    // Bloom & pulse on snap
    let bloom = this.baseBloom + 0.35 * smoothstep(8, 28, tc) * (1 - smoothstep(38, 41, tc));
    if (tc > 40.4 && tc < 40.9) bloom += 0.38 * Math.sin((Math.PI * (tc - 40.4)) / 0.5);
    out.bloom = bloom;
    out.exposure = 1.0;
    out.smear = calm ? 0 : 0.35 * smoothstep(10, 22, tc) * (1 - smoothstep(38, 41, tc));
    out.dust = tc < 6 ? 0 : tc < 11 ? smoothstep(6, 11, tc) : tc > 40 ? 0.3 * smoothstep(0.5, 40, camDistFromE) : 0.85;
    out.galleryLightDeg = tc < 2 ? -15 : tc < 6 ? -15 + 30 * ease.inOutSine((tc - 2) / 4) : tc < 44 ? 15 : 15 - 30 * ease.inOutSine((tc - 44) / 4);
    out.impastoGain = 1;
    out.fade = 0;
    return out;
  }

  private findSeg(t: number): { i: number; s: number } {
    const W = this.waypoints;
    for (let i = 0; i < W.length - 1; i++) {
      if (t <= W[i + 1].t || i === W.length - 2) {
        const span = Math.max(1e-6, W[i + 1].t - W[i].t);
        return { i, s: clamp01((t - W[i].t) / span) };
      }
    }
    return { i: W.length - 2, s: 1 };
  }

  private evalSplinePos(t: number, out: Vector3): void {
    const W = this.waypoints;
    const { i, s } = this.findSeg(t);
    const w0 = W[Math.max(0, i - 1)];
    const w1 = W[i];
    const w2 = W[i + 1];
    const w3 = W[Math.min(W.length - 1, i + 2)];
    const dt = w2.t - w1.t;
    _m0.subVectors(w2.pos, w0.pos).multiplyScalar(dt / Math.max(1e-3, w2.t - w0.t));
    _m1.subVectors(w3.pos, w1.pos).multiplyScalar(dt / Math.max(1e-3, w3.t - w1.t));
    if (i === 0) _m0.set(0, 0, 0);
    if (i === W.length - 2) _m1.copy(FORWARD).multiplyScalar(-80 * dt);
    hermite(w1.pos, _m0, w2.pos, _m1, ease.smootherstep(s), out);
  }

  private evalSplinePose(t: number, out: CamPose): void {
    this.evalSplinePos(t, out.p);
    const W = this.waypoints;
    const { i, s } = this.findSeg(t);
    const w1 = W[i];
    const w2 = W[i + 1];
    const es = ease.inOutSine(s);
    _look.copy(w1.lookAt).lerp(w2.lookAt, es);
    out.d.subVectors(_look, out.p).normalize();
    // Smoothly align view direction to FORWARD over the last 3.5 s before H0 (t = 36.5..40 s)
    if (t > 36.5) {
      const k = ease.inOutSine((t - 36.5) / 3.5);
      out.d.lerp(FORWARD, k).normalize();
    }
    out.roll = w1.roll + (w2.roll - w1.roll) * es;
    out.fov = w1.fov + (w2.fov - w1.fov) * es;
  }
}

const CAFE_TRACK = new CompanionTrack(
  CAFE_ASPECT,
  [
    { index: 0, name: 'The Forum Canvas', t0: 0, t1: 6, setPiece: 'gaslit portrait canvas at Place du Forum' },
    { index: 1, name: 'Under the Golden Awning', t0: 6, t1: 16, setPiece: 'glide past the bistro tables and blazing gas lantern' },
    { index: 2, name: 'Rue du Palais Canyon', t0: 16, t1: 27, setPiece: 'down the cobblestone corridor between blue facades' },
    { index: 3, name: 'Ascent to the Arles Stars', t0: 27, t1: 40, setPiece: 'climb through the pine branches into the starry sky canyon' },
    { index: 4, name: 'Return to Place du Forum', t0: 40, t1: 48, setPiece: 'storm snap ripple back onto the portrait canvas' },
  ],
  [
    { t: 6,  pos: EYE.clone(),                       lookAt: E_TARGET.clone(),                       fov: 36, roll: 0 },
    { t: 11, pos: pt(CAFE_ASPECT, 0.24, 0.28, 175),  lookAt: pt(CAFE_ASPECT, 0.22, 0.50, 460),       fov: 45, roll: -3 },
    { t: 16, pos: pt(CAFE_ASPECT, 0.36, 0.24, 310),  lookAt: pt(CAFE_ASPECT, 0.48, 0.30, 680),       fov: 48, roll: -1.5 },
    { t: 22, pos: pt(CAFE_ASPECT, 0.48, 0.28, 490),  lookAt: pt(CAFE_ASPECT, 0.51, 0.40, 740),       fov: 50, roll: 2.5 },
    { t: 27, pos: pt(CAFE_ASPECT, 0.52, 0.44, 720),  lookAt: pt(CAFE_ASPECT, 0.53, 0.72, 4800),      fov: 54, roll: 1.5 },
    { t: 34, pos: pt(CAFE_ASPECT, 0.53, 0.74, 4600), lookAt: pt(CAFE_ASPECT, 0.54, 0.86, 13200),     fov: 58, roll: -3 },
    { t: 40, pos: H0.clone(),                        lookAt: E_TARGET.clone(),                       fov: dollyZoomFov(36, 675, 315), roll: 0 },
  ],
  0.52,
);

const RHONE_TRACK = new CompanionTrack(
  RHONE_ASPECT,
  [
    { index: 0, name: 'Trinquetaille Shore', t0: 0, t1: 6, setPiece: 'nocturne over the Rhône and the Big Dipper' },
    { index: 1, name: 'Lovers & Moored Boats', t0: 6, t1: 16, setPiece: 'swoop over the wet sandy bank and wooden rowboats' },
    { index: 2, name: 'Pillars of Golden Gaslight', t0: 16, t1: 27, setPiece: 'skim across the shimmering gaslight reflection columns' },
    { index: 3, name: 'The Great Bear (Ursa Major)', t0: 27, t1: 40, setPiece: 'soar into the seven haloed stars of the Plough' },
    { index: 4, name: 'Rhône Nocturne Homecoming', t0: 40, t1: 48, setPiece: 'storm snap ripple back onto the shoreline canvas' },
  ],
  [
    { t: 6,  pos: EYE.clone(),                        lookAt: E_TARGET.clone(),                        fov: 36, roll: 0 },
    { t: 11, pos: pt(RHONE_ASPECT, 0.72, 0.14, 155),  lookAt: pt(RHONE_ASPECT, 0.72, 0.16, 320),       fov: 44, roll: 2.5 },
    { t: 16, pos: pt(RHONE_ASPECT, 0.58, 0.20, 340),  lookAt: pt(RHONE_ASPECT, 0.46, 0.34, 1300),      fov: 48, roll: 1.5 },
    { t: 22, pos: pt(RHONE_ASPECT, 0.38, 0.28, 720),  lookAt: pt(RHONE_ASPECT, 0.48, 0.42, 2300),      fov: 52, roll: -2.5 },
    { t: 27, pos: pt(RHONE_ASPECT, 0.54, 0.36, 1550), lookAt: pt(RHONE_ASPECT, 0.54, 0.68, 9500),      fov: 54, roll: -1.5 },
    { t: 34, pos: pt(RHONE_ASPECT, 0.48, 0.70, 6200), lookAt: pt(RHONE_ASPECT, 0.56, 0.74, 12800),     fov: 58, roll: 3 },
    { t: 40, pos: H0.clone(),                         lookAt: E_TARGET.clone(),                        fov: dollyZoomFov(36, 675, 315), roll: 0 },
  ],
  0.50,
);

const WHEAT_TRACK = new CompanionTrack(
  WHEAT_ASPECT,
  [
    { index: 0, name: 'Saint-Rémy Sunlit Canvas', t0: 0, t1: 6, setPiece: 'golden wheat, twin cypresses and cumulus spirals' },
    { index: 1, name: 'Sea of Golden Wheat', t0: 6, t1: 16, setPiece: 'sweep low across the wind-rippled wheat and wildflowers' },
    { index: 2, name: 'The Twin Mistral Cypresses', t0: 16, t1: 27, setPiece: 'orbit the right-hand emerald cypress obelisks and olive bushes' },
    { index: 3, name: 'Alpilles & Cumulus Vortices', t0: 27, t1: 40, setPiece: 'vault over the blue hills into the white cloud funnels' },
    { index: 4, name: 'Mistral Storm & Return', t0: 40, t1: 48, setPiece: 'storm snap ripple back into the sunlit Saint-Rémy frame' },
  ],
  [
    { t: 6,  pos: EYE.clone(),                         lookAt: E_TARGET.clone(),                         fov: 36, roll: 0 },
    { t: 11, pos: pt(WHEAT_ASPECT, 0.28, 0.12, 175),   lookAt: pt(WHEAT_ASPECT, 0.52, 0.20, 460),        fov: 46, roll: -2.5 },
    { t: 16, pos: pt(WHEAT_ASPECT, 0.58, 0.22, 310),   lookAt: pt(WHEAT_ASPECT, 0.78, 0.42, 200),        fov: 50, roll: -1.5 },
    { t: 22, pos: pt(WHEAT_ASPECT, 0.68, 0.48, 175),   lookAt: pt(WHEAT_ASPECT, 0.46, 0.34, 1600),       fov: 52, roll: 3 },
    { t: 27, pos: pt(WHEAT_ASPECT, 0.46, 0.42, 1600),  lookAt: pt(WHEAT_ASPECT, 0.42, 0.56, 18000),      fov: 54, roll: 1.5 },
    { t: 34, pos: pt(WHEAT_ASPECT, 0.46, 0.62, 16500), lookAt: pt(WHEAT_ASPECT, 0.48, 0.64, 42000),      fov: 58, roll: -3 },
    { t: 40, pos: H0.clone(),                          lookAt: E_TARGET.clone(),                         fov: dollyZoomFov(36, 675, 315), roll: 0 },
  ],
  0.38,
);

const starryTimeline = new Timeline();
export const STARRY_TRACK: ChapterTrack = {
  loopSeconds: LOOP_SECONDS,
  aspect: CANVAS_ASPECT,
  shots: SHOTS,
  shotStarts: SHOT_STARTS,
  pose: (t, out) => starryTimeline.pose(t, out),
  position: (t, out) => starryTimeline.position(t, out),
  velocity: (t, out) => starryTimeline.velocity(t, out),
  env: (t, dist, calm, out) => timelineEnv(t, dist, calm, out),
};

function generateStarryChapter(
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
  time('sky', () => generateSky(sink, forkRng(seed, 'sky')));
  time('stars', () => generateStars(sink, forkRng(seed, 'stars')));
  time('moon', () => generateMoon(sink, forkRng(seed, 'moon')));
  time('cypress', () => generateCypress(sink, forkRng(seed, 'cypress')));
  time('ground', () => generateGround(sink, forkRng(seed, 'ground')));
  time('hills', () => generateHills(sink, forkRng(seed, 'hills')));
  const village = time('village', () => generateVillage(sink, forkRng(seed, 'village')));
  const underlays = new Group();
  underlays.name = 'underlays';
  underlays.add(createLandUnderlays(mat, village));
  underlays.add(createCypressCore(mat(0x0f1712)));
  return { underlays, village, timings };
}

export const PAINTING_SUITE: readonly PaintingSpec[] = [
  {
    id: 'cafe',
    roman: 'I',
    titleZh: '夜間露天咖啡座',
    titleEn: 'Café Terrace at Night',
    placeZh: '亞爾 · 論壇廣場',
    year: '1888.09',
    aspect: CAFE_ASPECT,
    skyMode: 1,
    fogNearHex: 0x162458,
    fogFarHex: 0x0b1634,
    moonUVD: [uFromPaint(0.20, CAFE_ASPECT), 0.60, 460],
    track: CAFE_TRACK,
    generate: generateCafeChapter,
  },
  {
    id: 'rhone',
    roman: 'II',
    titleZh: '隆河上的星夜',
    titleEn: 'Starry Night Over the Rhône',
    placeZh: '亞爾 · 隆河河畔',
    year: '1888.09',
    aspect: RHONE_ASPECT,
    skyMode: 2,
    fogNearHex: 0x122b52,
    fogFarHex: 0x091730,
    moonUVD: [uFromPaint(0.68, RHONE_ASPECT), 0.75, 12100],
    track: RHONE_TRACK,
    generate: generateRhoneChapter,
  },
  {
    id: 'starry',
    roman: 'III',
    titleZh: '星夜',
    titleEn: 'The Starry Night',
    placeZh: '聖雷米 · 聖保羅療養院',
    year: '1889.06',
    aspect: CANVAS_ASPECT,
    skyMode: 0,
    fogNearHex: 0x0e1837,
    fogFarHex: PALETTE.prussian,
    moonUVD: [MOON_DEF.u, MOON_DEF.v, MOON_DEF.d],
    track: STARRY_TRACK,
    generate: generateStarryChapter,
  },
  {
    id: 'wheat',
    roman: 'IV',
    titleZh: '有絲柏的麥田',
    titleEn: 'Wheat Field with Cypresses',
    placeZh: '聖雷米 · 阿爾皮耶山麓',
    year: '1889.07',
    aspect: WHEAT_ASPECT,
    skyMode: 3,
    fogNearHex: 0x4b7fa2,
    fogFarHex: 0x7aa6b8,
    moonUVD: [uFromPaint(0.82, WHEAT_ASPECT), 0.86, 14000],
    track: WHEAT_TRACK,
    generate: generateWheatChapter,
  },
];

export function getPaintingSpec(id: PaintingId): PaintingSpec {
  return PAINTING_SUITE.find((p) => p.id === id) ?? PAINTING_SUITE[2];
}

export function nextPaintingId(id: PaintingId, dir: 1 | -1 = 1): PaintingId {
  const idx = PAINTING_SUITE.findIndex((p) => p.id === id);
  const next = (idx + dir + PAINTING_SUITE.length) % PAINTING_SUITE.length;
  return PAINTING_SUITE[next].id;
}
