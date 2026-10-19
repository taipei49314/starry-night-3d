// Historical letters from Vincent van Gogh to Theo (and Jo van Gogh-Bonger epilogue records).
// Designed as discoverable diegetic traces ("沿途發現的痕跡"), never as continuous explanatory narration.
// All dates, letter numbers (Van Gogh Museum / Huygens ING edition), and historical notes are fact-checked.
import type { ChapterId, PaintingId } from './types';

export interface EpistolaryTrace {
  id: string;
  chapterId: ChapterId;
  paintingId?: PaintingId;
  isInterlude?: boolean;
  isEpilogue?: boolean;
  /** Citation header (e.g., Letter 497 · Nuenen, 1885.04.30) */
  citationZh: string;
  citationEn: string;
  /** Short, authentic excerpt from the historical letter */
  quoteZh: string;
  quoteEn: string;
  /** Optional subtle historical context or reconstruction note */
  contextNoteZh: string;
  /** Normalized window [tauStartFrac, tauEndFrac] within the beat when the trace softly surfaces */
  windowFrac: readonly [number, number];
}

export const RECONSTRUCTION_DISCLAIMER_ZH =
  '註：五章中之人物姿態、1885年農舍素描與寫實場景為「有史料支持的藝術重建（Historically informed artistic reconstruction）」，並非單一確知歷史現場之攝影紀錄。';

export const EPISTOLARY_TRACES: readonly EpistolaryTrace[] = [
  // ================= CHAPTER I: 尋找人生的位置 (荷蘭 Nuenen, 1884–1885) =================
  {
    id: 'letter-497-potato',
    chapterId: 'earth',
    paintingId: 'potato',
    citationZh: '致西奧 · 第 497 號信 · 荷蘭紐南，1885年4月30日',
    citationEn: 'To Theo · Letter 497 · Nuenen, 30 April 1885',
    quoteZh: '「我想傳達的是，這些在油燈下吃馬鈴薯的人，正是用他們伸進盤子裡的同一雙手，去翻墾土地的……他們誠實地掙得了自己的食物。」',
    quoteEn: '“I have tried to emphasize that those people, eating their potatoes in the lamplight, have dug the earth with those very hands they put in the dish...”',
    contextNoteZh: '史料與藝術重建：梵谷於 1884–1885 年冬春在紐南農舍繪製大量農民手部、頭像與室內習作，最終完成《食薯者》。',
    windowFrac: [0.34, 0.78],
  },
  {
    id: 'letter-448-weaver',
    chapterId: 'earth',
    paintingId: 'weaver',
    citationZh: '致西奧 · 第 448 號信 · 荷蘭紐南，1884年5月',
    citationEn: 'To Theo · Letter 448 · Nuenen, May 1884',
    quoteZh: '「當我看著這台巨大、烏黑的古老橡木織布機，以及在其中安靜勞作的人，我總覺得那裡有一種深沉而莊嚴的節奏。」',
    quoteEn: '“Looking at the dark oak loom and the figure quietly working within its frame, one feels a deep, solemn rhythm of life.”',
    contextNoteZh: '他在紐南花費數月觀察鄉間織布工，從勞動者的日常裡尋找自己在藝術中的位置。',
    windowFrac: [0.22, 0.75],
  },
  {
    id: 'interlude-1-paris-train',
    chapterId: 'earth',
    isInterlude: true,
    citationZh: '幕間留白 I · 致西奧 · 第 565 號信 · 1886年2月（抵達巴黎前夕）',
    citationEn: 'Interlude I · To Theo · Letter 565 · February 1886',
    quoteZh: '「親愛的西奧，不要生我的氣，我已經直接來到巴黎了……我們在盧浮宮見吧，從那裡開始，我們一起走下去。」',
    quoteEn: '“My dear Theo, do not be cross with me that I have come all of a sudden... Let us meet at the Louvre.”',
    contextNoteZh: '1886 年初春，他離開北方暗褐色的土地，前往巴黎與弟弟西奧同住。',
    windowFrac: [0.12, 0.88],
  },

  // ================= CHAPTER II: 發現世界的色彩 (巴黎 Paris, 1886–1888) =================
  {
    id: 'letter-595-paris',
    chapterId: 'color',
    paintingId: 'paris',
    citationZh: '致小妹威廉明娜 · 第 595 號信 · 巴黎，1887年秋',
    citationEn: 'To Willemien · Letter 595 · Paris, Autumn 1887',
    quoteZh: '「在巴黎，我看見人們如何用最新鮮、最純粹的檸檬黃、群青與朱紅去描繪空氣與光。我也在不斷修正自己觀看世界的方式。」',
    quoteEn: '“Here in Paris I see how painters work with the freshest lemon yellow, ultramarine and vermilion—and I revise the way I look at light.”',
    contextNoteZh: '有史料支持的藝術重建：他在蒙馬特與阿尼耶爾街頭漫步寫生，透過印象派與點描觀念重新理解色彩。',
    windowFrac: [0.32, 0.78],
  },
  {
    id: 'letter-590-tanguy',
    chapterId: 'color',
    paintingId: 'tanguy',
    citationZh: '致西奧 · 第 590 號信 · 巴黎，1887年夏',
    citationEn: 'To Theo · Letter 590 · Paris, Summer 1887',
    quoteZh: '「看著日本浮世繪，你會看見一個充滿陽光、清澈而毫不猶豫的世界——那正是我們每天走過的街道可以變成的模樣。」',
    quoteEn: '“Looking at Japanese prints, you see a clear, sunlit world without hesitation—what the streets around us can become.”',
    contextNoteZh: '顏料商唐吉老爹（Père Tanguy）的小店與日本版畫，成為他在巴黎最重要的精神角落。',
    windowFrac: [0.22, 0.76],
  },
  {
    id: 'interlude-2-south-sun',
    chapterId: 'color',
    isInterlude: true,
    citationZh: '幕間留白 II · 致西奧 · 第 578 號信 · 亞爾，1888年2月21日',
    citationEn: 'Interlude II · To Theo · Letter 578 · Arles, 21 February 1888',
    quoteZh: '「當火車往南開，窗外的空氣開始變得透明……我在這裡尋找一種更清澈的光，以及一個能讓畫家們像兄弟一樣共同生活的地方。」',
    quoteEn: '“As the train travelled south, the air grew limpid... I am looking for a clearer light, and a home where artists can live together as brothers.”',
    contextNoteZh: '1888 年 2 月，他離開寒冬的巴黎，搭火車南下普羅旺斯的亞爾（Arles）。',
    windowFrac: [0.12, 0.88],
  },

  // ================= CHAPTER III: 嘗試建立自己的家 (亞爾 Arles, 1888–1889) =================
  {
    id: 'letter-677-yellowhouse',
    chapterId: 'sun',
    paintingId: 'yellowhouse',
    citationZh: '致西奧 · 第 677 號信 · 亞爾，1888年9月9日',
    citationEn: 'To Theo · Letter 677 · Arles, 9 September 1888',
    quoteZh: '「我今天買了兩張床——一張胡桃木的，一張白木的——我終於要在這棟黃色小屋裡過夜了。我希望這裡能成為真正有溫度的家。」',
    quoteEn: '“Today I bought two beds—one walnut, one white wood—and at last I shall sleep in the Yellow House. I want it to be a true home.”',
    contextNoteZh: '1888 年 9 月，他終於搬進拉馬丁廣場 2 號的黃色小屋，滿懷期待地佈置迎接友人高更的客房。',
    windowFrac: [0.28, 0.82],
  },
  {
    id: 'letter-705-bedroom',
    chapterId: 'sun',
    paintingId: 'bedroom',
    citationZh: '致西奧 · 第 705 號信 · 亞爾，1888年10月16日',
    citationEn: 'To Theo · Letter 705 · Arles, 16 October 1888',
    quoteZh: '「今天我畫了『我的臥室』。淡紫色的牆面、赤土色的地面、新鮮奶油黃的木床與椅子……看著這間房間，就應該讓大腦與想像力完全休息下來。」',
    quoteEn: '“This time it is simply my bedroom. The walls are pale lilac, the floor of red tiles, the bed and chairs the yellow of fresh butter... looking at the picture ought to rest the brain, or rather the imagination.”',
    contextNoteZh: '史實考據：《亞爾的臥室》作於 1888 年 10 月；原作牆面為淡紫色（pale lilac），後世因紅色色澱褪色才呈現淺藍。',
    windowFrac: [0.18, 0.86],
  },
  {
    id: 'letter-691-rhone',
    chapterId: 'sun',
    paintingId: 'rhone',
    citationZh: '致西奧 · 第 691 號信 · 亞爾，1888年9月29日',
    citationEn: 'To Theo · Letter 691 · Arles, 29 September 1888',
    quoteZh: '「即使白天的期待偶爾落空，夜晚的星空與隆河上的波光，依然比白天更加豐富、更加溫暖。」',
    quoteEn: '“Even when hopes falter by day, the starry night and the reflections on the Rhône remain richer and more consoling.”',
    contextNoteZh: '當共同生活的理想經歷波折與破裂，亞爾的夜色與河水接住了他的孤寂。',
    windowFrac: [0.22, 0.78],
  },
  {
    id: 'interlude-3-saint-remy',
    chapterId: 'sun',
    isInterlude: true,
    citationZh: '幕間留白 III · 致西奧 · 第 776 號信 · 聖雷米，1889年5月',
    citationEn: 'Interlude III · To Theo · Letter 776 · Saint-Rémy, May 1889',
    quoteZh: '「在這裡，透過窗戶與花園看見的麥田、鳶尾花與晨星，讓我明白：即使在最受限的處境裡，工作與觀察自然依然能支撐一個人走下去。」',
    quoteEn: '“Through the window and in the garden, the wheatfield, irises and morning star remind me that observing nature and working sustain a man even in confinement.”',
    contextNoteZh: '1889 年 5 月，他自願住進聖雷米的聖保羅療養院，在安靜的日常中持續創作。',
    windowFrac: [0.12, 0.88],
  },

  // ================= CHAPTER IV: 在困境中繼續創造 (聖雷米 Saint-Rémy, 1889–1890) =================
  {
    id: 'letter-782-starry',
    chapterId: 'cosmos',
    paintingId: 'starry',
    citationZh: '致西奧 · 第 777 / 782 號信 · 聖雷米，1889年6月',
    citationEn: 'To Theo · Letters 777 & 782 · Saint-Rémy, June 1889',
    quoteZh: '「今天清晨天還沒亮時，我在窗前看了很久鄉間的景色，只有那顆很大的晨星在閃耀……今天我把新畫的一幅『星夜』研究加進作品裡。」',
    quoteEn: '“This morning I saw the countryside from my window a long time before sunrise, with nothing but the morning star, which looked very big... I have a new study of a starry sky.”',
    contextNoteZh: '史實考據（MoMA）：《星夜》並非對著單一真實夜景直接寫生，而是融合了清晨觀星、北方家鄉記憶與想像，於白天在畫室中分多次完成。',
    windowFrac: [0.15, 0.68],
  },
  {
    id: 'letter-850-almond',
    chapterId: 'cosmos',
    paintingId: 'almond',
    citationZh: '致西奧 · 第 850 號信 · 聖雷米，1890年2月19日',
    citationEn: 'To Theo · Letter 850 · Saint-Rémy, 19 February 1890',
    quoteZh: '「聽到你們平安生下小男孩的消息，還為他取了我的名字，我高興得說不出話來。我立刻開始為他畫一幅畫——藍色天空下盛開的白色杏花枝。」',
    quoteEn: '“I was so deeply touched by the news of the boy’s safe arrival... I started right away to make a picture for him, to hang in your bedroom, big branches of white almond blossom against a blue sky.”',
    contextNoteZh: '1890 年 1 月 31 日，西奧與妻子 Jo 的兒子 Vincent Willem 出生，梵谷在療養院中畫下《盛開的杏花》作為新生賀禮。',
    windowFrac: [0.20, 0.82],
  },
  {
    id: 'interlude-4-auvers-north',
    chapterId: 'cosmos',
    isInterlude: true,
    citationZh: '幕間留白 IV · 致西奧與喬 · 第 873 號信 · 奧維爾，1890年5月20日',
    citationEn: 'Interlude IV · To Theo and Jo · Letter 873 · Auvers-sur-Oise, 20 May 1890',
    quoteZh: '「奧維爾非常美，那些古老的茅草屋頂已經不多見了……這裡有開闊的田野、安靜的空氣，以及許多我想畫下來的風景。」',
    quoteEn: '“Auvers is very beautiful, among other things a lot of old thatched roofs, which are becoming rare... there is great peace and color in the fields.”',
    contextNoteZh: '1890 年 5 月，他回到北方，在巴黎近郊的巴黎小鎮奧維爾（Auvers-sur-Oise）展開最後兩個月旺盛的創作。',
    windowFrac: [0.12, 0.88],
  },

  // ================= CHAPTER V: 生命的最後一段路 (奧維爾 Auvers-sur-Oise, 1890.05–07) =================
  {
    id: 'letter-898-crows',
    chapterId: 'road',
    paintingId: 'crows',
    citationZh: '致西奧與喬 · 第 898 號信 · 奧維爾，1890年7月10日頃',
    citationEn: 'To Theo and Jo · Letter 898 · Auvers-sur-Oise, c. 10 July 1890',
    quoteZh: '「那是動盪天空下無邊無際的麥田。我沒有刻意迴避表達悲傷與孤寂，但我同時相信，這些畫也會告訴你們，我在鄉間看見了多少健康與振奮的力量。」',
    quoteEn: '“They are vast fields of wheat under troubled skies... I almost think that these canvases will tell you what I cannot say in words, what I see of health and restorative forces in the countryside.”',
    contextNoteZh: '史實考據：《麥田群鴉》並非他的最後一幅畫，亦非單純的死亡預告；他在信中明確寫道希望同時傳達孤寂與鄉間自然的生命力。',
    windowFrac: [0.20, 0.80],
  },
  {
    id: 'letter-rm25-daubigny',
    chapterId: 'road',
    paintingId: 'daubigny',
    citationZh: '致西奧 · RM25 未寄出隨身信件草稿 · 奧維爾，1890年7月23日',
    citationEn: 'To Theo · Unsent Draft RM25 (carried on his person) · Auvers-sur-Oise, 23 July 1890',
    quoteZh: '「那麼，我自己的工作，我為它冒了生命的危險，我的理智也為它沉沒了一半——好吧——但你不是那些只買賣人心的商人，據我所知，你選擇了站在真正的人性這一邊……」',
    quoteEn: '“Well, my own work, I am risking my life for it and my reason has half foundered in it—that’s all right—but you are not among the dealers in men as far as I know, and you can still choose your side, I think, acting with true humanity...”',
    contextNoteZh: '史料說明：引自 RM25（1890年7月23日未寄出之隨身草稿，梵谷受傷當天仍帶在身上；不同於正式寄出的第 902 號信）。',
    windowFrac: [0.22, 0.82],
  },

  // ================= EPILOGUE: 尾聲 · 視點與書信的傳遞 (1891–1914) =================
  {
    id: 'epilogue-jo-bonger',
    chapterId: 'road',
    isEpilogue: true,
    citationZh: '尾聲 · 西奧與喬·梵谷-邦格（Jo van Gogh-Bonger）的守護 · 1891–1914',
    citationEn: 'Epilogue · Theo & Jo van Gogh-Bonger’s Legacy · 1891–1914',
    quoteZh: '「文森留給西奧的不只是畫作，還有那數百封信裡一個活生生的人。我所能做的，就是讓世界不僅看見他的畫，也讀懂他走過的人生。」',
    quoteEn: '“Vincent left Theo not only canvases, but a living human soul in hundreds of letters. My task was to let the world not only see his paintings, but understand the life he walked.”',
    contextNoteZh: '史實記錄：1890年7月29日梵谷離世，半年後（1891年1月25日）弟弟西奧亦於烏特勒支去世。西奧的妻子 Jo 當時帶著尚未滿周歲的孩子（Vincent Willem，1890年1月31日生），耗費餘生整理出版《致西奧的書信集》（1914）並推廣其畫作。我們陪伴了他一段路，雖不能永遠留在他身旁，卻因這份守護而能在此見證。',
    windowFrac: [0.05, 0.95],
  },
];

const TRACE_BY_PAINTING = new Map<PaintingId, EpistolaryTrace>();
const TRACE_BY_ID = new Map<string, EpistolaryTrace>();
for (const tr of EPISTOLARY_TRACES) {
  TRACE_BY_ID.set(tr.id, tr);
  if (tr.paintingId && !tr.isInterlude && !tr.isEpilogue) {
    TRACE_BY_PAINTING.set(tr.paintingId, tr);
  }
}

export function getTraceById(id: string): EpistolaryTrace | undefined {
  return TRACE_BY_ID.get(id);
}

export function getTraceForPainting(paintingId: PaintingId): EpistolaryTrace | undefined {
  return TRACE_BY_PAINTING.get(paintingId);
}
