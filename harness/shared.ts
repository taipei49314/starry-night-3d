// M2 self-test: CPU mapping round trips + TS/GLSL parity of flowField, armPoint, jetPoint, ringGeom, canvasToWorld.
import * as THREE from 'three';
import { CANVAS_ASPECT, VORTICES } from '../src/contracts';
import { canvasToWorld, groundHitDepth, jetPoint, segmentToStroke, strokeEndpoints, worldToCanvas } from '../src/shared/canvasSpace';
import { armPoint, flowField, ringGeom } from '../src/shared/flowField';
import { mulberry32 } from '../src/shared/rng';
import { createSharedUniforms } from '../src/shared/uniforms';
import { GLSL_PRELUDE } from '../src/shared/glsl/flow.glsl';

const out = document.getElementById('out')!;
const report: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  report.push({ name, ok, detail });
  out.textContent += `${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}\n`;
  if (!ok) console.error(`FAIL ${name}: ${detail}`);
};

// ---- CPU
const rng = mulberry32(7);
let maxRt = 0;
const P = new THREE.Vector3();
for (let i = 0; i < 10000; i++) {
  const u = rng.range(-0.3, 1.3), v = rng.range(-0.12, 1.1), d = Math.exp(rng.range(Math.log(50), Math.log(250000)));
  canvasToWorld(u, v, d, P);
  const c = worldToCanvas(P);
  maxRt = Math.max(maxRt, Math.abs(c.u - u), Math.abs(c.v - v), Math.abs(c.d - d) / d);
}
check('roundtrip', maxRt < 1e-9, `max err ${maxRt.toExponential(2)}`);
const gh = groundHitDepth(0.55, 0.11);
check('groundHit(0.55,0.11)', Math.abs(gh - 659) <= 2, gh.toFixed(2));
const A = new THREE.Vector3(10, 5, -700), B = new THREE.Vector3(18, 9, -720);
const s = segmentToStroke(A, B);
const [A2, B2] = strokeEndpoints(s.u, s.v, s.d, s.du, s.dv, s.dlnd);
check('segment<->stroke', A2.distanceTo(A) < 1e-6 && B2.distanceTo(B) < 1e-6, `${A2.distanceTo(A).toExponential(2)} ${B2.distanceTo(B).toExponential(2)}`);
const c1 = canvasToWorld(0.43, 0.66, 40000);
check('c1 throat world', Math.abs(c1.x + 2274) < 2 && Math.abs(c1.y - 11092) < 3 && Math.abs(c1.z + 38670) < 3, `${c1.x.toFixed(0)}, ${c1.y.toFixed(0)}, ${c1.z.toFixed(0)}`);
const venus = canvasToWorld(0.3, 0.72, 12000);
check('venus world', Math.abs(venus.x + 1949) < 2 && Math.abs(venus.y - 3823) < 3 && Math.abs(venus.z + 11520) < 3, `${venus.x.toFixed(0)}, ${venus.y.toFixed(0)}, ${venus.z.toFixed(0)}`);

// ---- GPU parity: 16 probe points, 4 RGBA float outputs each (rows)
const N = 16;
const probes: { x: number; y: number; vi: number; arm: number; sigma: number; across: number; js: number; joff: number; si: number; k: number; u: number; v: number; d: number }[] = [];
for (let i = 0; i < N; i++) {
  probes.push({
    x: rng.range(-0.3, 1.3) * CANVAS_ASPECT, y: rng.range(-0.1, 1.05),
    vi: i % VORTICES.length, arm: [0, 1, 0.5][i % 3], sigma: rng.next(), across: rng.range(-1, 1),
    js: rng.next(), joff: rng.range(-0.01, 0.01), si: i % 12, k: i % 7,
    u: rng.range(-0.3, 1.3), v: rng.range(-0.1, 1.1), d: rng.range(100, 200000),
  });
}
const tex = (rows: number[][]) => {
  const data = new Float32Array(N * rows.length * 4);
  rows.forEach((row, r) => row.forEach((val, j) => (data[r * N * 4 + j] = val)));
  const t = new THREE.DataTexture(data, N, rows.length, THREE.RGBAFormat, THREE.FloatType);
  t.needsUpdate = true;
  return t;
};
const inTex = tex([
  probes.flatMap((p) => [p.x, p.y, p.vi, p.arm]),
  probes.flatMap((p) => [p.sigma, p.across, p.js, p.joff]),
  probes.flatMap((p) => [p.si, p.k, p.u, p.v]),
  probes.flatMap((p) => [p.d, 0, 0, 0]),
]);
const renderer = new THREE.WebGLRenderer({ logarithmicDepthBuffer: true });
renderer.setSize(64, 16);
document.body.appendChild(renderer.domElement);
const ROWS = 5;
const rt = new THREE.WebGLRenderTarget(N, ROWS, { type: THREE.FloatType, format: THREE.RGBAFormat });
const uniforms = { ...createSharedUniforms(), uIn: { value: inTex } };
const mat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
${GLSL_PRELUDE}
void main() { gl_Position = vec4(position.xy, 0.0, 1.0);
#include <logdepthbuf_vertex>
}`,
  fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
` + GLSL_PRELUDE + /* glsl */ `
uniform sampler2D uIn;
void main() {
  int i = int(gl_FragCoord.x), row = int(gl_FragCoord.y);
  vec4 a = texelFetch(uIn, ivec2(i, 0), 0), b = texelFetch(uIn, ivec2(i, 1), 0), c = texelFetch(uIn, ivec2(i, 2), 0), e = texelFetch(uIn, ivec2(i, 3), 0);
  vec2 uv; float d; vec2 tH; float dl;
  vec4 o = vec4(0.0);
  if (row == 0) { o.xy = flowField(a.xy); }
  else if (row == 1) { armPoint(int(a.z), a.w, b.x, b.y, uv, d, tH, dl); o = vec4(uv, d, dl); }
  else if (row == 2) { armPoint(int(a.z), a.w, b.x, b.y, uv, d, tH, dl); o.xy = tH; jetPoint(b.z, b.w, uv, d, tH); o.zw = uv; }
  else if (row == 3) { jetPoint(b.z, b.w, uv, d, tH); vec2 cH; float rho, dr; ringGeom(int(c.x), c.y, cH, rho, dr); o = vec4(d, rho, dr, cH.x); }
  else { o.xyz = canvasToWorld(c.zw, e.x); }
  gl_FragColor = o;
}`,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
const scene = new THREE.Scene();
scene.add(quad);
renderer.setRenderTarget(rt);
renderer.render(scene, new THREE.Camera());
const px = new Float32Array(N * ROWS * 4);
renderer.readRenderTargetPixels(rt, 0, 0, N, ROWS, px);
const g = (row: number, i: number, j: number) => px[row * N * 4 + i * 4 + j];
let eFlow = 0, eArm = 0, eArmD = 0, eTan = 0, eJet = 0, eJetD = 0, eRing = 0, eC2W = 0;
const f = [0, 0];
for (let i = 0; i < N; i++) {
  const p = probes[i];
  flowField(p.x, p.y, f);
  eFlow = Math.max(eFlow, Math.abs(f[0] - g(0, i, 0)), Math.abs(f[1] - g(0, i, 1)));
  const ap = armPoint(p.vi, p.arm, p.sigma, p.across);
  eArm = Math.max(eArm, Math.abs(ap.u - g(1, i, 0)), Math.abs(ap.v - g(1, i, 1)), Math.abs(ap.dlnd - g(1, i, 3)));
  eArmD = Math.max(eArmD, Math.abs(ap.d - g(1, i, 2)) / ap.d);
  eTan = Math.max(eTan, Math.abs(ap.tu - g(2, i, 0)) / (Math.abs(ap.tu) + 1e-3), Math.abs(ap.tv - g(2, i, 1)) / (Math.abs(ap.tv) + 1e-3));
  const jp = jetPoint(p.js, p.joff);
  eJet = Math.max(eJet, Math.abs(jp.u - g(2, i, 2)), Math.abs(jp.v - g(2, i, 3)));
  eJetD = Math.max(eJetD, Math.abs(jp.d - g(3, i, 0)) / jp.d);
  const rg = ringGeom(p.si, p.k);
  eRing = Math.max(eRing, Math.abs(rg.rho - g(3, i, 1)), Math.abs(rg.d - g(3, i, 2)) / rg.d, Math.abs(rg.cx - g(3, i, 3)));
  const w = canvasToWorld(p.u, p.v, p.d);
  eC2W = Math.max(eC2W, Math.hypot(w.x - g(4, i, 0), w.y - g(4, i, 1), w.z - g(4, i, 2)) / p.d);
}
check('glsl flowField', eFlow < 1e-5, eFlow.toExponential(2));
check('glsl armPoint uv/dlnd', eArm < 1e-5, eArm.toExponential(2));
check('glsl armPoint d (rel)', eArmD < 1e-5, eArmD.toExponential(2));
check('glsl armPoint tangent (rel)', eTan < 1e-4, eTan.toExponential(2));
check('glsl jetPoint uv', eJet < 1e-5, eJet.toExponential(2));
check('glsl jetPoint d (rel)', eJetD < 1e-5, eJetD.toExponential(2));
check('glsl ringGeom', eRing < 1e-5, eRing.toExponential(2));
check('glsl canvasToWorld (rel)', eC2W < 1e-6, eC2W.toExponential(2));

(window as any).__report = report;
(window as any).__ready = true;
