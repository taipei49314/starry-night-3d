// M4 sky harness: generates the sky records, checks counts / depth ranges / paint order, measures coverage from E,
// and renders the records (harness preview quads) with the REAL backdrop and dust materials from several vantages.
//
//   harness/sky.html?view=canvas&t=0        canvas pose from E (+ canvas grid)
//   harness/sky.html?view=profile&t=48      §5 shot 6 profile vantage V6 -> P_mid, fov 56
//   harness/sky.html?view=profileb&t=52     V6b -> P_mid
//   harness/sky.html?view=funnel&t=60       inside the c1 funnel (shot 7): r = 0.06, th = -90 deg, looking at the axis
//   harness/sky.html?view=jet&t=32          burst end pose looking at Venus (wind jet)
//   harness/sky.html?view=eye&t=71          vortex eye A44 looking back at E, fov 26
//   harness/sky.html?view=coverage&t=0      stroke-layer count from E (heat map + stats)
//   harness/sky.html?view=coverage&ext=1    the same over the whole extended extent (canvas space, flat), + extension stats
//   harness/sky.html?view=backdrop&yaw=0    backdrop alone from E (yaw/pitch in degrees)
//   harness/sky.html?view=zoom&cu=0.51&cv=0.64&fov=14   from E, zoomed on a canvas point
// Extra: &cls=SWIRL,EDDY  &under=0  &grid=0  &bd=0  &dust=0  &fov=  &th=  &r=  &lib=1 (shared lib preview quads)
import * as THREE from 'three';
import {
  CANVAS_ASPECT, CLASS_INFO, GEN_U, GEN_V, QUALITY_PRESETS, SKY_EDGE_FADE, SKY_GEN_U, SKY_GEN_V, StrokeClass, StrokeFlag, VORTICES,
} from '../src/contracts';
import { canvasToWorld, EYE } from '../src/shared/canvasSpace';
import { flowField, ridgeV } from '../src/shared/flowField';
import { forkRng, mulberry32 } from '../src/shared/rng';
import { mixHex } from '../src/shared/palette';
import { createSharedUniforms } from '../src/shared/uniforms';
import { generateBands, generateFunnels, generateJet, generateSky, generateUnderpaint, SKY_CLASSES, skyDepthViolations } from '../src/sky/skyGen';
import { createBackdrop } from '../src/sky/backdrop';
import { createDust } from '../src/sky/dust';
import { skyPreviewMesh } from './skyPreview';
import { animate, canvasGrid, classCounts, classDepthRanges, previewMesh, RecordingSink, setupPreview } from './lib/preview';

const qs = new URLSearchParams(location.search);
const view = qs.get('view') ?? 'canvas';
const DEFAULT_T: Record<string, number> = { zoom: 0, canvas: 0, profile: 48, profileb: 52, funnel: 60, jet: 32, eye: 71, coverage: 0, backdrop: 0 };
const t = Number(qs.get('t') ?? DEFAULT_T[view] ?? 0);
const W = window.innerWidth || 1280;
const H = window.innerHeight || 720;
const report: Record<string, unknown> = { view, t };
const log = (k: string, v: unknown) => {
  report[k] = v;
  console.log(`[sky] ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
};

// ------------------------------------------------------------------ generate + checks
const sink = new RecordingSink();
const t0 = performance.now();
generateSky(sink, forkRng(1, 'sky'));
log('genMs', Math.round(performance.now() - t0));
{
  // second (warm) run, per part
  const parts: Record<string, number> = {};
  const scratch = new RecordingSink();
  const time = (k: string, fn: () => void) => { const a = performance.now(); fn(); parts[k] = Math.round(performance.now() - a); };
  time('total', () => generateSky(new RecordingSink(), forkRng(2, 'sky')));
  let nNull = 0;
  time('totalNullSink', () => generateSky({ push: () => { nNull++; }, get count() { return nNull; } }, forkRng(3, 'sky')));
  time('underpaint', () => generateUnderpaint(scratch, mulberry32(1)));
  time('bands', () => generateBands(scratch, mulberry32(2)));
  time('funnels', () => generateFunnels(scratch, mulberry32(3)));
  time('jet', () => generateJet(scratch, mulberry32(4)));
  log('genMsWarm', parts);
}
const all = sink.records;
log('counts', classCounts(all));
const under: Record<string, number> = {};
const outlined: Record<string, number> = {};
for (const r of all) {
  if (r.flags & StrokeFlag.UNDERLAYER) under[StrokeClass[r.cls]] = (under[StrokeClass[r.cls]] ?? 0) + 1;
  if (r.flags & StrokeFlag.OUTLINE) outlined[StrokeClass[r.cls]] = (outlined[StrokeClass[r.cls]] ?? 0) + 1;
}
log('underlayer', under);
log('outlined', outlined);
const ranges = classDepthRanges(all);
log('depthRanges', Object.fromEntries(Object.entries(ranges).map(([k, [a, b]]) => [k, [Math.round(a), Math.round(b)]])));

const errors: string[] = [];
// every class within CLASS_INFO dRange
const dv = skyDepthViolations(all);
if (dv.length) errors.push(...dv);
// budgets
const counts = classCounts(all);
for (const c of SKY_CLASSES) {
  const n = counts[StrokeClass[c]] ?? 0;
  if (n > CLASS_INFO[c].budgetHigh) errors.push(`${StrokeClass[c]} count ${n} > budgetHigh ${CLASS_INFO[c].budgetHigh}`);
}
// paint order: SWIRL / EDDY < SKY_BAND < UNDERPAINT (every d)
const order: [StrokeClass, StrokeClass][] = [
  [StrokeClass.SWIRL, StrokeClass.SKY_BAND], [StrokeClass.EDDY, StrokeClass.SKY_BAND], [StrokeClass.SKY_BAND, StrokeClass.UNDERPAINT],
  [StrokeClass.WIND_JET, StrokeClass.SWIRL],
];
for (const [a, b] of order) {
  const ra = ranges[StrokeClass[a]];
  const rb = ranges[StrokeClass[b]];
  if (!(ra[1] < rb[0])) errors.push(`paint order ${StrokeClass[a]} max ${ra[1].toFixed(0)} !< ${StrokeClass[b]} min ${rb[0].toFixed(0)}`);
}
// finite fields, vortex encodings, seeds
for (const r of all) {
  const vals = [r.u, r.v, r.d, r.du, r.dv, r.dlnd, r.w, r.colA, r.colB, r.emissive, r.seed, r.kappa, r.q1, r.q2, r.q3];
  if (!vals.every(Number.isFinite)) { errors.push(`non-finite field in ${StrokeClass[r.cls]}`); break; }
  if (r.seed < 0 || r.seed >= 1) { errors.push(`seed out of [0,1): ${r.seed}`); break; }
  if (CLASS_INFO[r.cls].anim === 1 /* VORTEX */) {
    const vi = Math.floor(r.q1 / 2);
    if (vi < 0 || vi >= VORTICES.length || r.q2 < 0 || r.q2 >= 1 || Math.abs(r.q3) > 1 || r.dv !== 0 || r.dlnd !== 0) {
      errors.push(`bad VORTEX encoding q1=${r.q1} q2=${r.q2} q3=${r.q3}`);
      break;
    }
    // record (u, v, d) must equal the t = 0 animated position
    const a = animate(r, 0);
    const e = Math.max(Math.abs(a.u - r.u), Math.abs(a.v - r.v), Math.abs(a.d / r.d - (r.flags & StrokeFlag.UNDERLAYER ? 1 / 1.01 : 1)));
    if (e > 1e-6) { errors.push(`VORTEX record not at its t=0 position (err ${e.toExponential(2)})`); break; }
  }
}
log('errors', errors);
if (errors.length) console.error(`[sky] ${errors.length} check(s) failed:\n  ${errors.join('\n  ')}`);

// ------------------------------------------------------------------ scene
const shown = (() => {
  const want = qs.get('cls')?.split(',').map((s) => StrokeClass[s.trim() as keyof typeof StrokeClass]);
  const noUnder = qs.get('under') === '0';
  return all.filter((r) => (!want || want.includes(r.cls)) && !(noUnder && r.flags & StrokeFlag.UNDERLAYER));
})();

const pv = setupPreview(W, H);
const { renderer, camera, scene } = pv;
const u = createSharedUniforms();
u.uTime.value = t;
u.uViewportH.value = H;
const q = QUALITY_PRESETS.high;
const deg = Math.PI / 180;

function setCamera(): void {
  const c1 = VORTICES[0];
  switch (view) {
    case 'profile': pv.look({ x: -22600, y: 44000, z: -31700 }, { x: 504, y: 16173, z: -60114 }, Number(qs.get('fov') ?? 56)); break;
    case 'profileb': pv.look({ x: -18201, y: 40775, z: -44746 }, { x: 504, y: 16173, z: -60114 }, Number(qs.get('fov') ?? 56)); break;
    case 'jet': pv.look({ x: -45, y: 210, z: -235 }, canvasToWorld(0.3, 0.72, 12000), Number(qs.get('fov') ?? 78)); break;
    case 'eye': pv.look({ x: -2501, y: 12196, z: -42537 }, EYE, Number(qs.get('fov') ?? 26)); break;
    case 'funnel': {
      const r = Number(qs.get('r') ?? 0.06);
      const th = Number(qs.get('th') ?? -90) * deg;
      const d = c1.dThroat * Math.pow(r / c1.r0, c1.expo);
      const pos = canvasToWorld(c1.u + (0.8 * r * Math.cos(th)) / CANVAS_ASPECT, c1.v + 0.8 * r * Math.sin(th), d);
      const tgt = canvasToWorld(c1.u, c1.v, d - 6000);
      pv.look(pos, tgt, Number(qs.get('fov') ?? 72));
      break;
    }
    case 'zoom': {
      // from E (exact anamorphic view) aimed at canvas point (cu, cv) with a narrow fov
      const tgt = canvasToWorld(Number(qs.get('cu') ?? 0.51), Number(qs.get('cv') ?? 0.64), 1000);
      pv.look(EYE, tgt, Number(qs.get('fov') ?? 14));
      break;
    }
    case 'backdrop': {
      pv.pose();
      camera.rotateY(Number(qs.get('yaw') ?? 0) * deg);
      camera.rotateX(Number(qs.get('pitch') ?? 0) * deg);
      if (qs.get('fov')) { camera.fov = Number(qs.get('fov')); camera.updateProjectionMatrix(); }
      break;
    }
    default: pv.pose();
  }
  camera.updateMatrixWorld();
}
setCamera();
const offAxis = camera.position.distanceTo(EYE);
u.uOff.value = Number(qs.get('off') ?? (offAxis > 0.5 ? 1 : 0));
u.uPxPerRad.value = H / (2 * Math.tan((camera.fov * deg) / 2));
log('camera', { pos: camera.position.toArray().map(Math.round), fov: +camera.fov.toFixed(2), uOff: u.uOff.value });

if (view === 'coverage') {
  runCoverage();
} else {
  if (qs.get('bd') !== '0') scene.add(createBackdrop(u, q));
  if (view !== 'backdrop') {
    const t1 = performance.now();
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const pstats: Record<string, number> = {};
    scene.add(qs.get('lib') === '1' ? previewMesh(shown, t)
      : skyPreviewMesh(shown, t, { camPos: camera.position, camFwd: fwd, uOff: u.uOff.value, pxPerRad: u.uPxPerRad.value, viewportH: H, guards: qs.get('guards') !== '0', stats: pstats }));
    log('previewStats', pstats);
    log('meshMs', Math.round(performance.now() - t1));
    if (qs.get('dust') !== '0') scene.add(createDust(u, q, mulberry32(9)));
  }
  if ((view === 'canvas' && qs.get('grid') !== '0') || qs.get('grid') === '1') scene.add(canvasGrid());
  pv.render();
  const gl = renderer.getContext();
  const err = gl.getError();
  if (err) console.error(`[sky] GL error ${err}`);
}

// ------------------------------------------------------------------ coverage from E
/**
 * Draws every shown record as a tapered polygon in canvas space (the M3 ribbon width profile up to s = 0.85, where
 * the dry-brush tail starts thinning), additively counting layers, then reports per-region layer statistics.
 */
function runCoverage(): void {
  const aspect = W / H;
  const sx = (2 * CANVAS_ASPECT) / aspect; // canvas u -> NDC x scale at the canvas pose (aspect >= A)
  // &ext=1: the whole extended extent (SKY_GEN_U x SKY_GEN_V + margin) mapped flat onto the image instead of the pose
  const ext = qs.get('ext') === '1';
  const EU: [number, number] = [SKY_GEN_U[0] - 0.05, SKY_GEN_U[1] + 0.05];
  const EV: [number, number] = [SKY_GEN_V[0] - 0.05, SKY_GEN_V[1] + 0.05];
  const toNdc = (u: number, v: number): [number, number, number] => ext
    ? [((u - EU[0]) / (EU[1] - EU[0])) * 2 - 1, ((v - EV[0]) / (EV[1] - EV[0])) * 2 - 1, 0]
    : [(u - 0.5) * sx, (v - 0.5) * 2, 0];
  const fromPx = (x: number, y: number): [number, number] => ext
    ? [EU[0] + ((x + 0.5) / W) * (EU[1] - EU[0]), EV[0] + ((y + 0.5) / H) * (EV[1] - EV[0])]
    : [0.5 + (((x + 0.5) / W - 0.5) * 2) / sx, 0.5 + ((y + 0.5) / H - 0.5)];
  const stations: [number, number][] = [[0, 0], [0.08, 0.77], [0.5, 0.8], [0.85, 0.6]];
  const pos: number[] = [];
  const tmp: [number, number][] = [];
  for (const r of shown) {
    const a = animate(r, t);
    const L = Math.hypot(a.du, a.dv);
    if (L < 1e-9) continue;
    const tx = a.du / L, ty = a.dv / L; // h-units
    const hw = 0.5 * r.w * (r.flags & StrokeFlag.UNDERLAYER ? 3 : 1);
    tmp.length = 0;
    for (const [s, k] of stations) {
      const cx = a.u * CANVAS_ASPECT + (s - 0.5) * a.du;
      const cy = a.v + (s - 0.5) * a.dv;
      tmp.push([cx - ty * hw * k, cy + tx * hw * k], [cx + ty * hw * k, cy - tx * hw * k]);
    }
    const ndc = (p: [number, number]) => toNdc(p[0] / CANVAS_ASPECT, p[1]);
    for (let i = 0; i < stations.length - 1; i++) {
      const p0 = ndc(tmp[2 * i]), p1 = ndc(tmp[2 * i + 1]), p2 = ndc(tmp[2 * i + 2]), p3 = ndc(tmp[2 * i + 3]);
      pos.push(...p0, ...p1, ...p2, ...p1, ...p3, ...p2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.ShaderMaterial({
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(1.0/255.0, 0.0, 0.0, 1.0); }',
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat });
  const cs = new THREE.Scene();
  cs.add(mesh);
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(cs, new THREE.Camera());
  const px = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
  renderer.setRenderTarget(null);
  // statistics per region (canvas u, v of each pixel at the canvas pose)
  const hist = { sky: [0, 0, 0, 0], skyN: 0, earth: [0, 0, 0, 0], earthN: 0 };
  let skyMin = 255;
  const skyHoles: [number, number][] = [];
  // ext: the extension outside GEN and outside the SKY_EDGE_FADE dissolve band (strokes there fade on purpose)
  const extHist = [0, 0, 0, 0];
  let extN = 0;
  const F = SKY_EDGE_FADE;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [uu, v] = fromPx(x, y);
      const c = px[(y * W + x) * 4];
      if (ext) {
        const inGen = uu >= GEN_U[0] && uu <= GEN_U[1] && v <= GEN_V[1];
        const inCore = uu >= SKY_GEN_U[0] + F && uu <= SKY_GEN_U[1] - F && v <= SKY_GEN_V[1] - F;
        if (!inGen && inCore && v > ridgeV(uu, 2) + 0.004) {
          extN++;
          for (let k = 1; k <= 3; k++) if (c < k) extHist[k]++;
        }
        if (!(uu >= GEN_U[0] && uu <= GEN_U[1] && v >= 0 && v <= 1)) continue; // GEN stats over the frame only
      }
      const sky = v > ridgeV(uu, 2) + 0.004;
      const hk = sky ? hist.sky : hist.earth;
      for (let k = 1; k <= 3; k++) if (c < k) hk[k]++;
      if (sky) {
        hist.skyN++;
        if (c < skyMin) skyMin = c;
        if (c < 3 && skyHoles.length < 12) skyHoles.push([+uu.toFixed(3), +v.toFixed(3)]);
      } else hist.earthN++;
    }
  }
  const pct = (a: number, n: number) => +((100 * a) / Math.max(1, n)).toFixed(3);
  log('coverage', {
    skyPixels: hist.skyN, skyMinLayers: skyMin,
    skyPctBelow1: pct(hist.sky[1], hist.skyN), skyPctBelow2: pct(hist.sky[2], hist.skyN), skyPctBelow3: pct(hist.sky[3], hist.skyN),
    earthPctBelow1: pct(hist.earth[1], hist.earthN), earthPctBelow2: pct(hist.earth[2], hist.earthN),
    firstSkyPixelsBelow3: skyHoles,
  });
  if (ext) log('coverageExt', { pixels: extN, pctBelow1: pct(extHist[1], extN), pctBelow2: pct(extHist[2], extN), pctBelow3: pct(extHist[3], extN) });
  // heat map: red 0, orange 1, yellow 2, then grey ramp by layer count (white = 24+)
  const tex = new THREE.DataTexture(px, W, H, THREE.RGBAFormat);
  tex.needsUpdate = true;
  const heat = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D uTex; varying vec2 vUv;
      void main(){ float c = floor(texture2D(uTex, vUv).r * 255.0 + 0.5);
        vec3 col = c < 0.5 ? vec3(1.0, 0.0, 0.0) : c < 1.5 ? vec3(1.0, 0.45, 0.0) : c < 2.5 ? vec3(1.0, 1.0, 0.0) : vec3(0.15 + 0.85 * clamp((c - 3.0) / 21.0, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0); }`,
  }));
  heat.frustumCulled = false;
  const hs = new THREE.Scene();
  hs.add(heat);
  if (qs.get('grid') !== '0' && !ext) hs.add(canvasGrid());
  pv.pose();
  renderer.setClearColor(0x050a18, 1);
  renderer.render(hs, camera);
}

(window as unknown as { __flow: unknown; __mix: unknown }).__flow = flowField; // debug probes for --eval
(window as unknown as { __mix: unknown }).__mix = mixHex;
(window as unknown as { __report: unknown; __ready: boolean }).__report = report;
(window as unknown as { __ready: boolean }).__ready = true;

