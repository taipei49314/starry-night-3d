// Multi-Punctum Suite Registry: defines the 8-Act Van Gogh Odyssey (1888-1890)
//   I.   Café Terrace at Night (Arles, Sept 1888)
//   II.  Starry Night Over the Rhône (Arles, Sept 1888)
//   III. The Bedroom in Arles (Arles, Oct 1888 / Saint-Rémy 1889)
//   IV.  The Starry Night (Saint-Rémy, June 1889)
//   V.   Wheat Field with Cypresses (Saint-Rémy, July 1889)
//   VI.  Almond Blossom (Saint-Rémy, Feb 1890)
//   VII. The Church at Auvers (Auvers-sur-Oise, June 1890)
//   VIII.Wheatfield with Crows (Auvers-sur-Oise, July 1890)
// Includes standalone 48s/96s chapter tracks AND the unified 240-second 8-Act Continuous Odyssey Track
// with Diegetic Spatial Portal choreography and Dual-World 3D Brushstroke Cross-Dissolve.
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
import { BEDROOM_ASPECT, generateBedroomChapter } from './bedroomGen';
import { WHEAT_ASPECT, generateWheatChapter } from './wheatGen';
import { ALMOND_ASPECT, generateAlmondChapter } from './almondGen';
import { CHURCH_ASPECT, generateChurchChapter } from './churchGen';
import { CROWS_ASPECT, generateCrowsChapter } from './crowsGen';
import { clamp, clamp01, smoothstep, uFromPaint, type PaintingId } from './types';

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
    this.evalSplinePos(tc, out);
    return out;
  }

  pose(t: number, out: CamPose): CamPose {
    const tc = clamp(t, 0, this.loopSeconds);
    if (tc <= this.tHold) {
      out.p.copy(EYE);
      out.d.copy(FORWARD);
      out.roll = 0;
      out.fov = 36;
      return out;
    }
    if (tc >= this.tHome) {
      const span = Math.max(0.5, this.loopSeconds - this.tHome - 0.35);
      const s = tc >= this.tHome + span ? 0 : 360 * (1 - ease.inOutCubic((tc - this.tHome) / span));
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
    const hEnd = this.loopSeconds - 0.35;
    const mClose0 = this.loopSeconds - 2.4;
    out.matte = tc <= this.tHold
      ? 1
      : tc < this.tHold + 1.6
        ? 1 - ease.inOutCubic((tc - this.tHold) / 1.6)
        : tc < mClose0
          ? 0
          : tc < hEnd
            ? ease.inOutCubic((tc - mClose0) / (hEnd - mClose0))
            : 1;
    const st0 = this.tHome - 5.5;
    out.storm = tc < st0 ? 0 : tc < st0 + 2.2 ? smoothstep(st0, st0 + 2.2, tc) : tc < this.tHome + 0.5 ? 1 : tc < this.tHome + 1.2 ? 1 - smoothstep(this.tHome + 0.5, this.tHome + 1.2, tc) : 0;
    let bloom = this.baseBloom + 0.35 * smoothstep(this.tHold + 2, this.tHome - 6, tc) * (1 - smoothstep(this.tHome - 2, this.tHome + 1, tc));
    if (tc > this.tHome + 0.4 && tc < this.tHome + 0.9) bloom += 0.38 * Math.sin((Math.PI * (tc - (this.tHome + 0.4))) / 0.5);
    out.bloom = bloom;
    out.exposure = 1.0;
    out.smear = calm ? 0 : 0.35 * smoothstep(this.tHold + 3, this.tHome - 8, tc) * (1 - smoothstep(this.tHome - 2, this.tHome + 1, tc));
    out.dust = tc < this.tHold ? 0 : tc < this.tHold + 3.5 ? smoothstep(this.tHold, this.tHold + 3.5, tc) : tc > this.tHome ? 0.3 * smoothstep(0.5, 40, camDistFromE) : 0.85;
    out.galleryLightDeg = tc < 1.5 ? -15 : tc < this.tHold ? -15 + 30 * ease.inOutSine((tc - 1.5) / Math.max(1, this.tHold - 1.5)) : tc < this.loopSeconds - 3.5 ? 15 : 15 - 30 * ease.inOutSine((tc - (this.loopSeconds - 3.5)) / 3.5);
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
    if (t > this.tHome - 3.2) {
      const k = ease.inOutSine((t - (this.tHome - 3.2)) / 3.2);
      out.d.lerp(FORWARD, k).normalize();
    }
    out.roll = w1.roll + (w2.roll - w1.roll) * es;
    out.fov = w1.fov + (w2.fov - w1.fov) * es;
  }
}

/** Helper to build both a 48 s standalone track and a 30 s Odyssey Act track from the same 5 normalized 3D portal waypoints. */
function makeChapterTracks(
  aspect: number,
  actIndex: number,
  actLabel: string,
  shotNames: readonly [string, string, string, string],
  portalPts: readonly [
    { pos: Vector3; lookAt: Vector3; fov: number; roll: number },
    { pos: Vector3; lookAt: Vector3; fov: number; roll: number },
    { pos: Vector3; lookAt: Vector3; fov: number; roll: number },
    { pos: Vector3; lookAt: Vector3; fov: number; roll: number },
    { pos: Vector3; lookAt: Vector3; fov: number; roll: number },
  ],
  baseBloom: number,
): { standalone: CompanionTrack; odysseyAct: CompanionTrack } {
  const standalone = new CompanionTrack(
    aspect,
    [
      { index: 0, name: shotNames[0], t0: 0, t1: 6, setPiece: shotNames[0] },
      { index: 1, name: shotNames[1], t0: 6, t1: 18, setPiece: shotNames[1] },
      { index: 2, name: shotNames[2], t0: 18, t1: 30, setPiece: shotNames[2] },
      { index: 3, name: shotNames[3], t0: 30, t1: 48, setPiece: shotNames[3] },
    ],
    [
      { t: 6,  pos: EYE.clone(), lookAt: E_TARGET.clone(), fov: 36, roll: 0 },
      { t: 11, ...portalPts[0] },
      { t: 17, ...portalPts[1] },
      { t: 23, ...portalPts[2] },
      { t: 29, ...portalPts[3] },
      { t: 35, ...portalPts[4] },
      { t: 40, pos: H0.clone(),  lookAt: E_TARGET.clone(), fov: dollyZoomFov(36, 675, 315), roll: 0 },
    ],
    baseBloom,
    48,
    6,
    40,
  );

  const tBase = actIndex * 30;
  const odysseyAct = new CompanionTrack(
    aspect,
    [
      { index: actIndex * 4,     name: `${actLabel} · ${shotNames[0]}`, t0: tBase + 0,    t1: tBase + 3.8,  setPiece: shotNames[0] },
      { index: actIndex * 4 + 1, name: `${actLabel} · ${shotNames[1]}`, t0: tBase + 3.8,  t1: tBase + 11.5, setPiece: shotNames[1] },
      { index: actIndex * 4 + 2, name: `${actLabel} · ${shotNames[2]}`, t0: tBase + 11.5, t1: tBase + 19.5, setPiece: shotNames[2] },
      { index: actIndex * 4 + 3, name: `${actLabel} · ${shotNames[3]}`, t0: tBase + 19.5, t1: tBase + 30.0, setPiece: shotNames[3] },
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

// Act I: Café Terrace at Night -> Portal: Rue du Palais Star Canyon -> Rhône
const CAFE_TRACKS = makeChapterTracks(
  CAFE_ASPECT, 0, 'I 夜間咖啡座',
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

// Act II: Starry Night Over the Rhône -> Portal: Warm Golden Embankment Window -> Bedroom in Arles
const RHONE_TRACKS = makeChapterTracks(
  RHONE_ASPECT, 1, 'II 隆河星夜',
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

// Act III: The Bedroom in Arles -> Portal: Half-Open Green Shuttered Window -> The Starry Night
const BEDROOM_TRACKS = makeChapterTracks(
  BEDROOM_ASPECT, 2, 'III 亞爾的臥室',
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

// Act IV: The Starry Night (Odyssey 30 s version; standalone uses canonical 96 s STARRY_TRACK) -> Portal: Orange Crescent Moon -> Wheat Field
const STARRY_ODYSSEY_TRACK = makeChapterTracks(
  CANVAS_ASPECT, 3, 'IV 星夜',
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

// Act V: Wheat Field with Cypresses -> Portal: White & Turquoise Cumulus Vortex -> Almond Blossom
const WHEAT_TRACKS = makeChapterTracks(
  WHEAT_ASPECT, 4, 'V 絲柏麥田',
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

// Act VI: Almond Blossom -> Portal: Deep Cerulean Sky Canopy -> The Church at Auvers
const ALMOND_TRACKS = makeChapterTracks(
  ALMOND_ASPECT, 5, 'VI 盛開的杏花',
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

// Act VII: The Church at Auvers -> Portal: Swirling Ultramarine Spire Sky -> Wheatfield with Crows
const CHURCH_TRACKS = makeChapterTracks(
  CHURCH_ASPECT, 6, 'VII 奧維爾的教堂',
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

// Act VIII: Wheatfield with Crows -> Portal: Ascending Flock of Crows into the Night -> Café Terrace at Night
const CROWS_TRACKS = makeChapterTracks(
  CROWS_ASPECT, 7, 'VIII 麥田群鴉',
  ['奧維爾 2:1 超寬銀幕畫幅', '紅綠分叉小徑與狂暴麥海', '迎風振翅驚飛的五十二隻黑鴉', '穿過鴉群風暴任意門 → 輪迴重返亞爾咖啡座'],
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

// ------------------------------------------------------------------ Unified 240 s 8-Act Continuous Odyssey Track
export const ACT_SECONDS = 30;
export const SUITE_COUNT = 8;
export const ODYSSEY_SECONDS = ACT_SECONDS * SUITE_COUNT; // 240 s (4m 00s) across all 8 paintings

const ODYSSEY_ACT_TRACKS: readonly CompanionTrack[] = [
  CAFE_TRACKS.odysseyAct,
  RHONE_TRACKS.odysseyAct,
  BEDROOM_TRACKS.odysseyAct,
  STARRY_ODYSSEY_TRACK,
  WHEAT_TRACKS.odysseyAct,
  ALMOND_TRACKS.odysseyAct,
  CHURCH_TRACKS.odysseyAct,
  CROWS_TRACKS.odysseyAct,
];

const ODYSSEY_SHOTS: readonly ShotDef[] = ODYSSEY_ACT_TRACKS.flatMap((tr) => tr.shots);
const ODYSSEY_SHOT_STARTS: readonly number[] = ODYSSEY_SHOTS.map((s) => s.t0);

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
 * Evaluate the closed-form 8-Act Continuous Odyssey state at master clock `t` in [0, 240).
 * During the last 5.4 s of each 30 s Act (tau in [24.3, 29.7]), the outgoing painting's brushstrokes
 * unbind through its Spatial Portal while the next painting's brushstrokes condense in 3D and lock into
 * exact registration at E by tau = 29.7 s — making every Act boundary tau = 30.0 -> 0.0 100% seamless.
 */
export function evalOdysseyMorph(t: number): OdysseyMorphState {
  const tw = ((t % ODYSSEY_SECONDS) + ODYSSEY_SECONDS) % ODYSSEY_SECONDS;
  const actIdx = Math.min(SUITE_COUNT - 1, Math.floor(tw / ACT_SECONDS));
  const nextIdx = (actIdx + 1) % SUITE_COUNT;
  const tau = tw - actIdx * ACT_SECONDS; // [0, 30)
  const specA = PAINTING_SUITE[actIdx];
  const specB = PAINTING_SUITE[nextIdx];

  if (tau >= 24.3) {
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

class OdysseyMasterTrack implements ChapterTrack {
  readonly loopSeconds = ODYSSEY_SECONDS;
  readonly shots = ODYSSEY_SHOTS;
  readonly shotStarts = ODYSSEY_SHOT_STARTS;

  get aspect(): number {
    return CANVAS_ASPECT;
  }

  aspectAt(t: number): number {
    return evalOdysseyMorph(t).displayAspect;
  }

  private split(t: number): { tr: CompanionTrack; tau: number } {
    const tw = ((t % ODYSSEY_SECONDS) + ODYSSEY_SECONDS) % ODYSSEY_SECONDS;
    const idx = Math.min(SUITE_COUNT - 1, Math.floor(tw / ACT_SECONDS));
    return { tr: ODYSSEY_ACT_TRACKS[idx], tau: tw - idx * ACT_SECONDS };
  }

  position(t: number, out: Vector3): Vector3 {
    const { tr, tau } = this.split(t);
    return tr.position(tau, out);
  }

  pose(t: number, out: CamPose): CamPose {
    const { tr, tau } = this.split(t);
    return tr.pose(tau, out);
  }

  velocity(t: number, out: Vector3): Vector3 {
    const { tr, tau } = this.split(t);
    return tr.velocity(tau, out);
  }

  env(t: number, camDistFromE: number, calm: boolean, out: EnvSample): EnvSample {
    const { tr, tau } = this.split(t);
    tr.env(tau, camDistFromE, calm, out);
    out.fade = 0;
    return out;
  }
}

export const ODYSSEY_TRACK: ChapterTrack = new OdysseyMasterTrack();

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
    shortZh: '夜間咖啡座',
    titleZh: '夜間露天咖啡座',
    titleEn: 'Café Terrace at Night',
    placeZh: '亞爾 · 論壇廣場',
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
    roman: 'II',
    shortZh: '隆河星夜',
    titleZh: '隆河上的星夜',
    titleEn: 'Starry Night Over the Rhône',
    placeZh: '亞爾 · 隆河河畔',
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
    roman: 'III',
    shortZh: '亞爾的臥室',
    titleZh: '在亞爾的臥室',
    titleEn: 'The Bedroom in Arles',
    placeZh: '亞爾 · 拉馬丁廣場黃色小屋',
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
    roman: 'IV',
    shortZh: '星夜',
    titleZh: '星夜',
    titleEn: 'The Starry Night',
    placeZh: '聖雷米 · 聖保羅療養院',
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
    roman: 'V',
    shortZh: '絲柏麥田',
    titleZh: '有絲柏的麥田',
    titleEn: 'Wheat Field with Cypresses',
    placeZh: '聖雷米 · 阿爾皮耶山麓',
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
    roman: 'VI',
    shortZh: '盛開的杏花',
    titleZh: '盛開的杏花',
    titleEn: 'Almond Blossom',
    placeZh: '聖雷米 · 新生禮讚',
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
    roman: 'VII',
    shortZh: '奧維爾教堂',
    titleZh: '奧維爾的教堂',
    titleEn: 'The Church at Auvers',
    placeZh: '奧維爾 · 瓦茲河谷',
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
    roman: 'VIII',
    shortZh: '麥田群鴉',
    titleZh: '麥田群鴉',
    titleEn: 'Wheatfield with Crows',
    placeZh: '奧維爾 · 暴風雨前的麥海',
    year: '1890.07',
    portalZh: '穿過迎面驚飛的黑鴉群 → 化為星塵重返亞爾夜間咖啡座',
    aspect: CROWS_ASPECT,
    skyMode: 0.2,
    fogNearHex: 0x14224a,
    fogFarHex: 0x081026,
    moonUVD: [uFromPaint(0.58, CROWS_ASPECT), 0.78, 14000],
    track: CROWS_TRACKS.standalone,
    generate: generateCrowsChapter,
  },
];

export function getPaintingSpec(id: PaintingId): PaintingSpec {
  return PAINTING_SUITE.find((p) => p.id === id) ?? PAINTING_SUITE[3];
}

export function getPaintingActStart(id: PaintingId): number {
  const idx = PAINTING_SUITE.findIndex((p) => p.id === id);
  return Math.max(0, idx) * ACT_SECONDS;
}

export function nextPaintingId(id: PaintingId, dir: 1 | -1 = 1): PaintingId {
  const idx = PAINTING_SUITE.findIndex((p) => p.id === id);
  const next = (idx + dir + PAINTING_SUITE.length) % PAINTING_SUITE.length;
  return PAINTING_SUITE[next].id;
}
