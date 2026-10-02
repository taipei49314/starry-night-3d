// M1 self-test: (A) pure DynamicResolution unit tests on synthetic dt sequences, (B) tier-string classifier,
// (C) the real engine on a test scene of instanced canvas-space quads (ShaderMaterial + logdepth + GLSL_PRELUDE),
// ~200 rAF frames, then setTier / resize / dispose checks.  ?tier=high|medium|low forces the engine tier.
import * as THREE from 'three';
import { CAMERA_FAR, CAMERA_NEAR, PALETTE, QUALITY_PRESETS, type QualitySettings, type Tier } from '../src/contracts';
import { canvasPoseFovDeg, EYE, FORWARD } from '../src/shared/canvasSpace';
import { mulberry32 } from '../src/shared/rng';
import { createSharedUniforms } from '../src/shared/uniforms';
import { GLSL_PRELUDE } from '../src/shared/glsl/flow.glsl';
import { createEngine } from '../src/engine/engine';
import {
  CHANGE_GAP_MS, DynamicResolution, MAX_DT_MS, PINNED_MS, scaleStepsFor, UP_BAN_MS, type DynResAction,
} from '../src/engine/dynamicRes';
import { lowerTier, parseTier, tierFromRendererString } from '../src/engine/tiers';

const out = document.getElementById('out')!;
const checks: { name: string; ok: boolean; detail: string }[] = [];
const log = (s: string) => (out.textContent += s + '\n');
const check = (name: string, ok: boolean, detail = '') => {
  checks.push({ name, ok, detail });
  log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ': ' + detail : ''}`);
  if (!ok) console.error(`FAIL ${name}: ${detail}`);
};
const q = (t: Tier): QualitySettings => ({ ...QUALITY_PRESETS[t] });
const presetsBefore = JSON.stringify(QUALITY_PRESETS);

// ============================================================== (A) DynamicResolution, pure
type Act = Exclude<DynResAction, { kind: 'none' }>;
/** Feed n frames; gpu = null (rAF mode), a number (one GPU sample per frame) or a per-frame function. */
function feed(dr: DynamicResolution, n: number, dt: number, gpu: number | null | ((i: number) => number[] | null), bench = false, acts: Act[] = []): Act[] {
  for (let i = 0; i < n; i++) {
    const g = typeof gpu === 'function' ? gpu(i) : gpu === null ? null : [gpu];
    const a = dr.update(dt, g, bench);
    if (a.kind !== 'none') acts.push(a);
  }
  return acts;
}
const fmtActs = (a: Act[]) => a.map((x) => (x.kind === 'scale' ? `${x.reason} ${x.from}->${x.scale}@${x.atMs.toFixed(0)}` : `tierDrop(${x.reason})@${x.atMs.toFixed(0)}`)).join(', ') || '(none)';
/** Scale changes other than reverts must be >= 2 s apart (tier drops reset the gap). */
const gapsOk = (a: Act[]) => {
  let last = 0;
  for (const x of a) {
    if (x.kind === 'tierDrop') { last = x.atMs; continue; }
    if (x.reason !== 'revert' && x.atMs - last < CHANGE_GAP_MS - 1e-9) return false;
    last = x.atMs;
  }
  return true;
};
const unit: Record<string, string> = {};

{ // steps clamped to the tier range
  const s = (t: Tier) => scaleStepsFor(QUALITY_PRESETS[t]).join(',');
  check('steps high', s('high') === '0.75,0.85,1', s('high'));
  check('steps medium', s('medium') === '0.6,0.67,0.75,0.85,1', s('medium'));
  check('steps low', s('low') === '0.5,0.6,0.67,0.75,0.8', s('low'));
  const dr = new DynamicResolution(q('low'));
  check('init scale = renderScaleInit', dr.scale === 0.67 && new DynamicResolution(q('high')).scale === 1 && new DynamicResolution(q('medium')).scale === 0.85, `${dr.scale}`);
}

{ // slow -> steps down, then pinned at the minimum -> tier drop (timer-query mode, High: 1.0 / 0.85 / 0.75)
  const dr = new DynamicResolution(q('high'));
  const a = feed(dr, 450, 16.7, 25); // 7.5 s: one pinned drop at ~6 s (the caller would switch tier there)
  unit.slowHigh = fmtActs(a);
  const [d1, d2, td] = a;
  check('slow: first down 1->0.85 after the 2 s boot gap', d1?.kind === 'scale' && d1.reason === 'down' && d1.from === 1 && d1.scale === 0.85 && d1.atMs >= 2000 && d1.atMs < 2050, fmtActs(a));
  check('slow: second down 0.85->0.75 >= 2 s later', d2?.kind === 'scale' && d2.reason === 'down' && d2.scale === 0.75 && d2.atMs - d1.atMs >= CHANGE_GAP_MS && d2.atMs - d1.atMs < 2050, fmtActs(a));
  check('pinned at min 2 s -> tier drop', td?.kind === 'tierDrop' && td.reason === 'pinned' && td.atMs - d2.atMs >= PINNED_MS && td.atMs - d2.atMs < PINNED_MS + 50 && a.length === 3, fmtActs(a));
  check('slow: <= 1 change per 2 s', gapsOk(a));
  // engine-style continuation: tier drop -> medium preset, slow again -> steps resume from 0.85 after 2 s
  dr.setQuality(q('medium'));
  const t0 = dr.clockMs;
  const b = feed(dr, 200, 16.7, 25);
  const b0 = b[0];
  check('after tier drop: scale := medium init, next down >= 2 s later', dr.steps.length === 5 && b0?.kind === 'scale' && b0.from === 0.85 && b0.scale === 0.75 && b0.atMs - t0 >= CHANGE_GAP_MS, fmtActs(b));
}

{ // slow on Low: steps to 0.5 and stays there; Low never drops a tier
  const dr = new DynamicResolution(q('low'));
  const a = feed(dr, 1200, 16.7, null as null, false); // rAF mode, dt 16.7 is fast for Low's 22 ms target...
  check('low rAF 16.7 ms: no down-step (target 22 ms)', a.every((x) => x.kind === 'scale' && x.reason === 'up'), fmtActs(a));
  const dr2 = new DynamicResolution(q('low'));
  const b = feed(dr2, 1200, 40, null);
  unit.slowLow = fmtActs(b);
  check('low slow: 0.67 -> 0.6 -> 0.5, no tier drop', b.length === 2 && b[1].kind === 'scale' && b[1].scale === 0.5 && dr2.pinned && dr2.scale === 0.5, fmtActs(b));
}

{ // medium pinned -> drop (rAF mode, 30 ms frames)
  const dr = new DynamicResolution(q('medium'));
  const a = feed(dr, 300, 30, null); // 9 s
  unit.slowMediumRaf = fmtActs(a);
  const last = a[a.length - 1];
  check('medium rAF slow: 0.85 -> 0.75 -> 0.67 -> 0.6 then pinned drop', a.length === 4 && last.kind === 'tierDrop' && last.reason === 'pinned' && gapsOk(a), fmtActs(a));
}

{ // fast -> steps up (timer mode: EMA < 0.7 target for 120 frames)
  const dr = new DynamicResolution(q('medium'));
  const a = feed(dr, 600, 16.7, 8);
  unit.fastMediumTimer = fmtActs(a);
  check('fast timer: 0.85 -> 1.0 once, at >= 2 s, then capped at max', a.length === 1 && a[0].kind === 'scale' && a[0].reason === 'up' && a[0].scale === 1 && a[0].atMs >= 2000 && a[0].atMs < 2050, fmtActs(a));
  const dr2 = new DynamicResolution(q('medium'));
  const b = feed(dr2, 600, 16.7, 12); // 12 ms > 0.7 * 16.7 = 11.69: not fast enough
  check('timer EMA 12 ms (>= 0.7 target): no up-step', b.length === 0, fmtActs(b));
}

{ // fast -> steps up (rAF mode: dt <= 17.5 ms for 300 frames). Low: 0.67 -> 0.75 -> 0.8 (max)
  const dr = new DynamicResolution(q('low'));
  const a = feed(dr, 1500, 16, null);
  unit.fastLowRaf = fmtActs(a);
  check('fast rAF: 0.67 -> 0.75 at 300 frames, -> 0.8 at 600, capped', a.length === 2 && a[0].kind === 'scale' && a[0].scale === 0.75 && Math.abs(a[0].atMs - 300 * 16) < 1e-6 && a[1].kind === 'scale' && a[1].scale === 0.8 && Math.abs(a[1].atMs - 600 * 16) < 1e-6, fmtActs(a));
  const dr2 = new DynamicResolution(q('medium'));
  const b = feed(dr2, 299, 16.7, null);
  const c = feed(dr2, 1, 16.7, null);
  check('rAF up needs exactly 300 frames', b.length === 0 && c.length === 1 && c[0].kind === 'scale' && c[0].scale === 1, `${fmtActs(b)} | ${fmtActs(c)}`);
  const dr3 = new DynamicResolution(q('medium'));
  const d = feed(dr3, 299, 16.7, null);
  feed(dr3, 1, 18, null); // one slow frame breaks the run
  const e = feed(dr3, 299, 16.7, null);
  check('rAF up run resets on a dt > 17.5 frame', d.length === 0 && e.length === 0 && dr3.scale === 0.85, fmtActs(e));
}

{ // bad up-step -> revert + 10 s up ban
  const dr = new DynamicResolution(q('medium'));
  const up = feed(dr, 125, 16.7, 8);
  const rev = feed(dr, 120, 16.7, 30);
  const fast = feed(dr, 1200, 16.7, 8);
  unit.revert = `${fmtActs(up)} | ${fmtActs(rev)} | ${fmtActs(fast)}`;
  const u0 = up[0], r0 = rev[0], f0 = fast[0];
  check('up-step happened', up.length === 1 && u0.kind === 'scale' && u0.reason === 'up' && u0.scale === 1, fmtActs(up));
  check('down within 2 s of the up-step -> revert (exempt from the 2 s gap)', rev.length === 1 && r0.kind === 'scale' && r0.reason === 'revert' && r0.scale === 0.85 && r0.atMs - u0.atMs < 2000, fmtActs(rev));
  check('up-steps banned for 10 s after the revert', f0?.kind === 'scale' && f0.reason === 'up' && f0.atMs - r0.atMs >= UP_BAN_MS && f0.atMs - r0.atMs < UP_BAN_MS + 50, fmtActs(fast));
  // a down-step later than 2 s after an up-step is a plain down (no ban)
  const dr2 = new DynamicResolution(q('medium'));
  const u2 = feed(dr2, 125, 16.7, 8);
  feed(dr2, 140, 16.7, 16); // ~2.3 s neutral (16 ms: neither fast nor slow)
  const d2 = feed(dr2, 60, 16.7, 30);
  check('down > 2 s after up-step is a plain down, no ban', u2.length === 1 && d2.length === 1 && d2[0].kind === 'scale' && d2[0].reason === 'down' && !dr2.upBanned, fmtActs(d2));
}

{ // benchmark median rule (frames 60..150 benchmarking; scale changes frozen meanwhile)
  const dr = new DynamicResolution(q('high'));
  const pre = feed(dr, 60, 16.7, 10);
  const during = feed(dr, 90, 16.7, 25, true);
  const end = feed(dr, 1, 16.7, 10, false);
  unit.benchHigh = `${fmtActs(pre)} | ${fmtActs(during)} | ${fmtActs(end)} | median ${dr.lastBenchmark?.median}`;
  check('benchmark: no scale change while benchmarking', pre.length === 0 && during.length === 0, fmtActs(during));
  check('benchmark median 25 > 1.3*16.7 -> tier drop on the falling edge', end.length === 1 && end[0].kind === 'tierDrop' && end[0].reason === 'benchmark' && end[0].median === 25 && dr.lastBenchmark?.n === 90, fmtActs(end));
  const dr2 = new DynamicResolution(q('high'));
  feed(dr2, 30, 20, null);
  const e2 = feed(dr2, 90, 20, null, true).concat(feed(dr2, 1, 16.7, null));
  check('benchmark median 20 <= 21.71 -> no drop', !e2.some((x) => x.kind === 'tierDrop') && dr2.lastBenchmark?.median === 20 && dr2.lastBenchmark.dropped === false, `${fmtActs(e2)} median ${dr2.lastBenchmark?.median}`);
  const dr3 = new DynamicResolution(q('low'));
  const e3 = feed(dr3, 90, 40, null, true).concat(feed(dr3, 1, 40, null));
  check('benchmark on Low never drops', !e3.some((x) => x.kind === 'tierDrop') && dr3.lastBenchmark?.median === 40 && dr3.lastBenchmark.dropped === false, fmtActs(e3));
  const dr4 = new DynamicResolution(q('medium'));
  const seq = [10, 20, 30, 40];
  feed(dr4, 4, 16.7, (i) => [seq[i]], true);
  feed(dr4, 1, 16.7, (): number[] => [], false);
  check('benchmark median of even count averages the middle pair', dr4.lastBenchmark?.median === 25, `${dr4.lastBenchmark?.median}`);
  // median robust to a few hitch frames
  const dr5 = new DynamicResolution(q('high'));
  const e5 = feed(dr5, 90, 16.7, (i) => [i % 10 === 0 ? 200 : 12], true).concat(feed(dr5, 1, 16.7, 12));
  check('benchmark ignores sparse hitches (median)', !e5.some((x) => x.kind === 'tierDrop') && dr5.lastBenchmark?.median === 12, `${dr5.lastBenchmark?.median}`);
}

{ // hitch guard, timer waiting, mode switch
  const dr = new DynamicResolution(q('high'));
  const a = feed(dr, 200, 16.7, null).concat(feed(dr, 1, 5000, null), feed(dr, 300, 16.7, null));
  check(`one 5000 ms hitch (clamped to ${MAX_DT_MS}) causes no down-step`, a.length === 0, fmtActs(a));
  const dr2 = new DynamicResolution(q('medium'));
  const b = feed(dr2, 300, 16.7, (): number[] => []);
  check('timer mode without results: EMA null, no action', b.length === 0 && dr2.ema === null && dr2.usingTimer, fmtActs(b));
  feed(dr2, 1, 16.7, 9);
  const e1 = dr2.ema;
  feed(dr2, 1, 16.7, null);
  check('timer -> rAF switch restarts the EMA from the new source', e1 === 9 && dr2.ema === 16.7 && !dr2.usingTimer, `${e1} -> ${dr2.ema}`);
}

// ============================================================== (B) tiers
{
  const cases: [string, Tier][] = [
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Laptop GPU (0x00002D59) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'high'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'low'],
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'low'],
    ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'low'],
    ['llvmpipe (LLVM 15.0.7, 256 bits)', 'low'],
    ['Mesa Intel(R) Xe Graphics (TGL GT2)', 'low'],
    ['ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'low'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)', 'medium'],
    ['Apple GPU', 'medium'],
    ['Adreno (TM) 740', 'medium'],
    ['Mali-G78 MC24', 'medium'],
    ['ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'medium'],
    ['ANGLE (AMD, AMD Radeon RX 7800 XT (0x0000747E) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'high'],
    ['WebKit WebGL', 'high'],
    ['', 'high'],
  ];
  const bad = cases.filter(([s, t]) => tierFromRendererString(s) !== t).map(([s, t]) => `${s} -> ${tierFromRendererString(s)} (want ${t})`);
  check(`tier regex (${cases.length} strings)`, bad.length === 0, bad.join('; '));
  check('lowerTier chain', lowerTier('high') === 'medium' && lowerTier('medium') === 'low' && lowerTier('low') === null);
  check('parseTier', parseTier('low') === 'low' && parseTier('ultra') === null && parseTier(null) === null);
}

// ============================================================== (C) engine on a test scene
// ?tier=  force a tier;  ?frames=N  rAF frames (default 200);  ?heavy=K  fullscreen fragment loop of K noise taps
// (GPU cost ~ pixels * K, so render-scale steps really reduce it);  ?quiet  hide the text overlay.
const params = new URLSearchParams(location.search);
const forced = parseTier(params.get('tier'));
const FRAMES = Math.max(1, Number(params.get('frames') ?? 200) | 0);
const HEAVY = Math.max(0, Number(params.get('heavy') ?? 0) | 0);
if (params.has('quiet')) out.style.display = 'none';
const stage = document.getElementById('stage')!;
const engine = createEngine(stage, forced ? { tier: forced } : {});
const { renderer, camera, canvas } = engine;
const gl = renderer.getContext();
const attrs = gl.getContextAttributes();
const dpr = window.devicePixelRatio || 1;

check('canvas fills container', canvas.parentElement === stage && canvas.style.width === '100%' && canvas.style.height === '100%' && canvas.style.display === 'block' && canvas.clientWidth === stage.clientWidth && canvas.clientHeight === stage.clientHeight, `${canvas.clientWidth}x${canvas.clientHeight} in ${stage.clientWidth}x${stage.clientHeight}`);
check('renderer flags', renderer.capabilities.logarithmicDepthBuffer && renderer.toneMapping === THREE.NeutralToneMapping && renderer.outputColorSpace === THREE.SRGBColorSpace && attrs?.antialias === false && attrs?.stencil === false && attrs?.depth === true && attrs?.powerPreference === 'high-performance' &&
  // three r186 always creates the context with alpha: true; `alpha: false` becomes clear alpha 1 (+ opaque CSS background)
  renderer.getClearAlpha() === 1 && canvas.style.backgroundColor !== '', JSON.stringify(attrs));
check('camera planes', camera.near === CAMERA_NEAR && camera.far === CAMERA_FAR && camera.fov === 36 && Math.abs(camera.aspect - engine.cssWidth / engine.cssHeight) < 1e-12, `near ${camera.near} far ${camera.far} fov ${camera.fov} aspect ${camera.aspect.toFixed(4)}`);
const tier0 = engine.quality.tier;
check('quality is a copy of the preset', engine.quality !== QUALITY_PRESETS[tier0] && JSON.stringify(engine.quality) === JSON.stringify(QUALITY_PRESETS[tier0]) && (forced ? tier0 === forced : tier0 === engine.detectedTier), `tier ${tier0} (detected ${engine.detectedTier}${forced ? ', forced ' + forced : ''})`);
const prExpected = (t: QualitySettings, s: number) => Math.min(dpr, t.maxPixelRatio) * s;
check('initial scale and pixel ratio', engine.renderScale === engine.quality.renderScaleInit && Math.abs(engine.pixelRatio - prExpected(engine.quality, engine.renderScale)) < 1e-12 && renderer.getPixelRatio() === engine.pixelRatio && canvas.width === Math.floor(engine.cssWidth * engine.pixelRatio) && canvas.height === Math.floor(engine.cssHeight * engine.pixelRatio), `scale ${engine.renderScale} pr ${engine.pixelRatio} buffer ${canvas.width}x${canvas.height} css ${engine.cssWidth}x${engine.cssHeight} dpr ${dpr}`);

// test scene: 6000 instanced quads authored in canvas space at log-random depths 150 m .. 240 km
const uniforms = createSharedUniforms();
const N = 6000;
const rng = mulberry32(11);
const inst = new Float32Array(N * 4);
for (let i = 0; i < N; i++) {
  inst.set([rng.range(-0.3, 1.3), rng.range(-0.12, 1.1), Math.exp(rng.range(Math.log(150), Math.log(240_000))), rng.next()], i * 4);
}
const geo = new THREE.InstancedBufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0], 3));
geo.setIndex([0, 1, 2, 1, 3, 2]);
geo.setAttribute('aStroke', new THREE.InstancedBufferAttribute(inst, 4));
geo.instanceCount = N;
const mat = new THREE.ShaderMaterial({
  uniforms: { ...uniforms, uEngineTint: { value: 1 } },
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `#include <common>
#include <logdepthbuf_pars_vertex>
${GLSL_PRELUDE}
attribute vec4 aStroke;   // u, v, d, seed
varying vec3 vEngCol;
varying vec2 vEngUv;
void main() {
  vec2 pH = uvToH(aStroke.xy);
  float seed = aStroke.w;
  vec2 fl = flowField(pH);
  vec2 dir = normalize(fl + vec2(1e-6, 0.0));
  dir = rot2(0.35 * sin(SN_TAU * uTime / 8.0 + SN_TAU * seed)) * dir;
  float L = 0.03 + 0.03 * seed;
  float W = 0.0065;
  vec2 offH = dir * (position.x * L) + perp(dir) * (position.y * W);
  vec3 P = canvasToWorld(aStroke.xy + hToUv(offH), aStroke.z);
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
  float sky = skyMask(pH);
  vec3 land = mix(PAL_CYPRESS_DARK, PAL_GROVE_LIGHT, hash11(seed * 91.7));
  vec3 skyc = mix(mix(PAL_ULTRAMARINE, PAL_COBALT, hash11(seed * 13.1)), PAL_CERULEAN, smoothstep(0.6, 1.0, hash11(seed * 7.3)));
  float hot = smoothstep(0.93, 1.0, hash11(seed * 3.7));
  vEngCol = mix(land, mix(skyc, PAL_CHROME * 1.4, hot), sky);
  vEngUv = position.xy + 0.5;
#include <logdepthbuf_vertex>
}`,
  fragmentShader: /* glsl */ `#include <common>
#include <logdepthbuf_pars_fragment>
${GLSL_PRELUDE}
uniform float uEngineTint;
varying vec3 vEngCol;
varying vec2 vEngUv;
void main() {
#include <logdepthbuf_fragment>
  float edge = abs(vEngUv.y - 0.5) * 2.0;
  if (edge > 0.85 + 0.15 * vnoise2(vEngUv * vec2(40.0, 3.0))) discard;
  float bristle = 0.85 + 0.15 * vnoise2(vec2(vEngUv.x * 3.0, vEngUv.y * 30.0));
  gl_FragColor = vec4(vEngCol * bristle * uEngineTint, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
});
const strokes = new THREE.Mesh(geo, mat);
strokes.frustumCulled = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.voidDeep);
scene.add(strokes);
if (HEAVY > 0) {
  // fill-cost load drawn first as the background (screen pass: no logdepth, no depth test)
  const bg = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)),
    new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uEngineHeavy: { value: HEAVY } },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `#include <common>
${GLSL_PRELUDE}
uniform float uEngineHeavy;
void main() {
  float acc = 0.0;
  for (int i = 0; i < 4096; i++) {
    if (float(i) >= uEngineHeavy) break;
    acc += vnoise3(vec3(gl_FragCoord.xy * 0.013, float(i) * 0.37 + uTime));
  }
  gl_FragColor = vec4(PAL_VOID_DEEP + 0.05 * PAL_PRUSSIAN * acc / uEngineHeavy, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -1;
  scene.add(bg);
}

const pose = () => {
  camera.position.copy(EYE);
  camera.up.set(0, 1, 0);
  camera.lookAt(EYE.clone().addScaledVector(FORWARD, 1000));
  camera.fov = canvasPoseFovDeg(engine.cssWidth / engine.cssHeight);
  camera.updateProjectionMatrix();
};
const events: string[] = [];
engine.onResize((w, h, pr) => {
  events.push(`resize ${w}x${h}@${pr.toFixed(4)}`);
  pose();
});
engine.onQualityChange((qq) => events.push(`quality ${qq.tier}`));
pose();

const frameDts: number[] = [];
const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

async function run() {
  let last = await nextFrame();
  for (let frame = 0; frame < FRAMES; frame++) {
    const now = await nextFrame();
    const dt = now - last;
    last = now;
    frameDts.push(dt);
    uniforms.uTime.value = (now / 1000) % 96;
    engine.beginFrame();
    renderer.render(scene, camera);
    engine.endFrame();
    engine.updateDynamicResolution(dt, frame >= 30 && frame <= 120);
  }
  const dr = engine.dynamicResolution;
  const s = engine.stats;
  const sorted = frameDts.slice().sort((a, b) => a - b);
  log(`\nGPU: ${engine.rendererName}`);
  log(`tier detected ${engine.detectedTier}${forced ? ` forced ${forced}` : ''} -> now ${engine.quality.tier}; scale ${engine.renderScale}; pr ${engine.pixelRatio.toFixed(4)}; buffer ${canvas.width}x${canvas.height}`);
  log(`stats fps ${s.fps.toFixed(1)} frameMs ${s.frameMs.toFixed(2)} gpuMs ${s.gpuMs === null ? 'null' : s.gpuMs.toFixed(3)}; timer ${engine.gpuTimerActive}; dt median ${sorted[sorted.length >> 1].toFixed(1)} p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)}`);
  log(`benchmark ${JSON.stringify(dr.lastBenchmark)}; dynres EMA ${dr.ema?.toFixed(2)} actions: ${fmtActs(engine.actionLog as Act[])}`);
  log(`events: ${events.join(', ') || '(none)'}`);

  check(`${FRAMES} frames rendered`, frameDts.length === FRAMES && s.fps > 0 && s.frameMs > 0, `fps ${s.fps.toFixed(1)}`);
  const hasTimer = !!gl.getExtension('EXT_disjoint_timer_query_webgl2');
  check('gpuMs null iff no timer query', hasTimer ? (s.gpuMs === null || s.gpuMs > 0) : s.gpuMs === null, `ext ${hasTimer} gpuMs ${s.gpuMs}`);
  check('benchmark ran over frames 30-120', dr.lastBenchmark !== null && dr.lastBenchmark.n > 0, JSON.stringify(dr.lastBenchmark));
  const tierNow = engine.quality.tier;
  check('engine state consistent with dynres', engine.renderScale === dr.scale && tierNow === dr.tier && Math.abs(engine.pixelRatio - prExpected(engine.quality, engine.renderScale)) < 1e-12 && canvas.width === Math.floor(engine.cssWidth * engine.pixelRatio), `scale ${engine.renderScale} vs ${dr.scale}, tier ${tierNow} vs ${dr.tier}`);
  const acts = engine.actionLog;
  const nScale = acts.filter((a) => a.kind === 'scale').length;
  const nDrop = acts.filter((a) => a.kind === 'tierDrop').length;
  const nQ = events.filter((e) => e.startsWith('quality')).length;
  const nR = events.filter((e) => e.startsWith('resize')).length;
  const order = ['high', 'medium', 'low'];
  check('every dynres action reached the engine (resize per step, quality+resize per tier drop)', nQ === nDrop && nR === nScale + nDrop && order.indexOf(tier0) + nDrop === order.indexOf(tierNow), `${nScale} steps, ${nDrop} drops, ${nQ} quality / ${nR} resize events, ${tier0} -> ${tierNow}`);
  const shot1 = await capture('run');

  // ---- setTier: onQualityChange then onResize, scale := init, pixel ratio and buffer follow
  const target: Tier = tierNow === 'medium' ? 'high' : 'medium';
  events.length = 0;
  engine.setTier(target);
  check(`setTier(${target}) fires quality then resize`, events.length === 2 && events[0] === `quality ${target}` && events[1].startsWith('resize'), events.join(', '));
  check(`setTier(${target}) state`, engine.quality.tier === target && engine.quality !== QUALITY_PRESETS[target] && engine.renderScale === QUALITY_PRESETS[target].renderScaleInit && Math.abs(engine.pixelRatio - prExpected(QUALITY_PRESETS[target], engine.renderScale)) < 1e-12 && canvas.width === Math.floor(engine.cssWidth * engine.pixelRatio) && engine.dynamicResolution.scale === engine.renderScale, `scale ${engine.renderScale} pr ${engine.pixelRatio} buffer ${canvas.width}x${canvas.height}`);
  engine.setTier('low');
  check('setTier(low) state', engine.quality.tier === 'low' && engine.renderScale === 0.67 && canvas.width === Math.floor(engine.cssWidth * Math.min(dpr, 1) * 0.67), `buffer ${canvas.width}x${canvas.height}`);
  engine.setTier(tierNow);

  // ---- container resize via ResizeObserver
  events.length = 0;
  stage.style.width = '960px';
  stage.style.height = '540px';
  await nextFrame();
  await nextFrame();
  check('ResizeObserver resize -> onResize', engine.cssWidth === 960 && engine.cssHeight === 540 && events.length === 1 && events[0].startsWith('resize 960x540') && Math.abs(camera.aspect - 960 / 540) < 1e-12 && canvas.width === Math.floor(960 * engine.pixelRatio) && canvas.clientWidth === 960, `${events.join(', ')} buffer ${canvas.width}x${canvas.height}`);
  renderer.render(scene, camera);
  stage.style.width = '100%';
  stage.style.height = '100%';
  await nextFrame();
  await nextFrame();
  check('resize back to full window', engine.cssWidth === window.innerWidth && engine.cssHeight === window.innerHeight, `${engine.cssWidth}x${engine.cssHeight}`);
  events.length = 0;
  await nextFrame();
  await nextFrame();
  check('no spurious onResize when nothing changed', events.length === 0, events.join(', '));
  renderer.render(scene, camera);

  // ---- opts.tier override + dispose on a second engine
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:0;bottom:0;width:64px;height:48px;visibility:hidden';
  document.body.appendChild(box);
  const e2 = createEngine(box, { tier: 'medium' });
  const okOpts = e2.quality.tier === 'medium' && e2.renderScale === 0.85 && e2.cssWidth === 64 && e2.cssHeight === 48;
  e2.dispose();
  e2.dispose(); // idempotent
  check('opts.tier override + dispose removes the canvas', okOpts && box.childElementCount === 0, `tier ${e2.quality.tier} css ${e2.cssWidth}x${e2.cssHeight}`);
  box.remove();
  check('QUALITY_PRESETS not mutated', JSON.stringify(QUALITY_PRESETS) === presetsBefore);

  const failed = checks.filter((c) => !c.ok);
  log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  (window as any).__report = {
    ok: failed.length === 0, passed: checks.length - failed.length, total: checks.length, failed,
    gpu: engine.rendererName, detectedTier: engine.detectedTier, tier: engine.quality.tier, renderScale: engine.renderScale,
    pixelRatio: engine.pixelRatio, buffer: [canvas.width, canvas.height], stats: { ...engine.stats }, timer: engine.gpuTimerActive,
    benchmark: engine.dynamicResolution.lastBenchmark, actions: engine.actionLog, unit, shot1,
  };
  (window as any).__ready = true;
}

/** Tiny centre-pixel probe so the report proves the scene drew something (canvas is not preserveDrawingBuffer). */
async function capture(tag: string) {
  renderer.render(scene, camera);
  const px = new Uint8Array(4);
  gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { tag, centre: Array.from(px) };
}

(window as any).__engine = engine;
run().catch((e) => {
  console.error(`harness crashed: ${e?.stack ?? e}`);
  (window as any).__ready = true;
});
