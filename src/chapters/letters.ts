// Historical letters from Vincent van Gogh (Van Gogh Museum / Huygens ING 2009 critical edition, vangoghletters.org)
// and Jo van Gogh-Bonger's verbatim diary record (15 November 1891).
// Designed as discoverable diegetic traces ("沿途發現的痕跡"), never as continuous explanatory narration.
// Strict separation of sources:
//  - `quoteZh` / `quoteEn`: 100% verbatim historical excerpts from the cited letter or diary entry (never paraphrased or invented).
//  - `contextNoteZh` & `RECONSTRUCTION_DISCLAIMER_ZH`: Explicitly labeled historical context and artistic reconstruction notes.
import type { ChapterId, PaintingId } from './types';

export interface EpistolaryTrace {
  id: string;
  chapterId: ChapterId;
  paintingId?: PaintingId;
  isInterlude?: boolean;
  isEpilogue?: boolean;
  /** Verified citation header (Recipient · Letter number · Place, Date per vangoghletters.org) */
  citationZh: string;
  citationEn: string;
  /** Verbatim historical excerpt (literal translation in Zh + original English edition text from vangoghletters.org) */
  quoteZh: string;
  quoteEn: string;
  /** Explicitly separated historical background or artistic reconstruction note */
  contextNoteZh: string;
  /** Normalized window [tauStartFrac, tauEndFrac] within the beat when the trace softly surfaces */
  windowFrac: readonly [number, number];
}

export const RECONSTRUCTION_DISCLAIMER_ZH =
  '史料與藝術重建區分聲明：上方引號內文字均為梵谷書信編目（Van Gogh Museum / Huygens ING, vangoghletters.org）之逐字史料原文；畫面中之人物動態、1885年農舍角落素描與五章場景則為「有史料支持的藝術重建（Historically informed artistic reconstruction）」，並非單一確知歷史現場之攝影紀錄。';

export const EPISTOLARY_TRACES: readonly EpistolaryTrace[] = [
  // ================= CHAPTER I: 尋找人生的位置 (荷蘭 Nuenen, 1884–1885) =================
  {
    id: 'letter-497-potato',
    chapterId: 'earth',
    paintingId: 'potato',
    citationZh: '致西奧（Theo van Gogh） · 第 497 號信 · 荷蘭紐南，1885年4月30日頃',
    citationEn: 'To Theo van Gogh · Letter 497 · Nuenen, on or about Thursday, 30 April 1885',
    quoteZh: '「我試著強調，那些在燈光下吃馬鈴薯的人，正是用他們伸進盤子裡的同一雙手去翻掘土地的；因此這幅畫談論的是雙手的勞動，以及他們如何誠實地掙得自己的食物。」',
    quoteEn: '“I have tried to emphasize that those people, eating their potatoes in the lamplight, have dug the earth with those very hands they put in the dish, and so it speaks of manual labour, and how they have honestly earned their food.”',
    contextNoteZh: '【史實與藝術重建】引文出自第 497 號信逐字原文。梵谷於 1884–1885 年冬春在紐南繪製數十幅農民頭像與手部習作後完成《食薯者》；開場農舍角落素描場景為依此史料設計之藝術重建。',
    windowFrac: [0.34, 0.78],
  },
  {
    id: 'letter-448-weaver',
    chapterId: 'earth',
    paintingId: 'weaver',
    citationZh: '致安東·范·拉帕德（Anthon van Rappard） · 第 448 號信 · 荷蘭紐南，1884年5月29日頃',
    citationEn: 'To Anthon van Rappard · Letter 448 · Nuenen, on or about Thursday, 29 May 1884',
    quoteZh: '「儘管如此，那幅小《織布工》是個例外，正如我當時也說明過的。從低音域的色調開始作畫，再設法由低處往上提亮——我當時在你畫的紡紗女中也發現了這個方法……」',
    quoteEn: '“All the same, the little weaver is an exception to this, as I also stipulated then. Starting a painting in a low register and then seeking to raise it from low upward, I found that system in your woman spinning at the time...”',
    contextNoteZh: '【史實背景】第 448 號信為梵谷於 1884 年 5 月 29 日頃自紐南寫給畫家友人拉帕德（Anthon van Rappard），討論他如何以暗褐色低音域描繪紐南鄉間織布工與橡木織布機。',
    windowFrac: [0.22, 0.75],
  },
  {
    id: 'interlude-1-paris-train',
    chapterId: 'earth',
    isInterlude: true,
    citationZh: '幕間留白 I · 致西奧（Theo van Gogh） · 第 567 號信 · 巴黎，1886年2月28日頃',
    citationEn: 'Interlude I · To Theo van Gogh · Letter 567 · Paris, on or about Sunday, 28 February 1886',
    quoteZh: '「親愛的西奧，別生我的氣，我就這樣突然來了。這件事我想了非常久，我覺得這樣我們能省下時間。中午起我會在羅浮宮，或者你希望更早也可以。」',
    quoteEn: '“My dear Theo, Don’t be cross with me that I’ve come all of a sudden. I’ve thought about it so much and I think we’ll save time this way. Will be at the Louvre from midday, or earlier if you like.”',
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
    quoteZh: '「今年夏天我在阿尼耶爾畫風景時，我看見了比以前更多的色彩。我現在正把這一點運用到肖像畫的研究中……我計畫一有機會就去南方一段時間，那裡有更多的色彩、更多的陽光。」',
    quoteEn: '“And when I painted landscape in Asnières this summer I saw more colour in it than before. I’m studying this now in portraits... It’s my plan to go to the south for a while, as soon as I can, where there’s even more colour and even more sun.”',
    contextNoteZh: '【史實與藝術重建】引文出自第 574 號信（1887年10月下旬自巴黎致妹妹 Willemien）。開場巴黎街道背影跟隨與街景色彩甦醒，為根據他在巴黎吸收印象派與點描色彩觀念所作之藝術重建。',
    windowFrac: [0.32, 0.78],
  },
  {
    id: 'letter-686-tanguy',
    chapterId: 'color',
    paintingId: 'tanguy',
    citationZh: '致西奧（Theo van Gogh） · 第 686 號信 · 亞爾（回顧日本浮世繪精神），1888年9月24日',
    citationEn: 'To Theo van Gogh · Letter 686 · Arles, Monday, 24 September 1888',
    quoteZh: '「如果我們研究日本藝術，就會看見一個無疑充滿智慧、哲思與才智的人，他把時間花在做什麼呢？研究地球到月球的距離嗎？不是；研究俾斯麥的政策嗎？也不是；他研究一株小草。」',
    quoteEn: '“If we study Japanese art, then we see a man who is undoubtedly wise, philosophical and intelligent, who spends his time — doing what? Studying the distance from the earth to the moon? No; studying the policy of Bismarck? No; he studies a single blade of grass.”',
    contextNoteZh: '【史實背景】1887 年秋冬梵谷於巴黎完成《唐吉老爹肖像》，背景貼滿他與西奧收藏的日本浮世繪。第 686 號信逐字記錄了他對日本版畫觀看自然方式的深刻體會。',
    windowFrac: [0.22, 0.76],
  },
  {
    id: 'letter-590-arles-palette',
    chapterId: 'color',
    isInterlude: true,
    citationZh: '幕間留白 II · 致妹妹威廉明娜（Willemien van Gogh） · 第 590 號信 · 亞爾，1888年3月30日頃',
    citationEn: 'Interlude II · To Willemien van Gogh · Letter 590 · Arles, on or about Friday, 30 March 1888',
    quoteZh: '「妳明白南方的自然絕不能完全用莫夫（Mauve）那樣的調色盤來畫——他屬於北方，過去是、未來也永遠會是灰色調的大師。但現在的調色盤是鮮明多彩的——天藍、粉紅、橙色、朱紅、亮黃、鮮綠、明亮的酒紅、紫羅蘭。」',
    quoteEn: '“You understand that nature in the south can’t strictly be painted with the palette of Mauve, say, who belongs in the north and is, and always will be, the master of grey. But at present the palette is distinctly colourful — sky blue, pink, orange, vermilion, brilliant yellow, bright green, bright wine red, violet.”',
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
    quoteZh: '「我買了一張胡桃木床，另一張白松木床則是我的，之後我會在上面塗畫……從一開始，我就希望佈置這棟房子不只是為了我自己，而是能讓別人也住進來。」',
    quoteEn: '“I bought one bed in walnut and another in deal, which will be mine, and which I’ll paint later... From the start, I wanted to arrange the house not just for myself but in such a way as to be able to put somebody up.”',
    contextNoteZh: '【史實與藝術重建】第 677 號信（1888年9月9日自亞爾致西奧）記錄了他購置兩張木床、期盼建立南方藝術家共同家園的心願。走進黃色小屋之背影場景為依此史實設計之藝術重建。',
    windowFrac: [0.28, 0.82],
  },
  {
    id: 'letter-595-arles',
    chapterId: 'sun',
    paintingId: 'sunflowers',
    citationZh: '致西奧（Theo van Gogh） · 第 595 號信 · 亞爾，1888年4月11日頃',
    citationEn: 'To Theo van Gogh · Letter 595 · Arles, on or about Wednesday, 11 April 1888',
    quoteZh: '「今天早晨我畫了一片盛開的李樹果園；突然間刮起一陣猛烈的風，那種效果我在別處從未見過，而且一陣一陣地吹來。陽光在間隙中閃耀，所有白色的小花都在發光。」',
    quoteEn: '“This morning I worked on an orchard of plum trees in bloom; all at once a fierce wind sprang up, an effect I had seen nowhere else but here, and returned at intervals. The sun shone in between, and all the little white flowers sparkled.”',
    contextNoteZh: '【史實背景】第 595 號信為 1888 年 4 月 11 日頃梵谷在亞爾寫給西奧，記錄普羅旺斯強烈的陽光與密斯特拉風，這份南方光線隨後凝聚為他在 8 月為佈置黃色小屋客房所畫的《向日葵》。',
    windowFrac: [0.20, 0.80],
  },
  {
    id: 'letter-705-bedroom',
    chapterId: 'sun',
    paintingId: 'bedroom',
    citationZh: '致西奧（Theo van Gogh） · 第 705 號信 · 亞爾，1888年10月16日',
    citationEn: 'To Theo van Gogh · Letter 705 · Arles, Tuesday, 16 October 1888',
    quoteZh: '「這一次單純是我的臥室，只是在這裡一切都要靠色彩來完成，透過簡化賦予事物更宏大的風格，在這裡暗示休息或睡眠。總而言之，看著這幅畫應該讓大腦、或者說讓想像力休息下來。牆面是淡紫羅蘭色的。地面是紅磚。床與椅子的木頭是新鮮奶油般的黃色。」',
    quoteEn: '“This time it’s simply my bedroom, only here colour is to do everything, and giving by its simplification a grander style to things, is to be suggestive here of rest or of sleep in general. In a word, looking at the picture ought to rest the brain, or rather the imagination. The walls are of a pale violet. The floor is of red tiles. The wood of the bed and the chairs is the yellow of fresh butter.”',
    contextNoteZh: '【史實考據（vangoghletters.org / ontrafel.vangogh.nl）】《亞爾的臥室》作於 1888 年 10 月；如第 705 號信原文記載，原作牆面為淡紫羅蘭色（les murs sont d’un violet pâle / pale violet），後世因紅色色澱顏料褪色才呈現淺藍。',
    windowFrac: [0.18, 0.86],
  },
  {
    id: 'letter-691-rhone',
    chapterId: 'sun',
    paintingId: 'rhone',
    citationZh: '致西奧（Theo van Gogh） · 第 691 號信 · 亞爾，1888年9月29日頃',
    citationEn: 'To Theo van Gogh · Letter 691 · Arles, on or about Saturday, 29 September 1888',
    quoteZh: '「隨信附上一張 30 號方形畫布的小草圖——終於畫出的星空，真的是在夜晚、在煤氣燈下畫的。天空是藍綠色，河水是皇室藍，地面是淡紫紅色……在藍綠色的天幕上，大熊座閃爍著綠與粉紅的微光，那低調的蒼白與煤氣燈刺眼的金黃形成對比。」',
    quoteEn: '“Included herewith little croquis of a square no. 30 canvas — the starry sky at last, actually painted at night, under a gas-lamp. The sky is green-blue, the water is royal blue, the areas of land are mauve... Against the green-blue field of the sky the Great Bear has a green and pink sparkle whose discreet paleness contrasts with the harsh gold of the gaslight.”',
    contextNoteZh: '【史實背景】第 691 號信（1888年9月29日頃自亞爾致西奧）附有《隆河上的星夜》親筆鋼筆草圖，並逐字詳述他在夜間煤氣燈下直接寫生星空的色彩配置。',
    windowFrac: [0.22, 0.78],
  },
  {
    id: 'interlude-3-saint-remy',
    chapterId: 'sun',
    isInterlude: true,
    citationZh: '幕間留白 III · 致西奧（Theo van Gogh） · 第 776 號信 · 聖雷米，1889年5月23日頃',
    citationEn: 'Interlude III · To Theo van Gogh · Letter 776 · Saint-Rémy-de-Provence, on or about Thursday, 23 May 1889',
    quoteZh: '「透過裝有鐵欄杆的窗戶，我看見圍牆裡的一方麥田，透視感如同范·戈延（Van Goyen）的畫，每天清晨我看見太陽在它上方榮耀地升起。」',
    quoteEn: '“Through the iron-barred window I can make out a square of wheat in an enclosure, a perspective in the manner of Van Goyen, above which in the morning I see the sun rise in its glory.”',
    contextNoteZh: '【史實背景】1889 年 5 月，梵谷自願住進聖雷米的聖保羅療養院。第 776 號信逐字記錄了他從病房窗戶凝視圍牆內麥田與日出的日常觀察。',
    windowFrac: [0.12, 0.88],
  },

  // ================= CHAPTER IV: 在困境中繼續創造 (聖雷米 Saint-Rémy, 1889–1890) =================
  {
    id: 'letter-782-starry',
    chapterId: 'cosmos',
    paintingId: 'starry',
    citationZh: '致西奧（Theo van Gogh） · 第 777 號信（1889年5月31日–6月6日頃）與第 782 號信（6月18日頃） · 聖雷米',
    citationEn: 'To Theo van Gogh · Letter 777 (c. 31 May–6 June 1889) & Letter 782 (c. 18 June 1889) · Saint-Rémy-de-Provence',
    quoteZh: '「今天清晨日出前很久，我從窗戶望見鄉間的景色，那裡什麼也沒有，只有那顆看起來非常大的晨星。」（第 777 號信）／「我終於畫了一幅有橄欖樹的風景，還有一幅新的星空習作。」（第 782 號信）',
    quoteEn: '“This morning I saw the countryside from my window a long time before sunrise with nothing but the morning star, which looked very big.” (Letter 777) / “At last I have a landscape with olive trees, and also a new study of a starry sky.” (Letter 782)',
    contextNoteZh: '【史實考據（MoMA）與藝術重建】《星夜》並非對著單一真實夜景直接寫生，而是融合了清晨觀星（第 777 號信）、記憶與想像，於白天分多次完成（第 782 號信）。開場日間畫室畫架前之背影為依此史實設計之藝術重建。',
    windowFrac: [0.15, 0.68],
  },
  {
    id: 'letter-855-almond',
    chapterId: 'cosmos',
    paintingId: 'almond',
    citationZh: '致母親安娜（Anna van Gogh-Carbentus） · 第 855 號信 · 聖雷米，1890年2月19日頃',
    citationEn: 'To his mother Anna van Gogh-Carbentus · Letter 855 · Saint-Rémy-de-Provence, on or about Wednesday, 19 February 1890',
    quoteZh: '「我立刻開始為他畫一幅畫，好掛在他們的臥室裡——藍色天空下盛開的大枝白色杏花。」',
    quoteEn: '“I started right away to make a painting for him, to hang in their bedroom, big branches of white almond blossom against a blue sky.”',
    contextNoteZh: '【史實背景】1890 年 1 月 31 日，西奧與妻子喬（Jo van Gogh-Bonger）的兒子文森·威廉（Vincent Willem）出生。第 855 號信逐字記錄了梵谷為新生姪兒繪製《盛開的杏花》作為賀禮。',
    windowFrac: [0.20, 0.82],
  },
  {
    id: 'interlude-4-auvers-north',
    chapterId: 'cosmos',
    isInterlude: true,
    citationZh: '幕間留白 IV · 致西奧與喬（Theo van Gogh & Jo van Gogh-Bonger） · 第 873 號信 · 奧維爾，1890年5月20日',
    citationEn: 'Interlude IV · To Theo van Gogh and Jo van Gogh-Bonger · Letter 873 · Auvers-sur-Oise, Tuesday, 20 May 1890',
    quoteZh: '「奧維爾非常美，其中有許多現在已經很少見的古老茅草屋頂……真的，這裡有種深沉的美，是真正的鄉間腹地，獨特而如畫。」',
    quoteEn: '“Auvers is very beautiful, among other things a lot of old thatched roofs, which are becoming rare... really, it is profoundly beautiful, it is the heart of the countryside, distinctive and picturesque.”',
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
    quoteZh: '「那是動盪天空下一望無際的麥田，我刻意試著表達悲傷與極度的孤寂。希望你們很快能看見這些畫——因為我希望能盡快帶去巴黎給你們，我幾乎相信這些畫布會告訴你們我無法用言語說出的事，也就是我在鄉間所看見的那種健康與振奮人心的力量。」',
    quoteEn: '“They’re immense stretches of wheatfields under turbulent skies, and I made a point of trying to express sadness, extreme loneliness. You’ll see this soon, I hope — for I hope to bring them to you in Paris as soon as possible, since I almost believe that these canvases will tell you what I can’t say in words, what I considers healthy and fortifying about the countryside.”',
    contextNoteZh: '【史實考據（Van Gogh Museum）】《麥田群鴉》並非他的最後一幅畫，亦非單純的死亡預告；如第 898 號信逐字原文所示，他在信中同時寫下了極度的孤寂，以及他在鄉間自然中看見的健康與振奮力量（healthy and fortifying）。',
    windowFrac: [0.20, 0.80],
  },
  {
    id: 'letter-rm25-daubigny',
    chapterId: 'road',
    paintingId: 'daubigny',
    citationZh: '致西奧（Theo van Gogh） · RM25 未寄出隨身信件草稿 · 奧維爾，1890年7月23日頃',
    citationEn: 'To Theo van Gogh · Unsent Draft RM25 (carried on his person) · Auvers-sur-Oise, on or about Wednesday, 23 July 1890',
    quoteZh: '「那麼，我自己的工作，我正為它冒著生命的危險，我的理智也為它沉沒了一半——那也沒關係——但據我所知，你並不是那些買賣人口的商人，而且我想你依然可以選擇自己的立場，帶著真正的人性去行動，但你想要什麼呢？」',
    quoteEn: '“Well, my own work, I am risking my life for it and my reason has half foundered in it — that’s all right — but you are not among the dealers in men as far as I know, and you can still choose your side, I think, acting with true humanity, but what do you want?”',
    contextNoteZh: '【史實考據與藝術重建】引文出自 RM25（1890年7月23日頃未寄出之隨身草稿逐字原文，梵谷於7月27日受傷當天仍帶在身上；不同於正式寄出的第 902 號信）。田野跟隨背影為藝術重建，刻意保留部分寫實世界不完全入畫。',
    windowFrac: [0.22, 0.82],
  },

  // ================= EPILOGUE: 尾聲 · 視點與書信的傳遞 (1891–1914) =================
  {
    id: 'epilogue-jo-bonger',
    chapterId: 'road',
    isEpilogue: true,
    citationZh: '尾聲 · 喬·梵谷-邦格（Jo van Gogh-Bonger）日記原文 · 荷蘭比瑟姆（Bussum），1891年11月15日',
    citationEn: 'Epilogue · Jo van Gogh-Bonger’s Diary (Verbatim Entry) · Bussum, 15 November 1891',
    quoteZh: '「除了照顧孩子之外，他（西奧）還留給我另一項使命，那就是文森的作品——盡可能展出它們、讓世人理解並珍視它們……西奧與文森共同累積的所有珍寶——為孩子完整無損地保存下來——這也是我的使命。」',
    quoteEn: '“Besides the care for the child he left me yet another task, Vincent’s work — to show it and to let it be appreciated as much as possible... All the treasures that Theo and Vincent collected — to preserve them inviolate for the child — that also is my task.”',
    contextNoteZh: '【史實記錄（Van Gogh Museum）】1890年7月29日梵谷離世，半年後（1891年1月25日）弟弟西奧去世，當時兩人的孩子（Vincent Willem，1890年1月31日生）尚未滿周歲。引文出自喬於 1891 年 11 月 15 日寫下的日記原文；她隨後耗費二十餘年整理並於 1914 年出版《致西奧的書信集》，讓後世得以見證這段人生。',
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
