// M4 backdrop GPU timing: renders the backdrop alone (full screen, nothing in front of it: the worst case) into a
// 1920x1080 HalfFloat MSAA target like post.sceneRT, N times inside an EXT_disjoint_timer_query_webgl2 bracket,
// for several poses; subtracts an empty-scene bracket (clear + resolve). Also times the previous backdrop for A/B.
//   harness/sky-perf.html[?n=40&w=1920&h=1080&layers=2&msaa=4]
// window.__report = { gl, poses: { name: { newMs, oldMs } }, emptyMs }
import * as THREE from 'three';
import { CAMERA_FAR, CAMERA_NEAR, QUALITY_PRESETS, type QualitySettings } from '../src/contracts';
import { canvasToWorld, EYE, FORWARD } from '../src/shared/canvasSpace';
import { createSharedUniforms } from '../src/shared/uniforms';
import { createBackdrop } from '../src/sky/backdrop';
import { createBackdropOld } from './skyBackdropOld';

const qs = new URLSearchParams(location.search);
const N = Number(qs.get('n') ?? 40);
const W = Number(qs.get('w') ?? 1920);
const H = Number(qs.get('h') ?? 1080);
const q: QualitySettings = { ...QUALITY_PRESETS.high, backdropLayers: Number(qs.get('layers') ?? 2) as 1 | 2 };
const report: Record<string, unknown> = {};
(window as unknown as { __report: unknown }).__report = report;

const renderer = new THREE.WebGLRenderer({ antialias: false, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(64, 64);
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext() as WebGL2RenderingContext;
const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
report.gl = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'webgl2';
report.timer = !!ext;
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: Number(qs.get('msaa') ?? 4), depthBuffer: true });
const camera = new THREE.PerspectiveCamera(36, W / H, CAMERA_NEAR, CAMERA_FAR);
const u = createSharedUniforms();
u.uViewportH.value = H;

const sceneNew = new THREE.Scene();
const bdNew = createBackdrop(u, q);
if (qs.get('prof')) (bdNew.material as THREE.ShaderMaterial).defines = { BD_PROF: Number(qs.get('prof')) };
sceneNew.add(bdNew);
const sceneOld = new THREE.Scene();
sceneOld.add(createBackdropOld(u, q));
const sceneEmpty = new THREE.Scene();
// floor: a trivial full-screen far-plane triangle (bandwidth of shading every pixel of the MSAA HalfFloat target)
const sceneFlat = new THREE.Scene();
{
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const m = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 1.0, 1.0); }',
    fragmentShader: 'void main() { gl_FragColor = vec4(0.1, 0.2, 0.4, 1.0); }',
    depthTest: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  sceneFlat.add(mesh);
}

const deg = Math.PI / 180;
const poses: Record<string, () => void> = {
  canvasFov36: () => look(EYE, EYE.clone().addScaledVector(FORWARD, 1000), 36),
  burstFov78: () => look(new THREE.Vector3(-45, 210, -235), canvasToWorld(0.3, 0.72, 12000), 78),
  backFov60: () => look(EYE, EYE.clone().addScaledVector(FORWARD, -1000), 60),
  upFov60: () => look(EYE, EYE.clone().add(new THREE.Vector3(0, 1000, -50)), 60),
  funnelsFov56: () => look(new THREE.Vector3(-18201, 40775, -44746), new THREE.Vector3(504, 16173, -60114), 56),
};
function look(p: THREE.Vector3, t: THREE.Vector3, fov: number): void {
  camera.position.copy(p);
  camera.up.set(0, 1, 0);
  camera.fov = fov;
  camera.lookAt(t);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  u.uPxPerRad.value = H / (2 * Math.tan((fov * deg) / 2));
}

function frame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}
async function time(scene: THREE.Scene): Promise<number> {
  renderer.setRenderTarget(rt);
  for (let i = 0; i < 5; i++) renderer.render(scene, camera);
  gl.finish();
  if (!ext) {
    const t0 = performance.now();
    for (let i = 0; i < N; i++) renderer.render(scene, camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); // HalfFloat RT: may fail; finish below
    gl.finish();
    return (performance.now() - t0) / N;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const query = gl.createQuery()!;
    gl.getParameter(ext.GPU_DISJOINT_EXT);
    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    for (let i = 0; i < N; i++) renderer.render(scene, camera);
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    for (let k = 0; k < 200; k++) {
      await frame();
      if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
    }
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    const ns = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
    gl.deleteQuery(query);
    if (!disjoint && ns > 0) return ns / 1e6 / N;
  }
  return NaN;
}

(async () => {
  const out: Record<string, { newMs: number; oldMs: number }> = {};
  look(EYE, EYE.clone().addScaledVector(FORWARD, 1000), 36);
  // hold the GPU busy for ~2.5 s first so the clocks settle at their sustained level (laptop power states)
  const tw = performance.now();
  while (performance.now() - tw < 2500) await time(sceneNew);
  const empty = await time(sceneEmpty);
  report.emptyMs = +empty.toFixed(4);
  report.flatMs = +((await time(sceneFlat)) - empty).toFixed(4);
  // three interleaved passes over all poses; the median per pose and backdrop
  const runs: Record<string, { a: number[]; b: number[] }> = {};
  for (let pass = 0; pass < 3; pass++) {
    for (const [name, set] of Object.entries(poses)) {
      set();
      const e = await time(sceneEmpty);
      const a = await time(sceneNew);
      const b = await time(sceneOld);
      (runs[name] ??= { a: [], b: [] }).a.push(a - e);
      runs[name].b.push(b - e);
    }
  }
  const med = (x: number[]) => x.slice().sort((p, q) => p - q)[Math.floor(x.length / 2)];
  for (const [name, r] of Object.entries(runs)) out[name] = { newMs: +med(r.a).toFixed(4), oldMs: +med(r.b).toFixed(4) };
  report.poses = out;
  report.n = N;
  report.size = [W, H];
  report.layers = q.backdropLayers;
  console.log(`[sky-perf] ${JSON.stringify(report)}`);
  (window as unknown as { __ready: boolean }).__ready = true;
})();
