// M5 harness: stars, Venus horn and moon bell through the preview renderer (harness/lib/preview.ts).
//   ?view=pose            canvas pose at E with the canvas grid and table landmarks (cyan circles r = 0.005)
//   ?view=zoom&u=&v=&fov= camera at E aimed at canvas (u, v) with a narrow FOV (halo detail)
//   ?view=venus           2 x 2 tiles flying down the Venus ray: E + d dirV, d = 11.5 / 14 / 17 / 20 km, fov 72
//   ?view=horn            outside view of the Venus horn and the moon bell (3D form)
//   &t=<loop seconds>     animation time for previewMesh (ring spin)
import * as THREE from 'three';
import {
  CANVAS_ASPECT, CLASS_INFO, MOON_DEF, MOON_INDEX, PAINT_ORDER, STARS, StrokeClass,
} from '../src/contracts';
import { canvasToWorld, EYE } from '../src/shared/canvasSpace';
import { ringGeom } from '../src/shared/flowField';
import { forkRng } from '../src/shared/rng';
import { generateMoon } from '../src/celestial/moonGen';
import { generateStars, RING_BACK_DEPTH, RING_BAND_DEPTH } from '../src/celestial/starsGen';
import { canvasGrid, classCounts, classDepthRanges, previewMesh, RecordingSink, setupPreview } from './lib/preview';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'pose';
const t = Number(q.get('t') ?? '0');
const W = Number(q.get('w') ?? '1280');
const H = Number(q.get('h') ?? '720');

// ---------------------------------------------------------------- generate + checks
const sink = new RecordingSink();
// Timing with a counting sink (RecordingSink's per-record copy is harness overhead): cold (first) and warm runs.
const countSink = { n: 0, push() { this.n++; }, get count() { return this.n; } };
let t0 = performance.now();
generateStars(countSink, forkRng(1, 'stars'));
generateMoon(countSink, forkRng(1, 'moon'));
const tCold = performance.now() - t0;
t0 = performance.now();
generateStars(countSink, forkRng(1, 'stars'));
const tStars = performance.now() - t0;
generateMoon(countSink, forkRng(1, 'moon'));
const tGen = performance.now() - t0;
generateStars(sink, forkRng(1, 'stars'));
generateMoon(sink, forkRng(1, 'moon'));
const recs = sink.records;
const again = new RecordingSink();
generateStars(again, forkRng(1, 'stars'));
generateMoon(again, forkRng(1, 'moon'));

const checks: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  checks.push({ name, ok, detail });
  (ok ? console.log : console.error)(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
};

check('deterministic', again.records.length === recs.length && again.records.every((r, i) => JSON.stringify(r) === JSON.stringify(recs[i])), `${recs.length} records`);
const counts = classCounts(recs);
check('counts', counts.STAR_CORE === 2200 && counts.STAR_RING === 14000 && counts.MOON === 1800 && counts.MOON_RING === 4200, JSON.stringify(counts));
const ranges = classDepthRanges(recs);
for (const [k, [a, b]] of Object.entries(ranges)) {
  const cls = StrokeClass[k as keyof typeof StrokeClass];
  const [d0, d1] = CLASS_INFO[cls].dRange;
  check(`dRange ${k}`, a >= d0 && b <= d1, `[${a.toFixed(0)}, ${b.toFixed(0)}] within [${d0}, ${d1}]`);
}
// paint order per halo: every core / crescent depth < every ring depth of the same motif; rings < SWIRL (39 km)
let orderOk = true;
const orderDetail: string[] = [];
for (let i = 0; i <= MOON_INDEX; i++) {
  const coreCls = i === MOON_INDEX ? StrokeClass.MOON : StrokeClass.STAR_CORE;
  const ringCls = i === MOON_INDEX ? StrokeClass.MOON_RING : StrokeClass.STAR_RING;
  const cores = recs.filter((r) => r.cls === coreCls && (i === MOON_INDEX || r.q1 === i));
  const rings = recs.filter((r) => r.cls === ringCls && r.q1 === i);
  const cMax = Math.max(...cores.map((r) => r.d));
  const rMin = Math.min(...rings.map((r) => r.d));
  if (!(cMax < rMin)) { orderOk = false; orderDetail.push(`#${i} core ${cMax.toFixed(0)} >= ring ${rMin.toFixed(0)}`); }
}
const ringMax = Math.max(...recs.filter((r) => r.cls === StrokeClass.STAR_RING || r.cls === StrokeClass.MOON_RING).map((r) => r.d));
check('paint order core<ring<swirl', orderOk && ringMax < CLASS_INFO[StrokeClass.SWIRL].dRange[0], orderDetail.join('; ') || `max ring d ${ringMax.toFixed(0)}; contract pairs: ${PAINT_ORDER.length}`);
// ring records sit on their ring at t = 0 (radius rho_k (1 + 0.04 q3)), with q2 integral and |q3| <= 1
// depth: d / d_k inside one of the two layers (bands RING_BAND_DEPTH, dark backing RING_BACK_DEPTH), both inside the
// shader's +-3 % record jitter window
let ringErr = 0;
let ringBad = 0;
let nBand = 0, nBack = 0;
const inLayer = (f: number, [a, b]: readonly [number, number]) => f >= a - 1e-12 && f <= b + 1e-12;
for (const r of recs) {
  if (r.cls !== StrokeClass.STAR_RING && r.cls !== StrokeClass.MOON_RING) continue;
  const g = ringGeom(r.q1, r.q2);
  const rr = Math.hypot(r.u * CANVAS_ASPECT - g.cx, r.v - g.cy);
  ringErr = Math.max(ringErr, Math.abs(rr - g.rho * (1 + 0.04 * r.q3)));
  const f = r.d / g.d;
  if (inLayer(f, RING_BAND_DEPTH)) nBand++;
  else if (inLayer(f, RING_BACK_DEPTH)) nBack++;
  else ringBad++;
  if (r.q2 !== Math.round(r.q2) || Math.abs(r.q3) > 1 || r.dv !== 0 || r.dlnd !== 0 || Math.abs(f - 1) > 0.03) ringBad++;
}
check('ring placement', ringErr < 1e-9 && ringBad === 0, `max radial err ${ringErr.toExponential(2)}, bad ${ringBad}; bands ${nBand}, backing ${nBack}`);
// layer order per ring: every band stroke of ring k is in front of its backing and behind ring k-1's backing
let layerBad = 0;
for (const cls of [StrokeClass.STAR_RING, StrokeClass.MOON_RING]) {
  const byRing = new Map<string, { bandMax: number; backMin: number; backMax: number; bandMin: number }>();
  for (const r of recs) {
    if (r.cls !== cls) continue;
    const key = `${r.q1}:${r.q2}`;
    const e = byRing.get(key) ?? { bandMax: -Infinity, backMin: Infinity, backMax: -Infinity, bandMin: Infinity };
    const f = r.d / ringGeom(r.q1, r.q2).d;
    if (f < 1) { e.bandMax = Math.max(e.bandMax, r.d); e.bandMin = Math.min(e.bandMin, r.d); }
    else { e.backMin = Math.min(e.backMin, r.d); e.backMax = Math.max(e.backMax, r.d); }
    byRing.set(key, e);
  }
  for (const [key, e] of byRing) {
    if (e.bandMax >= e.backMin) layerBad++;
    const [si, k] = key.split(':').map(Number);
    const next = byRing.get(`${si}:${k + 1}`);
    if (next && next.bandMin <= e.backMax) layerBad++;
  }
}
check('ring layers band<backing<next band', layerBad === 0, `${layerBad} ring(s) out of order`);
// landmarks: centroid of each core (and of ring 0) vs the §2.4 table
let lmErr = 0;
for (let i = 0; i < STARS.length; i++) {
  const s = STARS[i];
  const core = recs.filter((r) => r.cls === StrokeClass.STAR_CORE && r.q1 === i);
  // spike centre is at mid-radius: centroid over all directions converges on the star centre
  const cu = core.reduce((a, r) => a + r.u, 0) / core.length;
  const cv = core.reduce((a, r) => a + r.v, 0) / core.length;
  lmErr = Math.max(lmErr, Math.hypot((cu - s.u) * CANVAS_ASPECT, cv - s.v));
}
const bell0 = recs.filter((r) => r.cls === StrokeClass.MOON_RING && r.q2 === 0);
const mu = bell0.reduce((a, r) => a + r.u, 0) / bell0.length, mv = bell0.reduce((a, r) => a + r.v, 0) / bell0.length;
lmErr = Math.max(lmErr, Math.hypot((mu - MOON_DEF.u) * CANVAS_ASPECT, mv - MOON_DEF.v));
check('landmarks within 0.005', lmErr < 0.005, `max centroid offset ${lmErr.toFixed(5)} h`);
check('generation time', tGen < 25, `warm: stars ${tStars.toFixed(1)} ms, total ${tGen.toFixed(1)} ms; cold total ${tCold.toFixed(1)} ms (budget 25)`);
const venusRings = [...new Set(recs.filter((r) => r.cls === StrokeClass.STAR_RING && r.q1 === 0).map((r) => r.d.toFixed(0)))];
console.log(`Venus ring depths: ${venusRings.join(' / ')}`);

// ---------------------------------------------------------------- render
const P = setupPreview(W, H);
// ?tm=1: approximate the final look: colour x (1 + emissive) through Neutral tone mapping (the M3 shader adds
// col * emissive on top of the diffuse term; M9 applies NeutralToneMapping).
const tm = q.get('tm') === '1';
if (tm) {
  P.renderer.toneMapping = THREE.NeutralToneMapping;
  P.renderer.toneMappingExposure = Number(q.get('exp') ?? '1');
}
const gainP = tm ? Number(q.get('gain') ?? '1') : 0.15;
const allMesh = previewMesh(recs, t, { emissiveGain: gainP });
P.scene.add(allMesh);

function landmarks(): THREE.LineSegments {
  const pts: number[] = [];
  const ring = (u: number, v: number, r: number) => {
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
      const A = canvasToWorld(u + (r * Math.cos(a0)) / CANVAS_ASPECT, v + r * Math.sin(a0), 50);
      const B = canvasToWorld(u + (r * Math.cos(a1)) / CANVAS_ASPECT, v + r * Math.sin(a1), 50);
      pts.push(A.x, A.y, A.z, B.x, B.y, B.z);
    }
  };
  for (const s of STARS) ring(s.u, s.v, 0.005);
  ring(MOON_DEF.u, MOON_DEF.v, 0.005);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x00ffff, depthTest: false, transparent: true, opacity: 0.8 }));
  l.renderOrder = 1001;
  return l;
}

function label(text: string, x: number, y: number) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:absolute;left:${x + 6}px;top:${y + 4}px;color:#fff;background:rgba(0,0,0,.45);padding:1px 4px;font:12px monospace`;
  document.body.appendChild(el);
}

const venusCore = canvasToWorld(STARS[0].u, STARS[0].v, STARS[0].dCore);
const dirV = venusCore.clone().sub(EYE).normalize();

if (view === 'pose') {
  P.pose();
  if (q.get('grid') !== '0') {
    P.scene.add(canvasGrid());
    P.scene.add(landmarks());
  }
  P.render();
  label(`M5 canvas pose t=${t}`, 0, 0);
} else if (view === 'zoom') {
  const u = Number(q.get('u') ?? '0.3'), v = Number(q.get('v') ?? '0.72');
  P.look(EYE, canvasToWorld(u, v, 1000), Number(q.get('fov') ?? '10'));
  P.render();
  label(`zoom (${u}, ${v}) t=${t}`, 0, 0);
} else if (view === 'venus') {
  const ds = (q.get('ds') ?? '11.5,14,17,20').split(',').map(Number);
  const tw = W / 2, th = H / 2;
  P.renderer.setScissorTest(true);
  P.camera.aspect = tw / th;
  ds.forEach((dk, i) => {
    const x = (i % 2) * tw, y = Math.floor(i / 2) * th;
    const pos = EYE.clone().addScaledVector(dirV, dk * 1000);
    P.look(pos, pos.clone().addScaledVector(dirV, 1000), 72);
    P.renderer.setViewport(x, H - y - th, tw, th);
    P.renderer.setScissor(x, H - y - th, tw, th);
    P.render();
    label(`d = ${dk} km, t = ${t}`, x, y);
  });
} else if (view === 'horn') {
  // Oblique outside views of the Venus horn (left) and the moon bell (right): camera off to the side of each axis
  // and pulled back toward E, so the rings read as a flaring stack of hoops.
  const tw = W / 2;
  P.renderer.setScissorTest(true);
  P.camera.aspect = tw / H;
  // isolate one motif per tile (the other halos would crowd the frame)
  P.scene.remove(allMesh);
  const only = (pred: (r: (typeof recs)[number]) => boolean) => {
    P.scene.children.filter((c) => c.userData.tile).forEach((c) => P.scene.remove(c));
    const m = previewMesh(recs.filter(pred), t, { emissiveGain: gainP });
    m.userData.tile = true;
    P.scene.add(m);
  };
  const oblique = (u: number, v: number, dMid: number, sideSign: number, x: number) => {
    const dir = canvasToWorld(u, v, 1).sub(EYE).normalize();
    const mid = EYE.clone().addScaledVector(dir, dMid);
    const side = new THREE.Vector3(0, 1, 0).cross(dir).normalize().multiplyScalar(sideSign);
    P.look(mid.clone().addScaledVector(side, 9000).addScaledVector(dir, -7000).add(new THREE.Vector3(0, 2500, 0)), mid, 55);
    P.renderer.setViewport(x, 0, tw, H);
    P.renderer.setScissor(x, 0, tw, H);
    P.render();
  };
  only((r) => (r.cls === StrokeClass.STAR_CORE || r.cls === StrokeClass.STAR_RING) && r.q1 === 0);
  oblique(STARS[0].u, STARS[0].v, 17800, -1, 0);
  label(`Venus horn, oblique outside view t=${t}`, 0, 0);
  only((r) => r.cls === StrokeClass.MOON || r.cls === StrokeClass.MOON_RING);
  oblique(MOON_DEF.u, MOON_DEF.v, 17000, 1, tw);
  label(`moon bell, oblique outside view t=${t}`, tw, 0);
}

(window as unknown as { __report: unknown }).__report = { checks, counts, ranges, genMs: tGen };
(window as unknown as { __ready: boolean }).__ready = true;
