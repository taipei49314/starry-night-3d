// Line-for-line TS mirror of flow.glsl.ts (§3). Flow space p = (u * A, v) in h-units.
import {
  CANVAS_ASPECT, MOON_DEF, MOON_INDEX, MOON_RING_D, MOON_RING_RHO, STAR_RING_D, STAR_RING_RHO, STARS, VORTICES,
} from '../contracts';

const TAU = Math.PI * 2;

/** Crest of hill wall k (canvas v). */
export function ridgeV(u: number, k: number): number {
  return 0.3 + 0.03 * k + 0.028 * Math.sin(TAU * (1.6 * u + 0.15 + 0.21 * k)) + 0.011 * Math.sin(TAU * (4.7 * u + 0.4 - 0.3 * k));
}

/** 0 below the rear ridge, 1 in the sky. */
export function skyMask(x: number, y: number): number {
  const r = ridgeV(x / CANVAS_ASPECT, 2);
  return smoothstep(r, r + 0.05, y);
}

/** Outer halo radius of star i in h-units, signed by circulation direction (index 0 positive). */
export function starHaloSigned(i: number): number {
  const s = STARS[i];
  return (i % 2 === 0 ? 1 : -1) * s.rhoCore * (1 + STAR_RING_RHO * (s.rings - 1));
}
export const MOON_HALO_R = MOON_DEF.rCrescent + MOON_RING_RHO * (MOON_DEF.rings - 1);

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function bandFlow(x: number, y: number, out: number[]): void {
  const a = 4 * x + 9 * y;
  const b = 9.3 * x - 5 * y + 1.7;
  const vx = 1 - 0.198 * Math.cos(a) + 0.06 * Math.cos(b);
  const vy = 0.088 * Math.cos(a) + 0.1116 * Math.cos(b);
  const strength = 0.62 + 0.38 * Math.sin(TAU * 7 * y + 1.3 * Math.sin(2.1 * x));
  out[0] = 0.25 * strength * vx;
  out[1] = 0.25 * strength * vy;
}

function addVortex(x: number, y: number, i: number, out: number[]): void {
  const V = VORTICES[i];
  const dx = x - V.u * CANVAS_ASPECT;
  const dy = y - V.v;
  const r2 = Math.max(dx * dx + dy * dy, 1e-6);
  const prof = ((1 - Math.exp(-r2 / (V.rc * V.rc))) * Math.exp(-r2 / (2 * V.sigma * V.sigma))) / r2;
  const g = V.gamma;
  const sink = V.beta * Math.abs(g);
  // gamma * perp(d) - sink * d, perp(a) = (-a.y, a.x)
  out[0] += prof * (g * -dy - sink * dx);
  out[1] += prof * (g * dx - sink * dy);
}

function addHalo(x: number, y: number, cx: number, cy: number, rho: number, signedR: number, out: number[]): void {
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy) + 1e-5;
  const R = Math.abs(signedR);
  const m = smoothstep(R * 1.15, R * 0.85, r) * smoothstep(rho * 0.5, rho * 1.2, r);
  const k = (0.35 * Math.sign(signedR) * m) / r;
  out[0] += k * -dy;
  out[1] += k * dx;
}

function hillFlow(x: number, out: number[]): void {
  const u = x / CANVAS_ASPECT;
  const e = 0.002;
  const slope = (ridgeV(u + e, 1) - ridgeV(u - e, 1)) / (2 * e * CANVAS_ASPECT);
  const len = Math.hypot(1, slope);
  out[0] = (0.12 * 1) / len;
  out[1] = (0.12 * slope) / len;
}

const tmpH = [0, 0];
/** The shared analytic field at p = (x, y) = (u*A, v); writes out[0], out[1]. */
export function flowField(x: number, y: number, out: Float64Array | number[]): void {
  const v = [0, 0];
  bandFlow(x, y, v);
  for (let i = 0; i < VORTICES.length; i++) addVortex(x, y, i, v);
  for (let k = 0; k < STARS.length; k++) {
    const s = STARS[k];
    addHalo(x, y, s.u * CANVAS_ASPECT, s.v, s.rhoCore, starHaloSigned(k), v);
  }
  addHalo(x, y, MOON_DEF.u * CANVAS_ASPECT, MOON_DEF.v, MOON_DEF.rCrescent, MOON_HALO_R, v);
  hillFlow(x, tmpH);
  const m = skyMask(x, y);
  out[0] = tmpH[0] + (v[0] - tmpH[0]) * m;
  out[1] = tmpH[1] + (v[1] - tmpH[1]) * m;
}

/**
 * Arm law (§3), shared by generator, shader and camera:
 *   r(sigma) = r0 (rmax/r0)^sigma;  theta = arm*PI + 0.37*vi - sign(gamma) ln(r/r0) / beta;  d = dThroat (r/r0)^expo
 * `across` in [-1, 1] offsets the point by across * 0.2 * r along the arm normal.
 * Returns canvas (u, v), depth d, the tangent (tu, tv) in h-units per unit sigma, and dlnd per unit sigma.
 */
export function armPoint(vi: number, arm: number, sigma: number, across: number): { u: number; v: number; d: number; tu: number; tv: number; dlnd: number } {
  const V = VORTICES[vi];
  const lnR = Math.log(V.rmax / V.r0);
  const r = V.r0 * Math.exp(lnR * sigma);
  const sg = Math.sign(V.gamma);
  const th = arm * Math.PI + 0.37 * vi - (sg * lnR * sigma) / V.beta;
  const erx = Math.cos(th);
  const ery = Math.sin(th);
  const dth = (-sg * lnR) / V.beta;
  const tx = lnR * r * erx + r * dth * -ery;
  const ty = lnR * r * ery + r * dth * erx;
  const tl = Math.hypot(tx, ty) || 1;
  const nx = -ty / tl;
  const ny = tx / tl;
  const off = across * 0.2 * r;
  const px = V.u * CANVAS_ASPECT + r * erx + nx * off;
  const py = V.v + r * ery + ny * off;
  return { u: px / CANVAS_ASPECT, v: py, d: V.dThroat * Math.exp(V.expo * lnR * sigma), tu: tx, tv: ty, dlnd: V.expo * lnR };
}

/** Ring k of star si (moon = MOON_INDEX): centre in h-units, radius rho (h-units) and depth d. */
export function ringGeom(si: number, k: number): { cx: number; cy: number; rho: number; d: number } {
  if (si === MOON_INDEX) {
    return { cx: MOON_DEF.u * CANVAS_ASPECT, cy: MOON_DEF.v, rho: MOON_DEF.rCrescent + MOON_RING_RHO * k, d: MOON_DEF.d * (1 + MOON_RING_D * k) };
  }
  const s = STARS[si];
  return { cx: s.u * CANVAS_ASPECT, cy: s.v, rho: s.rhoCore * (1 + STAR_RING_RHO * k), d: s.dCore * (1 + STAR_RING_D * k) };
}

/** RK2 streamline from (x0, y0) in flow space; returns interleaved (x, y) pairs. Debug overlay and jet only. */
export function streamline(x0: number, y0: number, steps: number, h: number): Float32Array {
  const out = new Float32Array((steps + 1) * 2);
  const f = [0, 0];
  let x = x0;
  let y = y0;
  out[0] = x;
  out[1] = y;
  for (let i = 1; i <= steps; i++) {
    flowField(x, y, f);
    let l = Math.hypot(f[0], f[1]) || 1;
    const mx = x + 0.5 * h * (f[0] / l);
    const my = y + 0.5 * h * (f[1] / l);
    flowField(mx, my, f);
    l = Math.hypot(f[0], f[1]) || 1;
    x += h * (f[0] / l);
    y += h * (f[1] / l);
    out[i * 2] = x;
    out[i * 2 + 1] = y;
  }
  return out;
}
