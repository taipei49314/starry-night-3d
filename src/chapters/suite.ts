// Multi-Punctum Suite & Van Gogh World System Registry (5 Grand Chapters, 30 Iconic Worlds, 1884–1890).
// The world order is ALL_PAINTING_IDS in ./types.ts (= the Odyssey sequence); chapters and years are CHAPTER_SPECS in
// ./worldGraph.ts. Each world's metadata, standalone track and Odyssey act are in PAINTING_SUITE below.
// Includes standalone tracks AND the Dynamic Path Compiler `compilePathTrack(sequence)` that weaves ANY
// sequence of worlds (Mode A Odyssey, Mode C Theme Paths, or custom chains) into a seamless one-take 3D journey.
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
import { POTATO_ASPECT, generatePotatoChapter } from './potatoGen';
import { SHOES_ASPECT, generateShoesChapter } from './shoesGen';
import { PARIS_ASPECT, generateParisChapter } from './parisGen';
import { SELFPORTRAIT_ASPECT, generateSelfPortraitChapter } from './selfPortraitGen';
import { SUNFLOWERS_ASPECT, generateSunflowersChapter } from './sunflowersGen';
import { CAFE_ASPECT, generateCafeChapter } from './cafeGen';
import { RHONE_ASPECT, generateRhoneChapter } from './rhoneGen';
import { BEDROOM_ASPECT, generateBedroomChapter } from './bedroomGen';
import { IRISES_ASPECT, generateIrisesChapter } from './irisesGen';
import { WHEAT_ASPECT, generateWheatChapter } from './wheatGen';
import { ALMOND_ASPECT, generateAlmondChapter } from './almondGen';
import { CHURCH_ASPECT, generateChurchChapter } from './churchGen';
import { GACHET_ASPECT, generateGachetChapter } from './gachetGen';
import { CROWS_ASPECT, generateCrowsChapter } from './crowsGen';
import {
  GALETTE_ASPECT, generateGaletteChapter,
  generatePlumChapter, generateSeineChapter,
  generateSkullChapter, generateTanguyChapter,
  generateTowerChapter, generateWeaverChapter,
  PLUM_ASPECT, SEINE_ASPECT, SKULL_ASPECT,
  TANGUY_ASPECT, TOWER_ASPECT, WEAVER_ASPECT,
} from './earlyParisExpandedGen';
import {
  generateHarvestChapter, generateNightCafeChapter,
  generateSowerChapter, generateYellowHouseChapter,
  HARVEST_ASPECT, NIGHTCAFE_ASPECT, SOWER_ASPECT, YELLOWHOUSE_ASPECT,
} from './arlesExpandedGen';
import {
  COTTAGES_ASPECT, DAUBIGNY_ASPECT,
  generateCottagesChapter, generateDaubignyChapter,
  generateOliveChapter, generateRoadCypressChapter,
  OLIVE_ASPECT, ROADCYPRESS_ASPECT,
} from './lateExpandedGen';
import { ALL_PAINTING_IDS, clamp, clamp01, shadeHex, smoothstep, uFromPaint, type ChapterId, type MotifId, type PaintingId } from './types';
import { resolveTransitionEdge } from './worldGraph';

export interface ChapterTrack {
  readonly loopSeconds: number;
  readonly aspect: number;
  readonly shots: readonly ShotDef[];
  readonly shotStarts: readonly number[];
  readonly actSeconds?: number;
  aspectAt?(t: number): number;
  pose(t: number, out: CamPose): CamPose;
  position(t: number, out: Vector3): Vector3;
  velocity(t: number, out: Vector3): Vector3;
  env(t: number, camDistFromE: number, calm: boolean, out: EnvSample): EnvSample;
}

export interface PaintingSpec {
  id: PaintingId;
  chapterId: ChapterId;
  roman: string;
  shortZh: string;
  titleZh: string;
  titleEn: string;
  placeZh: string;
  year: string;
  portalZh: string;
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
 * Analytic C1 Catmull-Rom + Homecoming track for a painting chapter:
 *  - Shot 1 (0..tHold): Locked at EYE in the painting's matte frame.
 *  - Shots 2..4 (tHold..tHome): Smooth C1 spline through the painting's 3D landmarks into its Spatial Portal, ending at H0 = E + 360 F.
 *  - Shot 5 (tHome..tHomeEnd): Reverse dolly-zoom homecoming H0 -> E along F, snapping into exact registration at E at tHomeEnd
 *    and holding the reassembled painting cleanly at E from tHomeEnd..loopSeconds before dissolving into the next act.
 */
class CompanionTrack implements ChapterTrack {
  readonly shotStarts: readonly number[];
  constructor(
    readonly aspect: number,
    readonly shots: readonly ShotDef[],
    private readonly waypoints: readonly Waypoint[],
    private readonly baseBloom = 0.5,
    readonly loopSeconds = 48,
    private readonly tHold = 6,
    private readonly tHome = 40,
    private readonly tHomeEnd = 46,
  ) {
    this.shotStarts = shots.map((s) => s.t0);
  }

  position(t: number, out: Vector3): Vector3 {
    const tc = clamp(t, 0, this.loopSeconds);
    if (tc <= this.tHold) return out.copy(EYE);
    if (tc >= this.tHome) {
      const span = Math.max(0.5, this.tHomeEnd - this.tHome);
      const s = tc >= this.tHomeEnd ? 0 : 360 * (1 - ease.inOutCubic((tc - this.tHome) / span));
      return out.copy(EYE).addScaledVector(FORWARD, s);
    }
    const wps = this.waypoints;
    let i = 0;
    while (i < wps.length - 2 && tc >= wps[i + 1].t) i++;
    const w0 = wps[Math.max(0, i - 1)];
    const w1 = wps[i];
    const w2 = wps[i + 1];
    const w3 = wps[Math.min(wps.length - 1, i + 2)];
    const dt = w2.t - w1.t;
    const u = clamp01((tc - w1.t) / Math.max(1e-5, dt));
    _m0.subVectors(w2.pos, w0.pos).multiplyScalar(0.5 * (dt / Math.max(1e-5, w2.t - w0.t)));
    _m1.subVectors(w3.pos, w1.pos).multiplyScalar(0.5 * (dt / Math.max(1e-5, w3.t - w1.t)));
    return hermite(w1.pos, _m0, w2.pos, _m1, u, out);
  }

  private sampleLook(tc: number, out: Vector3): Vector3 {
    const wps = this.waypoints;
    let i = 0;
    while (i < wps.length - 2 && tc >= wps[i + 1].t) i++;
    const w0 = wps[Math.max(0, i - 1)];
    const w1 = wps[i];
    const w2 = wps[i + 1];
    const w3 = wps[Math.min(wps.length - 1, i + 2)];
    const dt = w2.t - w1.t;
    const u = clamp01((tc - w1.t) / Math.max(1e-5, dt));
    _m0.subVectors(w2.lookAt, w0.lookAt).multiplyScalar(0.5 * (dt / Math.max(1e-5, w2.t - w0.t)));
    _m1.subVectors(w3.lookAt, w1.lookAt).multiplyScalar(0.5 * (dt / Math.max(1e-5, w3.t - w1.t)));
    return hermite(w1.lookAt, _m0, w2.lookAt, _m1, u, out);
  }

  pose(t: number, out: CamPose): CamPose {
    const tc = clamp(t, 0, this.loopSeconds);
    this.position(tc, out.p);
    if (tc <= this.tHold) {
      out.d.copy(FORWARD);
      out.fov = 36;
      out.roll = 0;
      return out;
    }
    if (tc >= this.tHome) {
      const span = Math.max(0.5, this.tHomeEnd - this.tHome);
      const s = tc >= this.tHomeEnd ? 0 : 360 * (1 - ease.inOutCubic((tc - this.tHome) / span));
      out.d.copy(FORWARD);
      out.fov = dollyZoomFov(36, 675, Math.max(0, 675 - s));
      out.roll = 0;
      return out;
    }
    const wps = this.waypoints;
    let i = 0;
    while (i < wps.length - 2 && tc >= wps[i + 1].t) i++;
    const w1 = wps[i];
    const w2 = wps[i + 1];
    const u = ease.inOutSine(clamp01((tc - w1.t) / Math.max(1e-5, w2.t - w1.t)));
    this.sampleLook(tc, _look);
    out.d.subVectors(_look, out.p);
    if (out.d.lengthSq() < 1e-9) out.d.copy(FORWARD);
    else out.d.normalize();
    out.fov = w1.fov + (w2.fov - w1.fov) * u;
    out.roll = w1.roll + (w2.roll - w1.roll) * u;
    return out;
  }

  velocity(t: number, out: Vector3): Vector3 {
    const dt = 0.02;
    const t0 = Math.max(0, t - dt);
    const t1 = Math.min(this.loopSeconds, t + dt);
    this.position(t0, _p0);
    this.position(t1, _p1);
    return out.subVectors(_p1, _p0).divideScalar(Math.max(1e-5, t1 - t0));
  }

  env(t: number, camDistFromE: number, calm: boolean, out: EnvSample): EnvSample {
    const tc = clamp(t, 0, this.loopSeconds);
    const stormStart = this.tHome - 2.2;
    const stormPeak = this.tHome + 0.6;
    const snapAt = this.tHomeEnd;
    out.matte = tc < this.tHold
      ? 1 - smoothstep(this.tHold - 0.8, this.tHold, tc)
      : tc > snapAt - 0.8
        ? smoothstep(snapAt - 0.8, snapAt, tc)
        : 0;
    out.impastoGain = 0.3 + 0.7 * smoothstep(2, 80, camDistFromE);
    out.galleryLightDeg = 32;
    out.exposure = 1;
    out.bloom = this.baseBloom + 0.18 * smoothstep(this.tHold + 4, this.tHome - 4, tc) * (1 - smoothstep(this.tHome - 2, snapAt, tc));
    const smPeak = calm ? 0.12 : 0.28;
    out.smear = smPeak * smoothstep(this.tHold + 1, this.tHold + 5, tc) * (1 - smoothstep(stormStart - 1.5, this.tHome, tc));
    out.storm = tc >= stormStart && tc < snapAt
      ? smoothstep(stormStart, stormPeak, tc) * (1 - smoothstep(stormPeak, snapAt - 0.15, tc))
      : 0;
    out.fade = 0;
    out.dust = 0.55 * smoothstep(5, 80, camDistFromE) * (1 - smoothstep(this.tHome + 0.5, snapAt, tc));
    return out;
  }
}

interface PortalWp {
  pos: Vector3;
  lookAt: Vector3;
  fov: number;
  roll: number;
}

function makeChapterTracks(
  aspect: number,
  actLabel: string,
  shotNames: [string, string, string, string],
  portalPts: [PortalWp, PortalWp, PortalWp, PortalWp, PortalWp],
  baseBloom = 0.5,
): { standalone: CompanionTrack; odysseyAct: CompanionTrack } {
  const standalone = new CompanionTrack(
    aspect,
    [
      { index: 0, name: shotNames[0], t0: 0,  t1: 6,  setPiece: 'locked at the painter’s eye' },
      { index: 1, name: shotNames[1], t0: 6,  t1: 18, setPiece: 'entering the 3D impasto world' },
      { index: 2, name: shotNames[2], t0: 18, t1: 31, setPiece: 'soaring through the heart of the canvas' },
      { index: 3, name: shotNames[3], t0: 31, t1: 40, setPiece: 'approaching the Spatial Portal' },
      { index: 4, name: '凝視歸位',   t0: 40, t1: 48, setPiece: 'reverse dolly-zoom back to the eye' },
    ],
    [
      { t: 6,  pos: EYE.clone(), lookAt: E_TARGET.clone(), fov: 36, roll: 0 },
      { t: 12, ...portalPts[0] },
      { t: 18, ...portalPts[1] },
      { t: 25, ...portalPts[2] },
      { t: 31, ...portalPts[3] },
      { t: 36, ...portalPts[4] },
      { t: 40, pos: H0.clone(),  lookAt: E_TARGET.clone(), fov: dollyZoomFov(36, 675, 315), roll: 0 },
    ],
    baseBloom,
    48,
    6,
    40,
    46,
  );

  // In multi-act Odyssey mode (30s per act):
  // - 0.0..1.6s: Initial lock at E after incoming dissolve
  // - 1.6..21.0s: Flight through the painting's 3D world to H0
  // - 21.0..25.0s: Reverse dolly-zoom homecoming H0 -> E, arriving at exact E at tau = 25.0s
  // - 25.0..26.8s: 1.8s unobstructed hold of the reassembled original painting at E
  // - 26.8..30.0s: 3D brushstroke cross-dissolve into the next painting
  const odysseyAct = new CompanionTrack(
    aspect,
    [
      { index: 0, name: `${actLabel} · ${shotNames[0]}`, t0: 0,    t1: 3.8,  setPiece: shotNames[0] },
      { index: 1, name: `${actLabel} · ${shotNames[1]}`, t0: 3.8,  t1: 11.2, setPiece: shotNames[1] },
      { index: 2, name: `${actLabel} · ${shotNames[2]}`, t0: 11.2, t1: 18.8, setPiece: shotNames[2] },
      { index: 3, name: `${actLabel} · ${shotNames[3]}`, t0: 18.8, t1: 30.0, setPiece: shotNames[3] },
    ],
    [
      { t: 1.6,  pos: EYE.clone(), lookAt: E_TARGET.clone(), fov: 36, roll: 0 },
      { t: 5.0,  ...portalPts[0] },
      { t: 8.6,  ...portalPts[1] },
      { t: 12.2, ...portalPts[2] },
      { t: 15.6, ...portalPts[3] },
      { t: 18.4, ...portalPts[4] },
      { t: 21.0, pos: H0.clone(),  lookAt: E_TARGET.clone(), fov: dollyZoomFov(36, 675, 315), roll: 0 },
    ],
    baseBloom,
    30,
    1.6,
    21.0,
    25.0,
  );

  return { standalone, odysseyAct };
}

// 1. Chapter I (Earth): The Potato Eaters -> Portal: Hanging Oil Lamp Flame -> A Pair of Shoes
const POTATO_TRACKS = makeChapterTracks(
  POTATO_ASPECT, 'Ch.I 食薯者',
  ['荷蘭農舍黑土畫幅', '粗陶木桌與熱氣馬鈴薯盤', '油燈明暗對比下的農夫臉龐', '飛入懸掛油燈火芯任意門 → 一雙舊鞋'],
  [
    { pos: pt(POTATO_ASPECT, 0.32, 0.24, 195), lookAt: pt(POTATO_ASPECT, 0.48, 0.34, 460),   fov: 42, roll: -1.5 },
    { pos: pt(POTATO_ASPECT, 0.44, 0.32, 260), lookAt: pt(POTATO_ASPECT, 0.65, 0.48, 510),   fov: 45, roll: 1.5 },
    { pos: pt(POTATO_ASPECT, 0.58, 0.40, 310), lookAt: pt(POTATO_ASPECT, 0.35, 0.52, 520),   fov: 46, roll: -1.5 },
    { pos: pt(POTATO_ASPECT, 0.48, 0.62, 360), lookAt: pt(POTATO_ASPECT, 0.50, 0.78, 480),   fov: 48, roll: 1.0 },
    { pos: pt(POTATO_ASPECT, 0.50, 0.76, 440), lookAt: pt(POTATO_ASPECT, 0.50, 0.78, 12200), fov: 52, roll: 0 },
  ],
  0.42,
);

// 2. Chapter II (Color): A Pair of Shoes -> Portal: Trailing Laces & Golden Threshold -> Le Moulin de la Galette
const SHOES_TRACKS = makeChapterTracks(
  SHOES_ASPECT, 'Ch.II 一雙舊鞋',
  ['巴黎畫室舊鞋靜物畫幅', '斑駁皮革皺褶與鐵釘鞋底', '蜿蜒鬆開的皮鞋帶小徑', '迎向金色門檻光束任意門 → 蒙馬特磨坊'],
  [
    { pos: pt(SHOES_ASPECT, 0.30, 0.16, 185), lookAt: pt(SHOES_ASPECT, 0.36, 0.38, 470),   fov: 42, roll: -1.5 },
    { pos: pt(SHOES_ASPECT, 0.44, 0.22, 265), lookAt: pt(SHOES_ASPECT, 0.62, 0.34, 485),   fov: 45, roll: 1.5 },
    { pos: pt(SHOES_ASPECT, 0.56, 0.28, 340), lookAt: pt(SHOES_ASPECT, 0.48, 0.38, 495),   fov: 47, roll: -1.2 },
    { pos: pt(SHOES_ASPECT, 0.58, 0.48, 410), lookAt: pt(SHOES_ASPECT, 0.62, 0.72, 650),   fov: 49, roll: 1.0 },
    { pos: pt(SHOES_ASPECT, 0.62, 0.68, 480), lookAt: pt(SHOES_ASPECT, 0.62, 0.72, 12600), fov: 52, roll: 0 },
  ],
  0.40,
);

// 3. Chapter II (Color): Boulevard de Clichy -> Portal: Sunlit Avenue Vanishing Point -> Self-Portrait
const PARIS_TRACKS = makeChapterTracks(
  PARIS_ASPECT, 'Ch.II 克利希大道',
  ['巴黎印象派點描畫幅', '粉藍珊瑚點描人行道與漫步市民', '奧斯曼公寓立面與行道春芽', '穿過大道晨光任意門 → 戴草帽的自畫像'],
  [
    { pos: pt(PARIS_ASPECT, 0.36, 0.16, 185), lookAt: pt(PARIS_ASPECT, 0.46, 0.34, 520),   fov: 45, roll: -2 },
    { pos: pt(PARIS_ASPECT, 0.52, 0.24, 310), lookAt: pt(PARIS_ASPECT, 0.38, 0.38, 680),   fov: 48, roll: 2 },
    { pos: pt(PARIS_ASPECT, 0.42, 0.32, 480), lookAt: pt(PARIS_ASPECT, 0.48, 0.44, 960),   fov: 50, roll: -2 },
    { pos: pt(PARIS_ASPECT, 0.46, 0.42, 740), lookAt: pt(PARIS_ASPECT, 0.46, 0.52, 2400),  fov: 52, roll: 1.5 },
    { pos: pt(PARIS_ASPECT, 0.46, 0.50, 1250), lookAt: pt(PARIS_ASPECT, 0.46, 0.56, 13200), fov: 55, roll: 0 },
  ],
  0.46,
);

// 4. Chapter II (Color): Self-Portrait with Straw Hat -> Portal: Emerald Gaze & Golden Brim -> Sunflowers
const SELFPORTRAIT_TRACKS = makeChapterTracks(
  SELFPORTRAIT_ASPECT, 'Ch.II 自畫像',
  ['巴黎自畫像直幅畫框', '鈷藍松石放射光環與金黃草帽', '火焰紅鬍鬚與立體輪廓筆觸', '飛入畫家翠綠瞳孔任意門 → 亞爾向日葵'],
  [
    { pos: pt(SELFPORTRAIT_ASPECT, 0.34, 0.22, 190), lookAt: pt(SELFPORTRAIT_ASPECT, 0.49, 0.45, 470),   fov: 42, roll: -1.8 },
    { pos: pt(SELFPORTRAIT_ASPECT, 0.62, 0.38, 275), lookAt: pt(SELFPORTRAIT_ASPECT, 0.48, 0.58, 480),   fov: 45, roll: 1.8 },
    { pos: pt(SELFPORTRAIT_ASPECT, 0.40, 0.66, 350), lookAt: pt(SELFPORTRAIT_ASPECT, 0.52, 0.62, 510),   fov: 47, roll: -1.5 },
    { pos: pt(SELFPORTRAIT_ASPECT, 0.48, 0.55, 410), lookAt: pt(SELFPORTRAIT_ASPECT, 0.49, 0.56, 465),   fov: 46, roll: 0.8 },
    { pos: pt(SELFPORTRAIT_ASPECT, 0.49, 0.56, 445), lookAt: pt(SELFPORTRAIT_ASPECT, 0.49, 0.56, 12400), fov: 52, roll: 0 },
  ],
  0.48,
);

// 5. Chapter III (Sun): Sunflowers -> Portal: Golden Crown Sunflower Disc -> Café Terrace
const SUNFLOWERS_TRACKS = makeChapterTracks(
  SUNFLOWERS_ASPECT, 'Ch.III 向日葵',
  ['亞爾黃色交響曲畫幅', 'Vincent 簽名雙色陶罐與翠綠花莖', '穿梭十五朵盛開金黃向日葵花海', '飛入中央向日葵花盤任意門 → 夜間咖啡座'],
  [
    { pos: pt(SUNFLOWERS_ASPECT, 0.34, 0.20, 185), lookAt: pt(SUNFLOWERS_ASPECT, 0.50, 0.32, 470),   fov: 43, roll: -2 },
    { pos: pt(SUNFLOWERS_ASPECT, 0.64, 0.42, 265), lookAt: pt(SUNFLOWERS_ASPECT, 0.46, 0.52, 465),   fov: 46, roll: 2 },
    { pos: pt(SUNFLOWERS_ASPECT, 0.32, 0.60, 340), lookAt: pt(SUNFLOWERS_ASPECT, 0.58, 0.66, 485),   fov: 48, roll: -1.8 },
    { pos: pt(SUNFLOWERS_ASPECT, 0.48, 0.68, 410), lookAt: pt(SUNFLOWERS_ASPECT, 0.50, 0.72, 475),   fov: 49, roll: 1.0 },
    { pos: pt(SUNFLOWERS_ASPECT, 0.50, 0.72, 448), lookAt: pt(SUNFLOWERS_ASPECT, 0.50, 0.72, 12600), fov: 53, roll: 0 },
  ],
  0.52,
);

// 6. Chapter III (Sun): Café Terrace at Night -> Portal: Rue du Palais Star Canyon -> Rhône
const CAFE_TRACKS = makeChapterTracks(
  CAFE_ASPECT, 'Ch.III 夜間咖啡座',
  ['論壇廣場畫幅', '煤氣燈金黃遮雨棚與圓桌', '鵝卵石長街與藍紫街屋', '穿過街尾星谷任意門 → 隆河星夜'],
  [
    { pos: pt(CAFE_ASPECT, 0.24, 0.28, 175),  lookAt: pt(CAFE_ASPECT, 0.22, 0.50, 460),   fov: 45, roll: -3 },
    { pos: pt(CAFE_ASPECT, 0.36, 0.24, 310),  lookAt: pt(CAFE_ASPECT, 0.48, 0.30, 680),   fov: 48, roll: -1.5 },
    { pos: pt(CAFE_ASPECT, 0.48, 0.28, 490),  lookAt: pt(CAFE_ASPECT, 0.51, 0.40, 740),   fov: 50, roll: 2.5 },
    { pos: pt(CAFE_ASPECT, 0.52, 0.44, 720),  lookAt: pt(CAFE_ASPECT, 0.53, 0.76, 4800),  fov: 54, roll: 1.5 },
    { pos: pt(CAFE_ASPECT, 0.53, 0.76, 4200), lookAt: pt(CAFE_ASPECT, 0.54, 0.88, 13200), fov: 58, roll: -2.5 },
  ],
  0.52,
);

// 7. Chapter III (Sun): Starry Night Over the Rhône -> Portal: Warm Golden Embankment Window -> Bedroom
const RHONE_TRACKS = makeChapterTracks(
  RHONE_ASPECT, 'Ch.III 隆河星夜',
  ['隆河河畔畫幅', '停泊木船與河岸戀人', '煤氣燈金色水波倒影柱與北斗七星', '飛入河岸暖黃窗燈任意門 → 亞爾臥室'],
  [
    { pos: pt(RHONE_ASPECT, 0.72, 0.14, 155),  lookAt: pt(RHONE_ASPECT, 0.72, 0.16, 320),   fov: 44, roll: 2.5 },
    { pos: pt(RHONE_ASPECT, 0.58, 0.20, 340),  lookAt: pt(RHONE_ASPECT, 0.46, 0.34, 1300),  fov: 48, roll: 1.5 },
    { pos: pt(RHONE_ASPECT, 0.38, 0.28, 720),  lookAt: pt(RHONE_ASPECT, 0.48, 0.72, 9500),  fov: 52, roll: -2.5 },
    { pos: pt(RHONE_ASPECT, 0.48, 0.62, 4200), lookAt: pt(RHONE_ASPECT, 0.54, 0.41, 2150),  fov: 54, roll: -1.5 },
    { pos: pt(RHONE_ASPECT, 0.54, 0.41, 1450), lookAt: pt(RHONE_ASPECT, 0.54, 0.41, 2200),  fov: 46, roll: 1.5 },
  ],
  0.50,
);

// 8. Chapter III (Sun): The Bedroom in Arles -> Portal: Half-Open Green Shuttered Window -> Starry Night
const BEDROOM_TRACKS = makeChapterTracks(
  BEDROOM_ASPECT, 'Ch.III 亞爾的臥室',
  ['黃色小屋臥室畫幅', '暖赭木地板與黃色藤椅', '鮮紅被單木床與牆上肖像畫', '推開綠色百葉窗任意門 → 聖雷米星夜'],
  [
    { pos: pt(BEDROOM_ASPECT, 0.22, 0.22, 185), lookAt: pt(BEDROOM_ASPECT, 0.68, 0.32, 340), fov: 45, roll: -2 },
    { pos: pt(BEDROOM_ASPECT, 0.62, 0.28, 235), lookAt: pt(BEDROOM_ASPECT, 0.74, 0.48, 460), fov: 48, roll: 2 },
    { pos: pt(BEDROOM_ASPECT, 0.54, 0.44, 340), lookAt: pt(BEDROOM_ASPECT, 0.36, 0.54, 510), fov: 50, roll: -1.5 },
    { pos: pt(BEDROOM_ASPECT, 0.40, 0.58, 430), lookAt: pt(BEDROOM_ASPECT, 0.40, 0.65, 540), fov: 46, roll: 0.8 },
    { pos: pt(BEDROOM_ASPECT, 0.40, 0.65, 505), lookAt: pt(BEDROOM_ASPECT, 0.40, 0.68, 12600), fov: 54, roll: 0 },
  ],
  0.46,
);

// 9. Chapter IV (Cosmos): The Starry Night -> Portal: Orange Crescent Moon -> Irises
const STARRY_ODYSSEY_TRACK = makeChapterTracks(
  CANVAS_ASPECT, 'Ch.IV 星夜',
  ['聖雷米夜空畫幅', '黑焰絲柏與金星光冕隧道', '深入 40 km 雙星雲大漩渦核心', '俯瞰聖雷米村莊尖塔與橘黃新月 → 療養院鳶尾花'],
  [
    { pos: pt(CANVAS_ASPECT, 0.20, 0.32, 185),   lookAt: pt(CANVAS_ASPECT, 0.28, 0.52, 420),   fov: 46, roll: -3 },
    { pos: pt(CANVAS_ASPECT, 0.33, 0.38, 3200),  lookAt: pt(CANVAS_ASPECT, 0.36, 0.42, 12800), fov: 50, roll: 2 },
    { pos: pt(CANVAS_ASPECT, 0.48, 0.62, 38500), lookAt: pt(CANVAS_ASPECT, 0.54, 0.66, 44000), fov: 58, roll: -4 },
    { pos: pt(CANVAS_ASPECT, 0.55, 0.32, 920),   lookAt: pt(CANVAS_ASPECT, 0.55, 0.20, 680),   fov: 46, roll: 1.5 },
    { pos: pt(CANVAS_ASPECT, 0.80, 0.75, 11200), lookAt: pt(CANVAS_ASPECT, 0.85, 0.78, 12800), fov: 52, roll: -2 },
  ],
  0.55,
).odysseyAct;

// 10. Chapter IV (Cosmos): Irises -> Portal: Solitary Pearl-White Iris -> Wheat Field with Cypresses
const IRISES_TRACKS = makeChapterTracks(
  IRISES_ASPECT, 'Ch.IV 鳶尾花',
  ['聖保羅療養院花園畫幅', '紅褐泥土與迎風彎曲的翠綠劍葉', '穿梭三十二朵紫藍鳶尾花海', '飛入孤傲純白鳶尾花任意門 → 絲柏麥田'],
  [
    { pos: pt(IRISES_ASPECT, 0.72, 0.16, 185), lookAt: pt(IRISES_ASPECT, 0.58, 0.32, 520),   fov: 44, roll: 2 },
    { pos: pt(IRISES_ASPECT, 0.56, 0.28, 290), lookAt: pt(IRISES_ASPECT, 0.38, 0.44, 580),   fov: 47, roll: -2 },
    { pos: pt(IRISES_ASPECT, 0.40, 0.40, 365), lookAt: pt(IRISES_ASPECT, 0.26, 0.56, 480),   fov: 49, roll: 1.5 },
    { pos: pt(IRISES_ASPECT, 0.28, 0.52, 420), lookAt: pt(IRISES_ASPECT, 0.24, 0.58, 470),   fov: 48, roll: -1.0 },
    { pos: pt(IRISES_ASPECT, 0.24, 0.58, 452), lookAt: pt(IRISES_ASPECT, 0.24, 0.58, 12400), fov: 52, roll: 0 },
  ],
  0.46,
);

// 11. Chapter IV (Cosmos): Wheat Field with Cypresses -> Portal: White Cumulus Vortex -> Almond Blossom
const WHEAT_TRACKS = makeChapterTracks(
  WHEAT_ASPECT, 'Ch.IV 絲柏麥田',
  ['聖雷米白晝畫幅', '密斯特拉爾強風與金黃麥浪', '雙絲柏與阿爾皮耶藍紫山脊', '衝入松石綠白雲漩渦任意門 → 盛開的杏花'],
  [
    { pos: pt(WHEAT_ASPECT, 0.28, 0.12, 175),   lookAt: pt(WHEAT_ASPECT, 0.52, 0.20, 460),   fov: 46, roll: -2.5 },
    { pos: pt(WHEAT_ASPECT, 0.58, 0.22, 310),   lookAt: pt(WHEAT_ASPECT, 0.78, 0.42, 200),   fov: 50, roll: -1.5 },
    { pos: pt(WHEAT_ASPECT, 0.68, 0.48, 175),   lookAt: pt(WHEAT_ASPECT, 0.46, 0.34, 1600),  fov: 52, roll: 3 },
    { pos: pt(WHEAT_ASPECT, 0.46, 0.42, 1600),  lookAt: pt(WHEAT_ASPECT, 0.44, 0.62, 18000), fov: 54, roll: 1.5 },
    { pos: pt(WHEAT_ASPECT, 0.46, 0.66, 15500), lookAt: pt(WHEAT_ASPECT, 0.48, 0.68, 42000), fov: 56, roll: -2.5 },
  ],
  0.38,
);

// 12. Chapter IV (Cosmos): Almond Blossom -> Portal: Deep Cerulean Sky Canopy -> The Church at Auvers
const ALMOND_TRACKS = makeChapterTracks(
  ALMOND_ASPECT, 'Ch.IV 盛開的杏花',
  ['春日晴空杏花畫幅', '蒼勁枝幹與粉白花苞', '穿梭五瓣立體杏花與飄落花雨', '飛向蔚藍天際任意門 → 奧維爾的教堂'],
  [
    { pos: pt(ALMOND_ASPECT, 0.66, 0.28, 172),  lookAt: pt(ALMOND_ASPECT, 0.46, 0.54, 210),  fov: 44, roll: -2 },
    { pos: pt(ALMOND_ASPECT, 0.46, 0.50, 215),  lookAt: pt(ALMOND_ASPECT, 0.34, 0.40, 520),  fov: 48, roll: 2 },
    { pos: pt(ALMOND_ASPECT, 0.36, 0.42, 460),  lookAt: pt(ALMOND_ASPECT, 0.56, 0.56, 720),  fov: 50, roll: -2 },
    { pos: pt(ALMOND_ASPECT, 0.54, 0.54, 680),  lookAt: pt(ALMOND_ASPECT, 0.50, 0.62, 2400), fov: 52, roll: 1.5 },
    { pos: pt(ALMOND_ASPECT, 0.50, 0.60, 1550), lookAt: pt(ALMOND_ASPECT, 0.50, 0.64, 9800), fov: 54, roll: 0 },
  ],
  0.44,
);

// 13. Chapter V (Road): The Church at Auvers -> Portal: Swirling Ultramarine Spire Sky -> Portrait of Dr. Gachet
const CHURCH_TRACKS = makeChapterTracks(
  CHURCH_ASPECT, 'Ch.V 奧維爾的教堂',
  ['奧維爾直幅畫框', '分叉黃沙小徑與農婦背影', '扭曲哥德石牆與彩繪玻璃窗', '穿過鐘樓群青風暴任意門 → 嘉舍醫師畫像'],
  [
    { pos: pt(CHURCH_ASPECT, 0.32, 0.14, 185),  lookAt: pt(CHURCH_ASPECT, 0.18, 0.28, 320),   fov: 45, roll: -2.5 },
    { pos: pt(CHURCH_ASPECT, 0.24, 0.26, 285),  lookAt: pt(CHURCH_ASPECT, 0.48, 0.38, 350),   fov: 48, roll: 2 },
    { pos: pt(CHURCH_ASPECT, 0.54, 0.36, 330),  lookAt: pt(CHURCH_ASPECT, 0.47, 0.62, 620),   fov: 50, roll: -2 },
    { pos: pt(CHURCH_ASPECT, 0.48, 0.64, 560),  lookAt: pt(CHURCH_ASPECT, 0.47, 0.86, 690),   fov: 52, roll: 1.5 },
    { pos: pt(CHURCH_ASPECT, 0.48, 0.82, 2200), lookAt: pt(CHURCH_ASPECT, 0.48, 0.84, 48000), fov: 56, roll: -2 },
  ],
  0.48,
);

// 14. Chapter V (Road): Portrait of Dr. Gachet -> Portal: Melancholic Gaze & Ultramarine Swirls -> Wheatfield with Crows
const GACHET_TRACKS = makeChapterTracks(
  GACHET_ASPECT, 'Ch.V 嘉舍醫師',
  ['奧維爾肖像直幅畫框', '傾斜紅桌、黃皮小說與紫紅毛地黃', '普魯士藍大衣與支頤沉思的手', '穿過憂鬱雙眸與深藍漩渦任意門 → 麥田群鴉'],
  [
    { pos: pt(GACHET_ASPECT, 0.26, 0.18, 185), lookAt: pt(GACHET_ASPECT, 0.32, 0.30, 465),   fov: 43, roll: -2 },
    { pos: pt(GACHET_ASPECT, 0.38, 0.28, 265), lookAt: pt(GACHET_ASPECT, 0.58, 0.42, 480),   fov: 46, roll: 2 },
    { pos: pt(GACHET_ASPECT, 0.64, 0.44, 345), lookAt: pt(GACHET_ASPECT, 0.56, 0.60, 470),   fov: 48, roll: -1.5 },
    { pos: pt(GACHET_ASPECT, 0.52, 0.56, 415), lookAt: pt(GACHET_ASPECT, 0.54, 0.60, 462),   fov: 47, roll: 1.0 },
    { pos: pt(GACHET_ASPECT, 0.54, 0.60, 448), lookAt: pt(GACHET_ASPECT, 0.54, 0.60, 12500), fov: 53, roll: 0 },
  ],
  0.46,
);

// 15. Chapter V (Road): Wheatfield with Crows -> Portal: Ascending Flock of Crows -> Return to Earth
const CROWS_TRACKS = makeChapterTracks(
  CROWS_ASPECT, 'Ch.V 麥田群鴉',
  ['奧維爾 2:1 超寬銀幕畫幅', '紅綠分叉小徑與狂暴麥海', '迎風振翅驚飛的五十二隻黑鴉', '穿過鴉群風暴任意門 → 重返最初的黑土'],
  [
    { pos: pt(CROWS_ASPECT, 0.48, 0.10, 175),  lookAt: pt(CROWS_ASPECT, 0.50, 0.28, 420),   fov: 48, roll: -2.5 },
    { pos: pt(CROWS_ASPECT, 0.32, 0.24, 210),  lookAt: pt(CROWS_ASPECT, 0.24, 0.38, 220),   fov: 52, roll: 3 },
    { pos: pt(CROWS_ASPECT, 0.46, 0.42, 280),  lookAt: pt(CROWS_ASPECT, 0.58, 0.58, 480),   fov: 54, roll: -3 },
    { pos: pt(CROWS_ASPECT, 0.60, 0.58, 520),  lookAt: pt(CROWS_ASPECT, 0.72, 0.74, 980),   fov: 56, roll: 2 },
    { pos: pt(CROWS_ASPECT, 0.66, 0.72, 1150), lookAt: pt(CROWS_ASPECT, 0.62, 0.76, 46000), fov: 58, roll: -1.5 },
  ],
  0.48,
);

// 16. Chapter I (Earth): The Weaver -> Portal: Cottage Window Sunbeam
const WEAVER_TRACKS = makeChapterTracks(
  WEAVER_ASPECT, 'Ch.I 織布工',
  ['紐南織布工坊暗褐畫幅', '巨大橡木織布機立柱與經緯線', '穿梭梭子與專注的織工', '穿過右側農舍明窗光束任意門 → 舊教堂塔樓'],
  [
    { pos: pt(WEAVER_ASPECT, 0.24, 0.22, 185), lookAt: pt(WEAVER_ASPECT, 0.48, 0.46, 520),   fov: 43, roll: -1.5 },
    { pos: pt(WEAVER_ASPECT, 0.38, 0.36, 240), lookAt: pt(WEAVER_ASPECT, 0.52, 0.50, 620),   fov: 46, roll: 1.5 },
    { pos: pt(WEAVER_ASPECT, 0.52, 0.48, 320), lookAt: pt(WEAVER_ASPECT, 0.68, 0.66, 760),   fov: 48, roll: -1.5 },
    { pos: pt(WEAVER_ASPECT, 0.66, 0.64, 420), lookAt: pt(WEAVER_ASPECT, 0.76, 0.72, 12800), fov: 50, roll: 1.0 },
    { pos: pt(WEAVER_ASPECT, 0.74, 0.70, 560), lookAt: pt(WEAVER_ASPECT, 0.76, 0.72, 12800), fov: 54, roll: 0 },
  ],
  0.42,
);

// 17. Chapter I (Earth): The Old Church Tower at Nuenen -> Portal: Belfry Twilight & Churchyard Path -> Skull
const TOWER_TRACKS = makeChapterTracks(
  TOWER_ASPECT, 'Ch.I 舊教堂塔樓',
  ['紐南暮色墓園畫幅', '歪斜木十字架與風中荒草', '斑駁紅磚鐘樓與盤旋寒鴉', '穿過鐘樓暮光任意門 → 叼菸骷髏'],
  [
    { pos: pt(TOWER_ASPECT, 0.32, 0.16, 185), lookAt: pt(TOWER_ASPECT, 0.48, 0.48, 620),   fov: 43, roll: -2.0 },
    { pos: pt(TOWER_ASPECT, 0.42, 0.28, 250), lookAt: pt(TOWER_ASPECT, 0.48, 0.62, 650),   fov: 46, roll: 2.0 },
    { pos: pt(TOWER_ASPECT, 0.52, 0.44, 340), lookAt: pt(TOWER_ASPECT, 0.48, 0.72, 680),   fov: 48, roll: -1.5 },
    { pos: pt(TOWER_ASPECT, 0.48, 0.62, 460), lookAt: pt(TOWER_ASPECT, 0.48, 0.76, 13200), fov: 50, roll: 1.0 },
    { pos: pt(TOWER_ASPECT, 0.48, 0.74, 580), lookAt: pt(TOWER_ASPECT, 0.48, 0.76, 13200), fov: 54, roll: 0 },
  ],
  0.40,
);

// 18. Chapter I (Earth): Skull with Burning Cigarette -> Portal: Glowing Cigarette Ember & Smoke -> A Pair of Shoes
const SKULL_TRACKS = makeChapterTracks(
  SKULL_ASPECT, 'Ch.I 叼菸骷髏',
  ['安特衛普學院暗室直幅畫框', '象牙白鎖骨與顴骨厚塗筆觸', '深邃眼窩與咬緊的香菸', '飛入赤紅火燼與青煙漩渦任意門 → 一雙舊鞋'],
  [
    { pos: pt(SKULL_ASPECT, 0.38, 0.24, 185), lookAt: pt(SKULL_ASPECT, 0.46, 0.52, 520),   fov: 42, roll: -2.0 },
    { pos: pt(SKULL_ASPECT, 0.44, 0.42, 240), lookAt: pt(SKULL_ASPECT, 0.48, 0.58, 540),   fov: 45, roll: 2.0 },
    { pos: pt(SKULL_ASPECT, 0.52, 0.50, 310), lookAt: pt(SKULL_ASPECT, 0.62, 0.44, 490),   fov: 47, roll: -1.5 },
    { pos: pt(SKULL_ASPECT, 0.60, 0.44, 380), lookAt: pt(SKULL_ASPECT, 0.68, 0.42, 12600), fov: 50, roll: 1.0 },
    { pos: pt(SKULL_ASPECT, 0.66, 0.42, 450), lookAt: pt(SKULL_ASPECT, 0.68, 0.42, 12600), fov: 54, roll: 0 },
  ],
  0.46,
);

// 19. Chapter II (Color): Le Moulin de la Galette -> Portal: Windmill Sails & Montmartre Sky
const GALETTE_TRACKS = makeChapterTracks(
  GALETTE_ASPECT, 'Ch.II 煎餅磨坊',
  ['蒙馬特山丘秋日畫幅', '斜坡木欄杆與巴黎三色旗', '木造磨坊高塔與巨大風車翼', '穿過風車輪軸晴空任意門 → 克利希大道'],
  [
    { pos: pt(GALETTE_ASPECT, 0.64, 0.18, 185), lookAt: pt(GALETTE_ASPECT, 0.46, 0.48, 580),   fov: 43, roll: 2.0 },
    { pos: pt(GALETTE_ASPECT, 0.54, 0.34, 250), lookAt: pt(GALETTE_ASPECT, 0.44, 0.62, 640),   fov: 46, roll: -2.0 },
    { pos: pt(GALETTE_ASPECT, 0.46, 0.52, 340), lookAt: pt(GALETTE_ASPECT, 0.44, 0.74, 680),   fov: 48, roll: 1.5 },
    { pos: pt(GALETTE_ASPECT, 0.44, 0.68, 440), lookAt: pt(GALETTE_ASPECT, 0.44, 0.78, 13200), fov: 50, roll: -1.0 },
    { pos: pt(GALETTE_ASPECT, 0.44, 0.76, 560), lookAt: pt(GALETTE_ASPECT, 0.44, 0.78, 13200), fov: 54, roll: 0 },
  ],
  0.46,
);

// 20. Chapter II (Color): Bridges across the Seine at Asnières -> Portal: Steam Train Plume & Bridge Arch
const SEINE_TRACKS = makeChapterTracks(
  SEINE_ASPECT, 'Ch.II 塞納河與橋',
  ['阿尼耶爾河畔陽光畫幅', '松石藍碎鑽水波與紅陽傘仕女', '乳白石橋墩與朱紅鐵橋拱', '穿過火車白煙與橋拱任意門 → 雨中大橋'],
  [
    { pos: pt(SEINE_ASPECT, 0.26, 0.18, 185), lookAt: pt(SEINE_ASPECT, 0.44, 0.42, 540),   fov: 43, roll: -2.0 },
    { pos: pt(SEINE_ASPECT, 0.38, 0.30, 260), lookAt: pt(SEINE_ASPECT, 0.52, 0.52, 680),   fov: 46, roll: 2.0 },
    { pos: pt(SEINE_ASPECT, 0.48, 0.44, 360), lookAt: pt(SEINE_ASPECT, 0.54, 0.58, 780),   fov: 48, roll: -1.5 },
    { pos: pt(SEINE_ASPECT, 0.52, 0.56, 480), lookAt: pt(SEINE_ASPECT, 0.54, 0.64, 13000), fov: 50, roll: 1.0 },
    { pos: pt(SEINE_ASPECT, 0.54, 0.62, 620), lookAt: pt(SEINE_ASPECT, 0.54, 0.64, 13000), fov: 54, roll: 0 },
  ],
  0.48,
);

// 21. Chapter II (Color): Bridge in the Rain (after Hiroshige) -> Portal: Paper Umbrellas & Rain Horizon
const PLUM_TRACKS = makeChapterTracks(
  PLUM_ASPECT, 'Ch.II 雨中大橋',
  ['浮世繪漢字邊框直幅畫框', '三千道斜雨絲與靛藍隅田川', '高腳木橋拱與金黃紙傘旅人', '穿過雨幕木橋任意門 → 唐吉老爹肖像'],
  [
    { pos: pt(PLUM_ASPECT, 0.24, 0.18, 185), lookAt: pt(PLUM_ASPECT, 0.46, 0.38, 520),   fov: 42, roll: -2.5 },
    { pos: pt(PLUM_ASPECT, 0.36, 0.30, 250), lookAt: pt(PLUM_ASPECT, 0.52, 0.46, 620),   fov: 45, roll: 2.0 },
    { pos: pt(PLUM_ASPECT, 0.46, 0.42, 340), lookAt: pt(PLUM_ASPECT, 0.50, 0.52, 720),   fov: 48, roll: -1.5 },
    { pos: pt(PLUM_ASPECT, 0.48, 0.50, 440), lookAt: pt(PLUM_ASPECT, 0.48, 0.56, 12800), fov: 50, roll: 1.0 },
    { pos: pt(PLUM_ASPECT, 0.48, 0.54, 540), lookAt: pt(PLUM_ASPECT, 0.48, 0.56, 12800), fov: 54, roll: 0 },
  ],
  0.46,
);

// 22. Chapter II (Color): Portrait of Père Tanguy -> Portal: Mount Fuji Crown & Ukiyo-e Wall
const TANGUY_TRACKS = makeChapterTracks(
  TANGUY_ASPECT, 'Ch.II 唐吉老爹',
  ['巴黎浮世繪肖像直幅畫框', '緊握的雙手與鈷藍翻領大衣', '慈祥笑容與滿牆日本木版畫', '飛入帽頂富士山白雪光環 → 戴草帽的自畫像'],
  [
    { pos: pt(TANGUY_ASPECT, 0.48, 0.18, 180), lookAt: pt(TANGUY_ASPECT, 0.50, 0.46, 510),   fov: 42, roll: -1.5 },
    { pos: pt(TANGUY_ASPECT, 0.44, 0.38, 250), lookAt: pt(TANGUY_ASPECT, 0.50, 0.60, 520),   fov: 45, roll: 1.5 },
    { pos: pt(TANGUY_ASPECT, 0.54, 0.56, 330), lookAt: pt(TANGUY_ASPECT, 0.50, 0.72, 540),   fov: 47, roll: -1.5 },
    { pos: pt(TANGUY_ASPECT, 0.50, 0.74, 420), lookAt: pt(TANGUY_ASPECT, 0.50, 0.86, 12600), fov: 50, roll: 1.0 },
    { pos: pt(TANGUY_ASPECT, 0.50, 0.84, 500), lookAt: pt(TANGUY_ASPECT, 0.50, 0.86, 12600), fov: 54, roll: 0 },
  ],
  0.48,
);

// 23. Chapter III (Sun): The Yellow House -> Portal: Green Shutters of the Studio Window
const YELLOWHOUSE_TRACKS = makeChapterTracks(
  YELLOWHOUSE_ASPECT, 'Ch.III 黃色小屋',
  ['拉馬丁廣場烈日畫幅', '開挖的瓦斯管溝與金黃沙堆', '鉻黃街角立面與遠方火車鐵橋', '穿過二樓翠綠百葉窗任意門 → 向日葵'],
  [
    { pos: pt(YELLOWHOUSE_ASPECT, 0.34, 0.16, 185), lookAt: pt(YELLOWHOUSE_ASPECT, 0.48, 0.48, 520),   fov: 43, roll: -2.0 },
    { pos: pt(YELLOWHOUSE_ASPECT, 0.44, 0.30, 260), lookAt: pt(YELLOWHOUSE_ASPECT, 0.52, 0.56, 560),   fov: 46, roll: 2.0 },
    { pos: pt(YELLOWHOUSE_ASPECT, 0.56, 0.44, 350), lookAt: pt(YELLOWHOUSE_ASPECT, 0.48, 0.60, 540),   fov: 48, roll: -1.5 },
    { pos: pt(YELLOWHOUSE_ASPECT, 0.48, 0.56, 430), lookAt: pt(YELLOWHOUSE_ASPECT, 0.48, 0.62, 12800), fov: 50, roll: 1.0 },
    { pos: pt(YELLOWHOUSE_ASPECT, 0.48, 0.60, 500), lookAt: pt(YELLOWHOUSE_ASPECT, 0.48, 0.62, 12800), fov: 54, roll: 0 },
  ],
  0.52,
);

// 24. Chapter III (Sun): The Harvest at La Crau -> Portal: Sunlit Alpilles Horizon & Montmajour
const HARVEST_TRACKS = makeChapterTracks(
  HARVEST_ASPECT, 'Ch.III 克勞豐收',
  ['普羅旺斯鳥瞰全景畫幅', '蘆葦圍欄、藍色農車與金色麥垛', '交錯田疇與遠方阿爾皮耶山脈', '迎向山巔金光任意門 → 夕陽下的播種者'],
  [
    { pos: pt(HARVEST_ASPECT, 0.46, 0.14, 185), lookAt: pt(HARVEST_ASPECT, 0.48, 0.38, 540),   fov: 44, roll: -1.5 },
    { pos: pt(HARVEST_ASPECT, 0.42, 0.30, 280), lookAt: pt(HARVEST_ASPECT, 0.52, 0.48, 760),   fov: 47, roll: 2.0 },
    { pos: pt(HARVEST_ASPECT, 0.54, 0.48, 420), lookAt: pt(HARVEST_ASPECT, 0.52, 0.68, 1600),  fov: 49, roll: -1.5 },
    { pos: pt(HARVEST_ASPECT, 0.52, 0.68, 680), lookAt: pt(HARVEST_ASPECT, 0.52, 0.84, 13200), fov: 52, roll: 1.0 },
    { pos: pt(HARVEST_ASPECT, 0.52, 0.80, 920), lookAt: pt(HARVEST_ASPECT, 0.52, 0.84, 13200), fov: 55, roll: 0 },
  ],
  0.50,
);

// 25. Chapter III (Sun): The Sower at Sunset -> Portal: Colossal Blazing Lemon Sun Disc
const SOWER_TRACKS = makeChapterTracks(
  SOWER_ASPECT, 'Ch.III 夕陽播種者',
  ['亞爾落日田野畫幅', '紫藍犁溝與跨步揮撒的金黃種子', '浮世繪斜向柳樹幹與播種者剪影', '飛入碩大檸檬黃落日光輪任意門 → 夜間咖啡座'],
  [
    { pos: pt(SOWER_ASPECT, 0.28, 0.18, 185), lookAt: pt(SOWER_ASPECT, 0.34, 0.38, 500),   fov: 43, roll: -2.0 },
    { pos: pt(SOWER_ASPECT, 0.36, 0.32, 240), lookAt: pt(SOWER_ASPECT, 0.52, 0.52, 540),   fov: 46, roll: 2.5 },
    { pos: pt(SOWER_ASPECT, 0.48, 0.46, 320), lookAt: pt(SOWER_ASPECT, 0.58, 0.58, 900),   fov: 48, roll: -1.5 },
    { pos: pt(SOWER_ASPECT, 0.55, 0.56, 440), lookAt: pt(SOWER_ASPECT, 0.58, 0.60, 12200), fov: 51, roll: 1.0 },
    { pos: pt(SOWER_ASPECT, 0.58, 0.60, 560), lookAt: pt(SOWER_ASPECT, 0.58, 0.60, 12200), fov: 55, roll: 0 },
  ],
  0.58,
);

// 26. Chapter III (Sun): The Night Café -> Portal: Blazing Sulfur Gasoliers & Open Curtain Doorway
const NIGHTCAFE_TRACKS = makeChapterTracks(
  NIGHTCAFE_ASPECT, 'Ch.III 夜間咖啡館',
  ['亞爾午夜室內透視畫幅', '陡峭硫磺松木地板與綠色撞球檯', '血紅牆面與四盞眩目瓦斯吊燈', '穿過中央門廊光暈任意門 → 隆河上的星夜'],
  [
    { pos: pt(NIGHTCAFE_ASPECT, 0.48, 0.14, 180), lookAt: pt(NIGHTCAFE_ASPECT, 0.50, 0.34, 480),   fov: 44, roll: -2.5 },
    { pos: pt(NIGHTCAFE_ASPECT, 0.44, 0.28, 235), lookAt: pt(NIGHTCAFE_ASPECT, 0.52, 0.46, 650),   fov: 47, roll: 2.5 },
    { pos: pt(NIGHTCAFE_ASPECT, 0.54, 0.42, 340), lookAt: pt(NIGHTCAFE_ASPECT, 0.52, 0.68, 820),   fov: 49, roll: -2.0 },
    { pos: pt(NIGHTCAFE_ASPECT, 0.52, 0.48, 480), lookAt: pt(NIGHTCAFE_ASPECT, 0.52, 0.50, 12400), fov: 52, roll: 1.0 },
    { pos: pt(NIGHTCAFE_ASPECT, 0.52, 0.50, 640), lookAt: pt(NIGHTCAFE_ASPECT, 0.52, 0.50, 12400), fov: 55, roll: 0 },
  ],
  0.56,
);

// 27. Chapter IV (Cosmos): Olive Trees with Yellow Sky and Sun -> Portal: Concentric Afternoon Sun
const OLIVE_TRACKS = makeChapterTracks(
  OLIVE_ASPECT, 'Ch.IV 橄欖樹與太陽',
  ['聖雷米金色斜陽畫幅', '玫瑰赭石波浪大地與鈷藍樹影', '盤曲橄欖樹幹與翻湧銀綠樹冠', '飛入同心圓檸檬黃烈日任意門 → 絲柏麥田'],
  [
    { pos: pt(OLIVE_ASPECT, 0.28, 0.16, 185), lookAt: pt(OLIVE_ASPECT, 0.44, 0.42, 480),   fov: 43, roll: -2.0 },
    { pos: pt(OLIVE_ASPECT, 0.40, 0.32, 250), lookAt: pt(OLIVE_ASPECT, 0.52, 0.54, 620),   fov: 46, roll: 2.0 },
    { pos: pt(OLIVE_ASPECT, 0.50, 0.48, 350), lookAt: pt(OLIVE_ASPECT, 0.54, 0.72, 920),   fov: 48, roll: -1.5 },
    { pos: pt(OLIVE_ASPECT, 0.54, 0.68, 480), lookAt: pt(OLIVE_ASPECT, 0.54, 0.80, 12400), fov: 51, roll: 1.0 },
    { pos: pt(OLIVE_ASPECT, 0.54, 0.78, 620), lookAt: pt(OLIVE_ASPECT, 0.54, 0.80, 12400), fov: 55, roll: 0 },
  ],
  0.54,
);

// 28. Chapter IV (Cosmos): Road with Cypress and Star -> Portal: Crescent Moon & Evening Star
const ROADCYPRESS_TRACKS = makeChapterTracks(
  ROADCYPRESS_ASPECT, 'Ch.IV 絲柏與星辰之路',
  ['聖雷米告別夜曲直幅畫框', '蜿蜒夜路、旅人與黃色馬車', '直插雲霄的墨綠火焰絲柏', '穿過新月與金星光環任意門 → 盛開杏花'],
  [
    { pos: pt(ROADCYPRESS_ASPECT, 0.46, 0.14, 175), lookAt: pt(ROADCYPRESS_ASPECT, 0.48, 0.42, 480),   fov: 43, roll: -2.0 },
    { pos: pt(ROADCYPRESS_ASPECT, 0.42, 0.32, 225), lookAt: pt(ROADCYPRESS_ASPECT, 0.48, 0.62, 520),   fov: 46, roll: 2.0 },
    { pos: pt(ROADCYPRESS_ASPECT, 0.54, 0.52, 310), lookAt: pt(ROADCYPRESS_ASPECT, 0.68, 0.76, 980),   fov: 48, roll: -1.5 },
    { pos: pt(ROADCYPRESS_ASPECT, 0.68, 0.70, 440), lookAt: pt(ROADCYPRESS_ASPECT, 0.76, 0.78, 12200), fov: 51, roll: 1.0 },
    { pos: pt(ROADCYPRESS_ASPECT, 0.74, 0.76, 580), lookAt: pt(ROADCYPRESS_ASPECT, 0.76, 0.78, 12200), fov: 55, roll: 0 },
  ],
  0.54,
);

// 29. Chapter V (Road): Thatched Cottages at Cordeville -> Portal: Boiling Auvers Clouds & Meadow Path
const COTTAGES_TRACKS = makeChapterTracks(
  COTTAGES_ASPECT, 'Ch.V 奧維茅草屋',
  ['奧維爾科德維爾田園畫幅', '春雨洗滌的波浪草地與小徑', '起伏如海浪的青苔茅草屋頂', '穿過翻湧鈷藍雲海任意門 → 奧維爾教堂'],
  [
    { pos: pt(COTTAGES_ASPECT, 0.44, 0.14, 185), lookAt: pt(COTTAGES_ASPECT, 0.46, 0.42, 520),   fov: 43, roll: -2.0 },
    { pos: pt(COTTAGES_ASPECT, 0.38, 0.30, 250), lookAt: pt(COTTAGES_ASPECT, 0.42, 0.54, 620),   fov: 46, roll: 2.0 },
    { pos: pt(COTTAGES_ASPECT, 0.36, 0.48, 350), lookAt: pt(COTTAGES_ASPECT, 0.34, 0.70, 820),   fov: 48, roll: -1.5 },
    { pos: pt(COTTAGES_ASPECT, 0.34, 0.68, 480), lookAt: pt(COTTAGES_ASPECT, 0.34, 0.80, 13000), fov: 51, roll: 1.0 },
    { pos: pt(COTTAGES_ASPECT, 0.34, 0.78, 620), lookAt: pt(COTTAGES_ASPECT, 0.34, 0.80, 13000), fov: 55, roll: 0 },
  ],
  0.46,
);

// 30. Chapter V (Road): Daubigny's Garden -> Portal: Sunlit Villa Roof & Auvers Belfry
const DAUBIGNY_TRACKS = makeChapterTracks(
  DAUBIGNY_ASPECT, 'Ch.V 多比尼花園',
  ['奧維爾 2:1 雙正方形花園畫幅', '翠綠草坪、粉紅玫瑰花壇與黑貓', '垂柳栗樹與遠方多比尼別墅', '飛越別墅屋頂與尖塔任意門 → 麥田群鴉'],
  [
    { pos: pt(DAUBIGNY_ASPECT, 0.36, 0.14, 180), lookAt: pt(DAUBIGNY_ASPECT, 0.48, 0.38, 520),   fov: 46, roll: -1.5 },
    { pos: pt(DAUBIGNY_ASPECT, 0.46, 0.28, 260), lookAt: pt(DAUBIGNY_ASPECT, 0.52, 0.54, 740),   fov: 48, roll: 1.5 },
    { pos: pt(DAUBIGNY_ASPECT, 0.52, 0.46, 380), lookAt: pt(DAUBIGNY_ASPECT, 0.52, 0.68, 880),   fov: 50, roll: -1.5 },
    { pos: pt(DAUBIGNY_ASPECT, 0.52, 0.62, 520), lookAt: pt(DAUBIGNY_ASPECT, 0.52, 0.74, 13000), fov: 52, roll: 1.0 },
    { pos: pt(DAUBIGNY_ASPECT, 0.52, 0.72, 680), lookAt: pt(DAUBIGNY_ASPECT, 0.52, 0.74, 13000), fov: 55, roll: 0 },
  ],
  0.48,
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

const ODYSSEY_ACT_BY_ID: Record<PaintingId, CompanionTrack> = {
  potato: POTATO_TRACKS.odysseyAct,
  weaver: WEAVER_TRACKS.odysseyAct,
  tower: TOWER_TRACKS.odysseyAct,
  shoes: SHOES_TRACKS.odysseyAct,
  skull: SKULL_TRACKS.odysseyAct,
  galette: GALETTE_TRACKS.odysseyAct,
  paris: PARIS_TRACKS.odysseyAct,
  seine: SEINE_TRACKS.odysseyAct,
  plum: PLUM_TRACKS.odysseyAct,
  tanguy: TANGUY_TRACKS.odysseyAct,
  selfportrait: SELFPORTRAIT_TRACKS.odysseyAct,
  yellowhouse: YELLOWHOUSE_TRACKS.odysseyAct,
  sunflowers: SUNFLOWERS_TRACKS.odysseyAct,
  harvest: HARVEST_TRACKS.odysseyAct,
  sower: SOWER_TRACKS.odysseyAct,
  cafe: CAFE_TRACKS.odysseyAct,
  nightcafe: NIGHTCAFE_TRACKS.odysseyAct,
  rhone: RHONE_TRACKS.odysseyAct,
  bedroom: BEDROOM_TRACKS.odysseyAct,
  starry: STARRY_ODYSSEY_TRACK,
  irises: IRISES_TRACKS.odysseyAct,
  olive: OLIVE_TRACKS.odysseyAct,
  wheat: WHEAT_TRACKS.odysseyAct,
  roadcypress: ROADCYPRESS_TRACKS.odysseyAct,
  almond: ALMOND_TRACKS.odysseyAct,
  cottages: COTTAGES_TRACKS.odysseyAct,
  church: CHURCH_TRACKS.odysseyAct,
  gachet: GACHET_TRACKS.odysseyAct,
  daubigny: DAUBIGNY_TRACKS.odysseyAct,
  crows: CROWS_TRACKS.odysseyAct,
};

export const ACT_SECONDS = 30;
export const DEFAULT_ODYSSEY_SEQUENCE: readonly PaintingId[] = ALL_PAINTING_IDS;

export interface OdysseyMorphState {
  activeId: PaintingId;
  primaryId: PaintingId;
  secondaryId: PaintingId | null;
  primaryFade: number;
  secondaryFade: number;
  primaryScatter: number;
  secondaryScatter: number;
  atmoMix: number;
  displayAspect: number;
  snapIncoming: boolean;
  transitionMotif: MotifId;
  transitionNameZh: string;
  smearBoost: number;
  bloomBoost: number;
  dustBoost: number;
  warpOffset: number;
  stirPulse: number;
  portalUV: [number, number];
}

/**
 * Evaluate the Continuous Path Morph state at master clock `t` for ANY sequence of paintings (`sequence`).
 * After the camera returns to E by tau = 25.0 s and holds the reassembled current painting cleanly at E for 1.8 s
 * (tau in [25.0, 26.8)), during the final 3.2 s (tau in [26.8, 30.0)) the outgoing painting's brushstrokes
 * unbind through its Spatial Portal according to the connecting edge's Motif Transition Grammar while
 * the next painting's brushstrokes condense in 3D and lock into exact registration at E by tau = 29.8 s.
 */
export function evalOdysseyMorph(
  t: number,
  sequence: readonly PaintingId[] = DEFAULT_ODYSSEY_SEQUENCE,
): OdysseyMorphState {
  const n = Math.max(1, sequence.length);
  const totalSec = n * ACT_SECONDS;
  const tw = ((t % totalSec) + totalSec) % totalSec;
  const actIdx = Math.min(n - 1, Math.floor(tw / ACT_SECONDS));
  const nextIdx = (actIdx + 1) % n;
  const tau = tw - actIdx * ACT_SECONDS; // [0, 30)
  const specA = getPaintingSpec(sequence[actIdx]);
  const specB = getPaintingSpec(sequence[nextIdx]);
  const edge = resolveTransitionEdge(specA.id, specB.id);
  const g = edge.grammar;

  if (tau >= 26.8 && n > 1) {
    const m = clamp01((tau - 26.8) / 3.0); // reaches 1.0 at tau = 29.8 s
    const bell = Math.sin(Math.PI * m);
    const pFade = 1 - smoothstep(0.08, 0.88, m);
    const sFade = smoothstep(0.06, 0.86, m);
    const pScat = g.scatterPeakPrimary * smoothstep(0.0, 0.82, m);
    const sScat = g.scatterPeakSecondary * Math.pow(1 - smoothstep(0.10, 0.96, m), 1.65);
    const atmoMix = smoothstep(0.10, 0.90, m);
    const displayAspect = specA.aspect + (specB.aspect - specA.aspect) * atmoMix;
    const activeId = m >= 0.55 ? specB.id : specA.id;
    const activeSpec = m >= 0.55 ? specB : specA;
    return {
      activeId,
      primaryId: specA.id,
      secondaryId: specB.id,
      primaryFade: pFade,
      secondaryFade: sFade,
      primaryScatter: pScat,
      secondaryScatter: sScat,
      atmoMix,
      displayAspect,
      snapIncoming: tau >= 29.0 && tau <= 29.95,
      transitionMotif: edge.motif,
      transitionNameZh: g.nameZh,
      smearBoost: g.smearBoost * bell,
      bloomBoost: g.bloomBoost * bell,
      dustBoost: g.dustBoost * bell,
      warpOffset: g.warpCurve * bell,
      stirPulse: g.stirAmp * bell,
      portalUV: [activeSpec.moonUVD[0], activeSpec.moonUVD[1]],
    };
  }

  return {
    activeId: specA.id,
    primaryId: specA.id,
    secondaryId: null,
    primaryFade: 1,
    secondaryFade: 0,
    primaryScatter: 0,
    secondaryScatter: 0,
    atmoMix: 0,
    displayAspect: specA.aspect,
    snapIncoming: false,
    transitionMotif: edge.motif,
    transitionNameZh: g.nameZh,
    smearBoost: 0,
    bloomBoost: 0,
    dustBoost: 0,
    warpOffset: 0,
    stirPulse: 0,
    portalUV: [specA.moonUVD[0], specA.moonUVD[1]],
  };
}

const _compiledTrackCache = new Map<string, ChapterTrack>();

/** Dynamic Path Compiler: builds and caches a seamless multi-act ChapterTrack for any sequence of PaintingIds. */
export function compilePathTrack(sequence: readonly PaintingId[] = DEFAULT_ODYSSEY_SEQUENCE): ChapterTrack {
  const seq = sequence.length > 0 ? sequence : DEFAULT_ODYSSEY_SEQUENCE;
  const cacheKey = seq.join(',');
  const cached = _compiledTrackCache.get(cacheKey);
  if (cached) return cached;

  const n = seq.length;
  const loopSeconds = n * ACT_SECONDS;
  const shots: ShotDef[] = [];
  seq.forEach((id, actIdx) => {
    const tr = ODYSSEY_ACT_BY_ID[id];
    const tBase = actIdx * ACT_SECONDS;
    const nextId = seq[(actIdx + 1) % n];
    const edge = resolveTransitionEdge(id, nextId);
    const nextSpec = getPaintingSpec(nextId);
    tr.shots.forEach((s, j) => {
      const shotName =
        j === 3 && n > 1
          ? `${s.name.split('→')[0].trim()} → ${nextSpec.titleZh} [${edge.grammar.nameZh.split('·')[0].trim()}]`
          : s.name;
      shots.push({
        index: actIdx * 4 + j,
        name: shotName,
        t0: tBase + s.t0,
        t1: tBase + s.t1,
        setPiece: s.setPiece,
      });
    });
  });
  const shotStarts = shots.map((s) => s.t0);

  let _tr: CompanionTrack = ODYSSEY_ACT_BY_ID[seq[0]];
  let _tau = 0;
  const split = (t: number): void => {
    const tw = ((t % loopSeconds) + loopSeconds) % loopSeconds;
    const idx = Math.min(n - 1, Math.floor(tw / ACT_SECONDS));
    _tr = ODYSSEY_ACT_BY_ID[seq[idx]];
    _tau = tw - idx * ACT_SECONDS;
  };

  const track: ChapterTrack = {
    loopSeconds,
    aspect: CANVAS_ASPECT,
    shots,
    shotStarts,
    actSeconds: n > 1 ? ACT_SECONDS : undefined,
    aspectAt: (t: number) => {
      const tw = ((t % loopSeconds) + loopSeconds) % loopSeconds;
      const actIdx = Math.min(n - 1, Math.floor(tw / ACT_SECONDS));
      const tau = tw - actIdx * ACT_SECONDS;
      const specA = getPaintingSpec(seq[actIdx]);
      if (tau < 26.8 || n <= 1) return specA.aspect;
      const specB = getPaintingSpec(seq[(actIdx + 1) % n]);
      const m = clamp01((tau - 26.8) / 3.0);
      const atmoMix = smoothstep(0.10, 0.90, m);
      return specA.aspect + (specB.aspect - specA.aspect) * atmoMix;
    },
    position: (t: number, out: Vector3) => {
      split(t);
      return _tr.position(_tau, out);
    },
    pose: (t: number, out: CamPose) => {
      split(t);
      return _tr.pose(_tau, out);
    },
    velocity: (t: number, out: Vector3) => {
      split(t);
      return _tr.velocity(_tau, out);
    },
    env: (t: number, camDistFromE: number, calm: boolean, out: EnvSample) => {
      split(t);
      _tr.env(_tau, camDistFromE, calm, out);
      out.fade = 0;
      return out;
    },
  };
  _compiledTrackCache.set(cacheKey, track);
  return track;
}

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
  // ================= CHAPTER I: EARTH (Nuenen & Antwerp, 1884–1886) =================
  {
    id: 'potato',
    chapterId: 'earth',
    roman: 'I',
    shortZh: '食薯者',
    titleZh: '食薯者',
    titleEn: 'The Potato Eaters',
    placeZh: 'Chapter I · 黑土與人 (荷蘭 Nuenen)',
    year: '1885.04',
    portalZh: '飛入中央懸掛油燈的暖金火芯 → 走入隔壁農舍《織布工》木機框',
    aspect: POTATO_ASPECT,
    skyMode: 0.6,
    fogNearHex: 0x261d14,
    fogFarHex: 0x120e0a,
    moonUVD: [uFromPaint(0.50, POTATO_ASPECT), 0.78, 480],
    track: POTATO_TRACKS.standalone,
    generate: generatePotatoChapter,
  },
  {
    id: 'weaver',
    chapterId: 'earth',
    roman: 'II',
    shortZh: '織布工',
    titleZh: '織布工',
    titleEn: 'The Weaver',
    placeZh: 'Chapter I · 黑土與人 (荷蘭 Nuenen)',
    year: '1884.05',
    portalZh: '穿過右側農舍明窗光束 → 望見暮色中的《紐南的舊教堂塔樓》',
    aspect: WEAVER_ASPECT,
    skyMode: 0.7,
    fogNearHex: 0x2a1f15,
    fogFarHex: 0x140f0a,
    moonUVD: [uFromPaint(0.76, WEAVER_ASPECT), 0.72, 12800],
    track: WEAVER_TRACKS.standalone,
    generate: generateWeaverChapter,
  },
  {
    id: 'tower',
    chapterId: 'earth',
    roman: 'III',
    shortZh: '舊教堂塔樓',
    titleZh: '紐南的舊教堂塔樓',
    titleEn: 'The Old Church Tower at Nuenen',
    placeZh: 'Chapter I · 黑土與人 (荷蘭 Nuenen)',
    year: '1885.05',
    portalZh: '穿過鐘樓暮光與盤旋寒鴉 → 踏入安特衛普學院暗室《叼菸骷髏》',
    aspect: TOWER_ASPECT,
    skyMode: 0.9,
    fogNearHex: 0x3b3428,
    fogFarHex: 0x1e1a14,
    moonUVD: [uFromPaint(0.48, TOWER_ASPECT), 0.76, 13200],
    track: TOWER_TRACKS.standalone,
    generate: generateTowerChapter,
  },
  {
    id: 'skull',
    chapterId: 'earth',
    roman: 'IV',
    shortZh: '叼菸骷髏',
    titleZh: '叼著點燃香菸的骷髏',
    titleEn: 'Skull of a Skeleton with Burning Cigarette',
    placeZh: 'Chapter I · 黑土與人 (安特衛普 Antwerp)',
    year: '1886.02',
    portalZh: '飛入香菸赤紅火燼與青煙漩渦 → 踏上巴黎《一雙舊鞋》遠行起點',
    aspect: SKULL_ASPECT,
    skyMode: 0.65,
    fogNearHex: 0x221814,
    fogFarHex: 0x0e0a09,
    moonUVD: [uFromPaint(0.68, SKULL_ASPECT), 0.42, 12600],
    track: SKULL_TRACKS.standalone,
    generate: generateSkullChapter,
  },

  // ================= CHAPTER II: COLOR (Paris & Montmartre, 1886–1888) =================
  {
    id: 'shoes',
    chapterId: 'color',
    roman: 'V',
    shortZh: '一雙舊鞋',
    titleZh: '一雙舊鞋',
    titleEn: 'A Pair of Shoes',
    placeZh: 'Chapter II · 巴黎與覺醒 (巴黎 Paris)',
    year: '1886.09',
    portalZh: '順著蜿蜒鞋帶迎向金色門檻光束 → 登上巴黎《蒙馬特的煎餅磨坊》',
    aspect: SHOES_ASPECT,
    skyMode: 0.8,
    fogNearHex: 0x2e2116,
    fogFarHex: 0x16110c,
    moonUVD: [uFromPaint(0.62, SHOES_ASPECT), 0.72, 12600],
    track: SHOES_TRACKS.standalone,
    generate: generateShoesChapter,
  },
  {
    id: 'galette',
    chapterId: 'color',
    roman: 'VI',
    shortZh: '煎餅磨坊',
    titleZh: '蒙馬特的煎餅磨坊',
    titleEn: 'Le Moulin de la Galette',
    placeZh: 'Chapter II · 巴黎與覺醒 (蒙馬特 Montmartre)',
    year: '1886.10',
    portalZh: '順著蒙馬特山坡木欄杆走下山丘 → 步入點描光譜《克利希大道》',
    aspect: GALETTE_ASPECT,
    skyMode: 3.0,
    fogNearHex: 0x6e94b0,
    fogFarHex: 0x9ec0d8,
    moonUVD: [uFromPaint(0.44, GALETTE_ASPECT), 0.78, 13200],
    track: GALETTE_TRACKS.standalone,
    generate: generateGaletteChapter,
  },
  {
    id: 'paris',
    chapterId: 'color',
    roman: 'VII',
    shortZh: '克利希大道',
    titleZh: '克利希大道',
    titleEn: 'Boulevard de Clichy',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)',
    year: '1887.03',
    portalZh: '穿過林蔭大道晨光向西漫步 → 抵達波光粼粼的《阿尼耶爾的塞納河與橋》',
    aspect: PARIS_ASPECT,
    skyMode: 3,
    fogNearHex: 0x7a9eb8,
    fogFarHex: 0xa8c6dc,
    moonUVD: [uFromPaint(0.46, PARIS_ASPECT), 0.56, 13200],
    track: PARIS_TRACKS.standalone,
    generate: generateParisChapter,
  },
  {
    id: 'seine',
    chapterId: 'color',
    roman: 'VIII',
    shortZh: '塞納河與橋',
    titleZh: '阿尼耶爾的塞納河與橋',
    titleEn: 'Bridges across the Seine at Asnières',
    placeZh: 'Chapter II · 巴黎與覺醒 (Asnières)',
    year: '1887.06',
    portalZh: '穿過蒸汽火車白煙與朱紅鐵橋拱 → 化為浮世繪《雨中大橋（仿廣重）》',
    aspect: SEINE_ASPECT,
    skyMode: 3.0,
    fogNearHex: 0x5c96b4,
    fogFarHex: 0x8ec2dc,
    moonUVD: [uFromPaint(0.54, SEINE_ASPECT), 0.64, 13000],
    track: SEINE_TRACKS.standalone,
    generate: generateSeineChapter,
  },
  {
    id: 'plum',
    chapterId: 'color',
    roman: 'IX',
    shortZh: '雨中大橋',
    titleZh: '雨中大橋（仿廣重）',
    titleEn: 'Bridge in the Rain (after Hiroshige)',
    placeZh: 'Chapter II · 巴黎與覺醒 (Japonisme · Paris)',
    year: '1887.10',
    portalZh: '穿過雨中紙傘與漢字邊框 → 成為《唐吉老爹肖像》背後的浮世繪牆',
    aspect: PLUM_ASPECT,
    skyMode: 2.7,
    fogNearHex: 0x2e6468,
    fogFarHex: 0x18344e,
    moonUVD: [uFromPaint(0.48, PLUM_ASPECT), 0.56, 12800],
    track: PLUM_TRACKS.standalone,
    generate: generatePlumChapter,
  },
  {
    id: 'tanguy',
    chapterId: 'color',
    roman: 'X',
    shortZh: '唐吉老爹',
    titleZh: '唐吉老爹肖像',
    titleEn: 'Portrait of Père Tanguy',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)',
    year: '1887.11',
    portalZh: '由唐吉老爹慈祥雙眼轉向畫架前 → 對視《戴草帽的自畫像》',
    aspect: TANGUY_ASPECT,
    skyMode: 2.4,
    fogNearHex: 0x3b587e,
    fogFarHex: 0x6882a4,
    moonUVD: [uFromPaint(0.50, TANGUY_ASPECT), 0.86, 12600],
    track: TANGUY_TRACKS.standalone,
    generate: generateTanguyChapter,
  },
  {
    id: 'selfportrait',
    chapterId: 'color',
    roman: 'XI',
    shortZh: '自畫像',
    titleZh: '戴草帽的自畫像',
    titleEn: 'Self-Portrait with Straw Hat',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)',
    year: '1887.08',
    portalZh: '飛入畫家翠綠瞳孔與金黃草帽光環 → 沐浴亞爾《黃色小屋》的南方烈日',
    aspect: SELFPORTRAIT_ASPECT,
    skyMode: 2.2,
    fogNearHex: 0x244678,
    fogFarHex: 0x162b52,
    moonUVD: [uFromPaint(0.49, SELFPORTRAIT_ASPECT), 0.56, 12400],
    track: SELFPORTRAIT_TRACKS.standalone,
    generate: generateSelfPortraitChapter,
  },

  // ================= CHAPTER III: SUN (Arles, 1888–1889) =================
  {
    id: 'yellowhouse',
    chapterId: 'sun',
    roman: 'XII',
    shortZh: '黃色小屋',
    titleZh: '黃色小屋（街景）',
    titleEn: 'The Yellow House (The Street)',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)',
    year: '1888.09',
    portalZh: '推開二樓翠綠百葉窗走進室內 → 看見桌上迎賓的十五朵《向日葵》',
    aspect: YELLOWHOUSE_ASPECT,
    skyMode: 2.5,
    fogNearHex: 0x385284,
    fogFarHex: 0x182c64,
    moonUVD: [uFromPaint(0.48, YELLOWHOUSE_ASPECT), 0.62, 12800],
    track: YELLOWHOUSE_TRACKS.standalone,
    generate: generateYellowHouseChapter,
  },
  {
    id: 'sunflowers',
    chapterId: 'sun',
    roman: 'XIII',
    shortZh: '向日葵',
    titleZh: '向日葵',
    titleEn: 'Sunflowers',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)',
    year: '1888.08',
    portalZh: '穿過中央向日葵燃燒的金色花盤核心 → 飛向陽光普照的《克勞平原的豐收》',
    aspect: SUNFLOWERS_ASPECT,
    skyMode: 2.6,
    fogNearHex: 0x8c6818,
    fogFarHex: 0xb88e28,
    moonUVD: [uFromPaint(0.50, SUNFLOWERS_ASPECT), 0.72, 12600],
    track: SUNFLOWERS_TRACKS.standalone,
    generate: generateSunflowersChapter,
  },
  {
    id: 'harvest',
    chapterId: 'sun',
    roman: 'XIV',
    shortZh: '克勞豐收',
    titleZh: '克勞平原的豐收',
    titleEn: 'The Harvest at La Crau',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)',
    year: '1888.06',
    portalZh: '迎向阿爾皮耶山巔傾瀉的午後金光 → 步入《夕陽下的播種者》',
    aspect: HARVEST_ASPECT,
    skyMode: 2.9,
    fogNearHex: 0x7c8e58,
    fogFarHex: 0x5ea8be,
    moonUVD: [uFromPaint(0.52, HARVEST_ASPECT), 0.84, 13200],
    track: HARVEST_TRACKS.standalone,
    generate: generateHarvestChapter,
  },
  {
    id: 'sower',
    chapterId: 'sun',
    roman: 'XV',
    shortZh: '夕陽播種者',
    titleZh: '夕陽下的播種者',
    titleEn: 'The Sower at Sunset',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)',
    year: '1888.11',
    portalZh: '穿過碩大檸檬黃落日光輪 → 入夜點亮《夜間咖啡座》的瓦斯燈',
    aspect: SOWER_ASPECT,
    skyMode: 2.6,
    fogNearHex: 0x6e6828,
    fogFarHex: 0xb8b428,
    moonUVD: [uFromPaint(0.58, SOWER_ASPECT), 0.60, 12200],
    track: SOWER_TRACKS.standalone,
    generate: generateSowerChapter,
  },
  {
    id: 'cafe',
    chapterId: 'sun',
    roman: 'XVI',
    shortZh: '夜間咖啡座',
    titleZh: '夜間露天咖啡座',
    titleEn: 'Café Terrace at Night',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)',
    year: '1888.09',
    portalZh: '走入街角咖啡館深處門廊 → 踏進血紅與翠綠對撞的《夜間咖啡館》室內',
    aspect: CAFE_ASPECT,
    skyMode: 1,
    fogNearHex: 0x162458,
    fogFarHex: 0x0b1634,
    moonUVD: [uFromPaint(0.20, CAFE_ASPECT), 0.60, 460],
    track: CAFE_TRACKS.standalone,
    generate: generateCafeChapter,
  },
  {
    id: 'nightcafe',
    chapterId: 'sun',
    roman: 'XVII',
    shortZh: '夜間咖啡館',
    titleZh: '夜間咖啡館',
    titleEn: 'The Night Café',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)',
    year: '1888.09',
    portalZh: '穿過天花板眩目的瓦斯燈光環走出夜街 → 迎見《隆河上的星夜》',
    aspect: NIGHTCAFE_ASPECT,
    skyMode: 1.2,
    fogNearHex: 0x5c2418,
    fogFarHex: 0x26482e,
    moonUVD: [uFromPaint(0.52, NIGHTCAFE_ASPECT), 0.50, 12400],
    track: NIGHTCAFE_TRACKS.standalone,
    generate: generateNightCafeChapter,
  },
  {
    id: 'rhone',
    chapterId: 'sun',
    roman: 'XVIII',
    shortZh: '隆河星夜',
    titleZh: '隆河上的星夜',
    titleEn: 'Starry Night Over the Rhône',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)',
    year: '1888.09',
    portalZh: '飛入對岸暖黃窗燈 → 走進亞爾黃色小屋臥室',
    aspect: RHONE_ASPECT,
    skyMode: 1.5,
    fogNearHex: 0x122b52,
    fogFarHex: 0x091730,
    moonUVD: [uFromPaint(0.68, RHONE_ASPECT), 0.75, 12100],
    track: RHONE_TRACKS.standalone,
    generate: generateRhoneChapter,
  },
  {
    id: 'bedroom',
    chapterId: 'sun',
    roman: 'XIX',
    shortZh: '亞爾臥室',
    titleZh: '在亞爾的臥室',
    titleEn: 'The Bedroom in Arles',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)',
    year: '1888.10',
    portalZh: '推開半掩的綠色百葉窗 → 飛入聖雷米星夜',
    aspect: BEDROOM_ASPECT,
    skyMode: 1.8,
    fogNearHex: 0x3b4f7c,
    fogFarHex: 0x1f2d52,
    moonUVD: [uFromPaint(0.40, BEDROOM_ASPECT), 0.70, 540],
    track: BEDROOM_TRACKS.standalone,
    generate: generateBedroomChapter,
  },

  // ================= CHAPTER IV: COSMOS (Saint-Rémy, 1889–1890) =================
  {
    id: 'starry',
    chapterId: 'cosmos',
    roman: 'XX',
    shortZh: '星夜',
    titleZh: '星夜',
    titleEn: 'The Starry Night',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)',
    year: '1889.06',
    portalZh: '迎向熾熱橘黃新月 → 晨光降落聖保羅療養院花園的《鳶尾花》',
    aspect: CANVAS_ASPECT,
    skyMode: 0,
    fogNearHex: shadeHex(PALETTE.ultramarine, 0.5),
    fogFarHex: PALETTE.prussian,
    moonUVD: [MOON_DEF.u, MOON_DEF.v, MOON_DEF.d],
    track: STARRY_TRACK,
    generate: generateStarryChapter,
  },
  {
    id: 'irises',
    chapterId: 'cosmos',
    roman: 'XXI',
    shortZh: '鳶尾花',
    titleZh: '鳶尾花',
    titleEn: 'Irises',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)',
    year: '1889.05',
    portalZh: '穿過孤傲盛開的純白鳶尾花 → 走入金色斜陽下的《橄欖樹與太陽》',
    aspect: IRISES_ASPECT,
    skyMode: 2.8,
    fogNearHex: 0x3c684e,
    fogFarHex: 0x628c6c,
    moonUVD: [uFromPaint(0.24, IRISES_ASPECT), 0.58, 12400],
    track: IRISES_TRACKS.standalone,
    generate: generateIrisesChapter,
  },
  {
    id: 'olive',
    chapterId: 'cosmos',
    roman: 'XXII',
    shortZh: '橄欖樹與日',
    titleZh: '橄欖樹與黃色天空及太陽',
    titleEn: 'Olive Trees with Yellow Sky and Sun',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)',
    year: '1889.11',
    portalZh: '穿過檸檬黃太陽的同心圓光波 → 迎風展開《有絲柏的麥田》',
    aspect: OLIVE_ASPECT,
    skyMode: 2.6,
    fogNearHex: 0x7c7438,
    fogFarHex: 0xc8a832,
    moonUVD: [uFromPaint(0.54, OLIVE_ASPECT), 0.80, 12400],
    track: OLIVE_TRACKS.standalone,
    generate: generateOliveChapter,
  },
  {
    id: 'wheat',
    chapterId: 'cosmos',
    roman: 'XXIII',
    shortZh: '絲柏麥田',
    titleZh: '有絲柏的麥田',
    titleEn: 'Wheat Field with Cypresses',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)',
    year: '1889.07',
    portalZh: '順著麥田邊緣小徑步入暮色 → 仰望《有絲柏與星辰的道路》',
    aspect: WHEAT_ASPECT,
    skyMode: 3,
    fogNearHex: 0x4b7fa2,
    fogFarHex: 0x7aa6b8,
    moonUVD: [uFromPaint(0.82, WHEAT_ASPECT), 0.86, 14000],
    track: WHEAT_TRACKS.standalone,
    generate: generateWheatChapter,
  },
  {
    id: 'roadcypress',
    chapterId: 'cosmos',
    roman: 'XXIV',
    shortZh: '絲柏星辰路',
    titleZh: '有絲柏與星辰的道路',
    titleEn: 'Road with Cypress and Star',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)',
    year: '1890.05',
    portalZh: '穿過絲柏尖端與新月光環 → 迎來象徵新生的春日《盛開的杏花》',
    aspect: ROADCYPRESS_ASPECT,
    skyMode: 1.4,
    fogNearHex: 0x162e58,
    fogFarHex: 0x0c1a38,
    moonUVD: [uFromPaint(0.76, ROADCYPRESS_ASPECT), 0.78, 12200],
    track: ROADCYPRESS_TRACKS.standalone,
    generate: generateRoadCypressChapter,
  },
  {
    id: 'almond',
    chapterId: 'cosmos',
    roman: 'XXV',
    shortZh: '盛開杏花',
    titleZh: '盛開的杏花',
    titleEn: 'Almond Blossom',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)',
    year: '1890.02',
    portalZh: '穿越飄落花雨與蔚藍晴空 → 北上抵達瓦茲河谷《奧維的茅草屋》',
    aspect: ALMOND_ASPECT,
    skyMode: 3,
    fogNearHex: 0x488e9e,
    fogFarHex: 0x6cb4be,
    moonUVD: [uFromPaint(0.50, ALMOND_ASPECT), 0.65, 9500],
    track: ALMOND_TRACKS.standalone,
    generate: generateAlmondChapter,
  },

  // ================= CHAPTER V: ROAD (Auvers-sur-Oise, May–July 1890) =================
  {
    id: 'cottages',
    chapterId: 'road',
    roman: 'XXVI',
    shortZh: '奧維茅草屋',
    titleZh: '奧維的茅草屋',
    titleEn: 'Thatched Cottages at Cordeville',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers-sur-Oise)',
    year: '1890.05',
    portalZh: '順著茅草屋前的綠茵小徑前行 → 仰望《奧維的教堂》',
    aspect: COTTAGES_ASPECT,
    skyMode: 2.8,
    fogNearHex: 0x3b646e,
    fogFarHex: 0x5c8aa8,
    moonUVD: [uFromPaint(0.34, COTTAGES_ASPECT), 0.80, 13000],
    track: COTTAGES_TRACKS.standalone,
    generate: generateCottagesChapter,
  },
  {
    id: 'church',
    chapterId: 'road',
    roman: 'XXVII',
    shortZh: '奧維爾教堂',
    titleZh: '奧維爾的教堂',
    titleEn: 'The Church at Auvers',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers-sur-Oise)',
    year: '1890.06',
    portalZh: '穿過鐘樓群青風暴 → 對視奧維爾知己《嘉舍醫師畫像》',
    aspect: CHURCH_ASPECT,
    skyMode: 0.4,
    fogNearHex: 0x16265c,
    fogFarHex: 0x0c173c,
    moonUVD: [uFromPaint(0.25, CHURCH_ASPECT), 0.82, 12000],
    track: CHURCH_TRACKS.standalone,
    generate: generateChurchChapter,
  },
  {
    id: 'gachet',
    chapterId: 'road',
    roman: 'XXVIII',
    shortZh: '嘉舍醫師',
    titleZh: '嘉舍醫師畫像',
    titleEn: 'Portrait of Dr. Gachet',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers-sur-Oise)',
    year: '1890.06',
    portalZh: '順著紅桌上的毛地黃花枝走出診間 → 漫步 2:1 超寬全景《多比尼的花園》',
    aspect: GACHET_ASPECT,
    skyMode: 0.9,
    fogNearHex: 0x1c3468,
    fogFarHex: 0x102044,
    moonUVD: [uFromPaint(0.54, GACHET_ASPECT), 0.60, 12500],
    track: GACHET_TRACKS.standalone,
    generate: generateGachetChapter,
  },
  {
    id: 'daubigny',
    chapterId: 'road',
    roman: 'XXIX',
    shortZh: '多比尼花園',
    titleZh: '多比尼的花園',
    titleEn: "Daubigny's Garden",
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers-sur-Oise)',
    year: '1890.07',
    portalZh: '飛越別墅屋頂與尖塔 → 衝入同為 2:1 超寬銀幕的終章《麥田群鴉》',
    aspect: DAUBIGNY_ASPECT,
    skyMode: 2.9,
    fogNearHex: 0x5c8e78,
    fogFarHex: 0x8ec4ba,
    moonUVD: [uFromPaint(0.52, DAUBIGNY_ASPECT), 0.74, 13000],
    track: DAUBIGNY_TRACKS.standalone,
    generate: generateDaubignyChapter,
  },
  {
    id: 'crows',
    chapterId: 'road',
    roman: 'XXX',
    shortZh: '麥田群鴉',
    titleZh: '麥田群鴉',
    titleEn: 'Wheatfield with Crows',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers-sur-Oise)',
    year: '1890.07',
    portalZh: '穿過迎面驚飛的黑鴉群 → 落回最初的黑土與《食薯者》油燈',
    aspect: CROWS_ASPECT,
    skyMode: 0.2,
    fogNearHex: 0x14224a,
    fogFarHex: 0x081026,
    moonUVD: [uFromPaint(0.58, CROWS_ASPECT), 0.78, 14000],
    track: CROWS_TRACKS.standalone,
    generate: generateCrowsChapter,
  },
];

/** O(1) lookup map from PaintingId to PaintingSpec (eliminates linear array scan per frame). */
const PAINTING_SPEC_MAP: ReadonlyMap<PaintingId, PaintingSpec> = new Map(
  PAINTING_SUITE.map((spec) => [spec.id, spec]),
);
const STARRY_FALLBACK_SPEC: PaintingSpec = PAINTING_SPEC_MAP.get('starry') ?? PAINTING_SUITE[0];

export const ODYSSEY_TRACK: ChapterTrack = compilePathTrack(DEFAULT_ODYSSEY_SEQUENCE);

export function getPaintingSpec(id: PaintingId): PaintingSpec {
  return PAINTING_SPEC_MAP.get(id) ?? STARRY_FALLBACK_SPEC;
}

export function getPaintingActStart(
  id: PaintingId,
  sequence: readonly PaintingId[] = DEFAULT_ODYSSEY_SEQUENCE,
): number {
  const idx = sequence.indexOf(id);
  return Math.max(0, idx) * ACT_SECONDS;
}

export function nextPaintingId(
  id: PaintingId,
  dir: 1 | -1 = 1,
  sequence: readonly PaintingId[] = DEFAULT_ODYSSEY_SEQUENCE,
): PaintingId {
  const idx = sequence.indexOf(id);
  if (idx === -1) return sequence[0];
  const next = (idx + dir + sequence.length) % sequence.length;
  return sequence[next];
}
