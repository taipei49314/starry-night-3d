// M9 harness: HDR emissive test scene + 12-pigment swatch strip through the full post chain.
// URL: ?scene=full|swatch|punch &bloom= &exposure= &matte= &align= &smear= &fade= &tier=high|medium|low
//      &iso=0 (isophote off) &oklab=0 &toe=0 (no Neutral toe compensation) &dither=0 &isodisp=0 &ring=<gain> &noise=<gain>
//      &pr= &cycle=1 (setQuality/setSize round trip) &perf=1 (crude per-tier timings)
// Reports window.__report (hue errors, white-field fraction, composer sample counts) and sets window.__ready.
import * as THREE from 'three';
import {
  CAMERA_FAR, CAMERA_NEAR, CANVAS_ASPECT, PALETTE, PIGMENTS, QUALITY_PRESETS, type QualitySettings, type Tier,
} from '../src/contracts';
import { srgbHexToLinear } from '../src/shared/palette';
import { mulberry32 } from '../src/shared/rng';
import { createSharedUniforms } from '../src/shared/uniforms';
import { createPost } from '../src/post/post';
import { linearToOklab, oklabHueDeg } from '../src/post/painterlyLens';

const P = new URLSearchParams(location.search);
const num = (k: string, d: number) => (P.has(k) ? Number(P.get(k)) : d);
const sceneKind = P.get('scene') ?? 'full';
const tier = (P.get('tier') ?? 'high') as Tier;
const base: QualitySettings = { ...QUALITY_PRESETS[tier] };
if (P.get('iso') === '0') base.lensIsophote = false;
if (P.get('oklab') === '0') base.lensOklab = false;
const frame = {
  bloom: num('bloom', 0.45), exposure: num('exposure', 1), matte: num('matte', 0), align: num('align', 0),
  smear: num('smear', 0), fade: num('fade', 0), time: num('t', 0),
};
const pr = num('pr', 1);

// ---------------------------------------------------------------- renderer as M1 builds it
const renderer = new THREE.WebGLRenderer({ antialias: false, logarithmicDepthBuffer: true, alpha: false, stencil: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight, false);
document.body.appendChild(renderer.domElement);
const cssW = innerWidth, cssH = innerHeight;
const aspect = cssW / cssH;

// ---------------------------------------------------------------- test scene: flat layers on a plane 100 m ahead
const camera = new THREE.PerspectiveCamera(36, aspect, CAMERA_NEAR, CAMERA_FAR);
const scene = new THREE.Scene();
const Z = 100;
const halfH = Z * Math.tan((18 * Math.PI) / 180);
const halfW = halfH * aspect;
const lin = (hex: number) => srgbHexToLinear(hex);
const scale3 = (c: readonly number[], k: number) => new THREE.Vector3(c[0] * k, c[1] * k, c[2] * k);

const VERT = `#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
#include <logdepthbuf_vertex>
}`;
const FRAG = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
void main() {
#include <logdepthbuf_fragment>
  gl_FragColor = vec4(uColor, 1.0);
}`;
let order = 0;
function add(geo: THREE.BufferGeometry, color: THREE.Vector3, sx: number, sy: number, rot = 0): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: color } }, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.set((sx - 0.5) * 2 * halfW, (sy - 0.5) * 2 * halfH, -Z);
  m.rotation.z = rot;
  m.renderOrder = order++;
  scene.add(m);
  return m;
}
/** sizes in fractions of the screen height */
const H = (f: number) => f * 2 * halfH;
const disc = (r: number) => new THREE.CircleGeometry(H(r), 64);
const ring = (r: number, w: number) => new THREE.RingGeometry(H(r - w / 2), H(r + w / 2), 128);
const quad = (w: number, h: number) => new THREE.PlaneGeometry(H(w), H(h));

const groundLin = scale3(lin(PALETTE.ultramarine), 0.3);
add(new THREE.PlaneGeometry(2 * halfW * 1.05, 2 * halfH * 1.05), groundLin, 0.5, 0.5);

const starWhite = (k: number) => {
  const a = lin(PALETTE.lemon), b = lin(PALETTE.zincWhite);
  return scale3([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], k);
};
const ringColors = [PALETTE.chrome, PALETTE.blueGreen, PALETTE.lemon, PALETTE.cerulean];

if (sceneKind === 'full') {
  const rng = mulberry32(11);
  // sky strokes at HDR 0.5..0.9
  for (let i = 0; i < 70; i++) {
    const c = rng.pick([PALETTE.cerulean, PALETTE.cobalt, PALETTE.zincWhite, PALETTE.blueGreen]);
    const sx = rng.range(0.0, 1.0), sy = rng.range(0.42, 1.0);
    add(quad(rng.range(0.05, 0.12), 0.012), scale3(lin(c), rng.range(0.5, 0.9)), sx, sy, rng.range(-0.5, 0.5));
  }
  // Venus with its concentric emissive rings 2.2 -> 1.2
  const vx = 0.3, vy = 0.7;
  for (let k = 5; k >= 0; k--) {
    add(ring(0.05 + 0.024 * k, 0.011), scale3(lin(ringColors[k % 2]), 2.2 - k * 0.2), vx, vy);
  }
  add(disc(0.022), starWhite(8), vx, vy);
  // star cores at 6, two rings each
  const stars: [number, number][] = [[0.07, 0.87], [0.42, 0.9], [0.535, 0.86], [0.66, 0.9], [0.745, 0.79], [0.64, 0.55], [0.47, 0.5]];
  for (const [sx, sy] of stars) {
    add(ring(0.03, 0.006), scale3(lin(PALETTE.chrome), 1.6), sx, sy);
    add(ring(0.045, 0.005), scale3(lin(PALETTE.blueGreen), 1.2), sx, sy);
    add(disc(0.011), starWhite(6), sx, sy);
  }
  // crescent moon 3.5 with its bell rings 1.4 -> 0.9
  const mx = 0.86, my = 0.82;
  for (let k = 3; k >= 0; k--) add(ring(0.06 + 0.017 * k, 0.006), scale3(lin(PALETTE.chrome), 1.4 - k * 0.17), mx, my);
  add(disc(0.04), scale3(lin(PALETTE.chrome), 3.5), mx, my);
  add(disc(0.034), groundLin, mx - 0.012 / aspect, my - 0.012);
  // hills band and lit windows 2.5
  add(quad(2.0, 0.12), scale3(lin(PALETTE.cypressGreen), 0.6), 0.5, 0.3);
  for (let i = 0; i < 14; i++) {
    add(quad(0.008, 0.012), scale3(lin(rng.pick([PALETTE.ochre, PALETTE.chrome])), 2.5), rng.range(0.5, 0.95), rng.range(0.26, 0.33));
  }
} else if (sceneKind === 'punchwide') {
  // stress case: solid concentric emissive bands 2.2 -> 1.2 covering ~half the frame, core 8 in the middle
  const n = 14;
  for (let k = n - 1; k >= 0; k--) {
    const r = 0.1 + 0.075 * k;
    add(ring(r, 0.035 + 0.01 * k), scale3(lin(ringColors[k % 4]), 2.2 - (1.0 * k) / (n - 1)), 0.5, 0.5);
  }
  add(disc(0.06), starWhite(8), 0.5, 0.5);
} else if (sceneKind === 'punch') {
  // inside the Venus horn (t = 37.6): 9 rings of stroke dabs, 2.2 -> 1.2, alternating chrome / blue-green,
  // over the dark sky, rings growing toward the frame edge; core 8 in the middle
  const rng = mulberry32(5);
  const n = 9;
  for (let k = n - 1; k >= 0; k--) {
    const r = 0.07 * Math.pow(1.38, k);
    const w = 0.012 + 0.006 * k;
    const val = 2.2 - (1.0 * k) / (n - 1);
    const col = lin(k % 2 === 0 ? PALETTE.chrome : PALETTE.blueGreen);
    const dabs = Math.round(18 + 10 * k);
    for (let i = 0; i < dabs; i++) {
      const a = ((i + rng.range(0, 0.3)) / dabs) * 2 * Math.PI;
      const len = ((2 * Math.PI * r) / dabs) * rng.range(0.55, 0.85);
      const rr = r * (1 + 0.04 * rng.range(-1, 1));
      add(quad(len, w * rng.range(0.7, 1.1)), scale3(col, val * rng.range(0.85, 1.0)), 0.5 + (rr * Math.cos(a)) / aspect, 0.5 + rr * Math.sin(a), a + Math.PI / 2);
    }
  }
  add(disc(0.04), starWhite(8), 0.5, 0.5);
}

// pigment strip at HDR 0.8 (all scenes except punch)
const STRIP = { x0: 0.21, x1: 0.79, y: 0.12, size: 0.07 };
const swatchCentres: [number, number][] = [];
if (!sceneKind.startsWith('punch')) {
  const pitch = (STRIP.x1 - STRIP.x0) / PIGMENTS.length;
  PIGMENTS.forEach((k, i) => {
    const sx = STRIP.x0 + (i + 0.5) * pitch;
    add(quad(STRIP.size, STRIP.size), scale3(lin(PALETTE[k]), 0.8), sx, STRIP.y);
    swatchCentres.push([sx, STRIP.y]);
  });
}

// ---------------------------------------------------------------- post chain
const u = createSharedUniforms();
const post = createPost(renderer, u, base);
if (P.get('toe') === '0' || P.get('dither') === '0' || P.get('isodisp') === '0' || P.has('ring')) {
  post.setLensOptions({
    toeCompensation: P.get('toe') !== '0', dither: P.get('dither') !== '0', isoDisplay: P.get('isodisp') !== '0',
    isoRingGain: P.has('ring') ? num('ring', 0.18) : undefined, isoNoiseGain: P.has('noise') ? num('noise', 0.1) : undefined,
  });
}
(window as unknown as { __post: unknown }).__post = post;
post.setSize(cssW, cssH, pr);

function canvasRectPx(w: number, h: number): [number, number, number, number] {
  if (w / h >= CANVAS_ASPECT) {
    const cw = Math.round(h * CANVAS_ASPECT);
    return [Math.round((w - cw) / 2), 0, cw, h];
  }
  const ch = Math.round(w / CANVAS_ASPECT);
  return [0, Math.round((h - ch) / 2), w, ch];
}
const renderFrame = () => {
  const [bw, bh] = post.bufferSize;
  post.render(scene, camera, { ...frame, canvasRectPx: canvasRectPx(bw, bh) });
};

const report: Record<string, unknown> = { scene: sceneKind, tier, frame };
const errors: string[] = [];
const gl = renderer.getContext();

function readFrame(): Uint8Array {
  const [bw, bh] = post.bufferSize;
  const px = new Uint8Array(bw * bh * 4);
  gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}
const s2l = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };

function analyse(px: Uint8Array) {
  const [bw, bh] = post.bufferSize;
  // white field: fraction of near-white pixels
  let white = 0, bright = 0;
  for (let i = 0; i < bw * bh; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    if (Math.min(r, g, b) >= 245) white++;
    if (0.2126 * r + 0.7152 * g + 0.0722 * b >= 235) bright++;
  }
  report.whiteFrac = +(white / (bw * bh)).toFixed(5);
  report.brightFrac = +(bright / (bw * bh)).toFixed(5);
  // swatch hues
  // Swatch hues: 7x7 patch average in linear light -> OKLCh. Chromatic pigments (C >= 0.02) must stay within 3 deg;
  // the near-neutral zincWhite (C = 0.007, hue ill-conditioned) is also held to an intensity-normalised
  // chromaticity shift |dab| < 0.005 (an OKLab JND is ~0.02).
  const hues: Record<string, unknown>[] = [];
  let maxErr = 0, maxErrChromatic = 0, maxDab = 0;
  swatchCentres.forEach(([sx, sy], i) => {
    const cx = Math.round(sx * bw), cy = Math.round(sy * bh);
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const o = ((cy + dy) * bw + (cx + dx)) * 4;
      r += s2l(px[o]); g += s2l(px[o + 1]); b += s2l(px[o + 2]); n++;
    }
    const key = PIGMENTS[i];
    const ref = lin(PALETTE[key]);
    const lab0 = linearToOklab(ref[0], ref[1], ref[2]);
    const h0 = oklabHueDeg(lab0);
    const lab1 = linearToOklab(r / n, g / n, b / n);
    const h1 = oklabHueDeg(lab1);
    let dh = h1 - h0;
    dh = ((dh + 540) % 360) - 180;
    const C0 = Math.hypot(lab0[1], lab0[2]);
    const k = lab0[0] / Math.max(lab1[0], 1e-6);
    const dab = Math.hypot(lab1[1] * k - lab0[1], lab1[2] * k - lab0[2]);
    maxErr = Math.max(maxErr, Math.abs(dh));
    maxDab = Math.max(maxDab, dab);
    if (C0 >= 0.02) maxErrChromatic = Math.max(maxErrChromatic, Math.abs(dh));
    const o = (cy * bw + cx) * 4;
    hues.push({ k: key, hue0: +h0.toFixed(1), hue: +h1.toFixed(1), dH: +dh.toFixed(2), C0: +C0.toFixed(3), C: +Math.hypot(lab1[1], lab1[2]).toFixed(3), dab: +dab.toFixed(4), rgb8: [px[o], px[o + 1], px[o + 2]] });
    // enforced on the isolated strip only: in the emissive scenes the bloom haze legitimately overlays the swatches
    if (sceneKind === 'swatch' && (C0 >= 0.02 ? Math.abs(dh) >= 3 : dab >= 0.005)) errors.push(`pigment ${key}: hue error ${dh.toFixed(2)} deg, |dab| ${dab.toFixed(4)} (C0 ${C0.toFixed(3)})`);
  });
  // matte geometry along the middle row: expected bar inner edge on the left = rect.x - (1 - matte) * (rect.x + barW)
  const [rx, , rw] = canvasRectPx(bw, bh);
  const barW = Math.max(4, 0.01 * bh);
  const yMid = Math.floor(bh / 2);
  const leftEdge = rx - (1 - frame.matte) * (rx + barW);
  const xs = [0, Math.floor(leftEdge) - 4, Math.floor(leftEdge) - 2, Math.floor(leftEdge) - 1, Math.floor(leftEdge), Math.floor(leftEdge) + 1, rx - 1, rx, rx + 1, rx + rw - 1, rx + rw, bw - 1]
    .filter((x) => x >= 0 && x < bw);
  report.matteRow = { leftEdgeExpected: +leftEdge.toFixed(2), rect: [rx, rw], samples: xs.map((x) => { const o = (yMid * bw + x) * 4; return [x, px[o], px[o + 1], px[o + 2]]; }) };
  if (swatchCentres.length) {
    report.hueMaxErr = +maxErr.toFixed(2);
    report.hueMaxErrChromatic = +maxErrChromatic.toFixed(2);
    report.dabMax = +maxDab.toFixed(4);
    report.hues = hues;
  }
}

function samplesReport(tag: string) {
  const c = post.composer;
  const [bw, bh] = post.bufferSize;
  const top = post.bloom.renderTargetsHorizontal[0];
  report[tag] = {
    buffer: [bw, bh], drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    rt1Samples: c.renderTarget1.samples, rt2Samples: c.renderTarget2.samples, rt1Type: c.renderTarget1.texture.type,
    rt1Size: [c.renderTarget1.width, c.renderTarget1.height],
    sceneRTSamples: post.sceneRT.samples, sceneRTSize: [post.sceneRT.width, post.sceneRT.height],
    bloomTopMip: [top.width, top.height], bloomStrength: post.bloom.strength, lensDefines: Object.keys(post.lens.defines ?? {}).join(','),
  };
  if (c.renderTarget1.samples !== 0 || c.renderTarget2.samples !== 0) errors.push(`${tag}: composer targets are multisampled`);
}

function finish() {
  samplesReport('chain');
  analyse(readFrame());
  report.errors = errors;
  for (const e of errors) console.error(e);
  (window as unknown as { __report: unknown }).__report = report;
  (window as unknown as { __ready: boolean }).__ready = true;
  console.info(`[post] ${JSON.stringify({ chain: report.chain, whiteFrac: report.whiteFrac, brightFrac: report.brightFrac, hueMaxErr: report.hueMaxErr, hueMaxErrChromatic: report.hueMaxErrChromatic, dabMax: report.dabMax })}`);
}

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
(async () => {
  renderFrame();
  await raf();
  if (P.get('cycle') === '1') {
    post.setQuality(QUALITY_PRESETS.low);
    renderFrame();
    samplesReport('afterLow');
    if (post.sceneRT.samples !== 0) errors.push('setQuality(low): sceneRT still multisampled');
    await raf();
    post.setSize(cssW / 2, cssH / 2, pr);
    renderFrame();
    samplesReport('afterHalfSize');
    await raf();
    post.setSize(cssW, cssH, pr);
    post.setQuality(base);
    renderFrame();
    samplesReport('afterRestore');
    if (post.sceneRT.samples !== base.msaa) errors.push('setQuality(restore): sceneRT sample count not restored');
    await raf();
  }
  if (P.get('perf') === '1') {
    // crude GPU cost: wall time per frame with a 1-px readPixels sync (no timer query in headless Chrome)
    const sync = new Uint8Array(4);
    const fence = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sync);
    const median = (xs: number[]) => xs.sort((a, b) => a - b)[xs.length >> 1];
    const time = (fn: () => void, n = 24) => {
      for (let i = 0; i < 4; i++) { fn(); fence(); }
      const ts: number[] = [];
      for (let i = 0; i < n; i++) { const t0 = performance.now(); fn(); fence(); ts.push(performance.now() - t0); }
      return +median(ts).toFixed(2);
    };
    const [bw, bh] = post.bufferSize;
    const rect = canvasRectPx(bw, bh);
    const perf: Record<string, number> = {};
    for (const t of ['high', 'medium', 'low'] as Tier[]) {
      post.setQuality(QUALITY_PRESETS[t]);
      perf[`${t}.sceneOnly`] = time(() => { renderer.setRenderTarget(post.sceneRT); renderer.render(scene, camera); renderer.setRenderTarget(null); });
      perf[`${t}.chain.smear0`] = time(() => post.render(scene, camera, { ...frame, smear: 0, canvasRectPx: rect }));
      perf[`${t}.chain.smear08.align1`] = time(() => post.render(scene, camera, { ...frame, smear: 0.8, align: 1, canvasRectPx: rect }));
      perf[`${t}.chain.noBloom`] = time(() => post.render(scene, camera, { ...frame, bloom: 0, canvasRectPx: rect }));
      const lensPass = post.composer.passes[2];
      lensPass.enabled = false;
      perf[`${t}.chain.noBloom.noLens`] = time(() => post.render(scene, camera, { ...frame, bloom: 0, canvasRectPx: rect }));
      lensPass.enabled = true;
    }
    post.setQuality(base);
    report.perfMs = perf;
  }
  renderFrame();
  finish();
})().catch((e) => {
  console.error(`[post] harness failed: ${e?.stack ?? e}`);
  (window as unknown as { __ready: boolean }).__ready = true;
});
