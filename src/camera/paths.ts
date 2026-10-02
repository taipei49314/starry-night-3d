// M8 path toolkit (§4.8): curve primitives used by the shot list (shots.ts) and the free/rejoin director.
// Pure functions over three's Vector3; nothing here allocates per call except where a result object is returned.
import { Vector3 } from 'three';
import { CANVAS_ASPECT, VORTICES } from '../contracts';
import { canvasToWorld, EYE } from '../shared/canvasSpace';

const clamp01 = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t);

/** Easing curves on [0, 1] (inputs are clamped). The first four are the §4.8 API; the rest are used by shots.ts. */
export const ease = {
  inOutCubic(t: number): number {
    t = clamp01(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
  inOutSine(t: number): number {
    t = clamp01(t);
    return (1 - Math.cos(Math.PI * t)) / 2;
  },
  smootherstep(t: number): number {
    t = clamp01(t);
    return t * t * t * (t * (t * 6 - 15) + 10);
  },
  outQuint(t: number): number {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 5);
  },
  outCubic(t: number): number {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 3);
  },
  smoothstep(t: number): number {
    t = clamp01(t);
    return t * t * (3 - 2 * t);
  },
  linear(t: number): number {
    return clamp01(t);
  },
};
export type EaseName = keyof typeof ease;

/** Cubic Hermite: p0 -> p1 with end tangents m0, m1 (already scaled to the parameter span), s in [0, 1]. */
export function hermite(p0: Vector3, m0: Vector3, p1: Vector3, m1: Vector3, s: number, out: Vector3): Vector3 {
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return out.set(
    h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
    h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
    h00 * p0.z + h10 * m0.z + h01 * p1.z + h11 * m1.z,
  );
}

/** Scalar cubic Hermite (same basis as `hermite`). */
export function hermite1(p0: number, m0: number, p1: number, m1: number, s: number): number {
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1;
}

const cr = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
const crA = [new Vector3(), new Vector3(), new Vector3()];
const crB = [new Vector3(), new Vector3()];

/**
 * Centripetal Catmull-Rom (alpha = 0.5, Barry-Goldman form) through `pts`; s in [0, 1] spans the whole polyline,
 * one equal parameter share per segment. End segments use reflected phantom points. Passes through every point.
 */
export function catmullRomCentripetal(pts: Vector3[], s: number, out: Vector3): Vector3 {
  const n = pts.length;
  if (n === 0) return out.set(0, 0, 0);
  if (n === 1) return out.copy(pts[0]);
  const x = clamp01(s) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const u = x - i;
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p0 = i > 0 ? cr[0].copy(pts[i - 1]) : cr[0].copy(p1).multiplyScalar(2).sub(p2);
  const p3 = i + 2 < n ? cr[3].copy(pts[i + 2]) : cr[3].copy(p2).multiplyScalar(2).sub(p1);
  const knot = (a: Vector3, b: Vector3) => Math.max(Math.sqrt(a.distanceTo(b)), 1e-9);
  const t0 = 0;
  const t1 = t0 + knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);
  const t = t1 + (t2 - t1) * u;
  const lerpK = (o: Vector3, a: Vector3, b: Vector3, ta: number, tb: number) => {
    const w = (t - ta) / (tb - ta);
    return o.copy(a).multiplyScalar(1 - w).addScaledVector(b, w);
  };
  const A1 = lerpK(crA[0], p0, p1, t0, t1);
  const A2 = lerpK(crA[1], p1, p2, t1, t2);
  const A3 = lerpK(crA[2], p2, p3, t2, t3);
  const B1 = lerpK(crB[0], A1, A2, t0, t2);
  const B2 = lerpK(crB[1], A2, A3, t1, t3);
  return lerpK(out, B1, B2, t1, t2);
}

const lpA = new Vector3();
const lpB = new Vector3();
const lpAxis = new Vector3();

/** Spherical interpolation of unit vectors a -> b (both normalised by the caller). Antipodal pairs turn about a stable perpendicular. */
export function slerpUnit(a: Vector3, b: Vector3, s: number, out: Vector3): Vector3 {
  const dot = Math.max(-1, Math.min(1, a.dot(b)));
  const ang = Math.acos(dot);
  if (ang < 1e-9) return out.copy(a);
  if (Math.PI - ang < 1e-6) {
    // antipodal: rotate about any axis perpendicular to a (prefer world up)
    lpAxis.set(0, 1, 0).cross(a);
    if (lpAxis.lengthSq() < 1e-12) lpAxis.set(1, 0, 0).cross(a);
    lpAxis.normalize();
    return out.copy(a).applyAxisAngle(lpAxis, ang * s);
  }
  const sinA = Math.sin(ang);
  const wa = Math.sin((1 - s) * ang) / sinA;
  const wb = Math.sin(s * ang) / sinA;
  const ax = a.x, ay = a.y, az = a.z;
  return out.set(wa * ax + wb * b.x, wa * ay + wb * b.y, wa * az + wb * b.z);
}

/** Rotate unit vector `from` toward unit vector `to` by at most `maxAngle` radians (no overshoot). */
export function rotateTowards(from: Vector3, to: Vector3, maxAngle: number, out: Vector3): Vector3 {
  const ang = Math.acos(Math.max(-1, Math.min(1, from.dot(to))));
  if (ang < 1e-12) return out.copy(from);
  return slerpUnit(from, to, Math.min(1, maxAngle / ang), out);
}

/**
 * Log-polar flight about the eye E: the distance from E is log-lerped and the direction from E is slerped.
 * Used for the storm return (shot 9), Return to the Eye and the idle rejoin.
 */
export function logPolarAboutEye(fromPos: Vector3, toPos: Vector3, s: number, out: Vector3): Vector3 {
  lpA.subVectors(fromPos, EYE);
  lpB.subVectors(toPos, EYE);
  const la = lpA.length();
  const lb = lpB.length();
  if (la < 1e-6 && lb < 1e-6) return out.copy(EYE);
  // a degenerate end (at E) takes the other end's direction
  if (la < 1e-6) lpA.copy(lpB);
  if (lb < 1e-6) lpB.copy(lpA);
  lpA.normalize();
  lpB.normalize();
  const da = Math.max(la, 1e-3);
  const db = Math.max(lb, 1e-3);
  let dist = da * Math.pow(db / da, s);
  if (s >= 1) dist = lb;
  else if (s <= 0) dist = la;
  slerpUnit(lpA, lpB, s, out);
  return out.multiplyScalar(dist).add(EYE);
}

/**
 * van Wijk & Nuij (2003) optimal pan-zoom path from (c0, w0) to (c1, w1) with curvature rho (sqrt 2 is the
 * perceptual optimum; the shot list uses 1.4). The centre moves on the straight line c0 -> c1; the width (view
 * extent) zooms out and back in. `duration` is the path length S in the paper's metric; `at(S01)` takes S / duration.
 */
export function vanWijkNuij(c0: Vector3, w0: number, c1: Vector3, w1: number, rho: number): { duration: number; at(S01: number): { center: Vector3; width: number } } {
  const C0 = c0.clone();
  const C1 = c1.clone();
  const u1 = C0.distanceTo(C1);
  const r2 = rho * rho;
  const r4 = r2 * r2;
  if (u1 < 1e-6 * Math.max(w0, w1, 1)) {
    const k = w1 >= w0 ? 1 : -1;
    const S = Math.abs(Math.log(w1 / w0)) / rho;
    return {
      duration: S,
      at(S01: number) {
        const s = clamp01(S01) * S;
        return { center: C0.clone(), width: w0 * Math.exp(k * rho * s) };
      },
    };
  }
  const b0 = (w1 * w1 - w0 * w0 + r4 * u1 * u1) / (2 * w0 * r2 * u1);
  const b1 = (w1 * w1 - w0 * w0 - r4 * u1 * u1) / (2 * w1 * r2 * u1);
  const rr0 = Math.log(-b0 + Math.sqrt(b0 * b0 + 1));
  const rr1 = Math.log(-b1 + Math.sqrt(b1 * b1 + 1));
  const S = (rr1 - rr0) / rho;
  const ch0 = Math.cosh(rr0);
  const sh0 = Math.sinh(rr0);
  return {
    duration: S,
    at(S01: number) {
      const s = clamp01(S01) * S;
      let u = (w0 / r2) * (ch0 * Math.tanh(rho * s + rr0) - sh0);
      let w = (w0 * ch0) / Math.cosh(rho * s + rr0);
      if (S01 >= 1) { u = u1; w = w1; }
      return { center: C0.clone().lerp(C1, u / u1), width: w };
    },
  };
}

/** Dolly-zoom: the FOV that keeps a subject at depth0 the same size when it is now at depthNow. Degrees. */
export function dollyZoomFov(fov0Deg: number, depth0: number, depthNow: number): number {
  const h = Math.tan((fov0Deg * Math.PI) / 360) * (depth0 / depthNow);
  return (Math.atan(h) * 360) / Math.PI;
}

/**
 * A camera point inside vortex `vi`'s funnel: canvas centre + inset * r * (cos theta / A, sin theta) at the
 * funnel depth of canvas radius r (d = dThroat (r / r0)^expo). theta is the canvas angle in radians (v up).
 */
export function funnelCameraPoint(vi: number, rCanvas: number, theta: number, inset: number, out = new Vector3()): Vector3 {
  const V = VORTICES[vi];
  const u = V.u + (inset * rCanvas * Math.cos(theta)) / CANVAS_ASPECT;
  const v = V.v + inset * rCanvas * Math.sin(theta);
  const d = V.dThroat * Math.pow(rCanvas / V.r0, V.expo);
  return canvasToWorld(u, v, d, out);
}

/**
 * Critically damped spring toward a moving target (exact integration, unconditionally stable).
 * omega = natural frequency (1/s); the settle time to 1e-3 of the initial error is about 9.2 / omega.
 */
export class CriticalSpring3 {
  readonly value = new Vector3();
  readonly velocity = new Vector3();
  private readonly x = new Vector3();
  private readonly tmp = new Vector3();
  constructor(public omega: number) {}
  reset(p: Vector3, v?: Vector3): this {
    this.value.copy(p);
    if (v) this.velocity.copy(v);
    else this.velocity.set(0, 0, 0);
    return this;
  }
  step(target: Vector3, dt: number): Vector3 {
    const w = this.omega;
    const e = Math.exp(-w * dt);
    this.x.subVectors(this.value, target);
    // tmp = v + w x
    this.tmp.copy(this.velocity).addScaledVector(this.x, w);
    // x' = (x + tmp dt) e ;  v' = (v - w tmp dt) e
    this.value.copy(this.x).addScaledVector(this.tmp, dt).multiplyScalar(e).add(target);
    this.velocity.addScaledVector(this.tmp, -w * dt).multiplyScalar(e);
    return this.value;
  }
}
