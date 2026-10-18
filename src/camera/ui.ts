// M8 DOM overlay (§4.8) + Van Gogh World System UI:
// - Level 1: Single Painting World & Diegetic Portal Title Card
// - Level 2: Theme Paths Bar (Nights, Roads, Dwellings, Flora, Single Loop)
// - Level 3: 5 Grand Chapters (Earth -> Color -> Sun -> Cosmos -> Road, 30 Worlds)
// - 3 Viewing Modes: Odyssey (30-Act Film) / Theme Path (Motif Chains) / Atlas (Interactive World Graph & Neighbor Portals)
import { type PerspectiveCamera, Vector3 } from 'three';
import { EYE, FORWARD } from '../shared/canvasSpace';
import type { ChapterId, MotifId, PaintingId, ViewMode } from '../chapters/types';
import {
  CHAPTER_SPECS, MOTIF_SPECS, THEME_PATHS, WORLD_GRAPH, getChapterSpec,
} from '../chapters/worldGraph';

export const HINT_TEXT = '拖曳探索 3D 筆觸 · Space 歸位凝視點 E · P 暫停 · F 自由探索 · G 筆觸暴風 · [ ] 切換畫作 · O 單幅/史詩 · U 宇宙星圖';

const STYLE_ID = 'pn-director-ui-style';
const CSS = `
.pn-ui{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:20;overflow:hidden;
  font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans TC",sans-serif;color:#e8edf0;-webkit-user-select:none;user-select:none}
.pn-hint{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);max-width:calc(100% - 32px);box-sizing:border-box;
  padding:6px 14px;border-radius:999px;background:rgba(5,10,24,.68);box-shadow:0 0 0 1px rgba(242,194,48,.22);
  letter-spacing:.03em;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.8);
  opacity:0;transition:opacity .25s linear}
.pn-hud{position:absolute;left:10px;top:86px;max-width:calc(100% - 20px);box-sizing:border-box;padding:6px 9px;border-radius:6px;
  background:rgba(5,10,24,.68);box-shadow:0 0 0 1px rgba(232,237,240,.10);
  font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;white-space:pre-wrap;word-break:break-word;display:none}
.pn-hud b{color:#f2c230;font-weight:600}
.pn-ring{position:absolute;left:0;top:0;border-radius:50%;border:1.5px solid #f2c230;box-sizing:border-box;
  box-shadow:0 0 8px rgba(242,194,48,.6),inset 0 0 4px rgba(242,194,48,.35);display:none;will-change:transform;
  pointer-events:auto;cursor:pointer;transition:box-shadow .18s ease,border-color .18s ease}
.pn-ring:hover{border-color:#fff;box-shadow:0 0 16px rgba(242,194,48,.95),inset 0 0 8px rgba(242,194,48,.65)}
.pn-ring::after{content:"";position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;background:#f2c230}
.pn-suite{position:absolute;left:50%;top:10px;transform:translateX(-50%);pointer-events:auto;display:flex;align-items:center;gap:2px;
  padding:4px 6px;border-radius:999px;background:rgba(5,10,24,.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  box-shadow:0 4px 20px rgba(0,0,0,.45),0 0 0 1px rgba(232,237,240,.14);max-width:calc(100% - 14px);
  transition:opacity .35s ease}
.pn-suite-nav{appearance:none;border:0;background:rgba(232,237,240,.06);color:rgba(232,237,240,.75);width:20px;height:22px;border-radius:999px;
  font:600 12px/1 system-ui,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;
  transition:background .16s ease,color .16s ease}
.pn-suite-nav:hover{background:rgba(242,194,48,.22);color:#f5e27a}
.pn-suite-scroll{display:flex;align-items:center;gap:2px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;max-width:min(62vw,880px);scroll-behavior:smooth}
.pn-suite-scroll::-webkit-scrollbar{display:none}
.pn-suite-btn{appearance:none;border:0;background:transparent;color:rgba(232,237,240,.78);padding:4px 8px;border-radius:999px;
  font:500 11px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;letter-spacing:.01em;cursor:pointer;
  white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease,opacity .18s ease;display:flex;align-items:center;gap:4px;flex-shrink:0}
.pn-suite-btn:hover{color:#fff;background:rgba(232,237,240,.10)}
.pn-suite-btn[data-inseq="0"]{opacity:.48}
.pn-suite-btn[data-active="1"]{opacity:1;color:#f5e27a;background:rgba(242,194,48,.18);box-shadow:inset 0 0 0 1px rgba(242,194,48,.52)}
.pn-ch-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.pn-suite-sep{width:1px;height:14px;background:rgba(232,237,240,.16);margin:0 2px;flex-shrink:0}
.pn-odyssey-btn{appearance:none;border:0;background:rgba(232,237,240,.07);color:rgba(232,237,240,.74);padding:4px 8px;border-radius:999px;
  font:500 11px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;letter-spacing:.02em;cursor:pointer;
  white-space:nowrap;transition:background .18s ease,color .18s ease,box-shadow .18s ease;flex-shrink:0}
.pn-odyssey-btn:hover{color:#fff;background:rgba(232,237,240,.14)}
.pn-odyssey-btn[data-on="1"]{color:#f5e27a;background:rgba(242,194,48,.16);box-shadow:inset 0 0 0 1px rgba(242,194,48,.45)}
.pn-pathbar{position:absolute;left:50%;top:46px;transform:translateX(-50%);pointer-events:auto;display:none;align-items:center;gap:4px;
  padding:3px 7px;border-radius:999px;background:rgba(5,10,24,.74);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  box-shadow:0 4px 16px rgba(0,0,0,.4),0 0 0 1px rgba(242,194,48,.22);max-width:calc(100% - 16px);overflow-x:auto;
  transition:opacity .35s ease}
.pn-path-btn{appearance:none;border:0;background:transparent;color:rgba(232,237,240,.75);padding:3px 9px;border-radius:999px;
  font:500 11px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;cursor:pointer;white-space:nowrap;
  transition:background .16s ease,color .16s ease}
.pn-path-btn:hover{color:#fff;background:rgba(232,237,240,.1)}
.pn-path-btn[data-active="1"]{color:#f5e27a;background:rgba(242,194,48,.2);box-shadow:inset 0 0 0 1px rgba(242,194,48,.48)}
.pn-neighbors{position:absolute;right:14px;bottom:84px;pointer-events:auto;display:none;flex-direction:column;gap:4px;
  padding:7px 10px;border-radius:12px;background:rgba(5,10,24,.68);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
  box-shadow:0 4px 18px rgba(0,0,0,.42),0 0 0 1px rgba(232,237,240,.12);max-width:255px;transition:opacity .35s ease}
.pn-nb-head{font-size:10px;letter-spacing:.08em;color:rgba(242,194,48,.88);display:flex;justify-content:space-between;align-items:center}
.pn-nb-list{display:flex;flex-wrap:wrap;gap:4px}
.pn-nb-btn{appearance:none;border:0;background:rgba(232,237,240,.08);color:#e8edf0;padding:3px 8px;border-radius:999px;
  font:500 10.5px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;cursor:pointer;
  transition:background .16s ease,color .16s ease,box-shadow .16s ease;text-align:left}
.pn-nb-btn:hover{color:#f5e27a;background:rgba(242,194,48,.18);box-shadow:inset 0 0 0 1px rgba(242,194,48,.45)}
.pn-card{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);text-align:center;pointer-events:none;
  padding:10px 22px 11px;border-radius:14px;background:rgba(5,10,24,.68);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  box-shadow:0 8px 28px rgba(0,0,0,.48),0 0 0 1px rgba(242,194,48,.24);opacity:0;transition:opacity .45s ease;max-width:calc(100% - 28px)}
.pn-card-sub{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#f2c230;margin-bottom:3px;opacity:.92}
.pn-card-title{font-size:15px;font-weight:600;letter-spacing:.04em;color:#f4f7f9;text-shadow:0 1px 3px rgba(0,0,0,.85)}
.pn-card-portal{font-size:11.5px;color:rgba(245,226,122,.86);margin-top:4px;letter-spacing:.02em}
.pn-enter-odyssey{position:absolute;left:50%;bottom:78px;transform:translateX(-50%);pointer-events:auto;display:none;
  align-items:center;gap:8px;padding:8px 20px;border-radius:999px;border:0;
  background:rgba(5,10,24,.84);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  box-shadow:0 6px 26px rgba(0,0,0,.55),0 0 18px rgba(242,194,48,.38),inset 0 0 0 1.2px rgba(242,194,48,.72);
  color:#f5e27a;font:600 13px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;letter-spacing:.04em;
  cursor:pointer;white-space:nowrap;transition:transform .18s ease,background .18s ease,box-shadow .18s ease,bottom .3s ease;z-index:25}
.pn-enter-odyssey:hover{background:rgba(242,194,48,.24);color:#fff;transform:translateX(-50%) scale(1.03);
  box-shadow:0 8px 30px rgba(0,0,0,.65),0 0 24px rgba(242,194,48,.75),inset 0 0 0 1.5px #fff}
.pn-tl{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:min(900px,calc(100% - 20px));box-sizing:border-box;
  padding:7px 14px 8px;border-radius:14px;background:rgba(5,10,24,.74);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  box-shadow:0 4px 20px rgba(0,0,0,.45),0 0 0 1px rgba(232,237,240,.13);pointer-events:auto;display:none;
  transition:opacity .35s ease}
.pn-ui[data-clean-eye="1"] .pn-suite,
.pn-ui[data-clean-eye="1"] .pn-pathbar,
.pn-ui[data-clean-eye="1"] .pn-tl,
.pn-ui[data-clean-eye="1"] .pn-neighbors,
.pn-ui[data-clean-eye="1"] .pn-card,
.pn-ui[data-clean-eye="1"] .pn-beacon,
.pn-ui[data-clean-eye="1"] .pn-enter-odyssey{opacity:0 !important;pointer-events:none !important}
.pn-tl-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px;font-size:11.5px;letter-spacing:.02em;flex-wrap:wrap}
.pn-tl-shot{color:#f5e27a;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:44%}
.pn-tl-controls{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.pn-ctl-btn{appearance:none;border:0;background:rgba(232,237,240,.08);color:rgba(232,237,240,.84);padding:2px 8px;border-radius:999px;
  font:500 10.5px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;cursor:pointer;white-space:nowrap;
  transition:background .15s ease,color .15s ease,box-shadow .15s ease}
.pn-ctl-btn:hover{color:#fff;background:rgba(232,237,240,.16)}
.pn-ctl-btn[data-on="1"]{color:#f5e27a;background:rgba(242,194,48,.20);box-shadow:inset 0 0 0 1px rgba(242,194,48,.48)}
.pn-tl-time{color:rgba(232,237,240,.72);font:11px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;flex-shrink:0}
.pn-tl-track{position:relative;height:7px;border-radius:999px;background:rgba(232,237,240,.15);cursor:pointer;touch-action:none}
.pn-tl-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,#c8964e,#7eb8da,#f2c230,#5eb2bc,#d85e24);width:0%}
.pn-tl-thumb{position:absolute;top:50%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;background:#f5e27a;
  box-shadow:0 0 8px rgba(242,194,48,.85),0 0 0 1.5px #050a18;left:0%}
.pn-tl-mark{position:absolute;top:-1px;bottom:-1px;width:1px;background:rgba(5,10,24,.88);z-index:1}
.pn-tl-acts{display:grid;margin-top:4px;font-size:9.5px;color:rgba(232,237,240,.58)}
.pn-tl-act{text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 1px;cursor:pointer;transition:color .15s ease}
.pn-tl-act:hover{color:#fff}
.pn-tl-act[data-active="1"]{color:#f5e27a;font-weight:600;overflow:visible;position:relative;z-index:2}
.pn-atlas{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(980px,calc(100% - 24px));max-height:calc(100% - 104px);
  box-sizing:border-box;padding:15px 18px;border-radius:18px;background:rgba(5,10,24,.90);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  box-shadow:0 16px 48px rgba(0,0,0,.68),0 0 0 1px rgba(242,194,48,.32);pointer-events:auto;display:none;overflow-y:auto;z-index:30}
.pn-atlas-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid rgba(232,237,240,.12);padding-bottom:8px}
.pn-atlas-title{font-size:14.5px;font-weight:600;color:#f5e27a;letter-spacing:.04em}
.pn-atlas-close{appearance:none;border:0;background:rgba(232,237,240,.1);color:#e8edf0;padding:4px 10px;border-radius:999px;font-size:11px;cursor:pointer}
.pn-atlas-close:hover{background:rgba(242,194,48,.22);color:#f5e27a}
.pn-atlas-motifs{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;align-items:center}
.pn-motif-pill{appearance:none;border:0;background:rgba(232,237,240,.08);color:rgba(232,237,240,.82);padding:4px 10px;border-radius:999px;
  font:500 11px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;cursor:pointer;transition:all .16s ease}
.pn-motif-pill:hover{background:rgba(232,237,240,.16);color:#fff}
.pn-motif-pill[data-active="1"]{background:rgba(242,194,48,.22);color:#f5e27a;box-shadow:inset 0 0 0 1px rgba(242,194,48,.52)}
.pn-atlas-chapters{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:8px;margin-bottom:10px}
.pn-ch-col{padding:8px 9px;border-radius:12px;background:rgba(255,255,255,.03);box-shadow:inset 0 0 0 1px rgba(232,237,240,.09);max-height:42vh;overflow-y:auto;scrollbar-width:thin}
.pn-ch-head{font-size:10.5px;font-weight:600;letter-spacing:.06em;margin-bottom:2px}
.pn-ch-sub{font-size:9.5px;color:rgba(232,237,240,.6);margin-bottom:6px;line-height:1.3}
.pn-ch-node{display:block;width:100%;text-align:left;appearance:none;border:0;margin-bottom:4px;padding:5px 7px;border-radius:8px;
  background:rgba(232,237,240,.06);color:#e8edf0;font:500 10.5px/1.3 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;
  cursor:pointer;transition:all .16s ease}
.pn-ch-node:hover{background:rgba(242,194,48,.16);color:#f5e27a}
.pn-ch-node[data-active="1"]{background:rgba(242,194,48,.22);color:#f5e27a;box-shadow:inset 0 0 0 1px rgba(242,194,48,.58)}
.pn-ch-node[data-dim="1"]{opacity:.32}
.pn-ch-node-motifs{font-size:9px;color:rgba(232,237,240,.62);margin-top:2px}
.pn-atlas-detail{padding:10px 12px;border-radius:12px;background:rgba(242,194,48,.07);box-shadow:inset 0 0 0 1px rgba(242,194,48,.24);font-size:11.5px}
.pn-detail-row{margin-bottom:5px;color:rgba(232,237,240,.88)}
.pn-detail-row b{color:#f5e27a}
.pn-beacon{position:absolute;left:0;top:0;transform:translate(-50%,-50%);pointer-events:auto;display:none;
  align-items:center;gap:6px;padding:4px 11px 4px 7px;border-radius:999px;background:rgba(5,10,24,.74);
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 0 18px rgba(242,194,48,.48),0 0 0 1.2px rgba(242,194,48,.68);
  color:#f5e27a;font:500 11px/1.2 system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif;cursor:pointer;
  white-space:nowrap;will-change:transform,opacity;transition:background .18s ease,box-shadow .18s ease,color .18s ease}
.pn-beacon:hover{background:rgba(242,194,48,.24);color:#fff;box-shadow:0 0 24px rgba(242,194,48,.85),0 0 0 1.5px #f5e27a}
.pn-beacon-dot{width:9px;height:9px;border-radius:50%;background:radial-gradient(circle,#fff 15%,#f2c230 65%,rgba(242,194,48,0) 100%);
  box-shadow:0 0 8px #f2c230;flex-shrink:0}
.pn-focusable:focus{outline:none}
.pn-focusable:focus-visible{outline:2px solid #f2c230;outline-offset:-3px}
@media (max-width:720px){.pn-neighbors{display:none}.pn-tl-shot{max-width:100%}}
@media (prefers-reduced-motion:reduce){.pn-hint,.pn-card,.pn-suite,.pn-pathbar,.pn-tl,.pn-neighbors{transition:none}}
`;

export interface RingState { x: number; y: number; r: number; visible: boolean; opacity: number }
export interface PortalBeaconState {
  x: number;
  y: number;
  visible: boolean;
  opacity: number;
  label: string;
  targetId: PaintingId;
}
export type UiAction = 'pause' | 'freelock' | 'return' | 'storm' | 'warp' | 'singleToggle';
export interface ShotMarkerInfo {
  name: string;
  dur: number;
}
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
  shotIndex?: number;
  mode?: string;
  paused?: boolean;
  freeLocked?: boolean;
  warpK?: number;
  align?: number;
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
  // Chapter I — Earth (Nuenen & Antwerp)
  {
    id: 'potato', chapterId: 'earth', roman: 'I', shortZh: '食薯者', tinyZh: 'I 食薯者',
    titleZh: '食薯者', titleEn: 'The Potato Eaters',
    placeZh: 'Chapter I · 黑土與人 (荷蘭 Nuenen)', year: '1885.04',
    portalZh: '飛入中央懸掛油燈的暖金火芯 → 走入隔壁農舍《織布工》木機框',
  },
  {
    id: 'weaver', chapterId: 'earth', roman: 'II', shortZh: '織布工', tinyZh: 'II 織布工',
    titleZh: '織布工', titleEn: 'The Weaver',
    placeZh: 'Chapter I · 黑土與人 (荷蘭 Nuenen)', year: '1884.05',
    portalZh: '穿過右側農舍明窗光束 → 望見暮色中的《紐南的舊教堂塔樓》',
  },
  {
    id: 'tower', chapterId: 'earth', roman: 'III', shortZh: '舊教堂塔樓', tinyZh: 'III 舊塔樓',
    titleZh: '紐南的舊教堂塔樓', titleEn: 'The Old Church Tower at Nuenen',
    placeZh: 'Chapter I · 黑土與人 (荷蘭 Nuenen)', year: '1885.05',
    portalZh: '穿過鐘樓暮光與盤旋寒鴉 → 踏入安特衛普學院暗室《叼菸骷髏》',
  },
  {
    id: 'skull', chapterId: 'earth', roman: 'IV', shortZh: '叼菸骷髏', tinyZh: 'IV 骷髏',
    titleZh: '叼著點燃香菸的骷髏', titleEn: 'Skull of a Skeleton with Burning Cigarette',
    placeZh: 'Chapter I · 黑土與人 (安特衛普 Antwerp)', year: '1886.02',
    portalZh: '飛入香菸赤紅火燼與青煙漩渦 → 踏上巴黎《一雙舊鞋》遠行起點',
  },
  // Chapter II — Color (Paris & Montmartre)
  {
    id: 'shoes', chapterId: 'color', roman: 'V', shortZh: '一雙舊鞋', tinyZh: 'V 舊鞋',
    titleZh: '一雙舊鞋', titleEn: 'A Pair of Shoes',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)', year: '1886.09',
    portalZh: '順著蜿蜒鞋帶迎向金色門檻光束 → 登上巴黎《蒙馬特的煎餅磨坊》',
  },
  {
    id: 'galette', chapterId: 'color', roman: 'VI', shortZh: '煎餅磨坊', tinyZh: 'VI 磨坊',
    titleZh: '蒙馬特的煎餅磨坊', titleEn: 'Le Moulin de la Galette',
    placeZh: 'Chapter II · 巴黎與覺醒 (Montmartre)', year: '1886.10',
    portalZh: '順著蒙馬特山坡木欄杆走下山丘 → 步入點描光譜《克利希大道》',
  },
  {
    id: 'paris', chapterId: 'color', roman: 'VII', shortZh: '克利希大道', tinyZh: 'VII 巴黎',
    titleZh: '克利希大道', titleEn: 'Boulevard de Clichy',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)', year: '1887.03',
    portalZh: '穿過林蔭大道晨光向西漫步 → 抵達波光粼粼的《阿尼耶爾的塞納河與橋》',
  },
  {
    id: 'seine', chapterId: 'color', roman: 'VIII', shortZh: '塞納河與橋', tinyZh: 'VIII 塞納河',
    titleZh: '阿尼耶爾的塞納河與橋', titleEn: 'Bridges across the Seine at Asnières',
    placeZh: 'Chapter II · 巴黎與覺醒 (Asnières)', year: '1887.06',
    portalZh: '穿過蒸汽火車白煙與朱紅鐵橋拱 → 化為浮世繪《雨中大橋（仿廣重）》',
  },
  {
    id: 'plum', chapterId: 'color', roman: 'IX', shortZh: '雨中大橋', tinyZh: 'IX 雨中橋',
    titleZh: '雨中大橋（仿廣重）', titleEn: 'Bridge in the Rain (after Hiroshige)',
    placeZh: 'Chapter II · 巴黎與覺醒 (Japonisme)', year: '1887.10',
    portalZh: '穿過雨中紙傘與漢字邊框 → 成為《唐吉老爹肖像》背後的浮世繪牆',
  },
  {
    id: 'tanguy', chapterId: 'color', roman: 'X', shortZh: '唐吉老爹', tinyZh: 'X 唐吉',
    titleZh: '唐吉老爹肖像', titleEn: 'Portrait of Père Tanguy',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)', year: '1887.11',
    portalZh: '由唐吉老爹慈祥雙眼轉向畫架前 → 對視《戴草帽的自畫像》',
  },
  {
    id: 'selfportrait', chapterId: 'color', roman: 'XI', shortZh: '自畫像', tinyZh: 'XI 自畫像',
    titleZh: '戴草帽的自畫像', titleEn: 'Self-Portrait with Straw Hat',
    placeZh: 'Chapter II · 巴黎與覺醒 (Paris)', year: '1887.08',
    portalZh: '飛入畫家翠綠瞳孔與金黃草帽光環 → 沐浴亞爾《黃色小屋》的南方烈日',
  },
  // Chapter III — Sun (Arles)
  {
    id: 'yellowhouse', chapterId: 'sun', roman: 'XII', shortZh: '黃色小屋', tinyZh: 'XII 黃屋',
    titleZh: '黃色小屋（街景）', titleEn: 'The Yellow House (The Street)',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.09',
    portalZh: '推開二樓翠綠百葉窗走進室內 → 看見桌上迎賓的十五朵《向日葵》',
  },
  {
    id: 'sunflowers', chapterId: 'sun', roman: 'XIII', shortZh: '向日葵', tinyZh: 'XIII 向日葵',
    titleZh: '向日葵', titleEn: 'Sunflowers',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.08',
    portalZh: '穿過中央向日葵燃燒的金色花盤核心 → 飛向陽光普照的《克勞平原的豐收》',
  },
  {
    id: 'harvest', chapterId: 'sun', roman: 'XIV', shortZh: '克勞豐收', tinyZh: 'XIV 豐收',
    titleZh: '克勞平原的豐收', titleEn: 'The Harvest at La Crau',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.06',
    portalZh: '迎向阿爾皮耶山巔傾瀉的午後金光 → 步入《夕陽下的播種者》',
  },
  {
    id: 'sower', chapterId: 'sun', roman: 'XV', shortZh: '夕陽播種者', tinyZh: 'XV 播種者',
    titleZh: '夕陽下的播種者', titleEn: 'The Sower at Sunset',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.11',
    portalZh: '穿過碩大檸檬黃落日光輪 → 入夜點亮《夜間咖啡座》的瓦斯燈',
  },
  {
    id: 'cafe', chapterId: 'sun', roman: 'XVI', shortZh: '夜間咖啡座', tinyZh: 'XVI 咖啡座',
    titleZh: '夜間露天咖啡座', titleEn: 'Café Terrace at Night',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.09',
    portalZh: '走入街角咖啡館深處門廊 → 踏進血紅與翠綠對撞的《夜間咖啡館》室內',
  },
  {
    id: 'nightcafe', chapterId: 'sun', roman: 'XVII', shortZh: '夜間咖啡館', tinyZh: 'XVII 咖啡館',
    titleZh: '夜間咖啡館', titleEn: 'The Night Café',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.09',
    portalZh: '穿過天花板眩目的瓦斯燈光環走出夜街 → 迎見《隆河上的星夜》',
  },
  {
    id: 'rhone', chapterId: 'sun', roman: 'XVIII', shortZh: '隆河星夜', tinyZh: 'XVIII 隆河',
    titleZh: '隆河上的星夜', titleEn: 'Starry Night Over the Rhône',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.09',
    portalZh: '飛入對岸暖黃窗燈 → 走進亞爾黃色小屋臥室',
  },
  {
    id: 'bedroom', chapterId: 'sun', roman: 'XIX', shortZh: '亞爾臥室', tinyZh: 'XIX 臥室',
    titleZh: '在亞爾的臥室', titleEn: 'The Bedroom in Arles',
    placeZh: 'Chapter III · 亞爾的黃金時代 (Arles)', year: '1888.10',
    portalZh: '推開半掩的綠色百葉窗 → 飛入聖雷米星夜',
  },
  // Chapter IV — Cosmos (Saint-Rémy)
  {
    id: 'starry', chapterId: 'cosmos', roman: 'XX', shortZh: '星夜', tinyZh: 'XX 星夜',
    titleZh: '星夜', titleEn: 'The Starry Night',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1889.06',
    portalZh: '迎向熾熱橘黃新月 → 晨光降落聖保羅療養院花園的《鳶尾花》',
  },
  {
    id: 'irises', chapterId: 'cosmos', roman: 'XXI', shortZh: '鳶尾花', tinyZh: 'XXI 鳶尾花',
    titleZh: '鳶尾花', titleEn: 'Irises',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1889.05',
    portalZh: '穿過孤傲盛開的純白鳶尾花 → 走入金色斜陽下的《橄欖樹與太陽》',
  },
  {
    id: 'olive', chapterId: 'cosmos', roman: 'XXII', shortZh: '橄欖樹與日', tinyZh: 'XXII 橄欖樹',
    titleZh: '橄欖樹與黃色天空及太陽', titleEn: 'Olive Trees with Yellow Sky and Sun',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1889.11',
    portalZh: '穿過檸檬黃太陽的同心圓光波 → 迎風展開《有絲柏的麥田》',
  },
  {
    id: 'wheat', chapterId: 'cosmos', roman: 'XXIII', shortZh: '絲柏麥田', tinyZh: 'XXIII 麥田',
    titleZh: '有絲柏的麥田', titleEn: 'Wheat Field with Cypresses',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1889.07',
    portalZh: '順著麥田邊緣小徑步入暮色 → 仰望《有絲柏與星辰的道路》',
  },
  {
    id: 'roadcypress', chapterId: 'cosmos', roman: 'XXIV', shortZh: '絲柏星辰路', tinyZh: 'XXIV 絲柏路',
    titleZh: '有絲柏與星辰的道路', titleEn: 'Road with Cypress and Star',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1890.05',
    portalZh: '穿過絲柏尖端與新月光環 → 迎來象徵新生的春日《盛開的杏花》',
  },
  {
    id: 'almond', chapterId: 'cosmos', roman: 'XXV', shortZh: '盛開杏花', tinyZh: 'XXV 杏花',
    titleZh: '盛開的杏花', titleEn: 'Almond Blossom',
    placeZh: 'Chapter IV · 聖雷米的內在宇宙 (Saint-Rémy)', year: '1890.02',
    portalZh: '穿越飄落花雨與蔚藍晴空 → 北上抵達瓦茲河谷《奧維的茅草屋》',
  },
  // Chapter V — Road (Auvers-sur-Oise)
  {
    id: 'cottages', chapterId: 'road', roman: 'XXVI', shortZh: '奧維茅草屋', tinyZh: 'XXVI 茅草屋',
    titleZh: '奧維的茅草屋', titleEn: 'Thatched Cottages at Cordeville',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers)', year: '1890.05',
    portalZh: '順著茅草屋前的綠茵小徑前行 → 仰望《奧維的教堂》',
  },
  {
    id: 'church', chapterId: 'road', roman: 'XXVII', shortZh: '奧維爾教堂', tinyZh: 'XXVII 教堂',
    titleZh: '奧維爾的教堂', titleEn: 'The Church at Auvers',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers)', year: '1890.06',
    portalZh: '穿過鐘樓群青風暴 → 對視奧維爾知己《嘉舍醫師畫像》',
  },
  {
    id: 'gachet', chapterId: 'road', roman: 'XXVIII', shortZh: '嘉舍醫師', tinyZh: 'XXVIII 嘉舍',
    titleZh: '嘉舍醫師畫像', titleEn: 'Portrait of Dr. Gachet',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers)', year: '1890.06',
    portalZh: '順著紅桌上的毛地黃花枝走出診間 → 漫步 2:1 超寬全景《多比尼的花園》',
  },
  {
    id: 'daubigny', chapterId: 'road', roman: 'XXIX', shortZh: '多比尼花園', tinyZh: 'XXIX 花園',
    titleZh: '多比尼的花園', titleEn: "Daubigny's Garden",
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers)', year: '1890.07',
    portalZh: '飛越別墅屋頂與尖塔 → 衝入同為 2:1 超寬銀幕的終章《麥田群鴉》',
  },
  {
    id: 'crows', chapterId: 'road', roman: 'XXX', shortZh: '麥田群鴉', tinyZh: 'XXX 群鴉',
    titleZh: '麥田群鴉', titleEn: 'Wheatfield with Crows',
    placeZh: 'Chapter V · 奧維爾的路與風 (Auvers)', year: '1890.07',
    portalZh: '穿過迎面驚飛的黑鴉群 → 落回最初的黑土與《食薯者》油燈',
  },
];

const SUITE_ITEM_MAP: ReadonlyMap<PaintingId, SuiteItem> = new Map(
  SUITE_ITEMS.map((it) => [it.id, it]),
);

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
  private readonly suiteScroll: HTMLDivElement;
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
  private readonly tlControls: HTMLDivElement;
  private readonly playPauseBtn: HTMLButtonElement;
  private readonly modeToggleBtn: HTMLButtonElement;
  private readonly eyeBtn: HTMLButtonElement;
  private readonly stormBtn: HTMLButtonElement;
  private readonly warpBtn: HTMLButtonElement;
  private readonly singleLoopBtn: HTMLButtonElement;
  private readonly tlTime: HTMLSpanElement;
  private readonly tlTrack: HTMLDivElement;
  private readonly tlFill: HTMLDivElement;
  private readonly tlThumb: HTMLDivElement;
  private tlMarks: HTMLDivElement[] = [];
  private readonly tlActsRow: HTMLDivElement;
  private readonly tlActEls = new Map<PaintingId, HTMLDivElement>();
  private tlShotEls: HTMLDivElement[] = [];
  private readonly beaconBtn: HTMLButtonElement;
  private readonly beaconLbl: HTMLSpanElement;
  private readonly odysseyInviteBtn: HTMLButtonElement;
  private beaconTargetId: PaintingId = 'weaver';
  private cardTimer: number | null = null;
  private hudText = '';
  private lastUiActivityMs = 0;
  private completedFirstSingleLoop = false;
  private last = {
    hud: false,
    hint: -1,
    hudLine: '',
    ring: '',
    beacon: '',
    rect: '',
    tlPct: -1,
    tlShot: '',
    tlTime: '',
    ctlKey: '',
    shotIdx: -1,
    cleanEye: '',
    inviteVis: false,
  };
  private onSelectPainting: ((id: PaintingId) => void) | null = null;
  private onSelectMode: ((mode: ViewMode, pathId?: string) => void) | null = null;
  private onWeavePath: ((startId: PaintingId, motif?: MotifId) => void) | null = null;
  private onToggleSound: (() => void) | null = null;
  private onSeek: ((fraction: number) => void) | null = null;
  private onSelectShot: ((shotIndex: number) => void) | null = null;
  private onAction: ((action: UiAction) => void) | null = null;
  private scrubbing = false;
  private currentActive: PaintingId = 'starry';
  private currentMode: ViewMode = 'theme';
  private currentPathId = 'single';
  private currentSequence: readonly PaintingId[] = ['starry'];
  private currentShots: readonly ShotMarkerInfo[] = [];

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

    const markUiActivity = () => {
      this.lastUiActivityMs = performance.now();
      if (this.root.dataset.cleanEye === '1') {
        this.root.dataset.cleanEye = '0';
        this.last.cleanEye = '0';
      }
    };
    const win = doc.defaultView ?? window;
    win.addEventListener('pointermove', markUiActivity, { passive: true });
    win.addEventListener('pointerdown', markUiActivity, { passive: true });
    win.addEventListener('keydown', markUiActivity, { passive: true });
    win.addEventListener('wheel', markUiActivity, { passive: true });
    win.addEventListener('touchstart', markUiActivity, { passive: true });

    // Top-center 30-World / 5-Chapter Suite Bar with smooth horizontal scroll strip + nav buttons + pinned mode controls
    this.suiteBar = doc.createElement('div');
    this.suiteBar.className = 'pn-suite';
    this.suiteBar.style.display = 'none';

    const scrollLeftBtn = doc.createElement('button');
    scrollLeftBtn.type = 'button';
    scrollLeftBtn.className = 'pn-suite-nav';
    scrollLeftBtn.textContent = '‹';
    scrollLeftBtn.title = '向左捲動畫作列表';
    scrollLeftBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.suiteScroll.scrollBy({ left: -260, behavior: 'smooth' });
      this.input.focus();
    });

    const scrollRightBtn = doc.createElement('button');
    scrollRightBtn.type = 'button';
    scrollRightBtn.className = 'pn-suite-nav';
    scrollRightBtn.textContent = '›';
    scrollRightBtn.title = '向右捲動畫作列表';
    scrollRightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.suiteScroll.scrollBy({ left: 260, behavior: 'smooth' });
      this.input.focus();
    });

    this.suiteScroll = doc.createElement('div');
    this.suiteScroll.className = 'pn-suite-scroll';
    this.suiteScroll.addEventListener('wheel', (e) => {
      e.stopPropagation();
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        e.preventDefault();
        this.suiteScroll.scrollLeft += e.deltaY;
      }
    }, { passive: false });

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
      btn.dataset.active = item.id === 'starry' ? '1' : '0';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelectPainting?.(item.id);
        this.input.focus();
      });
      this.chapterBtns.set(item.id, btn);
      this.suiteScroll.appendChild(btn);
    }
    const sep = doc.createElement('div');
    sep.className = 'pn-suite-sep';

    this.odysseyBtn = doc.createElement('button');
    this.odysseyBtn.type = 'button';
    this.odysseyBtn.className = 'pn-odyssey-btn';
    this.odysseyBtn.textContent = '∞ 五章三十幕';
    this.odysseyBtn.title = '模式 A：五大章 30 幕完整長篇 Odyssey (快捷鍵 O 切換單幅/史詩)';
    this.odysseyBtn.dataset.on = '0';
    this.odysseyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelectMode?.('odyssey', 'odyssey');
      this.input.focus();
    });

    this.themeBtn = doc.createElement('button');
    this.themeBtn.type = 'button';
    this.themeBtn.className = 'pn-odyssey-btn';
    this.themeBtn.textContent = '⟁ 主題路徑';
    this.themeBtn.title = '模式 C：依六大母題編排主題路徑（光與夜 / 道路 / 居所 / 繁花 / 凝視 / 智能編織 / 單幅循環）';
    this.themeBtn.dataset.on = '0';
    this.themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextPath = this.currentPathId === 'odyssey' || this.currentPathId === 'single' ? 'nights' : this.currentPathId;
      this.onSelectMode?.('theme', nextPath);
      this.input.focus();
    });

    this.atlasBtn = doc.createElement('button');
    this.atlasBtn.type = 'button';
    this.atlasBtn.className = 'pn-odyssey-btn';
    this.atlasBtn.textContent = '🌌 宇宙星圖';
    this.atlasBtn.title = '模式 B：開啟梵谷世界系統星圖（五大章 · 30幅巨作 · 六大母題 · 任意門鄰居探索，快捷鍵 U）';
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
    this.soundBtn.textContent = '♪ 點擊開啟聲景';
    this.soundBtn.title = '切換程序化空間聲景 / 靜音 (快捷鍵 V)';
    this.soundBtn.dataset.on = '0';
    this.soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onToggleSound?.();
      this.input.focus();
    });
    this.suiteBar.append(scrollLeftBtn, this.suiteScroll, scrollRightBtn, sep, this.odysseyBtn, this.themeBtn, this.atlasBtn, this.soundBtn);

    // Secondary Theme Path selector bar (Mode C)
    this.pathBar = doc.createElement('div');
    this.pathBar.className = 'pn-pathbar';
    const pathOptions: Array<{ id: string; label: string; title: string }> = [
      { id: 'nights', label: '✦ 光與夜之路 (10幕)', title: '荷蘭油燈 → 香菸火燼 → 夕陽播種者 → 夜間咖啡座 → 午夜咖啡館 → 隆河星波 → 聖雷米星夜 → 橄欖樹烈日 → 絲柏夜路 → 麥田風暴' },
      { id: 'roads', label: '⟁ 道路與橋樑 (10幕)', title: '一雙舊鞋 → 蒙馬特磨坊 → 克利希大道 → 塞納河鐵橋 → 廣重雨中大橋 → 亞爾街角 → 隆河堤岸 → 絲柏夜路 → 奧維爾教堂 → 麥田三岔路' },
      { id: 'dwellings', label: '⌂ 居所與聖殿 (10幕)', title: '食薯者餐桌 → 紐南織布機 → 舊教堂塔樓 → 亞爾黃色小屋 → 向日葵 → 露天咖啡座 → 午夜咖啡館 → 亞爾臥室 → 奧維爾茅草屋 → 奧維爾教堂' },
      { id: 'flora', label: '❀ 黑土繁花與麥浪 (10幕)', title: '食薯者馬鈴薯 → 向日葵 → 克勞豐收平原 → 播種者 → 鳶尾花 → 橄欖樹林 → 絲柏麥浪 → 盛開杏花 → 多比尼花園 → 麥田群鴉' },
      { id: 'gaze', label: '❖ 凝視與靈魂 (8幕)', title: '食薯者農民 → 安特衛普叼菸骷髏 → 唐吉老爹與浮世繪 → 戴草帽的自畫像 → 午夜咖啡館 → 亞爾臥室百葉窗 → 嘉舍醫師 → 星夜渦流' },
      { id: 'woven', label: '✨ 智能編織 (6幕)', title: '從當前畫作與母題出發，沿世界圖譜任意門自動編織 6 幕連貫旅程' },
      { id: 'single', label: '◎ 單幅沉浸循環 (1幕)', title: '鎖定當前畫作進行單幅多鏡頭完整 3D 空間巡禮 (快捷鍵 O)' },
    ];
    for (const po of pathOptions) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pn-path-btn';
      b.textContent = po.label;
      b.title = po.title;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (po.id === 'woven' && this.onWeavePath) {
          this.onWeavePath(
            this.currentActive,
            this.activeMotifFilter === 'all' ? undefined : this.activeMotifFilter,
          );
        } else {
          this.onSelectMode?.('theme', po.id);
        }
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
    atlasTitle.textContent = '🌌 梵谷世界系統 · 五大章三十幅巨作與六大母題星圖 (Van Gogh 30-World Atlas)';
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
    allBtn.textContent = '全部母題 (30幅)';
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
          this.input.focus();
        });
        this.atlasNodes.set(it.id, nb);
        col.appendChild(nb);
      }
      chGrid.appendChild(col);
    }

    this.atlasDetail = doc.createElement('div');
    this.atlasDetail.className = 'pn-atlas-detail';
    this.atlasModal.append(atlasTop, motifsBar, chGrid, this.atlasDetail);

    // Bottom Scrubber Timeline Bar + Interactive Action Dock
    this.tlRoot = doc.createElement('div');
    this.tlRoot.className = 'pn-tl';
    const tlHead = doc.createElement('div');
    tlHead.className = 'pn-tl-head';
    this.tlShot = doc.createElement('span');
    this.tlShot.className = 'pn-tl-shot';

    this.tlControls = doc.createElement('div');
    this.tlControls.className = 'pn-tl-controls';

    const makeCtl = (label: string, title: string, act: UiAction): HTMLButtonElement => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'pn-ctl-btn';
      b.textContent = label;
      b.title = title;
      b.dataset.on = '0';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAction?.(act);
        this.input.focus();
      });
      return b;
    };

    this.playPauseBtn = makeCtl('⏸ 暫停', '暫停 / 繼續運鏡時間軸 (快捷鍵 P)', 'pause');
    this.modeToggleBtn = makeCtl('🕊️ 自由探索', '鎖定自由探索模式 / 返回電影運鏡 (快捷鍵 F / C，WASD+拖曳飛行，右鍵/Alt攪動星空)', 'freelock');
    this.eyeBtn = makeCtl('👁️ 歸位 E', '沿對數螺線飛回畫家唯一凝視點 E (快捷鍵 Space)', 'return');
    this.stormBtn = makeCtl('🌪️ 暴風', '觸發 3D 筆觸暴風漩渦解構與彈簧重組 (快捷鍵 G)', 'storm');
    this.warpBtn = makeCtl('🔭 景深 1.0×', '切換 250 km 非線性景深壓縮/深空延展 (或按住 Shift + 滾輪)', 'warp');
    this.singleLoopBtn = makeCtl('◎ 單幅巡禮', '在「單幅多鏡頭深度巡禮 (如星夜 96s 十鏡頭)」與「五章三十幕史詩」間切換 (快捷鍵 O)', 'singleToggle');

    this.tlControls.append(
      this.playPauseBtn,
      this.modeToggleBtn,
      this.eyeBtn,
      this.stormBtn,
      this.warpBtn,
      this.singleLoopBtn,
    );

    this.tlTime = doc.createElement('span');
    this.tlTime.className = 'pn-tl-time';
    tlHead.append(this.tlShot, this.tlControls, this.tlTime);

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
    this.rebuildTimelineSequence(this.currentSequence, this.currentShots);

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
    this.ring.title = '凝視點 E — 點擊或按 Space 飛回畫家視角';
    this.ring.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onAction?.('return');
      this.input.focus();
    });

    // In-Scene 3D Spatial Portal Beacon (projected onto the active painting's 3D portal)
    this.beaconBtn = doc.createElement('button');
    this.beaconBtn.type = 'button';
    this.beaconBtn.className = 'pn-beacon';
    const bDot = doc.createElement('span');
    bDot.className = 'pn-beacon-dot';
    this.beaconLbl = doc.createElement('span');
    this.beaconBtn.append(bDot, this.beaconLbl);
    this.beaconBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelectPainting?.(this.beaconTargetId);
      this.input.focus();
    });

    // End-of-loop invitation pill to enter the 30-World Odyssey after watching standalone Starry Night
    this.odysseyInviteBtn = doc.createElement('button');
    this.odysseyInviteBtn.type = 'button';
    this.odysseyInviteBtn.className = 'pn-enter-odyssey';
    this.odysseyInviteBtn.textContent = '✦ 進入梵谷 30 個世界 · 五章三十幕旅程';
    this.odysseyInviteBtn.title = '開啟五大章 30 幅梵谷立體世界長篇旅程 (快捷鍵 O)';
    this.odysseyInviteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelectMode?.('odyssey', 'odyssey');
      this.input.focus();
    });

    this.root.append(
      this.ring,
      this.beaconBtn,
      this.suiteBar,
      this.pathBar,
      this.neighborsBox,
      this.atlasModal,
      this.card,
      this.odysseyInviteBtn,
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

  private rebuildTimelineSequence(seq: readonly PaintingId[], shots: readonly ShotMarkerInfo[] = []): void {
    const doc = this.input.ownerDocument;
    for (const m of this.tlMarks) m.remove();
    this.tlMarks = [];
    this.tlActsRow.innerHTML = '';
    this.tlActEls.clear();
    this.tlShotEls = [];

    if (seq.length <= 1) {
      if (shots.length <= 1) {
        this.tlActsRow.style.display = 'none';
        return;
      }
      // Single-painting mode: render proportional clickable camera shot segments!
      const totalDur = shots.reduce((acc, s) => acc + s.dur, 0) || 1;
      this.tlActsRow.style.display = 'grid';
      this.tlActsRow.style.gridTemplateColumns = shots.map((s) => `${Math.max(1, s.dur)}fr`).join(' ');
      let accDur = 0;
      for (let i = 0; i < shots.length; i++) {
        if (i > 0) {
          const m = doc.createElement('div');
          m.className = 'pn-tl-mark';
          m.style.left = `${(accDur * 100) / totalDur}%`;
          this.tlMarks.push(m);
          this.tlTrack.appendChild(m);
        }
        accDur += shots[i].dur;
        const a = doc.createElement('div');
        a.className = 'pn-tl-act';
        const cleanName = shots[i].name.replace(/^Shot\s*\d+\s*·\s*/i, '');
        a.textContent = `${i + 1}·${cleanName}`;
        a.title = `點擊跳至鏡頭 ${i + 1}：${shots[i].name} (${shots[i].dur}s，快捷鍵 ${(i + 1) % 10})`;
        a.dataset.active = i === 0 ? '1' : '0';
        const shotIdx = i;
        a.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onSelectShot?.(shotIdx);
          this.input.focus();
        });
        this.tlShotEls.push(a);
        this.tlActsRow.appendChild(a);
      }
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
      const item = SUITE_ITEM_MAP.get(id);
      if (!item) continue;
      const a = doc.createElement('div');
      a.className = 'pn-tl-act';
      const isActive = id === this.currentActive;
      a.textContent = seq.length > 16 ? (isActive ? `${item.roman}·${item.shortZh}` : item.roman) : item.tinyZh;
      if (seq.length > 16) a.style.fontSize = isActive ? '9px' : '7.5px';
      a.title = `${item.roman} · ${item.placeZh} · 《${item.titleZh}》 (${item.year})`;
      a.dataset.active = isActive ? '1' : '0';
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
      const targetItem = SUITE_ITEM_MAP.get(edge.to);
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
    const item = SUITE_ITEM_MAP.get(active);
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

    const enterBtn = doc.createElement('button');
    enterBtn.type = 'button';
    enterBtn.className = 'pn-nb-btn';
    enterBtn.style.background = 'rgba(242,194,48,.22)';
    enterBtn.style.color = '#f5e27a';
    enterBtn.style.boxShadow = 'inset 0 0 0 1px rgba(242,194,48,.55)';
    enterBtn.textContent = `✦ 進入《${item.titleZh}》3D 世界`;
    enterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelectPainting?.(active);
      this.input.focus();
    });
    r4.appendChild(enterBtn);

    const lbl = doc.createElement('b');
    lbl.textContent = '推薦跨畫任意門躍遷：';
    r4.appendChild(lbl);
    for (const edge of node.neighbors) {
      const tItem = SUITE_ITEM_MAP.get(edge.to);
      if (!tItem) continue;
      const ms = MOTIF_SPECS[edge.motif];
      const eb = doc.createElement('button');
      eb.type = 'button';
      eb.className = 'pn-nb-btn';
      eb.textContent = `${ms.icon} 飛往《${tItem.titleZh}》：${edge.reasonZh}`;
      eb.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelectPainting?.(edge.to);
        this.input.focus();
      });
      r4.appendChild(eb);
    }
    const weaveBtn = doc.createElement('button');
    weaveBtn.type = 'button';
    weaveBtn.className = 'pn-nb-btn';
    weaveBtn.textContent = '✨ 從此畫智能編織 6 幕旅程';
    weaveBtn.title = '依當前畫作與選中母題，沿世界圖譜任意門自動編織 6 幕連貫旅程';
    weaveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onWeavePath?.(
        active,
        this.activeMotifFilter === 'all' ? undefined : this.activeMotifFilter,
      );
      this.input.focus();
    });
    r4.appendChild(weaveBtn);

    this.atlasDetail.append(r1, r2, r3, r4);
  }

  /** Wire the Van Gogh World System Suite Bar, Mode Switcher, and bottom Scrubber callbacks. */
  wireSuite(opts: {
    active: PaintingId;
    mode: ViewMode;
    pathId: string;
    sequence: readonly PaintingId[];
    shots?: readonly ShotMarkerInfo[];
    soundEnabled?: boolean;
    soundActive?: boolean;
    showBar?: boolean;
    onSelect: (id: PaintingId) => void;
    onSelectMode: (mode: ViewMode, pathId?: string) => void;
    onWeavePath?: (startId: PaintingId, motif?: MotifId) => void;
    onToggleSound?: () => void;
    onSeek?: (fraction: number) => void;
    onSelectShot?: (shotIndex: number) => void;
    onAction?: (action: UiAction) => void;
  }): void {
    this.onSelectPainting = opts.onSelect;
    this.onSelectMode = opts.onSelectMode;
    this.onWeavePath = opts.onWeavePath ?? null;
    this.onToggleSound = opts.onToggleSound ?? null;
    this.onSeek = opts.onSeek ?? null;
    this.onSelectShot = opts.onSelectShot ?? null;
    this.onAction = opts.onAction ?? null;
    const show = opts.showBar !== false;
    this.suiteBar.style.display = show ? 'flex' : 'none';
    this.tlRoot.style.display = show ? 'block' : 'none';
    this.neighborsBox.style.display = 'none';
    this.setSoundState(opts.soundEnabled ?? true, opts.soundActive ?? false);
    this.setWorldState({
      active: opts.active,
      mode: opts.mode,
      pathId: opts.pathId,
      sequence: opts.sequence,
      shots: opts.shots,
      showCard: true,
    });
  }

  /** Update the soundscape pill button label and highlight state (distinguishing enabled+pending unlock vs active). */
  setSoundState(enabled: boolean, active = false): void {
    if (!enabled) {
      this.soundBtn.dataset.on = '0';
      this.soundBtn.textContent = '♪ 聲景：靜音';
    } else if (!active) {
      this.soundBtn.dataset.on = '0';
      this.soundBtn.textContent = '♪ 點擊開啟聲景';
    } else {
      this.soundBtn.dataset.on = '1';
      this.soundBtn.textContent = '♪ 聲景：開';
    }
  }

  /** Update active painting, viewing mode (Odyssey / Theme / Atlas), active sequence, and optionally flash title card. */
  setWorldState(opts: {
    active: PaintingId;
    mode: ViewMode;
    pathId: string;
    sequence: readonly PaintingId[];
    shots?: readonly ShotMarkerInfo[];
    pathTitleZh?: string;
    showCard?: boolean;
  }): void {
    this.currentActive = opts.active;
    this.currentMode = opts.mode;
    this.currentPathId = opts.pathId;

    const nextShots = opts.shots ?? this.currentShots;
    const shotsChanged =
      nextShots.length !== this.currentShots.length
      || nextShots.some((s, idx) => s.name !== this.currentShots[idx]?.name || s.dur !== this.currentShots[idx]?.dur);
    const seqChanged =
      opts.sequence.length !== this.currentSequence.length
      || opts.sequence.some((id, idx) => id !== this.currentSequence[idx])
      || (opts.sequence.length <= 1 && shotsChanged);

    this.currentShots = nextShots;
    if (seqChanged) {
      this.currentSequence = [...opts.sequence];
      this.rebuildTimelineSequence(this.currentSequence, this.currentShots);
    }

    for (const [id, btn] of this.chapterBtns) {
      btn.dataset.active = id === opts.active ? '1' : '0';
      btn.dataset.inseq = this.currentSequence.includes(id) ? '1' : '0';
    }
    const activeBtn = this.chapterBtns.get(opts.active);
    if (activeBtn && this.suiteScroll.clientWidth > 0 && typeof this.suiteScroll.scrollTo === 'function') {
      const targetLeft = activeBtn.offsetLeft - this.suiteScroll.clientWidth * 0.5 + activeBtn.offsetWidth * 0.5;
      this.suiteScroll.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
    for (const [id, el] of this.tlActEls) {
      const isAct = id === opts.active;
      el.dataset.active = isAct ? '1' : '0';
      if (this.currentSequence.length > 16) {
        const it = SUITE_ITEM_MAP.get(id);
        if (it) {
          el.textContent = isAct ? `${it.roman}·${it.shortZh}` : it.roman;
          el.style.fontSize = isAct ? '9px' : '7.5px';
        }
      }
    }
    for (const [id, nodeBtn] of this.atlasNodes) {
      nodeBtn.dataset.active = id === opts.active ? '1' : '0';
    }

    const isSingle = opts.pathId === 'single';
    this.odysseyBtn.dataset.on = opts.mode === 'odyssey' ? '1' : '0';
    this.themeBtn.dataset.on = opts.mode === 'theme' && !isSingle ? '1' : '0';
    this.atlasBtn.dataset.on = opts.mode === 'atlas' ? '1' : '0';

    this.singleLoopBtn.dataset.on = isSingle ? '1' : '0';
    this.singleLoopBtn.textContent = isSingle ? '◎ 單幅循環中' : '◎ 單幅巡禮';

    const showBar = this.suiteBar.style.display !== 'none';
    this.pathBar.style.display = showBar && opts.mode === 'theme' && !isSingle ? 'flex' : 'none';
    this.atlasModal.style.display = showBar && opts.mode === 'atlas' ? 'block' : 'none';
    this.neighborsBox.style.display = showBar && opts.mode === 'theme' && !isSingle ? 'flex' : 'none';

    for (const [pid, b] of this.pathBtns) {
      b.dataset.active = pid === opts.pathId ? '1' : '0';
    }

    this.updateNeighborPortals(opts.active);

    if (opts.showCard) {
      const item = SUITE_ITEM_MAP.get(opts.active);
      if (item) {
        const pathSpec = THEME_PATHS.find((p) => p.id === opts.pathId);
        const modeTag = opts.pathTitleZh
          ? opts.pathTitleZh
          : opts.mode === 'odyssey'
            ? '五章三十幕史詩'
            : opts.mode === 'theme' && pathSpec
              ? pathSpec.nameZh
              : '單幅世界巡禮';
        this.cardSub.textContent = `${item.placeZh} · ${item.year} · [${modeTag}]`;
        this.cardTitle.textContent = `Act ${item.roman} · ${item.titleZh}  (${item.titleEn})`;
        this.cardPortal.textContent = `✦ ${item.portalZh}`;
        this.card.style.opacity = '1';
        if (this.cardTimer !== null) window.clearTimeout(this.cardTimer);
        // Long enough to outlast the opening hold at E, where clean-eye hides the card, so it is seen as the camera departs.
        this.cardTimer = window.setTimeout(() => {
          this.card.style.opacity = '0';
        }, 7000);
      }
    }
  }

  /** Update the floating 3D Spatial Portal Beacon projected onto the active painting's 3D portal. */
  updateBeacon(b: PortalBeaconState): void {
    const key = b.visible
      ? `${b.x.toFixed(1)}|${b.y.toFixed(1)}|${b.opacity.toFixed(2)}|${b.targetId}|${b.label}`
      : 'off';
    if (key === this.last.beacon) return;
    this.last.beacon = key;
    const st = this.beaconBtn.style;
    if (!b.visible || b.opacity <= 0.02) {
      st.display = 'none';
      return;
    }
    this.beaconTargetId = b.targetId;
    this.beaconLbl.textContent = b.label;
    st.display = 'flex';
    st.opacity = String(b.opacity);
    st.left = `${b.x.toFixed(1)}px`;
    st.top = `${b.y.toFixed(1)}px`;
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
    if (s.shotIndex !== undefined && s.shotIndex !== this.last.shotIdx && this.tlShotEls.length > 0) {
      this.last.shotIdx = s.shotIndex;
      for (let i = 0; i < this.tlShotEls.length; i++) {
        this.tlShotEls[i].dataset.active = i === s.shotIndex ? '1' : '0';
      }
    }
    const showBar = this.suiteBar.style.display !== 'none';
    const isSingle = this.currentPathId === 'single';
    if (showBar && s.loopTime !== undefined && s.loopSeconds !== undefined && s.loopSeconds > 0 && isSingle) {
      if (s.loopTime >= s.loopSeconds - 10) {
        this.completedFirstSingleLoop = true;
      }
    }
    const showInvite =
      showBar
      && isSingle
      && this.currentMode !== 'atlas'
      && (this.completedFirstSingleLoop || (s.loopTime !== undefined && s.loopSeconds !== undefined && s.loopTime >= s.loopSeconds - 12));
    if (showInvite !== this.last.inviteVis) {
      this.last.inviteVis = showInvite;
      this.odysseyInviteBtn.style.display = showInvite ? 'flex' : 'none';
    }

    const userRecentlyActive = performance.now() - this.lastUiActivityMs < 2400;
    const cleanEye = (s.align ?? 0) > 0.72 && this.currentMode !== 'atlas' && !s.paused && !userRecentlyActive ? '1' : '0';
    if (cleanEye !== this.last.cleanEye) {
      this.last.cleanEye = cleanEye;
      this.root.dataset.cleanEye = cleanEye;
    }

    const ctlKey = `${s.mode ?? ''}|${s.paused ? 1 : 0}|${s.freeLocked ? 1 : 0}|${(s.warpK ?? 1).toFixed(1)}`;
    if (ctlKey !== this.last.ctlKey) {
      this.last.ctlKey = ctlKey;
      const paused = !!s.paused;
      this.playPauseBtn.dataset.on = paused ? '1' : '0';
      this.playPauseBtn.textContent = paused ? '▶ 繼續' : '⏸ 暫停';

      const inFree = s.mode === 'free';
      this.modeToggleBtn.dataset.on = inFree ? '1' : '0';
      this.modeToggleBtn.textContent = s.freeLocked ? '🔒 自由飛行中' : inFree ? '🕊️ 自由探索中' : '🕊️ 自由探索';
      if (showBar && this.currentMode !== 'atlas') {
        this.neighborsBox.style.display = inFree || (this.currentMode === 'theme' && !isSingle) ? 'flex' : 'none';
      }

      const wk = s.warpK ?? 1;
      const warped = Math.abs(wk - 1) > 0.04;
      this.warpBtn.dataset.on = warped ? '1' : '0';
      this.warpBtn.textContent = wk === 0 ? '🔭 平面 0.0×' : `🔭 景深 ${wk.toFixed(1)}×`;
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

/**
 * Project a 3D world-space portal anchor onto screen CSS pixels for the interactive In-Scene 3D Spatial Portal Beacon.
 */
export function projectPortalBeacon(
  camera: PerspectiveCamera,
  widthPx: number,
  heightPx: number,
  portalWorld: Vector3,
  enabled: boolean,
  label: string,
  targetId: PaintingId,
  alphaMul = 1,
): PortalBeaconState {
  const hidden: PortalBeaconState = { x: 0, y: 0, visible: false, opacity: 0, label, targetId };
  if (!enabled || widthPx <= 0 || heightPx <= 0 || alphaMul <= 0.02) return hidden;
  tmpP.copy(portalWorld).applyMatrix4(camera.matrixWorldInverse);
  if (tmpP.z > -1e-3) return hidden; // behind camera
  tmpP.applyMatrix4(camera.projectionMatrix);
  const x = (tmpP.x * 0.5 + 0.5) * widthPx;
  const y = (-tmpP.y * 0.5 + 0.5) * heightPx;
  if (x < 64 || x > widthPx - 64 || y < 68 || y > heightPx - 96) return hidden;
  const radial = Math.hypot(tmpP.x, tmpP.y);
  const focusGain = Math.max(0.35, Math.min(1, 1.18 - 0.35 * radial));
  return {
    x,
    y,
    visible: true,
    opacity: Math.min(0.95, focusGain * alphaMul),
    label,
    targetId,
  };
}
