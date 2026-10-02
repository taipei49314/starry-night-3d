// M3 harness: the real stroke path (buildStrokeLayer + stroke shaders + underlay material) on a mini-world.
//   ?view=pose|aside(&dx=m)|side|funnel|close|house|venus|lab|ulfade   ?t=<loop seconds>   ?warp=k (free-mode warp)   ?tier=high|medium|low   ?hud=1
// Tests (logged as JSON, window.__report): warp invariance at E (uWarpK 1 / 0.5 / 1.6), CPU endpoint projection
// of the 64 debug strokes, GPU centre coverage of the debug strokes, buffer pack round trip, bounds (culling on/off
// renders identical), tier switch, draw calls / triangles.
import * as THREE from 'three';
import {
  CANVAS_ASPECT, CAMERA_FAR, CAMERA_NEAR, MOON_INDEX, QUALITY_PRESETS, SKY_EDGE_FADE, SKY_GEN_U, SKY_GEN_V, STARS, StrokeClass,
  type StrokeRecord, type Tier,
} from '../src/contracts';
import { canvasPoseFovDeg, canvasToWorld, EYE, FORWARD, strokeEndpoints, UP } from '../src/shared/canvasSpace';
import { mulberry32, forkRng } from '../src/shared/rng';
import { createSharedUniforms } from '../src/shared/uniforms';
import { buildStrokeLayer, emptyRecord, generateDebugStrokes, makeUnderlayMaterial, StrokeBuffer } from '../src/strokes/strokeBuffer';
import { genBands, genCypress, genFunnel, genGeneric, genHouses, genJet, genStar, genUnderpaint, genVenus } from './strokesWorld';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'pose';
const tier = (params.get('tier') ?? 'high') as Tier;
const t = Number(params.get('t') ?? (['close', 'house', 'macro', 'cypmacro'].includes(view) ? 30 : 0));
const W = window.innerWidth || 1280;
const H = window.innerHeight || 720;
const outEl = document.getElementById('out')!;
const report: Record<string, unknown> = { view, tier, t };
const log = (k: string, v: unknown) => {
  report[k] = v;
  console.log(`[strokes] ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  if (params.get('hud')) outEl.textContent += `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}\n`;
};

// ---------------------------------------------------------------- renderer (the real path)
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
if (params.get('linear')) { renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace; }
renderer.setClearColor(0x050a18);
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext();
log('gl', { samples: gl.getParameter(gl.SAMPLES), renderer: gl.getParameter(gl.RENDERER) });

const camera = new THREE.PerspectiveCamera(36, W / H, CAMERA_NEAR, CAMERA_FAR);
const scene = new THREE.Scene();
const u = createSharedUniforms();
const q = QUALITY_PRESETS[tier];

// ---------------------------------------------------------------- mini-world
const buf = new StrokeBuffer(1024);
const t0 = performance.now();
const full = params.get('full') === '1';
let houses: ReturnType<typeof genHouses>;
if (!full) {
  genUnderpaint(buf, forkRng(1, 'underpaint'));
  genBands(buf, forkRng(1, 'bands'));
  genFunnel(buf, forkRng(1, 'c1'), 0, 3000, 900);
  genFunnel(buf, forkRng(1, 'c2'), 1, 1600, 500);
  genVenus(buf, forkRng(1, 'venus'));
  genJet(buf, forkRng(1, 'jet'));
  genCypress(buf, forkRng(1, 'cypress'));
  houses = genHouses(buf, forkRng(1, 'houses'), [[0.5, 0.12], [0.63, 0.1], [0.72, 0.15], [0.42, 0.08]]);
} else {
  // full High budget (§7.2) with harness generators: ~170k strokes
  genUnderpaint(buf, forkRng(2, 'underpaint'), 100, 30);
  genBands(buf, forkRng(2, 'bands'), 32000);
  genFunnel(buf, forkRng(2, 'c1'), 0, 16000, 1500);
  genFunnel(buf, forkRng(2, 'c2'), 1, 14000, 1500);
  for (let vi = 2; vi < 6; vi++) genFunnel(buf, forkRng(2, `e${vi}`), vi, 1500, 0);
  genVenus(buf, forkRng(2, 'venus'));
  STARS.forEach((st, si) => { if (si > 0) genStar(buf, forkRng(2, `s${si}`), si, 180, StrokeClass.STAR_RING, StrokeClass.STAR_CORE, st.rings, st.dCore, 0.0042); });
  genStar(buf, forkRng(2, 'moon'), MOON_INDEX, 1800, StrokeClass.MOON_RING, StrokeClass.MOON, 10, 11000, 0.0028);
  genJet(buf, forkRng(2, 'jet'), 32, 75);
  genCypress(buf, forkRng(2, 'cypress'), 18000, 1500);
  genGeneric(buf, forkRng(2, 'hill'), StrokeClass.HILL, 16500, [-0.3, 1.3], [0.2, 0.38], [2100, 5900], true);
  genGeneric(buf, forkRng(2, 'ground'), StrokeClass.GROUND, 8000, [-0.3, 1.3], [-0.12, 0.1], [260, 760], true);
  genGeneric(buf, forkRng(2, 'grove'), StrokeClass.GROVE, 6000, [0.3, 1.25], [0.02, 0.2], [400, 2600], true);
  genGeneric(buf, forkRng(2, 'church'), StrokeClass.CHURCH, 3600, [0.53, 0.57], [0.11, 0.44], [640, 700], true);
  const sites: [number, number][] = [];
  const sr = forkRng(2, 'sites');
  for (let i = 0; i < 40; i++) sites.push([sr.range(0.32, 1.1), sr.range(0.06, 0.195)]);
  houses = genHouses(buf, forkRng(2, 'houses'), sites);
}
const dbgRecords: StrokeRecord[] = [];
generateDebugStrokes({ push: (r) => { dbgRecords.push({ ...r }); buf.push(r); }, get count() { return dbgRecords.length; } }, mulberry32(64));
log('genMs', Math.round(performance.now() - t0));

const counts: Record<string, number> = {};
for (let c = 0; c < 16; c++) { const r = buf.classRange(c); if (r.n) counts[StrokeClass[c]] = r.n; }
log('counts', { total: buf.count, ...counts });

const t1 = performance.now();
const layer = buildStrokeLayer(buf, u, q);
log('buildMs', Math.round(performance.now() - t1));
log('chunks', layer.chunks.map((c) => `${StrokeClass[c.cls]}:${c.n}${c.nUnder ? `(u${c.nUnder})` : ''}@r${(c.baseRadius / 1000).toFixed(1)}k`).join(' '));
scene.add(layer.group);

// underlays: ground plane (plain Mesh) + house cores (InstancedMesh)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(7000, 6500, 32, 32).rotateX(-Math.PI / 2).translate(500, 0, -3250), makeUnderlayMaterial(0x1d2b1f, u));
scene.add(ground);
const cores = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), makeUnderlayMaterial(0x26314a, u), houses.length);
const m4 = new THREE.Matrix4();
houses.forEach((h, i) => {
  m4.compose(h.center, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.yaw), h.size.clone().multiplyScalar(0.97));
  cores.setMatrixAt(i, m4);
});
cores.computeBoundingSphere();
scene.add(cores);

// ---------------------------------------------------------------- cameras
function setDerived(): void {
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const off = camera.position.distanceTo(EYE);
  const ss = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  u.uOff.value = ss(0.5, 40, off);
  const camF = new THREE.Vector3();
  camera.getWorldDirection(camF);
  u.uAlign.value = (1 - ss(0.05, 3, off)) * ss(0.999, 0.99995, camF.dot(FORWARD)) * (1 - ss(0.2, 2.0, Math.abs(camera.fov - canvasPoseFovDeg(W / H))));
  u.uPxPerRad.value = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  u.uViewportH.value = H;
}
function pose(): void {
  camera.position.copy(EYE);
  camera.up.copy(UP);
  camera.fov = canvasPoseFovDeg(W / H);
  camera.lookAt(EYE.clone().add(FORWARD));
  setDerived();
}
function look(pos: THREE.Vector3, target: THREE.Vector3, fov: number): void {
  camera.position.copy(pos);
  camera.up.set(0, 1, 0);
  camera.fov = fov;
  camera.lookAt(target);
  setDerived();
}
u.uTime.value = t;
if (params.get('imp')) u.uImpastoGain.value = Number(params.get('imp'));
u.uCamVel.value.set(0, 0, 0);

function grab(): Uint8Array {
  renderer.render(scene, camera);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}
function diff(a: Uint8Array, b: Uint8Array) {
  let any = 0, big = 0, max = 0;
  for (let i = 0; i < a.length; i += 4) {
    const m = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    if (m > 0) any++;
    if (m > 24) big++;
    if (m > max) max = m;
  }
  const n = a.length / 4;
  return { anyFrac: +(any / n).toExponential(2), bigFrac: +(big / n).toExponential(2), maxDiff: max };
}

// ---------------------------------------------------------------- tests
function cpuEndpointTest(): void {
  pose();
  let maxErr = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), ndc = new THREE.Vector3();
  const aspect = W / H;
  for (const r of dbgRecords) {
    strokeEndpoints(r.u, r.v, r.d, r.du, r.dv, r.dlnd, a, b);
    const ends: [THREE.Vector3, number, number][] = [
      [a, r.u - (0.5 * r.du) / CANVAS_ASPECT, r.v - 0.5 * r.dv],
      [b, r.u + (0.5 * r.du) / CANVAS_ASPECT, r.v + 0.5 * r.dv],
    ];
    for (const [p, cu, cv] of ends) {
      ndc.copy(p).project(camera);
      const pu = 0.5 + (ndc.x * aspect) / (2 * CANVAS_ASPECT);
      const pv = 0.5 + ndc.y / 2;
      maxErr = Math.max(maxErr, Math.abs(pu - cu), Math.abs(pv - cv));
    }
  }
  log('cpuEndpointProjection', { n: dbgRecords.length * 2, maxErr: +maxErr.toExponential(2), ok: maxErr < 1e-4 });
}

function packTest(): void {
  const rec = emptyRecord();
  let maxRel = 0, clsOk = true;
  const base = buf.count - dbgRecords.length;
  dbgRecords.forEach((r, i) => {
    buf.get(base + i, rec);
    if (rec.cls !== r.cls || rec.flags !== r.flags) clsOk = false;
    for (const k of ['u', 'v', 'd', 'du', 'dv', 'dlnd', 'w', 'colA', 'colB', 'seed', 'kappa', 'q1', 'q2', 'q3'] as const) {
      maxRel = Math.max(maxRel, Math.abs(rec[k] - r[k]) / Math.max(Math.abs(r[k]), 1e-6));
    }
  });
  log('packRoundTrip', { maxRel: +maxRel.toExponential(2), clsFlagsOk: clsOk, ok: clsOk && maxRel < 1e-6 });
}

function warpInvarianceTest(): void {
  pose();
  ground.visible = cores.visible = false; // underlays are hidden while k != 1 (§5.3): compare strokes only
  u.uWarpK.value = 1;
  layer.setCullingEnabled(true);
  const ref = grab();
  const res: Record<string, unknown> = {};
  const showK = params.get('diff');
  for (const k of [1, 0.5, 1.6, 0]) {
    u.uWarpK.value = k;
    layer.setCullingEnabled(k === 1);
    const img = grab();
    res[`k=${k}`] = diff(ref, img);
    if (showK !== null && Number(showK) === k) showDiff(ref, img);
  }
  u.uWarpK.value = 1;
  layer.setCullingEnabled(true);
  ground.visible = cores.visible = true;
  log('warpInvariance', res);
}

/** Overlay a 2D canvas: grey = reference, red = pixels that differ (any channel). */
function showDiff(a: Uint8Array, b: Uint8Array): void {
  const c2 = document.createElement('canvas');
  c2.width = W; c2.height = H;
  c2.style.cssText = 'position:absolute;left:0;top:0';
  const ctx = c2.getContext('2d')!;
  const im = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = ((H - 1 - y) * W + x) * 4, o = (y * W + x) * 4;
    const m = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    const g = (a[i] + a[i + 1] + a[i + 2]) / 9;
    im.data[o] = m > 0 ? 255 : g; im.data[o + 1] = m > 0 ? 0 : g; im.data[o + 2] = m > 0 ? 0 : g; im.data[o + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  document.body.appendChild(c2);
}

function gpuCoverageTest(): void {
  // only the debug strokes, on black
  // kappa 0: the spine bow is an intentional 3D offset along the ribbon normal; this test checks canvas placement
  const dbuf = new StrokeBuffer(64);
  for (const r of dbgRecords) dbuf.push({ ...r, kappa: 0 });
  // every debug stroke must be drawn: use tier fractions of 1 (keeping this tier's alpha mode), then restore
  const dl = buildStrokeLayer(dbuf, u, { ...q, tier: 'high' });
  const s2 = new THREE.Scene();
  s2.add(dl.group);
  pose();
  renderer.setClearColor(0x000000);
  renderer.render(s2, camera);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  renderer.setClearColor(0x050a18);
  layer.setQuality(q); // the debug build wrote the shared uWidthComp for tier 'high'
  let hit = 0;
  const p = new THREE.Vector3();
  const misses: string[] = [];
  // UNDERPAINT / SKY_BAND strokes within SKY_EDGE_FADE of the SKY_GEN extent dissolve by design: their centre
  // pixel must then stay dark (alpha 0 at the extent edge), so they are checked separately
  let dissolved = 0, dissolvedLit = 0;
  for (const r of dbgRecords) {
    canvasToWorld(r.u, r.v, r.d, p).project(camera);
    if (r.cls === StrokeClass.UNDERPAINT || r.cls === StrokeClass.SKY_BAND) {
      const margin = Math.min(r.u - SKY_GEN_U[0], SKY_GEN_U[1] - r.u, r.v - SKY_GEN_V[0], SKY_GEN_V[1] - r.v);
      if (margin < SKY_EDGE_FADE) {
        dissolved++;
        if (margin <= 0) {
          const x0 = Math.round((p.x * 0.5 + 0.5) * W - 0.5), y0 = Math.round((p.y * 0.5 + 0.5) * H - 0.5);
          const i0 = (y0 * W + x0) * 4;
          if (px[i0] + px[i0 + 1] + px[i0 + 2] > 6) dissolvedLit++;
        }
        continue;
      }
    }
    const x = Math.round((p.x * 0.5 + 0.5) * W - 0.5), y = Math.round((p.y * 0.5 + 0.5) * H - 0.5);
    let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) {
      const i = ((y + dy) * W + (x + dx)) * 4;
      if (px[i] + px[i + 1] + px[i + 2] > 6) ok = true;
    }
    if (ok) hit++;
    else {
      let mx = 0;
      for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
        const i = ((y + dy) * W + (x + dx)) * 4;
        mx = Math.max(mx, px[i] + px[i + 1] + px[i + 2]);
      }
      misses.push(`${StrokeClass[r.cls]}@${r.u.toFixed(3)},${r.v.toFixed(3)} d=${r.d.toFixed(0)} du=${r.du.toFixed(3)} dv=${r.dv.toFixed(3)} dlnd=${r.dlnd.toFixed(3)} w=${r.w.toFixed(4)} n=${r.q1.toFixed(2)},${r.q2.toFixed(2)},${r.q3.toFixed(2)} k=${r.kappa.toFixed(2)} near=${mx}`);
    }
  }
  log('gpuCentreCoverage', { hit, n: dbgRecords.length - dissolved, dissolved, dissolvedLit, misses: misses.slice(0, 6), ok: hit === dbgRecords.length - dissolved && dissolvedLit === 0 });
  if (view === 'debug') { scene.remove(...scene.children); scene.add(dl.group); renderer.setClearColor(0x000000); return; }
  dl.dispose();
}

function boundsTest(): void {
  layer.setCullingEnabled(true);
  const a = grab();
  const callsCulled = renderer.info.render.calls;
  layer.setCullingEnabled(false);
  const b = grab();
  const callsAll = renderer.info.render.calls;
  layer.setCullingEnabled(true);
  log('cullingOnVsOff', { ...diff(a, b), callsCulled, callsAll });
}

function tierSwitchTest(): void {
  const res: Record<string, unknown> = {};
  for (const tt of ['low', 'medium', 'high'] as Tier[]) {
    layer.setQuality(QUALITY_PRESETS[tt]);
    renderer.render(scene, camera);
    res[tt] = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, hashed: 'HASHED_ALPHA' in layer.material.defines, a2c: layer.material.alphaToCoverage };
  }
  layer.setQuality(q);
  log('tierSwitch', res);
}

// ---------------------------------------------------------------- lab: a few big strokes, one per flag / kind
function labScene(): void {
  const lb = new StrokeBuffer(64);
  const rng = mulberry32(5);
  const rows: { cls: StrokeClass; flags: number; cA: number; cB: number; em: number; solid: boolean }[] = [
    { cls: StrokeClass.HOUSE, flags: 0, cA: 0x8fa9bd, cB: 0xe8edf0, em: 0, solid: true },
    { cls: StrokeClass.HOUSE, flags: 2, cA: 0x5e8fb0, cB: 0xe8edf0, em: 0, solid: true },
    { cls: StrokeClass.CYPRESS, flags: 1, cA: 0x0b1a3a, cB: 0x0b1a3a, em: 0, solid: false },
    { cls: StrokeClass.STAR_CORE, flags: 0, cA: 0xf5e27a, cB: 0xe8edf0, em: 2, solid: false },
  ];
  const d = 100;
  rows.forEach((row, ri) => {
    for (let ci = 0; ci < 4; ci++) {
      const u = 0.14 + ci * 0.24, v = 0.83 - ri * 0.22;
      const ang = rng.range(-0.25, 0.25) + (ci === 3 ? 0.9 : 0);
      const L = 0.2;
      const p = canvasToWorld(u, v, d);
      const n = EYE.clone().sub(p).normalize();
      lb.push({ u, v, d, cls: row.cls, flags: row.flags, du: L * Math.cos(ang), dv: L * Math.sin(ang), dlnd: 0, w: 0.045 + 0.015 * ci,
        colA: row.cA, colB: row.cB, emissive: row.em, seed: rng.next(), kappa: 0.1 * ci, q1: row.solid ? n.x : 0, q2: row.solid ? n.y : 0, q3: row.solid ? n.z : 0 });
    }
  });
  const ll = buildStrokeLayer(lb, u, q);
  if (params.get('dbg')) { ll.material.defines.STK_DEBUG = params.get('dbg'); ll.material.needsUpdate = true; renderer.toneMapping = THREE.NoToneMapping; }
  scene.remove(...scene.children);
  scene.add(ll.group);
  const ang = Number(params.get('light') ?? 30);
  if (params.get('align') === '0') {
    // off-axis lighting: the moon light comes from the upper right of the camera
    u.uMoonPos.value.copy(EYE).add(new THREE.Vector3(Math.cos(THREE.MathUtils.degToRad(ang)), 0.6, 0.2).multiplyScalar(1e5));
  }
}

// ---------------------------------------------------------------- run
// dynamic-path switches: ?scatter=a  ?snap=secondsSinceSnap  ?stir=strength  ?layin=s  ?inflate=s  ?vel=m/s
function applyDynamics(): void {
  if (params.get('scatter')) { u.uScatter.value = Number(params.get('scatter')); layer.setCullInflation(0.05); }
  if (params.get('snap')) {
    u.uSnapTime.value = Math.max(0, t - Number(params.get('snap')));
    u.uScatterAtSnap.value = 1;
    layer.setCullInflation(0.05);
  }
  if (params.get('stir')) u.uStir.value.set(0.6374, 0.64, Number(params.get('stir')), 0.08); // radius 0.08 h (§5.3)
  if (params.get('layin')) u.uLayIn.value = Number(params.get('layin'));
  if (params.get('inflate')) u.uInflate.value = Number(params.get('inflate'));
  if (params.get('warp')) {
    // free-mode depth warp off-axis: culling off and underlays hidden while k != 1 (§5.3)
    u.uWarpK.value = Number(params.get('warp'));
    layer.setCullingEnabled(u.uWarpK.value === 1);
    ground.visible = cores.visible = u.uWarpK.value === 1;
  }
  if (params.get('vel')) u.uCamVel.value.copy(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(Number(params.get('vel'))));
}
cpuEndpointTest();
packTest();
gpuCoverageTest();
if (view === 'pose') warpInvarianceTest();
tierSwitchTest();

let ulFadeMeasure: (() => void) | null = null; // set by ulFadeScene (view=ulfade)
const c1Mid = canvasToWorld(0.43, 0.66, 62_000);
switch (view) {
  case 'aside': look(EYE.clone().add(new THREE.Vector3(Number(params.get('dx') ?? 1), 0, 0)), EYE.clone().add(new THREE.Vector3(Number(params.get('dx') ?? 1), 0, 0)).add(FORWARD), canvasPoseFovDeg(W / H)); break;
  case 'side': look(EYE.clone().add(new THREE.Vector3(300, 0, 0)), c1Mid, 40); break;
  case 'funnel': look(c1Mid.clone().add(new THREE.Vector3(70_000, 10_000, 30_000)), c1Mid, 55); break;
  case 'funnel2': look(c1Mid.clone().add(new THREE.Vector3(38_000, -4_000, 26_000)), c1Mid.clone().add(new THREE.Vector3(0, 2000, 0)), 60); break;
  case 'close': look(new THREE.Vector3(-8, 92, -150), canvasToWorld(0.17, 0.55, 192), 60); break;
  case 'cypmacro': look(canvasToWorld(0.17, 0.5, 192).add(new THREE.Vector3(10, 4, 14)), canvasToWorld(0.17, 0.52, 192), 50); break;
  case 'macro': {
    const h = houses[0];
    const ex = new THREE.Vector3(Math.cos(h.yaw), 0, -Math.sin(h.yaw)), ez = new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw));
    const wall = h.center.clone().addScaledVector(ez, h.size.z / 2).addScaledVector(ex, h.size.x / 2 - 2).add(new THREE.Vector3(0, 1.5, 0));
    look(wall.clone().addScaledVector(ez, 7).addScaledVector(ex, 3).add(new THREE.Vector3(0, 1.2, 0)), wall, 50);
    break;
  }
  case 'house': {
    const h = houses[0];
    look(h.center.clone().add(new THREE.Vector3(22, 14, 30)), h.center, 55);
    break;
  }
  case 'venus': {
    const a = canvasToWorld(0.3, 0.72, 9000).add(new THREE.Vector3(120, -80, 0));
    look(a, canvasToWorld(0.3, 0.72, 30_000), 60);
    break;
  }
  case 'lab': labScene(); pose(); if (params.get('align') === '0') u.uAlign.value = 0; break;
  case 'ulfade': pose(); ulFadeScene(); break;
  default: pose();
}
/**
 * Underlay vertexFade check: two quads facing the pose camera, top = default material, bottom = vertexFade with aFade
 * running 0 (left) -> 1 (right). Logs the lit fraction of the bottom quad in five columns (must rise 0 -> 1).
 */
function ulFadeScene(): void {
  layer.group.visible = ground.visible = cores.visible = false;
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const c = camera.position.clone().addScaledVector(fwd, 500);
  const mk = (dy: number, fade: boolean): THREE.Mesh => {
    const g = new THREE.PlaneGeometry(500, 120, 50, 1);
    const pos = g.getAttribute('position');
    const a = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) a[i] = (pos.getX(i) + 250) / 500;
    g.setAttribute('aFade', new THREE.BufferAttribute(a, 1));
    const m = new THREE.Mesh(g, makeUnderlayMaterial(0xd98a1e, u, THREE.DoubleSide, { vertexFade: fade }));
    m.matrixAutoUpdate = false;
    m.matrix.makeBasis(right, up, fwd.clone().negate()).setPosition(c.clone().addScaledVector(up, dy));
    m.matrixWorldNeedsUpdate = true;
    return m;
  };
  scene.add(mk(80, false), mk(-80, true));
  ulFadeMeasure = () => {
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const p0 = c.clone().addScaledVector(up, -80).addScaledVector(right, -250).project(camera);
    const p1 = c.clone().addScaledVector(up, -80).addScaledVector(right, 250).project(camera);
    const x0 = (p0.x * 0.5 + 0.5) * W, x1 = (p1.x * 0.5 + 0.5) * W, yc = Math.round((p0.y * 0.5 + 0.5) * H);
    const cols: number[] = [];
    for (let k = 0; k < 5; k++) {
      let lit = 0, n = 0;
      for (let x = Math.ceil(x0 + ((x1 - x0) * k) / 5) + 1; x < x0 + ((x1 - x0) * (k + 1)) / 5 - 1; x++) for (let y = yc - 10; y <= yc + 10; y++) {
        const i = (y * W + x) * 4;
        n++;
        if (px[i] > 40) lit++; // ochre survivors; the clear colour and the fog blend stay dark in red
      }
      cols.push(+(lit / Math.max(n, 1)).toFixed(3));
    }
    log('ulFade', { litByColumn: cols, ok: cols[0] < 0.1 && cols[4] > 0.75 && cols.every((v, i) => i === 0 || v >= cols[i - 1] - 0.05) });
  };
}

applyDynamics();
if (!params.get('warp') && view !== 'ulfade') boundsTest(); // the bounds test re-enables culling, which must stay off under warp
renderer.render(scene, camera);
(ulFadeMeasure as (() => void) | null)?.(); // assigned inside ulFadeScene (TS narrows the let to null)
const info = renderer.info;
log('render', { calls: info.render.calls, triangles: info.render.triangles, programs: info.programs?.length, chunks: layer.drawCalls,
  uOff: +u.uOff.value.toFixed(3), uAlign: +u.uAlign.value.toFixed(3) });
if (params.get('timing')) {
  // median of N frames, each closed by a 1-pixel readPixels (forces completion)
  const px1 = new Uint8Array(4);
  const times: number[] = [];
  for (let i = 0; i < Number(params.get('timing')); i++) {
    u.uTime.value = (t + i / 60) % 96;
    const a = performance.now();
    renderer.render(scene, camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
    times.push(performance.now() - a);
  }
  times.sort((x, y) => x - y);
  log('frameMs', { median: +times[times.length >> 1].toFixed(2), min: +times[0].toFixed(2), max: +times[times.length - 1].toFixed(2), n: times.length, W, H });
}
(window as unknown as { __report: unknown }).__report = report;
(window as unknown as { __ready: boolean }).__ready = true;
