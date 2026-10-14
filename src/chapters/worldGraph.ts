// Van Gogh World Graph (Level 2 Theme Paths, Level 3 Five Grand Chapters, 15 Worlds, 6 Motif Backbones & Portal Graph).
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
    years: '1883–1886',
    colorHex: '#c8964e',
    brushDnaZh: '暗褐煤灰調色盤 · 厚重刮刀筆觸 · 單一油燈明暗對比 (Chiaroscuro)',
    storyRoleZh: '建立宇宙的「根」：後來所有的光與星空，都是從這片黑土、舊鞋與勞動中長出來的。',
  },
  {
    id: 'color',
    roman: 'Chapter II',
    nameEn: 'Color',
    nameZh: '巴黎與覺醒',
    periodZh: '巴黎時期 · Paris',
    years: '1886–1888',
    colorHex: '#7eb8da',
    brushDnaZh: '印象派與點描短促排線 · 放射狀自畫像光環 · 互補色高頻跳動',
    storyRoleZh: '眼睛被打開：世界從封閉的單色黑土走向甦醒的彩色光譜與自我凝視。',
  },
  {
    id: 'sun',
    roman: 'Chapter III',
    nameEn: 'Sun',
    nameZh: '亞爾的黃金時代',
    periodZh: '普羅旺斯 · Arles',
    years: '1888–1889',
    colorHex: '#f2c230',
    brushDnaZh: '高飽和鉻黃向日葵與鈷藍夜空對比 · 強烈斜射光暈 · 城市夜色與溫暖居所交錯',
    storyRoleZh: '生命的第一座高峰：在南方驕陽與瓦斯夜燈下追尋理想藝術家之家與人際溫暖。',
  },
  {
    id: 'cosmos',
    roman: 'Chapter IV',
    nameEn: 'Cosmos',
    nameZh: '聖雷米的內在宇宙',
    periodZh: '聖雷米 · Saint-Rémy',
    years: '1889–1890',
    colorHex: '#5eb2bc',
    brushDnaZh: '250 公里長流線雙渦流場 · 紫藍鳶尾花海 · 火焰絲柏與盛開枝幹',
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
    brushDnaZh: '壓低天際線 · 交錯剛烈筆觸 · 憂鬱肖像曲線與 2:1 超寬銀幕風暴張力',
    storyRoleZh: '風中的終章：所有星旋與光最終又落回地面、肖像與分岔路途，並重返最初的土地。',
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
    descZh: '油燈、向日葵花盤、瓦斯燈、星芒、新月、烈日與彩繪玻璃——梵谷宇宙最核心的導航線',
  },
  road: {
    id: 'road',
    nameZh: '路之主幹',
    nameEn: 'Road',
    icon: '⟁',
    descZh: '農夫舊鞋、林蔭大道、鵝卵石街、隆河堤岸、教堂分岔路與麥田三岔路——決定鏡頭如何旅行',
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
    descZh: '馬鈴薯、向日葵、紫藍鳶尾花、黑焰絲柏、金色麥海、盛開杏花與毛地黃——串聯四季與生命循環',
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
    nameZh: '視線與肖像',
    nameEn: 'Gaze',
    icon: '❖',
    descZh: '自畫像翠綠雙眸、嘉舍醫師的憂鬱凝視、半掩百葉窗與遠方消失點——最具靈魂的框中框任意門',
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
    motifs: ['light', 'dwelling', 'flora', 'gaze'],
    portalIn: { motif: 'dwelling', descZh: '由夜色降落農舍木桌與油燈微光' },
    portalOut: { motif: 'light', descZh: '飛入中央懸掛油燈的暖金火芯 → 照亮地面踏上旅途的《一雙舊鞋》' },
    neighbors: [
      { to: 'shoes', motif: 'road', reasonZh: '油燈微光落向地面，照亮沾滿黑土、準備遠行的農夫舊鞋' },
      { to: 'cafe', motif: 'light', reasonZh: '農舍油燈跨時空共鳴亞爾露天咖啡座瓦斯燈' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '從荷蘭農舍餐桌走入亞爾黃色小屋居所' },
    ],
  },
  shoes: {
    id: 'shoes',
    chapterId: 'earth',
    moodZh: '滄桑 · 踏實 · 遠行起點',
    lightTypeZh: '粗麻畫布斜射暖金微光與皮革反光',
    motifs: ['road', 'light', 'dwelling'],
    portalIn: { motif: 'road', descZh: '由油燈暖光降落泥土斑駁的舊皮鞋與鬆開鞋帶' },
    portalOut: { motif: 'road', descZh: '順著蜿蜒延伸的鞋帶衝向右上金色門檻光束 → 踏上巴黎克利希大道' },
    neighbors: [
      { to: 'paris', motif: 'road', reasonZh: '穿上沾滿黑土的舊鞋走出北方暗室，踏上色彩甦醒的巴黎大道' },
      { to: 'potato', motif: 'dwelling', reasonZh: '由舊皮鞋回望荷蘭農舍餐桌旁的勞動家人' },
      { to: 'crows', motif: 'road', reasonZh: '最初遠行的雙腳，與最終章奧維爾麥田的分岔紅土小徑首尾呼應' },
    ],
  },
  paris: {
    id: 'paris',
    chapterId: 'color',
    moodZh: '甦醒 · 輕快 · 視覺開闊',
    lightTypeZh: '印象派漫射晨光與互補色震動',
    motifs: ['road', 'light', 'sky', 'flora'],
    portalIn: { motif: 'road', descZh: '由舊鞋門檻步入克利希大道的彩色光點' },
    portalOut: { motif: 'gaze', descZh: '穿過林蔭大道晨光 → 轉身對視畫家《戴草帽的自畫像》雙眸' },
    neighbors: [
      { to: 'selfportrait', motif: 'gaze', reasonZh: '在巴黎點描光譜中轉身，看見眼睛剛被色彩打開的梵谷本人' },
      { to: 'cafe', motif: 'road', reasonZh: '順著巴黎大道南下走進亞爾論壇廣場鵝卵石街' },
      { to: 'wheat', motif: 'flora', reasonZh: '從巴黎行道春芽飛向普羅旺斯陽光麥田' },
    ],
  },
  selfportrait: {
    id: 'selfportrait',
    chapterId: 'color',
    moodZh: '內省 · 熾熱 · 覺醒凝視',
    lightTypeZh: '放射狀點描光環與草帽金黃反光',
    motifs: ['gaze', 'light', 'sky'],
    portalIn: { motif: 'gaze', descZh: '由巴黎街頭步入放射狀鈷藍與金黃筆觸構成的自畫像光環' },
    portalOut: { motif: 'light', descZh: '飛入畫家翠綠瞳孔與金黃草帽邊緣 → 綻放為亞爾盛開的《向日葵》' },
    neighbors: [
      { to: 'sunflowers', motif: 'light', reasonZh: '草帽的金黃筆觸在南方陽光下燃燒綻放為十五朵《向日葵》' },
      { to: 'gachet', motif: 'gaze', reasonZh: '巴黎時期的自我凝視，跨越歲月與奧維爾《嘉舍醫師》憂鬱雙眼對望' },
      { to: 'starry', motif: 'sky', reasonZh: '自畫像背後的放射渦流筆觸，預示了聖雷米《星夜》的巨大星旋' },
    ],
  },
  sunflowers: {
    id: 'sunflowers',
    chapterId: 'sun',
    moodZh: '燃燒 · 禮讚 · 生命烈陽',
    lightTypeZh: '高彩度硫磺檸檬牆面與金橘花盤輝光',
    motifs: ['flora', 'light', 'dwelling'],
    portalIn: { motif: 'light', descZh: '由自畫像草帽金光進入黃色交響曲般的十五朵向日葵' },
    portalOut: { motif: 'light', descZh: '穿過中央向日葵燃燒的金色花盤核心 → 化為亞爾《夜間咖啡座》的瓦斯燈棚' },
    neighbors: [
      { to: 'cafe', motif: 'light', reasonZh: '白晝燃燒的金色向日葵花盤，入夜後化為照亮亞爾街角的金黃瓦斯燈' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '這束向日葵正是梵谷為了裝飾亞爾黃色小屋臥室而畫的迎賓之花' },
      { to: 'irises', motif: 'flora', reasonZh: '從亞爾金黃向日葵跨越季節走入聖雷米紫藍鳶尾花海' },
    ],
  },
  cafe: {
    id: 'cafe',
    chapterId: 'sun',
    moodZh: '溫暖 · 邀約 · 南方夏夜',
    lightTypeZh: '金黃瓦斯燈棚 vs 深鈷藍星空',
    motifs: ['light', 'road', 'dwelling', 'gaze'],
    portalIn: { motif: 'light', descZh: '由向日葵金光步入暖黃瓦斯燈照亮的露天咖啡座' },
    portalOut: { motif: 'road', descZh: '穿過鵝卵石街尾深藍星谷 → 步入隆河河畔' },
    neighbors: [
      { to: 'rhone', motif: 'road', reasonZh: '走出街尾直達幾步之遙的亞爾隆河堤岸' },
      { to: 'sunflowers', motif: 'light', reasonZh: '金黃瓦斯燈棚與白晝盛開的向日葵花盤同屬亞爾的太陽色彩' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '從街角咖啡館回到拉馬丁廣場黃色小屋臥室' },
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
      { to: 'sunflowers', motif: 'dwelling', reasonZh: '臥室牆色與裝飾黃色小屋的《向日葵》彼此呼應' },
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
    portalOut: { motif: 'light', descZh: '迎向熾熱橘黃新月 → 晨光降落療養院花園的《鳶尾花》' },
    neighbors: [
      { to: 'irises', motif: 'flora', reasonZh: '星夜破曉後，鏡頭降落聖保羅療養院圍牆內的紫藍鳶尾花園' },
      { to: 'wheat', motif: 'light', reasonZh: '橘黃新月破曉轉化為正午驕陽下的同片絲柏與山脈' },
      { to: 'crows', motif: 'sky', reasonZh: '夜空雙渦流凝聚為奧維爾暴風雨前的烏雲麥海' },
    ],
  },
  irises: {
    id: 'irises',
    chapterId: 'cosmos',
    moodZh: '生機 · 孤傲 · 浮世繪律動',
    lightTypeZh: '療養院花園晨光與純白鳶尾花反光',
    motifs: ['flora', 'light', 'gaze'],
    portalIn: { motif: 'flora', descZh: '由星夜晨光降落紅褐泥土與紫藍鳶尾花海' },
    portalOut: { motif: 'flora', descZh: '穿過萬紫叢中孤傲盛開的純白鳶尾花 → 迎風展開《有絲柏的麥田》' },
    neighbors: [
      { to: 'wheat', motif: 'flora', reasonZh: '順著迎風彎曲的翠綠劍葉走出花園，展開阿爾皮耶山麓的金色麥浪' },
      { to: 'almond', motif: 'flora', reasonZh: '純白鳶尾花瓣與春日盛開的珍珠白杏花彼此共鳴' },
      { to: 'sunflowers', motif: 'flora', reasonZh: '紫藍鳶尾花與金黃向日葵構成梵谷最著名的互補色雙生花' },
    ],
  },
  wheat: {
    id: 'wheat',
    chapterId: 'cosmos',
    moodZh: '開闊 · 生命力 · 強風吹拂',
    lightTypeZh: '普羅旺斯松石綠晴空與翻滾白雲光影',
    motifs: ['flora', 'sky', 'light'],
    portalIn: { motif: 'flora', descZh: '由純白鳶尾花穿入金色麥浪與雙株絲柏之間' },
    portalOut: { motif: 'sky', descZh: '衝入松石綠晴空與翻滾白雲 → 凝結為春日盛開杏花' },
    neighbors: [
      { to: 'almond', motif: 'sky', reasonZh: '松石綠晴空與白雲漩渦化為春日盛開的潔白杏花' },
      { to: 'crows', motif: 'flora', reasonZh: '聖雷米陽光麥浪轉入奧維爾暴風雨前的狂風麥海' },
      { to: 'irises', motif: 'flora', reasonZh: '由遼闊麥田回望聖保羅療養院花園的鳶尾花叢' },
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
      { to: 'irises', motif: 'flora', reasonZh: '春日杏花與花園鳶尾共同譜寫聖雷米的植物生命曲' },
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
    portalOut: { motif: 'gaze', descZh: '穿過彩繪玻璃幽光與群青天際 → 對視奧維爾知己《嘉舍醫師畫像》' },
    neighbors: [
      { to: 'gachet', motif: 'gaze', reasonZh: '教堂的群青天空化為嘉舍醫師背後的螺旋藍調與溫柔守護' },
      { to: 'crows', motif: 'sky', reasonZh: '飛越鐘樓尖頂暗藍風暴，展開奧維爾麥田群鴉超寬視野' },
      { to: 'potato', motif: 'dwelling', reasonZh: '奧維爾教堂鐘聲跨越時空回響於荷蘭故鄉農舍' },
    ],
  },
  gachet: {
    id: 'gachet',
    chapterId: 'road',
    moodZh: '憂鬱 · 同理 · 時代的心碎表情',
    lightTypeZh: '雙色群青漩渦背景與鮮紅桌面毛地黃微光',
    motifs: ['gaze', 'flora', 'sky'],
    portalIn: { motif: 'gaze', descZh: '由教堂群青天空進入支頤沉思的嘉舍醫師與紫紅毛地黃花枝' },
    portalOut: { motif: 'sky', descZh: '穿過醫師憂鬱雙眸與背後翻湧的深藍漩渦 → 拉開 2:1 超寬銀幕《麥田群鴉》' },
    neighbors: [
      { to: 'crows', motif: 'sky', reasonZh: '嘉舍醫師背後翻湧的深藍筆觸，直接延伸為奧維爾暴風雨前的麥田天空' },
      { to: 'selfportrait', motif: 'gaze', reasonZh: '梵谷稱嘉舍醫師是「另一個自己」，兩幅肖像跨時空深情對望' },
      { to: 'irises', motif: 'flora', reasonZh: '紅桌上的紫紅毛地黃藥草與聖雷米的紫藍鳶尾花遙相呼應' },
    ],
  },
  crows: {
    id: 'crows',
    chapterId: 'road',
    moodZh: '壯闊 · 蒼涼 · 風中歸途',
    lightTypeZh: '暴風雨前黑藍天際與金色麥海強烈反差',
    motifs: ['road', 'sky', 'flora', 'gaze'],
    portalIn: { motif: 'sky', descZh: '由深藍風暴俯衝進入三條紅棕小徑與 52 隻黑鴉群' },
    portalOut: { motif: 'road', descZh: '穿過迎面驚飛的黑鴉群 → 落回最初的黑土與《食薯者》油燈' },
    neighbors: [
      { to: 'potato', motif: 'flora', reasonZh: '所有風暴與星旋最終落回黑土，重返《食薯者》溫暖油燈' },
      { to: 'shoes', motif: 'road', reasonZh: '麥田三岔路的紅土小徑，連回第一章踏上旅途的《一雙舊鞋》' },
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
    nameZh: '五大章十五幕完整史詩 · Complete 15-Act Odyssey',
    nameEn: 'Complete 5-Chapter 15-Act Odyssey (1885–1890)',
    motif: 'light',
    descZh: 'I 黑土與人(2幕) → II 巴黎覺醒(2幕) → III 亞爾驕陽(4幕) → IV 聖雷米宇宙(4幕) → V 奧維爾的路與風(3幕)',
    sequence: [
      'potato', 'shoes',
      'paris', 'selfportrait',
      'sunflowers', 'cafe', 'rhone', 'bedroom',
      'starry', 'irises', 'wheat', 'almond',
      'church', 'gachet', 'crows',
    ],
  },
  {
    id: 'nights',
    nameZh: '光與夜之路 · Nights, Lamps & Suns',
    nameEn: 'Nights, Lamps & Suns of Van Gogh',
    motif: 'light',
    descZh: '沿「✦ 光」之主幹旅行：荷蘭油燈 → 亞爾向日葵 → 夜間咖啡座 → 隆河星波 → 聖雷米星夜 → 奧維爾風暴夜空',
    sequence: ['potato', 'sunflowers', 'cafe', 'rhone', 'starry', 'crows'],
  },
  {
    id: 'roads',
    nameZh: '道路與遠方 · Shoes, Roads & Horizons',
    nameEn: 'Shoes, Boulevards & Forking Roads',
    motif: 'road',
    descZh: '沿「⟁ 路」之主幹旅行：一雙舊鞋 → 巴黎克利希大道 → 亞爾鵝卵石街 → 隆河堤岸 → 奧維爾教堂叉路 → 麥田三岔路',
    sequence: ['shoes', 'paris', 'cafe', 'rhone', 'church', 'crows'],
  },
  {
    id: 'dwellings',
    nameZh: '居所與聖殿 · Rooms & Sanctuaries',
    nameEn: 'Rooms, Tables & Sanctuaries',
    motif: 'dwelling',
    descZh: '沿「⌂ 居所」旅行：食薯者農舍木桌 → 向日葵陶罐 → 街角咖啡館 → 亞爾黃色小屋臥室 → 奧維爾哥德教堂',
    sequence: ['potato', 'sunflowers', 'cafe', 'bedroom', 'church'],
  },
  {
    id: 'flora',
    nameZh: '黑土、繁花與風 · Earth, Blossoms & Wind',
    nameEn: 'From Dark Earth to Sunflowers, Irises & Wheat',
    motif: 'flora',
    descZh: '沿「❀ 植物」旅行：食薯者馬鈴薯 → 亞爾向日葵 → 聖雷米鳶尾花 → 絲柏麥浪 → 盛開杏花 → 狂風麥田群鴉',
    sequence: ['potato', 'sunflowers', 'irises', 'wheat', 'almond', 'crows'],
  },
  {
    id: 'gaze',
    nameZh: '凝視與靈魂 · Gaze, Portraits & Mirrors',
    nameEn: 'Self-Portrait, Dr. Gachet & The Inner Eye',
    motif: 'gaze',
    descZh: '沿「❖ 視線與肖像」旅行：荷蘭農民面龐 → 戴草帽的自畫像 → 亞爾臥室百葉窗 → 嘉舍醫師的憂鬱凝視 → 星夜渦流',
    sequence: ['potato', 'selfportrait', 'bedroom', 'gachet', 'starry'],
  },
];

export function getChapterSpec(chapterId: ChapterId): ChapterSpec {
  return CHAPTER_SPECS.find((c) => c.id === chapterId) ?? CHAPTER_SPECS[0];
}

export function getThemePathSpec(pathId: string): ThemePathSpec {
  return THEME_PATHS.find((p) => p.id === pathId) ?? THEME_PATHS[0];
}
