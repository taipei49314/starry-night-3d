// M8 shot list (§5): the keyframe tables as data plus the analytic 96 s timeline that evaluates them.
// Every pose is a pure function of loop time t (no state), so t = 96 reproduces t = 0 exactly and the
// rejoin table / tests can sample anywhere.
//
// Pose conventions:
//  - p: camera position (world metres); d: unit view direction.
//  - roll: degrees, aviation sign (+ = bank right: the camera turns clockwise as the viewer sees it,
//    the horizon tilts counter-clockwise on screen). Applied as a rotation of -roll about the camera's local Z.
//  - fov: vertical FOV in degrees for a frame at least as wide as the canvas (aspect >= 1.2497). The director
//    widens it for narrower screens with `aspectFov` (same tan scale as canvasPoseFovDeg), then applies the caps.
import { Vector3 } from 'three';
import { LOOP_SECONDS, T_HALF } from '../contracts';
import { canvasDir, canvasPoseFovDeg, canvasToWorld, EYE, FORWARD, jetPoint, UP } from '../shared/canvasSpace';
import {
  dollyZoomFov, ease, funnelCameraPoint, hermite, hermite1, logPolarAboutEye, slerpUnit, rotateTowards, vanWijkNuij,
  type EaseName,
} from './paths';

const DEG = Math.PI / 180;
const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

// ---------------------------------------------------------------- shot list (§5.1)
export interface ShotDef { index: number; name: string; t0: number; t1: number; setPiece: string }
export const SHOTS: readonly ShotDef[] = [
  { index: 0, name: 'Canvas', t0: 0, t1: 6, setPiece: 'the painting paints itself and inflates' },
  { index: 1, name: 'Tear', t0: 6, t1: 12, setPiece: 'the matte slides away; a truck proves the depth' },
  { index: 2, name: 'Inhale', t0: 12, t1: 20, setPiece: 'dolly-zoom: the cypress swells, the village stays locked' },
  { index: 3, name: 'Black Flame', t0: 20, t1: 32, setPiece: 'helix climb; burst over the tip, Venus dead ahead' },
  { index: 4, name: 'Venus Gate', t0: 32, t1: 42, setPiece: 'flame becomes wind; punch through Venus; ring tunnel' },
  { index: 5, name: 'Twin Funnels', t0: 42, t1: 52, setPiece: 'pull out: the swirl is two 50 km maelstroms' },
  { index: 6, name: 'The Fall', t0: 52, t1: 64, setPiece: "swoop into c1's mouth; spiral down the wall" },
  { index: 7, name: 'Eye of the Vortex', t0: 64, t1: 73, setPiece: 'calm; the village framed in the throat; the storm wakes' },
  { index: 8, name: 'Storm & Return', t0: 73, t1: 88, setPiece: 'log flight home through the hurricane, backing in' },
  { index: 9, name: 'Homecoming', t0: 88, t1: 96, setPiece: 'snap ripple from Venus; reverse dolly-zoom; matte closes' },
];
export const SHOT_STARTS: readonly number[] = SHOTS.map((s) => s.t0);

export function shotAt(t: number): number {
  let i = 0;
  for (let k = 1; k < SHOT_STARTS.length; k++) if (t >= SHOT_STARTS[k]) i = k;
  return i;
}

// ---------------------------------------------------------------- keyframe constants (§5.1)
/** Venus core, ray direction and the ring-tunnel end (canvas (0.30, 0.72)). */
const VENUS = canvasToWorld(0.3, 0.72, 12000);
const VENUS_RAY = canvasDir(0.3, 0.72);
const C1_AXIS = (d: number, out = new Vector3()) => canvasToWorld(0.43, 0.66, d, out);

// ---- shot 4 climb geometry (§2.3 cypress: base ~(-50, 10, -200), top ~(-51, 154, -175); the trunk leans toward E)
const CYP_BASE = v3(-50, 10, -200);
const CYP_TOP = v3(-51, 154, -175);
/** Shot 4 tuning: end angle on the front arc (+ = right of the trunk as seen from E), left-swing depth, look bias. */
export const HELIX = { r0: 75, r1: 30, y0: 40, y1: 158, thetaEndDeg: 20, swingDeg: 58, lookBias: 0.3, lookTurn: 0.55, lookTopY: 158, bankDeg: 10 } as const;
/** Early swing bump x^3 (1 - x)^4 (zero value and slope at both ends, peak at x = 3/7). */
const helixSwing = (x: number) => x * x * x * Math.pow(1 - x, 4);
const HELIX_SWING_MAX = helixSwing(3 / 7);
/** Point at height y on the trunk axis line (base -> top, extended linearly: no clamp, so the orbit stays C1 above the top). */
export function trunkAxisAt(y: number, out = new Vector3()): Vector3 {
  return out.copy(CYP_BASE).lerp(CYP_TOP, (y - CYP_BASE.y) / (CYP_TOP.y - CYP_BASE.y)).setY(y);
}
/** Smooth min(a, b) = a - k ln(1 + e^((a - b) / k)): ~a when a << b, ~b when a >> b, with a knee ~k wide. */
const softMin = (a: number, b: number, k: number) => a - k * Math.log1p(Math.exp((a - b) / k));
/** Orbit angle (rad) about the trunk at x = (t - 20) / 10; 0 = straight in front (toward E), + = right. */
const helixTheta = (x: number) => HELIX.thetaEndDeg * DEG * ease.smootherstep(x) - (HELIX.swingDeg * DEG * helixSwing(x)) / HELIX_SWING_MAX;
/** Shot 4 camera at x = (t - 20) / 10: theta on the front arc, height and radius on the smootherstep climb. */
function helixPoint(x: number, out: Vector3): Vector3 {
  x = Math.max(0, Math.min(1, x));
  const tau = ease.smootherstep(x);
  const th = helixTheta(x);
  const r = HELIX.r0 + (HELIX.r1 - HELIX.r0) * tau;
  const y = HELIX.y0 + (HELIX.y1 - HELIX.y0) * tau;
  trunkAxisAt(y, out);
  return out.set(out.x + r * Math.sin(th), y, out.z + r * Math.cos(th));
}

export const KEYS = {
  E: EYE.clone(),
  F: FORWARD.clone(),
  /** shot 2 end / shot 3 start */
  P2: v3(-40, 59.5, -19.7),
  /** rotY(+5 deg) F */
  DIR2: FORWARD.clone().applyAxisAngle(v3(0, 1, 0), 5 * DEG),
  /** shot 3 end */
  P3: v3(-49, 40, -120),
  /** dolly-zoom lock (fields and village front) */
  L3: v3(0, 0, -453),
  TRUNK: v3(-50, 110, -192),
  /** helix end / burst start: front-right of the flame tip (the spec's (-26, 175, -192) sat behind it, so the tip was never seen) */
  BURST0: helixPoint(1, new Vector3()),
  BURST1: v3(-45, 210, -235),
  VENUS,
  VENUS_DIR: VENUS_RAY.clone().normalize(),
  RAY_END: canvasToWorld(0.3, 0.72, 24000),
  /**
   * Shot 6 viewpoints, below-left of the twin funnels (the spec's V6 / V6b sat ~30 km above them, so the frame looked
   * down past the funnels into the dark below-horizon backdrop and they read as thin spikes). From here both funnels
   * lie broadside (sight line 52-63 deg off their axes), c1 in front of c2, flaring from the throats (right) to the
   * mouths (left), against the painted sky decks and the eddies E1 / E2 above them. V6 shows both whole; the push to
   * V6b brings the mouths in to fill the left of the frame.
   */
  V6: canvasToWorld(-0.2, 0.33, 46000),
  V6B: canvasToWorld(0.08, 0.29, 55000),
  /** shot 6 lens (the spec's 56 deg cut the throats off from the new viewpoints) */
  FOV6: 60,
  /** canvas (0.51, 0.635) at 62 km */
  P_MID: canvasToWorld(0.51, 0.635, 62000),
  /** the table's c1 mouth entry (canvas (0.43, 0.78), 88 km); the spiral formula starts at (0.43, 0.756, 86.9 km) */
  C1_MOUTH_TABLE: v3(-5003, 31100, -83883),
  A47: C1_AXIS(47000),
  A44: C1_AXIS(44000),
  /** E + 360 F */
  H0: EYE.clone().addScaledVector(FORWARD, 360),
  /** steeple depth along F for the reverse dolly-zoom */
  STEEPLE_DEPTH: 671.5,
} as const;

/** Keyframe table for tests (§5.1 / §9.2). `approx` rows are "≈" values in the spec that the formulas do not reproduce exactly. */
export interface KeyframeCheck {
  t: number; label: string; pos?: [number, number, number]; look?: [number, number, number]; lookAt?: [number, number, number];
  fov?: number; roll?: number; approx?: number;
}
export const KEYFRAME_CHECKS: readonly KeyframeCheck[] = [
  { t: 0, label: 'shot 1 canvas pose', pos: [0, 50, 0], lookAt: [0, 223.6, -984.8], fov: 36, roll: 0 },
  { t: 6, label: 'shot 2 start (rest)', pos: [0, 50, 0], fov: 36 },
  { t: 10, label: '9.2 t=10: ~34 m left, FOV ~39', pos: [-34.07, 58.09, -16.78], fov: 39.41, approx: 0.2 },
  { t: 12, label: 'shot 2 end', pos: [-40, 59.5, -19.7], look: [-0.0858, 0.1736, -0.9811], fov: 40 },
  { t: 20, label: 'shot 3 end', pos: [-49, 40, -120], fov: 54 },
  // shot 4 reworked (front-arc climb): left flank at ~24.3 s, sweeping back across the front; the spec's t=25 pose
  // (-83.2, 107.5, -225.2) sat behind the trunk looking back at E's side
  { t: 24.3, label: 'climb: left flank, trunk right of centre', pos: [-95.58, 83.71, -150.17], look: [0.49713, 0.47789, -0.72421], fov: 56.22 },
  { t: 25, label: 'climb: sweeping back across the front', pos: [-87.08, 99, -146.78], look: [0.42679, 0.49968, -0.75377], fov: 57, roll: -6.36 },
  { t: 30, label: 'climb top / burst start (front-right of the tip)', pos: [-40.77, 158, -146.11], lookAt: [-1949, 3823, -11520], fov: 60, roll: 0 },
  { t: 32, label: 'burst end', pos: [-45, 210, -235], lookAt: [-1949, 3823, -11520], fov: 78, roll: 0 },
  { t: 37.5, label: 'punch: Venus core', pos: [-1949, 3823, -11520], look: [-0.1588, 0.3075, -0.9384], fov: 78 },
  { t: 42, label: 'ring tunnel end', pos: [-3898, 7597, -23040], look: [-0.1588, 0.3075, -0.9384], fov: 72, roll: -15 },
  { t: 48, label: 'V6 (below-left of the funnels)', pos: [-26150, 3033, -46184], lookAt: [504, 16173, -60114], fov: 60, roll: 0 },
  { t: 52, label: 'V6b (below-left of the funnels)', pos: [-18759, 2209, -55468], lookAt: [504, 16173, -60114], fov: 60, roll: 0 },
  { t: 55.5, label: 'c1 mouth entry (table, approx)', pos: [-5003, 31100, -83883], fov: 70, approx: 2500 },
  { t: 59.75, label: 'spiral midpoint (approx)', pos: [-3659, 15346, -62661], approx: 600 },
  { t: 64, label: 'spiral end (approx)', pos: [-2700, 13900, -45800], fov: 74, approx: 200 },
  { t: 66.5, label: 'A47 glide end', pos: [-2672, 13024, -45437], lookAt: [0, 50, 0], fov: 70, roll: -10 },
  { t: 67, label: 'A47 push start', pos: [-2672, 13024, -45437], lookAt: [0, 50, 0], fov: 70 },
  { t: 71, label: 'A44 telephoto', pos: [-2501, 12196, -42537], lookAt: [0, 50, 0], fov: 26 },
  { t: 73, label: 'A44 storm start', pos: [-2501, 12196, -42537], lookAt: [0, 50, 0], fov: 26 },
  { t: 82.5, label: 'face F', look: [0, 0.173648, -0.984808], fov: 60, roll: 0 },
  { t: 88, label: 'H0', pos: [0, 112.5, -354.5], look: [0, 0.173648, -0.984808], fov: 70.0, roll: 0 },
  { t: 95.5, label: 'home', pos: [0, 50, 0], look: [0, 0.173648, -0.984808], fov: 36, roll: 0 },
  { t: 96, label: 'loop end', pos: [0, 50, 0], look: [0, 0.173648, -0.984808], fov: 36, roll: 0 },
];

// ---------------------------------------------------------------- envelopes (§5.2) as data
/** [time, value, ease of the segment that ends at this key (default linear)] */
export type EnvKey = readonly [number, number, EaseName?];
export type EnvChannel = 'bloom' | 'exposure' | 'matte' | 'smear' | 'storm' | 'dust' | 'galleryLightDeg';
export const ENV_KEYS: Record<EnvChannel, readonly EnvKey[]> = {
  bloom: [[0, 0.45], [6, 0.45], [7, 0.5], [12, 0.5], [13, 0.6], [20, 0.6], [20.5, 0.7], [30, 0.9], [32, 0.9], [37.5, 1.6],
    [38, 1.3], [42, 1.3], [43, 0.9], [64, 0.9], [65, 1.0], [73, 1.0], [74, 0.9], [87.5, 0.9], [88.3, 0.45], [96, 0.45]],
  exposure: [[0, 1], [37.3, 1], [37.55, 0.5], [37.85, 0.5], [38.6, 1], [64, 1], [65, 1.1], [73, 1.1], [74, 1], [96, 1]],
  matte: [[0, 1], [6, 1], [8, 0, 'inOutCubic'], [93, 0], [95.5, 1, 'inOutCubic'], [96, 1]],
  smear: [[0, 0], [12, 0], [12.5, 0.2], [20, 0.2], [20.5, 0.3], [30, 0.5], [32, 0.5], [32.5, 0.8], [37.5, 0.8], [38, 0.6],
    [42, 0.6], [42.5, 0.4], [52, 0], [52.5, 0.7], [64, 0.7], [64.5, 0], [73, 0], [73.5, 0.6], [88, 0.2], [88.5, 0], [96, 0]],
  // stays 1 until 88.5 so the snap (|C-E| first < 360 m, just after 88.0) fires while the storm is armed
  storm: [[0, 0], [70, 0], [73, 1, 'smoothstep'], [88.5, 1], [89, 0], [96, 0]],
  // 88-96: 0.3 * smoothstep(0.5, 40, |C-E|) (follows uOff), evaluated in timelineEnv
  dust: [[0, 0], [6, 0], [12, 1], [73, 1], [88, 0.3], [96, 0.3]],
  galleryLightDeg: [[0, -15], [2, -15], [6, 15, 'inOutSine'], [92, 15], [96, -15, 'inOutSine']],
};
/** Bloom pulse +0.4 during 88.6-88.9 (sine bump). */
export const BLOOM_PULSE = { t0: 88.6, t1: 88.9, amp: 0.4 } as const;

export function evalEnvKeys(keys: readonly EnvKey[], t: number): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const x = (t - k0[0]) / (k1[0] - k0[0]);
      return k0[1] + (k1[1] - k0[1]) * ease[k1[2] ?? 'linear'](x);
    }
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------- pose type and comfort
export interface CamPose { p: Vector3; d: Vector3; roll: number; fov: number }
export const newPose = (): CamPose => ({ p: new Vector3(), d: new Vector3(0, 0, -1), roll: 0, fov: 36 });
export function copyPose(dst: CamPose, src: CamPose): CamPose {
  dst.p.copy(src.p); dst.d.copy(src.d); dst.roll = src.roll; dst.fov = src.fov;
  return dst;
}

export const COMFORT = {
  rollMaxDeg: 30, rollRateMaxDegS: 25, fovMaxDeg: 80, yawPirouetteMaxDegS: 33,
  calmRollScale: 0.5, calmFovMaxDeg: 70,
} as const;

/** Widen a reference FOV (wide frame) for `aspect` with the same tan scale canvasPoseFovDeg uses. */
export function aspectFov(fovDeg: number, aspect: number): number {
  const k = Math.tan((canvasPoseFovDeg(aspect) * DEG) / 2) / T_HALF;
  if (k === 1) return fovDeg;
  return (2 * Math.atan(k * Math.tan((fovDeg * DEG) / 2))) / DEG;
}

/** Comfort caps (§4.8, §8 risk 9) applied after path evaluation: roll <= 30 deg (x0.5 calm), FOV <= 80 (70 calm). */
export function applyComfort(pose: CamPose, aspect: number, calm: boolean): CamPose {
  let roll = pose.roll * (calm ? COMFORT.calmRollScale : 1);
  roll = Math.max(-COMFORT.rollMaxDeg, Math.min(COMFORT.rollMaxDeg, roll));
  pose.roll = roll;
  const canvasFov = canvasPoseFovDeg(aspect);
  const cap = Math.max(calm ? COMFORT.calmFovMaxDeg : COMFORT.fovMaxDeg, canvasFov);
  pose.fov = Math.min(cap, aspectFov(pose.fov, aspect));
  return pose;
}

// ---------------------------------------------------------------- timeline
interface Segment {
  t0: number; t1: number;
  pos(t: number, out: Vector3): Vector3;
  orient(t: number, pose: CamPose): void;   // writes d, roll, fov (pose.p already holds pos(t))
}
interface Blend {
  tb: number; w: number; prev: number; next: number;
  p0: Vector3; v0: Vector3; p1: Vector3; v1: Vector3;
  d0: Vector3; dd0: Vector3; d1: Vector3; dd1: Vector3;
  r0: number; rr0: number; r1: number; rr1: number;
  f0: number; ff0: number; f1: number; ff1: number;
}

const H = 1e-3;
const tA = new Vector3(), tB = new Vector3(), tC = new Vector3(), tD = new Vector3(), tE = new Vector3();

/** Normalised "flat-top" ease: smoothstep-shaped acceleration over the first/last `r` of [0, 1], constant rate between. Peak rate 1/(1 - r). */
export function trapEase(x: number, r: number): number {
  x = Math.max(0, Math.min(1, x));
  const ramp = (y: number) => r * (y * y * y - (y * y * y * y) / 2);
  let a: number;
  if (x <= r) a = ramp(x / r);
  else if (x >= 1 - r) a = 1 - r - ramp((1 - x) / r);
  else a = r / 2 + (x - r);
  return a / (1 - r);
}

/** Shot 7 spiral end roll (deg): shot 8's cubic wind-on from here reaches -10 at 66.5 with exactly -4 deg/s. */
const ROLL_SPIRAL_END = -20 / 3;

const headingOf = (d: Vector3) => Math.atan2(-d.x, -d.z);
const dirFrom = (psi: number, phi: number, out: Vector3) =>
  out.set(-Math.sin(psi) * Math.cos(phi), Math.sin(phi), -Math.cos(psi) * Math.cos(phi));

/**
 * The 96 s cinematic. `pose(t)` / `position(t)` are pure; boundaries that are not C1 by construction get a built-in
 * Hermite blend over [tb, tb + w] (the previous shot's end pose is kept exactly, the next shot is joined at tb + w).
 */
export class Timeline {
  readonly segments: Segment[] = [];
  readonly blends: Blend[] = [];
  /** shot 9 pirouette window and peak yaw rate (deg/s), filled at construction */
  readonly pirouette = { t0: 76, t1: 82.5, ratio: 0, peakDegS: 0, deltaDeg: 0 };
  /** jet-ride ease end slope (matches the ring-tunnel start speed) */
  jetEndSlope = 0;

  constructor() {
    this.build();
  }

  // ------------------------------------------------------------ public evaluation
  /** Wrapped loop time; 96 maps to 96 (end of shot 10), not 0, so tests can sample the closing pose. */
  position(t: number, out: Vector3): Vector3 {
    const bl = this.blendAt(t);
    if (bl) {
      const s = (t - bl.tb) / bl.w;
      return hermite(bl.p0, tA.copy(bl.v0).multiplyScalar(bl.w), bl.p1, tB.copy(bl.v1).multiplyScalar(bl.w), s, out);
    }
    return this.seg(t).pos(t, out);
  }

  /** Full pose at loop time t in [0, 96] (reference FOV, raw roll; apply `applyComfort` for output). */
  pose(t: number, out: CamPose): CamPose {
    const bl = this.blendAt(t);
    if (bl) {
      const s = (t - bl.tb) / bl.w;
      const w = bl.w;
      hermite(bl.p0, tA.copy(bl.v0).multiplyScalar(w), bl.p1, tB.copy(bl.v1).multiplyScalar(w), s, out.p);
      hermite(bl.d0, tA.copy(bl.dd0).multiplyScalar(w), bl.d1, tB.copy(bl.dd1).multiplyScalar(w), s, out.d).normalize();
      out.roll = hermite1(bl.r0, bl.rr0 * w, bl.r1, bl.rr1 * w, s);
      out.fov = hermite1(bl.f0, bl.ff0 * w, bl.f1, bl.ff1 * w, s);
      return out;
    }
    const sg = this.seg(t);
    sg.pos(t, out.p);
    sg.orient(t, out);
    return out;
  }

  /** Velocity (m/s) by central difference of `position`. */
  velocity(t: number, out: Vector3): Vector3 {
    const a = this.position(Math.max(0, t - H), tC);
    const b = this.position(Math.min(LOOP_SECONDS, t + H), tD);
    const span = Math.min(LOOP_SECONDS, t + H) - Math.max(0, t - H);
    return out.subVectors(b, a).divideScalar(span);
  }

  // ------------------------------------------------------------ internals
  private seg(t: number): Segment {
    const S = this.segments;
    if (t <= S[0].t0) return S[0];
    for (let i = 0; i < S.length; i++) if (t < S[i].t1) return S[i];
    return S[S.length - 1];
  }
  private blendAt(t: number): Blend | null {
    for (const b of this.blends) if (t >= b.tb && t < b.tb + b.w) return b;
    return null;
  }
  /** Unit tangent of the (blended) position track, for look-ahead directions inside a segment definition. */
  private tangentAt(t: number, out: Vector3): Vector3 {
    const a = this.position(t - H, tE);
    const b = this.position(t + H, out);
    return b.sub(a).normalize();
  }

  private add(t0: number, t1: number, pos: Segment['pos'], orient: Segment['orient']): void {
    this.segments.push({ t0, t1, pos, orient });
  }

  private build(): void {
    const K = KEYS;
    const lookAt = (p: Vector3, target: Vector3, out: Vector3) => out.subVectors(target, p).normalize();

    // ---- shot 1: Canvas (0-6)
    this.add(0, 6, (_t, o) => o.copy(K.E), (_t, P) => { P.d.copy(K.F); P.roll = 0; P.fov = 36; });

    // ---- shot 2: Tear (6-12)
    this.add(6, 12,
      (t, o) => o.copy(K.E).lerp(K.P2, ease.inOutCubic((t - 6) / 6)),
      (t, P) => {
        const e = ease.inOutCubic((t - 6) / 6);
        slerpUnit(K.F, K.DIR2, e, P.d);
        P.roll = 0;
        P.fov = 36 + 4 * e;
      });

    // ---- shot 3: Inhale (12-20): dolly-zoom on L along the held shot-2 direction, then tilt up 25 deg to the trunk
    const D0 = tA.subVectors(K.L3, K.P2).dot(K.DIR2);
    const dz = (p: Vector3) => dollyZoomFov(40, D0, tB.subVectors(K.L3, p).dot(K.DIR2));
    const p3 = (t: number, o: Vector3) => o.copy(K.P2).lerp(K.P3, ease.inOutSine((t - 12) / 8));
    const dzEnd = dz(K.P3);
    this.add(12, 20, p3, (t, P) => {
      const w = ease.inOutSine((t - 18.5) / 1.5);
      if (w > 0) rotateTowards(K.DIR2, lookAt(P.p, K.TRUNK, tC), 25 * DEG * w, P.d);
      else P.d.copy(K.DIR2);
      P.roll = 0;
      P.fov = dz(P.p) + w * (54 - dzEnd);
    });

    // ---- shot 4: Black Flame climb (20-30)
    // A climbing spiral that stays on the front arc of the trunk (E's side), so the painted world is always behind the
    // flame (the spec helix, 450 deg about the trunk, spent ~4 s behind it looking back at E's empty side): the camera
    // winds out to the left flank (theta ~ -49 deg at 24.3 s, the swirl and stars beside the trunk), then sweeps back
    // across the front while it climbs and closes in, ending front-right of the main flame tip (BURST0: level with
    // it, 30 m in front), so the tip sits low in frame under Venus and the burst passes ~14 m over it. Height and radius keep the spec's
    // smootherstep climb shape (40 -> 158 m, 75 -> 30 m) about the leaning trunk axis. The look aims at the trunk
    // 30 m above the camera (saturating at the tips), biased 30 % toward Venus, and turns fully to Venus over the last
    // 4.5 s. Bank (<= 10 deg) follows the orbit rate: the left swing banks right, the sweep back banks left.
    const helixThetaRate = (x: number) => (helixTheta(Math.min(1, x + 1e-4)) - helixTheta(Math.max(0, x - 1e-4))) / (Math.min(1, x + 1e-4) - Math.max(0, x - 1e-4));
    let thetaRateMax = 0;
    for (let i = 0; i <= 200; i++) thetaRateMax = Math.max(thetaRateMax, Math.abs(helixThetaRate(i / 200)));
    const helixPos = (t: number, o: Vector3) => helixPoint((t - 20) / 10, o);
    const trunkLook = new Vector3();
    this.add(20, 30, helixPos, (t, P) => {
      const x = Math.max(0, Math.min(1, (t - 20) / 10));
      const tau = ease.smootherstep(x);
      // aim 30 m above the camera, saturating smoothly at the flame tips (a hard min would kink the view rate)
      trunkAxisAt(softMin(HELIX.y0 + (HELIX.y1 - HELIX.y0) * tau + 30, HELIX.lookTopY, 8), trunkLook);
      lookAt(P.p, trunkLook, tC);
      lookAt(P.p, K.VENUS, tD);
      const w = HELIX.lookBias + (1 - HELIX.lookBias) * ease.inOutSine((x - HELIX.lookTurn) / (1 - HELIX.lookTurn));
      slerpUnit(tC, tD, w, P.d);
      // theta' > 0: the camera orbits right and the view yaws left -> bank left (negative); zero rate at both ends
      P.roll = (-HELIX.bankDeg * helixThetaRate(x)) / thetaRateMax;
      P.fov = 54 + 6 * tau;
    });

    // ---- shot 4 burst (30-32)
    this.add(30, 32,
      (t, o) => o.copy(K.BURST0).lerp(K.BURST1, ease.outQuint((t - 30) / 2)),
      (t, P) => {
        lookAt(P.p, K.VENUS, P.d);
        P.roll = 0;
        P.fov = 60 + 18 * ease.inOutSine((t - 30) / 2);
      });

    // ---- shot 5a: ride the wind jet (32-37.5)
    // sigma = 0.12 + 0.88 * jetEase(x): starts at rest like inOutSine, but ends with the ring-tunnel start speed so the
    // camera punches through the core instead of stopping in it. A decaying offset joins the spec's burst end
    // (106 m off the jet), and over sigma 0.7-1 the path converges onto the Venus ray (the jet ends 0.015 v above
    // the core), arriving tangent to it, so 37.5 is C1 without a blend.
    const jetBase = (sigma: number, o: Vector3) => {
      const j = jetPoint(sigma);
      return canvasToWorld(j.u, j.v, j.d, o).addScaledVector(UP, 6 * (1 - sigma));
    };
    const offStart = new Vector3().subVectors(K.BURST1, jetBase(0.12, new Vector3()));
    const jetRay = new Vector3();
    const jetSigmaPos = (sigma: number, o: Vector3) => {
      jetBase(sigma, o);
      const w = ease.smootherstep((sigma - 0.7) / 0.3);
      if (w <= 0) return o;
      canvasToWorld(0.3, 0.72, jetPoint(sigma).d, jetRay);
      return o.lerp(jetRay, w);
    };
    // ring tunnel speed at 37.5 vs |dP/dsigma| at sigma = 1
    const rayD = (t: number) => 12000 * Math.pow(2, ease.outCubic((t - 37.5) / 4.5));
    const raySpeed = 12000 * Math.LN2 * (3 / 4.5) * VENUS_RAY.length();
    const dPds = jetSigmaPos(1, new Vector3()).sub(jetSigmaPos(1 - 1e-4, new Vector3())).length() / 1e-4;
    const sigmaRateEnd = raySpeed / dPds;               // d sigma / dt at 37.5
    this.jetEndSlope = (sigmaRateEnd * 5.5) / 0.88;     // d jetEase / dx at x = 1
    const m1 = this.jetEndSlope;
    const jetEase = (x: number) => {
      x = Math.max(0, Math.min(1, x));
      return hermite1(0, 0, 1, m1, x);
    };
    const jetPos = (t: number, o: Vector3) => {
      const sigma = 0.12 + 0.88 * jetEase((t - 32) / 5.5);
      jetSigmaPos(sigma, o);
      return o.addScaledVector(offStart, 1 - ease.smootherstep((t - 32) / 2.5));
    };
    this.add(32, 37.5, jetPos, (t, P) => {
      this.tangentAt(Math.min(t + 0.4, 41.9), tC);
      const e = ease.inOutSine((t - 32) / 1.5);
      if (e >= 1) P.d.copy(tC);
      else slerpUnit(lookAt(P.p, K.VENUS, tD), tC, e, P.d);
      P.roll = 0;
      P.fov = 78;
    });

    // ---- shot 5b: ring tunnel along the Venus ray (37.5-42)
    this.add(37.5, 42,
      (t, o) => canvasToWorld(0.3, 0.72, rayD(t), o),
      (t, P) => {
        const x = Math.max(0, Math.min(1, (t - 37.5) / 4.5));
        P.d.copy(K.VENUS_DIR);
        // 0 -> -15 at a near-constant rate (4.4 deg/s plateau, 3.3 deg/s mean) with eased ends: the jet rides at
        // roll 0 and shot 6 unwinds from rest, so a linear ramp would kink the roll rate at 37.5 and 42.0
        P.roll = -15 * trapEase(x, 0.25);
        P.fov = 78 - 6 * ease.inOutSine(x);
      });

    // ---- shot 6a: van Wijk-Nuij pull-out to V6 (42-48)
    const fovW = (f: number) => 2 * Math.tan((f * DEG) / 2);
    const w0 = fovW(72) * K.P_MID.distanceTo(K.RAY_END);
    const w1 = fovW(K.FOV6) * K.P_MID.distanceTo(K.V6);
    const vwn = vanWijkNuij(K.RAY_END, w0, K.V6, w1, 1.4);
    const vwnU1 = K.RAY_END.distanceTo(K.V6);
    const kappa = 1 / fovW(64);
    const pullAway = new Vector3();
    const pullPos = (t: number, o: Vector3) => {
      const S01 = ease.inOutSine((t - 42) / 6);
      const at = vwn.at(S01);
      const u = at.center.distanceTo(K.RAY_END) / vwnU1;
      const wLin = w0 + (w1 - w0) * u;
      const away = pullAway.subVectors(at.center, K.P_MID).normalize();
      return o.copy(at.center).addScaledVector(away, (at.width - wLin) * kappa);
    };
    this.add(42, 48, pullPos, (t, P) => {
      const e = ease.inOutSine((t - 42) / 6);
      slerpUnit(K.VENUS_DIR, lookAt(P.p, K.P_MID, tC), e, P.d);
      P.roll = -15 * (1 - e);
      P.fov = 72 + (K.FOV6 - 72) * e;
    });

    // ---- shot 6b: linear push V6 -> V6b (48-52)
    const pushVel = new Vector3().subVectors(K.V6B, K.V6).divideScalar(4);
    this.add(48, 52,
      (t, o) => o.copy(K.V6).lerp(K.V6B, Math.max(0, Math.min(1, (t - 48) / 4))),
      (_t, P) => { lookAt(P.p, K.P_MID, P.d); P.roll = 0; P.fov = K.FOV6; });

    // ---- shot 7b spiral (55.5-64), defined first because the swoop joins it
    const spiralAt = (tau: number, o: Vector3) =>
      funnelCameraPoint(0, 0.12 * Math.pow(0.25, tau), (90 - 360 * tau) * DEG, 0.8, o);
    const tau7 = (t: number) => ease.inOutSine((t - 55.5) / 8.5);
    const spiralPos = (t: number, o: Vector3) => spiralAt(tau7(t), o);
    const AHEAD = 0.6 / (2 * Math.PI);
    const spP = new Vector3(), spA = new Vector3(), spX = new Vector3();
    const spiralDir = (t: number, o: Vector3) => {
      const tau = tau7(t);
      const p = spiralAt(tau, spP);
      const r = 0.12 * Math.pow(0.25, tau);
      const dCam = 40000 * Math.pow(r / 0.02, 0.433);
      const ahead = spiralAt(tau + AHEAD, spA);
      const axis = C1_AXIS(dCam - 6000, spX);
      const target = ahead.multiplyScalar(0.7).addScaledVector(axis, 0.3);
      return o.subVectors(target, p).normalize();
    };
    // Roll = clamp(0.6 x yaw rate). The yaw rate is the spiral's turn rate about the c1 axis, d theta / dt
    // (mean 42 deg/s, peak 66 deg/s; negative = clockwise = co-rotation with c1, the same sense as shot 8's drift),
    // soft-clamped at 25 deg. Over the second half it blends to ROLL_SPIRAL_END with zero slope, so shot 8 can wind
    // on smoothly to -10 deg at 66.5 with the -4 deg/s drift rate (the roll "unwinds" to its smallest bank at 64).
    const spiralRoll = (t: number) => {
      const x = Math.max(0, Math.min(1, (t - 55.5) / 8.5));
      const thetaRate = (-360 * Math.PI * Math.sin(Math.PI * x)) / (2 * 8.5);   // deg/s, d/dt of 90 - 360 tau
      const bank = 25 * Math.tanh((0.6 * thetaRate) / 25);
      const b = ease.smoothstep((x - 0.5) / 0.5);
      return bank * (1 - b) + ROLL_SPIRAL_END * b;
    };
    const spiralStartDir = spiralDir(55.5, new Vector3());
    const spiralStart = spiralAt(0, new Vector3());

    // ---- shot 7a swoop (52-55.5): Hermite V6b -> spiral start, leaving with the push velocity and arriving along the
    // spiral tangent at a quarter of the spiral's speed at 56.0 (the spiral itself starts from rest; with 1/4 the
    // 0.5 s join accelerates monotonically). The look turns from P_mid to the spiral's own look. The P_mid target is
    // carried along with the camera after the first ~0.8 s (from V6b the swoop passes ~18 km from P_mid at ~17 km/s,
    // and a fixed target whipped the view at ~69 deg/s); it still starts fixed, so the view rate is C1 at 52.
    const swoopM0 = pushVel.clone().multiplyScalar(3.5);
    const swoopTgt = new Vector3();
    const spiralV = new Vector3().subVectors(spiralPos(56.0 + H, new Vector3()), spiralPos(56.0 - H, new Vector3())).divideScalar(2 * H);
    const spiralT0 = new Vector3().subVectors(spiralAt(1e-4, new Vector3()), spiralAt(0, new Vector3())).normalize();
    const swoopM1 = spiralT0.multiplyScalar(0.25 * spiralV.length() * 3.5);
    this.add(52, 55.5,
      (t, o) => hermite(K.V6B, swoopM0, spiralStart, swoopM1, Math.max(0, Math.min(1, (t - 52) / 3.5)), o),
      (t, P) => {
        const e = ease.inOutSine((t - 52) / 3.5);
        swoopTgt.subVectors(P.p, K.V6B).multiplyScalar(ease.smoothstep((t - 52) / 0.8)).add(K.P_MID);
        slerpUnit(lookAt(P.p, swoopTgt, tC), spiralStartDir, e, P.d);
        P.roll = 0;
        P.fov = K.FOV6 + (70 - K.FOV6) * e;
      });
    this.add(55.5, 64, spiralPos, (t, P) => {
      spiralDir(t, P.d);
      P.roll = spiralRoll(t);
      P.fov = 70 + 4 * tau7(t);
    });

    // ---- shot 8: Eye of the Vortex (64-73)
    const spiralEnd = spiralAt(1, new Vector3());
    const spiralEndDir = spiralDir(64, new Vector3());
    const driftRoll = (t: number) => -10 - 20 * (1 - Math.exp((-(t - 66.5) * 4) / 20)); // -4 deg/s, soft clamp at -30
    const roll73 = driftRoll(73);
    const rollRate73 = -4 * Math.exp((-(73 - 66.5) * 4) / 20);
    this.add(64, 66.5,
      (t, o) => o.copy(spiralEnd).lerp(K.A47, ease.inOutSine((t - 64) / 2.5)),
      (t, P) => {
        const x = Math.max(0, Math.min(1, (t - 64) / 2.5));
        slerpUnit(spiralEndDir, lookAt(P.p, K.E, tC), ease.inOutSine(x), P.d);
        // spiral end (slope 0) -> -10 at 66.5 with slope -4 deg/s: a pure cubic, monotone
        P.roll = ROLL_SPIRAL_END + (-10 - ROLL_SPIRAL_END) * x * x * x;
        P.fov = 74 - 4 * ease.inOutSine(x);
      });
    this.add(66.5, 67, (_t, o) => o.copy(K.A47), (t, P) => { lookAt(P.p, K.E, P.d); P.roll = driftRoll(t); P.fov = 70; });
    this.add(67, 71,
      (t, o) => o.copy(K.A47).lerp(K.A44, ease.inOutCubic((t - 67) / 4)),
      (t, P) => { lookAt(P.p, K.E, P.d); P.roll = driftRoll(t); P.fov = 70 - 44 * ease.inOutCubic((t - 67) / 4); });
    this.add(71, 73, (_t, o) => o.copy(K.A44), (t, P) => { lookAt(P.p, K.E, P.d); P.roll = driftRoll(t); P.fov = 26; });

    // ---- shot 9: Storm & Return (73-88): log-polar flight A44 -> H0; look at E, yaw pirouette, face F backing in
    const s9 = (t: number) => ease.inOutSine((t - 73) / 15);
    const pos9 = (t: number, o: Vector3) => logPolarAboutEye(K.A44, K.H0, s9(t), o);
    const pir = this.pirouette;
    const pirStartDir = lookAt(pos9(pir.t0, new Vector3()), K.E, new Vector3());
    const psi0 = headingOf(pirStartDir);
    const psi1 = headingOf(K.F);
    const phi1 = Math.asin(K.F.y);
    let dPsi = psi1 - psi0;
    while (dPsi > Math.PI) dPsi -= 2 * Math.PI;
    while (dPsi < -Math.PI) dPsi += 2 * Math.PI;
    const T = pir.t1 - pir.t0;
    const yawMax = COMFORT.yawPirouetteMaxDegS - 0.5;
    pir.ratio = Math.max(0.05, Math.min(0.5, 1 - Math.abs(dPsi) / DEG / (T * yawMax)));
    pir.deltaDeg = dPsi / DEG;
    pir.peakDegS = Math.abs(dPsi) / DEG / (T * (1 - pir.ratio));
    const fovH0 = dollyZoomFov(36, K.STEEPLE_DEPTH, K.STEEPLE_DEPTH - 360);
    // The pirouette starts from the live look-at-E heading/pitch (not a frozen one), so the view's angular velocity is
    // continuous at pir.t0; the heading is unwrapped against psi0 because look-at-E sits next to the +-180 deg seam.
    const lookE = new Vector3();
    this.add(73, 88, pos9, (t, P) => {
      if (t <= pir.t0) lookAt(P.p, K.E, P.d);
      else if (t >= pir.t1) P.d.copy(K.F);
      else {
        const x = (t - pir.t0) / T;
        lookAt(P.p, K.E, lookE);
        let psiE = headingOf(lookE) - psi0;
        while (psiE > Math.PI) psiE -= 2 * Math.PI;
        while (psiE < -Math.PI) psiE += 2 * Math.PI;
        psiE += psi0;
        const phiE = Math.asin(Math.max(-1, Math.min(1, lookE.y)));
        dirFrom(psiE + (psi0 + dPsi - psiE) * trapEase(x, pir.ratio), phiE + (phi1 - phiE) * ease.inOutSine(x), P.d);
      }
      // unwind the shot 8 drift to 0 over 73-77, leaving with the drift's own roll rate (C1 at 73)
      P.roll = hermite1(roll73, rollRate73 * 4, 0, 0, Math.max(0, Math.min(1, (t - 73) / 4)));
      if (t < 77) P.fov = 26 + 34 * ease.inOutSine((t - 73) / 4);
      else if (t < 82.5) P.fov = 60;
      else P.fov = 60 + (fovH0 - 60) * ease.inOutSine((t - 82.5) / 5.5);
    });

    // ---- shot 10: Homecoming (88-96): back into E along F with the reverse dolly-zoom on the steeple
    const s10 = (t: number) => 360 * (1 - ease.inOutCubic((t - 88) / 7.5));
    this.add(88, 96 + 1e-9,
      (t, o) => (t >= 95.5 ? o.copy(K.E) : o.copy(K.E).addScaledVector(K.F, s10(t))),
      (t, P) => {
        P.d.copy(K.F);
        P.roll = 0;
        const s = t >= 95.5 ? 0 : s10(t);
        P.fov = s === 0 ? 36 : dollyZoomFov(36, K.STEEPLE_DEPTH, K.STEEPLE_DEPTH - s);
      });

    // ---- C1 blends at the joins that are not continuous by construction. Positions first (pure segment functions),
    // then orientation, whose look-ahead tangents read the final blended position track.
    const specs: [number, number][] = [
      [20, 1.0],   // helix start is 2.2 m and ~10 deg away from the Inhale end pose
      [30, 0.5],   // helix ends at rest, the burst leaves at 146 m/s (outQuint)
      [48, 0.5],   // vWN arrives at rest, the push is linear
      [55.5, 0.5], // swoop arrival vs spiral start (the spiral starts from rest)
    ];
    for (const [tb, w] of specs) this.addBlendPos(tb, w);
    for (const b of this.blends) this.fillBlendOrient(b);
  }

  private addBlendPos(tb: number, w: number): void {
    const S = this.segments;
    const prev = S.findIndex((s) => Math.abs(s.t1 - tb) < 1e-9);
    const next = S.findIndex((s) => Math.abs(s.t0 - tb) < 1e-9);
    const A = S[prev];
    const B = S[next];
    const a = A.pos(tb, new Vector3());
    const aM = A.pos(tb - H, new Vector3());
    const bM = B.pos(tb + w - H, new Vector3());
    const bP = B.pos(tb + w + H, new Vector3());
    const z = () => new Vector3();
    this.blends.push({
      tb, w, prev, next,
      p0: a.clone(), v0: a.clone().sub(aM).divideScalar(H),
      p1: B.pos(tb + w, new Vector3()), v1: bP.clone().sub(bM).divideScalar(2 * H),
      d0: z(), dd0: z(), d1: z(), dd1: z(), r0: 0, rr0: 0, r1: 0, rr1: 0, f0: 0, ff0: 0, f1: 0, ff1: 0,
    });
  }

  private fillBlendOrient(bl: Blend): void {
    const A = this.segments[bl.prev];
    const B = this.segments[bl.next];
    const evalSeg = (sg: Segment, t: number) => {
      const P = newPose();
      sg.pos(t, P.p);
      sg.orient(t, P);
      return P;
    };
    const { tb, w } = bl;
    const a = evalSeg(A, tb);
    const aM = evalSeg(A, tb - H);
    const b = evalSeg(B, tb + w);
    const bM = evalSeg(B, tb + w - H);
    const bP = evalSeg(B, tb + w + H);
    bl.d0.copy(a.d); bl.dd0.copy(a.d).sub(aM.d).divideScalar(H);
    bl.d1.copy(b.d); bl.dd1.copy(bP.d).sub(bM.d).divideScalar(2 * H);
    bl.r0 = a.roll; bl.rr0 = (a.roll - aM.roll) / H; bl.r1 = b.roll; bl.rr1 = (bP.roll - bM.roll) / (2 * H);
    bl.f0 = a.fov; bl.ff0 = (a.fov - aM.fov) / H; bl.f1 = b.fov; bl.ff1 = (bP.fov - bM.fov) / (2 * H);
  }
}

// ---------------------------------------------------------------- envelopes
export interface EnvSample {
  bloom: number; exposure: number; matte: number; smear: number; storm: number;
  galleryLightDeg: number; impastoGain: number; fade: number; dust: number;
}
export const newEnv = (): EnvSample => ({ bloom: 0.45, exposure: 1, matte: 1, smear: 0, storm: 0, galleryLightDeg: -15, impastoGain: 1, fade: 0, dust: 0 });

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Timeline envelopes at loop time t (§5.2). `camDistFromE` feeds the 88-96 dust fade (0.3 * smoothstep(0.5, 40, |C-E|)).
 * impastoGain (breath) and fade are owned by the director; calm halves the punch exposure dip and zeroes smear.
 */
export function timelineEnv(t: number, camDistFromE: number, calm: boolean, out: EnvSample): EnvSample {
  out.bloom = evalEnvKeys(ENV_KEYS.bloom, t);
  if (t > BLOOM_PULSE.t0 && t < BLOOM_PULSE.t1) out.bloom += BLOOM_PULSE.amp * Math.sin((Math.PI * (t - BLOOM_PULSE.t0)) / (BLOOM_PULSE.t1 - BLOOM_PULSE.t0));
  let ex = evalEnvKeys(ENV_KEYS.exposure, t);
  if (calm && t > 37 && t < 39) ex = 1 - 0.5 * (1 - ex);
  out.exposure = ex;
  out.matte = evalEnvKeys(ENV_KEYS.matte, t);
  out.smear = calm ? 0 : evalEnvKeys(ENV_KEYS.smear, t);
  out.storm = evalEnvKeys(ENV_KEYS.storm, t);
  out.dust = t > 88 ? 0.3 * smooth(0.5, 40, camDistFromE) : evalEnvKeys(ENV_KEYS.dust, t);
  out.galleryLightDeg = evalEnvKeys(ENV_KEYS.galleryLightDeg, t);
  out.impastoGain = 1;
  out.fade = 0;
  return out;
}

export function lerpEnv(a: EnvSample, b: EnvSample, s: number, out: EnvSample): EnvSample {
  const k = Object.keys(out) as (keyof EnvSample)[];
  for (const key of k) out[key] = a[key] + (b[key] - a[key]) * s;
  return out;
}

/** Loop length re-exported for consumers of the timeline. */
export const TIMELINE_SECONDS = LOOP_SECONDS;
