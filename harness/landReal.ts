// M7 land through the real M3 stroke shader + underlay material (no post chain, no sky): checks that the solid
// records (normal in a3.yzw, width compensation, flags) and the underlay windings work with the production materials.
// URL: ?view=pose|off|far|church|village|alt|wide|side|top|behind &tier=high|medium|low &t=<loop seconds>
import * as THREE from 'three';
import { CAMERA_FAR, CAMERA_NEAR, QUALITY_PRESETS, StrokeClass, type Tier } from '../src/contracts';
import { canvasPoseFovDeg, EYE, FORWARD, UP } from '../src/shared/canvasSpace';
import { forkRng } from '../src/shared/rng';
import { createSharedUniforms } from '../src/shared/uniforms';
import { buildStrokeLayer, makeUnderlayMaterial, StrokeBuffer } from '../src/strokes/strokeBuffer';
import { generateGround } from '../src/earth/terrain';
import { generateHills } from '../src/earth/hillsGen';
import { createLandUnderlays, generateVillage } from '../src/earth/villageGen';

const qs = new URLSearchParams(location.search);
const view = qs.get('view') ?? 'pose';
const tier = (qs.get('tier') ?? 'high') as Tier;
const W = innerWidth || 1280;
const H = innerHeight || 720;

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.setClearColor(0x050a18);
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(36, W / H, CAMERA_NEAR, CAMERA_FAR);
const scene = new THREE.Scene();
const u = createSharedUniforms();
u.uTime.value = Number(qs.get('t') ?? 0);

const buf = new StrokeBuffer(64000);
const t0 = performance.now();
generateGround(buf, forkRng(1, 'ground'));
generateHills(buf, forkRng(1, 'hills'));
const info = generateVillage(buf, forkRng(1, 'village'));
const genMs = performance.now() - t0;
const layer = buildStrokeLayer(buf, u, QUALITY_PRESETS[tier]);
scene.add(layer.group);
const t1 = performance.now();
const underlays = createLandUnderlays((hex, o) => makeUnderlayMaterial(hex, u, THREE.FrontSide, o), info);
const underMs = performance.now() - t1;
if (qs.get('under') !== '0') scene.add(underlays);

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
function look(pos: THREE.Vector3Like, target: THREE.Vector3Like, fov: number): void {
  camera.position.set(pos.x, pos.y, pos.z);
  camera.up.set(0, 1, 0);
  camera.fov = fov;
  camera.lookAt(target.x, target.y, target.z);
  setDerived();
}
const views: Record<string, () => void> = {
  pose: () => {
    camera.position.copy(EYE);
    camera.up.copy(UP);
    camera.fov = canvasPoseFovDeg(W / H);
    camera.lookAt(EYE.clone().add(FORWARD));
    setDerived();
  },
  off: () => look({ x: -83, y: 108, z: -225 }, { x: 27, y: 0, z: -678 }, 56),
  far: () => look({ x: -2501, y: 12196, z: -42537 }, EYE, 26),
  church: () => look({ x: -70, y: 70, z: -520 }, { x: 35, y: 55, z: -690 }, 42),
  village: () => look({ x: 220, y: 160, z: -300 }, { x: 150, y: 0, z: -1100 }, 50),
  // the t = 68 s vortex-eye approach (island seen from 47 km) and the t = 31 s burst (wide FOV near E)
  alt: () => look({ x: -2661, y: 12972, z: -45256 }, { x: -2661 + 0.056 * 4e4, y: 12972 - 0.274 * 4e4, z: -45256 + 0.96 * 4e4 }, 67),
  wide: () => look({ x: -44, y: 209, z: -234 }, { x: -44 - 159, y: 209 + 301, z: -234 - 940 }, 69),
  // high oblique over the island from the side
  side: () => look({ x: 14000, y: 7000, z: 6000 }, { x: 500, y: 0, z: -3500 }, 50),
  // behind the hills, looking back toward E over their backs
  behind: () => look({ x: -2500, y: 3500, z: -17000 }, { x: 0, y: 0, z: -3000 }, 45),
  top: () => {
    camera.position.set(800, 26000, -3200);
    camera.up.set(0, 0, -1);
    camera.fov = 40;
    camera.lookAt(800, 0, -3200);
    setDerived();
  },
};
(views[view] ?? views.pose)();
renderer.render(scene, camera);
const info2 = renderer.info.render;
const chunks = layer.chunks.filter((c) => c.cls >= StrokeClass.HILL && c.cls <= StrokeClass.CHURCH).length;
const msg = `M7 land via M3  view=${view} tier=${tier}  strokes ${buf.count}  gen ${genMs.toFixed(0)} ms  underlays ${underMs.toFixed(0)} ms  land chunks ${chunks}  draws ${info2.calls}`;
if (qs.get('label') !== '0') document.getElementById('out')!.textContent = msg;
console.log(msg);
(window as any).__ready = true;
