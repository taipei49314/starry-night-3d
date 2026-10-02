// M7 terrain (§2.3, §4.7): the plain and the knoll, field strokes and the olive/tree groves.
// createLandUnderlays and the fixed grove layout live in villageGen.ts (they need the village layout) and are
// re-exported here, so both import sites work and the module graph stays acyclic: hillsGen <- villageGen <- terrain.
import { Vector3 } from 'three';
import { CANVAS_ASPECT, PALETTE, StrokeClass, StrokeFlag, T_HALF, type Rng, type StrokeSink } from '../contracts';
import { canvasToWorld, cypressSilhouette, EYE, groundHeight, groundHitDepth, worldToCanvas } from '../shared/canvasSpace';
import { mixHex, shadeHex } from '../shared/palette';
import { hillFootV, SolidEmitter, swatches, type Pair } from './hillsGen';
import { GROVE_COUNTS, groveLayout } from './villageGen';

export { groundHeight };
export {
  createLandUnderlays, GROUND_GRID, GROVE_COUNTS, groveLayout, landFade, UNDERLAY_COLORS, type GroveClump,
} from './villageGen';

const P = PALETTE;
const K_D = 2 * T_HALF;

/** Unit terrain normal of groundHeight at (x, z). */
export function groundNormal(x: number, z: number, out = new Vector3()): Vector3 {
  const s2 = 110 * 110;
  const h = groundHeight(x, z);
  return out.set((h * (x + 50)) / s2, 1, (h * (z + 195)) / s2).normalize();
}

/** Ground point seen through canvas (u, v) from E (on groundHeight); false above the horizon. */
function groundAt(u: number, v: number, out: Vector3): boolean {
  const d = groundHitDepth(u, v);
  if (!Number.isFinite(d) || d <= 0) return false;
  canvasToWorld(u, v, d, out);
  return true;
}

/** Curling swathes: a smooth angle field (radians) added to the ridge-parallel flow. */
function swath(u: number, v: number): number {
  const x = u * CANVAS_ASPECT;
  return 0.8 * Math.sin(7.3 * x + 3.1 * Math.sin(19 * v + 1.1 * x) + 0.6) * Math.sin(23 * v - 2.9 * x + 1.7 * Math.sin(5.3 * x));
}

/** §4.7 budgets (High). Fields: v in [-0.12, 0.10]; plain: v from 0.10 up to the foot of the front hill. */
export const GROUND_COUNTS = { field: 6800, plain: 1200 } as const;

const _a = new Vector3();
const _b = new Vector3();
const _m = new Vector3();
const _n = new Vector3();

function emitFields(em: SolidEmitter, rng: Rng): void {
  const total = GROUND_COUNTS.field + GROUND_COUNTS.plain;
  // Colour swatches (fields / plain): dark olive and blue-greens, dark ultramarine, a dulled ochre note. The painting's
  // foreground meadow is dark; only a few lighter blue-green dabs catch the light.
  const sw = [false, true].map((plain) => ({
    ochre: swatches(12, () => [mixHex(P.ochre, P.cypressGreen, rng.range(0.84, 0.92)), mixHex(P.ochre, P.cypressDark, rng.range(0.82, 0.9))]),
    blue: swatches(12, () => [mixHex(P.ultramarine, P.prussian, rng.range(0, 0.45)), mixHex(P.ultramarine, P.cypressDark, rng.range(0.25, 0.55))]),
    green: swatches(24, (): Pair => {
      const t = rng.next();
      const a = plain ? mixHex(P.cypressDark, P.grove, 0.2 + 0.6 * t) : mixHex(P.cypressDark, P.groveLight, 0.1 + 0.5 * t);
      const light = rng.next() < (plain ? 0.08 : 0.12);
      const b = light
        ? mixHex(P.groveLight, P.blueGreen, rng.range(0, 0.25))
        : mixHex(P.grove, rng.next() < 0.5 ? P.ultramarine : P.cypressDark, rng.range(0.15, 0.45));
      return rng.next() < 0.5 ? [a, b] : [b, a];
    }),
  }));
  let n = 0;
  for (let guard = 0; n < total && guard < total * 8; guard++) {
    const plain = n >= GROUND_COUNTS.field;
    const u = rng.range(-0.3, 1.3);
    let v: number;
    if (plain) {
      const top = hillFootV(u, 0) - 0.003;
      if (top <= 0.1) continue;
      v = rng.range(0.1, top);
    } else {
      v = rng.range(-0.12, 0.1);
    }
    // The cypress hides the fields behind it from E: keep 30 % there for the off-axis shots.
    const [uL, uR] = cypressSilhouette(v);
    if (u > uL - 0.01 && u < uR + 0.01 && rng.next() > 0.3) continue;
    // The knoll's front slope comes nearer than the GROUND dRange (200 m): skip it up front.
    if (!(groundHitDepth(u, v) > 214) || !groundAt(u, v, _m)) continue;
    // Authored on the ground in world space: wavy horizontal swathes (x +- ~45 deg). From E the ground's
    // foreshortening flattens them into near-horizontal dashes; off-axis they stay sane brush marks instead of
    // streaks radiating from E (a canvas-space tilt would be stretched by 1 / sin(grazing angle)).
    const d = worldToCanvas(_m).d;
    const ang = 0.8 * swath(u, v) + rng.normal() * 0.15;
    const Lw = rng.range(0.015, 0.03) * K_D * d;
    const dx = 0.5 * Lw * Math.cos(ang);
    const dz = 0.5 * Lw * Math.sin(ang);
    // Small per-stroke lift: stable ordering of coplanar strokes, always above the underlay (-0.4 m).
    const lift = (0.03 + 0.08 * rng.next()) * Math.max(1, d / 400);
    _a.set(_m.x - dx, 0, _m.z - dz);
    _a.y = groundHeight(_a.x, _a.z) + lift;
    _b.set(_m.x + dx, 0, _m.z + dz);
    _b.y = groundHeight(_b.x, _b.z) + lift;
    groundNormal(_m.x, _m.z, _n);
    const r = rng.next();
    const s = sw[plain ? 1 : 0];
    const ochre = plain ? 0.12 : 0.14;
    const [ca, cb] = rng.pick(r < ochre ? s.ochre : r < ochre + (plain ? 0.3 : 0.24) ? s.blue : s.green);
    if (em.emit(_a, _b, _n, { w: rng.range(0.005, 0.0075), colA: ca, colB: cb, seed: rng.next(), kappa: rng.range(-0.3, 0.3), maxComp: plain ? 4 : 6 })) n++;
  }
}

function emitGroves(em: SolidEmitter, rng: Rng): void {
  const clumps = groveLayout();
  const w = clumps.map((c) => (c.rh * c.rv) / (c.d * c.d));
  const wsum = w.reduce((s, x) => s + x, 0);
  const counts = w.map((x) => Math.max(8, Math.round((GROVE_COUNTS.strokes * x) / wsum)));
  // Trim / pad to the exact budget (largest clumps absorb the difference).
  let diff = GROVE_COUNTS.strokes - counts.reduce((s, x) => s + x, 0);
  const order = counts.map((_, i) => i).sort((a, b) => counts[b] - counts[a]);
  for (let k = 0; diff !== 0 && k < 100000; k++) {
    const i = order[k % order.length];
    if (diff > 0) {
      counts[i]++;
      diff--;
    } else if (counts[i] > 8) {
      counts[i]--;
      diff++;
    }
  }
  // Dark olive/tree greens; the back hemisphere (unseen from E) a shade darker.
  const GC = [1, 0.8].map((k) => {
    const s = (a: number, b: number): Pair => [shadeHex(a, k), shadeHex(b, k)];
    return {
      limb: [s(P.cypressDark, P.grove), s(P.prussian, P.grove), s(P.prussian, P.cypressDark)],
      body: [s(P.grove, P.cypressDark), s(P.grove, mixHex(P.grove, P.groveLight, 0.5)), s(mixHex(P.grove, P.cypressGreen, 0.5), P.grove)],
      light: [s(P.groveLight, P.grove), s(mixHex(P.groveLight, P.blueGreen, 0.25), P.grove)],
      dark: [s(P.cypressDark, P.grove), s(P.cypressDark, P.cypressGreen)],
      blue: [s(P.ultramarine, P.grove), s(mixHex(P.ultramarine, P.prussian, 0.5), P.cypressDark)],
    };
  });
  const view = new Vector3();
  const S = new Vector3();
  const Tm = new Vector3();
  const Tp = new Vector3();
  const dir = new Vector3();
  clumps.forEach((cl, i) => {
    const kd = K_D * cl.d;
    const phiE = Math.atan2(EYE.x - cl.c.x, EYE.z - cl.c.z);
    const twistPhase = rng.range(0, 6.283);
    for (let s = 0, guard = 0; s < counts[i] && guard < counts[i] * 4; guard++) {
      const front = rng.next() < 0.68;
      const th = phiE + (front ? 0 : Math.PI) + rng.range(-0.5 * Math.PI, 0.5 * Math.PI);
      const sp = rng.range(-0.25, 0.97);
      const cp = Math.sqrt(1 - sp * sp);
      const st = Math.sin(th);
      const ct = Math.cos(th);
      S.set(cl.c.x + cl.rh * cp * st, cl.c.y + cl.rv * sp, cl.c.z + cl.rh * cp * ct);
      _n.set((cp * st) / cl.rh, sp / cl.rv, (cp * ct) / cl.rh).normalize();
      Tm.set(-cl.rh * sp * st, cl.rv * cp, -cl.rh * sp * ct).normalize();
      Tp.set(ct, 0, -st);
      const beta = rng.normal() * 0.3 + 0.35 * Math.sin(3 * th + twistPhase);
      dir.copy(Tm).multiplyScalar(Math.cos(beta)).addScaledVector(Tp, Math.sin(beta));
      const Lw = Math.min(rng.range(0.008, 0.016) * kd, 0.9 * cl.rv);
      const Ww = Math.min(rng.range(0.0025, 0.0045) * kd, 0.6 * cl.rh);
      const lift = (0.02 + 0.04 * rng.next()) * Math.max(1, cl.d / 400);
      _a.copy(S).addScaledVector(dir, -0.5 * Lw).addScaledVector(_n, lift);
      _b.copy(S).addScaledVector(dir, 0.5 * Lw).addScaledVector(_n, lift);
      view.subVectors(S, EYE).normalize();
      const limb = Math.abs(_n.dot(view)) < 0.3;
      const r = rng.next();
      const gc = GC[front ? 0 : 1];
      const [ca, cb] = rng.pick(limb ? gc.limb : r < 0.4 ? gc.body : r < 0.62 ? (sp > 0.35 ? gc.light : gc.body) : r < 0.84 ? gc.dark : gc.blue);
      if (em.emit(_a, _b, _n, {
        w: Ww / kd, colA: ca, colB: cb, seed: rng.next(), kappa: rng.range(-0.2, 0.2),
        flags: limb ? StrokeFlag.OUTLINE : StrokeFlag.NONE, maxComp: 2.5,
      })) s++;
    }
  });
}

/** GROUND field strokes (solid, terrain normal ~ +Y) and GROVE clumps on ellipsoids with their surface normals. */
export function generateGround(sink: StrokeSink, rng: Rng): void {
  const emG = new SolidEmitter(sink, StrokeClass.GROUND);
  emitFields(emG, rng);
  emG.finish();
  const emV = new SolidEmitter(sink, StrokeClass.GROVE);
  emitGroves(emV, rng);
  emV.finish();
}
