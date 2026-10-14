// M8 DOM overlay (§4.8) + Van Gogh World System UI:
// - Level 1: Single Painting World & Diegetic Portal Title Card
// - Level 2: Theme Paths Bar (Nights, Roads, Dwellings, Flora, Single Loop)
// - Level 3: 5 Grand Chapters (Earth -> Color -> Sun -> Cosmos -> Road, 10 Worlds)
// - 3 Viewing Modes: Odyssey (10-Act Film) / Theme Path (Motif Chains) / Atlas (Interactive World Graph & Neighbor Portals)
import { type PerspectiveCamera, Vector3 } from 'three';
import { EYE, FORWARD } from '../shared/canvasSpace';
import type { ChapterId, MotifId, PaintingId, ViewMode } from '../chapters/types';
import {
  CHAPTER_SPECS, MOTIF_SPECS, THEME_PATHS, WORLD_GRAPH, getChapterSpec,
} from '../chapters/worldGraph';

export const HINT_TEXT = '拖曳探索 3D 筆觸 · Space 歸位凝視點 · [ ] 切換畫作 · U 開啟梵谷宇宙星圖';

const STYLE_ID = 'pn-director-ui-style';
const CSS = `
.pn-ui{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:20;overflow:hidden;
  font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans TC",sans-serif;color:#e8edf0;-webkit-user-select:none;user-select:none}
.pn-hint{position:absolute;left:50%;bottom:82px;transform:translateX(-50%);max-width:calc(100% - 32px);box-sizing:border-box;
  padding:6px 14px;border-radius:999px;background:rgba(5,10,24,.62);box-shadow:0 0 0 1px rgba(232,237,240,.12);
  letter-spacing:.03em;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.8);
  opacity:0;transition:opacity .25s linear}
.pn-hud{position:absolute;left:10px;top:86px;max-width:calc(100% - 20px);box-sizing:border-box;padding:6px 9px;border-radius:6px;
  background:rgba(5,10,24,.68);box-shadow:0 0 0 1px rgba(232,237,240,.10);
  font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;white-space:pre-wrap;word-break:break-word;display:none}
.pn-hud b{color:#f2c230;font-weight:600}
.pn-ring{position:absolute;left:0;top:0;border-radius:50%;border:1.5px solid #f2c230;box-sizing:border-box;
  box-shadow:0 0 6px rgba(242,194,48,.55),inset 0 0 4px rgba(242,194,48,.35);display:none;will-change:transform}
.pn-ring::after{content:"";position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;background:#f2c230}
.pn-suite{position:absolute;left:50%;top:10px;transform:translateX(-50%);pointer-events:auto;display:flex;align-items:center;gap:2px;
  padding:4px 6px;border-radius:999px;background:rgba(5,10,24,.76);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  box-shadow:0 4px 20px rgba(0,0,0,.45),0 0 0 1px rgba(232,237,240,.14);max-width:calc(100% - 14px);overflow-x:auto}
.pn-suite-btn{appearance:none;border:0;background:transparent;color:rgba(232,237,240,.78);padding:4px 8px;border-radius:999px;
  font:500 11px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;letter-spacing:.01em;cursor:pointer;
  white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease,opacity .18s ease;display:flex;align-items:center;gap:4px}
.pn-suite-btn:hover{color:#fff;background:rgba(232,237,240,.10)}
.pn-suite-btn[data-inseq="0"]{opacity:.48}
.pn-suite-btn[data-active="1"]{opacity:1;color:#f5e27a;background:rgba(242,194,48,.18);box-shadow:inset 0 0 0 1px rgba(242,194,48,.52)}
.pn-ch-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.pn-suite-sep{width:1px;height:14px;background:rgba(232,237,240,.16);margin:0 2px;flex-shrink:0}
.pn-odyssey-btn{appearance:none;border:0;background:rgba(232,237,240,.07);color:rgba(232,237,240,.74);padding:4px 8px;border-radius:999px;
  font:500 11px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;letter-spacing:.02em;cursor:pointer;
  white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease}
.pn-odyssey-btn:hover{color:#fff;background:rgba(232,237,240,.14)}
.pn-odyssey-btn[data-on="1"]{color:#f5e27a;background:rgba(242,194,48,.16);box-shadow:inset 0 0 0 1px rgba(242,194,48,.45)}
.pn-pathbar{position:absolute;left:50%;top:46px;transform:translateX(-50%);pointer-events:auto;display:none;align-items:center;gap:4px;
  padding:3px 7px;border-radius:999px;background:rgba(5,10,24,.74);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  box-shadow:0 4px 16px rgba(0,0,0,.4),0 0 0 1px rgba(242,194,48,.22);max-width:calc(100% - 16px);overflow-x:auto}
.pn-path-btn{appearance:none;border:0;background:transparent;color:rgba(232,237,240,.75);padding:3px 9px;border-radius:999px;
  font:500 11px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;cursor:pointer;white-space:nowrap;
  transition:background .16s ease,color .16s ease}
.pn-path-btn:hover{color:#fff;background:rgba(232,237,240,.1)}
.pn-path-btn[data-active="1"]{color:#f5e27a;background:rgba(242,194,48,.2);box-shadow:inset 0 0 0 1px rgba(242,194,48,.48)}
.pn-neighbors{position:absolute;right:14px;bottom:76px;pointer-events:auto;display:flex;flex-direction:column;gap:4px;
  padding:7px 10px;border-radius:12px;background:rgba(5,10,24,.68);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
  box-shadow:0 4px 18px rgba(0,0,0,.42),0 0 0 1px rgba(232,237,240,.12);max-width:255px}
.pn-nb-head{font-size:10px;letter-spacing:.08em;color:rgba(242,194,48,.88);display:flex;justify-content:space-between;align-items:center}
.pn-nb-list{display:flex;flex-wrap:wrap;gap:4px}
.pn-nb-btn{appearance:none;border:0;background:rgba(232,237,240,.08);color:#e8edf0;padding:3px 8px;border-radius:999px;
  font:500 10.5px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;cursor:pointer;
  transition:background .16s ease,color .16s ease,box-shadow .16s ease;text-align:left}
.pn-nb-btn:hover{color:#f5e27a;background:rgba(242,194,48,.18);box-shadow:inset 0 0 0 1px rgba(242,194,48,.45)}
.pn-card{position:absolute;left:50%;bottom:86px;transform:translateX(-50%);text-align:center;pointer-events:none;
  padding:10px 22px 11px;border-radius:14px;background:rgba(5,10,24,.68);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  box-shadow:0 8px 28px rgba(0,0,0,.48),0 0 0 1px rgba(242,194,48,.24);opacity:0;transition:opacity .45s ease;max-width:calc(100% - 28px)}
.pn-card-sub{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#f2c230;margin-bottom:3px;opacity:.92}
.pn-card-title{font-size:15px;font-weight:600;letter-spacing:.04em;color:#f4f7f9;text-shadow:0 1px 3px rgba(0,0,0,.85)}
.pn-card-portal{font-size:11.5px;color:rgba(245,226,122,.86);margin-top:4px;letter-spacing:.02em}
.pn-tl{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:min(820px,calc(100% - 20px));box-sizing:border-box;
  padding:7px 14px 8px;border-radius:14px;background:rgba(5,10,24,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  box-shadow:0 4px 20px rgba(0,0,0,.45),0 0 0 1px rgba(232,237,240,.13);pointer-events:auto;display:none}
.pn-tl-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-size:11.5px;letter-spacing:.02em}
.pn-tl-shot{color:#f5e27a;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:76%}
.pn-tl-time{color:rgba(232,237,240,.72);font:11px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;flex-shrink:0}
.pn-tl-track{position:relative;height:7px;border-radius:999px;background:rgba(232,237,240,.15);cursor:pointer;touch-action:none}
.pn-tl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#c8964e,#7eb8da,#f2c230,#5eb2bc,#d85e24);width:0%}
.pn-tl-thumb{position:absolute;top:50%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;background:#f5e27a;
  box-shadow:0 0 8px rgba(242,194,48,.85),0 0 0 1.5px #050a18;left:0%}
.pn-tl-mark{position:absolute;top:-1px;bottom:-1px;width:1.5px;background:rgba(5,10,24,.88);z-index:1}
.pn-tl-acts{display:grid;margin-top:4px;font-size:10px;color:rgba(232,237,240,.58)}
.pn-tl-act{text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 1px;cursor:pointer;transition:color .15s ease}
.pn-tl-act:hover{color:#fff}
.pn-tl-act[data-active="1"]{color:#f5e27a;font-weight:600}
.pn-atlas{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(860px,calc(100% - 24px));max-height:calc(100% - 108px);
  box-sizing:border-box;padding:16px 18px;border-radius:18px;background:rgba(5,10,24,.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  box-shadow:0 16px 48px rgba(0,0,0,.68),0 0 0 1px rgba(242,194,48,.32);pointer-events:auto;display:none;overflow-y:auto;z-index:30}
.pn-atlas-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid rgba(232,237,240,.12);padding-bottom:8px}
.pn-atlas-title{font-size:14.5px;font-weight:600;color:#f5e27a;letter-spacing:.04em}
.pn-atlas-close{appearance:none;border:0;background:rgba(232,237,240,.1);color:#e8edf0;padding:4px 10px;border-radius:999px;font-size:11px;cursor:pointer}
.pn-atlas-close:hover{background:rgba(242,194,48,.22);color:#f5e27a}
.pn-atlas-motifs{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;align-items:center}
.pn-motif-pill{appearance:none;border:0;background:rgba(232,237,240,.08);color:rgba(232,237,240,.82);padding:4px 10px;border-radius:999px;
  font:500 11px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;cursor:pointer;transition:all .16s ease}
.pn-motif-pill:hover{background:rgba(232,237,240,.16);color:#fff}
.pn-motif-pill[data-active="1"]{background:rgba(242,194,48,.22);color:#f5e27a;box-shadow:inset 0 0 0 1px rgba(242,194,48,.52)}
.pn-atlas-chapters{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px}
.pn-ch-col{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.03);box-shadow:inset 0 0 0 1px rgba(232,237,240,.09)}
.pn-ch-head{font-size:10.5px;font-weight:600;letter-spacing:.06em;margin-bottom:3px}
.pn-ch-sub{font-size:10px;color:rgba(232,237,240,.6);margin-bottom:7px;line-height:1.3}
.pn-ch-node{display:block;width:100%;text-align:left;appearance:none;border:0;margin-bottom:5px;padding:6px 8px;border-radius:8px;
  background:rgba(232,237,240,.06);color:#e8edf0;font:500 11px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
  cursor:pointer;transition:all .16s ease}
.pn-ch-node:hover{background:rgba(242,194,48,.16);color:#f5e27a}
.pn-ch-node[data-active="1"]{background:rgba(242,194,48,.22);color:#f5e27a;box-shadow:inset 0 0 0 1px rgba(242,194,48,.58)}
.pn-ch-node[data-dim="1"]{opacity:.32}
.pn-ch-node-motifs{font-size:9.5px;color:rgba(232,237,240,.62);margin-top:2px}
.pn-atlas-detail{padding:10px 12px;border-radius:12px;background:rgba(242,194,48,.07);box-shadow:inset 0 0 0 1px rgba(242,194,48,.24);font-size:11.5px}
.pn-detail-row{margin-bottom:5px;color:rgba(232,237,240,.88)}
.pn-detail-row b{color:#f5e27a}
.pn-focusable:focus{outline:none}
.pn-focusable:focus-visible{outline:2px solid #f2c230;outline-offset:-3px}
@media (max-width:720px){.pn-neighbors{display:none}}
@media (prefers-reduced-motion:reduce){.pn-hint,.pn-card{transition:none}}
`;

export interface RingState { x: number; y: number; r: number; visible: boolean; opacity: number }
export interface UiState {
  hud: boolean;
  /** director line shown under the integrator's HUD text */
  hudLine: string;
  /** 0..1 */
  hintOpacity: number;
  ring: RingState;
  loopTime?: number;
  loopSeconds?: number;
  shotName?: string;
}

export interface SuiteItem {
  id: PaintingId;
  chapterId: ChapterId;
  roman: string;
  shortZh: string;
  tinyZh: string;
  titleZh: string;
  titleEn: string;
  placeZh: string;
  year: string;
  portalZh: string;
}

export const SUITE_ITEMS: readonly SuiteItem[] = [
  {
    id: 'potato', chapterId: 'earth', roman: 'I', shortZh: '食薯者', tinyZh: 'I 食薯者',
    titleZh: '食薯者', titleEn: 'The Potato Eaters',
    placeZh: 'Chapter I · 黑土與人 (荷蘭 Nuenen)', year: '1885.04',
    portalZh: '飛入中央懸掛油燈的暖金火芯 → 照亮地面踏上旅途的《一雙舊鞋》',
  },
  {
    id: 'shoes', chapterId: 'earth', roman: 'II', shortZh: '一雙舊鞋', tinyZh: 'II 舊鞋',
    titleZh: '一雙舊鞋', titleEn: 'A Pair of Shoes',
    placeZh: 'Chapter I · 黑土與人 (Nuenen / Paris)', year: '1886.09',
    portalZh: '順著蜿蜒鬆開的鞋帶迎向金色門檻光束 → 踏上巴黎克利希大道',
  },
  {
    id: 'paris', chapterId: 'color', roman: 'III', shortZh: '克利希大道', tinyZh: 'III 巴黎',
    titleZh: '克利希大道', titleEn: 'Boulevard de Clichy',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)', year: '1887.03',
    portalZh: '穿過點描林蔭大道晨光 → 轉身對視畫家《戴草帽的自畫像》雙眸',
  },
  {
    id: 'selfportrait', chapterId: 'color', roman: 'IV', shortZh: '自畫像', tinyZh: 'IV 自畫像',
    titleZh: '戴草帽的自畫像', titleEn: 'Self-Portrait with Straw Hat',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)', year: '1887.08',
    portalZh: '飛入畫家翠綠瞳孔與金黃草帽光環 → 綻放為亞爾盛開的《向日葵》',
  },
  {
    id: 'sunflowers', chapterId: 'sun', roman: 'V', shortZh: '向日葵', tinyZh: 'V 向日葵',
    titleZh: '向日葵', titleEn: 'Sunflowers',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.08',
    portalZh: '穿過中央向日葵燃燒的金色花盤核心 → 化為亞爾夜間咖啡座瓦斯燈棚',
  },
  {
    id: 'cafe', chapterId: 'sun', roman: 'VI', shortZh: '夜間咖啡座', tinyZh: 'VI 咖啡座',
    titleZh: '夜間露天咖啡座', titleEn: 'Café Terrace at Night',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.09',
    portalZh: '穿過鵝卵石街尾星谷 → 步入隆河河畔',
  },
  {
    id: 'rhone', chapterId: 'sun', roman: 'VII', shortZh: '隆河星夜', tinyZh: 'VII 隆河',
    titleZh: '隆河上的星夜', titleEn: 'Starry Night Over the Rhône',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.09',
    portalZh: '飛入對岸暖黃窗燈 → 走進亞爾黃色小屋臥室',
  },
  {
    id: 'bedroom', chapterId: 'sun', roman: 'VIII', shortZh: '亞爾臥室', tinyZh: 'VIII 臥室',
    titleZh: '在亞爾的臥室', titleEn: 'The Bedroom in Arles',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.10',
    portalZh: '推開半掩的綠色百葉窗 → 飛入聖雷米星夜',
  },
  {
    id: 'starry', chapterId: 'cosmos', roman: 'IX', shortZh: '星夜', tinyZh: 'IX 星夜',
    titleZh: '星夜', titleEn: 'The Starry Night',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1889.06',
    portalZh: '迎向熾熱橘黃新月 → 晨光降落聖保羅療養院花園的《鳶尾花》',
  },
  {
    id: 'irises', chapterId: 'cosmos', roman: 'X', shortZh: '鳶尾花', tinyZh: 'X 鳶尾花',
    titleZh: '鳶尾花', titleEn: 'Irises',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1889.05',
    portalZh: '穿過萬紫叢中孤傲盛開的純白鳶尾花 → 迎風展開《有絲柏的麥田》',
  },
  {
    id: 'wheat', chapterId: 'cosmos', roman: 'XI', shortZh: '絲柏麥田', tinyZh: 'XI 麥田',
    titleZh: '有絲柏的麥田', titleEn: 'Wheat Field with Cypresses',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1889.07',
    portalZh: '衝入松石綠晴空與翻滾白雲 → 凝結為春日盛開杏花',
  },
  {
    id: 'almond', chapterId: 'cosmos', roman: 'XII', shortZh: '盛開杏花', tinyZh: 'XII 杏花',
    titleZh: '盛開的杏花', titleEn: 'Almond Blossom',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1890.02',
    portalZh: '穿越飄落花雨與蔚藍晴空 → 北上奧維爾哥德教堂',
  },
  {
    id: 'church', chapterId: 'road', roman: 'XIII', shortZh: '奧維爾教堂', tinyZh: 'XIII 教堂',
    titleZh: '奧維爾的教堂', titleEn: 'The Church at Auvers',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers)', year: '1890.06',
    portalZh: '穿過鐘樓群青風暴 → 對視奧維爾知己《嘉舍醫師畫像》',
  },
  {
    id: 'gachet', chapterId: 'road', roman: 'XIV', shortZh: '嘉舍醫師', tinyZh: 'XIV 嘉舍',
    titleZh: '嘉舍醫師畫像', titleEn: 'Portrait of Dr. Gachet',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers)', year: '1890.06',
    portalZh: '穿過醫師憂鬱雙眸與背後翻湧的深藍漩渦 → 拉開 2:1 超寬銀幕《麥田群鴉》',
  },
  {
    id: 'crows', chapterId: 'road', roman: 'XV', shortZh: '麥田群鴉', tinyZh: 'XV 群鴉',
    titleZh: '麥田群鴉', titleEn: 'Wheatfield with Crows',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers)', year: '1890.07',
    portalZh: '穿過迎面驚飛的黑鴉群 → 落回最初的黑土與《食薯者》油燈',
  },
];

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

/** Self-contained overlay. Positions follow the input element's client rect (it need not be full-window). */
export class DirectorUI {
  readonly root: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly hud: HTMLDivElement;
  private readonly hudExtern: HTMLSpanElement;
  private readonly hudLine: HTMLSpanElement;
  private readonly ring: HTMLDivElement;
  private readonly suiteBar: HTMLDivElement;
  private readonly chapterBtns = new Map<PaintingId, HTMLButtonElement>();
  private readonly odysseyBtn: HTMLButtonElement;
  private readonly themeBtn: HTMLButtonElement;
  private readonly atlasBtn: HTMLButtonElement;
  private readonly soundBtn: HTMLButtonElement;
  private readonly pathBar: HTMLDivElement;
  private readonly pathBtns = new Map<string, HTMLButtonElement>();
  private readonly neighborsBox: HTMLDivElement;
  private readonly neighborsList: HTMLDivElement;
  private readonly atlasModal: HTMLDivElement;
  private readonly atlasDetail: HTMLDivElement;
  private readonly atlasNodes = new Map<PaintingId, HTMLButtonElement>();
  private readonly motifPills = new Map<MotifId | 'all', HTMLButtonElement>();
  private activeMotifFilter: MotifId | 'all' = 'all';
  private readonly card: HTMLDivElement;
  private readonly cardSub: HTMLDivElement;
  private readonly cardTitle: HTMLDivElement;
  private readonly cardPortal: HTMLDivElement;
  private readonly tlRoot: HTMLDivElement;
  private readonly tlShot: HTMLSpanElement;
  private readonly tlTime: HTMLSpanElement;
  private readonly tlTrack: HTMLDivElement;
  private readonly tlFill: HTMLDivElement;
  private readonly tlThumb: HTMLDivElement;
  private tlMarks: HTMLDivElement[] = [];
  private readonly tlActsRow: HTMLDivElement;
  private readonly tlActEls = new Map<PaintingId, HTMLDivElement>();
  private cardTimer: number | null = null;
  private hudText = '';
  private last = { hud: false, hint: -1, hudLine: '', ring: '', rect: '', tlPct: -1, tlShot: '', tlTime: '' };
  private onSelectPainting: ((id: PaintingId) => void) | null = null;
  private onSelectMode: ((mode: ViewMode, pathId?: string) => void) | null = null;
  private onToggleSound: (() => void) | null = null;
  private onSeek: ((fraction: number) => void) | null = null;
  private scrubbing = false;
  private currentActive: PaintingId = 'potato';
  private currentMode: ViewMode = 'odyssey';
  private currentPathId = 'odyssey';
  private currentSequence: readonly PaintingId[] = SUITE_ITEMS.map((x) => x.id);

  constructor(private readonly input: HTMLElement) {
    const doc = input.ownerDocument;
    if (!doc.getElementById(STYLE_ID)) {
      const st = doc.createElement('style');
      st.id = STYLE_ID;
      st.textContent = CSS;
      doc.head.appendChild(st);
    }
    if (!input.hasAttribute('tabindex')) input.tabIndex = 0;
    input.classList.add('pn-focusable');
    this.root = doc.createElement('div');
    this.root.className = 'pn-ui';

    // Top-center 15-World / 5-Chapter Suite Bar
    this.suiteBar = doc.createElement('div');
    this.suiteBar.className = 'pn-suite';
    this.suiteBar.style.display = 'none';
    for (const item of SUITE_ITEMS) {
      const ch = getChapterSpec(item.chapterId);
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'pn-suite-btn';
      const dot = doc.createElement('span');
      dot.className = 'pn-ch-dot';
      dot.style.background = ch.colorHex;
      const lbl = doc.createElement('span');
      lbl.textContent = `${item.roman}·${item.shortZh}`;
      btn.append(dot, lbl);
      btn.title = `${ch.roman} (${ch.nameZh}) · ${item.titleZh} (${item.titleEn}, ${item.year})\n任意門：${item.portalZh}`;
      btn.dataset.active = item.id === 'potato' ? '1' : '0';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelectPainting?.(item.id);
        this.input.focus();
      });
      this.chapterBtns.set(item.id, btn);
      this.suiteBar.appendChild(btn);
    }
    const sep = doc.createElement('div');
    sep.className = 'pn-suite-sep';

    this.odysseyBtn = doc.createElement('button');
    this.odysseyBtn.type = 'button';
    this.odysseyBtn.className = 'pn-odyssey-btn';
    this.odysseyBtn.textContent = '∞ 五章十五幕';
    this.odysseyBtn.title = '模式 A：五大章 15 幕完整長篇 Odyssey (快捷鍵 O)';
    this.odysseyBtn.dataset.on = '1';
    this.odysseyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelectMode?.('odyssey', 'odyssey');
      this.input.focus();
    });

    this.themeBtn = doc.createElement('button');
    this.themeBtn.type = 'button';
    this.themeBtn.className = 'pn-odyssey-btn';
    this.themeBtn.textContent = '⟁ 主題路徑';
    this.themeBtn.title = '模式 C：依六大母題編排主題路徑（光與夜 / 道路 / 居所 / 繁花 / 凝視 / 單幅循環）';
    this.themeBtn.dataset.on = '0';
    this.themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextPath = this.currentPathId === 'odyssey' ? 'nights' : this.currentPathId;
      this.onSelectMode?.('theme', nextPath);
      this.input.focus();
    });

    this.atlasBtn = doc.createElement('button');
    this.atlasBtn.type = 'button';
    this.atlasBtn.className = 'pn-odyssey-btn';
    this.atlasBtn.textContent = '🌌 宇宙星圖';
    this.atlasBtn.title = '模式 B：開啟梵谷世界系統星圖（五大章 · 六大母題 · 任意門鄰居探索，快捷鍵 U）';
    this.atlasBtn.dataset.on = '0';
    this.atlasBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentMode === 'atlas') {
        this.onSelectMode?.(this.currentPathId === 'odyssey' ? 'odyssey' : 'theme', this.currentPathId);
      } else {
        this.onSelectMode?.('atlas', this.currentPathId);
      }
      this.input.focus();
    });

    this.soundBtn = doc.createElement('button');
    this.soundBtn.type = 'button';
    this.soundBtn.className = 'pn-odyssey-btn';
    this.soundBtn.textContent = '♪ 聲景：開';
    this.soundBtn.title = '切換程序化空間聲景 / 靜音 (快捷鍵 V)';
    this.soundBtn.dataset.on = '1';
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onToggleSound?.();
      this.input.focus();
    });
    this.suiteBar.append(sep, this.odysseyBtn, this.themeBtn, this.atlasBtn, this.soundBtn);

    // Secondary Theme Path selector bar (Mode C)
    this.pathBar = doc.createElement('div');
    this.pathBar.className = 'pn-pathbar';
    const pathOptions: Array<{ id: string; label: string; title: string }> = [
      { id: 'nights', label: '✦ 光與夜之路 (6幕)', title: '食薯者油燈 → 向日葵花盤 → 夜間咖啡座 → 隆河星夜 → 聖雷米星夜 → 麥田群鴉' },
      { id: 'roads', label: '⟁ 道路與遠方 (6幕)', title: '一雙舊鞋 → 巴黎克利希大道 → 夜間咖啡座 → 隆河堤岸 → 奧維爾教堂 → 麥田三岔路' },
      { id: 'dwellings', label: '⌂ 居所與聖殿 (5幕)', title: '荷蘭農舍木桌 → 向日葵陶罐 → 街角咖啡座 → 亞爾黃色小屋臥室 → 奧維爾哥德教堂' },
      { id: 'flora', label: '❀ 黑土繁花與風 (6幕)', title: '食薯者馬鈴薯 → 亞爾向日葵 → 聖雷米鳶尾花 → 絲柏麥浪 → 盛開杏花 → 狂風麥田' },
      { id: 'gaze', label: '❖ 凝視與靈魂 (5幕)', title: '食薯者農民臉龐 → 戴草帽的自畫像 → 亞爾臥室百葉窗 → 嘉舍醫師憂鬱凝視 → 星夜渦流' },
      { id: 'single', label: '◎ 單幅沉浸循環 (1幕)', title: '鎖定當前畫作進行單幅 3D 空間深度巡禮' },
    ];
    for (const po of pathOptions) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pn-path-btn';
      b.textContent = po.label;
      b.title = po.title;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelectMode?.('theme', po.id);
        this.input.focus();
      });
      this.pathBtns.set(po.id, b);
      this.pathBar.appendChild(b);
    }

    // Bottom-right Connected Neighbor Portals box (World Graph quick jump)
    this.neighborsBox = doc.createElement('div');
    this.neighborsBox.className = 'pn-neighbors';
    this.neighborsBox.style.display = 'none';
    const nbHead = doc.createElement('div');
    nbHead.className = 'pn-nb-head';
    nbHead.innerHTML = '<span>✦ 相連任意門 (World Graph)</span>';
    this.neighborsList = doc.createElement('div');
    this.neighborsList.className = 'pn-nb-list';
    this.neighborsBox.append(nbHead, this.neighborsList);

    // Mode B: Interactive World Graph Atlas Modal
    this.atlasModal = doc.createElement('div');
    this.atlasModal.className = 'pn-atlas';
    const atlasTop = doc.createElement('div');
    atlasTop.className = 'pn-atlas-top';
    const atlasTitle = doc.createElement('div');
    atlasTitle.className = 'pn-atlas-title';
    atlasTitle.textContent = '🌌 梵谷世界系統 · 五大章與六大母題星圖 (Van Gogh World Graph)';
    const atlasClose = doc.createElement('button');
    atlasClose.type = 'button';
    atlasClose.className = 'pn-atlas-close';
    atlasClose.textContent = '返回畫作 (U / Esc)';
    atlasClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelectMode?.(this.currentPathId === 'odyssey' ? 'odyssey' : 'theme', this.currentPathId);
      this.input.focus();
    });
    atlasTop.append(atlasTitle, atlasClose);

    // 6 Motif filter bar inside Atlas
    const motifsBar = doc.createElement('div');
    motifsBar.className = 'pn-atlas-motifs';
    const allBtn = doc.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'pn-motif-pill';
    allBtn.textContent = '全部母題 (15幅)';
    allBtn.dataset.active = '1';
    allBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setMotifFilter('all');
    });
    this.motifPills.set('all', allBtn);
    motifsBar.appendChild(allBtn);

    for (const mKey of Object.keys(MOTIF_SPECS) as MotifId[]) {
      const ms = MOTIF_SPECS[mKey];
      const mb = doc.createElement('button');
      mb.type = 'button';
      mb.className = 'pn-motif-pill';
      mb.textContent = `${ms.icon} ${ms.nameZh}`;
      mb.title = ms.descZh;
      mb.dataset.active = '0';
      mb.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setMotifFilter(this.activeMotifFilter === mKey ? 'all' : mKey);
      });
      this.motifPills.set(mKey, mb);
      motifsBar.appendChild(mb);
    }

    // 5 Grand Chapters columns inside Atlas
    const chGrid = doc.createElement('div');
    chGrid.className = 'pn-atlas-chapters';
    for (const ch of CHAPTER_SPECS) {
      const col = doc.createElement('div');
      col.className = 'pn-ch-col';
      const head = doc.createElement('div');
      head.className = 'pn-ch-head';
      head.style.color = ch.colorHex;
      head.textContent = `${ch.roman} · ${ch.nameZh}`;
      const sub = doc.createElement('div');
      sub.className = 'pn-ch-sub';
      sub.textContent = `${ch.periodZh} (${ch.years})`;
      col.append(head, sub);

      const items = SUITE_ITEMS.filter((it) => it.chapterId === ch.id);
      for (const it of items) {
        const node = WORLD_GRAPH[it.id];
        const nb = doc.createElement('button');
        nb.type = 'button';
        nb.className = 'pn-ch-node';
        const titleDiv = doc.createElement('div');
        titleDiv.textContent = `${it.roman}. ${it.titleZh}`;
        const motifDiv = doc.createElement('div');
        motifDiv.className = 'pn-ch-node-motifs';
        motifDiv.textContent = node.motifs.map((m) => `${MOTIF_SPECS[m].icon}${MOTIF_SPECS[m].nameZh.slice(0, 1)}`).join(' · ');
        nb.append(titleDiv, motifDiv);
        nb.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onSelectPainting?.(it.id);
        });
        this.atlasNodes.set(it.id, nb);
        col.appendChild(nb);
      }
      chGrid.appendChild(col);
    }

    this.atlasDetail = doc.createElement('div');
    this.atlasDetail.className = 'pn-atlas-detail';
    this.atlasModal.append(atlasTop, motifsBar, chGrid, this.atlasDetail);

    // Bottom Scrubber Timeline Bar
    this.tlRoot = doc.createElement('div');
    this.tlRoot.className = 'pn-tl';
    const tlHead = doc.createElement('div');
    tlHead.className = 'pn-tl-head';
    this.tlShot = doc.createElement('span');
    this.tlShot.className = 'pn-tl-shot';
    this.tlTime = doc.createElement('span');
    this.tlTime.className = 'pn-tl-time';
    tlHead.append(this.tlShot, this.tlTime);

    this.tlTrack = doc.createElement('div');
    this.tlTrack.className = 'pn-tl-track';
    this.tlFill = doc.createElement('div');
    this.tlFill.className = 'pn-tl-fill';
    this.tlThumb = doc.createElement('div');
    this.tlThumb.className = 'pn-tl-thumb';
    this.tlTrack.append(this.tlFill, this.tlThumb);

    const seekFromEvent = (clientX: number) => {
      const rect = this.tlTrack.getBoundingClientRect();
      if (rect.width <= 0) return;
      const frac = Math.max(0, Math.min(0.9999, (clientX - rect.left) / rect.width));
      this.onSeek?.(frac);
    };
    this.tlTrack.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.scrubbing = true;
      this.tlTrack.setPointerCapture(e.pointerId);
      seekFromEvent(e.clientX);
    });
    this.tlTrack.addEventListener('pointermove', (e) => {
      if (!this.scrubbing) return;
      e.stopPropagation();
      seekFromEvent(e.clientX);
    });
    const endScrub = (e: PointerEvent) => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      try { this.tlTrack.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      this.input.focus();
    };
    this.tlTrack.addEventListener('pointerup', endScrub);
    this.tlTrack.addEventListener('pointercancel', endScrub);

    this.tlActsRow = doc.createElement('div');
    this.tlActsRow.className = 'pn-tl-acts';
    this.tlRoot.append(tlHead, this.tlTrack, this.tlActsRow);
    this.rebuildTimelineSequence(this.currentSequence);

    // Museum Chapter Title Card with Diegetic Portal description
    this.card = doc.createElement('div');
    this.card.className = 'pn-card';
    this.cardSub = doc.createElement('div');
    this.cardSub.className = 'pn-card-sub';
    this.cardTitle = doc.createElement('div');
    this.cardTitle.className = 'pn-card-title';
    this.cardPortal = doc.createElement('div');
    this.cardPortal.className = 'pn-card-portal';
    this.card.append(this.cardSub, this.cardTitle, this.cardPortal);

    this.hint = doc.createElement('div');
    this.hint.className = 'pn-hint';
    this.hint.setAttribute('role', 'status');
    this.hint.textContent = HINT_TEXT;
    this.hud = doc.createElement('div');
    this.hud.className = 'pn-hud';
    this.hud.setAttribute('aria-live', 'off');
    this.hudExtern = doc.createElement('span');
    this.hudLine = doc.createElement('span');
    this.hud.append(this.hudExtern, doc.createElement('br'), this.hudLine);
    this.ring = doc.createElement('div');
    this.ring.className = 'pn-ring';
    this.ring.setAttribute('aria-hidden', 'true');
    this.root.append(
      this.ring,
      this.suiteBar,
      this.pathBar,
      this.neighborsBox,
      this.atlasModal,
      this.card,
      this.tlRoot,
      this.hint,
      this.hud,
    );
    doc.body.appendChild(this.root);
  }

  private setMotifFilter(motif: MotifId | 'all'): void {
    this.activeMotifFilter = motif;
    for (const [k, btn] of this.motifPills) {
      btn.dataset.active = k === motif ? '1' : '0';
    }
    for (const [id, nodeBtn] of this.atlasNodes) {
      const g = WORLD_GRAPH[id];
      const match = motif === 'all' || g.motifs.includes(motif);
      nodeBtn.dataset.dim = match ? '0' : '1';
    }
  }

  private rebuildTimelineSequence(seq: readonly PaintingId[]): void {
    const doc = this.input.ownerDocument;
    for (const m of this.tlMarks) m.remove();
    this.tlMarks = [];
    this.tlActsRow.innerHTML = '';
    this.tlActEls.clear();

    if (seq.length <= 1) {
      this.tlActsRow.style.display = 'none';
      return;
    }
    this.tlActsRow.style.display = 'grid';
    this.tlActsRow.style.gridTemplateColumns = `repeat(${seq.length}, 1fr)`;
    for (let k = 1; k < seq.length; k++) {
      const m = doc.createElement('div');
      m.className = 'pn-tl-mark';
      m.style.left = `${(k * 100) / seq.length}%`;
      this.tlMarks.push(m);
      this.tlTrack.appendChild(m);
    }
    for (const id of seq) {
      const item = SUITE_ITEMS.find((x) => x.id === id);
      if (!item) continue;
      const a = doc.createElement('div');
      a.className = 'pn-tl-act';
      a.textContent = item.tinyZh;
      a.title = `${item.placeZh} · ${item.titleZh} (${item.year})`;
      a.dataset.active = id === this.currentActive ? '1' : '0';
      a.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelectPainting?.(item.id);
        this.input.focus();
      });
      this.tlActEls.set(item.id, a);
      this.tlActsRow.appendChild(a);
    }
  }

  private updateNeighborPortals(active: PaintingId): void {
    const doc = this.input.ownerDocument;
    const node = WORLD_GRAPH[active];
    this.neighborsList.innerHTML = '';
    for (const edge of node.neighbors) {
      const targetItem = SUITE_ITEMS.find((x) => x.id === edge.to);
      if (!targetItem) continue;
      const ms = MOTIF_SPECS[edge.motif];
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pn-nb-btn';
      b.textContent = `${ms.icon} → ${targetItem.roman}·${targetItem.shortZh}`;
      b.title = `[${ms.nameZh}] ${edge.reasonZh}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelectPainting?.(edge.to);
        this.input.focus();
      });
      this.neighborsList.appendChild(b);
    }

    // Also update the Atlas detail panel for the currently selected painting
    const item = SUITE_ITEMS.find((x) => x.id === active);
    if (!item) return;
    const ch = getChapterSpec(item.chapterId);
    this.atlasDetail.innerHTML = '';

    const r1 = doc.createElement('div');
    r1.className = 'pn-detail-row';
    r1.innerHTML = `<b>${ch.roman} · ${ch.nameZh} (${ch.periodZh})</b> — 《${item.titleZh}》 <i>${item.titleEn}</i> (${item.year}) · 情緒：${node.moodZh} · 光源：${node.lightTypeZh}`;

    const r2 = doc.createElement('div');
    r2.className = 'pn-detail-row';
    r2.innerHTML = `<b>筆觸與空間 DNA：</b>${ch.brushDnaZh} ｜ <b>章節意義：</b>${ch.storyRoleZh}`;

    const r3 = doc.createElement('div');
    r3.className = 'pn-detail-row';
    r3.innerHTML = `<b>入口任意門：</b>${node.portalIn.descZh} ｜ <b>出口任意門：</b>${node.portalOut.descZh}`;

    const r4 = doc.createElement('div');
    r4.className = 'pn-detail-row';
    r4.style.display = 'flex';
    r4.style.flexWrap = 'wrap';
    r4.style.alignItems = 'center';
    r4.style.gap = '6px';
    const lbl = doc.createElement('b');
    lbl.textContent = '推薦跨畫任意門躍遷：';
    r4.appendChild(lbl);
    for (const edge of node.neighbors) {
      const tItem = SUITE_ITEMS.find((x) => x.id === edge.to);
      if (!tItem) continue;
      const ms = MOTIF_SPECS[edge.motif];
      const eb = doc.createElement('button');
      eb.type = 'button';
      eb.className = 'pn-nb-btn';
      eb.textContent = `${ms.icon} 飛往《${tItem.titleZh}》：${edge.reasonZh}`;
      eb.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelectPainting?.(edge.to);
      });
      r4.appendChild(eb);
    }

    this.atlasDetail.append(r1, r2, r3, r4);
  }

  /** Wire the Van Gogh World System Suite Bar, Mode Switcher, and bottom Scrubber callbacks. */
  wireSuite(opts: {
    active: PaintingId;
    mode: ViewMode;
    pathId: string;
    sequence: readonly PaintingId[];
    soundEnabled?: boolean;
    showBar?: boolean;
    onSelect: (id: PaintingId) => void;
    onSelectMode: (mode: ViewMode, pathId?: string) => void;
    onToggleSound?: () => void;
    onSeek?: (fraction: number) => void;
  }): void {
    this.onSelectPainting = opts.onSelect;
    this.onSelectMode = opts.onSelectMode;
    this.onToggleSound = opts.onToggleSound ?? null;
    this.onSeek = opts.onSeek ?? null;
    const show = opts.showBar !== false;
    this.suiteBar.style.display = show ? 'flex' : 'none';
    this.tlRoot.style.display = show ? 'block' : 'none';
    this.neighborsBox.style.display = show ? 'flex' : 'none';
    this.setSoundState(opts.soundEnabled ?? true);
    this.setWorldState({
      active: opts.active,
      mode: opts.mode,
      pathId: opts.pathId,
      sequence: opts.sequence,
      showCard: true,
    });
  }

  /** Update the soundscape pill button label and highlight state. */
  setSoundState(enabled: boolean): void {
    this.soundBtn.dataset.on = enabled ? '1' : '0';
    this.soundBtn.textContent = enabled ? '♪ 聲景：開' : '♪ 聲景：靜音';
  }

  /** Update active painting, viewing mode (Odyssey / Theme / Atlas), active sequence, and optionally flash title card. */
  setWorldState(opts: {
    active: PaintingId;
    mode: ViewMode;
    pathId: string;
    sequence: readonly PaintingId[];
    showCard?: boolean;
  }): void {
    this.currentActive = opts.active;
    this.currentMode = opts.mode;
    this.currentPathId = opts.pathId;

    const seqChanged =
      opts.sequence.length !== this.currentSequence.length
      || opts.sequence.some((id, idx) => id !== this.currentSequence[idx]);
    if (seqChanged) {
      this.currentSequence = [...opts.sequence];
      this.rebuildTimelineSequence(this.currentSequence);
    }

    for (const [id, btn] of this.chapterBtns) {
      btn.dataset.active = id === opts.active ? '1' : '0';
      btn.dataset.inseq = this.currentSequence.includes(id) ? '1' : '0';
    }
    for (const [id, el] of this.tlActEls) {
      el.dataset.active = id === opts.active ? '1' : '0';
    }
    for (const [id, nodeBtn] of this.atlasNodes) {
      nodeBtn.dataset.active = id === opts.active ? '1' : '0';
    }

    this.odysseyBtn.dataset.on = opts.mode === 'odyssey' ? '1' : '0';
    this.themeBtn.dataset.on = opts.mode === 'theme' ? '1' : '0';
    this.atlasBtn.dataset.on = opts.mode === 'atlas' ? '1' : '0';

    const showBar = this.suiteBar.style.display !== 'none';
    this.pathBar.style.display = showBar && opts.mode === 'theme' ? 'flex' : 'none';
    this.atlasModal.style.display = showBar && opts.mode === 'atlas' ? 'block' : 'none';

    for (const [pid, b] of this.pathBtns) {
      b.dataset.active = pid === opts.pathId ? '1' : '0';
    }

    this.updateNeighborPortals(opts.active);

    if (opts.showCard) {
      const item = SUITE_ITEMS.find((x) => x.id === opts.active);
      if (item) {
        const pathSpec = THEME_PATHS.find((p) => p.id === opts.pathId);
        const modeTag = opts.mode === 'odyssey'
          ? '五章十五幕史詩'
          : opts.mode === 'theme' && pathSpec
            ? pathSpec.nameZh
            : '單幅世界巡禮';
        this.cardSub.textContent = `${item.placeZh} · ${item.year} · [${modeTag}]`;
        this.cardTitle.textContent = `Act ${item.roman} · ${item.titleZh}  (${item.titleEn})`;
        this.cardPortal.textContent = `✦ ${item.portalZh}`;
        this.card.style.opacity = '1';
        if (this.cardTimer !== null) window.clearTimeout(this.cardTimer);
        this.cardTimer = window.setTimeout(() => {
          this.card.style.opacity = '0';
        }, 3800);
      }
    }
  }

  /** Text from the integrator (fps, tier, render scale ...). Shown while the HUD is on. */
  setHudText(text: string): void {
    if (text === this.hudText) return;
    this.hudText = text;
    this.hudExtern.textContent = text;
  }

  render(s: UiState): void {
    const r = this.input.getBoundingClientRect();
    const rectKey = `${r.left}|${r.top}|${r.width}|${r.height}`;
    if (rectKey !== this.last.rect) {
      this.last.rect = rectKey;
      const st = this.root.style;
      st.left = `${r.left}px`;
      st.top = `${r.top}px`;
      st.width = `${r.width}px`;
      st.height = `${r.height}px`;
    }
    if (s.hud !== this.last.hud) {
      this.last.hud = s.hud;
      this.hud.style.display = s.hud ? 'block' : 'none';
    }
    if (s.hud && s.hudLine !== this.last.hudLine) {
      this.last.hudLine = s.hudLine;
      this.hudLine.textContent = s.hudLine;
    }
    const h = Math.round(s.hintOpacity * 100) / 100;
    if (h !== this.last.hint) {
      this.last.hint = h;
      this.hint.style.opacity = String(h);
      this.hint.style.visibility = h > 0 ? 'visible' : 'hidden';
    }
    if (s.loopTime !== undefined && s.loopSeconds !== undefined && s.loopSeconds > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((s.loopTime / s.loopSeconds) * 1000) / 10));
      if (pct !== this.last.tlPct) {
        this.last.tlPct = pct;
        this.tlFill.style.width = `${pct}%`;
        this.tlThumb.style.left = `${pct}%`;
      }
      const shotStr = s.shotName ?? '';
      if (shotStr !== this.last.tlShot) {
        this.last.tlShot = shotStr;
        this.tlShot.textContent = shotStr;
      }
      const timeStr = `${fmtTime(s.loopTime)} / ${fmtTime(s.loopSeconds)}`;
      if (timeStr !== this.last.tlTime) {
        this.last.tlTime = timeStr;
        this.tlTime.textContent = timeStr;
      }
    }
    const g = s.ring;
    const ringKey = g.visible ? `${g.x.toFixed(1)}|${g.y.toFixed(1)}|${g.r.toFixed(1)}|${g.opacity.toFixed(2)}` : 'off';
    if (ringKey !== this.last.ring) {
      this.last.ring = ringKey;
      const st = this.ring.style;
      if (!g.visible) st.display = 'none';
      else {
        const d = 2 * g.r;
        st.display = 'block';
        st.width = `${d}px`;
        st.height = `${d}px`;
        st.opacity = String(g.opacity);
        st.transform = `translate(${g.x - g.r}px, ${g.y - g.r}px)`;
      }
    }
  }

  dispose(): void {
    if (this.cardTimer !== null) window.clearTimeout(this.cardTimer);
    this.root.remove();
    this.input.classList.remove('pn-focusable');
  }
}

const tmpP = new Vector3();
/**
 * The free-mode alignment ring: E's projection on screen (E + 1000 F when the camera is within 1 m of E, where E's own
 * projection is unstable), radius growing with misalignment, hidden when align > 0.95. Off-screen or behind-camera
 * targets are pinned to the frame edge (16 px inset) at reduced opacity. Coordinates are CSS px in the input's rect.
 */
export function projectEyeRing(camera: PerspectiveCamera, widthPx: number, heightPx: number, align: number): RingState {
  const hidden: RingState = { x: 0, y: 0, r: 0, visible: false, opacity: 0 };
  if (align > 0.95 || widthPx <= 0 || heightPx <= 0) return hidden;
  const near = camera.position.distanceTo(EYE) < 1;
  if (near) tmpP.copy(EYE).addScaledVector(FORWARD, 1000);
  else tmpP.copy(EYE);
  tmpP.applyMatrix4(camera.matrixWorldInverse);
  const behind = tmpP.z > -1e-6;
  tmpP.applyMatrix4(camera.projectionMatrix);
  let nx = tmpP.x, ny = tmpP.y;
  if (behind) { nx = -nx; ny = -ny; }
  const r = 10 + 34 * Math.min(1, 1 - align);
  const inset = 16 + r;
  let x = (nx * 0.5 + 0.5) * widthPx;
  let y = (-ny * 0.5 + 0.5) * heightPx;
  let opacity = 0.9 * Math.min(1, (0.95 - align) / 0.1 + 0.15);
  const off = behind || x < inset || x > widthPx - inset || y < inset || y > heightPx - inset;
  if (off) {
    // pin to the edge along the direction from the centre
    const cx = widthPx / 2, cy = heightPx / 2;
    let dx = x - cx, dy = y - cy;
    if (behind && Math.abs(dx) + Math.abs(dy) < 1e-3) dy = heightPx; // straight behind: point down
    const sx = (cx - inset) / Math.max(Math.abs(dx), 1e-6);
    const sy = (cy - inset) / Math.max(Math.abs(dy), 1e-6);
    const s = Math.min(sx, sy);
    if (s < 1 || behind) { dx *= s; dy *= s; }
    x = cx + dx;
    y = cy + dy;
    opacity *= 0.55;
  }
  return { x, y, r, visible: true, opacity };
}
