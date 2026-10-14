// Van Gogh World Graph (Level 2 Theme Paths, Level 3 Five Grand Chapters, 6 Motif Backbones & Portal Graph).
import type { ChapterId, MotifId, PaintingId } from './types';

export interface ChapterSpec {
  id: ChapterId;
  roman: string;
  nameEn: string;
  nameZh: string;
  periodZh: string;
  years: string;
  colorHex: string;
  brushDnaZh: string;
  storyRoleZh: string;
}

export const CHAPTER_SPECS: readonly ChapterSpec[] = [
  {
    id: 'earth',
    roman: 'Chapter I',
    nameEn: 'Earth',
    nameZh: '黑土與人',
    periodZh: '荷蘭時期 · Nuenen',
    years: '1883–1885',
    colorHex: '#c8964e',
    brushDnaZh: '暗褐煤灰調色盤 · 厚重刮刀筆觸 · 單一油燈明暗對比 (Chiaroscuro)',
    storyRoleZh: '建立宇宙的「根」：後來所有的光與星空，都是從這片黑土與勞動中長出來的。',
  },
  {
    id: 'color',
    roman: 'Chapter II',
    nameEn: 'Color',
    nameZh: '巴黎與覺醒',
    periodZh: '巴黎時期 · Paris',
    years: '1886–1888',
    colorHex: '#7eb8da',
    brushDnaZh: '印象派與點描短促排線 · 互補色高頻跳動 · 開放都市透視',
    storyRoleZh: '眼睛被打開：世界從封閉的單色黑土走向甦醒的彩色光譜。',
  },
  {
    id: 'sun',
    roman: 'Chapter III',
    nameEn: 'Sun',
    nameZh: '亞爾的黃金時代',
    periodZh: '普羅旺斯 · Arles',
    years: '1888–1889',
    colorHex: '#f2c230',
    brushDnaZh: '高飽和鉻黃與鈷藍對比 · 強烈斜射光暈 · 城市夜色與溫暖居所交錯',
    storyRoleZh: '生命的第一座高峰：在南方驕陽與瓦斯夜燈下追尋理想居所與人際溫暖。',
  },
  {
    id: 'cosmos',
    roman: 'Chapter IV',
    nameEn: 'Cosmos',
    nameZh: '聖雷米的內在宇宙',
    periodZh: '聖雷米 · Saint-Rémy',
    years: '1889–1890',
    colorHex: '#5eb2bc',
    brushDnaZh: '250 公里長流線雙渦流場 · 火焰絲柏與盛開枝幹 · 最大尺度 3D 空間運動',
    storyRoleZh: '核心招牌：如果前面是人生，這裡就是自然、風暴與生命流動的內在宇宙。',
  },
  {
    id: 'road',
    roman: 'Chapter V',
    nameEn: 'Road',
    nameZh: '奧維爾的路與風',
    periodZh: '瓦茲河谷 · Auvers-sur-Oise',
    years: '1890',
    colorHex: '#d85e24',
    brushDnaZh: '壓低天際線 · 交錯剛烈筆觸 · 分岔小徑與 2:1 超寬銀幕風暴張力',
    storyRoleZh: '風中的終章：所有星旋與光最終又落回地面與分岔路途，並重返最初的土地。',
  },
];

export interface MotifSpec {
  id: MotifId;
  nameZh: string;
  nameEn: string;
  icon: string;
  descZh: string;
}

export const MOTIF_SPECS: Record<MotifId, MotifSpec> = {
  light: {
    id: 'light',
    nameZh: '光之主幹',
    nameEn: 'Light',
    icon: '✦',
    descZh: '油燈、瓦斯燈、星芒、新月、烈日與彩繪玻璃——梵谷宇宙最核心的導航線',
  },
  road: {
    id: 'road',
    nameZh: '路之主幹',
    nameEn: 'Road',
    icon: '⟁',
    descZh: '林蔭大道、鵝卵石街、隆河堤岸、教堂分岔路與麥田三岔路——決定鏡頭如何旅行',
  },
  sky: {
    id: 'sky',
    nameZh: '天空主幹',
    nameEn: 'Sky',
    icon: '◎',
    descZh: '點描晴空、雙渦流星夜、翻滾白雲、松石藍春空與暴風雨烏雲——最自然的跨場景任意門',
  },
  flora: {
    id: 'flora',
    nameZh: '植物主幹',
    nameEn: 'Flora',
    icon: '❀',
    descZh: '馬鈴薯果實、行道春芽、黑焰絲柏、金色麥海與盛開杏花——串聯四季與生命循環',
  },
  dwelling: {
    id: 'dwelling',
    nameZh: '居所主幹',
    nameEn: 'Dwelling',
    icon: '⌂',
    descZh: '農舍餐桌、街角咖啡座、亞爾黃色小屋臥室與奧維爾哥德教堂——人生活與棲居的溫度',
  },
  gaze: {
    id: 'gaze',
    nameZh: '視線主幹',
    nameEn: 'Gaze',
    icon: '❖',
    descZh: '半掩百葉窗、畫中畫、街道消失點與遠方地平線——最具電影感的框中框任意門結構',
  },
};

export interface NeighborEdge {
  to: PaintingId;
  motif: MotifId;
  reasonZh: string;
}

export interface WorldGraphNode {
  id: PaintingId;
  chapterId: ChapterId;
  moodZh: string;
  lightTypeZh: string;
  motifs: readonly MotifId[];
  portalIn: { motif: MotifId; descZh: string };
  portalOut: { motif: MotifId; descZh: string };
  neighbors: readonly NeighborEdge[];
}

export const WORLD_GRAPH: Record<PaintingId, WorldGraphNode> = {
  potato: {
    id: 'potato',
    chapterId: 'earth',
    moodZh: '沉靜 · 勞動 · 泥土溫度',
    lightTypeZh: '單一懸掛油燈 (Chiaroscuro)',
    motifs: ['light', 'dwelling', 'flora'],
    portalIn: { motif: 'dwelling', descZh: '由夜色降落農舍木桌與油燈微光' },
    portalOut: { motif: 'light', descZh: '飛入中央懸掛油燈的暖金火芯 → 點亮巴黎色彩' },
    neighbors: [
      { to: 'paris', motif: 'light', reasonZh: '油燈火芯綻放為巴黎晨光與點描色彩' },
      { to: 'cafe', motif: 'light', reasonZh: '農舍油燈跨時空共鳴亞爾露天咖啡座瓦斯燈' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '從荷蘭農舍餐桌走入亞爾黃色小屋居所' },
    ],
  },
  paris: {
    id: 'paris',
    chapterId: 'color',
    moodZh: '甦醒 · 輕快 · 視覺開闊',
    lightTypeZh: '印象派漫射晨光與互補色震動',
    motifs: ['road', 'light', 'sky', 'flora'],
    portalIn: { motif: 'light', descZh: '由單色油燈甦醒為克利希大道的彩色光點' },
    portalOut: { motif: 'road', descZh: '沿林蔭大道衝向南方驕陽消失點 → 抵達亞爾廣場' },
    neighbors: [
      { to: 'cafe', motif: 'road', reasonZh: '順著巴黎大道南下走進亞爾論壇廣場鵝卵石街' },
      { to: 'wheat', motif: 'flora', reasonZh: '從巴黎行道春芽飛向普羅旺斯陽光麥田' },
      { to: 'almond', motif: 'sky', reasonZh: '點描粉藍晴空延展為聖雷米松石綠春日天空' },
    ],
  },
  cafe: {
    id: 'cafe',
    chapterId: 'sun',
    moodZh: '溫暖 · 邀約 · 南方夏夜',
    lightTypeZh: '金黃瓦斯燈棚 vs 深鈷藍星空',
    motifs: ['light', 'road', 'dwelling', 'gaze'],
    portalIn: { motif: 'road', descZh: '由大道步入暖黃瓦斯燈照亮的露天咖啡座' },
    portalOut: { motif: 'road', descZh: '穿過鵝卵石街尾深藍星谷 → 步入隆河河畔' },
    neighbors: [
      { to: 'rhone', motif: 'road', reasonZh: '走出街尾直達幾步之遙的亞爾隆河堤岸' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '從街角咖啡館回到拉馬丁廣場黃色小屋臥室' },
      { to: 'starry', motif: 'sky', reasonZh: '仰望街尾星谷直入聖雷米 250 公里星旋' },
    ],
  },
  rhone: {
    id: 'rhone',
    chapterId: 'sun',
    moodZh: '靜謐 · 浪漫 · 波光搖曳',
    lightTypeZh: '北斗七星與堤岸瓦斯燈水波倒影',
    motifs: ['light', 'road', 'sky', 'gaze'],
    portalIn: { motif: 'road', descZh: '由街尾踏上閃耀金色水波柱的隆河岸邊' },
    portalOut: { motif: 'light', descZh: '飛入對岸暖黃窗燈 → 走進亞爾黃色小屋臥室' },
    neighbors: [
      { to: 'bedroom', motif: 'light', reasonZh: '循著對岸溫暖窗光走入黃色小屋室內安眠' },
      { to: 'starry', motif: 'sky', reasonZh: '由北斗七星攀升進入聖雷米巨大夜空雙渦流' },
      { to: 'church', motif: 'road', reasonZh: '沿河岸長路銜接奧維爾教堂前的分岔沙路' },
    ],
  },
  bedroom: {
    id: 'bedroom',
    chapterId: 'sun',
    moodZh: '安頓 · 親密 · 絕對的休息',
    lightTypeZh: '室內柔和日光與半掩百葉窗星光',
    motifs: ['dwelling', 'gaze', 'light'],
    portalIn: { motif: 'dwelling', descZh: '由窗燈進入鮮紅床單與淡紫藍牆面的私密房間' },
    portalOut: { motif: 'gaze', descZh: '推開半掩的綠色百葉窗 → 飛入聖雷米星夜' },
    neighbors: [
      { to: 'starry', motif: 'gaze', reasonZh: '穿過百葉窗縫隙，飛進聖保羅療養院窗外的狂暴星夜' },
      { to: 'church', motif: 'dwelling', reasonZh: '從私密臥室居所走向奧維爾神聖哥德殿堂' },
      { to: 'potato', motif: 'dwelling', reasonZh: '由亞爾木床回望荷蘭農舍木桌的最初記憶' },
    ],
  },
  starry: {
    id: 'starry',
    chapterId: 'cosmos',
    moodZh: '狂喜 · 崇高 · 宇宙律動',
    lightTypeZh: '雙渦流星雲、金星光環與熾熱橘黃新月',
    motifs: ['sky', 'light', 'flora', 'dwelling'],
    portalIn: { motif: 'gaze', descZh: '穿過窗框投入 250 公里深的雙渦流夜空' },
    portalOut: { motif: 'light', descZh: '迎向熾熱橘黃新月 → 聖雷米破曉化為金色麥田' },
    neighbors: [
      { to: 'wheat', motif: 'light', reasonZh: '橘黃新月破曉轉化為正午驕陽下的同片絲柏與山脈' },
      { to: 'crows', motif: 'sky', reasonZh: '夜空雙渦流凝聚為奧維爾暴風雨前的烏雲麥海' },
      { to: 'almond', motif: 'flora', reasonZh: '黑焰絲柏在春風中綻放為潔白杏花枝幹' },
    ],
  },
  wheat: {
    id: 'wheat',
    chapterId: 'cosmos',
    moodZh: '開闊 · 生命力 · 強風吹拂',
    lightTypeZh: '普羅旺斯松石綠晴空與翻滾白雲光影',
    motifs: ['flora', 'sky', 'light'],
    portalIn: { motif: 'light', descZh: '由破曉新月降落金色麥浪與雙株絲柏之間' },
    portalOut: { motif: 'sky', descZh: '衝入松石綠晴空與翻滾白雲 → 凝結為春日盛開杏花' },
    neighbors: [
      { to: 'almond', motif: 'sky', reasonZh: '松石綠晴空與白雲漩渦化為春日盛開的潔白杏花' },
      { to: 'crows', motif: 'flora', reasonZh: '聖雷米陽光麥浪轉入奧維爾暴風雨前的狂風麥海' },
      { to: 'paris', motif: 'sky', reasonZh: '晴空微風吹回巴黎克利希大道的點描天空' },
    ],
  },
  almond: {
    id: 'almond',
    chapterId: 'cosmos',
    moodZh: '新生 · 溫柔 · 春之禮讚',
    lightTypeZh: '清澈松石藍春空與珍珠白花瓣反光',
    motifs: ['flora', 'sky', 'gaze'],
    portalIn: { motif: 'sky', descZh: '由白雲渦流穿入立體交錯的杏花枝幹天幕' },
    portalOut: { motif: 'flora', descZh: '穿越飄落花雨與蔚藍晴空 → 北上奧維爾哥德教堂' },
    neighbors: [
      { to: 'church', motif: 'sky', reasonZh: '穿過樹梢蔚藍天際，北上抵達奧維爾教堂的深藍天空' },
      { to: 'crows', motif: 'flora', reasonZh: '飄落花瓣隨風吹向奧維爾遼闊的金色麥田' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '掛在臥室床頭的杏花畫作與居所記憶相連' },
    ],
  },
  church: {
    id: 'church',
    chapterId: 'road',
    moodZh: '莊嚴 · 震動 · 歷史與信仰',
    lightTypeZh: '深沉群青天空與彩繪玻璃幽光',
    motifs: ['road', 'dwelling', 'sky', 'gaze'],
    portalIn: { motif: 'road', descZh: '沿 Y 字分岔黃沙小徑仰望扭動哥德式教堂後殿' },
    portalOut: { motif: 'sky', descZh: '攀升鐘樓尖頂暗藍風暴 → 拉開 2:1 超寬銀幕麥田群鴉' },
    neighbors: [
      { to: 'crows', motif: 'sky', reasonZh: '飛越鐘樓尖頂暗藍風暴，展開奧維爾麥田群鴉超寬視野' },
      { to: 'potato', motif: 'dwelling', reasonZh: '奧維爾教堂鐘聲跨越時空回響於荷蘭故鄉農舍' },
      { to: 'cafe', motif: 'road', reasonZh: '教堂前分岔小徑連回亞爾廣場夜間街道' },
    ],
  },
  crows: {
    id: 'crows',
    chapterId: 'road',
    moodZh: '壯闊 · 蒼涼 · 風中歸途',
    lightTypeZh: '暴風雨前黑藍天際與金色麥海強烈反差',
    motifs: ['road', 'sky', 'flora', 'gaze'],
    portalIn: { motif: 'sky', descZh: '由鐘樓風暴俯衝進入三條紅棕小徑與 52 隻黑鴉群' },
    portalOut: { motif: 'road', descZh: '穿過迎面驚飛的黑鴉群 → 落回最初的黑土與農舍油燈' },
    neighbors: [
      { to: 'potato', motif: 'flora', reasonZh: '所有風暴與星旋最終落回黑土，重返《食薯者》溫暖油燈' },
      { to: 'cafe', motif: 'light', reasonZh: '穿過午夜風暴天際，遠方亮起亞爾夜間咖啡座的暖燈' },
      { to: 'starry', motif: 'sky', reasonZh: '暴風雨烏雲再度翻湧為聖雷米 250 公里星夜渦流' },
    ],
  },
};

export interface ThemePathSpec {
  id: string;
  nameZh: string;
  nameEn: string;
  motif: MotifId;
  descZh: string;
  sequence: readonly PaintingId[];
}

export const THEME_PATHS: readonly ThemePathSpec[] = [
  {
    id: 'odyssey',
    nameZh: '五大章完整史詩 · Earth to Road',
    nameEn: 'Complete 5-Chapter Odyssey (1885–1890)',
    motif: 'light',
    descZh: 'I 黑土與人 → II 巴黎覺醒 → III 亞爾驕陽 → IV 聖雷米宇宙 → V 奧維爾的路與風（10 幕完整長篇）',
    sequence: ['potato', 'paris', 'cafe', 'rhone', 'bedroom', 'starry', 'wheat', 'almond', 'church', 'crows'],
  },
  {
    id: 'nights',
    nameZh: '光與夜之路徑 · Nights & Lamps',
    nameEn: 'Nights & Lamps of Van Gogh',
    motif: 'light',
    descZh: '沿「光」之主幹旅行：荷蘭農舍油燈 → 亞爾瓦斯燈 → 隆河星波 → 聖雷米星夜新月 → 奧維爾暴風雨夜空',
    sequence: ['potato', 'cafe', 'rhone', 'starry', 'crows'],
  },
  {
    id: 'roads',
    nameZh: '道路與遠方 · Roads & Horizons',
    nameEn: 'Roads, Bridges & Horizons',
    motif: 'road',
    descZh: '沿「路」之主幹旅行：巴黎克利希大道 → 鵝卵石街 → 隆河堤岸 → 奧維爾教堂叉路 → 麥田三岔路',
    sequence: ['paris', 'cafe', 'rhone', 'church', 'crows'],
  },
  {
    id: 'dwellings',
    nameZh: '居所與視線 · Rooms & Sanctuaries',
    nameEn: 'Rooms, Windows & Sanctuaries',
    motif: 'dwelling',
    descZh: '沿「居所與窗框」旅行：食薯者農舍木桌 → 街角咖啡館 → 亞爾黃色小屋臥室百葉窗 → 奧維爾哥德教堂',
    sequence: ['potato', 'cafe', 'bedroom', 'church'],
  },
  {
    id: 'flora',
    nameZh: '黑土、繁花與風 · Earth to Blossoms',
    nameEn: 'Earth, Blossoms & Wind',
    motif: 'flora',
    descZh: '沿「植物與大地」旅行：荷蘭黑土馬鈴薯 → 巴黎春芽 → 聖雷米絲柏麥浪 → 盛開杏花 → 狂風麥田群鴉',
    sequence: ['potato', 'paris', 'wheat', 'almond', 'crows'],
  },
];

export function getChapterSpec(chapterId: ChapterId): ChapterSpec {
  return CHAPTER_SPECS.find((c) => c.id === chapterId) ?? CHAPTER_SPECS[0];
}

export function getThemePathSpec(pathId: string): ThemePathSpec {
  return THEME_PATHS.find((p) => p.id === pathId) ?? THEME_PATHS[0];
}
