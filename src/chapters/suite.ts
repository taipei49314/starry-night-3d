// Multi-Punctum Suite & Van Gogh World System Registry (5 Grand Chapters, 10 Iconic Worlds, 1885–1890):
//   Chapter I   (Earth · Nuenen):    1. The Potato Eaters (1885)
//   Chapter II  (Color · Paris):     2. Boulevard de Clichy (1887)
//   Chapter III (Sun · Arles):       3. Café Terrace at Night (1888)
//                                    4. Starry Night Over the Rhône (1888)
//                                    5. The Bedroom in Arles (1888)
//   Chapter IV  (Cosmos · St-Rémy):  6. The Starry Night (1889)
//                                    7. Wheat Field with Cypresses (1889)
//                                    8. Almond Blossom (1890)
//   Chapter V   (Road · Auvers):     9. The Church at Auvers (1890)
//                                   10. Wheatfield with Crows (1890)
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
import { PARIS_ASPECT, generateParisChapter } from './parisGen';
import { CAFE_ASPECT, generateCafeChapter } from './cafeGen';
import { RHONE_ASPECT, generateRhoneChapter } from './rhoneGen';
import { BEDROOM_ASPECT, generateBedroomChapter } from './bedroomGen';
import { WHEAT_ASPECT, generateWheatChapter } from './wheatGen';
import { ALMOND_ASPECT, generateAlmondChapter } from './almondGen';
import { CHURCH_ASPECT, generateChurchChapter } from './churchGen';
import { CROWS_ASPECT, generateCrowsChapter } from './crowsGen';
import { clamp, clamp01, smoothstep, uFromPaint, type ChapterId, type PaintingId } from './types';

export interface ChapterTrack {
  readonly loopSeconds: number;
  readonly aspect: number;
  readonly shots: readonly ShotDef[];
  readonly shotStarts: readonly number[];
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
 *  - Shot 5 (tHome..loopSeconds): Reverse dolly-zoom homecoming H0 -> E along F while strokes cross-dissolve.
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
  ) {
    this.shotStarts = shots.map((s) => s.t0);
  }

  position(t: number, out: Vector3): Vector3 {
    const tc = clamp(t, 0, this.loopSeconds);
    if (tc <= this.tHold) return out.copy(EYE);
    if (tc >= this.tHome) {
      const span = Math.max(0.5, this.loopSeconds - this.tHome - 0.35);
      const s = tc >= this.tHome + span ? 0 : 360 * (1 - ease.inOutCubic((tc - this.tHome) / span));
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
    this.position(tc, out.pos);
    if (tc <= this.tHold) {
      out.dir.copy(FORWARD);
      out.fovDeg = 36;
      out.rollDeg = 0;
      out.shotIndex = 0;
      out.shotT = tc / Math.max(1e-4, this.tHold);
      out.cut = tc < 1e-4;
      return out;
    }
    if (tc >= this.tHome) {
      const span = Math.max(0.5, this.loopSeconds - this.tHome - 0.35);
      const s = tc >= this.tHome + span ? 0 : 360 * (1 - ease.inOutCubic((tc - this.tHome) / span));
      out.dir.copy(FORWARD);
      out.fovDeg = dollyZoomFov(36, 675, Math.max(0, 675 - s));
      out.rollDeg = 0;
      out.shotIndex = this.shots.length - 1;
      out.shotT = (tc - this.tHome) / Math.max(1e-4, this.loopSeconds - this.tHome);
      out.cut = false;
      return out;
    }
    const wps = this.waypoints;
    let i = 0;
    while (i < wps.length - 2 && tc >= wps[i + 1].t) i++;
    const w1 = wps[i];
    const w2 = wps[i + 1];
    const u = ease.inOutSine(clamp01((tc - w1.t) / Math.max(1e-5, w2.t - w1.t)));
    this.sampleLook(tc, _look);
    out.dir.subVectors(_look, out.pos);
    if (out.dir.lengthSq() < 1e-9) out.dir.copy(FORWARD);
    else out.dir.normalize();
    out.fovDeg = w1.fov + (w2.fov - w1.fov) * u;
    out.rollDeg = w1.roll + (w2.roll - w1.roll) * u;
    let si = 0;
    for (let k = this.shots.length - 1; k >= 0; k--) {
      if (tc >= this.shots[k].t0) { si = k; break; }
    }
    const sh = this.shots[si];
    out.shotIndex = si;
    out.shotT = clamp01((tc - sh.t0) / Math.max(1e-4, sh.t1 - sh.t0));
    out.cut = false;
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
    const stormStart = this.tHome - 2.6;
    const stormPeak = this.tHome + 0.8;
    const snapAt = this.loopSeconds - 1.2;
    out.matte = tc < this.tHold
      ? 1 - smoothstep(this.tHold - 1.0, this.tHold, tc)
      : tc > snapAt - 0.8
        ? smoothstep(snapAt - 0.8, this.loopSeconds - 0.15, tc)
        : 0;
    out.impastoGain = 0.3 + 0.7 * smoothstep(2, 80, camDistFromE);
    out.galleryLightDeg = 32;
    out.exposure = 0;
    out.bloom = this.baseBloom + 0.18 * smoothstep(14, 24, tc) * (1 - smoothstep(26, 38, tc));
    const smPeak = calm ? 0.12 : 0.28;
    out.smear = smPeak * smoothstep(this.tHold + 1, this.tHold + 7, tc) * (1 - smoothstep(stormStart - 2, this.tHome, tc));
    out.storm = tc >= stormStart && tc < snapAt
      ? smoothstep(stormStart, stormPeak, tc) * (1 - 0.18 * smoothstep(stormPeak, snapAt, tc))
      : 0;
    out.snapTrigger = Math.abs(tc - snapAt) < 0.12;
    out.fade = 0;
    out.dust = 0.55 * smoothstep(5, 80, camDistFromE) * (1 - smoothstep(this.tHome + 1, this.loopSeconds, tc));
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
  shotNames: readonly [string, string, string, string],
  portalPts: readonly [PortalWp, PortalWp, PortalWp, PortalWp, PortalWp],
  baseBloom: number,
): { standalone: CompanionTrack; odysseyAct: CompanionTrack } {
  const standalone = new CompanionTrack(
    aspect,
    [
      { index: 0, name: shotNames[0], t0: 0, t1: 6, setPiece: `${actLabel} · 畫框凝視` },
      { index: 1, name: shotNames[1], t0: 6, t1: 18, setPiece: shotNames[1] },
      { index: 2, name: shotNames[2], t0: 18, t1: 30, setPiece: shotNames[2] },
      { index: 3, name: shotNames[3], t0: 30, t1: 40, setPiece: shotNames[3] },
      { index: 4, name: '重返畫家之眼', t0: 40, t1: 48, setPiece: '任意門歸位' },
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
  );

  const odysseyAct = new CompanionTrack(
    aspect,
    [
      { index: 0, name: `${actLabel} · ${shotNames[0]}`, t0: 0,    t1: 3.8,  setPiece: shotNames[0] },
      { index: 1, name: `${actLabel} · ${shotNames[1]}`, t0: 3.8,  t1: 11.5, setPiece: shotNames[1] },
      { index: 2, name: `${actLabel} · ${shotNames[2]}`, t0: 11.5, t1: 19.5, setPiece: shotNames[2] },
      { index: 3, name: `${actLabel} · ${shotNames[3]}`, t0: 19.5, t1: 30.0, setPiece: shotNames[3] },
    ],
    [
      { t: 3.8,  pos: EYE.clone(), lookAt: E_TARGET.clone(), fov: 36, roll: 0 },
      { t: 7.2,  ...portalPts[0] },
      { t: 11.0, ...portalPts[1] },
      { t: 15.0, ...portalPts[2] },
      { t: 18.8, ...portalPts[3] },
      { t: 22.0, ...portalPts[4] },
      { t: 24.6, pos: H0.clone(),  lookAt: E_TARGET.clone(), fov: dollyZoomFov(36, 675, 315), roll: 0 },
    ],
    baseBloom,
    30,
    3.8,
    24.6,
  );

  return { standalone, odysseyAct };
}

// 1. Chapter I (Earth): The Potato Eaters -> Portal: Hanging Oil Lamp Flame -> Paris
const POTATO_TRACKS = makeChapterTracks(
  POTATO_ASPECT, 'Ch.I 食薯者',
  ['荷蘭農舍黑土畫幅', '粗陶木桌與熱氣馬鈴薯盤', '油燈明暗對比下的農夫臉龐', '飛入懸掛油燈火芯任意門 → 巴黎覺醒'],
  [
    { pos: pt(POTATO_ASPECT, 0.32, 0.24, 195), lookAt: pt(POTATO_ASPECT, 0.48, 0.34, 460),   fov: 42, roll: -1.5 },
    { pos: pt(POTATO_ASPECT, 0.44, 0.32, 260), lookAt: pt(POTATO_ASPECT, 0.65, 0.48, 510),   fov: 45, roll: 1.5 },
    { pos: pt(POTATO_ASPECT, 0.58, 0.40, 310), lookAt: pt(POTATO_ASPECT, 0.35, 0.52, 520),   fov: 46, roll: -1.5 },
    { pos: pt(POTATO_ASPECT, 0.48, 0.62, 360), lookAt: pt(POTATO_ASPECT, 0.50, 0.78, 480),   fov: 48, roll: 1.0 },
    { pos: pt(POTATO_ASPECT, 0.50, 0.76, 440), lookAt: pt(POTATO_ASPECT, 0.50, 0.78, 12200), fov: 52, roll: 0 },
  ],
  0.42,
);

// 2. Chapter II (Color): Boulevard de Clichy -> Portal: Sunlit Avenue Vanishing Point -> Arles
const PARIS_TRACKS = makeChapterTracks(
  PARIS_ASPECT, 'Ch.II 克利希大道',
  ['巴黎印象派點描畫幅', '粉藍珊瑚點描人行道與漫步市民', '奧斯曼公寓立面與行道春芽', '衝向大道驕陽消失點任意門 → 亞爾咖啡座'],
  [
    { pos: pt(PARIS_ASPECT, 0.36, 0.16, 185), lookAt: pt(PARIS_ASPECT, 0.46, 0.34, 520),   fov: 45, roll: -2 },
    { pos: pt(PARIS_ASPECT, 0.52, 0.24, 310), lookAt: pt(PARIS_ASPECT, 0.38, 0.38, 680),   fov: 48, roll: 2 },
    { pos: pt(PARIS_ASPECT, 0.42, 0.32, 480), lookAt: pt(PARIS_ASPECT, 0.48, 0.44, 960),   fov: 50, roll: -2 },
    { pos: pt(PARIS_ASPECT, 0.46, 0.42, 740), lookAt: pt(PARIS_ASPECT, 0.46, 0.52, 2400),  fov: 52, roll: 1.5 },
    { pos: pt(PARIS_ASPECT, 0.46, 0.50, 1250), lookAt: pt(PARIS_ASPECT, 0.46, 0.56, 13200), fov: 55, roll: 0 },
  ],
  0.46,
);

// 3. Chapter III (Sun): Café Terrace at Night -> Portal: Rue du Palais Star Canyon -> Rhône
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

// 4. Chapter III (Sun): Starry Night Over the Rhône -> Portal: Warm Golden Embankment Window -> Bedroom
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

// 5. Chapter III (Sun): The Bedroom in Arles -> Portal: Half-Open Green Shuttered Window -> Starry Night
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

// 6. Chapter IV (Cosmos): The Starry Night -> Portal: Orange Crescent Moon -> Wheat Field
const STARRY_ODYSSEY_TRACK = makeChapterTracks(
  CANVAS_ASPECT, 'Ch.IV 星夜',
  ['聖雷米夜空畫幅', '黑焰絲柏與金星光冕隧道', '穿越雙星雲大漩渦回望教堂尖塔', '衝入橘黃新月破曉任意門 → 絲柏麥田'],
  [
    { pos: pt(CANVAS_ASPECT, 0.20, 0.32, 185),   lookAt: pt(CANVAS_ASPECT, 0.28, 0.52, 420),   fov: 46, roll: -3 },
    { pos: pt(CANVAS_ASPECT, 0.33, 0.38, 2200),  lookAt: pt(CANVAS_ASPECT, 0.35, 0.36, 11800), fov: 50, roll: 2 },
    { pos: pt(CANVAS_ASPECT, 0.44, 0.56, 14500), lookAt: pt(CANVAS_ASPECT, 0.51, 0.64, 42000), fov: 56, roll: -3.5 },
    { pos: pt(CANVAS_ASPECT, 0.54, 0.34, 920),   lookAt: pt(CANVAS_ASPECT, 0.55, 0.20, 680),   fov: 46, roll: 1.5 },
    { pos: pt(CANVAS_ASPECT, 0.78, 0.74, 8200),  lookAt: pt(CANVAS_ASPECT, 0.85, 0.78, 12800), fov: 52, roll: -2 },
  ],
  0.55,
).odysseyAct;

// 7. Chapter IV (Cosmos): Wheat Field with Cypresses -> Portal: White Cumulus Vortex -> Almond Blossom
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

// 8. Chapter IV (Cosmos): Almond Blossom -> Portal: Deep Cerulean Sky Canopy -> The Church at Auvers
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

// 9. Chapter V (Road): The Church at Auvers -> Portal: Swirling Ultramarine Spire Sky -> Wheatfield with Crows
const CHURCH_TRACKS = makeChapterTracks(
  CHURCH_ASPECT, 'Ch.V 奧維爾的教堂',
  ['奧維爾直幅畫框', '分叉黃沙小徑與農婦背影', '扭曲哥德石牆與彩繪玻璃窗', '攀升鐘樓暗藍風暴任意門 → 麥田群鴉'],
  [
    { pos: pt(CHURCH_ASPECT, 0.32, 0.14, 185),  lookAt: pt(CHURCH_ASPECT, 0.18, 0.28, 320),   fov: 45, roll: -2.5 },
    { pos: pt(CHURCH_ASPECT, 0.24, 0.26, 285),  lookAt: pt(CHURCH_ASPECT, 0.48, 0.38, 350),   fov: 48, roll: 2 },
    { pos: pt(CHURCH_ASPECT, 0.54, 0.36, 330),  lookAt: pt(CHURCH_ASPECT, 0.47, 0.62, 620),   fov: 50, roll: -2 },
    { pos: pt(CHURCH_ASPECT, 0.48, 0.64, 560),  lookAt: pt(CHURCH_ASPECT, 0.47, 0.86, 690),   fov: 52, roll: 1.5 },
    { pos: pt(CHURCH_ASPECT, 0.48, 0.82, 2200), lookAt: pt(CHURCH_ASPECT, 0.48, 0.84, 48000), fov: 56, roll: -2 },
  ],
  0.48,
);

// 10. Chapter V (Road): Wheatfield with Crows -> Portal: Ascending Flock of Crows -> Return to Earth
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
  paris: PARIS_TRACKS.odysseyAct,
  cafe: CAFE_TRACKS.odysseyAct,
  rhone: RHONE_TRACKS.odysseyAct,
  bedroom: BEDROOM_TRACKS.odysseyAct,
  starry: STARRY_ODYSSEY_TRACK,
  wheat: WHEAT_TRACKS.odysseyAct,
  almond: ALMOND_TRACKS.odysseyAct,
  church: CHURCH_TRACKS.odysseyAct,
  crows: CROWS_TRACKS.odysseyAct,
};

export const ACT_SECONDS = 30;
export const DEFAULT_ODYSSEY_SEQUENCE: readonly PaintingId[] = [
  'potato', 'paris', 'cafe', 'rhone', 'bedroom', 'starry', 'wheat', 'almond', 'church', 'crows',
];

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
}

/**
 * Evaluate the Continuous Path Morph state at master clock `t` for ANY sequence of paintings (`sequence`).
 * During the last 5.4 s of each 30 s Act (tau in [24.3, 29.7]), the outgoing painting's brushstrokes
 * unbind through its Spatial Portal while the next painting's brushstrokes condense in 3D and lock into
 * exact registration at E by tau = 29.7 s — making every Act boundary tau = 30.0 -> 0.0 100% seamless.
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

  if (tau >= 24.3 && n > 1) {
    const m = clamp01((tau - 24.3) / 5.3); // reaches 1.0 at tau = 29.6 s
    const pFade = 1 - smoothstep(0.08, 0.88, m);
    const sFade = smoothstep(0.06, 0.86, m);
    const pScat = 0.88 * smoothstep(0.0, 0.82, m);
    const sScat = 0.92 * Math.pow(1 - smoothstep(0.10, 0.96, m), 1.65);
    const atmoMix = smoothstep(0.10, 0.90, m);
    const displayAspect = specA.aspect + (specB.aspect - specA.aspect) * atmoMix;
    const activeId = m >= 0.55 ? specB.id : specA.id;
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
      snapIncoming: tau >= 28.4 && tau <= 29.8,
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
  };
}

/** Dynamic Path Compiler: builds a seamless multi-act ChapterTrack for any sequence of PaintingIds. */
export function compilePathTrack(sequence: readonly PaintingId[] = DEFAULT_ODYSSEY_SEQUENCE): ChapterTrack {
  const seq = sequence.length > 0 ? sequence : DEFAULT_ODYSSEY_SEQUENCE;
  const n = seq.length;
  const loopSeconds = n * ACT_SECONDS;
  const shots: ShotDef[] = [];
  seq.forEach((id, actIdx) => {
    const tr = ODYSSEY_ACT_BY_ID[id];
    const tBase = actIdx * ACT_SECONDS;
    tr.shots.forEach((s, j) => {
      shots.push({
        index: actIdx * 4 + j,
        name: s.name,
        t0: tBase + s.t0,
        t1: tBase + s.t1,
        setPiece: s.setPiece,
      });
    });
  });
  const shotStarts = shots.map((s) => s.t0);

  const split = (t: number): { tr: CompanionTrack; tau: number } => {
    const tw = ((t % loopSeconds) + loopSeconds) % loopSeconds;
    const idx = Math.min(n - 1, Math.floor(tw / ACT_SECONDS));
    return { tr: ODYSSEY_ACT_BY_ID[seq[idx]], tau: tw - idx * ACT_SECONDS };
  };

  return {
    loopSeconds,
    aspect: CANVAS_ASPECT,
    shots,
    shotStarts,
    aspectAt: (t: number) => evalOdysseyMorph(t, seq).displayAspect,
    position: (t: number, out: Vector3) => {
      const { tr, tau } = split(t);
      return tr.position(tau, out);
    },
    pose: (t: number, out: CamPose) => {
      const { tr, tau } = split(t);
      return tr.pose(tau, out);
    },
    velocity: (t: number, out: Vector3) => {
      const { tr, tau } = split(t);
      return tr.velocity(tau, out);
    },
    env: (t: number, camDistFromE: number, calm: boolean, out: EnvSample) => {
      const { tr, tau } = split(t);
      tr.env(tau, camDistFromE, calm, out);
      out.fade = 0;
      return out;
    },
  };
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
  {
    id: 'potato',
    chapterId: 'earth',
    roman: 'I',
    shortZh: '食薯者',
    titleZh: '食薯者',
    titleEn: 'The Potato Eaters',
    placeZh: 'Chapter I · 黑土與人 (荷蘭 Nuenen)',
    year: '1885.04',
    portalZh: '飛入中央懸掛油燈的暖金火芯 → 甦醒為巴黎點描色彩',
    aspect: POTATO_ASPECT,
    skyMode: 0.6,
    fogNearHex: 0x261d14,
    fogFarHex: 0x120e0a,
    moonUVD: [uFromPaint(0.50, POTATO_ASPECT), 0.78, 480],
    track: POTATO_TRACKS.standalone,
    generate: generatePotatoChapter,
  },
  {
    id: 'paris',
    chapterId: 'color',
    roman: 'II',
    shortZh: '克利希大道',
    titleZh: '克利希大道',
    titleEn: 'Boulevard de Clichy',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)',
    year: '1887.03',
    portalZh: '沿點描林蔭大道衝向南方驕陽 → 步入亞爾夜間咖啡座',
    aspect: PARIS_ASPECT,
    skyMode: 3,
    fogNearHex: 0x7a9eb8,
    fogFarHex: 0xa8c6dc,
    moonUVD: [uFromPaint(0.46, PARIS_ASPECT), 0.56, 13200],
    track: PARIS_TRACKS.standalone,
    generate: generateParisChapter,
  },
  {
    id: 'cafe',
    chapterId: 'sun',
    roman: 'III',
    shortZh: '夜間咖啡座',
    titleZh: '夜間露天咖啡座',
    titleEn: 'Café Terrace at Night',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)',
    year: '1888.09',
    portalZh: '穿過鵝卵石街尾星谷 → 步入隆河河畔',
    aspect: CAFE_ASPECT,
    skyMode: 1,
    fogNearHex: 0x162458,
    fogFarHex: 0x0b1634,
    moonUVD: [uFromPaint(0.20, CAFE_ASPECT), 0.60, 460],
    track: CAFE_TRACKS.standalone,
    generate: generateCafeChapter,
  },
  {
    id: 'rhone',
    chapterId: 'sun',
    roman: 'IV',
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
    roman: 'V',
    shortZh: '亞爾的臥室',
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
  {
    id: 'starry',
    chapterId: 'cosmos',
    roman: 'VI',
    shortZh: '星夜',
    titleZh: '星夜',
    titleEn: 'The Starry Night',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)',
    year: '1889.06',
    portalZh: '迎向熾熱橘黃新月 → 聖雷米破曉化為金色麥田',
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
    chapterId: 'cosmos',
    roman: 'VII',
    shortZh: '絲柏麥田',
    titleZh: '有絲柏的麥田',
    titleEn: 'Wheat Field with Cypresses',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)',
    year: '1889.07',
    portalZh: '衝入松石綠晴空與翻滾白雲 → 凝結為春日盛開杏花',
    aspect: WHEAT_ASPECT,
    skyMode: 3,
    fogNearHex: 0x4b7fa2,
    fogFarHex: 0x7aa6b8,
    moonUVD: [uFromPaint(0.82, WHEAT_ASPECT), 0.86, 14000],
    track: WHEAT_TRACKS.standalone,
    generate: generateWheatChapter,
  },
  {
    id: 'almond',
    chapterId: 'cosmos',
    roman: 'VIII',
    shortZh: '盛開的杏花',
    titleZh: '盛開的杏花',
    titleEn: 'Almond Blossom',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)',
    year: '1890.02',
    portalZh: '穿越飄落花雨與蔚藍晴空 → 北上奧維爾哥德教堂',
    aspect: ALMOND_ASPECT,
    skyMode: 3,
    fogNearHex: 0x488e9e,
    fogFarHex: 0x6cb4be,
    moonUVD: [uFromPaint(0.50, ALMOND_ASPECT), 0.65, 9500],
    track: ALMOND_TRACKS.standalone,
    generate: generateAlmondChapter,
  },
  {
    id: 'church',
    chapterId: 'road',
    roman: 'IX',
    shortZh: '奧維爾教堂',
    titleZh: '奧維爾的教堂',
    titleEn: 'The Church at Auvers',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers-sur-Oise)',
    year: '1890.06',
    portalZh: '攀升鐘樓尖頂暗藍風暴 → 拉開 2:1 超寬銀幕麥田群鴉',
    aspect: CHURCH_ASPECT,
    skyMode: 0.4,
    fogNearHex: 0x16265c,
    fogFarHex: 0x0c173c,
    moonUVD: [uFromPaint(0.25, CHURCH_ASPECT), 0.82, 12000],
    track: CHURCH_TRACKS.standalone,
    generate: generateChurchChapter,
  },
  {
    id: 'crows',
    chapterId: 'road',
    roman: 'X',
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

export const ODYSSEY_TRACK: ChapterTrack = compilePathTrack(DEFAULT_ODYSSEY_SEQUENCE);

export function getPaintingSpec(id: PaintingId): PaintingSpec {
  return PAINTING_SUITE.find((p) => p.id === id) ?? PAINTING_SUITE[5];
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
