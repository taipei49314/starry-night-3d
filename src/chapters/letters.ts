// Traces of Vincent van Gogh's letters (Van Gogh Museum / Huygens ING 2009 critical edition, vangoghletters.org)
// and of Jo van Gogh-Bonger's diary entry of 15 November 1891.
// Designed as discoverable diegetic traces ("沿途發現的痕跡"), never as continuous explanatory narration.
// Strict separation of sources:
//  - `summaryZh` / `summaryEn`: a one-line summary written for this piece. It is not a quotation;
//    `sources` links to the letter itself so viewers can read the original and the edition's translation.
//  - `contextNoteZh` & `RECONSTRUCTION_DISCLAIMER_ZH`: Explicitly labeled historical context and artistic reconstruction notes.
import type { ChapterId, PaintingId } from './types';

export interface LetterSource {
  label: string;
  url: string;
}

export interface EpistolaryTrace {
  id: string;
  chapterId: ChapterId;
  paintingId?: PaintingId;
  isInterlude?: boolean;
  isEpilogue?: boolean;
  /** Citation header (Recipient · Letter number · Place, Date per vangoghletters.org) */
  citationZh: string;
  citationEn: string;
  /** One-line summary written for this piece (not a quotation) */
  summaryZh: string;
  summaryEn: string;
  /** The letter in the online edition; empty when the source is not published there */
  sources: readonly LetterSource[];
  /** Explicitly separated historical background or artistic reconstruction note */
  contextNoteZh: string;
  /** Normalized window [tauStartFrac, tauEndFrac] within the beat when the trace softly surfaces */
  windowFrac: readonly [number, number];
}

/** A letter in the Van Gogh Museum / Huygens ING edition, e.g. `vgl('let497')` or `vgl('RM25')`. */
function vgl(id: string): LetterSource {
  return {
    label: id.startsWith('let') ? `Letter ${id.slice(3)}` : id,
    url: `https://vangoghletters.org/detail/urn:mace:huc.knaw.nl:vangogh:${id}`,
  };
}

export const RECONSTRUCTION_DISCLAIMER_ZH =
  '史料與藝術重建區分聲明：上方是本作自行撰寫的信件摘要，不是原文引述；原信與譯文請見 vangoghletters.org（Van Gogh Museum / Huygens ING）。畫面中之人物動態、1885年農舍角落素描與五章場景則為「有史料支持的藝術重建（Historically informed artistic reconstruction）」，並非單一確知歷史現場之攝影紀錄。';

export const EPISTOLARY_TRACES: readonly EpistolaryTrace[] = [
  // ================= CHAPTER I: 尋找人生的位置 (荷蘭 Nuenen, 1884–1885) =================
  {
    id: 'letter-497-potato',
    chapterId: 'earth',
    paintingId: 'potato',
    citationZh: '致西奧（Theo van Gogh） · 第 497 號信 · 荷蘭紐南，1885年4月30日頃',
    citationEn: 'To Theo van Gogh · Letter 497 · Nuenen, on or about Thursday, 30 April 1885',
    summaryZh: '談《食薯者》：燈下吃馬鈴薯的農民，用的是翻土的同一雙手；這幅畫講的是他們的勞動。',
    summaryEn: 'On The Potato Eaters: the peasants eating by lamplight worked the soil with the same hands, so the picture is about their labour.',
    sources: [vgl('let497')],
    contextNoteZh: '【史實與藝術重建】梵谷於 1884–1885 年冬春在紐南繪製數十幅農民頭像與手部習作後完成《食薯者》；開場農舍角落素描場景為依此史料設計之藝術重建。',
    windowFrac: [0.34, 0.78],
  },
  {
    id: 'letter-448-weaver',
    chapterId: 'earth',
    paintingId: 'weaver',
    citationZh: '致安東·范·拉帕德（Anthon van Rappard） · 第 448 號信 · 荷蘭紐南，1884年5月29日頃',
    citationEn: 'To Anthon van Rappard · Letter 448 · Nuenen, on or about Thursday, 29 May 1884',
    summaryZh: '他向拉帕德說明小幅《織布工》是個例外，並談到先用低沉的暗色起畫、再逐步往亮處提升的做法。',
    summaryEn: 'He tells Van Rappard the small Weaver is an exception, and describes starting a painting in a low, dark register and working it up toward light.',
    sources: [vgl('let448')],
    contextNoteZh: '【史實背景】第 448 號信為梵谷於 1884 年 5 月 29 日頃自紐南寫給畫家友人拉帕德（Anthon van Rappard），討論他如何以暗褐色低音域描繪紐南鄉間織布工與橡木織布機。',
    windowFrac: [0.22, 0.75],
  },
  {
    id: 'interlude-1-paris-train',
    chapterId: 'earth',
    isInterlude: true,
    citationZh: '幕間留白 I · 致西奧（Theo van Gogh） · 第 567 號信 · 巴黎，1886年2月28日頃',
    citationEn: 'Interlude I · To Theo van Gogh · Letter 567 · Paris, on or about Sunday, 28 February 1886',
    summaryZh: '一張便條：他沒先通知就到了巴黎，請西奧別生氣，約他中午左右在羅浮宮碰面。',
    summaryEn: 'A short note: he has turned up in Paris unannounced, asks Theo not to be angry, and proposes meeting at the Louvre around midday.',
    sources: [vgl('let567')],
    contextNoteZh: '【史實背景】1886 年 2 月底，梵谷自安特衛普搭車抵達巴黎，寫下這張便條（第 567 號信）約弟弟西奧在羅浮宮方形沙龍見面，展開巴黎時期。',
    windowFrac: [0.12, 0.88],
  },

  // ================= CHAPTER II: 發現世界的色彩 (巴黎 Paris, 1886–1888) =================
  {
    id: 'letter-574-paris',
    chapterId: 'color',
    paintingId: 'paris',
    citationZh: '致妹妹威廉明娜（Willemien van Gogh） · 第 574 號信 · 巴黎，1887年10月下旬',
    citationEn: 'To Willemien van Gogh · Letter 574 · Paris, late October 1887',
    summaryZh: '寫給妹妹：夏天在阿尼耶爾畫風景時看見了更多色彩，正把它用在肖像上；他打算盡快去色彩與陽光更多的南方。',
    summaryEn: 'To his sister: painting at Asnières in the summer showed him more colour, which he is now bringing into portraits; he means to go south, where there is more colour and sun.',
    sources: [vgl('let574')],
    contextNoteZh: '【史實與藝術重建】第 574 號信為 1887 年 10 月下旬自巴黎寫給妹妹 Willemien。開場巴黎街道背影跟隨與街景色彩甦醒，為根據他在巴黎吸收印象派與點描色彩觀念所作之藝術重建。',
    windowFrac: [0.32, 0.78],
  },
  {
    id: 'letter-686-tanguy',
    chapterId: 'color',
    paintingId: 'tanguy',
    citationZh: '致西奧（Theo van Gogh） · 第 686 號信 · 亞爾（回顧日本浮世繪精神），1888年9月24日',
    citationEn: 'To Theo van Gogh · Letter 686 · Arles, Monday, 24 September 1888',
    summaryZh: '談日本藝術：有智慧的日本藝術家不去鑽研遙遠的大問題，而是研究一株小草。',
    summaryEn: 'On Japanese art: the wise Japanese artist does not study grand questions but a single blade of grass.',
    sources: [vgl('let686')],
    contextNoteZh: '【史實背景】1887 年秋冬梵谷於巴黎完成《唐吉老爹肖像》，背景貼滿他與西奧收藏的日本浮世繪。第 686 號信寫下他對日本版畫觀看自然方式的體會。',
    windowFrac: [0.22, 0.76],
  },
  {
    id: 'letter-590-arles-palette',
    chapterId: 'color',
    isInterlude: true,
    citationZh: '幕間留白 II · 致妹妹威廉明娜（Willemien van Gogh） · 第 590 號信 · 亞爾，1888年3月30日頃',
    citationEn: 'Interlude II · To Willemien van Gogh · Letter 590 · Arles, on or about Friday, 30 March 1888',
    summaryZh: '寫給妹妹：南方的自然不能用北方的灰色調色盤來畫；他現在的調色盤是天藍、粉紅、橙、朱紅、亮黃、鮮綠、酒紅與紫。',
    summaryEn: 'To his sister: the south cannot be painted with a grey northern palette; his palette is now sky blue, pink, orange, vermilion, yellow, green, wine red and violet.',
    sources: [vgl('let590')],
    contextNoteZh: '【史實背景】第 590 號信為梵谷抵達普羅旺斯亞爾後，於 1888 年 3 月 30 日頃寫給妹妹威廉明娜，明確比較北方灰調與南方高彩度調色盤的轉變。',
    windowFrac: [0.12, 0.88],
  },

  // ================= CHAPTER III: 嘗試建立自己的家 (亞爾 Arles, 1888–1889) =================
  {
    id: 'letter-677-yellowhouse',
    chapterId: 'sun',
    paintingId: 'yellowhouse',
    citationZh: '致西奧（Theo van Gogh） · 第 677 號信 · 亞爾，1888年9月9日',
    citationEn: 'To Theo van Gogh · Letter 677 · Arles, Sunday, 9 September 1888',
    summaryZh: '他描述為黃色小屋買了兩張床，並說從一開始就想把房子佈置成也能讓別人住進來。',
    summaryEn: 'He describes buying two beds for the Yellow House and says he meant from the start to furnish it so that someone else could stay.',
    sources: [vgl('let677')],
    contextNoteZh: '【史實與藝術重建】第 677 號信（1888年9月9日自亞爾致西奧）記錄了他購置兩張木床、期盼建立南方藝術家共同家園的心願。走進黃色小屋之背影場景為依此史實設計之藝術重建。',
    windowFrac: [0.28, 0.82],
  },
  {
    id: 'letter-595-arles',
    chapterId: 'sun',
    paintingId: 'sunflowers',
    citationZh: '致西奧（Theo van Gogh） · 第 595 號信 · 亞爾，1888年4月11日頃',
    citationEn: 'To Theo van Gogh · Letter 595 · Arles, on or about Wednesday, 11 April 1888',
    summaryZh: '他描述畫盛開的李樹果園時颳起強風，陽光從間隙照下，白色小花閃閃發亮。',
    summaryEn: 'He describes painting a plum orchard in bloom when a strong wind rose, with sunlight breaking through and the small white flowers glittering.',
    sources: [vgl('let595')],
    contextNoteZh: '【史實背景】第 595 號信為 1888 年 4 月 11 日頃梵谷在亞爾寫給西奧，記錄普羅旺斯強烈的陽光與密斯特拉風，這份南方光線隨後凝聚為他在 8 月為佈置黃色小屋客房所畫的《向日葵》。',
    windowFrac: [0.20, 0.80],
  },
  {
    id: 'letter-705-bedroom',
    chapterId: 'sun',
    paintingId: 'bedroom',
    citationZh: '致西奧（Theo van Gogh） · 第 705 號信 · 亞爾，1888年10月16日',
    citationEn: 'To Theo van Gogh · Letter 705 · Arles, Tuesday, 16 October 1888',
    summaryZh: '談《臥室》：這幅畫要完全靠色彩來暗示休息；牆是淡紫羅蘭色，地面是紅磚，床和椅子是奶油般的黃色。',
    summaryEn: 'On The Bedroom: colour alone is to suggest rest; pale violet walls, a red tiled floor, and bed and chairs in butter yellow.',
    sources: [vgl('let705')],
    contextNoteZh: '【史實考據（vangoghletters.org / ontrafel.vangogh.nl）】《亞爾的臥室》作於 1888 年 10 月；如第 705 號信所寫，原作牆面為淡紫羅蘭色（法文原信：les murs sont d’un violet pâle），後世因紅色色澱顏料褪色才呈現淺藍。',
    windowFrac: [0.18, 0.86],
  },
  {
    id: 'letter-691-rhone',
    chapterId: 'sun',
    paintingId: 'rhone',
    citationZh: '致西奧（Theo van Gogh） · 第 691 號信 · 亞爾，1888年9月29日頃',
    citationEn: 'To Theo van Gogh · Letter 691 · Arles, on or about Saturday, 29 September 1888',
    summaryZh: '隨信附上星空小草圖，說明是夜裡在煤氣燈下畫的，並描述藍綠色天空、皇室藍河水與大熊座。',
    summaryEn: 'He encloses a small sketch of the starry sky, painted at night under a gas lamp, and describes the green-blue sky, royal-blue water and the Great Bear.',
    sources: [vgl('let691')],
    contextNoteZh: '【史實背景】第 691 號信（1888年9月29日頃自亞爾致西奧）附有《隆河上的星夜》親筆鋼筆草圖，並詳述他在夜間煤氣燈下直接寫生星空的色彩配置。',
    windowFrac: [0.22, 0.78],
  },
  {
    id: 'interlude-3-saint-remy',
    chapterId: 'sun',
    isInterlude: true,
    citationZh: '幕間留白 III · 致西奧（Theo van Gogh） · 第 776 號信 · 聖雷米，1889年5月23日頃',
    citationEn: 'Interlude III · To Theo van Gogh · Letter 776 · Saint-Rémy-de-Provence, on or about Thursday, 23 May 1889',
    summaryZh: '在聖雷米療養院，他描述從裝了鐵欄杆的窗戶望見圍牆裡的一方麥田，清晨看著太陽在上方升起。',
    summaryEn: 'At the asylum in Saint-Rémy, he describes seeing a walled square of wheat through his barred window, and the sun rising over it in the morning.',
    sources: [vgl('let776')],
    contextNoteZh: '【史實背景】1889 年 5 月，梵谷自願住進聖雷米的聖保羅療養院。第 776 號信寫下他從病房窗戶凝視圍牆內麥田與日出的日常觀察。',
    windowFrac: [0.12, 0.88],
  },

  // ================= CHAPTER IV: 在困境中繼續創造 (聖雷米 Saint-Rémy, 1889–1890) =================
  {
    id: 'letter-782-starry',
    chapterId: 'cosmos',
    paintingId: 'starry',
    citationZh: '致西奧（Theo van Gogh） · 第 777 號信（1889年5月31日–6月6日頃）與第 782 號信（6月18日頃） · 聖雷米',
    citationEn: 'To Theo van Gogh · Letter 777 (c. 31 May–6 June 1889) & Letter 782 (c. 18 June 1889) · Saint-Rémy-de-Provence',
    summaryZh: '第 777 號信：日出前從窗戶望見鄉野，只有一顆很大的晨星。第 782 號信：完成一幅橄欖樹風景，還有一幅新的星空習作。',
    summaryEn: 'Letter 777: before sunrise he saw the countryside from his window, with only the morning star, looking very large. Letter 782: a landscape with olive trees and a new study of a starry sky.',
    sources: [vgl('let777'), vgl('let782')],
    contextNoteZh: '【史實考據（MoMA）與藝術重建】《星夜》並非對著單一真實夜景直接寫生，而是融合了清晨觀星（第 777 號信）、記憶與想像，於白天分多次完成（第 782 號信）。開場日間畫室畫架前之背影為依此史實設計之藝術重建。',
    windowFrac: [0.15, 0.68],
  },
  {
    id: 'letter-855-almond',
    chapterId: 'cosmos',
    paintingId: 'almond',
    citationZh: '致母親安娜（Anna van Gogh-Carbentus） · 第 855 號信 · 聖雷米，1890年2月19日頃',
    citationEn: 'To his mother Anna van Gogh-Carbentus · Letter 855 · Saint-Rémy-de-Provence, on or about Wednesday, 19 February 1890',
    summaryZh: '寫給母親：他立刻為西奧夫婦的臥室開始畫一幅畫——藍天前盛開的白色杏花枝。',
    summaryEn: 'To his mother: he at once began a painting for Theo and Jo’s bedroom, big branches of white almond blossom against a blue sky.',
    sources: [vgl('let855')],
    contextNoteZh: '【史實背景】1890 年 1 月 31 日，西奧與妻子喬（Jo van Gogh-Bonger）的兒子文森·威廉（Vincent Willem）出生。第 855 號信寫到梵谷為新生姪兒繪製《盛開的杏花》作為賀禮。',
    windowFrac: [0.20, 0.82],
  },
  {
    id: 'interlude-4-auvers-north',
    chapterId: 'cosmos',
    isInterlude: true,
    citationZh: '幕間留白 IV · 致西奧與喬（Theo van Gogh & Jo van Gogh-Bonger） · 第 873 號信 · 奧維爾，1890年5月20日',
    citationEn: 'Interlude IV · To Theo van Gogh and Jo van Gogh-Bonger · Letter 873 · Auvers-sur-Oise, Tuesday, 20 May 1890',
    summaryZh: '剛到奧維爾，他寫下這裡非常美，有許多已經少見的古老茅草屋頂，是道地的鄉間。',
    summaryEn: 'Just arrived in Auvers, he finds it very beautiful, full of old thatched roofs that are becoming rare, the heart of the countryside.',
    sources: [vgl('let873')],
    contextNoteZh: '【史實背景】1890 年 5 月 20 日，梵谷離開聖雷米北上抵達瓦茲河畔奧維爾（Auvers-sur-Oise），當天在第 873 號信中向西奧與喬寫下他對北方田野與古老茅草屋的第一印象。',
    windowFrac: [0.12, 0.88],
  },

  // ================= CHAPTER V: 生命的最後一段路 (奧維爾 Auvers-sur-Oise, 1890.05–07) =================
  {
    id: 'letter-898-crows',
    chapterId: 'road',
    paintingId: 'crows',
    citationZh: '致西奧與喬（Theo van Gogh & Jo van Gogh-Bonger） · 第 898 號信 · 奧維爾，1890年7月10日頃',
    citationEn: 'To Theo van Gogh and Jo van Gogh-Bonger · Letter 898 · Auvers-sur-Oise, on or about Thursday, 10 July 1890',
    summaryZh: '他描述動盪天空下的大片麥田，刻意表達悲傷與極度孤寂，同時希望這些畫也能說出他在鄉間看見的健康與振奮。',
    summaryEn: 'He describes vast wheatfields under troubled skies, painted to express sadness and loneliness, yet hopes the canvases will also show what he finds healthy and strengthening in the countryside.',
    sources: [vgl('let898')],
    contextNoteZh: '【史實考據（Van Gogh Museum）】《麥田群鴉》並非他的最後一幅畫，亦非單純的死亡預告；如第 898 號信所示，他在信中同時寫下了極度的孤寂，以及他在鄉間自然中看見的健康與振奮力量。',
    windowFrac: [0.20, 0.80],
  },
  {
    id: 'letter-rm25-daubigny',
    chapterId: 'road',
    paintingId: 'daubigny',
    citationZh: '致西奧（Theo van Gogh） · RM25 未寄出隨身信件草稿 · 奧維爾，1890年7月23日頃',
    citationEn: 'To Theo van Gogh · Unsent Draft RM25 (carried on his person) · Auvers-sur-Oise, on or about Wednesday, 23 July 1890',
    summaryZh: '在這份未寄出的草稿裡，他寫自己為作品押上了性命，又問不屬於畫商之流的西奧：你想要什麼？',
    summaryEn: 'In this unsent draft he writes that he is risking his life for his work, and asks Theo, whom he does not count among the dealers, what he wants.',
    sources: [vgl('RM25')],
    contextNoteZh: '【史實考據與藝術重建】RM25 為 1890 年 7 月 23 日頃未寄出的草稿，梵谷於 7 月 27 日受傷當天仍帶在身上；不同於正式寄出的第 902 號信。田野跟隨背影為藝術重建，刻意保留部分寫實世界不完全入畫。',
    windowFrac: [0.22, 0.82],
  },

  // ================= EPILOGUE: 尾聲 · 視點與書信的傳遞 (1891–1914) =================
  {
    id: 'epilogue-jo-bonger',
    chapterId: 'road',
    isEpilogue: true,
    citationZh: '尾聲 · 喬·梵谷-邦格（Jo van Gogh-Bonger）日記 · 荷蘭比瑟姆（Bussum），1891年11月15日',
    citationEn: 'Epilogue · Jo van Gogh-Bonger’s Diary · Bussum, 15 November 1891',
    summaryZh: '喬在日記中寫下，西奧除了孩子，還留給她另一個使命：讓文森的作品被看見、被珍視，並為孩子完整保存兩兄弟的收藏。',
    summaryEn: 'Jo writes that besides their child, Theo left her another task: to have Vincent’s work seen and valued, and to keep the brothers’ collection whole for the child.',
    sources: [],
    contextNoteZh: '【史實記錄（Van Gogh Museum）】1890年7月29日梵谷離世，半年後（1891年1月25日）弟弟西奧去世，當時兩人的孩子（Vincent Willem，1890年1月31日生）尚未滿周歲。摘要依據喬於 1891 年 11 月 15 日寫下的日記；她隨後耗費二十餘年整理並於 1914 年出版《致西奧的書信集》，讓後世得以見證這段人生。',
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
