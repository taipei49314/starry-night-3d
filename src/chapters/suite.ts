// Multi-Punctum Suite Registry: defines the 4 Provençal Van Gogh chapters
// (I. Café Terrace -> II. Rhône -> III. Starry Night -> IV. Wheat Field),
// their analytic 3D camera tracks (ChapterTrack), the unified 144-second 4-Act Continuous Odyssey Track,
// and their procedural world generators.
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
  aspectAt?(t: number): number;
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
 * Analytic C1 Catmull-Rom + Homecoming track for a painting chapter (configurable duration, default 36 s or 48 s):
 *  - Shot 1 (0..tHold): Locked at EYE in the painting's matte frame.
 *  - Shots 2..4 (tHold..tHome): Smooth C1 spline through the painting's 3D landmarks, ending at H0 = E + 360 F.
 *  - Shot 5 (tHome..loopSeconds): Reverse dolly-zoom homecoming H0 -> E along F.
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
      const span = Math.max(0.5, this.loopSeconds - this.tHome - 0.4);
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
      const span = Math.max(0.5, this.loopSeconds - this.tHome - 0.4);
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
    const hEnd = this.loopSeconds - 0.4;
    const mClose0 = this.loopSeconds - 2.6;
    out.matte = tc <= this.tHold
      ? 1
      : tc < this.tHold + 1.8
        ? 1 - ease.inOutCubic((tc - this.tHold) / 1.8)
        : tc < mClose0
          ? 0
          : tc < hEnd
            ? ease.inOutCubic((tc - mClose0) / (hEnd - mClose0))
            : 1;
    const st0 = this.tHome - 6.5;
    out.storm = tc < st0 ? 0 : tc < st0 + 2.5 ? smoothstep(st0, st0 + 2.5, tc) : tc < this.tHome + 0.5 ? 1 : tc < this.tHome + 1.2 ? 1 - smoothstep(this.tHome + 0.5, this.tHome + 1.2, tc) : 0;
    let bloom = this.baseBloom + 0.35 * smoothstep(this.tHold + 2, this.tHome - 8, tc) * (1 - smoothstep(this.tHome - 2, this.tHome + 1, tc));
    if (tc > this.tHome + 0.4 && tc < this.tHome + 0.9) bloom += 0.38 * Math.sin((Math.PI * (tc - (this.tHome + 0.4))) / 0.5);
    out.bloom = bloom;
    out.exposure = 1.0;
    out.smear = calm ? 0 : 0.35 * smoothstep(this.tHold + 3, this.tHome - 12, tc) * (1 - smoothstep(this.tHome - 2, this.tHome + 1, tc));
    out.dust = tc < this.tHold ? 0 : tc < this.tHold + 4 ? smoothstep(this.tHold, this.tHold + 4, tc) : tc > this.tHome ? 0.3 * smoothstep(0.5, 40, camDistFromE) : 0.85;
    out.galleryLightDeg = tc < 2 ? -15 : tc < this.tHold ? -15 + 30 * ease.inOutSine((tc - 2) / Math.max(1, this.tHold - 2)) : tc < this.loopSeconds - 4 ? 15 : 15 - 30 * ease.inOutSine((tc - (this.loopSeconds - 4)) / 4);
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
    if (t > this.tHome - 3.5) {
      const k = ease.inOutSine((t - (this.tHome - 3.5)) / 3.5);
      out.d.lerp(FORWARD, k).normalize();
    }
    out.roll = w1.roll + (w2.roll - w1.roll) * es;
    out.fov = w1.fov + (w2.fov - w1.fov) * es;
  }
}

// ------------------------------------------------------------------ Standalone Tracks (48 s / 96 s)
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

// ------------------------------------------------------------------ Unified 144 s 4-Act Continuous Odyssey Track
export const ACT_SECONDS = 36;
export const ODYSSEY_SECONDS = ACT_SECONDS * 4; // 144 s total across all 4 paintings

const ODYSSEY_ACT_TRACKS: readonly CompanionTrack[] = [
  // Act I (0..36 s): Café Terrace at Night
  new CompanionTrack(
    CAFE_ASPECT,
    [
      { index: 0, name: 'I · 夜間咖啡座 · 論壇廣場畫幅', t0: 0, t1: 4.5, setPiece: 'Place du Forum gaslit canvas' },
      { index: 1, name: 'I · 煤氣燈金黃遮雨棚與圓桌', t0: 4.5, t1: 12, setPiece: 'under the golden awning and bistro tables' },
      { index: 2, name: 'I · 鵝卵石長街與藍紫街屋', t0: 12, t1: 21, setPiece: 'down rue du Palais cobblestone canyon' },
      { index: 3, name: 'I · 攀升亞爾星谷 → 飛往隆河', t0: 21, t1: 36, setPiece: 'soar into the Arles stars and morph into the Rhône' },
    ],
    [
      { t: 4.5, pos: EYE.clone(),                       lookAt: E_TARGET.clone(),                       fov: 36, roll: 0 },
      { t: 8.5, pos: pt(CAFE_ASPECT, 0.24, 0.28, 175),  lookAt: pt(CAFE_ASPECT, 0.22, 0.50, 460),       fov: 45, roll: -3 },
      { t: 13,  pos: pt(CAFE_ASPECT, 0.36, 0.24, 310),  lookAt: pt(CAFE_ASPECT, 0.48, 0.30, 680),       fov: 48, roll: -1.5 },
      { t: 18,  pos: pt(CAFE_ASPECT, 0.48, 0.28, 490),  lookAt: pt(CAFE_ASPECT, 0.51, 0.40, 740),       fov: 50, roll: 2.5 },
      { t: 23,  pos: pt(CAFE_ASPECT, 0.52, 0.44, 720),  lookAt: pt(CAFE_ASPECT, 0.53, 0.72, 4800),      fov: 54, roll: 1.5 },
      { t: 27,  pos: pt(CAFE_ASPECT, 0.53, 0.74, 4600), lookAt: pt(CAFE_ASPECT, 0.54, 0.86, 13200),     fov: 58, roll: -3 },
      { t: 30,  pos: H0.clone(),                        lookAt: E_TARGET.clone(),                       fov: dollyZoomFov(36, 675, 315), roll: 0 },
    ],
    0.52,
    ACT_SECONDS,
    4.5,
    30,
  ),
  // Act II (36..72 s): Starry Night Over the Rhône
  new CompanionTrack(
    RHONE_ASPECT,
    [
      { index: 4, name: 'II · 隆河星夜 · 河畔畫幅', t0: 36, t1: 40.5, setPiece: 'Trinquetaille bank & Ursa Major' },
      { index: 5, name: 'II · 停泊木船與河岸戀人', t0: 40.5, t1: 48, setPiece: 'lovers and moored boats on the wet shore' },
      { index: 6, name: 'II · 煤氣燈金色水波倒影柱', t0: 48, t1: 57, setPiece: 'shimmering golden gaslight reflections across the Rhône' },
      { index: 7, name: 'II · 北斗七星星冕 → 飛往聖雷米', t0: 57, t1: 72, setPiece: 'ascend into the Big Dipper and morph to Saint-Rémy' },
    ],
    [
      { t: 4.5, pos: EYE.clone(),                        lookAt: E_TARGET.clone(),                        fov: 36, roll: 0 },
      { t: 8.5, pos: pt(RHONE_ASPECT, 0.72, 0.14, 155),  lookAt: pt(RHONE_ASPECT, 0.72, 0.16, 320),       fov: 44, roll: 2.5 },
      { t: 13,  pos: pt(RHONE_ASPECT, 0.58, 0.20, 340),  lookAt: pt(RHONE_ASPECT, 0.46, 0.34, 1300),      fov: 48, roll: 1.5 },
      { t: 18,  pos: pt(RHONE_ASPECT, 0.38, 0.28, 720),  lookAt: pt(RHONE_ASPECT, 0.48, 0.42, 2300),      fov: 52, roll: -2.5 },
      { t: 23,  pos: pt(RHONE_ASPECT, 0.54, 0.36, 1550), lookAt: pt(RHONE_ASPECT, 0.54, 0.68, 9500),      fov: 54, roll: -1.5 },
      { t: 27,  pos: pt(RHONE_ASPECT, 0.48, 0.70, 6200), lookAt: pt(RHONE_ASPECT, 0.56, 0.74, 12800),     fov: 58, roll: 3 },
      { t: 30,  pos: H0.clone(),                         lookAt: E_TARGET.clone(),                        fov: dollyZoomFov(36, 675, 315), roll: 0 },
    ],
    0.50,
    ACT_SECONDS,
    4.5,
    30,
  ),
  // Act III (72..108 s): The Starry Night
  new CompanionTrack(
    CANVAS_ASPECT,
    [
      { index: 8,  name: 'III · 星夜 · 聖雷米夜空畫幅', t0: 72, t1: 76.5, setPiece: 'The Starry Night at Saint-Rémy' },
      { index: 9,  name: 'III · 黑焰絲柏與金星光冕隧道', t0: 76.5, t1: 84, setPiece: 'climb the black-flame cypress into Venus halo' },
      { index: 10, name: 'III · 穿越雙星雲大漩渦與教堂尖塔', t0: 84, t1: 93, setPiece: 'thread the great swirl funnel and look back at the steeple' },
      { index: 11, name: 'III · 聖雷米破曉 → 化入絲柏麥田', t0: 93, t1: 108, setPiece: 'dawn breaks over Saint-Rémy into sunlit wheat' },
    ],
    [
      { t: 4.5, pos: EYE.clone(),                         lookAt: E_TARGET.clone(),                         fov: 36, roll: 0 },
      { t: 8.5, pos: pt(CANVAS_ASPECT, 0.20, 0.32, 185),  lookAt: pt(CANVAS_ASPECT, 0.28, 0.52, 420),       fov: 46, roll: -3 },
      { t: 13,  pos: pt(CANVAS_ASPECT, 0.33, 0.38, 2200), lookAt: pt(CANVAS_ASPECT, 0.35, 0.36, 11800),     fov: 50, roll: 2 },
      { t: 18,  pos: pt(CANVAS_ASPECT, 0.42, 0.56, 14500),lookAt: pt(CANVAS_ASPECT, 0.51, 0.64, 42000),     fov: 56, roll: -3.5 },
      { t: 23,  pos: pt(CANVAS_ASPECT, 0.52, 0.52, 6800), lookAt: pt(CANVAS_ASPECT, 0.55, 0.22, 680),       fov: 48, roll: 2 },
      { t: 27,  pos: pt(CANVAS_ASPECT, 0.56, 0.24, 520),  lookAt: pt(CANVAS_ASPECT, 0.55, 0.20, 680),       fov: 44, roll: -1.5 },
      { t: 30,  pos: H0.clone(),                          lookAt: E_TARGET.clone(),                         fov: dollyZoomFov(36, 675, 315), roll: 0 },
    ],
    0.55,
    ACT_SECONDS,
    4.5,
    30,
  ),
  // Act IV (108..144 s): Wheat Field with Cypresses
  new CompanionTrack(
    WHEAT_ASPECT,
    [
      { index: 12, name: 'IV · 絲柏麥田 · 聖雷米白晝畫幅', t0: 108, t1: 112.5, setPiece: 'sunlit wheat field & cumulus clouds' },
      { index: 13, name: 'IV · 密斯特拉爾強風與金黃麥浪', t0: 112.5, t1: 120, setPiece: 'sweep low across 28,000 wind-swept golden wheat stalks' },
      { index: 14, name: 'IV · 雙絲柏與阿爾皮耶藍紫山脊', t0: 120, t1: 129, setPiece: 'spiral past the twin cypresses and olive bushes' },
      { index: 15, name: 'IV · 鋅白積雲漩渦 → 暮色歸返亞爾', t0: 129, t1: 144, setPiece: 'surf the white cumulus funnels back into Arles gaslight' },
    ],
    [
      { t: 4.5, pos: EYE.clone(),                         lookAt: E_TARGET.clone(),                         fov: 36, roll: 0 },
      { t: 8.5, pos: pt(WHEAT_ASPECT, 0.28, 0.12, 175),   lookAt: pt(WHEAT_ASPECT, 0.52, 0.20, 460),        fov: 46, roll: -2.5 },
      { t: 13,  pos: pt(WHEAT_ASPECT, 0.58, 0.22, 310),   lookAt: pt(WHEAT_ASPECT, 0.78, 0.42, 200),        fov: 50, roll: -1.5 },
      { t: 18,  pos: pt(WHEAT_ASPECT, 0.68, 0.48, 175),   lookAt: pt(WHEAT_ASPECT, 0.46, 0.34, 1600),       fov: 52, roll: 3 },
      { t: 23,  pos: pt(WHEAT_ASPECT, 0.46, 0.42, 1600),  lookAt: pt(WHEAT_ASPECT, 0.42, 0.56, 18000),      fov: 54, roll: 1.5 },
      { t: 27,  pos: pt(WHEAT_ASPECT, 0.46, 0.62, 16500), lookAt: pt(WHEAT_ASPECT, 0.48, 0.64, 42000),      fov: 58, roll: -3 },
      { t: 30,  pos: H0.clone(),                          lookAt: E_TARGET.clone(),                         fov: dollyZoomFov(36, 675, 315), roll: 0 },
    ],
    0.38,
    ACT_SECONDS,
    4.5,
    30,
  ),
];

const ODYSSEY_SHOTS: readonly ShotDef[] = ODYSSEY_ACT_TRACKS.flatMap((tr) => tr.shots);
const ODYSSEY_SHOT_STARTS: readonly number[] = ODYSSEY_SHOTS.map((s) => s.t0);

export interface OdysseyMorphState {
  /** Painting owning the current Act (or the incoming painting once morphMix >= 0.5). */
  activeId: PaintingId;
  /** Outgoing or primary painting in the scene. */
  primaryId: PaintingId;
  /** Incoming painting simultaneously rendered during the 3D brushstroke cross-dissolve (null outside morph window). */
  secondaryId: PaintingId | null;
  /** uLayerFade [0..1] for primaryId. */
  primaryFade: number;
  /** uLayerFade [0..1] for secondaryId. */
  secondaryFade: number;
  /** Extra uScatter [0..1] for primaryId during morph. */
  primaryScatter: number;
  /** Extra uScatter [0..1] for secondaryId during morph. */
  secondaryScatter: number;
  /** Blend factor [0..1] from primaryId's atmosphere/aspect to secondaryId's atmosphere/aspect. */
  atmoMix: number;
  /** Interpolated canvas aspect ratio for the camera & museum frame matte. */
  displayAspect: number;
  /** True when the incoming painting crosses its registration snap point near EYE. */
  snapIncoming: boolean;
}

/**
 * Evaluate the closed-form 4-Act Continuous Odyssey state at master clock `t` in [0, 144).
 * During the last 5.5 s of each 36 s Act (tau in [30.2, 35.7]), the outgoing painting's brushstrokes
 * unbind into the Provençal wind while the next painting's brushstrokes condense in 3D and lock into
 * exact registration at E by tau = 35.7 s — making the boundary tau = 36.0 -> 0.0 100% seamless.
 */
export function evalOdysseyMorph(t: number): OdysseyMorphState {
  const tw = ((t % ODYSSEY_SECONDS) + ODYSSEY_SECONDS) % ODYSSEY_SECONDS;
  const actIdx = Math.min(3, Math.floor(tw / ACT_SECONDS));
  const nextIdx = (actIdx + 1) % 4;
  const tau = tw - actIdx * ACT_SECONDS; // [0, 36)
  const specA = PAINTING_SUITE[actIdx];
  const specB = PAINTING_SUITE[nextIdx];

  // Morph window: tau in [30.2, 35.7]
  if (tau >= 30.2) {
    const m = clamp01((tau - 30.2) / 5.4); // reaches 1.0 at tau = 35.6 s
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
      snapIncoming: tau >= 34.4 && tau <= 35.8,
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
    const idx = Math.min(3, Math.floor(tw / ACT_SECONDS));
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
    // Keep fade = 0 across the entire 144 s Odyssey so it is a true zero-cut continuous animation
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

export function getPaintingActStart(id: PaintingId): number {
  const idx = PAINTING_SUITE.findIndex((p) => p.id === id);
  return Math.max(0, idx) * ACT_SECONDS;
}

export function nextPaintingId(id: PaintingId, dir: 1 | -1 = 1): PaintingId {
  const idx = PAINTING_SUITE.findIndex((p) => p.id === id);
  const next = (idx + dir + PAINTING_SUITE.length) % PAINTING_SUITE.length;
  return PAINTING_SUITE[next].id;
}
