// M7 harness: terrain, hills, village and steeple through the flat-quad preview (harness/lib/preview.ts) plus the
// land underlays rendered with MeshBasicMaterial. URL: ?view=pose|off|far|side|church|top &grid=0|1 &under=0
// &strokes=0 &emu=1 (far view: window pinpoints, emulating the min-pixel window size requested from M3) &seed=N
// &ridges=1 (crest lines of the three walls drawn at d = 50 m in front of E) &label=0
import * as THREE from 'three';
import { CLASS_INFO, StrokeClass, type StrokeRecord } from '../src/contracts';
import { canvasToWorld, EYE, groundHitDepth, strokeEndpoints, worldToCanvas } from '../src/shared/canvasSpace';
import { ridgeV } from '../src/shared/flowField';
import { forkRng } from '../src/shared/rng';
import { createLandUnderlays, generateGround, groveLayout, landFade } from '../src/earth/terrain';
import { generateHills, HILL_U_FULL, hillEndFade, hillFootV, hillPoint, LAND_STATS } from '../src/earth/hillsGen';
import { generateVillage, villageLayout } from '../src/earth/villageGen';
import { canvasGrid, classCounts, classDepthRanges, previewMesh, RecordingSink, setupPreview } from './lib/preview';

const qs = new URLSearchParams(location.search);
const view = qs.get('view') ?? 'pose';
const seed = Number(qs.get('seed') ?? 1);
const W = Number(qs.get('w') ?? innerWidth ?? 1280) || 1280;
const H = Number(qs.get('h') ?? innerHeight ?? 720) || 720;
const out = document.getElementById('out')!;
const lines: string[] = [];
const log = (s: string) => lines.push(s);
const fail: string[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
  if (!ok) {
    fail.push(name);
    console.error(`FAIL ${name}: ${detail}`);
  }
};

function generate(s: number) {
  for (const k of Object.keys(LAND_STATS)) delete LAND_STATS[k];
  const sink = new RecordingSink();
  const t0 = performance.now();
  generateGround(sink, forkRng(s, 'ground'));
  const t1 = performance.now();
  generateHills(sink, forkRng(s, 'hills'));
  const t2 = performance.now();
  const info = generateVillage(sink, forkRng(s, 'village'));
  const t3 = performance.now();
  return { sink, info, ms: { ground: t1 - t0, hills: t2 - t1, village: t3 - t2, total: t3 - t0 } };
}

// Optional: time the memoized layouts on their own before the first generator run.
let layoutMs = '';
if (qs.get('layouts') === '1') {
  const t0 = performance.now();
  hillFootV(0.5, 0);
  const t1 = performance.now();
  villageLayout();
  const t2 = performance.now();
  groveLayout();
  const t3 = performance.now();
  layoutMs = `foot table ${(t1 - t0).toFixed(1)} ms, village layout ${(t2 - t1).toFixed(1)} ms, grove layout ${(t3 - t2).toFixed(1)} ms`;
}
// Warm-up runs (layout memo + JIT), then the timed run (min of N), then a determinism re-run.
const runs = Number(qs.get('runs') ?? 4);
let best: ReturnType<typeof generate> | null = null;
let cold = 0;
let coldMs = '';
for (let i = 0; i < runs; i++) {
  const g = generate(seed);
  if (i === 0) {
    cold = g.ms.total;
    coldMs = `ground ${g.ms.ground.toFixed(1)}, hills ${g.ms.hills.toFixed(1)}, village ${g.ms.village.toFixed(1)}`;
  }
  if (i > 0 && (!best || g.ms.total < best.ms.total)) best = g;
}
const { sink, info, ms } = best ?? generate(seed);
const stats = JSON.parse(JSON.stringify(LAND_STATS));
const recs = sink.records;
const again = generate(seed).sink.records;
const hash = (rs: StrokeRecord[]) => {
  let h = 0;
  for (const r of rs) for (const v of [r.u, r.v, r.d, r.du, r.dv, r.w, r.colA, r.seed, r.q1]) h = (Math.imul(h ^ Math.round(v * 1e6), 16777619) >>> 0);
  return h;
};

// ---------------------------------------------------------------- checks
const counts = classCounts(recs);
const ranges = classDepthRanges(recs);
const budgets: [string, number][] = [['GROUND', 8000], ['GROVE', 6000], ['HILL', 16500], ['HOUSE', 14000], ['WINDOW', 400], ['CHURCH', 3600]];
for (const [k, b] of budgets) check(`count ${k}`, (counts[k] ?? 0) <= b && (counts[k] ?? 0) >= 0.97 * b, `${counts[k] ?? 0} / ${b}`);
for (const k of Object.keys(ranges)) {
  const cls = StrokeClass[k as keyof typeof StrokeClass];
  const [lo, hi] = CLASS_INFO[cls].dRange;
  const st = stats[k];
  check(`dRange ${k}`, ranges[k][0] >= lo && ranges[k][1] <= hi && st.dMin >= lo && st.dMax <= hi && st.rejected === 0,
    `centres ${ranges[k][0].toFixed(0)}-${ranges[k][1].toFixed(0)}, endpoints ${st.dMin.toFixed(0)}-${st.dMax.toFixed(0)} in [${lo}, ${hi}], dropped ${st.rejected}`);
}
check('deterministic', hash(recs) === hash(again) && recs.length === again.length, `${hash(recs).toString(16)} vs ${hash(again).toString(16)}`);
let badN = 0;
for (const r of recs) if (Math.abs(Math.hypot(r.q1, r.q2, r.q3) - 1) > 1e-6 || !Number.isFinite(r.u + r.v + r.d + r.du + r.dv + r.dlnd + r.w)) badN++;
check('unit normals + finite fields', badN === 0, `${badN} bad`);
check('generation time', ms.total <= 60, `warm ${ms.total.toFixed(1)} ms (ground ${ms.ground.toFixed(1)}, hills ${ms.hills.toFixed(1)}, village ${ms.village.toFixed(1)}); cold first run ${cold.toFixed(1)} ms (${coldMs})`);

const tip = new THREE.Vector3(27, 145, -678);
let tipHits = 0;
let tipErr = Infinity;
const A = new THREE.Vector3(), B = new THREE.Vector3();
for (const r of recs) {
  if (r.cls !== StrokeClass.CHURCH) continue;
  strokeEndpoints(r.u, r.v, r.d, r.du, r.dv, r.dlnd, A, B);
  const e = Math.min(A.distanceTo(tip), B.distanceTo(tip));
  tipErr = Math.min(tipErr, e);
  if (e < 1e-6) tipHits++;
}
check('steeple tip pinned', tipHits > 0 && info.steepleTip.distanceTo(tip) === 0, `${tipHits} strokes end at the tip (best err ${tipErr.toExponential(1)} m)`);
const tipC = worldToCanvas(tip);
check('steeple pierces rear ridge', tipC.v > ridgeV(tipC.u, 2) + 0.03, `tip (u ${tipC.u.toFixed(3)}, v ${tipC.v.toFixed(3)}) vs ridgeV(.,2) ${ridgeV(tipC.u, 2).toFixed(3)}`);
check('houses placed', info.houses.length === 40, `${info.houses.length}`);

// Island underlay: opaque over all ground seen from E and from the wide shots near E (u in [-1.05, 2.05], up to the
// foot of the front wall); the hill underlay front face opaque across HILL_U_FULL.
let islandMin = 1;
for (let uu = -1.05; uu <= 2.05; uu += 0.01) {
  for (let vv = -0.12; vv <= hillFootV(uu, 0); vv += 0.004) {
    const d = groundHitDepth(uu, vv);
    if (!Number.isFinite(d)) continue;
    const p = canvasToWorld(uu, vv, d);
    islandMin = Math.min(islandMin, landFade(p.x, p.z));
  }
}
check('island opaque under the E views', islandMin === 1, `min aFade ${islandMin.toFixed(4)} over u [-1.05, 2.05], v up to the front wall's foot`);
let wallMin = 1;
for (let uu = HILL_U_FULL[0]; uu <= HILL_U_FULL[1]; uu += 0.01) wallMin = Math.min(wallMin, hillEndFade(uu, 0, 0));
check('hill underlay opaque toward E', wallMin === 1, `min front aFade ${wallMin} over u [${HILL_U_FULL[0]}, ${HILL_U_FULL[1]}]`);

// Village canvas extent (house/window/church centres) and window spread per house.
let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
for (const r of recs) {
  if (r.cls !== StrokeClass.HOUSE && r.cls !== StrokeClass.WINDOW) continue;
  uMin = Math.min(uMin, r.u); uMax = Math.max(uMax, r.u); vMin = Math.min(vMin, r.v); vMax = Math.max(vMax, r.v);
}
log(`village canvas extent u ${uMin.toFixed(3)}-${uMax.toFixed(3)}, v ${vMin.toFixed(3)}-${vMax.toFixed(3)}`);
const winWalls = new Map<string, number>();
for (const r of recs) if (r.cls === StrokeClass.WINDOW) {
  const k = `${r.q1.toFixed(2)},${r.q3.toFixed(2)}`;
  winWalls.set(k, (winWalls.get(k) ?? 0) + 1);
}
log(`window wall orientations: ${winWalls.size} distinct normals (4 walls x 41 solids at most)`);
const crest = [0, 1, 2].map((k) => {
  let lo = Infinity, hi = -Infinity;
  for (let u = -0.3; u <= 1.3; u += 0.005) {
    const y = hillPoint(u, ridgeV(u, k), k).y;
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return `${lo.toFixed(0)}-${hi.toFixed(0)} m`;
});
if (layoutMs) log(`layouts (cold, before the first run): ${layoutMs}`);
log(`crest altitudes k=0/1/2: ${crest.join(' / ')}`);
log(`counts ${JSON.stringify(counts)}`);

// ---------------------------------------------------------------- scene
const pv = setupPreview(W, H);
// Emissive gain 0.4 (preview default 0.15) stands in for the bloom the real pipeline puts on the windows.
if (qs.get('strokes') !== '0') pv.scene.add(previewMesh(recs, 0, { emissiveGain: Number(qs.get('gain') ?? 0.4) }));
/** MeshBasicMaterial with the vertexFade dissolve (aFade vs a screen hash), standing in for M3's underlay material. */
function basicUnderlay(hex: number, o?: { vertexFade?: boolean }): THREE.Material {
  const m = new THREE.MeshBasicMaterial({ color: hex });
  if (!o?.vertexFade) return m;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vFade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('void main() {', 'void main() {\n  if (vFade <= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;');
  };
  m.customProgramCacheKey = () => 'land-fade';
  return m;
}
if (qs.get('under') !== '0') pv.scene.add(createLandUnderlays(basicUnderlay, info));
if (qs.get('emu') === '1') {
  const pts: number[] = [];
  for (const r of recs) if (r.cls === StrokeClass.WINDOW) {
    strokeEndpoints(r.u, r.v, r.d, r.du, r.dv, r.dlnd, A, B);
    A.add(B).multiplyScalar(0.5);
    pts.push(A.x, A.y, A.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  pv.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffc23a, size: 2.5, sizeAttenuation: false })));
}
if (qs.get('ridges') === '1') {
  const cols = [0xff4040, 0x40ff40, 0x40a0ff];
  for (let k = 0; k < 3; k++) {
    const p: number[] = [];
    for (let u = -0.3; u <= 1.3; u += 0.005) { const q = canvasToWorld(u, ridgeV(u, k), 50); p.push(q.x, q.y, q.z); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: cols[k], depthTest: false }));
    l.renderOrder = 999;
    pv.scene.add(l);
  }
}

const views: Record<string, () => void> = {
  pose: () => pv.pose(),
  off: () => pv.look({ x: -83, y: 108, z: -225 }, { x: 27, y: 0, z: -678 }, 56),
  far: () => pv.look({ x: -2501, y: 12196, z: -42537 }, EYE, 26),
  side: () => pv.look({ x: 2600, y: 1100, z: 300 }, { x: -200, y: 150, z: -3600 }, 50),
  church: () => pv.look({ x: -70, y: 70, z: -520 }, { x: 35, y: 55, z: -690 }, 42),
  top: () => pv.look({ x: 300, y: 2600, z: -900 }, { x: 300, y: 0, z: -1300 }, 60),
  village: () => pv.look({ x: 220, y: 160, z: -300 }, { x: 150, y: 0, z: -1100 }, 50),
};
(views[view] ?? views.pose)();
if (qs.get('grid') === '1' || (view === 'pose' && qs.get('grid') !== '0')) pv.scene.add(canvasGrid());
pv.render();
if (qs.get('label') !== '0') out.textContent = `M7 land  view=${view}  seed=${seed}  ${fail.length ? 'FAILS: ' + fail.join(', ') : 'all checks pass'}`;
console.log(lines.join('\n'));
(window as any).__report = { lines, fail, counts, ms, stats };
(window as any).__ready = true;
