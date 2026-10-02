// M4 harness preview: like harness/lib/preview.ts previewMesh (flat quads per record) but closer to the M3 vertex
// shader where it matters for judging the sky off-axis (SPEC §4.3 steps 2, 6, 9):
//  - off-axis binormal B = normalize(mix(B_img, normalize(cross(T, toCam)), uOff)) (the lib preview uses B_img only,
//    which turns every stroke into a fin facing E);
//  - VORTEX sigma fade, UNDERLAYER x3 width and x1.01 depth, JET colour ramp along sigma;
//  - the screen-size guards (Lpx window, near fade dist/Lw) applied as a width factor.
// Unlit (colour = record colours, emissive brightened a little). Not normative.
import * as THREE from 'three';
import { AnimKind, CANVAS_ASPECT, CLASS_INFO, PALETTE, type StrokeRecord, StrokeFlag, T_HALF } from '../src/contracts';
import { canvasToWorld, EYE_BASIS } from '../src/shared/canvasSpace';
import { animate } from './lib/preview';

const ss = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const fract = (x: number) => x - Math.floor(x);

export interface PreviewOpts {
  camPos: THREE.Vector3; camFwd: THREE.Vector3; uOff: number; pxPerRad: number; viewportH: number; emissiveGain?: number;
  /** false: skip the §4.3 step 9 size guards (debug) */ guards?: boolean;
  /** out: number of strokes drawn / dropped by each guard */ stats?: Record<string, number>;
}

export function skyPreviewMesh(records: readonly StrokeRecord[], t: number, o: PreviewOpts): THREE.Mesh {
  const n = records.length;
  const pos = new Float32Array(n * 12);
  const col = new Float32Array(n * 12);
  const idx = new Uint32Array(n * 6);
  const gain = o.emissiveGain ?? 0.15;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), T = new THREE.Vector3(), Bi = new THREE.Vector3();
  const Bv = new THREE.Vector3(), mid = new THREE.Vector3(), toCam = new THREE.Vector3(), N = new THREE.Vector3();
  const cA = new THREE.Color(), cB = new THREE.Color(), ramp = new THREE.Color();
  const k1080 = o.viewportH / 1080;
  let m = 0;
  for (const r of records) {
    const anim = CLASS_INFO[r.cls].anim;
    const a = animate(r, t);
    const under = (r.flags & StrokeFlag.UNDERLAYER) !== 0;
    let d = a.d;
    let alpha = 1;
    if (anim === AnimKind.VORTEX) {
      const sig = fract(r.q2 - t / 24);
      alpha *= ss(0, 0.06, sig) * (1 - ss(0.94, 1, sig));
      if (under) d *= 1.01;
    }
    cA.setHex(r.colA);
    cB.setHex(r.colB);
    let emissive = r.emissive;
    if (anim === AnimKind.JET) {
      const sig = fract(r.q1 + t / 8);
      if (sig < 0.5) ramp.setHex(PALETTE.cypressGreen).lerp(new THREE.Color(PALETTE.cerulean), sig * 2);
      else ramp.setHex(PALETTE.cerulean).lerp(new THREE.Color(PALETTE.zincWhite), sig * 2 - 1);
      cA.lerp(ramp, 0.65);
      cB.lerp(ramp, 0.65);
      emissive *= sig;
      alpha *= ss(0, 0.05, sig) * (1 - ss(0.95, 1, sig));
    }
    canvasToWorld(a.u - (0.5 * a.du) / CANVAS_ASPECT, a.v - 0.5 * a.dv, d * Math.exp(-0.5 * a.dlnd), A);
    canvasToWorld(a.u + (0.5 * a.du) / CANVAS_ASPECT, a.v + 0.5 * a.dv, d * Math.exp(0.5 * a.dlnd), B);
    T.subVectors(B, A);
    const Lw = T.length();
    if (Lw < 1e-9) continue;
    T.divideScalar(Lw);
    mid.addVectors(A, B).multiplyScalar(0.5);
    toCam.subVectors(o.camPos, mid);
    const dist = toCam.length();
    toCam.divideScalar(Math.max(dist, 1e-9));
    // §4.3 step 9 guards
    const Lpx = (Lw / dist) * o.pxPerRad;
    const st = o.stats;
    if (toCam.dot(o.camFwd) > 0) { if (st) st.behind = (st.behind ?? 0) + 1; continue; }
    if (o.guards !== false) {
      if (Lpx < 0.35) { if (st) st.subpx = (st.subpx ?? 0) + 1; continue; }
      const near = ss(0.8, 2.5, dist / Lw);
      const big = r.cls !== 0 ? 1 - ss(180 * k1080, 320 * k1080, Lpx) : 1;
      if (st && near < 0.5) st.nearFade = (st.nearFade ?? 0) + 1;
      if (st && big < 0.5) st.bigFade = (st.bigFade ?? 0) + 1;
      alpha *= ss(1.5, 4, Lpx) * near * big;
    }
    if (alpha < 0.08) { if (st) st.faded = (st.faded ?? 0) + 1; continue; }
    if (st) st.drawn = (st.drawn ?? 0) + 1;
    // §4.3 step 6 frame
    if (CLASS_INFO[r.cls].solid) {
      N.set(r.q1, r.q2, r.q3).normalize();
      Bi.crossVectors(N, T).normalize();
    } else {
      Bi.set(-a.dv, a.du, 0).normalize().applyMatrix3(EYE_BASIS);
      Bi.addScaledVector(T, -Bi.dot(T)).normalize();
      Bv.crossVectors(T, toCam);
      if (Bv.length() >= 0.05) Bi.lerp(Bv.normalize(), o.uOff).normalize();
    }
    const hw = 0.5 * r.w * 2 * T_HALF * d * (under ? 3 : 1) * Math.sqrt(alpha);
    const o12 = m * 12;
    pos.set([
      A.x - Bi.x * hw, A.y - Bi.y * hw, A.z - Bi.z * hw, A.x + Bi.x * hw, A.y + Bi.y * hw, A.z + Bi.z * hw,
      B.x - Bi.x * hw, B.y - Bi.y * hw, B.z - Bi.z * hw, B.x + Bi.x * hw, B.y + Bi.y * hw, B.z + Bi.z * hw,
    ], o12);
    const boost = 1 + gain * emissive;
    cA.multiplyScalar(boost);
    cB.multiplyScalar(boost);
    col.set([cA.r, cA.g, cA.b, cA.r, cA.g, cA.b, cB.r, cB.g, cB.b, cB.r, cB.g, cB.b], o12);
    const b = m * 4;
    idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], m * 6);
    m++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, m * 12), 3));
  g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, m * 12), 3));
  g.setIndex(new THREE.BufferAttribute(idx.subarray(0, m * 6), 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  return mesh;
}
