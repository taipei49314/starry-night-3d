// Debug generator for the anamorphic invariance self-test (§4.3 acceptance, §4.10): random STATIC-anim strokes
// over the visible canvas, spread over many depths (each inside its class's dRange so paint-order asserts hold).
import { Vector3 } from 'three';
import { CLASS_INFO, PALETTE, StrokeClass, type Rng, type StrokeSink } from '../contracts';
import { canvasToWorld, EYE, strokeEndpoints } from '../shared/canvasSpace';
import { packSrgb } from '../shared/palette';

/** STATIC classes used, cycled: non-solid sky motifs and solid earth classes (with a face normal toward E). */
const DEBUG_CLASSES: readonly StrokeClass[] = [
  StrokeClass.UNDERPAINT, StrokeClass.STAR_CORE, StrokeClass.MOON, StrokeClass.HILL, StrokeClass.HOUSE, StrokeClass.GROUND,
];
const COLS = [PALETTE.chrome, PALETTE.cerulean, PALETTE.zincWhite, PALETTE.ochre, PALETTE.cobalt, PALETTE.lemon, PALETTE.blueGreen];

/** n (default 64) random STATIC strokes with u, v in [0.04, 0.96]; deterministic for a given rng. */
export function generateDebugStrokes(sink: StrokeSink, rng: Rng, n = 64): void {
  const P = new Vector3();
  const N = new Vector3(), T = new Vector3(), A = new Vector3(), B = new Vector3(), C = new Vector3();
  for (let i = 0; i < n; i++) {
    const cls = DEBUG_CLASSES[i % DEBUG_CLASSES.length];
    const info = CLASS_INFO[cls];
    const [d0, d1] = info.dRange;
    const lo = d0 * 1.01, hi = d1 * 0.99;
    const d = Math.exp(rng.range(Math.log(lo), Math.log(hi)));
    const u = rng.range(0.04, 0.96);
    const v = rng.range(0.04, 0.96);
    const L = rng.range(0.02, 0.06);
    const ang = rng.range(0, Math.PI * 2);
    // keep both endpoints inside the class depth range
    const dlndMax = Math.min(0.06, 2 * Math.log(hi / d), 2 * Math.log(d / lo));
    const dlnd = rng.range(-1, 1) * Math.max(0, dlndMax);
    const du = L * Math.cos(ang), dv = L * Math.sin(ang);
    let q1 = 0, q2 = 0, q3 = 0;
    if (info.solid) {
      // The stroke lies in its face: N is perpendicular to the stroke, faces E, and is tilted about the stroke
      // axis by up to 40 deg.
      strokeEndpoints(u, v, d, du, dv, dlnd, A, B);
      T.subVectors(B, A).normalize();
      canvasToWorld(u, v, d, P);
      N.subVectors(EYE, P).normalize();
      N.addScaledVector(T, -N.dot(T)).normalize();
      const tilt = rng.range(-0.7, 0.7);
      C.crossVectors(T, N);
      N.multiplyScalar(Math.cos(tilt)).addScaledVector(C, Math.sin(tilt)).normalize();
      q1 = N.x; q2 = N.y; q3 = N.z;
    }
    const cA = COLS[rng.int(COLS.length)];
    const cB = COLS[rng.int(COLS.length)];
    sink.push({
      u, v, d, cls, flags: 0,
      du, dv, dlnd, w: rng.range(0.005, 0.012),
      colA: packSrgb(cA), colB: packSrgb(cB), emissive: 0, seed: rng.next(),
      kappa: rng.range(-0.3, 0.3), q1, q2, q3,
    });
  }
}
