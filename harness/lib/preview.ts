// Harness-only stroke preview, independent of the real stroke renderer (M3).
// Turns StrokeRecords into flat world-space quads (time t of the loop) so generator modules can be checked
// from the canvas pose E and from any off-axis camera. Approximates the M3 vertex shader; not normative.
import * as THREE from 'three';
import {
  AnimKind, CANVAS_ASPECT, CAMERA_FAR, CAMERA_NEAR, CLASS_INFO, LOOP_SECONDS, T_HALF,
  type StrokeRecord, type StrokeSink, StrokeClass, StrokeFlag,
} from '../../src/contracts';
import { canvasPoseFovDeg, canvasToWorld, EYE, EYE_BASIS, FORWARD, jetPoint } from '../../src/shared/canvasSpace';
import { armPoint, ringGeom } from '../../src/shared/flowField';

export class RecordingSink implements StrokeSink {
  records: StrokeRecord[] = [];
  push(r: StrokeRecord): void {
    this.records.push({ ...r });
  }
  get count(): number {
    return this.records.length;
  }
}

const BAND_T = [8, 12, 16, 24];

/** Canvas-space centre (u, v), direction (h-units, unit), length L (h-units), depth d and dlnd of a record at loop time t. */
export function animate(r: StrokeRecord, t: number) {
  const anim = CLASS_INFO[r.cls].anim;
  let u = r.u, v = r.v, d = r.d;
  let du = r.du, dv = r.dv, dlnd = r.dlnd;
  if (anim === AnimKind.VORTEX) {
    const vi = Math.floor(r.q1 / 2);
    const arm = r.q1 - 2 * vi;
    let s = (r.q2 - t / 24) % 1;
    if (s < 0) s += 1;
    const ap = armPoint(vi, arm, s, r.q3);
    const L = r.du;
    const tl = Math.hypot(ap.tu, ap.tv) || 1;
    u = ap.u; v = ap.v; d = ap.d * (1 + 0.02 * (r.seed - 0.5));
    du = (ap.tu / tl) * L; dv = (ap.tv / tl) * L; dlnd = ap.dlnd * (L / tl);
  } else if (anim === AnimKind.RING) {
    const g = ringGeom(Math.round(r.q1), r.q2);
    const k = Math.round(r.q2);
    const spin = (k % 2 === 0 ? 1 : -1) * 2 * Math.PI * (1 + (k % 3)) * t / LOOP_SECONDS;
    const ang = Math.atan2(r.v - g.cy, r.u * CANVAS_ASPECT - g.cx) + spin;
    const rho = g.rho * (1 + 0.04 * r.q3);
    const px = g.cx + rho * Math.cos(ang), py = g.cy + rho * Math.sin(ang);
    u = px / CANVAS_ASPECT; v = py; d = g.d;
    const L = r.du;
    du = -Math.sin(ang) * L; dv = Math.cos(ang) * L; dlnd = 0;
  } else if (anim === AnimKind.BAND) {
    const T = BAND_T[Math.max(0, Math.min(3, Math.round(r.q2)))];
    const k = 0.5 * r.q1 * Math.sin(2 * Math.PI * t / T + 2 * Math.PI * r.q3);
    u += (r.du / CANVAS_ASPECT) * k; v += r.dv * k;
  } else if (anim === AnimKind.CYPRESS) {
    u += 0.004 * Math.sin(2 * Math.PI * t / 6 + 5 * r.v + 2 * Math.PI * r.seed) * Math.max(0, Math.min(1, r.v));
  } else if (anim === AnimKind.JET) {
    let s = (r.q1 + t / 8) % 1;
    if (s < 0) s += 1;
    const jp = jetPoint(s, r.q2);
    const L = r.du;
    const tl = Math.hypot(jp.tu, jp.tv) || 1;
    u = jp.u; v = jp.v; d = jp.d * (1 + r.q3);
    du = (jp.tu / tl) * L; dv = (jp.tv / tl) * L;
    dlnd = Math.log(12000 / 220) * (L / tl);
  }
  return { u, v, d, du, dv, dlnd };
}

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpT = new THREE.Vector3(), tmpBi = new THREE.Vector3();
const srgb = new THREE.Color();

/** Build one flat quad per stroke (2 triangles) at loop time t. Emissive strokes are brightened for visibility. */
export function previewMesh(records: StrokeRecord[], t = 0, opts: { emissiveGain?: number } = {}): THREE.Mesh {
  const n = records.length;
  const pos = new Float32Array(n * 4 * 3);
  const col = new Float32Array(n * 4 * 3);
  const idx = new Uint32Array(n * 6);
  const gain = opts.emissiveGain ?? 0.15;
  for (let i = 0; i < n; i++) {
    const r = records[i];
    const a = animate(r, t);
    canvasToWorld(a.u - 0.5 * a.du / CANVAS_ASPECT, a.v - 0.5 * a.dv, a.d * Math.exp(-0.5 * a.dlnd), tmpA);
    canvasToWorld(a.u + 0.5 * a.du / CANVAS_ASPECT, a.v + 0.5 * a.dv, a.d * Math.exp(0.5 * a.dlnd), tmpB);
    tmpT.subVectors(tmpB, tmpA);
    const solid = CLASS_INFO[r.cls].solid;
    const width = r.w * 2 * T_HALF * a.d;
    if (solid) {
      tmpN.set(r.q1, r.q2, r.q3).normalize();
      tmpBi.crossVectors(tmpN, tmpT).normalize();
    } else {
      tmpBi.set(-a.dv, a.du, 0).normalize().applyMatrix3(EYE_BASIS);
    }
    const hw = 0.5 * width * (r.flags & StrokeFlag.UNDERLAYER ? 3 : 1);
    const verts = [
      tmpA.x - tmpBi.x * hw, tmpA.y - tmpBi.y * hw, tmpA.z - tmpBi.z * hw,
      tmpA.x + tmpBi.x * hw, tmpA.y + tmpBi.y * hw, tmpA.z + tmpBi.z * hw,
      tmpB.x - tmpBi.x * hw, tmpB.y - tmpBi.y * hw, tmpB.z - tmpBi.z * hw,
      tmpB.x + tmpBi.x * hw, tmpB.y + tmpBi.y * hw, tmpB.z + tmpBi.z * hw,
    ];
    pos.set(verts, i * 12);
    const boost = 1 + gain * r.emissive;
    srgb.setHex(r.colA).multiplyScalar(boost);
    col.set([srgb.r, srgb.g, srgb.b, srgb.r, srgb.g, srgb.b], i * 12);
    srgb.setHex(r.colB).multiplyScalar(boost);
    col.set([srgb.r, srgb.g, srgb.b, srgb.r, srgb.g, srgb.b], i * 12 + 6);
    const b = i * 4;
    idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

/** Renderer + camera ready for screenshots. Call `pose()` for the canvas pose or `look()` for any other camera. */
export function setupPreview(width = 1280, height = 720) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  renderer.setClearColor(0x050a18);
  document.body.style.margin = '0';
  document.body.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(36, width / height, CAMERA_NEAR, CAMERA_FAR);
  const scene = new THREE.Scene();
  return {
    renderer, camera, scene,
    /** Exact canvas pose (camera at E looking along F, canvas FOV). */
    pose() {
      camera.position.copy(EYE);
      camera.up.set(0, 1, 0);
      camera.fov = canvasPoseFovDeg(width / height);
      camera.lookAt(EYE.clone().addScaledVector(FORWARD, 1000));
      camera.updateProjectionMatrix();
    },
    look(pos: THREE.Vector3Like, target: THREE.Vector3Like, fov = 50) {
      camera.position.set(pos.x, pos.y, pos.z);
      camera.up.set(0, 1, 0);
      camera.fov = fov;
      camera.lookAt(target.x, target.y, target.z);
      camera.updateProjectionMatrix();
    },
    render() {
      renderer.render(scene, camera);
    },
  };
}

/** Thin canvas-frame overlay (the 73.7 x 92.1 rectangle and a 10 % grid) drawn in front of the camera at E. */
export function canvasGrid(): THREE.LineSegments {
  const pts: number[] = [];
  const P = (u: number, v: number) => canvasToWorld(u, v, 50);
  const seg = (a: THREE.Vector3, b: THREE.Vector3) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (let i = 0; i <= 10; i++) {
    seg(P(i / 10, 0), P(i / 10, 1));
    seg(P(0, i / 10), P(1, i / 10));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.35, depthTest: false }));
  l.renderOrder = 1000;
  return l;
}

/** Count records per class: {SWIRL: 30000, ...}. */
export function classCounts(records: StrokeRecord[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of records) out[StrokeClass[r.cls]] = (out[StrokeClass[r.cls]] ?? 0) + 1;
  return out;
}

/** Depth range per class, for the paint-order table. */
export function classDepthRanges(records: StrokeRecord[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const r of records) {
    const k = StrokeClass[r.cls];
    const cur = out[k] ?? [Infinity, -Infinity];
    cur[0] = Math.min(cur[0], r.d);
    cur[1] = Math.max(cur[1], r.d);
    out[k] = cur;
  }
  return out;
}
