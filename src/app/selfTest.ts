// Boot-time checks (§4.10, §8 risk 2): paint order and the anamorphic invariance of the CPU mapping.
import { PerspectiveCamera, Vector3 } from 'three';
import {
  CANVAS_ASPECT, CLASS_COUNT, CLASS_INFO, PAINT_ORDER, StrokeClass, VFOV_DEG, type StrokeRecord,
} from '../contracts';
import { EYE, FORWARD, UP, canvasToWorld, strokeEndpoints } from '../shared/canvasSpace';
import { mulberry32 } from '../shared/rng';

export interface StrokeSource {
  readonly count: number;
  get(i: number, out: StrokeRecord): StrokeRecord;
}

const blank = (): StrokeRecord => ({
  u: 0, v: 0, d: 0, cls: StrokeClass.UNDERPAINT, flags: 0, du: 0, dv: 0, dlnd: 0, w: 0,
  colA: 0, colB: 0, emissive: 0, seed: 0, kappa: 0, q1: 0, q2: 0, q3: 0,
});

/** Returns one message per violation; [] means the paint order holds. */
export function assertPaintOrder(buf: StrokeSource): string[] {
  const out: string[] = [];
  const lo = new Array<number>(CLASS_COUNT).fill(Infinity);
  const hi = new Array<number>(CLASS_COUNT).fill(-Infinity);
  const outside = new Array<number>(CLASS_COUNT).fill(0);
  const r = blank();
  for (let i = 0; i < buf.count; i++) {
    buf.get(i, r);
    const c = r.cls;
    lo[c] = Math.min(lo[c], r.d);
    hi[c] = Math.max(hi[c], r.d);
    const [a, b] = CLASS_INFO[c as StrokeClass].dRange;
    if (r.d < a || r.d > b) outside[c]++;
  }
  for (let c = 0; c < CLASS_COUNT; c++) {
    if (outside[c] > 0) {
      out.push(`${StrokeClass[c]}: ${outside[c]} strokes outside dRange ${CLASS_INFO[c as StrokeClass].dRange.join('-')} (actual ${lo[c].toFixed(0)}-${hi[c].toFixed(0)})`);
    }
  }
  for (const [near, far] of PAINT_ORDER) {
    if (lo[near] === Infinity || lo[far] === Infinity) continue;
    if (hi[near] >= lo[far]) out.push(`${StrokeClass[near]} (max ${hi[near].toFixed(0)}) not in front of ${StrokeClass[far]} (min ${lo[far].toFixed(0)})`);
  }
  return out;
}

/**
 * Projects stroke endpoints from the exact canvas pose with three's own projection and compares them with
 * their canvas coordinates. maxErr is in canvas fractions; ok when < 1e-4.
 */
export function runInvarianceSelfTest(buf: StrokeSource, samples = 64, seed = 1): { maxErr: number; ok: boolean } {
  const cam = new PerspectiveCamera(VFOV_DEG, CANVAS_ASPECT, 0.1, 600_000);
  cam.position.copy(EYE);
  cam.up.copy(UP);
  cam.lookAt(new Vector3().copy(EYE).addScaledVector(FORWARD, 1000));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const rng = mulberry32(seed);
  const r = blank();
  const a = new Vector3(), b = new Vector3(), p = new Vector3();
  let maxErr = 0;
  const n = Math.min(samples, buf.count);
  for (let k = 0; k < n; k++) {
    buf.get(rng.int(buf.count), r);
    const pairs: [Vector3, number, number][] = [];
    if (CLASS_INFO[r.cls].anim === 0) {
      strokeEndpoints(r.u, r.v, r.d, r.du, r.dv, r.dlnd, a, b);
      pairs.push([a, r.u - (0.5 * r.du) / CANVAS_ASPECT, r.v - 0.5 * r.dv], [b, r.u + (0.5 * r.du) / CANVAS_ASPECT, r.v + 0.5 * r.dv]);
    } else {
      pairs.push([canvasToWorld(r.u, r.v, r.d, p), r.u, r.v]);
    }
    for (const [w, u, v] of pairs) {
      const ndc = w.clone().project(cam);
      maxErr = Math.max(maxErr, Math.abs(0.5 + ndc.x / 2 - u), Math.abs(0.5 + ndc.y / 2 - v));
    }
  }
  return { maxErr, ok: maxErr < 1e-4 };
}
