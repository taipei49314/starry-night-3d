// M3 harness mini-world: small test generators for every animation kind (not the real M4-M7 generators).
import * as THREE from 'three';
import {
  CANVAS_ASPECT, GEN_U, GEN_V, PALETTE, StrokeClass, StrokeFlag, T_HALF, VORTICES,
  type Rng, type StrokeRecord, type StrokeSink,
} from '../src/contracts';
import {
  canvasToWorld, cypressSilhouette, EYE, groundHitDepth, jetPoint, Region, regionAt, segmentToStroke,
} from '../src/shared/canvasSpace';
import { armPoint, flowField, ringGeom, skyMask } from '../src/shared/flowField';
import { mixHex, packSrgb, rampHex, shadeHex } from '../src/shared/palette';

const TAU = Math.PI * 2;
const A = CANVAS_ASPECT;
const P = PALETTE;
const base = (): StrokeRecord => ({
  u: 0, v: 0, d: 0, cls: StrokeClass.UNDERPAINT, flags: 0, du: 0, dv: 0, dlnd: 0, w: 0,
  colA: 0, colB: 0, emissive: 0, seed: 0, kappa: 0, q1: 0, q2: 0, q3: 0,
});
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function genUnderpaint(sink: StrokeSink, rng: Rng, nx = 48, ny = 30): void {
  const f = [0, 0];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const u = GEN_U[0] + (GEN_U[1] - GEN_U[0]) * (i + rng.next()) / nx;
    const v = GEN_V[0] + (GEN_V[1] - GEN_V[0]) * (j + rng.next()) / ny;
    flowField(u * A, v, f);
    const a = Math.atan2(f[1], f[0]) + rng.range(-0.2, 0.2);
    const sky = regionAt(u, v) === Region.SKY;
    const cA = sky ? mixHex(P.ultramarine, P.prussian, rng.next()) : rng.pick([P.cypressGreen, P.prussian]);
    sink.push({ ...base(), u, v, d: rng.range(230_000, 250_000), cls: StrokeClass.UNDERPAINT,
      du: 0.08 * Math.cos(a), dv: 0.08 * Math.sin(a), w: 0.03, colA: packSrgb(cA), colB: packSrgb(shadeHex(cA, 0.8)),
      seed: rng.next(), kappa: rng.range(-0.2, 0.2) });
  }
}

export function genBands(sink: StrokeSink, rng: Rng, n = 4000): void {
  const f = [0, 0], g = [0, 0];
  let made = 0;
  for (let tries = 0; made < n && tries < n * 20; tries++) {
    const u = rng.range(-0.25, 1.25), v = rng.range(0.42, 1.09);
    const x = u * A;
    if (skyMask(x, v) < 0.5) continue;
    let inside = false;
    for (const V of VORTICES) if (Math.hypot(x - V.u * A, v - V.v) < 0.7 * V.rmax) inside = true;
    if (Math.hypot(x - 0.3 * A, v - 0.72) < 0.09) inside = true;
    if (inside) continue;
    flowField(x, v, f);
    const a = Math.atan2(f[1], f[0]);
    const L = rng.range(0.025, 0.06);
    flowField(x + 0.5 * L * Math.cos(a), v + 0.5 * L * Math.sin(a), g);
    let da = Math.atan2(g[1], g[0]) - a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const band = ((7 * (v + 0.03 * Math.sin(4 * x))) % 1 + 1) % 1;
    const r = rng.next();
    const cA = band < 0.45 ? (r < 0.7 ? P.cobalt : P.cerulean) : band < 0.8 ? (r < 0.7 ? P.cerulean : P.zincWhite) : (r < 0.7 ? P.zincWhite : P.blueGreen);
    const cB = mixHex(cA, rng.pick([P.ultramarine, P.cerulean, P.zincWhite]), 0.45);
    const b = rng.int(14);
    sink.push({ ...base(), u, v, d: 100_000 + 6500 * b + 12_000 * (v - 0.6) + rng.range(-1500, 1500), cls: StrokeClass.SKY_BAND,
      du: L * Math.cos(a), dv: L * Math.sin(a), w: rng.range(0.006, 0.01), colA: packSrgb(cA), colB: packSrgb(cB),
      seed: rng.next(), kappa: clamp(da * 2, -0.4, 0.4), q1: 0.35, q2: rng.int(4), q3: rng.next() });
    made++;
  }
}

const SWIRL_RAMP = [P.zincWhite, P.blueGreen, P.cerulean, P.cobalt, P.ultramarine];

/** One vortex: two arms of VORTEX strokes placed with armPoint at t = 0, plus an underlayer shell between the arms. */
export function genFunnel(sink: StrokeSink, rng: Rng, vi: number, n: number, nShell: number): void {
  const V = VORTICES[vi];
  const cls = vi < 2 ? StrokeClass.SWIRL : StrokeClass.EDDY;
  for (let i = 0; i < n; i++) {
    const arm = i % 2;
    const sigma = rng.next();
    const across = clamp(rng.normal() * 0.45, -1, 1);
    const ap = armPoint(vi, arm, sigma, across);
    const r = V.r0 * Math.pow(V.rmax / V.r0, sigma);
    const L = 0.008 + 0.15 * r;
    const edge = Math.abs(across) > 0.8;
    let cA = rampHex(SWIRL_RAMP, r / V.rmax);
    if (edge) cA = shadeHex(cA, 0.85);
    const cB = mixHex(cA, rng.pick([P.zincWhite, P.cobalt, P.blueGreen]), 0.4);
    sink.push({ ...base(), u: ap.u, v: ap.v, d: ap.d, cls, flags: edge ? StrokeFlag.OUTLINE : 0,
      du: L, w: L / 5, colA: packSrgb(cA), colB: packSrgb(cB), seed: rng.next(), kappa: rng.range(0, 0.35),
      q1: vi * 2 + arm, q2: sigma, q3: across });
  }
  for (let i = 0; i < nShell; i++) {
    const arm = (i % 2) + 0.5;
    const sigma = rng.next();
    const ap = armPoint(vi, arm, sigma, 0);
    const r = V.r0 * Math.pow(V.rmax / V.r0, sigma);
    const L = 0.008 + 0.15 * r;
    sink.push({ ...base(), u: ap.u, v: ap.v, d: ap.d * 1.01, cls, flags: StrokeFlag.UNDERLAYER,
      du: L, w: L / 5, colA: packSrgb(P.prussian), colB: packSrgb(P.prussian), seed: rng.next(),
      q1: vi * 2 + arm, q2: sigma, q3: 0 });
  }
}

/** Venus: radial core spikes (STATIC, emissive 8) and 9 counter-rotating rings, 3 radial rows each (RING anim). */
export function genVenus(sink: StrokeSink, rng: Rng): void {
  const g0 = ringGeom(0, 0);
  for (let i = 0; i < 320; i++) {
    const a = rng.range(0, TAU);
    const len = 0.016 * rng.range(0.55, 1.0);
    const cA = mixHex(P.lemon, P.zincWhite, rng.next());
    sink.push({ ...base(), u: (g0.cx + 0.5 * len * Math.cos(a)) / A, v: g0.cy + 0.5 * len * Math.sin(a), d: 12_000 * (0.99 - 0.01 * rng.next()),
      cls: StrokeClass.STAR_CORE, du: len * Math.cos(a), dv: len * Math.sin(a), w: rng.range(0.003, 0.005),
      colA: packSrgb(cA), colB: packSrgb(P.zincWhite), emissive: 8, seed: rng.next(), kappa: rng.range(-0.2, 0.2) });
  }
  const cols = [P.chrome, P.lemon, P.blueGreen];
  for (let k = 0; k < 9; k++) {
    const g = ringGeom(0, k);
    const C = TAU * g.rho;
    const m = Math.max(12, Math.round(C / 0.005));
    for (const row of [-1, 0, 1]) for (let i = 0; i < m; i++) {
      const a = (TAU * (i + rng.range(-0.3, 0.3))) / m;
      const rr = g.rho * (1 + 0.04 * row);
      const cA = cols[k % 3];
      sink.push({ ...base(), u: (g.cx + rr * Math.cos(a)) / A, v: g.cy + rr * Math.sin(a), d: g.d * (1 + 0.004 * (rng.next() - 0.5)),
        cls: StrokeClass.STAR_RING, du: (1.3 * C) / m, w: rng.range(0.0035, 0.005),
        colA: packSrgb(cA), colB: packSrgb(mixHex(cA, P.zincWhite, 0.4)), emissive: 2.2 - 0.12 * k, seed: rng.next(),
        kappa: rng.range(0, 0.3), q1: 0, q2: k, q3: row });
    }
  }
}

/** Seven twisted flame tubes after §4.6 (simplified), CYPRESS anim, outline where |cos phi| > 0.85, plus an inner underlayer. */
export function genCypress(sink: StrokeSink, rng: Rng, n = 2800, nUnder = 400): void {
  const tongues = Array.from({ length: 7 }, (_, j) => ({ f: (j + 0.5) / 7, ph: rng.range(0, TAU), lean: rng.range(-0.02, 0.02), dd: rng.range(-18, 18) }));
  const tube = (j: number, v: number, phi: number, rad: number, out: THREE.Vector3) => {
    const t = tongues[j];
    const [uL, uR] = cypressSilhouette(v);
    const taper = 1 - 0.6 * THREE.MathUtils.smoothstep(v, 0.85, 1.08);
    const w = ((0.5 * (uR - uL)) / 2.6) * taper * rad;
    const uc = uL + (uR - uL) * t.f + 0.02 * Math.sin(7 * v + t.ph) + t.lean * v;
    const ang = phi + 2.6 * v;
    const Rw = w * 2 * A * T_HALF * 192;
    return canvasToWorld(uc + w * Math.cos(ang), v, 192 + t.dd + Rw * Math.sin(ang), out);
  };
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  for (let i = 0; i < n + nUnder; i++) {
    const under = i >= n;
    const j = i % 7;
    const v = rng.range(-0.12, 1.04);
    const phi = rng.range(0, TAU);
    const L = rng.range(0.012, 0.035);
    tube(j, v, phi, under ? 0.45 : 1, pa);
    tube(j, v + L, phi, under ? 0.45 : 1, pb);
    const s = segmentToStroke(pa, pb);
    const outline = !under && Math.abs(Math.cos(phi + 2.6 * v)) > 0.85;
    const r = rng.next();
    const cA = under ? 0x0f1712 : r < 0.1 ? P.groveLight : r < 0.15 ? P.ultramarine : rng.pick([P.cypressDark, P.cypressGreen]);
    sink.push({ ...base(), ...s, cls: StrokeClass.CYPRESS, flags: (under ? StrokeFlag.UNDERLAYER : 0) | (outline ? StrokeFlag.OUTLINE : 0),
      w: rng.range(0.004, 0.007), colA: packSrgb(cA), colB: packSrgb(under ? cA : mixHex(cA, P.cypressGreen, 0.5)),
      seed: rng.next(), kappa: rng.range(0.05, 0.3), q1: j, q2: phi });
  }
}

export function genJet(sink: StrokeSink, rng: Rng, filaments = 12, per = 50): void {
  for (let f = 0; f < filaments; f++) {
    const off = clamp(rng.normal() * 0.006, -0.015, 0.015);
    for (let k = 0; k < per; k++) {
      const s0 = (k + rng.next()) / per;
      const jp = jetPoint(s0, off);
      sink.push({ ...base(), u: jp.u, v: jp.v, d: jp.d, cls: StrokeClass.WIND_JET, du: 0.012, w: 0.003,
        colA: packSrgb(P.cypressGreen), colB: packSrgb(P.zincWhite), emissive: 1.1, seed: rng.next(), kappa: rng.range(0, 0.2),
        q1: s0, q2: off, q3: rng.range(-0.004, 0.004) });
    }
  }
}

export interface HouseBox { center: THREE.Vector3; size: THREE.Vector3; yaw: number }

/** Solid gable-roofed houses (HOUSE strokes on every face with face normals, OUTLINE near edges) plus FLICKER windows. */
export function genHouses(sink: StrokeSink, rng: Rng, sites: readonly [number, number][]): HouseBox[] {
  const boxes: HouseBox[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
  for (const [su, sv] of sites) {
    const d0 = groundHitDepth(su, sv);
    const c = canvasToWorld(su, sv, d0);
    c.y = 0;
    const sx = rng.range(16, 24), sz = rng.range(9, 14), h = rng.range(7, 10), rh = rng.range(4, 6);
    const toE = new THREE.Vector3(EYE.x - c.x, 0, EYE.z - c.z).normalize();
    const yaw = Math.atan2(toE.x, toE.z) + THREE.MathUtils.degToRad(rng.range(-20, 20));
    const ex = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const ez = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    boxes.push({ center: c.clone().addScaledVector(up, h / 2), size: new THREE.Vector3(sx, h, sz), yaw });
    const wallCol = () => shadeHex(mixHex(P.cerulean, P.zincWhite, rng.next()), 0.7);
    type Face = { o: THREE.Vector3; U: THREE.Vector3; V: THREE.Vector3; N: THREE.Vector3; gable: boolean; roof: boolean };
    const at = (x: number, y: number, z: number) => c.clone().addScaledVector(ex, x).addScaledVector(up, y).addScaledVector(ez, z);
    const faces: Face[] = [
      { o: at(-sx / 2, 0, sz / 2), U: ex.clone().multiplyScalar(sx), V: up.clone().multiplyScalar(h), N: ez.clone(), gable: false, roof: false },
      { o: at(sx / 2, 0, -sz / 2), U: ex.clone().multiplyScalar(-sx), V: up.clone().multiplyScalar(h), N: ez.clone().negate(), gable: false, roof: false },
      { o: at(-sx / 2, 0, -sz / 2), U: ez.clone().multiplyScalar(sz), V: up.clone().multiplyScalar(h + rh), N: ex.clone().negate(), gable: true, roof: false },
      { o: at(sx / 2, 0, sz / 2), U: ez.clone().multiplyScalar(-sz), V: up.clone().multiplyScalar(h + rh), N: ex.clone(), gable: true, roof: false },
    ];
    for (const side of [1, -1]) {
      const eave = at(-sx / 2, h, (side * sz) / 2);
      const V = at(-sx / 2, h + rh, 0).sub(eave);
      const U = ex.clone().multiplyScalar(sx);
      const N = new THREE.Vector3().crossVectors(U, V).normalize();
      if (N.y < 0) N.negate();
      faces.push({ o: eave.clone().addScaledVector(V, -0.06), U, V: V.multiplyScalar(1.12), N, gable: false, roof: true });
    }
    for (const F of faces) {
      const au = F.U.length(), av = F.V.length();
      const count = Math.round((au * av) / 1.1);
      const ud = F.U.clone().normalize(), vd = F.V.clone().normalize();
      for (let i = 0; i < count; i++) {
        const x = rng.next(), y = rng.next();
        if (F.gable && y * (h + rh) > h && Math.abs(x - 0.5) * 2 > 1 - (y * (h + rh) - h) / rh) continue;
        const len = rng.range(2.0, 3.4);
        const tilt = rng.range(-0.15, 0.15);
        dir.copy(vd).multiplyScalar(Math.cos(tilt)).addScaledVector(ud, Math.sin(tilt));
        if (!F.roof && rng.next() < 0.3) dir.copy(ud).multiplyScalar(Math.cos(tilt)).addScaledVector(vd, Math.sin(tilt));
        tmp.copy(F.o).addScaledVector(F.U, x).addScaledVector(F.V, y).addScaledVector(F.N, 0.02);
        a.copy(tmp).addScaledVector(dir, -len / 2);
        b.copy(tmp).addScaledVector(dir, len / 2);
        const s = segmentToStroke(a, b);
        const edge = x < 0.07 || x > 0.93 || y < 0.05 || (!F.gable && y > 0.94);
        const cA = F.roof ? shadeHex(P.roof, rng.range(0.85, 1.1)) : wallCol();
        sink.push({ ...base(), ...s, cls: StrokeClass.HOUSE, flags: edge ? StrokeFlag.OUTLINE : 0,
          w: rng.range(0.8, 1.15) / (2 * T_HALF * s.d), colA: packSrgb(cA), colB: packSrgb(shadeHex(cA, 0.85)),
          seed: rng.next(), kappa: rng.range(0.03, 0.15), q1: F.N.x, q2: F.N.y, q3: F.N.z });
      }
      if (!F.roof) {
        const nw = F.gable ? 1 : 2;
        for (let k = 0; k < nw; k++) {
          tmp.copy(F.o).addScaledVector(F.U, (k + 0.5) / nw).addScaledVector(F.V, (0.42 * h) / av).addScaledVector(F.N, 0.08);
          a.copy(tmp).addScaledVector(vd, -0.7);
          b.copy(tmp).addScaledVector(vd, 0.7);
          const s = segmentToStroke(a, b);
          const cA = rng.pick([P.chrome, P.ochre]);
          sink.push({ ...base(), ...s, cls: StrokeClass.WINDOW, w: 1.1 / (2 * T_HALF * s.d), colA: packSrgb(cA),
            colB: packSrgb(P.lemon), emissive: 2.5, seed: rng.next(), kappa: 0.05, q1: F.N.x, q2: F.N.y, q3: F.N.z });
        }
      }
    }
  }
  return boxes;
}

/** Star si (moon = 11): STATIC core spikes + RING rows, ring counts from the motif tables. */
export function genStar(sink: StrokeSink, rng: Rng, si: number, nCore: number, ringCls: StrokeClass, coreCls: StrokeClass, rings: number, dCore: number, spacing: number): void {
  const g0 = ringGeom(si, 0);
  for (let i = 0; i < nCore; i++) {
    const a = rng.range(0, TAU);
    const len = g0.rho * rng.range(0.4, 1.0);
    sink.push({ ...base(), u: (g0.cx + 0.5 * len * Math.cos(a)) / A, v: g0.cy + 0.5 * len * Math.sin(a), d: dCore * (0.99 - 0.009 * rng.next()),
      cls: coreCls, du: len * Math.cos(a), dv: len * Math.sin(a), w: rng.range(0.002, 0.004),
      colA: packSrgb(P.lemon), colB: packSrgb(P.zincWhite), emissive: 6, seed: rng.next() });
  }
  for (let k = 0; k < rings; k++) {
    const g = ringGeom(si, k);
    const m = Math.max(8, Math.round((TAU * g.rho) / spacing));
    for (const row of [-1, 0, 1]) for (let i = 0; i < m; i++) {
      const a = (TAU * (i + rng.range(-0.3, 0.3))) / m;
      const rr = g.rho * (1 + 0.04 * row);
      sink.push({ ...base(), u: (g.cx + rr * Math.cos(a)) / A, v: g.cy + rr * Math.sin(a), d: g.d * (1 + 0.004 * (rng.next() - 0.5)),
        cls: ringCls, du: (1.3 * TAU * g.rho) / m, w: rng.range(0.003, 0.005), colA: packSrgb([P.chrome, P.lemon, P.blueGreen][k % 3]),
        colB: packSrgb(P.zincWhite), emissive: 2.2 - 0.12 * k, seed: rng.next(), q1: si, q2: k, q3: row });
    }
  }
}

/** Generic STATIC strokes for classes without a harness generator (solid ones face E). */
export function genGeneric(sink: StrokeSink, rng: Rng, cls: StrokeClass, n: number, ur: [number, number], vr: [number, number], dr: [number, number], solid: boolean): void {
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const u = rng.range(ur[0], ur[1]), v = rng.range(vr[0], vr[1]);
    const d = Math.exp(rng.range(Math.log(dr[0]), Math.log(dr[1])));
    const ang = rng.range(-0.6, 0.6);
    const L = rng.range(0.008, 0.02);
    canvasToWorld(u, v, d, p);
    const nrm = EYE.clone().sub(p).normalize();
    sink.push({ ...base(), u, v, d, cls, du: L * Math.cos(ang), dv: L * Math.sin(ang), w: L / 4,
      colA: packSrgb(rng.pick([P.cobalt, P.ultramarine, P.cerulean, P.grove])), colB: packSrgb(P.prussian), seed: rng.next(),
      kappa: rng.range(0, 0.2), q1: solid ? nrm.x : 0, q2: solid ? nrm.y : 0, q3: solid ? nrm.z : 0 });
  }
}
