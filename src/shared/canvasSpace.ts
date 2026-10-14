// Canvas space <-> world (§2.1). TS and GLSL (common.glsl.ts) must stay identical.
import { Matrix3, Vector3 } from 'three';
import {
  AT, CANVAS_ASPECT, CYPRESS_SIL, EYE_PITCH_DEG, EYE_POS, JET_CTRL, JET_D0, JET_D1, T_HALF, VFOV_DEG,
} from '../contracts';
import { ridgeV } from './flowField';

const pitch = (EYE_PITCH_DEG * Math.PI) / 180;
const cp = Math.cos(pitch);
const sp = Math.sin(pitch);

export const EYE = new Vector3(EYE_POS[0], EYE_POS[1], EYE_POS[2]);
/** M = rotX(+10 deg): columns are R, U and -F. */
export const EYE_BASIS = new Matrix3().set(1, 0, 0, 0, cp, -sp, 0, sp, cp);
export const RIGHT = new Vector3(1, 0, 0);
export const UP = new Vector3(0, cp, sp);
export const FORWARD = new Vector3(0, sp, -cp);

/** Unnormalised eye-frame ray of canvas point (u, v): world offset per metre of depth. */
export function canvasDir(u: number, v: number, out = new Vector3()): Vector3 {
  const a = (2 * u - 1) * AT;
  const b = (2 * v - 1) * T_HALF;
  // M * (a, b, -1)
  return out.set(a, b * cp + sp, b * sp - cp);
}

/** d' = 1000 (d / 1000)^k: the free-mode depth warp. Identity at k = 1. */
export function warpDepth(d: number, warpK = 1): number {
  return warpK === 1 ? d : 1000 * Math.pow(Math.max(d, 1e-3) / 1000, warpK);
}

export function canvasToWorld(u: number, v: number, d: number, out = new Vector3(), warpK = 1): Vector3 {
  canvasDir(u, v, out);
  return out.multiplyScalar(warpDepth(d, warpK)).add(EYE);
}

export function worldToCanvas(p: Vector3): { u: number; v: number; d: number } {
  const x = p.x - EYE.x;
  const y = p.y - EYE.y;
  const z = p.z - EYE.z;
  // q = M^T (P - E)
  const qx = x;
  const qy = cp * y + sp * z;
  const qz = -sp * y + cp * z;
  const d = -qz;
  return { u: 0.5 + qx / (2 * AT * d), v: 0.5 + qy / (2 * T_HALF * d), d };
}

/** World length of a canvas length l (h-units) at depth d. */
export function canvasLengthToWorld(l: number, d: number): number {
  return l * 2 * T_HALF * d;
}

/** Knoll under the cypress; the plain is y = 0 elsewhere (§2.3). */
export function groundHeight(x: number, z: number): number {
  const dx = x + 50;
  const dz = z + 195;
  return 14 * Math.exp(-(dx * dx + dz * dz) / (2 * 110 * 110));
}

const tmpDir = new Vector3();
/** Depth at which canvas ray (u, v) hits the ground; Infinity at or above the horizon. */
export function groundHitDepth(u: number, v: number): number {
  canvasDir(u, v, tmpDir);
  if (tmpDir.y >= -1e-6) return Infinity;
  let d = -EYE.y / tmpDir.y;
  for (let i = 0; i < 4; i++) {
    const x = EYE.x + d * tmpDir.x;
    const z = EYE.z + d * tmpDir.z;
    d = (groundHeight(x, z) - EYE.y) / tmpDir.y;
  }
  return d;
}

/** Vertical FOV of the canvas pose: 36 deg, or wider when the viewport is narrower than the canvas. */
export function canvasPoseFovDeg(aspect: number, canvasAspect = CANVAS_ASPECT): number {
  if (aspect >= canvasAspect) return VFOV_DEG;
  return (2 * Math.atan((T_HALF * canvasAspect) / aspect) * 180) / Math.PI;
}

/** Gallery light: M * rotZ(az) * normalize(-0.45, 0.6, 0.66). */
export function galleryLightDir(azDeg: number, out = new Vector3()): Vector3 {
  const a = (azDeg * Math.PI) / 180;
  const l = new Vector3(-0.45, 0.6, 0.66).normalize();
  const x = l.x * Math.cos(a) - l.y * Math.sin(a);
  const y = l.x * Math.sin(a) + l.y * Math.cos(a);
  return out.set(x, y, l.z).applyMatrix3(EYE_BASIS).normalize();
}

/**
 * Wind-jet filament point (§2.4): cubic Bezier over JET_CTRL in canvas space, offset along its normal by
 * `filamentOffset` h-units; depth d = JET_D0 (JET_D1 / JET_D0)^sigma. tu, tv = tangent in h-units per unit sigma.
 */
export function jetPoint(sigma: number, filamentOffset = 0): { u: number; v: number; d: number; tu: number; tv: number } {
  const s = sigma;
  const m = 1 - s;
  const [p0, p1, p2, p3] = JET_CTRL;
  const b0 = m * m * m, b1 = 3 * m * m * s, b2 = 3 * m * s * s, b3 = s * s * s;
  let u = b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0];
  let v = b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1];
  const d0 = 3 * m * m, d1 = 6 * m * s, d2 = 3 * s * s;
  const tu = (d0 * (p1[0] - p0[0]) + d1 * (p2[0] - p1[0]) + d2 * (p3[0] - p2[0])) * CANVAS_ASPECT;
  const tv = d0 * (p1[1] - p0[1]) + d1 * (p2[1] - p1[1]) + d2 * (p3[1] - p2[1]);
  if (filamentOffset !== 0) {
    const len = Math.hypot(tu, tv) || 1;
    u += (-tv / len) * filamentOffset / CANVAS_ASPECT;
    v += (tu / len) * filamentOffset;
  }
  return { u, v, d: JET_D0 * Math.pow(JET_D1 / JET_D0, s), tu, tv };
}

/** Cypress silhouette [uL, uR] at canvas row v, linearly interpolated; zero width above the tip. */
export function cypressSilhouette(v: number): [number, number] {
  const rows = CYPRESS_SIL;
  if (v <= rows[0][0]) return [rows[0][1], rows[0][2]];
  const last = rows[rows.length - 1];
  if (v >= last[0]) return [0.2, 0.2];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (v <= b[0]) {
      const t = (v - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return [last[1], last[2]];
}

export enum Region { SKY = 0, HILL = 1, VILLAGE = 2, FIELD = 3, CYPRESS = 4 }

export function regionAt(u: number, v: number): Region {
  if (v >= -0.1 && v <= 1.08) {
    const [uL, uR] = cypressSilhouette(v);
    if (u >= uL && u <= uR) return Region.CYPRESS;
  }
  if (v >= ridgeV(u, 2)) return Region.SKY;
  if (v >= 0.2) return Region.HILL;
  if (u >= 0.3 && v >= 0.06) return Region.VILLAGE;
  return Region.FIELD;
}

/**
 * Convert a world-space segment A -> B into the canvas fields of a stroke record so that, from E,
 * canvasToWorld reproduces A and B exactly (u, v, d, du, dv, dlnd as defined in contracts.ts).
 */
export function segmentToStroke(a: Vector3, b: Vector3): { u: number; v: number; d: number; du: number; dv: number; dlnd: number } {
  const A = worldToCanvas(a);
  const B = worldToCanvas(b);
  return {
    u: 0.5 * (A.u + B.u),
    v: 0.5 * (A.v + B.v),
    d: Math.sqrt(A.d * B.d),
    du: (B.u - A.u) * CANVAS_ASPECT,
    dv: B.v - A.v,
    dlnd: Math.log(B.d / A.d),
  };
}

/** World endpoints of a stroke's canvas fields (inverse of segmentToStroke). */
export function strokeEndpoints(u: number, v: number, d: number, du: number, dv: number, dlnd: number, a = new Vector3(), b = new Vector3()): [Vector3, Vector3] {
  canvasToWorld(u - (0.5 * du) / CANVAS_ASPECT, v - 0.5 * dv, d * Math.exp(-0.5 * dlnd), a);
  canvasToWorld(u + (0.5 * du) / CANVAS_ASPECT, v + 0.5 * dv, d * Math.exp(0.5 * dlnd), b);
  return [a, b];
}
