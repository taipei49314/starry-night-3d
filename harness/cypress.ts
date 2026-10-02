// M6 harness: the cypress through the preview renderer (harness/lib/preview.ts) plus the core lathe.
//   ?view=pose     canvas pose at E, canvas grid, CYPRESS_SIL overlay (green), stars + moon for context
//   ?view=helix    t = 25 helix-climb pose: camera (-83, 108, -225) looking at (-50, 138, -192), fov 56
//   ?view=burst    burst pose: camera (-45, 210, -235) looking at the Venus core, fov 78
//   ?view=side     from the left, level with mid-trunk (3D form of the tube bundle)
//   ?view=quad     helix + burst + side + top tiles (&tiles=a,b,c,d from POSES)
//   ?view=zoom&u=&v=&fov=  camera at E aimed at canvas (u, v)
//   &t=<s>         loop time (writhe)        &bg=<hex>  clear colour (e.g. ff00ff to expose see-through holes)
//   &core=0        hide the lathe core        &sky=0     hide stars and moon
//   &outline=1     tint OUTLINE-flagged strokes toward PALETTE.outline (stands in for the shader's edge darkening)
//   &under=0       drop UNDERLAYER strokes    &tm=1      colour x (1 + emissive) through Neutral tone mapping
//   &flat=1        use previewMesh (image-plane ribbons) instead of the camera-facing tapered ribbons
//   ?view=helixAt&ht=<20..30>  the shot-4 helix pose at loop time ht (spec §5 formula, no bank)
import * as THREE from 'three';
import {
  CANVAS_ASPECT, CLASS_INFO, CYPRESS_SIL, PALETTE, STARS, StrokeClass, StrokeFlag, type StrokeRecord,
} from '../src/contracts';
import { canvasToWorld, cypressSilhouette, EYE, worldToCanvas } from '../src/shared/canvasSpace';
import { mixHex } from '../src/shared/palette';
import { forkRng } from '../src/shared/rng';
import { generateMoon } from '../src/celestial/moonGen';
import { generateStars } from '../src/celestial/starsGen';
import { createCypressCore, CYPRESS_CORE_AXIS_D, CYPRESS_CORE_COLOR, generateCypress } from '../src/earth/cypressGen';
import { animate, canvasGrid, classDepthRanges, previewMesh, RecordingSink, setupPreview } from './lib/preview';
import { facingRibbons } from './cypressRibbons';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'pose';
const t = Number(q.get('t') ?? '0');
const W = Number(q.get('w') ?? '1280');
const H = Number(q.get('h') ?? '720');

const checks: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  checks.push({ name, ok, detail });
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
};

// ---------------------------------------------------------------- generate + checks
// Timing with a counting sink (RecordingSink's per-record copy is harness overhead, M3's StrokeBuffer packs typed
// arrays): first (cold JIT) and second run.
const countSink = { n: 0, push() { this.n++; }, get count() { return this.n; } };
let t0 = performance.now();
generateCypress(countSink, forkRng(1, 'cypress'));
const coldMs = performance.now() - t0;
t0 = performance.now();
generateCypress(countSink, forkRng(1, 'cypress'));
const genMs = performance.now() - t0;
const sink = new RecordingSink();
generateCypress(sink, forkRng(1, 'cypress'));
const recs = sink.records;
// determinism: same rng seed -> identical records
const again = new RecordingSink();
generateCypress(again, forkRng(1, 'cypress'));
check('deterministic', again.records.length === recs.length && again.records.every((r, i) => JSON.stringify(r) === JSON.stringify(recs[i])), `${recs.length} records`);

const nUnder = recs.filter((r) => r.flags & StrokeFlag.UNDERLAYER).length;
const nOutline = recs.filter((r) => r.flags & StrokeFlag.OUTLINE).length;
check('counts', recs.length === 19500 && nUnder === 1500 && recs.every((r) => r.cls === StrokeClass.CYPRESS), `CYPRESS ${recs.length} (underlayer ${nUnder}, outline ${nOutline})`);
const [dMin, dMax] = classDepthRanges(recs).CYPRESS;
const [r0, r1] = CLASS_INFO[StrokeClass.CYPRESS].dRange;
check('dRange CYPRESS', dMin >= r0 && dMax <= r1, `[${dMin.toFixed(1)}, ${dMax.toFixed(1)}] within [${r0}, ${r1}]`);
check('generation time', genMs < 20, `${genMs.toFixed(1)} ms warm, ${coldMs.toFixed(1)} ms cold (budget 20)`);
const tongues = new Set(recs.map((r) => r.q1));
check('tongues', tongues.size === 7 && [...tongues].every((x) => x >= 0 && x <= 6), `q1 values ${[...tongues].sort().join(',')}`);
const badOutline = recs.filter((r) => !(r.flags & StrokeFlag.UNDERLAYER) && ((Math.abs(Math.cos(r.q2)) > 0.85) !== !!(r.flags & StrokeFlag.OUTLINE))).length;
check('outline flag = |cos phi| > 0.85', badOutline === 0, `${badOutline} mismatches`);

/**
 * Row coverage of the strokes from E at loop time tt: per row (step 0.005 in v) a bitmap over u (step 0.001) of the
 * stroke footprints (spine samples +- 0.8 x half width: the shader's width profile tapers each stroke; x3 for
 * underlayers). Used for the outline checks below.
 */
const ROW_STEP = 0.005, U_STEP = 0.001, U0 = -0.05, NU = 400;
function rowCoverage(tt: number): Map<number, Uint8Array> {
  const rows = new Map<number, Uint8Array>();
  for (const r of recs) {
    const a = animate(r, tt);
    const hw = (0.4 * r.w * (r.flags & StrokeFlag.UNDERLAYER ? 3 : 1)) / CANVAS_ASPECT;
    for (let s = 0; s <= 8; s++) {
      const f = s / 8 - 0.5;
      const u = a.u + (f * a.du) / CANVAS_ASPECT;
      const v = a.v + f * a.dv;
      const k = Math.round(v / ROW_STEP);
      let row = rows.get(k);
      if (!row) rows.set(k, (row = new Uint8Array(NU)));
      const i0 = Math.max(0, Math.floor((u - hw - U0) / U_STEP)), i1 = Math.min(NU - 1, Math.ceil((u + hw - U0) / U_STEP));
      for (let i = i0; i <= i1; i++) row[i] = 1;
    }
  }
  return rows;
}
/** Covered runs of a row as [uStart, uEnd] (u-fractions), ignoring runs and gaps narrower than 0.003. */
function runs(row: Uint8Array): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  while (i < NU) {
    if (!row[i]) { i++; continue; }
    let j = i;
    // bridge gaps of up to 2 bins (sub-pixel cracks between strokes)
    for (;;) {
      if (j + 1 < NU && row[j + 1]) j++;
      else if (j + 2 < NU && row[j + 2]) j += 2;
      else if (j + 3 < NU && row[j + 3]) j += 3;
      else break;
    }
    if ((j - i) * U_STEP >= 0.003) out.push([U0 + i * U_STEP, U0 + j * U_STEP]);
    i = j + 1;
  }
  return out;
}
/**
 * Outline checks (the cypress is a ragged black flame, not the smooth CYPRESS_SIL lens):
 *  - trunk fill (v in [-0.1, 0.75]): one covered run per row reaching to within 0.01 of the table on both sides
 *  - protrusion (v in [-0.1, 1.0]): licks reach at most 0.025 beyond the table
 *  - crown: at v = 0.86..0.92 the top is split into three flames (>= 3 runs on most rows)
 */
function outlineCheck(tt: number) {
  const rows = rowCoverage(tt);
  let fillWorst = 0, fillV = 0, fillSide = '';
  let protWorst = 0, protV = 0;
  let protSumL = 0, protSumR = 0, nTrunk = 0;
  for (let k = Math.round(-0.1 / ROW_STEP); k <= Math.round(1.0 / ROW_STEP); k++) {
    const v = k * ROW_STEP;
    const [uL, uR] = cypressSilhouette(v);
    const row = rows.get(k);
    if (!row) { fillWorst = Infinity; fillV = v; fillSide = 'missing'; continue; }
    const rr = runs(row);
    const lo = rr.length ? rr[0][0] : Infinity, hi = rr.length ? rr[rr.length - 1][1] : -Infinity;
    const prot = Math.max(uL - lo, hi - uR);
    if (prot > protWorst) { protWorst = prot; protV = v; }
    if (v <= 0.75) {
      // the run that contains the trunk centre must reach the table edges (within 0.01)
      const mid = 0.5 * (uL + uR);
      const body = rr.find((x) => x[0] <= mid && x[1] >= mid);
      const dl = body ? body[0] - uL : Infinity, dr = body ? uR - body[1] : Infinity;
      protSumL += uL - lo; protSumR += hi - uR; nTrunk++;
      if (dl > fillWorst) { fillWorst = dl; fillV = v; fillSide = `left ${dl.toFixed(4)} inside`; }
      if (dr > fillWorst) { fillWorst = dr; fillV = v; fillSide = `right ${dr.toFixed(4)} inside`; }
    }
  }
  let split = 0, splitRows = 0;
  for (let k = Math.round(0.86 / ROW_STEP); k <= Math.round(0.92 / ROW_STEP); k++) {
    splitRows++;
    if (runs(rows.get(k) ?? new Uint8Array(NU)).length >= 3) split++;
  }
  const crown = [0.82, 0.84, 0.86, 0.88, 0.9, 0.92, 0.94, 0.96].map((v) => `${v}:${runs(rows.get(Math.round(v / ROW_STEP)) ?? new Uint8Array(NU)).map((x) => x.map((y) => y.toFixed(3)).join('-')).join(',')}`);
  return { fillWorst, fillV, fillSide, protWorst, protV, meanProtL: protSumL / nTrunk, meanProtR: protSumR / nTrunk, split, splitRows, crown };
}
for (const tt of [0, 1.5, 3, 4.5]) {
  const e = outlineCheck(tt);
  check(`outline t=${tt}`, e.fillWorst <= 0.01 && e.protWorst <= 0.025 && e.split >= 0.6 * e.splitRows,
    `trunk fill: worst ${e.fillWorst.toFixed(4)} at v=${e.fillV.toFixed(3)} (${e.fillSide}); licks: max ${e.protWorst.toFixed(4)} beyond the table at v=${e.protV.toFixed(3)}, mean L ${e.meanProtL.toFixed(4)} R ${e.meanProtR.toFixed(4)}; crown split into >= 3 flames on ${e.split}/${e.splitRows} rows (v 0.86..0.92)`);
}
// right edge just left of Venus: Venus core spans u = 0.300 +- rho/A; its ring 0 starts at 0.3 - 0.016/A = 0.287
const venusLeft = STARS[0].u - STARS[0].rhoCore / CANVAS_ASPECT;
let rightAtVenus = -Infinity;
for (const r of recs) {
  if (Math.abs(r.v - STARS[0].v) < 0.01) rightAtVenus = Math.max(rightAtVenus, r.u + Math.abs(r.du) / (2 * CANVAS_ASPECT) + r.w / (2 * CANVAS_ASPECT));
}
check('right edge left of Venus', rightAtVenus < STARS[0].u, `cypress right edge at v=0.72: u=${rightAtVenus.toFixed(4)}; Venus centre 0.300, core edge ${venusLeft.toFixed(4)}`);

// core lathe: outward normals (FrontSide-safe), closed top at the canvas top edge, base inside the knoll
{
  const core = createCypressCore(new THREE.MeshBasicMaterial());
  const pos = core.geometry.getAttribute('position'), nrm = core.geometry.getAttribute('normal');
  let outward = 0, total = 0, yMin = Infinity, yMax = -Infinity;
  const P0 = new THREE.Vector3(), N0 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    P0.fromBufferAttribute(pos, i);
    yMin = Math.min(yMin, P0.y); yMax = Math.max(yMax, P0.y);
    const c = worldToCanvas(P0);
    if (c.v < 0 || c.v > 0.6) continue;
    const [uL, uR] = cypressSilhouette(c.v);
    const axis = canvasToWorld(0.5 * (uL + uR), c.v, CYPRESS_CORE_AXIS_D);
    N0.fromBufferAttribute(nrm, i);
    total++;
    if (N0.dot(P0.clone().sub(axis)) > 0) outward++;
  }
  const tris = (core.geometry.index?.count ?? 0) / 3;
  check('core lathe', outward / total > 0.98 && core.geometry.boundingSphere !== null, `${pos.count} verts, ${tris} tris, outward normals ${(100 * outward / total).toFixed(1)} %, y ${yMin.toFixed(1)}..${yMax.toFixed(1)} m`);
}

// ---------------------------------------------------------------- scene
const P = setupPreview(W, H);
const bg = q.get('bg');
if (bg) P.renderer.setClearColor(parseInt(bg, 16));
const tm = q.get('tm') === '1';
if (tm) P.renderer.toneMapping = THREE.NeutralToneMapping;

let shown: StrokeRecord[] = q.get('under') === '0' ? recs.filter((r) => !(r.flags & StrokeFlag.UNDERLAYER)) : recs;
if (q.get('outline') === '1') {
  shown = shown.map((r) => (r.flags & StrokeFlag.OUTLINE ? { ...r, colA: mixHex(r.colA, PALETTE.outline, 0.45), colB: mixHex(r.colB, PALETTE.outline, 0.45) } : r));
}
const showSky = q.get('sky') !== '0';
if (showSky) {
  const sky = new RecordingSink();
  generateStars(sky, forkRng(1, 'stars'));
  generateMoon(sky, forkRng(1, 'moon'));
  shown = shown.concat(sky.records);
}
const gain = tm ? 1 : 0.15;
let strokeMesh: THREE.Mesh | null = null;
/** (Re)build the stroke mesh for a camera position: camera-facing ribbons unless &flat=1. */
function strokesFor(cam: THREE.Vector3) {
  if (strokeMesh) { P.scene.remove(strokeMesh); strokeMesh.geometry.dispose(); }
  strokeMesh = q.get('flat') === '1' ? previewMesh(shown, t, { emissiveGain: gain }) : facingRibbons(shown, t, cam, { emissiveGain: gain });
  P.scene.add(strokeMesh);
}
if (q.get('core') !== '0') P.scene.add(createCypressCore(new THREE.MeshBasicMaterial({ color: CYPRESS_CORE_COLOR })));

function silOverlay(): THREE.LineSegments {
  const pts: number[] = [];
  const seg = (u0: number, v0: number, u1: number, v1: number) => {
    const A = canvasToWorld(u0, v0, 50), B = canvasToWorld(u1, v1, 50);
    pts.push(A.x, A.y, A.z, B.x, B.y, B.z);
  };
  for (let i = 0; i < CYPRESS_SIL.length - 1; i++) {
    const [va, la, ra] = CYPRESS_SIL[i], [vb, lb, rb] = CYPRESS_SIL[i + 1];
    seg(la, va, lb, vb);
    seg(ra, va, rb, vb);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x40ff60, depthTest: false, transparent: true, opacity: 0.9 }));
  l.renderOrder = 1001;
  return l;
}

function label(text: string, x: number, y: number) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:absolute;left:${x + 6}px;top:${y + 4}px;color:#fff;background:rgba(0,0,0,.45);padding:1px 4px;font:12px monospace`;
  document.body.appendChild(el);
}

const venus = canvasToWorld(STARS[0].u, STARS[0].v, STARS[0].dCore);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const POSES: Record<string, { pos: THREE.Vector3; target: THREE.Vector3; fov: number; name: string }> = {
  helix: { pos: V(-83, 108, -225), target: V(-50, 138, -192), fov: 56, name: 'helix climb (t~25)' },
  burst: { pos: V(-45, 210, -235), target: venus, fov: 78, name: 'burst (t~32)' },
  side: { pos: V(-330, 95, -150), target: V(-50, 85, -195), fov: 40, name: 'side, from the left' },
  top: { pos: V(-40, 330, -150), target: V(-50, 120, -195), fov: 50, name: 'from above-front' },
  low: { pos: V(-60, 30, -120), target: V(-50, 100, -192), fov: 70, name: 'from the knoll, looking up' },
  burst0: { pos: V(-26, 175, -192), target: venus, fov: 60, name: 'burst start (t=30)' },
  tipside: { pos: V(-140, 150, -170), target: V(-50, 145, -185), fov: 45, name: 'flame tips from the left' },
  tipdown: { pos: V(-20, 215, -140), target: V(-50, 150, -188), fov: 60, name: 'flame tips from above-front' },
};
/** Shot 4 helix (§5.1): tau = smootherstep((t-20)/10), r = 70 - 46 tau, theta = 450 deg tau, y = 40 + 135 tau. */
function helixPose(ht: number) {
  const x = Math.min(1, Math.max(0, (ht - 20) / 10));
  const tau = x * x * x * (x * (x * 6 - 15) + 10);
  const r = 70 - 46 * tau, th = (450 * Math.PI / 180) * tau, y = 40 + 135 * tau;
  const pos = V(-50 + r * Math.sin(th), y, -192 + r * Math.cos(th));
  const axis = V(-50, y + 30, -192);
  const k = tau < 0.75 ? 0 : (tau - 0.75) / 0.25;
  const dir = axis.clone().sub(pos).normalize().lerp(venus.clone().sub(pos).normalize(), k).normalize();
  return { pos, target: pos.clone().addScaledVector(dir, 100), fov: 54 + 6 * tau, name: `helix t=${ht} (tau ${tau.toFixed(2)})` };
}
for (const ht of [21, 23, 25, 27, 29]) POSES[`h${ht}`] = helixPose(ht);

if (view === 'pose') {
  P.pose();
  strokesFor(EYE);
  if (q.get('grid') !== '0') {
    P.scene.add(canvasGrid());
    P.scene.add(silOverlay());
  }
  P.render();
  label(`M6 canvas pose t=${t} (green: CYPRESS_SIL)`, 0, 0);
} else if (view === 'zoom') {
  const u = Number(q.get('u') ?? '0.19'), v = Number(q.get('v') ?? '0.5');
  P.look(EYE, canvasToWorld(u, v, 1000), Number(q.get('fov') ?? '20'));
  strokesFor(EYE);
  if (q.get('grid') === '1') P.scene.add(silOverlay());
  P.render();
  label(`zoom from E at (${u}, ${v}) t=${t}`, 0, 0);
} else if (view === 'quad') {
  const names = (q.get('tiles') ?? 'helix,burst,side,top').split(',');
  const tw = W / 2, th = H / 2;
  P.renderer.setScissorTest(true);
  P.camera.aspect = tw / th;
  names.forEach((n, i) => {
    const x = (i % 2) * tw, y = Math.floor(i / 2) * th;
    const p = POSES[n];
    P.look(p.pos, p.target, p.fov);
    strokesFor(p.pos);
    P.renderer.setViewport(x, H - y - th, tw, th);
    P.renderer.setScissor(x, H - y - th, tw, th);
    P.render();
    label(`${p.name} t=${t}`, x, y);
  });
} else {
  const p = view === 'helixAt' ? helixPose(Number(q.get('ht') ?? '25')) : POSES[view];
  P.look(p.pos, p.target, p.fov);
  strokesFor(p.pos);
  P.render();
  label(`${p.name} t=${t}`, 0, 0);
}

(window as unknown as { __report: unknown }).__report = { checks, genMs, eye: EYE.toArray() };
(window as unknown as { __ready: boolean }).__ready = true;
