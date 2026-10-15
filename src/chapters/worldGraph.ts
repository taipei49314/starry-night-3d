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
  // ---------------- CHAPTER I: EARTH (Nuenen & Antwerp, 1884–1886) ----------------
  potato: {
    id: 'potato',
    chapterId: 'earth',
    moodZh: '沉靜 · 勞動 · 泥土溫度',
    lightTypeZh: '單一懸掛油燈 (Chiaroscuro)',
    motifs: ['light', 'dwelling', 'flora', 'gaze'],
    portalIn: { motif: 'dwelling', descZh: '由夜色降落農舍木桌與油燈微光' },
    portalOut: { motif: 'dwelling', descZh: '飛入中央懸掛油燈的暖金火芯 → 走入隔壁農舍《織布工》木機框' },
    neighbors: [
      { to: 'weaver', motif: 'dwelling', reasonZh: '由農舍餐桌走入隔壁紐넨織布工坊的橡木織布機與窗光' },
      { to: 'shoes', motif: 'road', reasonZh: '油燈微光落向地面，照亮沾滿黑土、準備遠行的農夫舊鞋' },
      { to: 'cafe', motif: 'light', reasonZh: '農舍油燈跨時空共鳴亞爾露天咖啡座瓦斯燈' },
    ],
  },
  weaver: {
    id: 'weaver',
    chapterId: 'earth',
    moodZh: '專注 · 律動 · 木機經緯',
    lightTypeZh: '農舍小窗斜射晨光與亞麻布反光',
    motifs: ['dwelling', 'light', 'gaze'],
    portalIn: { motif: 'dwelling', descZh: '由農舍油燈穿入巨大橡木織布機的立體橫樑' },
    portalOut: { motif: 'light', descZh: '穿過右側農舍明窗光束 → 望見暮色中的《紐넨的舊教堂塔樓》' },
    neighbors: [
      { to: 'tower', motif: 'light', reasonZh: '望向織布機旁的農舍小窗外，暮色中矗立著紐넨舊教堂塔樓' },
      { to: 'potato', motif: 'dwelling', reasonZh: '同屬紐넨農村勞動者的室內生命寫照' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '橡木織布機的厚實木構與亞爾臥室木床遙相呼應' },
    ],
  },
  tower: {
    id: 'tower',
    chapterId: 'earth',
    moodZh: '蒼勁 · 歲月 · 大地守望',
    lightTypeZh: '銀灰赭石暮光與飛鳥剪影',
    motifs: ['dwelling', 'sky', 'road'],
    portalIn: { motif: 'light', descZh: '由織布工坊窗框飛出，仰望風中屹立的舊教堂鐘樓' },
    portalOut: { motif: 'road', descZh: '由教堂墓園小徑低頭望向泥土 → 聚焦《一雙舊鞋》' },
    neighbors: [
      { to: 'shoes', motif: 'road', reasonZh: '走過紐넨舊教堂墓園的泥土小徑，低頭看見踏遍大地的《一雙舊鞋》' },
      { to: 'church', motif: 'dwelling', reasonZh: '荷蘭紐넨舊塔樓與終章《奧維的教堂》形成頭尾雙塔呼應' },
      { to: 'crows', motif: 'sky', reasonZh: '繞塔盤旋的寒鴉預示了最終章《麥田群鴉》的風暴黑鴉' },
    ],
  },
  shoes: {
    id: 'shoes',
    chapterId: 'earth',
    moodZh: '滄桑 · 踏實 · 遠行起點',
    lightTypeZh: '粗麻畫布斜射暖金微光與皮革反光',
    motifs: ['road', 'light', 'dwelling'],
    portalIn: { motif: 'road', descZh: '由舊塔樓泥土小徑降落斑駁舊皮鞋與鬆開鞋帶' },
    portalOut: { motif: 'gaze', descZh: '順著蜿蜒鞋帶衝向暗室微光 → 凝視安特衛普《叼菸骷髏》的幽默與無常' },
    neighbors: [
      { to: 'skull', motif: 'gaze', reasonZh: '踏出紐넨鄉間前往安特衛普學院，在暗室微光中面對生與死的幽默凝視' },
      { to: 'paris', motif: 'road', reasonZh: '穿上沾滿黑土的舊鞋走出北方暗室，踏上色彩甦醒的巴黎大道' },
      { to: 'crows', motif: 'road', reasonZh: '最初遠行的雙腳，與最終章奧維爾麥田的分岔紅土小徑首尾呼應' },
    ],
  },
  skull: {
    id: 'skull',
    chapterId: 'earth',
    moodZh: '叛逆 · 無常 · 火光微塵',
    lightTypeZh: '深褐暗室明暗法與香菸紅燼微光',
    motifs: ['gaze', 'light'],
    portalIn: { motif: 'gaze', descZh: '由舊鞋微光穿入安特衛普暗室中叼著香菸的象牙白骷髏' },
    portalOut: { motif: 'light', descZh: '飛入香菸燃燒的赤紅火燼與青煙漩渦 → 破曉進入巴黎《蒙馬特的煎餅磨坊》' },
    neighbors: [
      { to: 'galette', motif: 'light', reasonZh: '穿過香菸火燼與上升青煙，走出北方學院暗室，迎來蒙馬特高地的陽光與風車' },
      { to: 'selfportrait', motif: 'gaze', reasonZh: '安特衛普的骨骼寫生與巴黎《戴草帽的自畫像》構成外在與內在的雙重凝視' },
      { to: 'gachet', motif: 'gaze', reasonZh: '對生命無常的凝視，在終章化為嘉舍醫師溫柔而憂鬱的眼神' },
    ],
  },

  // ---------------- CHAPTER II: COLOR (Paris & Montmartre, 1886–1887) ----------------
  galette: {
    id: 'galette',
    chapterId: 'color',
    moodZh: '開朗 · 微風 · 蒙馬特高地',
    lightTypeZh: '巴黎秋日晴空與三色旗光影',
    motifs: ['sky', 'road', 'dwelling'],
    portalIn: { motif: 'light', descZh: '由暗室火燼衝出，迎見蒙馬特山丘轉動的木造風車翼' },
    portalOut: { motif: 'road', descZh: '順著蒙馬特山坡木欄杆走下山丘 → 步入點描光譜《克利希大道》' },
    neighbors: [
      { to: 'paris', motif: 'road', reasonZh: '從蒙馬特山丘的煎餅磨坊走下斜坡，便是車水馬龍的克利希林蔭大道' },
      { to: 'seine', motif: 'sky', reasonZh: '蒙馬特高地的秋日晴空延伸至塞納河畔的波光與鐵橋' },
      { to: 'tower', motif: 'dwelling', reasonZh: '巴黎木造風車塔與故鄉紐넨舊教堂塔樓跨時空守望' },
    ],
  },
  paris: {
    id: 'paris',
    chapterId: 'color',
    moodZh: '甦醒 · 輕快 · 視覺開闊',
    lightTypeZh: '印象派漫射晨光與互補色震動',
    motifs: ['road', 'light', 'sky', 'flora'],
    portalIn: { motif: 'road', descZh: '由蒙馬特山坡步入克利希大道的彩色光點' },
    portalOut: { motif: 'road', descZh: '穿過林蔭大道晨光向西漫步 → 抵達波光粼粼的《阿尼耶爾的塞納河與橋》' },
    neighbors: [
      { to: 'seine', motif: 'road', reasonZh: '沿著巴黎西北街道一路漫步寫生，來到阿尼耶爾的塞納河鐵橋畔' },
      { to: 'selfportrait', motif: 'gaze', reasonZh: '在巴黎點描光譜中轉身，看見眼睛剛被色彩打開的梵谷本人' },
      { to: 'cafe', motif: 'road', reasonZh: '順著巴黎大道南下走進亞爾論壇廣場鵝卵石街' },
    ],
  },
  seine: {
    id: 'seine',
    chapterId: 'color',
    moodZh: '明快 · 波光 · 現代生活',
    lightTypeZh: '夏日正午陽光與松石藍河面碎光',
    motifs: ['road', 'light', 'sky'],
    portalIn: { motif: 'road', descZh: '由克利希大道穿入朱紅鐵橋與塞納河碎鑽波光' },
    portalOut: { motif: 'road', descZh: '穿過蒸汽火車白煙與橋拱 → 化為浮世繪《雨中大橋（仿廣重）》' },
    neighbors: [
      { to: 'plum', motif: 'road', reasonZh: '塞納河上的現代鐵橋，在梵谷心中與歌川廣重筆下的江戶木橋重疊共鳴' },
      { to: 'rhone', motif: 'light', reasonZh: '阿尼耶爾白晝的塞納河波光，入夜後化為亞爾《隆河上的星夜》金色水波' },
      { to: 'paris', motif: 'road', reasonZh: '由塞納河堤岸返回蒙馬特克利希大道' },
    ],
  },
  plum: {
    id: 'plum',
    chapterId: 'color',
    moodZh: '詩意 · 東方 · 驟雨斜絲',
    lightTypeZh: '浮世繪漸層靛藍天幕與斜雨金光',
    motifs: ['road', 'sky', 'flora'],
    portalIn: { motif: 'road', descZh: '由塞納河鐵橋穿入三千道浮世繪斜雨絲與高腳木橋' },
    portalOut: { motif: 'gaze', descZh: '穿過雨中紙傘與漢字邊框 → 成為《唐吉老爹肖像》背後的浮世繪背景牆' },
    neighbors: [
      { to: 'tanguy', motif: 'gaze', reasonZh: '這幅仿廣重浮世繪，正是掛在唐吉老爹顏料店背牆上的日本版畫收藏' },
      { to: 'irises', motif: 'flora', reasonZh: '浮世繪的平面色塊與斜線構圖，直接啟發了聖雷米《鳶尾花》的視覺語法' },
      { to: 'crows', motif: 'sky', reasonZh: '江戶驟雨的斜向筆觸，與終章奧維爾暴風雨麥田的狂風排線遙相呼應' },
    ],
  },
  tanguy: {
    id: 'tanguy',
    chapterId: 'color',
    moodZh: '慈祥 · 絢爛 · 浮世繪殿堂',
    lightTypeZh: '正面平光肖像與背後滿牆浮世繪彩光',
    motifs: ['gaze', 'flora', 'dwelling'],
    portalIn: { motif: 'gaze', descZh: '由雨中大橋版畫退後一步，看見端坐於浮世繪牆前的唐吉老爹' },
    portalOut: { motif: 'gaze', descZh: '由唐吉老爹慈祥雙眼轉向畫架前 → 對視《戴草帽的自畫像》' },
    neighbors: [
      { to: 'selfportrait', motif: 'gaze', reasonZh: '畫完摯友唐吉老爹後，梵谷將同樣的色彩能量轉向鏡中的自己' },
      { to: 'gachet', motif: 'gaze', reasonZh: '巴黎的唐吉老爹與奧維爾的嘉舍醫師，是梵谷藝術生命中最溫暖的兩位守護者' },
      { to: 'almond', motif: 'flora', reasonZh: '背景浮世繪中的富士山櫻花，在第四章化為聖雷米盛開的《杏花》' },
    ],
  },
  selfportrait: {
    id: 'selfportrait',
    chapterId: 'color',
    moodZh: '內省 · 熾熱 · 覺醒凝視',
    lightTypeZh: '放射狀點描光環與草帽金黃反光',
    motifs: ['gaze', 'light', 'sky'],
    portalIn: { motif: 'gaze', descZh: '由唐吉老爹的凝視步入放射狀鈷藍與金黃筆觸構成的自畫像光環' },
    portalOut: { motif: 'light', descZh: '飛入畫家翠綠瞳孔與金黃草帽邊緣 → 沐浴亞爾《黃色小屋》的南方烈日' },
    neighbors: [
      { to: 'yellowhouse', motif: 'light', reasonZh: '帶著巴黎覺醒的色彩與草帽搭火車南下，在亞爾拉馬丁廣場找到夢寐以求的《黃色小屋》' },
      { to: 'sunflowers', motif: 'light', reasonZh: '草帽的金黃筆觸在南方陽光下燃燒綻放為十五朵《向日葵》' },
      { to: 'gachet', motif: 'gaze', reasonZh: '巴黎時期的自我凝視，跨越歲月與奧維爾《嘉舍醫師》憂鬱雙眼對望' },
    ],
  },

  // ---------------- CHAPTER III: SUN (Arles, 1888–1889) ----------------
  yellowhouse: {
    id: 'yellowhouse',
    chapterId: 'sun',
    moodZh: '理想 · 熾烈 · 藝術家之家',
    lightTypeZh: '正午深鈷藍晴空與鉻黃牆面極端反差',
    motifs: ['dwelling', 'light', 'road', 'sky'],
    portalIn: { motif: 'light', descZh: '由自畫像草帽金光降落拉馬丁廣場 2 號閃耀鉻黃光芒的街角小屋' },
    portalOut: { motif: 'dwelling', descZh: '推開二樓翠綠百葉窗走進室內 → 看見桌上迎賓的十五朵《向日葵》' },
    neighbors: [
      { to: 'sunflowers', motif: 'flora', reasonZh: '走進黃色小屋室內，桌上正擺著梵谷為迎接高更而畫的金黃《向日葵》' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '正面二樓右側那扇半開的綠色百葉窗後，正是《在亞爾的臥室》' },
      { to: 'cafe', motif: 'road', reasonZh: '從黃色小屋沿街散步數分鐘，便抵達論壇廣場的《夜間咖啡座》' },
    ],
  },
  sunflowers: {
    id: 'sunflowers',
    chapterId: 'sun',
    moodZh: '燃燒 · 禮讚 · 生命烈陽',
    lightTypeZh: '高彩度硫磺檸檬牆面與金橘花盤輝光',
    motifs: ['flora', 'light', 'dwelling'],
    portalIn: { motif: 'flora', descZh: '由黃色小屋百葉窗走入黃色交響曲般的十五朵向日葵' },
    portalOut: { motif: 'flora', descZh: '穿過中央向日葵燃燒的金色花盤核心 → 飛向陽光普照的《克勞平原的豐收》' },
    neighbors: [
      { to: 'harvest', motif: 'flora', reasonZh: '向日葵的太陽金黃向外無限展開，化為亞爾城外克勞平原一望無際的豐收麥海' },
      { to: 'cafe', motif: 'light', reasonZh: '白晝燃燒的金色向日葵花盤，入夜後化為照亮亞爾街角的金黃瓦斯燈' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '這束向日葵正是梵谷為了裝飾亞爾黃色小屋臥室而畫的迎賓之花' },
    ],
  },
  harvest: {
    id: 'harvest',
    chapterId: 'sun',
    moodZh: '遼闊 · 豐饒 · 仲夏拼布',
    lightTypeZh: '普羅旺斯松石藍高空與金黃麥田全景光',
    motifs: ['flora', 'road', 'sky'],
    portalIn: { motif: 'flora', descZh: '由向日葵花盤飛出，俯瞰克勞平原金黃麥垛與藍色農車的壯麗全景' },
    portalOut: { motif: 'light', descZh: '迎向阿爾皮耶山巔傾瀉的午後金光 → 步入《夕陽下的播種者》' },
    neighbors: [
      { to: 'sower', motif: 'light', reasonZh: '仲夏克勞平原的豐收過後，秋日夕陽下播種者再次將金色種子撒向紫藍田壟' },
      { to: 'wheat', motif: 'flora', reasonZh: '亞爾的平疇麥海與聖雷米狂風中的《有絲柏的麥田》同屬太陽與大地的禮讚' },
      { to: 'daubigny', motif: 'flora', reasonZh: '普羅旺斯廣角田園全景與奧維爾《多比尼的花園》雙正方形視野遙相呼應' },
    ],
  },
  sower: {
    id: 'sower',
    chapterId: 'sun',
    moodZh: '神聖 · 永恆 · 烈日播種',
    lightTypeZh: '巨大檸檬黃落日圓盤與紫藍犁溝逆光',
    motifs: ['light', 'flora', 'road', 'gaze'],
    portalIn: { motif: 'light', descZh: '由豐收平原迎向地平線上碩大無朋的檸檬黃落日光輪' },
    portalOut: { motif: 'light', descZh: '穿過落日餘暉與斜向柳樹枝幹 → 入夜點亮《夜間咖啡座》的瓦斯燈' },
    neighbors: [
      { to: 'cafe', motif: 'light', reasonZh: '當克勞平原的巨大金黃落日沉入地平線，亞爾城內的露天咖啡座隨即亮起溫暖瓦斯燈' },
      { to: 'olive', motif: 'light', reasonZh: '播種者地平線上的巨大黃日，在聖雷米化為橄欖樹叢間燃燒的金色太陽' },
      { to: 'potato', motif: 'flora', reasonZh: '田間播種與農舍食薯，串起梵谷一生對土地勞動者的敬意' },
    ],
  },
  cafe: {
    id: 'cafe',
    chapterId: 'sun',
    moodZh: '溫暖 · 邀約 · 南方夏夜',
    lightTypeZh: '金黃瓦斯燈棚 vs 深鈷藍星空',
    motifs: ['light', 'road', 'dwelling', 'gaze'],
    portalIn: { motif: 'light', descZh: '由落日金光步入暖黃瓦斯燈照亮的露天咖啡座' },
    portalOut: { motif: 'dwelling', descZh: '走入街角咖啡館深處門廊 → 踏進血紅與翠綠對撞的《夜間咖啡館》室內' },
    neighbors: [
      { to: 'nightcafe', motif: 'dwelling', reasonZh: '從論壇廣場溫馨的戶外露天咖啡座推門而入，進入拉馬丁廣場徹夜不眠的室內《夜間咖啡館》' },
      { to: 'rhone', motif: 'road', reasonZh: '走出街尾直達幾步之遙的亞爾隆河堤岸' },
      { to: 'sunflowers', motif: 'light', reasonZh: '金黃瓦斯燈棚與白晝盛開的向日葵花盤同屬亞爾的太陽色彩' },
    ],
  },
  nightcafe: {
    id: 'nightcafe',
    chapterId: 'sun',
    moodZh: '眩暈 · 熾熱 · 午夜靈魂',
    lightTypeZh: '四盞硫磺瓦斯吊燈光暈與血紅牆面',
    motifs: ['light', 'dwelling', 'gaze'],
    portalIn: { motif: 'dwelling', descZh: '推開咖啡館門扉，踏上陡峭傾斜的硫磺松木地板與綠色撞球檯' },
    portalOut: { motif: 'light', descZh: '穿過天花板眩目的瓦斯燈光環走出夜街 → 迎見《隆河上的星夜》' },
    neighbors: [
      { to: 'rhone', motif: 'light', reasonZh: '走出窒息悶熱的午夜咖啡館，在清涼的隆河岸邊仰望滿天星斗與金色水波' },
      { to: 'bedroom', motif: 'dwelling', reasonZh: '《夜間咖啡館》的躁動張力與《在亞爾的臥室》的絕對安寧，構成室內空間的陰陽兩極' },
      { to: 'potato', motif: 'light', reasonZh: '懸掛的瓦斯燈光環回響著第一章《食薯者》木桌上的油燈' },
    ],
  },
  rhone: {
    id: 'rhone',
    chapterId: 'sun',
    moodZh: '靜謐 · 浪漫 · 波光搖曳',
    lightTypeZh: '北斗七星與堤岸瓦斯燈水波倒影',
    motifs: ['light', 'road', 'sky', 'gaze'],
    portalIn: { motif: 'light', descZh: '由午夜咖啡館踏上閃耀金色水波柱的隆河岸邊' },
    portalOut: { motif: 'light', descZh: '飛入對岸暖黃窗燈 → 走進《在亞爾的臥室》安眠' },
    neighbors: [
      { to: 'bedroom', motif: 'light', reasonZh: '循著對岸溫暖窗光走入黃色小屋室內安眠' },
      { to: 'starry', motif: 'sky', reasonZh: '由北斗七星攀升進入聖雷米巨大夜空雙渦流' },
      { to: 'seine', motif: 'road', reasonZh: '亞爾夜晚的隆河星波與巴黎白晝的塞納河碎光跨時空交映' },
    ],
  },
  bedroom: {
    id: 'bedroom',
    chapterId: 'sun',
    moodZh: '安頓 · 親密 · 絕對的休息',
    lightTypeZh: '室內柔和日光與半掩百葉窗星光',
    motifs: ['dwelling', 'gaze', 'light'],
    portalIn: { motif: 'dwelling', descZh: '由窗燈進入鮮紅床單與淡紫藍牆面的私密房間' },
    portalOut: { motif: 'gaze', descZh: '推開半掩的綠色百葉窗 → 飛入聖雷米《星夜》' },
    neighbors: [
      { to: 'starry', motif: 'gaze', reasonZh: '穿過百葉窗縫隙，飛進聖保羅療養院窗外的狂暴星夜' },
      { to: 'yellowhouse', motif: 'dwelling', reasonZh: '這間臥室正位於拉馬丁廣場《黃色小屋》二樓右側窗後' },
      { to: 'potato', motif: 'dwelling', reasonZh: '由亞爾木床回望荷蘭農舍木桌的最初記憶' },
    ],
  },

  // ---------------- CHAPTER IV: COSMOS (Saint-Rémy, 1889–1890) ----------------
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
      { to: 'roadcypress', motif: 'sky', reasonZh: '《星夜》的雙渦流與新月，在離開聖雷米前夕凝練為《有絲柏與星辰的道路》' },
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
    portalOut: { motif: 'flora', descZh: '穿過萬紫叢中孤傲盛開的純白鳶尾花 → 走入金色斜陽下的《橄欖樹與黃色天空及太陽》' },
    neighbors: [
      { to: 'olive', motif: 'flora', reasonZh: '走出療養院花園圍牆，步入阿爾皮耶山腳下枝幹盤曲、沐浴金黃斜陽的橄欖樹林' },
      { to: 'wheat', motif: 'flora', reasonZh: '順著迎風彎曲的翠綠劍葉展開阿爾皮耶山麓的金色麥浪' },
      { to: 'almond', motif: 'flora', reasonZh: '純白鳶尾花瓣與春日盛開的珍珠白杏花彼此共鳴' },
    ],
  },
  olive: {
    id: 'olive',
    chapterId: 'cosmos',
    moodZh: '盤曲 · 律動 · 金色斜陽',
    lightTypeZh: '檸檬黃天際同心圓太陽與銀綠樹冠光影',
    motifs: ['flora', 'light', 'sky'],
    portalIn: { motif: 'flora', descZh: '由純白鳶尾花穿入銀綠葉浪翻湧的橄欖樹叢與金色光輪' },
    portalOut: { motif: 'sky', descZh: '穿過檸檬黃太陽的同心圓光波 → 迎風展開《有絲柏的麥田》' },
    neighbors: [
      { to: 'wheat', motif: 'flora', reasonZh: '橄欖樹冠的翻湧律動，直接延伸為阿爾皮耶山麓金色麥浪與火焰絲柏的呼吸' },
      { to: 'sower', motif: 'light', reasonZh: '橄欖樹叢間的同心圓烈日與亞爾《夕陽下的播種者》的大日輪遙相輝映' },
      { to: 'starry', motif: 'sky', reasonZh: '白晝橄欖樹冠的渦流筆觸，正是夜晚《星夜》天空星雲的地面鏡像' },
    ],
  },
  wheat: {
    id: 'wheat',
    chapterId: 'cosmos',
    moodZh: '開闊 · 生命力 · 強風吹拂',
    lightTypeZh: '普羅旺斯松石綠晴空與翻滾白雲光影',
    motifs: ['flora', 'sky', 'light'],
    portalIn: { motif: 'flora', descZh: '由橄欖樹林穿入金色麥浪與雙株絲柏之間' },
    portalOut: { motif: 'road', descZh: '順著麥田邊緣小徑步入暮色 → 仰望《有絲柏與星辰的道路》' },
    neighbors: [
      { to: 'roadcypress', motif: 'flora', reasonZh: '白晝麥田邊的墨綠絲柏，在離開聖雷米的最後一夜化為直指星月的高聳雙生絲柏' },
      { to: 'almond', motif: 'sky', reasonZh: '松石綠晴空與白雲漩渦化為春日盛開的潔白杏花' },
      { to: 'crows', motif: 'flora', reasonZh: '聖雷米陽光麥浪轉入奧維爾暴風雨前的狂風麥海' },
    ],
  },
  roadcypress: {
    id: 'roadcypress',
    chapterId: 'cosmos',
    moodZh: '告別 · 朝聖 · 星月交輝',
    lightTypeZh: '新月、太白金星與雙株火焰絲柏夜光',
    motifs: ['road', 'flora', 'sky', 'light'],
    portalIn: { motif: 'road', descZh: '由麥田小徑步入新月與金星夾峙的雙株高聳絲柏夜路' },
    portalOut: { motif: 'flora', descZh: '穿過絲柏尖端與新月光環 → 迎來象徵新生的春日《盛開的杏花》' },
    neighbors: [
      { to: 'almond', motif: 'sky', reasonZh: '穿過普羅旺斯最後的夜路與星月，迎來慶賀姪子誕生的松石藍春空與潔白杏花' },
      { to: 'starry', motif: 'sky', reasonZh: '與《星夜》共享新月、金星與火焰絲柏的聖雷米雙生夜曲' },
      { to: 'church', motif: 'road', reasonZh: '繞過中央高聳絲柏的分岔夜路，預示了北上奧維爾教堂前的 Y 字沙路' },
    ],
  },
  almond: {
    id: 'almond',
    chapterId: 'cosmos',
    moodZh: '新生 · 溫柔 · 春之禮讚',
    lightTypeZh: '清澈松石藍春空與珍珠白花瓣反光',
    motifs: ['flora', 'sky', 'gaze'],
    portalIn: { motif: 'sky', descZh: '由絲柏星月夜空穿入立體交錯的杏花枝幹天幕' },
    portalOut: { motif: 'flora', descZh: '穿越飄落花雨與蔚藍晴空 → 北上抵達瓦茲河谷《奧維的茅草屋》' },
    neighbors: [
      { to: 'cottages', motif: 'sky', reasonZh: '穿過樹梢蔚藍天際北上瓦茲河谷，降落於春風吹拂的《奧維的茅草屋》' },
      { to: 'church', motif: 'sky', reasonZh: '松石藍春空轉為奧維爾哥德教堂背後的深邃群青天幕' },
      { to: 'irises', motif: 'flora', reasonZh: '春日杏花與花園鳶尾共同譜寫聖雷米的植物生命曲' },
    ],
  },

  // ---------------- CHAPTER V: ROAD (Auvers-sur-Oise, May–July 1890) ----------------
  cottages: {
    id: 'cottages',
    chapterId: 'road',
    moodZh: '起伏 · 生機 · 大地呼吸',
    lightTypeZh: '翻湧鈷藍雲海與青苔茅草屋頂陽光',
    motifs: ['dwelling', 'road', 'flora', 'sky'],
    portalIn: { motif: 'sky', descZh: '由杏花晴空降落奧維爾如波浪般起伏的青苔茅草屋與春草小徑' },
    portalOut: { motif: 'road', descZh: '順著茅草屋前的綠茵小徑前行 → 仰望《奧維的教堂》' },
    neighbors: [
      { to: 'church', motif: 'road', reasonZh: '沿著科德維爾茅草屋前的蜿蜒小徑前行，便來到奧維爾小鎮中心的哥德式教堂' },
      { to: 'potato', motif: 'dwelling', reasonZh: '奧維爾覆滿青苔的茅草農舍，讓梵谷深深想起第一章故鄉荷蘭的農村小屋' },
      { to: 'wheat', motif: 'flora', reasonZh: '屋頂與山丘交融的波浪筆觸，延續了聖雷米絲柏與麥浪的韻律' },
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
      { to: 'tower', motif: 'dwelling', reasonZh: '奧維爾哥德教堂與第一章《紐넨的舊教堂塔樓》跨越五年歲月遙相呼應' },
      { to: 'crows', motif: 'sky', reasonZh: '飛越鐘樓尖頂暗藍風暴，展開奧維爾麥田群鴉超寬視野' },
    ],
  },
  gachet: {
    id: 'gachet',
    chapterId: 'road',
    moodZh: '憂鬱 · 同理 · 時代的心碎表情',
    lightTypeZh: '雙色群青漩渦背景與鮮紅桌面毛地黃微光',
    motifs: ['gaze', 'flora', 'sky'],
    portalIn: { motif: 'gaze', descZh: '由教堂群青天空進入支頤沉思的嘉舍醫師與紫紅毛地黃花枝' },
    portalOut: { motif: 'flora', descZh: '順著紅桌上的毛地黃花枝走出診間 → 漫步2:1超寬全景《多比尼的花園》' },
    neighbors: [
      { to: 'daubigny', motif: 'flora', reasonZh: '從嘉舍醫師桌上的紫紅毛地黃花枝走出室內，進入奧維爾陽光柔和的《多比尼的花園》' },
      { to: 'crows', motif: 'sky', reasonZh: '嘉舍醫師背後翻湧的深藍筆觸，直接延伸為奧維爾暴風雨前的麥田天空' },
      { to: 'selfportrait', motif: 'gaze', reasonZh: '梵谷稱嘉舍醫師是「另一個自己」，兩幅肖像跨時空深情對望' },
    ],
  },
  daubigny: {
    id: 'daubigny',
    chapterId: 'road',
    moodZh: '寧靜 · 致敬 · 暴風雨前的花園',
    lightTypeZh: '淡青瓷晴空與翠綠草坪玫瑰花壇',
    motifs: ['flora', 'dwelling', 'sky'],
    portalIn: { motif: 'flora', descZh: '由毛地黃花枝展開 2:1 雙正方形超寬畫幅的翠綠花園與黑貓身影' },
    portalOut: { motif: 'sky', descZh: '飛越花園遠方別墅屋頂與教堂尖塔 → 衝入同為 2:1 超寬銀幕的終章《麥田群鴉》' },
    neighbors: [
      { to: 'crows', motif: 'sky', reasonZh: '同為梵谷生命最後數週創作的 2:1 雙正方形超寬巨作：由寧靜花園飛越屋頂，直入暴風雨麥田' },
      { to: 'harvest', motif: 'flora', reasonZh: '奧維爾花園的開闊草坪與亞爾克勞平原的豐收全景遙相呼應' },
      { to: 'almond', motif: 'flora', reasonZh: '花園盛開的粉紅玫瑰花叢與聖雷米的潔白杏花共譜生命頌歌' },
    ],
  },
  crows: {
    id: 'crows',
    chapterId: 'road',
    moodZh: '壯闊 · 蒼涼 · 風中歸途',
    lightTypeZh: '暴風雨前黑藍天際與金色麥海強烈反差',
    motifs: ['road', 'sky', 'flora', 'gaze'],
    portalIn: { motif: 'sky', descZh: '由多比尼花園天際俯衝進入三條紅棕小徑與 52 隻黑鴉群' },
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
    nameZh: '五大章三十幕完整史詩 · Complete 30-Act Odyssey',
    nameEn: 'Complete 5-Chapter 30-Act Odyssey (1884–1890)',
    motif: 'light',
    descZh: 'I 黑土與人(5幕) → II 巴黎覺醒(6幕) → III 亞爾驕陽(8幕) → IV 聖雷米宇宙(6幕) → V 奧維爾的路與風(5幕)',
    sequence: [
      'potato', 'weaver', 'tower', 'shoes', 'skull',
      'galette', 'paris', 'seine', 'plum', 'tanguy', 'selfportrait',
      'yellowhouse', 'sunflowers', 'harvest', 'sower', 'cafe', 'nightcafe', 'rhone', 'bedroom',
      'starry', 'irises', 'olive', 'wheat', 'roadcypress', 'almond',
      'cottages', 'church', 'gachet', 'daubigny', 'crows',
    ],
  },
  {
    id: 'nights',
    nameZh: '光與夜之路 · Nights, Lamps & Suns (10幕)',
    nameEn: 'Nights, Lamps & Suns of Van Gogh',
    motif: 'light',
    descZh: '沿「✦ 光」之主幹旅行：荷蘭油燈 → 香菸火燼 → 夕陽播種者 → 夜間咖啡座 → 午夜咖啡館 → 隆河星波 → 聖雷米星夜 → 橄欖樹烈日 → 絲柏星月夜路 → 麥田風暴',
    sequence: ['potato', 'skull', 'sower', 'cafe', 'nightcafe', 'rhone', 'starry', 'olive', 'roadcypress', 'crows'],
  },
  {
    id: 'roads',
    nameZh: '道路與橋樑 · Shoes, Bridges & Horizons (10幕)',
    nameEn: 'Shoes, Bridges & Forking Roads',
    motif: 'road',
    descZh: '沿「⟁ 路」之主幹旅行：一雙舊鞋 → 蒙馬特磨坊 → 克利希大道 → 塞納河鐵橋 → 廣重雨中大橋 → 亞爾街角 → 隆河堤岸 → 絲柏夜路 → 奧維爾教堂叉路 → 麥田三岔路',
    sequence: ['shoes', 'galette', 'paris', 'seine', 'plum', 'cafe', 'rhone', 'roadcypress', 'church', 'crows'],
  },
  {
    id: 'dwellings',
    nameZh: '居所與聖殿 · Looms, Rooms & Sanctuaries (10幕)',
    nameEn: 'Looms, Rooms & Sanctuaries',
    motif: 'dwelling',
    descZh: '沿「⌂ 居所」旅行：食薯者餐桌 → 紐넨織布機 → 舊教堂塔樓 → 亞爾黃色小屋 → 向日葵 → 露天咖啡座 → 午夜咖啡館 → 亞爾臥室 → 奧維爾茅草屋 → 奧維爾教堂',
    sequence: ['potato', 'weaver', 'tower', 'yellowhouse', 'sunflowers', 'cafe', 'nightcafe', 'bedroom', 'cottages', 'church'],
  },
  {
    id: 'flora',
    nameZh: '黑土、繁花與麥浪 · Earth, Blossoms & Wheat (10幕)',
    nameEn: 'From Dark Earth to Sunflowers, Olive Trees & Gardens',
    motif: 'flora',
    descZh: '沿「❀ 植物」旅行：食薯者馬鈴薯 → 向日葵 → 克勞豐收平原 → 播種者 → 鳶尾花 → 橄欖樹林 → 絲柏麥浪 → 盛開杏花 → 多比尼花園 → 麥田群鴉',
    sequence: ['potato', 'sunflowers', 'harvest', 'sower', 'irises', 'olive', 'wheat', 'almond', 'daubigny', 'crows'],
  },
  {
    id: 'gaze',
    nameZh: '凝視與靈魂 · Gaze, Portraits & Mirrors (8幕)',
    nameEn: 'Skulls, Self-Portraits, Père Tanguy & Dr. Gachet',
    motif: 'gaze',
    descZh: '沿「❖ 視線與肖像」旅行：食薯者農民 → 安特衛普叼菸骷髏 → 唐吉老爹與浮世繪 → 戴草帽的自畫像 → 午夜咖啡館 → 亞爾臥室百葉窗 → 嘉舍醫師 → 星夜渦流',
    sequence: ['potato', 'skull', 'tanguy', 'selfportrait', 'nightcafe', 'bedroom', 'gachet', 'starry'],
  },
];

export interface MotifTransitionGrammar {
  motif: MotifId;
  nameZh: string;
  scatterPeakPrimary: number;
  scatterPeakSecondary: number;
  smearBoost: number;
  bloomBoost: number;
  dustBoost: number;
  warpCurve: number;
  stirRadiusH: number;
  stirAmp: number;
}

export const MOTIF_TRANSITION_GRAMMARS: Record<MotifId, MotifTransitionGrammar> = {
  light: {
    motif: 'light',
    nameZh: '✦ 光暈綻放轉場 · Radiant Halo Dissolve',
    scatterPeakPrimary: 0.82,
    scatterPeakSecondary: 0.86,
    smearBoost: 0.25,
    bloomBoost: 0.38,
    dustBoost: 0.45,
    warpCurve: 0.12,
    stirRadiusH: 0.19,
    stirAmp: 0.95,
  },
  road: {
    motif: 'road',
    nameZh: '⟁ 長路推進轉場 · Perspective Glide',
    scatterPeakPrimary: 0.72,
    scatterPeakSecondary: 0.78,
    smearBoost: 0.52,
    bloomBoost: 0.12,
    dustBoost: 0.22,
    warpCurve: 0.22,
    stirRadiusH: 0.14,
    stirAmp: 0.55,
  },
  sky: {
    motif: 'sky',
    nameZh: '◎ 天空渦流轉場 · Celestial Vortex Unbind',
    scatterPeakPrimary: 1.04,
    scatterPeakSecondary: 1.08,
    smearBoost: 0.38,
    bloomBoost: 0.24,
    dustBoost: 0.55,
    warpCurve: 0.18,
    stirRadiusH: 0.28,
    stirAmp: 1.45,
  },
  flora: {
    motif: 'flora',
    nameZh: '❀ 繁花隨風轉場 · Botanical Wind Drift',
    scatterPeakPrimary: 0.90,
    scatterPeakSecondary: 0.94,
    smearBoost: 0.28,
    bloomBoost: 0.18,
    dustBoost: 0.68,
    warpCurve: 0.08,
    stirRadiusH: 0.22,
    stirAmp: 0.85,
  },
  dwelling: {
    motif: 'dwelling',
    nameZh: '⌂ 門廊框景轉場 · Threshold Frame Fold',
    scatterPeakPrimary: 0.64,
    scatterPeakSecondary: 0.68,
    smearBoost: 0.16,
    bloomBoost: 0.15,
    dustBoost: 0.20,
    warpCurve: -0.24,
    stirRadiusH: 0.12,
    stirAmp: 0.40,
  },
  gaze: {
    motif: 'gaze',
    nameZh: '❖ 瞳孔凝視轉場 · Ocular Iris Tunnel',
    scatterPeakPrimary: 0.78,
    scatterPeakSecondary: 0.82,
    smearBoost: 0.34,
    bloomBoost: 0.28,
    dustBoost: 0.35,
    warpCurve: -0.18,
    stirRadiusH: 0.16,
    stirAmp: 1.15,
  },
};

export function resolveTransitionEdge(fromId: PaintingId, toId: PaintingId): {
  motif: MotifId;
  reasonZh: string;
  grammar: MotifTransitionGrammar;
} {
  const nodeA = WORLD_GRAPH[fromId];
  const nodeB = WORLD_GRAPH[toId];
  const direct = nodeA.neighbors.find((n) => n.to === toId);
  if (direct) {
    return {
      motif: direct.motif,
      reasonZh: direct.reasonZh,
      grammar: MOTIF_TRANSITION_GRAMMARS[direct.motif],
    };
  }
  const shared = nodeA.motifs.find((m) => nodeB.motifs.includes(m)) ?? nodeA.portalOut.motif;
  return {
    motif: shared,
    reasonZh: nodeA.portalOut.descZh,
    grammar: MOTIF_TRANSITION_GRAMMARS[shared],
  };
}

/**
 * Dynamically weaves a multi-act journey through `WORLD_GRAPH` starting at `startId`,
 * prioritizing edges that match `preferredMotif` (if given) and avoiding immediate revisits.
 */
export function weaveGraphPath(
  startId: PaintingId,
  preferredMotif?: MotifId,
  length = 6,
): ThemePathSpec {
  const seq: PaintingId[] = [startId];
  const visited = new Set<PaintingId>([startId]);
  const mainMotif: MotifId = preferredMotif ?? WORLD_GRAPH[startId].portalOut.motif;

  while (seq.length < length) {
    const curr = seq[seq.length - 1];
    const node = WORLD_GRAPH[curr];
    const unvisited = node.neighbors.filter((e) => !visited.has(e.to));
    const pool = unvisited.length > 0 ? unvisited : node.neighbors;
    // Prefer edges matching mainMotif, or whose target moves into a new chapter
    const best =
      pool.find((e) => e.motif === mainMotif) ??
      pool.find((e) => WORLD_GRAPH[e.to].chapterId !== node.chapterId) ??
      pool[0];
    if (!best) break;
    seq.push(best.to);
    visited.add(best.to);
  }

  const mSpec = MOTIF_SPECS[mainMotif];
  return {
    id: 'woven',
    nameZh: `智能圖譜編織 · ${mSpec.icon} ${mSpec.nameZh} (${seq.length}幕)`,
    nameEn: `Woven Graph Path · ${mSpec.nameEn} (${seq.length} Acts)`,
    motif: mainMotif,
    descZh: `由當前畫作《${startId}》出發，沿世界圖譜「${mSpec.icon} ${mSpec.nameZh}」與相鄰任意門即時編織的 ${seq.length} 幕連貫旅程`,
    sequence: seq,
  };
}

export function getChapterSpec(chapterId: ChapterId): ChapterSpec {
  return CHAPTER_SPECS.find((c) => c.id === chapterId) ?? CHAPTER_SPECS[0];
}

export function getThemePathSpec(pathId: string): ThemePathSpec {
  return THEME_PATHS.find((p) => p.id === pathId) ?? THEME_PATHS[0];
}
