// Five-Chapter Biographical Witness Timeline ("陪他走過一段人生").
// Replaces the rigid 30s-per-painting showcase metronome with variable breathing modes:
//  - 'actor-entry': Realistic Van Gogh witness scene -> gradual transition into the painting.
//  - 'sanctuary-still': Extended quiet contemplation (e.g., 44 s in The Bedroom in Arles, zero flashy effects).
//  - 'observational-walk': Calm, pedestrian-paced observation through his evolving artistic language.
//  - 'cosmos-ascent': Starting in the quiet daytime studio beside his easel, then ascending from the ground into the 250 km cosmos.
//  - 'interlude': Non-painting breathing space between life stages (linen/paper tone, environmental sound, letter trace).
//  - 'epilogue': RM25 unsent draft & Theo + Jo van Gogh-Bonger's preservation of his letters and canvases (1891–1914).
import { Vector3 } from 'three';
import { CANVAS_ASPECT } from '../contracts';
import { canvasToWorld, EYE, FORWARD, RIGHT, UP } from '../shared/canvasSpace';
import { ease } from '../camera/paths';
import { type CamPose, type EnvSample, type ShotDef } from '../camera/shots';
import { getPaintingSpec, type ChapterTrack } from './suite';
import { clamp, clamp01, smoothstep, uFromPaint, type ChapterId, type MotifId, type PaintingId } from './types';
import { resolveTransitionEdge } from './worldGraph';
import { getTraceById, getTraceForPainting, type EpistolaryTrace } from './letters';

export type BreathingProfile =
  | 'actor-entry'
  | 'sanctuary-still'
  | 'observational-walk'
  | 'cosmos-ascent'
  | 'interlude'
  | 'epilogue';

export interface WitnessBeatSpec {
  id: string;
  chapterId: ChapterId;
  chapterRoman: string;
  chapterTitleZh: string;
  paintingId: PaintingId;
  titleZh: string;
  subtitleZh: string;
  yearZh: string;
  durationSec: number;
  profile: BreathingProfile;
  isActorEntry?: boolean;
  isInterlude?: boolean;
  isEpilogue?: boolean;
  letterId?: string;
  /** Window [tauStartFrac, tauEndFrac] where natural quiet contemplation allows extending dwell time without freezing Van Gogh as an NPC */
  dwellWindowFrac: readonly [number, number];
}

export const WITNESS_BEATS: readonly WitnessBeatSpec[] = [
  // ================= CHAPTER I: 尋找人生的位置 (荷蘭 Nuenen, 1884–1885) =================
  {
    id: 'ch1-potato',
    chapterId: 'earth',
    chapterRoman: '第一章',
    chapterTitleZh: '尋找人生的位置',
    paintingId: 'potato',
    titleZh: '荷蘭紐南 · 《食薯者》',
    subtitleZh: '在農舍角落素描的年輕梵谷 · 油燈微光不知不覺揭露筆觸（藝術重建）',
    yearZh: '1885.04',
    durationSec: 46,
    profile: 'actor-entry',
    isActorEntry: true,
    letterId: 'letter-497-potato',
    dwellWindowFrac: [0.42, 0.88],
  },
  {
    id: 'ch1-weaver',
    chapterId: 'earth',
    chapterRoman: '第一章',
    chapterTitleZh: '尋找人生的位置',
    paintingId: 'weaver',
    titleZh: '荷蘭紐南 · 《織布工》',
    subtitleZh: '凝視古老橡木織布機與勞動者的日常節奏',
    yearZh: '1884.05',
    durationSec: 24,
    profile: 'observational-walk',
    letterId: 'letter-448-weaver',
    dwellWindowFrac: [0.20, 0.84],
  },
  {
    id: 'ch1-tower',
    chapterId: 'earth',
    chapterRoman: '第一章',
    chapterTitleZh: '尋找人生的位置',
    paintingId: 'tower',
    titleZh: '荷蘭紐南 · 《紐南的舊教堂塔樓》',
    subtitleZh: '田野暮色中的守望與告別北方土地',
    yearZh: '1885.05',
    durationSec: 24,
    profile: 'observational-walk',
    dwellWindowFrac: [0.20, 0.84],
  },
  {
    id: 'interlude-1',
    chapterId: 'earth',
    chapterRoman: '幕間留白 I',
    chapterTitleZh: '從北方黑土前往巴黎',
    paintingId: 'shoes',
    titleZh: '幕間留白 · 開往巴黎的列車',
    subtitleZh: '不進入畫作的空白 · 陪他走過兩個人生階段之間的旅途',
    yearZh: '1885.11 – 1886.02',
    durationSec: 14,
    profile: 'interlude',
    isInterlude: true,
    letterId: 'interlude-1-paris-train',
    dwellWindowFrac: [0.10, 0.90],
  },

  // ================= CHAPTER II: 發現世界的色彩 (巴黎 Paris, 1886–1888) =================
  {
    id: 'ch2-paris',
    chapterId: 'color',
    chapterRoman: '第二章',
    chapterTitleZh: '發現世界的色彩',
    paintingId: 'paris',
    titleZh: '巴黎蒙馬特 · 《克利希大道》',
    subtitleZh: '跟隨他穿過巴黎街道 · 色彩在街景中一點一點甦醒（藝術重建）',
    yearZh: '1887.03',
    durationSec: 42,
    profile: 'actor-entry',
    isActorEntry: true,
    letterId: 'letter-595-paris',
    dwellWindowFrac: [0.45, 0.88],
  },
  {
    id: 'ch2-seine',
    chapterId: 'color',
    chapterRoman: '第二章',
    chapterTitleZh: '發現世界的色彩',
    paintingId: 'seine',
    titleZh: '巴黎郊外 · 《阿尼耶爾的塞納河與橋》',
    subtitleZh: '透過新的藝術觀念，不斷修正自己看待光線與世界的方式',
    yearZh: '1887.06',
    durationSec: 24,
    profile: 'observational-walk',
    dwellWindowFrac: [0.20, 0.84],
  },
  {
    id: 'ch2-tanguy',
    chapterId: 'color',
    chapterRoman: '第二章',
    chapterTitleZh: '發現世界的色彩',
    paintingId: 'tanguy',
    titleZh: '巴黎 · 《唐吉老爹肖像》',
    subtitleZh: '日本浮世繪的清澈色彩與巴黎友人的溫暖',
    yearZh: '1887.11',
    durationSec: 24,
    profile: 'observational-walk',
    letterId: 'letter-590-tanguy',
    dwellWindowFrac: [0.22, 0.84],
  },
  {
    id: 'ch2-selfportrait',
    chapterId: 'color',
    chapterRoman: '第二章',
    chapterTitleZh: '發現世界的色彩',
    paintingId: 'selfportrait',
    titleZh: '巴黎 · 《戴草帽的自畫像》',
    subtitleZh: '在離開巴黎前，對自己與色彩的安靜審視',
    yearZh: '1887.08',
    durationSec: 26,
    profile: 'sanctuary-still',
    dwellWindowFrac: [0.18, 0.86],
  },
  {
    id: 'interlude-2',
    chapterId: 'color',
    chapterRoman: '幕間留白 II',
    chapterTitleZh: '南下普羅旺斯的陽光',
    paintingId: 'yellowhouse',
    titleZh: '幕間留白 · 尋找南方畫室的家',
    subtitleZh: '不進入畫作的空白 · 窗外的空氣逐漸變得透明而溫暖',
    yearZh: '1888.02',
    durationSec: 14,
    profile: 'interlude',
    isInterlude: true,
    letterId: 'interlude-2-south-sun',
    dwellWindowFrac: [0.10, 0.90],
  },

  // ================= CHAPTER III: 嘗試建立自己的家 (亞爾 Arles, 1888–1889) =================
  {
    id: 'ch3-yellowhouse',
    chapterId: 'sun',
    chapterRoman: '第三章',
    chapterTitleZh: '嘗試建立自己的家',
    paintingId: 'yellowhouse',
    titleZh: '亞爾 · 《黃色小屋》',
    subtitleZh: '梵谷走進黃色小屋 · 看見一個人對共同生活與未來的期待（藝術重建）',
    yearZh: '1888.09',
    durationSec: 32,
    profile: 'actor-entry',
    isActorEntry: true,
    letterId: 'letter-677-yellowhouse',
    dwellWindowFrac: [0.44, 0.88],
  },
  {
    id: 'ch3-sunflowers',
    chapterId: 'sun',
    chapterRoman: '第三章',
    chapterTitleZh: '嘗試建立自己的家',
    paintingId: 'sunflowers',
    titleZh: '亞爾 · 《向日葵》',
    subtitleZh: '為裝飾客房、迎接遠方朋友而畫下的陽光',
    yearZh: '1888.08',
    durationSec: 26,
    profile: 'sanctuary-still',
    dwellWindowFrac: [0.18, 0.86],
  },
  {
    id: 'ch3-bedroom',
    chapterId: 'sun',
    chapterRoman: '第三章',
    chapterTitleZh: '嘗試建立自己的家',
    paintingId: 'bedroom',
    titleZh: '亞爾 · 《亞爾的臥室》（淡紫色牆面）',
    subtitleZh: '1888年10月 · 刻意克制所有特效，在安靜的光線裡停留，感受這個地方承載的期待',
    yearZh: '1888.10',
    durationSec: 44,
    profile: 'sanctuary-still',
    letterId: 'letter-705-bedroom',
    dwellWindowFrac: [0.15, 0.90],
  },
  {
    id: 'ch3-nightcafe',
    chapterId: 'sun',
    chapterRoman: '第三章',
    chapterTitleZh: '嘗試建立自己的家',
    paintingId: 'nightcafe',
    titleZh: '亞爾 · 《夜間咖啡館》',
    subtitleZh: '共同生活的理想經歷波折與破裂後的暗夜張力',
    yearZh: '1888.09',
    durationSec: 22,
    profile: 'observational-walk',
    dwellWindowFrac: [0.24, 0.82],
  },
  {
    id: 'ch3-rhone',
    chapterId: 'sun',
    chapterRoman: '第三章',
    chapterTitleZh: '嘗試建立自己的家',
    paintingId: 'rhone',
    titleZh: '亞爾 · 《隆河上的星夜》',
    subtitleZh: '河水與星光溫柔撫平夜色裡的孤寂',
    yearZh: '1888.09',
    durationSec: 28,
    profile: 'sanctuary-still',
    letterId: 'letter-691-rhone',
    dwellWindowFrac: [0.20, 0.86],
  },
  {
    id: 'interlude-3',
    chapterId: 'sun',
    chapterRoman: '幕間留白 III',
    chapterTitleZh: '聖雷米的窗與花園',
    paintingId: 'irises',
    titleZh: '幕間留白 · 住進聖保羅療養院',
    subtitleZh: '不進入畫作的空白 · 在受限的處境裡，依然安靜傾聽自然的聲音',
    yearZh: '1889.05',
    durationSec: 14,
    profile: 'interlude',
    isInterlude: true,
    letterId: 'interlude-3-saint-remy',
    dwellWindowFrac: [0.10, 0.90],
  },

  // ================= CHAPTER IV: 在困境中繼續創造 (聖雷米 Saint-Rémy, 1889–1890) =================
  {
    id: 'ch4-starry',
    chapterId: 'cosmos',
    chapterRoman: '第四章',
    chapterTitleZh: '在困境中繼續創造',
    paintingId: 'starry',
    titleZh: '聖雷米 · 《星夜》（日間畫室創作）',
    subtitleZh: '他站在畫架前沉靜落筆 · 鏡頭緩緩離開他身旁，從地面升入融合觀察、記憶與想像的星空宇宙',
    yearZh: '1889.06',
    durationSec: 54,
    profile: 'cosmos-ascent',
    isActorEntry: true,
    letterId: 'letter-782-starry',
    dwellWindowFrac: [0.36, 0.88],
  },
  {
    id: 'ch4-irises',
    chapterId: 'cosmos',
    chapterRoman: '第四章',
    chapterTitleZh: '在困境中繼續創造',
    paintingId: 'irises',
    titleZh: '聖雷米 · 《鳶尾花》',
    subtitleZh: '即使在艱難時期，也從未停止觀察泥土與花朵的生命力',
    yearZh: '1889.05',
    durationSec: 24,
    profile: 'observational-walk',
    dwellWindowFrac: [0.22, 0.84],
  },
  {
    id: 'ch4-almond',
    chapterId: 'cosmos',
    chapterRoman: '第四章',
    chapterTitleZh: '在困境中繼續創造',
    paintingId: 'almond',
    titleZh: '聖雷米 · 《盛開的杏花》',
    subtitleZh: '1890年2月 · 為西奧與喬剛出生的兒子（Vincent Willem）畫下的晴空與新生',
    yearZh: '1890.02',
    durationSec: 34,
    profile: 'sanctuary-still',
    letterId: 'letter-850-almond',
    dwellWindowFrac: [0.18, 0.88],
  },
  {
    id: 'interlude-4',
    chapterId: 'cosmos',
    chapterRoman: '幕間留白 IV',
    chapterTitleZh: '北上瓦茲河谷的奧維爾',
    paintingId: 'cottages',
    titleZh: '幕間留白 · 走向北方的田野',
    subtitleZh: '不進入畫作的空白 · 夏初的微風與泥土小徑的腳步聲',
    yearZh: '1890.05',
    durationSec: 12,
    profile: 'interlude',
    isInterlude: true,
    letterId: 'interlude-4-auvers-north',
    dwellWindowFrac: [0.10, 0.90],
  },

  // ================= CHAPTER V: 生命的最後一段路 (奧維爾 Auvers-sur-Oise, 1890.05–07 & 尾聲) =================
  {
    id: 'ch5-gachet',
    chapterId: 'road',
    chapterRoman: '第五章',
    chapterTitleZh: '生命的最後一段路',
    paintingId: 'gachet',
    titleZh: '奧維爾 · 《嘉舍醫師畫像》',
    subtitleZh: '在生命最後兩個月裡，人與人之間溫柔而深刻的理解',
    yearZh: '1890.06',
    durationSec: 24,
    profile: 'sanctuary-still',
    dwellWindowFrac: [0.20, 0.86],
  },
  {
    id: 'ch5-crows',
    chapterId: 'road',
    chapterRoman: '第五章',
    chapterTitleZh: '生命的最後一段路',
    paintingId: 'crows',
    titleZh: '奧維爾 · 《麥田群鴉》',
    subtitleZh: '並非死亡預告，亦非最後一幅畫 · 容許孤寂與鄉間自然的振奮力量並存',
    yearZh: '1890.07',
    durationSec: 30,
    profile: 'observational-walk',
    letterId: 'letter-898-crows',
    dwellWindowFrac: [0.22, 0.84],
  },
  {
    id: 'ch5-daubigny',
    chapterId: 'road',
    chapterRoman: '第五章',
    chapterTitleZh: '生命的最後一段路',
    paintingId: 'daubigny',
    titleZh: '奧維爾田野 · 《多比尼的花園》與未盡之路',
    subtitleZh: '他走在田野中，觀眾跟隨在後 · 保留部分真實世界不完全入畫，留下尚未結束的感受',
    yearZh: '1890.07',
    durationSec: 40,
    profile: 'actor-entry',
    isActorEntry: true,
    letterId: 'letter-rm25-daubigny',
    dwellWindowFrac: [0.46, 0.90],
  },
  {
    id: 'epilogue-jo',
    chapterId: 'road',
    chapterRoman: '尾聲',
    chapterTitleZh: '書信的守護與視點的傳遞',
    paintingId: 'almond',
    titleZh: '尾聲 · 西奧與喬·梵谷-邦格（Jo van Gogh-Bonger）',
    subtitleZh: '1891年1月西奧離世後，喬帶著尚未滿周歲的孩子保存並推廣書信與畫作 · 我們陪伴了他，卻不能永遠留在他的身旁',
    yearZh: '1891 – 1914',
    durationSec: 22,
    profile: 'epilogue',
    isEpilogue: true,
    letterId: 'epilogue-jo-bonger',
    dwellWindowFrac: [0.05, 0.95],
  },
];

interface BeatTimeRange {
  beat: WitnessBeatSpec;
  index: number;
  t0: number;
  t1: number;
}

const BEAT_RANGES: readonly BeatTimeRange[] = (() => {
  let acc = 0;
  return WITNESS_BEATS.map((beat, index) => {
    const t0 = acc;
    const t1 = acc + beat.durationSec;
    acc = t1;
    return { beat, index, t0, t1 };
  });
})();

export const WITNESS_TOTAL_SECONDS: number = BEAT_RANGES[BEAT_RANGES.length - 1]?.t1 ?? 600;

export const WITNESS_PAINTING_SEQUENCE: readonly PaintingId[] = [
  'potato', 'weaver', 'tower',
  'paris', 'seine', 'tanguy', 'selfportrait',
  'yellowhouse', 'sunflowers', 'bedroom', 'nightcafe', 'rhone',
  'starry', 'irises', 'almond',
  'gachet', 'crows', 'daubigny',
];

export interface WitnessFrameState {
  beat: WitnessBeatSpec;
  beatIndex: number;
  beatTau: number;
  beatDuration: number;
  beatFrac: number;
  primaryId: PaintingId;
  secondaryId: PaintingId | null;
  primaryFade: number;
  secondaryFade: number;
  primaryScatter: number;
  secondaryScatter: number;
  atmoMix: number;
  displayAspect: number;
  canDwell: boolean;
  activeTrace: EpistolaryTrace | null;
  traceOpacity: number;
  transitionMotif: MotifId;
  portalUV: [number, number];
}

function findBeatAt(t: number): { range: BeatTimeRange; tau: number } {
  const tw = ((t % WITNESS_TOTAL_SECONDS) + WITNESS_TOTAL_SECONDS) % WITNESS_TOTAL_SECONDS;
  for (let i = 0; i < BEAT_RANGES.length; i++) {
    const r = BEAT_RANGES[i];
    if (tw >= r.t0 && tw < r.t1) {
      return { range: r, tau: tw - r.t0 };
    }
  }
  const last = BEAT_RANGES[BEAT_RANGES.length - 1];
  return { range: last, tau: tw - last.t0 };
}

const _posA = new Vector3();
const _posB = new Vector3();
const _lookPt = new Vector3();
function stagePt(r: number, u: number, f: number, out = new Vector3()): Vector3 {
  return out
    .copy(EYE)
    .addScaledVector(RIGHT, r)
    .addScaledVector(UP, u)
    .addScaledVector(FORWARD, f);
}

/**
 * Compute the bespoke Witness Camera pose for a given beat and local time `tau`.
 * Honors the core principle: "觀眾是梵谷人生的見證者，不是操縱他的人" and keeps E pure when the painting reassembles.
 */
function evalWitnessBeatPose(beat: WitnessBeatSpec, tau: number, out: CamPose): CamPose {
  const dur = beat.durationSec;
  const p = clamp01(tau / dur);
  const spec = getPaintingSpec(beat.paintingId);

  if (beat.isInterlude || beat.isEpilogue) {
    // Quiet breathing drift in the non-painting interlude space
    const driftX = 0.25 * Math.sin(p * Math.PI);
    const driftZ = 0.6 + 0.8 * p;
    stagePt(driftX, -0.35 + 0.15 * p, driftZ, out.p);
    stagePt(0.0, -0.45, 6.0, _lookPt);
    out.d.subVectors(_lookPt, out.p).normalize();
    out.fov = 36;
    out.roll = 0;
    return out;
  }

  if (beat.profile === 'actor-entry') {
    // Phase 1 (0 .. 0.42): Witness follows or passes by the realistic Van Gogh in the foreground stage.
    // Phase 2 (0.42 .. 0.72): Camera glides gently into the painting's near space as Van Gogh steps outside the frame.
    // Phase 3 (0.72 .. 1.0): Camera settles cleanly into E so the painting holds in pure registration.
    if (beat.chapterId === 'earth') {
      // Ch I (Nuenen): Start behind young Van Gogh sketching in the cottage corner, move past his shoulder to the table (E)
      const k1 = ease.inOutSine(clamp01(p / 0.52));
      const k2 = ease.inOutCubic(clamp01((p - 0.52) / 0.34));
      stagePt(-1.42 * (1 - k1), -1.08 * (1 - k1), 1.6 + 2.8 * Math.sin(k1 * Math.PI * 0.5) * (1 - k2), out.p);
      // Look from his sketchboard toward the oil lamp and dining table
      stagePt(-0.65 * (1 - k1), -0.78 * (1 - k1), 5.8 + 80 * k1, _lookPt);
      if (p >= 0.86) {
        out.p.copy(EYE);
        out.d.copy(FORWARD);
      } else {
        out.d.subVectors(_lookPt, out.p).normalize();
      }
      out.fov = 36;
      out.roll = 0;
      return out;
    }

    if (beat.chapterId === 'color') {
      // Ch II (Paris): Follow behind him walking down the misty street as colors awaken along the boulevard
      const k1 = ease.inOutSine(clamp01(p / 0.58));
      const k2 = ease.inOutCubic(clamp01((p - 0.58) / 0.30));
      const walkZ = (1.8 + 4.4 * k1) * (1 - k2);
      const walkX = -0.32 * (1 - k2);
      const walkY = -1.05 * (1 - k2);
      stagePt(walkX, walkY, walkZ, out.p);
      stagePt(-0.22 * (1 - k1), -0.55 * (1 - k1), 9.5 + 120 * k1, _lookPt);
      if (p >= 0.88) {
        out.p.copy(EYE);
        out.d.copy(FORWARD);
      } else {
        out.d.subVectors(_lookPt, out.p).normalize();
      }
      out.fov = 36;
      out.roll = 0;
      return out;
    }

    if (beat.chapterId === 'sun') {
      // Ch III (Arles Yellow House): Follow him approaching the green door of the Yellow House, then settle into E
      const k1 = ease.inOutSine(clamp01(p / 0.55));
      const k2 = ease.inOutCubic(clamp01((p - 0.55) / 0.32));
      stagePt(0.95 * (1 - k1) * (1 - k2), -1.02 * (1 - k2), 3.2 * Math.sin(k1 * Math.PI) * (1 - k2), out.p);
      stagePt(0.45 * (1 - k1), -0.45 * (1 - k1), 8.0 + 150 * k1, _lookPt);
      if (p >= 0.87) {
        out.p.copy(EYE);
        out.d.copy(FORWARD);
      } else {
        out.d.subVectors(_lookPt, out.p).normalize();
      }
      out.fov = 36;
      out.roll = 0;
      return out;
    }

    if (beat.chapterId === 'road') {
      // Ch V (Auvers field walk): Follow behind him walking through the field path; unhurried, open ending
      const k1 = ease.inOutSine(clamp01(p / 0.65));
      const k2 = ease.inOutCubic(clamp01((p - 0.65) / 0.28));
      const trailZ = (1.5 + 5.2 * k1) * (1 - k2);
      const trailX = 0.18 * Math.sin(k1 * Math.PI) * (1 - k2);
      const trailY = -1.04 * (1 - k2);
      stagePt(trailX, trailY, trailZ, out.p);
      stagePt(0.12 * (1 - k2), -0.48 * (1 - k2), 11.0 + 180 * k1, _lookPt);
      if (p >= 0.93) {
        out.p.copy(EYE);
        out.d.copy(FORWARD);
      } else {
        out.d.subVectors(_lookPt, out.p).normalize();
      }
      out.fov = 36;
      out.roll = 0;
      return out;
    }
  }

  if (beat.profile === 'cosmos-ascent') {
    // Ch IV (Saint-Rémy Starry Night, 54 s):
    // 0..14 s: Daytime indoor studio beside Van Gogh at his easel (calm brushwork, no dramatic acting).
    // 14..42 s: Camera slowly leaves his side, crosses the canvas onto the quiet ground, and gradually ascends into the 250 km brushstroke cosmos.
    // 42..54 s: Gentle homecoming back to E, holding the pure reassembled painting.
    if (tau < 14.0) {
      const u = ease.inOutSine(tau / 14.0);
      stagePt(-1.15 + 0.75 * u, -0.88 + 0.55 * u, 2.2 + 2.6 * u, out.p);
      stagePt(-0.42 * (1 - u), -0.35 * (1 - u), 5.2 + 65 * u, _lookPt);
      out.d.subVectors(_lookPt, out.p).normalize();
      out.fov = 36;
      out.roll = 0;
      return out;
    }
    if (tau < 44.0) {
      // Map 14..44 s smoothly onto the ground-to-cosmos ascent of the Starry Night track (t = 8..68 s)
      const starT = 8.0 + ((tau - 14.0) / 30.0) * 58.0;
      spec.track.pose(starT, out);
      out.roll *= 0.35; // Keep the camera composed and human
      return out;
    }
    const uHome = ease.inOutCubic(clamp01((tau - 44.0) / 6.5));
    spec.track.pose(66.0, out);
    out.p.lerp(EYE, uHome);
    out.d.lerp(FORWARD, uHome).normalize();
    out.fov = out.fov + (36 - out.fov) * uHome;
    out.roll = 0;
    return out;
  }

  if (beat.profile === 'sanctuary-still') {
    // Sanctuary Stillness (e.g., The Bedroom in Arles 44 s, Sunflowers, Almond Blossom, Dr. Gachet):
    // Strictly no high-speed fly-through! Gentle micro-parallax breathing within 0.4–2.8 m of E so the viewer
    // dwells inside the quiet light of the room.
    const entry = smoothstep(0.0, 0.16, p);
    const exit = 1 - smoothstep(0.76, 0.90, p);
    const env = entry * exit;
    const maxRadius = beat.paintingId === 'bedroom' ? 2.2 : 1.6;
    const rX = maxRadius * 0.55 * Math.sin(p * Math.PI * 1.4) * env;
    const rY = maxRadius * 0.28 * Math.cos(p * Math.PI * 1.1) * env;
    const rZ = maxRadius * 1.15 * Math.sin(p * Math.PI) * env;
    stagePt(rX, rY, rZ, out.p);
    canvasToWorld(uFromPaint(0.5 + 0.02 * Math.sin(p * Math.PI * 2), spec.aspect), 0.48 + 0.02 * Math.cos(p * Math.PI), 680, _lookPt);
    if (env <= 1e-3) {
      out.p.copy(EYE);
      out.d.copy(FORWARD);
    } else {
      out.d.subVectors(_lookPt, out.p).normalize();
      out.d.lerp(FORWARD, 1 - 0.65 * env).normalize();
    }
    out.fov = 36;
    out.roll = 0;
    return out;
  }

  // 'observational-walk': Calm, pedestrian-paced observation (scaling down the companion track's deep dive)
  const walkHoldEnd = 0.84 * dur;
  if (tau >= walkHoldEnd) {
    out.p.copy(EYE);
    out.d.copy(FORWARD);
    out.fov = 36;
    out.roll = 0;
    return out;
  }
  const mappedT = (tau / walkHoldEnd) * 45.5;
  spec.track.pose(mappedT, out);
  // Attenuate extreme distance excursions so observational beats feel like walking, not rocket flight
  const distFromE = out.p.distanceTo(EYE);
  if (distFromE > 48) {
    const dampedDist = 48 + Math.pow(distFromE - 48, 0.55);
    out.p.sub(EYE).normalize().multiplyScalar(dampedDist).add(EYE);
  }
  out.roll *= 0.25;
  return out;
}

/**
 * Evaluate the full 5-Chapter Witness Journey state at master clock `t`.
 */
export function evalWitnessState(t: number): WitnessFrameState {
  const { range, tau } = findBeatAt(t);
  const beat = range.beat;
  const dur = beat.durationSec;
  const frac = clamp01(tau / dur);
  const nextRange = BEAT_RANGES[(range.index + 1) % BEAT_RANGES.length];
  const nextBeat = nextRange.beat;

  const specA = getPaintingSpec(beat.paintingId);
  const specB = getPaintingSpec(nextBeat.paintingId);
  const edge = resolveTransitionEdge(specA.id, specB.id);

  // Natural contemplation window: viewer can extend their stay (Hold to Dwell) only during this calm window,
  // never freezing Van Gogh like a game NPC during his walk/action.
  const canDwell = frac >= beat.dwellWindowFrac[0] && frac <= beat.dwellWindowFrac[1];

  // Epistolary Trace (letter to Theo) fade window
  const trace = beat.letterId ? (getTraceById(beat.letterId) ?? null) : (getTraceForPainting(beat.paintingId) ?? null);
  let traceOpacity = 0;
  if (trace) {
    const [w0, w1] = trace.windowFrac;
    const fadeIn = smoothstep(w0, w0 + 0.07, frac);
    const fadeOut = 1 - smoothstep(w1 - 0.08, w1, frac);
    traceOpacity = fadeIn * fadeOut;
  }

  // Interlude or Epilogue: non-painting space
  if (beat.isInterlude || beat.isEpilogue) {
    return {
      beat,
      beatIndex: range.index,
      beatTau: tau,
      beatDuration: dur,
      beatFrac: frac,
      primaryId: beat.paintingId,
      secondaryId: null,
      primaryFade: 0, // Suppress oil painting strokes during pure interlude/epilogue
      secondaryFade: 0,
      primaryScatter: 0,
      secondaryScatter: 0,
      atmoMix: 0.5,
      displayAspect: CANVAS_ASPECT,
      canDwell: true,
      activeTrace: trace,
      traceOpacity,
      transitionMotif: edge.motif,
      portalUV: [0.5, 0.5],
    };
  }

  // Gentle cross-dissolve during the final 2.8 s of a painting beat (unless the next beat is an Interlude/Epilogue,
  // in which case the painting gently fades to the raw linen interlude without scattering)
  const dissolveStart = dur - 2.8;
  if (tau >= dissolveStart) {
    const m = clamp01((tau - dissolveStart) / 2.8);
    if (nextBeat.isInterlude || nextBeat.isEpilogue) {
      const pFade = 1 - smoothstep(0.05, 0.95, m);
      return {
        beat,
        beatIndex: range.index,
        beatTau: tau,
        beatDuration: dur,
        beatFrac: frac,
        primaryId: specA.id,
        secondaryId: null,
        primaryFade: pFade,
        secondaryFade: 0,
        primaryScatter: 0,
        secondaryScatter: 0,
        atmoMix: smoothstep(0.1, 0.9, m),
        displayAspect: specA.aspect,
        canDwell: false,
        activeTrace: trace,
        traceOpacity,
        transitionMotif: edge.motif,
        portalUV: [specA.moonUVD[0], specA.moonUVD[1]],
      };
    }

    // Restrained, poetic cross-dissolve between two paintings in the same chapter (no violent storm explosion in Arles/Nuenen)
    const calmChapter = beat.chapterId === 'earth' || beat.chapterId === 'sun';
    const scatterScale = calmChapter ? 0.0 : 0.28;
    const g = edge.grammar;
    const pFade = 1 - smoothstep(0.08, 0.88, m);
    const sFade = smoothstep(0.08, 0.88, m);
    const atmoMix = smoothstep(0.10, 0.90, m);
    return {
      beat,
      beatIndex: range.index,
      beatTau: tau,
      beatDuration: dur,
      beatFrac: frac,
      primaryId: specA.id,
      secondaryId: specB.id,
      primaryFade: pFade,
      secondaryFade: sFade,
      primaryScatter: g.scatterPeakPrimary * scatterScale * smoothstep(0.0, 0.8, m),
      secondaryScatter: g.scatterPeakSecondary * scatterScale * (1 - smoothstep(0.1, 0.95, m)),
      atmoMix,
      displayAspect: specA.aspect + (specB.aspect - specA.aspect) * atmoMix,
      canDwell: false,
      activeTrace: trace,
      traceOpacity,
      transitionMotif: edge.motif,
      portalUV: [specA.moonUVD[0], specA.moonUVD[1]],
    };
  }

  return {
    beat,
    beatIndex: range.index,
    beatTau: tau,
    beatDuration: dur,
    beatFrac: frac,
    primaryId: specA.id,
    secondaryId: null,
    primaryFade: 1,
    secondaryFade: 0,
    primaryScatter: 0,
    secondaryScatter: 0,
    atmoMix: 0,
    displayAspect: specA.aspect,
    canDwell,
    activeTrace: trace,
    traceOpacity,
    transitionMotif: edge.motif,
    portalUV: [specA.moonUVD[0], specA.moonUVD[1]],
  };
}

export function getWitnessBeatStartForPainting(id: PaintingId): number {
  const found = BEAT_RANGES.find((r) => !r.beat.isInterlude && !r.beat.isEpilogue && r.beat.paintingId === id);
  return found ? found.t0 : 0;
}

let _cachedWitnessTrack: ChapterTrack | null = null;

export function compileWitnessTrack(): ChapterTrack {
  if (_cachedWitnessTrack) return _cachedWitnessTrack;

  const shots: ShotDef[] = BEAT_RANGES.map((r) => ({
    index: r.index,
    name: `${r.beat.chapterRoman} · ${r.beat.titleZh}`,
    t0: r.t0,
    t1: r.t1,
    setPiece: r.beat.subtitleZh,
  }));
  const shotStarts = shots.map((s) => s.t0);

  const track: ChapterTrack = {
    loopSeconds: WITNESS_TOTAL_SECONDS,
    aspect: CANVAS_ASPECT,
    shots,
    shotStarts,
    aspectAt: (t: number) => evalWitnessState(t).displayAspect,
    position: (t: number, out: Vector3) => {
      const { range, tau } = findBeatAt(t);
      const poseTmp: CamPose = { p: out, d: _lookPt, fov: 36, roll: 0 };
      evalWitnessBeatPose(range.beat, tau, poseTmp);
      return out;
    },
    pose: (t: number, out: CamPose) => {
      const { range, tau } = findBeatAt(t);
      return evalWitnessBeatPose(range.beat, tau, out);
    },
    velocity: (t: number, out: Vector3) => {
      const dt = 0.04;
      const t0 = clamp(t - dt, 0, WITNESS_TOTAL_SECONDS);
      const t1 = clamp(t + dt, 0, WITNESS_TOTAL_SECONDS);
      track.position(t0, _posA);
      track.position(t1, _posB);
      return out.subVectors(_posB, _posA).divideScalar(Math.max(1e-4, t1 - t0));
    },
    env: (t: number, _camDistFromE: number, _calm: boolean, out: EnvSample) => {
      const { range, tau } = findBeatAt(t);
      const beat = range.beat;
      const p = clamp01(tau / beat.durationSec);
      // Subtle, restrained lighting & exposure envelopes tailored to each chapter
      out.bloom = beat.chapterId === 'sun' || beat.chapterId === 'earth' ? 0.38 : 0.52;
      out.exposure = beat.chapterId === 'earth' ? 0.94 + 0.06 * Math.sin(tau * 1.6) : 1.0;
      out.matte = beat.isInterlude || beat.isEpilogue ? 0.85 : smoothstep(0.75, 0.90, p);
      out.smear = 0; // Never apply high-speed radial speed smear in Witness Mode
      out.storm = 0; // Never trigger chaotic storm scatter in Witness Mode
      // Gentle afternoon light progression across the pale-lilac walls in Arles Bedroom
      out.galleryLightDeg = beat.paintingId === 'bedroom' ? -18 + 36 * p : 15 * Math.sin(p * Math.PI);
      out.impastoGain = beat.isInterlude || beat.isEpilogue ? 0.35 : 1.0;
      out.fade = 0;
      out.dust = beat.isInterlude || beat.isEpilogue ? 0.65 : 0.25;
      return out;
    },
  };

  _cachedWitnessTrack = track;
  return track;
}
