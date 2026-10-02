// Harness-only: a closer stand-in for the M3 stroke frame than harness/lib/preview.ts, for off-axis checks.
//  - ribbon binormal B = normalize(mix(B_img, normalize(cross(T, toCamera)), uOff)) as in §4.3 step 6
//    (previewMesh always uses B_img, so strokes seen from the side collapse to slivers)
//  - tapered ribbon following wp(s) = smoothstep(0, 0.1, s) (1 - 0.4 s), so coverage is not overstated
//  - UNDERLAYER strokes are 3x wide; colA on one long edge, colB on the other
import * as THREE from 'three';
import { CANVAS_ASPECT, EYE_POS, StrokeFlag, T_HALF, type StrokeRecord } from '../src/contracts';
import { canvasToWorld, EYE_BASIS } from '../src/shared/canvasSpace';
import { animate } from './lib/preview';

const S = [0, 0.1, 0.55, 1];
const WP = [0.15, 0.96, 0.78, 0.6];

const A = new THREE.Vector3(), B = new THREE.Vector3(), T = new THREE.Vector3(), M = new THREE.Vector3();
const Bimg = new THREE.Vector3(), Bv = new THREE.Vector3(), toCam = new THREE.Vector3(), Bi = new THREE.Vector3();
const col = new THREE.Color();

export function facingRibbons(records: StrokeRecord[], t: number, cam: THREE.Vector3, opts: { emissiveGain?: number; uOff?: number } = {}): THREE.Mesh {
  const n = records.length;
  const NV = S.length * 2;
  const pos = new Float32Array(n * NV * 3);
  const cols = new Float32Array(n * NV * 3);
  const idx = new Uint32Array(n * (S.length - 1) * 6);
  const gain = opts.emissiveGain ?? 0.15;
  const eye = new THREE.Vector3(...EYE_POS);
  const off = opts.uOff ?? THREE.MathUtils.smoothstep(cam.distanceTo(eye), 0.5, 40);
  for (let i = 0; i < n; i++) {
    const r = records[i];
    const a = animate(r, t);
    canvasToWorld(a.u - (0.5 * a.du) / CANVAS_ASPECT, a.v - 0.5 * a.dv, a.d * Math.exp(-0.5 * a.dlnd), A);
    canvasToWorld(a.u + (0.5 * a.du) / CANVAS_ASPECT, a.v + 0.5 * a.dv, a.d * Math.exp(0.5 * a.dlnd), B);
    T.subVectors(B, A).normalize();
    M.addVectors(A, B).multiplyScalar(0.5);
    Bimg.set(-a.dv, a.du, 0).normalize().applyMatrix3(EYE_BASIS);
    Bimg.addScaledVector(T, -Bimg.dot(T)).normalize();
    toCam.subVectors(cam, M).normalize();
    Bv.crossVectors(T, toCam);
    if (Bv.length() < 0.05) Bi.copy(Bimg);
    else Bi.copy(Bimg).lerp(Bv.normalize(), off).normalize();
    const hw = 0.5 * r.w * 2 * T_HALF * a.d * (r.flags & StrokeFlag.UNDERLAYER ? 3 : 1);
    const boost = 1 + gain * r.emissive;
    for (let k = 0; k < S.length; k++) {
      const s = S[k];
      const px = A.x + (B.x - A.x) * s, py = A.y + (B.y - A.y) * s, pz = A.z + (B.z - A.z) * s;
      const w = hw * WP[k];
      const o = (i * NV + k * 2) * 3;
      pos[o] = px - Bi.x * w; pos[o + 1] = py - Bi.y * w; pos[o + 2] = pz - Bi.z * w;
      pos[o + 3] = px + Bi.x * w; pos[o + 4] = py + Bi.y * w; pos[o + 5] = pz + Bi.z * w;
      col.setHex(r.colA).multiplyScalar(boost);
      cols[o] = col.r; cols[o + 1] = col.g; cols[o + 2] = col.b;
      col.setHex(r.colB).multiplyScalar(boost);
      cols[o + 3] = col.r; cols[o + 4] = col.g; cols[o + 5] = col.b;
    }
    for (let k = 0; k < S.length - 1; k++) {
      const b = i * NV + k * 2;
      idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], (i * (S.length - 1) + k) * 6);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  return mesh;
}
