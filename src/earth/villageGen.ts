// M7 village (§2.3, §4.7): 40 house solids, lit windows on all four walls, the church nave, octagonal shaft and
// spire with its tip pinned at (27, 145, -678). Everything is authored in world space on real solids and converted
// with segmentToStroke (via SolidEmitter), so from E the strokes land where the solids project.
// Also home of the fixed village/grove layouts and of createLandUnderlays (re-exported by terrain.ts).
import { BufferAttribute, BufferGeometry, Group, Mesh, Vector3, type Material } from 'three';
import {
  AT, CANVAS_ASPECT, CHURCH, PALETTE, StrokeClass, StrokeFlag, T_HALF, type Rng, type StrokeSink, type UnderlayMaterialFactory, type VillageInfo,
} from '../contracts';
import { canvasToWorld, EYE, groundHeight, groundHitDepth, worldToCanvas } from '../shared/canvasSpace';
import { mixHex, shadeHex } from '../shared/palette';
import { mulberry32 } from '../shared/rng';
import { buildHillUnderlayGeometry, hillDepth, hillFootV, SolidEmitter, streakNoise, swatches, valueNoise2, type Pair } from './hillsGen';

const P = PALETTE;
const DEG = Math.PI / 180;
const K_D = 2 * T_HALF; // world length of one h-unit per metre of depth

// ------------------------------------------------------------------ layout

/** VillageInfo house: `center` = centre of the wall box (y = base + wallH / 2); `size` = (facade width along local X,
 *  wall height, depth along local Z); `yaw` = rotation about +Y (three.js Object3D.rotation.y), local +Z = facade. */
export type House = VillageInfo['houses'][number];

export const HOUSE_COUNT = 40;
const LAYOUT_SEED = 0x51e7a1;
const ROOF_OVERHANG = 0.5;

/** Gable roof height (4-7 m), a deterministic function of the gable span so the underlay can rebuild it. */
export function houseRoofHeight(size: Vector3): number {
  const span = Math.min(size.x, size.z);
  return Math.max(4, Math.min(7, 4 + (3 * (span - 8)) / 8));
}

/** Ridge frame of a house: frame +X runs along the ridge (the longer footprint side), frame +Z across it. */
export interface HouseFrame {
  origin: Vector3; // footprint centre at the wall base
  yaw: number;
  len: number; // along the ridge
  wid: number; // across the ridge (gable span)
  wallH: number;
  roofH: number;
}

export function houseFrame(h: House): HouseFrame {
  const alongX = h.size.x >= h.size.z;
  return {
    origin: new Vector3(h.center.x, h.center.y - 0.5 * h.size.y, h.center.z),
    yaw: h.yaw + (alongX ? 0 : 0.5 * Math.PI),
    len: Math.max(h.size.x, h.size.z),
    wid: Math.min(h.size.x, h.size.z),
    wallH: h.size.y,
    roofH: houseRoofHeight(h.size),
  };
}

/** Frame-local (x, y, z) -> world, rotation about +Y by `yaw` (three.js convention). */
function toWorld(f: { origin: Vector3; yaw: number }, x: number, y: number, z: number, out = new Vector3()): Vector3 {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return out.set(f.origin.x + x * c + z * s, f.origin.y + y, f.origin.z - x * s + z * c);
}
function dirToWorld(f: { yaw: number }, x: number, y: number, z: number, out = new Vector3()): Vector3 {
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return out.set(x * c + z * s, y, -x * s + z * c);
}

/** Key points of a house frame (box corners, eaves, ridge ends) in world space. */
function framePoints(f: HouseFrame): Vector3[] {
  const pts: Vector3[] = [];
  const L = 0.5 * f.len + ROOF_OVERHANG;
  const W = 0.5 * f.wid + ROOF_OVERHANG;
  for (const x of [-L, L]) {
    for (const z of [-W, W]) {
      pts.push(toWorld(f, x, 0, z), toWorld(f, x, f.wallH, z));
    }
    pts.push(toWorld(f, x, f.wallH + f.roofH, 0));
  }
  return pts;
}

/** Canvas bounding box of a frame seen from E, with its nearest depth. */
export function frameCanvasBox(f: HouseFrame): { u0: number; u1: number; v0: number; v1: number; d: number } {
  const b = { u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity, d: Infinity };
  for (const p of framePoints(f)) {
    const c = worldToCanvas(p);
    b.u0 = Math.min(b.u0, c.u);
    b.u1 = Math.max(b.u1, c.u);
    b.v0 = Math.min(b.v0, c.v);
    b.v1 = Math.max(b.v1, c.v);
    b.d = Math.min(b.d, c.d);
  }
  return b;
}

/** The church: octagonal shaft + spire at CHURCH.base, nave 40 x 16 x 18 m yawed 15 deg, attached to the shaft's east side. */
export const CHURCH_GEO = {
  base: new Vector3(CHURCH.base[0], CHURCH.base[1], CHURCH.base[2]),
  tip: new Vector3(CHURCH.base[0], CHURCH.spireTop, CHURCH.base[2]),
  shaftR: 4, // circumradius: 8 m across
  shaftTop: CHURCH.shaftTop,
  spireR: 4.4,
  spireTop: CHURCH.spireTop,
  naveYaw: 15 * DEG,
  naveLen: 40,
  naveWid: 16,
  naveWallH: 18,
  naveRoofH: 7,
};
const naveFrame = (): HouseFrame => {
  const g = CHURCH_GEO;
  const off = g.shaftR + 0.5 * g.naveLen;
  return {
    origin: new Vector3(g.base.x + off * Math.cos(g.naveYaw), g.base.y, g.base.z - off * Math.sin(g.naveYaw)),
    yaw: g.naveYaw, len: g.naveLen, wid: g.naveWid, wallH: g.naveWallH, roofH: g.naveRoofH,
  };
};
/** Shaft face 0 looks straight at E. */
const SHAFT_PHI0 = Math.atan2(EYE.x - CHURCH.base[0], EYE.z - CHURCH.base[2]);

function distToSegment2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - ax - t * vx, pz - az - t * vz);
}

let layoutCache: House[] | null = null;
/**
 * The 40 houses, Poisson-sampled in canvas (u 0.32-1.10, v_base 0.06-0.195) with a fixed internal seed, so the
 * ground generator (groves), the village generator and the underlays agree on the layout whatever rng they get.
 * Rejected: overlaps (world and canvas), the 0.04 h disc around the church, anything in front of the church
 * silhouette from E, anything reaching behind the foot of the front hill wall, or outside the HOUSE dRange.
 */
export function villageLayout(): readonly House[] {
  if (layoutCache) return layoutCache;
  const rng = mulberry32(LAYOUT_SEED);
  const out: House[] = [];
  const canvasPts: [number, number][] = [];
  const radii: number[] = [];
  const nave = naveFrame();
  const naveA = toWorld(nave, -0.5 * nave.len, 0, 0);
  const naveB = toWorld(nave, 0.5 * nave.len, 0, 0);
  let minSep = 0.016;
  for (let tries = 0; out.length < HOUSE_COUNT && tries < 40000; tries++) {
    if (tries === 20000) minSep = 0.011;
    const u = rng.range(0.32, 1.1);
    const vb = rng.range(0.06, 0.195);
    if (Math.hypot((u - CHURCH.u) * CANVAS_ASPECT, vb - CHURCH.vBase) < 0.04) continue;
    if (canvasPts.some(([cu, cv]) => Math.hypot((u - cu) * CANVAS_ASPECT, vb - cv) < minSep)) continue;
    const d0 = groundHitDepth(u, vb);
    if (!Number.isFinite(d0)) continue;
    const g = canvasToWorld(u, vb, d0);
    const wx = rng.range(10, 24);
    const dz = rng.range(8, 16);
    const wallH = rng.range(6, 10);
    const yaw = Math.atan2(EYE.x - g.x, EYE.z - g.z) + rng.range(-20, 20) * DEG;
    const r = 0.5 * Math.hypot(wx, dz) + ROOF_OVERHANG;
    if (out.some((h, i) => Math.hypot(h.center.x - g.x, h.center.z - g.z) < r + radii[i] + 4)) continue;
    if (Math.hypot(g.x - CHURCH_GEO.base.x, g.z - CHURCH_GEO.base.z) < r + 10) continue;
    if (distToSegment2(g.x, g.z, naveA.x, naveA.z, naveB.x, naveB.z) < r + 0.5 * nave.wid + 6) continue;
    // Base sits slightly below the lowest footprint corner (the plain is flat away from the knoll).
    let baseY = Infinity;
    for (const sx of [-0.5, 0.5]) {
      for (const sz of [-0.5, 0.5]) {
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        const x = g.x + sx * wx * c + sz * dz * s;
        const z = g.z - sx * wx * s + sz * dz * c;
        baseY = Math.min(baseY, groundHeight(x, z));
      }
    }
    baseY -= 0.3;
    const house: House = {
      center: new Vector3(g.x, baseY + 0.5 * wallH, g.z),
      size: new Vector3(wx, wallH, dz),
      yaw,
    };
    const pts = framePoints(houseFrame(house));
    let ok = true;
    let uMin = Infinity, uMax = -Infinity, vMax = -Infinity, dMin = Infinity;
    for (const p of pts) {
      const c = worldToCanvas(p);
      uMin = Math.min(uMin, c.u);
      uMax = Math.max(uMax, c.u);
      vMax = Math.max(vMax, c.v);
      dMin = Math.min(dMin, c.d);
      if (c.d < 458 || c.d > 2850) ok = false;
      if (c.v > hillFootV(c.u, 0) - 0.004 && c.d > hillDepth(c.u, c.v, 0) - 25) ok = false;
    }
    if (!ok || uMin < 0.31) continue;
    // Never in front of the church as seen from E.
    if (dMin < 700 && uMax > 0.535 && uMin < 0.64 && vMax > 0.1) continue;
    out.push(house);
    radii.push(r);
    canvasPts.push([u, vb]);
  }
  if (out.length < HOUSE_COUNT) console.warn(`[M7] village layout placed ${out.length}/${HOUSE_COUNT} houses`);
  layoutCache = out;
  return out;
}

// ------------------------------------------------------------------ house strokes

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _n = new Vector3();
const _e1 = new Vector3();
const _e2 = new Vector3();

type FaceKind = 'wall' | 'gable' | 'roof';
interface Face {
  kind: FaceKind;
  /** quad: o + a*e1 + b*e2 (a, b in [0,1]); gable: base o -> o + e1, apex o + 0.5 e1 + e2 */
  o: Vector3; e1: Vector3; e2: Vector3; n: Vector3;
  area: number; vis: number; shade: number;
  /** wall faces: index 0..3 (front, right, back, left in frame terms) for windows */
  wall: number;
}

/** World faces of a house frame (four walls, two gables, two roof slopes with overhang). */
function frameFaces(f: HouseFrame): Face[] {
  const L = 0.5 * f.len;
  const W = 0.5 * f.wid;
  const h = f.wallH;
  const rh = f.roofH;
  const ov = ROOF_OVERHANG;
  const ovY = (ov * rh) / W;
  const faces: Face[] = [];
  const add = (kind: FaceKind, o: Vector3, e1: Vector3, e2: Vector3, nLocal: [number, number, number], wall = -1) => {
    const n = dirToWorld(f, nLocal[0], nLocal[1], nLocal[2]).normalize();
    const area = (kind === 'gable' ? 0.5 : 1) * _c.crossVectors(e1, e2).length();
    const centre = o.clone().addScaledVector(e1, 0.5).addScaledVector(e2, kind === 'gable' ? 0.33 : 0.5);
    const facing = n.dot(_c.subVectors(EYE, centre)) > 0;
    faces.push({ kind, o, e1, e2, n, area, vis: facing ? 1 : 0.45, shade: facing ? 1 : 0.78, wall });
  };
  const O = (x: number, y: number, z: number) => toWorld(f, x, y, z);
  const D = (x: number, y: number, z: number) => dirToWorld(f, x, y, z);
  add('wall', O(-L, 0, W), D(2 * L, 0, 0), D(0, h, 0), [0, 0, 1], 0);
  add('wall', O(L, 0, W), D(0, 0, -2 * W), D(0, h, 0), [1, 0, 0], 1);
  add('wall', O(L, 0, -W), D(-2 * L, 0, 0), D(0, h, 0), [0, 0, -1], 2);
  add('wall', O(-L, 0, -W), D(0, 0, 2 * W), D(0, h, 0), [-1, 0, 0], 3);
  add('gable', O(L, h, W), D(0, 0, -2 * W), D(0, rh, 0), [1, 0, 0]);
  add('gable', O(-L, h, -W), D(0, 0, 2 * W), D(0, rh, 0), [-1, 0, 0]);
  // Roof slopes: e1 along the ridge, e2 from the eave up to the ridge.
  add('roof', O(-L - ov, h - ovY, W + ov), D(2 * (L + ov), 0, 0), D(0, rh + ovY, -(W + ov)), [0, W, rh]);
  add('roof', O(L + ov, h - ovY, -W - ov), D(-2 * (L + ov), 0, 0), D(0, rh + ovY, W + ov), [0, W, -rh]);
  return faces;
}

/** A house's wall colour: base, the note it drifts toward and a value scale. */
interface Palette3 { wallBase: number; accent: number; tone: number }

/**
 * House wall palettes after the painting: mostly dark blue / blue-grey walls, some blue-green and dulled ochre notes and a
 * few paler cerulean faces, all well below the sky's value so the lit windows carry the village.
 */
function housePalette(rng: Rng): Palette3 {
  const r = rng.next();
  if (r < 0.55) return { wallBase: mixHex(P.ultramarine, P.cerulean, rng.range(0, 0.25)), accent: P.cerulean, tone: rng.range(0.6, 0.8) };
  if (r < 0.77) return { wallBase: mixHex(P.blueGreen, P.ultramarine, rng.range(0.65, 0.82)), accent: P.blueGreen, tone: rng.range(0.55, 0.75) };
  if (r < 0.89) return { wallBase: mixHex(P.ochre, P.outline, rng.range(0.5, 0.65)), accent: P.ochre, tone: rng.range(0.5, 0.65) };
  return { wallBase: mixHex(P.cerulean, P.ultramarine, rng.range(0.2, 0.4)), accent: P.zincWhite, tone: rng.range(0.6, 0.75) };
}

const ROOF_BASE = [0.45, 0.6, 0.75].map((t) => mixHex(P.roof, P.ultramarine, t));

function faceColours(rng: Rng, face: Face, pal: Palette3): [number, number] {
  if (face.kind === 'roof') {
    // Dark blue roofs: slate pulled toward ultramarine, streaked with outline and a rare cerulean catch-light.
    const a = shadeHex(rng.pick(ROOF_BASE), rng.range(0.45, 0.7) * face.shade);
    const r = rng.next();
    const b = r < 0.12 ? mixHex(P.ultramarine, P.cerulean, rng.range(0.15, 0.35)) : mixHex(P.ultramarine, r < 0.55 ? P.outline : P.prussian, rng.range(0.3, 0.7));
    return [a, shadeHex(b, face.shade)];
  }
  const k = pal.tone * face.shade;
  const r = rng.next();
  const note = r < 0.2 ? pal.accent : r < 0.6 ? P.ultramarine : P.outline;
  const base = mixHex(pal.wallBase, note, rng.range(0, 0.3));
  const second = mixHex(base, rng.pick([P.ultramarine, P.outline, pal.accent] as const), rng.range(0.25, 0.45));
  return [shadeHex(base, k * rng.range(0.85, 1.05)), shadeHex(second, k * rng.range(0.8, 1))];
}

/** Lift a face point off the face (stable ordering of coplanar strokes, in front of the inset core). */
const liftFor = (rng: Rng, d: number) => (0.02 + 0.05 * rng.next()) * Math.max(1, d / 500);

/** Fill strokes on one face. `count` strokes; returns how many were emitted. */
function fillFace(em: SolidEmitter, rng: Rng, face: Face, count: number, pal: Palette3, opts: { vertical?: boolean; flags?: number; lc?: [number, number] }): number {
  const len1 = face.e1.length();
  const len2 = face.e2.length();
  const u1 = _e1.copy(face.e1).divideScalar(len1).clone();
  const u2 = _e2.copy(face.e2).divideScalar(len2).clone();
  // For roofs e2 is not perpendicular to e1 only by construction error; walls/gables have e1 _|_ e2.
  const vertical = face.kind === 'roof' ? true : face.kind === 'gable' ? true : (opts.vertical ?? rng.next() < 0.55);
  const [lc0, lc1] = opts.lc ?? [0.006, 0.014];
  let done = 0;
  const sw = swatches(6, () => faceColours(rng, face, pal));
  const centre = face.o.clone().addScaledVector(face.e1, 0.5).addScaledVector(face.e2, 0.4);
  const d = Math.max(50, worldToCanvas(centre).d);
  const kd = K_D * d;
  for (let i = 0, guard = 0; i < count && guard < count * 4; guard++) {
    const Lc = rng.range(lc0, lc1);
    // Stroke runs along e2 (vertical / up-slope) or along e1 (horizontal).
    const along = vertical ? len2 : len1;
    const across = vertical ? len1 : len2;
    const Lw = Math.max(0.4, Math.min(Lc * kd, 0.8 * along));
    const Ww = Math.max(0.25, Math.min(Lc * rng.range(0.28, 0.42) * kd, 0.5 * across));
    let a: number;
    let b: number;
    if (face.kind === 'gable') {
      // Gable triangle: a across the base, apex height (1 - |2a - 1|) * len2.
      a = rng.range(0.06, 0.94);
      const top = (1 - Math.abs(2 * a - 1)) * len2;
      const L = Math.min(Lw, 0.85 * top + 0.25 * Lw);
      const yc = Math.min(top - 0.5 * L, rng.range(0, Math.max(0, top - 0.5 * L)));
      _c.copy(face.o).addScaledVector(face.e1, a).addScaledVector(u2, Math.max(0.2 * L, yc));
      _a.copy(_c).addScaledVector(u2, -0.5 * L);
      _b.copy(_c).addScaledVector(u2, 0.5 * L);
    } else {
      const mAlong = Math.min(0.5, (0.5 * Lw) / along);
      const mAcross = Math.min(0.5, (0.25 * Ww) / across);
      const t = rng.range(mAlong, 1 - mAlong);
      const q = rng.range(mAcross, 1 - mAcross);
      if (vertical) {
        a = q;
        b = t;
      } else {
        a = t;
        b = q;
      }
      _c.copy(face.o).addScaledVector(face.e1, a).addScaledVector(face.e2, b);
      const dirU = vertical ? u2 : u1;
      const sideU = vertical ? u1 : u2;
      const jit = rng.normal() * (face.kind === 'roof' ? 0.12 : 0.06);
      const dx = Math.cos(jit);
      const dy = Math.sin(jit);
      const dir = dirU.clone().multiplyScalar(dx).addScaledVector(sideU, dy);
      _a.copy(_c).addScaledVector(dir, -0.5 * Lw);
      _b.copy(_c).addScaledVector(dir, 0.5 * Lw);
    }
    const lift = liftFor(rng, d);
    _a.addScaledVector(face.n, lift);
    _b.addScaledVector(face.n, lift);
    const [ca, cb] = rng.pick(sw);
    if (em.emit(_a, _b, face.n, {
      w: Ww / kd, colA: ca, colB: cb, seed: rng.next(), kappa: rng.range(-0.06, 0.06), flags: opts.flags,
      maxComp: face.kind === 'roof' ? 2.5 : 1.8,
    })) {
      i++;
      done++;
    }
  }
  return done;
}

/** Outline strokes along the frame's visible edges (corners, eaves, ridge, gable rakes). */
function frameEdges(f: HouseFrame): { a: Vector3; b: Vector3; n: Vector3 }[] {
  const L = 0.5 * f.len;
  const W = 0.5 * f.wid;
  const h = f.wallH;
  const rh = f.roofH;
  const ov = ROOF_OVERHANG;
  const ovY = (ov * rh) / W;
  const E: { a: Vector3; b: Vector3; n: Vector3 }[] = [];
  const e = (a: [number, number, number], b: [number, number, number], n: [number, number, number]) =>
    E.push({ a: toWorld(f, ...a), b: toWorld(f, ...b), n: dirToWorld(f, ...n).normalize() });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) e([sx * L, 0, sz * W], [sx * L, h, sz * W], [sx, 0, sz]);
  e([-L - ov, h - ovY, W + ov], [L + ov, h - ovY, W + ov], [0, W, rh]);
  e([-L - ov, h - ovY, -W - ov], [L + ov, h - ovY, -W - ov], [0, W, -rh]);
  e([-L - ov, h + rh, 0], [L + ov, h + rh, 0], [0, 1, 0]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) e([sx * (L + ov), h - ovY, sz * (W + ov)], [sx * (L + ov), h + rh, 0], [sx * 2, W, sz * rh]);
  }
  return E;
}

const EDGE_B = [0.1, 0.2, 0.32].map((t) => mixHex(P.outline, P.ultramarine, t));

function edgePieces(edge: { a: Vector3; b: Vector3 }): number {
  const d = Math.max(50, worldToCanvas(_c.addVectors(edge.a, edge.b).multiplyScalar(0.5)).d);
  return Math.max(1, Math.min(5, Math.ceil(edge.a.distanceTo(edge.b) / (0.011 * K_D * d))));
}

function emitEdges(em: SolidEmitter, rng: Rng, f: HouseFrame): number {
  let n = 0;
  for (const edge of frameEdges(f)) {
    const pieces = edgePieces(edge);
    const d = Math.max(50, worldToCanvas(_c.addVectors(edge.a, edge.b).multiplyScalar(0.5)).d);
    const lift = 0.06 * Math.max(1, d / 500);
    for (let i = 0; i < pieces; i++) {
      const t0 = Math.max(0, (i - 0.12) / pieces);
      const t1 = Math.min(1, (i + 1.12) / pieces);
      _a.lerpVectors(edge.a, edge.b, t0).addScaledVector(edge.n, lift);
      _b.lerpVectors(edge.a, edge.b, t1).addScaledVector(edge.n, lift);
      if (em.emit(_a, _b, edge.n, {
        w: rng.range(0.0016, 0.0024), colA: P.outline, colB: rng.pick(EDGE_B),
        seed: rng.next(), kappa: rng.range(-0.03, 0.03), flags: StrokeFlag.OUTLINE, maxComp: 1.5,
      })) n++;
    }
  }
  return n;
}

const WIN_LEMON = mixHex(P.lemon, P.chrome, 0.5);
const WIN_ORANGE = mixHex(P.chrome, P.ochre, 0.55);
const WIN_B = [0, 0.15, 0.3, 0.45, 0.6].map((t) => mixHex(P.ochre, P.chrome, t));

/** Lit windows: `perWall[i]` windows on wall face i (0..3). Returns the number emitted. */
function emitWindows(em: SolidEmitter, rng: Rng, f: HouseFrame, perWall: number[], sizeK = 1): number {
  const faces = frameFaces(f).filter((fc) => fc.kind === 'wall');
  let n = 0;
  for (const face of faces) {
    const cnt = perWall[face.wall] ?? 0;
    const wl = face.e1.length();
    const u1 = face.e1.clone().divideScalar(wl);
    const mid = face.o.clone().addScaledVector(face.e1, 0.5).addScaledVector(face.e2, 0.4);
    const d = Math.max(50, worldToCanvas(mid).d);
    // Windows are painted dabs: ~0.0065 h tall on the canvas (>= 1.6 m), at most half the wall height.
    const hw = Math.max(1.6, Math.min(0.0065 * K_D * d, 0.5 * f.wallH)) * sizeK;
    const ww = Math.min(0.8 * hw, (0.7 * wl) / Math.max(1, cnt));
    for (let i = 0; i < cnt; i++) {
      const t = (i + 0.5) / cnt + rng.range(-0.05, 0.05);
      const y = Math.max(0.5 * hw + 0.3, f.wallH * rng.range(0.32, 0.5));
      _c.copy(face.o).addScaledVector(u1, t * wl).addScaledVector(face.n, 0.12 + 0.0003 * d);
      _c.y += y;
      _a.copy(_c);
      _a.y -= 0.5 * hw;
      _b.copy(_c);
      _b.y += 0.5 * hw;
      const r = rng.next();
      const colA = r < 0.18 ? WIN_LEMON : r < 0.45 ? WIN_ORANGE : P.chrome;
      const colB = rng.pick(WIN_B);
      if (em.emit(_a, _b, face.n, { w: ww / (K_D * d), colA, colB, emissive: 2.5, seed: rng.next(), maxComp: 1.6 })) n++;
    }
  }
  return n;
}

// ------------------------------------------------------------------ church strokes

const CHURCH_COUNTS = { shaft: 1450, spire: 950, spirePinned: 60 } as const;
export const CHURCH_WINDOWS = 4;

function emitShaft(em: SolidEmitter, rng: Rng, count: number): void {
  const g = CHURCH_GEO;
  const apothem = g.shaftR * Math.cos(Math.PI / 8);
  const half = g.shaftR * Math.sin(Math.PI / 8);
  const d = worldToCanvas(_c.set(g.base.x, 40, g.base.z)).d;
  const kd = K_D * d;
  const weights = Array.from({ length: 8 }, (_, i) => (Math.cos(i * Math.PI / 4) > -0.1 ? 1 : 0.5));
  const wsum = weights.reduce((s, x) => s + x, 0);
  // The steeple reads as one dark needle (outline colour), shaft and spire alike: dark body strokes, and on the faces
  // turned to E a few ultramarine / cobalt catch-lights.
  const dark = swatches(10, (): Pair => [mixHex(P.outline, P.prussian, rng.range(0, 0.5)), mixHex(P.outline, P.ultramarine, rng.range(0.1, 0.4))]);
  const lit = swatches(6, (): Pair => [mixHex(P.ultramarine, P.cobalt, rng.range(0.15, 0.45)), mixHex(P.ultramarine, P.outline, rng.range(0.2, 0.5))]);
  let n = 0;
  for (let guard = 0; n < count && guard < count * 4; guard++) {
    let r = rng.next() * wsum;
    let i = 0;
    while (i < 7 && r > weights[i]) r -= weights[i++];
    const phi = SHAFT_PHI0 + i * Math.PI / 4;
    _n.set(Math.sin(phi), 0, Math.cos(phi));
    const tx = Math.cos(phi);
    const tz = -Math.sin(phi);
    const Lw = Math.min(rng.range(0.008, 0.015) * kd, 12);
    const Ww = Math.min(rng.range(0.0022, 0.0032) * kd, 1.2 * half);
    const s = rng.range(-half + 0.3 * Ww, half - 0.3 * Ww);
    const y = rng.range(0.5 * Lw - 0.5, g.shaftTop - 0.5 * Lw + 0.3);
    const lift = 0.03 + 0.05 * rng.next();
    const jit = rng.normal() * 0.04;
    const ox = g.base.x + _n.x * (apothem + lift) + tx * s;
    const oz = g.base.z + _n.z * (apothem + lift) + tz * s;
    const hx = Math.sin(jit) * 0.5 * Lw;
    _a.set(ox - tx * hx, y - Math.cos(jit) * 0.5 * Lw, oz - tz * hx);
    _b.set(ox + tx * hx, y + Math.cos(jit) * 0.5 * Lw, oz + tz * hx);
    const facing = i === 0 || i === 1 || i === 7;
    const [colA, colB] = rng.pick(facing && rng.next() < 0.12 ? lit : dark);
    if (em.emit(_a, _b, _n, { w: Ww / kd, colA, colB, seed: rng.next(), kappa: rng.range(-0.04, 0.04), flags: StrokeFlag.OUTLINE, maxComp: 1.5 })) n++;
  }
}

const SPIRE_LIT = shadeHex(P.cerulean, 0.6);
const SPIRE_B = [P.ultramarine, P.prussian, mixHex(P.ultramarine, P.cobalt, 0.4)];

function emitSpire(em: SolidEmitter, rng: Rng, count: number, pinned: number): void {
  const g = CHURCH_GEO;
  const H = g.spireTop - g.shaftTop;
  const slant = Math.hypot(H, g.spireR);
  const alpha = Math.atan2(g.spireR, H); // half-angle: the outward normal tilts up by alpha
  const d = worldToCanvas(_c.set(g.base.x, 110, g.base.z)).d;
  const kd = K_D * d;
  let n = 0;
  for (let guard = 0; n < count && guard < count * 4; guard++) {
    // E-facing generatrices weighted x2.
    let theta = rng.range(-Math.PI, Math.PI);
    if (Math.cos(theta) < 0 && rng.next() < 0.5) theta = rng.range(-0.5 * Math.PI, 0.5 * Math.PI);
    const phi = SHAFT_PHI0 + theta;
    const radial = new Vector3(Math.sin(phi), 0, Math.cos(phi));
    _n.copy(radial).multiplyScalar(Math.cos(alpha)).setY(Math.sin(alpha));
    const isPinned = n < pinned;
    const Lw = isPinned ? rng.range(4, 9) : Math.max(3, Math.min(rng.range(0.008, 0.016) * kd, 10));
    // Slant position from the tip (0) to the base of the spire (slant).
    const s0 = isPinned ? 0 : rng.range(0, slant - Lw);
    const s1 = s0 + Lw;
    const at = (s: number, out: Vector3) => {
      const f = s / slant;
      const lift = s === 0 ? 0 : 0.03;
      return out.set(
        g.tip.x + radial.x * (g.spireR * f) + _n.x * lift,
        g.tip.y - H * f + _n.y * lift,
        g.tip.z + radial.z * (g.spireR * f) + _n.z * lift,
      );
    };
    // A starts at the tip end so the stroke's thin start (M3 width taper) points up.
    at(s0, _a);
    at(s1, _b);
    if (isPinned) _a.copy(g.tip);
    const rMid = (g.spireR * (s0 + 0.5 * Lw)) / slant;
    const Ww = Math.max(0.3, Math.min(rng.range(0.0018, 0.0028) * kd, 0.5 * Math.PI * rMid));
    const r = rng.next();
    const lit = Math.cos(theta) > 0.3 && r < 0.18;
    const colA = lit ? P.ultramarine : P.outline;
    const colB = lit ? SPIRE_LIT : rng.pick(SPIRE_B);
    if (em.emit(_a, _b, _n, { w: Ww / kd, colA, colB, seed: rng.next(), kappa: rng.range(-0.03, 0.03), flags: StrokeFlag.OUTLINE, maxComp: 1.5 })) n++;
  }
}

// ------------------------------------------------------------------ generator

/** §4.7 budgets (High). */
export const VILLAGE_COUNTS = { house: 14000, window: 400, church: 3600 } as const;

export function generateVillage(sink: StrokeSink, rng: Rng): VillageInfo {
  const houses = villageLayout();
  const emH = new SolidEmitter(sink, StrokeClass.HOUSE);
  const emW = new SolidEmitter(sink, StrokeClass.WINDOW);
  const emC = new SolidEmitter(sink, StrokeClass.CHURCH);
  const frames = houses.map(houseFrame);

  // ---- houses: outline edges first, then the fill budget split by canvas area seen from E (area * vis / d^2).
  let edgeCount = 0;
  for (const f of frames) edgeCount += emitEdges(emH, rng, f);
  const faceSets = frames.map(frameFaces);
  const weights = faceSets.map((faces, i) => {
    const d = worldToCanvas(frames[i].origin).d;
    return faces.reduce((s, fc) => s + fc.area * fc.vis, 0) / (d * d);
  });
  let remaining = VILLAGE_COUNTS.house - edgeCount;
  for (let i = 0; i < frames.length; i++) {
    const share = i === frames.length - 1 ? remaining : Math.round((remaining * weights[i]) / weights.slice(i).reduce((s, x) => s + x, 0));
    const nHouse = Math.max(0, Math.min(remaining, share));
    remaining -= nHouse;
    const faces = faceSets[i];
    const fsum = faces.reduce((s, fc) => s + fc.area * fc.vis, 0);
    const pal = housePalette(rng);
    let left = nHouse;
    faces.forEach((fc, j) => {
      const c = j === faces.length - 1 ? left : Math.min(left, Math.round((nHouse * fc.area * fc.vis) / fsum));
      left -= fillFace(emH, rng, fc, c, pal, {});
    });
    remaining += Math.max(0, left); // carry anything the faces could not place
  }

  // ---- windows: 2-3 per wall on all four walls, the church keeps CHURCH_WINDOWS.
  // Two per wall everywhere, then a third on the longest walls until the budget is used.
  const perWall = frames.map(() => [2, 2, 2, 2]);
  let extra = VILLAGE_COUNTS.window - CHURCH_WINDOWS - 8 * frames.length;
  const walls = frames
    .flatMap((f, i) => [0, 1, 2, 3].map((w) => ({ i, w, len: w % 2 === 0 ? f.len : f.wid })))
    .filter((x) => x.len >= 11)
    .sort((a, b) => b.len - a.len);
  for (const x of walls) {
    if (extra <= 0) break;
    perWall[x.i][x.w] = 3;
    extra--;
  }
  for (let i = 0; i < frames.length; i++) emitWindows(emW, rng, frames[i], perWall[i]);

  // ---- church: shaft, spire (tip pinned), nave with outline edges, nave windows.
  const nave = naveFrame();
  emitShaft(emC, rng, CHURCH_COUNTS.shaft);
  emitSpire(emC, rng, CHURCH_COUNTS.spire, CHURCH_COUNTS.spirePinned);
  const naveEdges = emitEdges(emC, rng, nave);
  const naveFaces = frameFaces(nave);
  const nNave = VILLAGE_COUNTS.church - CHURCH_COUNTS.shaft - CHURCH_COUNTS.spire - naveEdges;
  const fsum = naveFaces.reduce((s, fc) => s + fc.area * fc.vis, 0);
  const pal: Palette3 = { wallBase: mixHex(P.ultramarine, P.cerulean, 0.1), accent: P.cerulean, tone: 0.65 };
  let left = nNave;
  naveFaces.forEach((fc, j) => {
    const c = j === naveFaces.length - 1 ? left : Math.min(left, Math.round((nNave * fc.area * fc.vis) / fsum));
    left -= fillFace(emC, rng, fc, c, pal, { lc: [0.008, 0.016] });
  });
  emitWindows(emW, rng, nave, [3, 0, 1, 0], 1.6);

  emH.finish();
  emW.finish();
  emC.finish();
  return {
    steepleBase: CHURCH_GEO.base.clone(),
    steepleTip: CHURCH_GEO.tip.clone(),
    houses: houses.map((h) => ({ center: h.center.clone(), size: h.size.clone(), yaw: h.yaw })),
  };
}

// ------------------------------------------------------------------ underlay geometry (house and church cores)

/** Non-indexed triangle soup with outward winding fixed against an interior point. */
class TriSoup {
  pos: number[] = [];
  private t0 = new Vector3();
  private t1 = new Vector3();
  tri(a: Vector3, b: Vector3, c: Vector3, inside: Vector3): void {
    this.t0.subVectors(b, a).cross(this.t1.subVectors(c, a));
    const cx = (a.x + b.x + c.x) / 3 - inside.x;
    const cy = (a.y + b.y + c.y) / 3 - inside.y;
    const cz = (a.z + b.z + c.z) / 3 - inside.z;
    const flip = this.t0.x * cx + this.t0.y * cy + this.t0.z * cz < 0;
    const [p, q] = flip ? [c, b] : [b, c];
    this.pos.push(a.x, a.y, a.z, p.x, p.y, p.z, q.x, q.y, q.z);
  }
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, inside: Vector3): void {
    this.tri(a, b, c, inside);
    this.tri(a, c, d, inside);
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** Box walls + gable roof prism of a frame, inset so the strokes on the faces stay in front. */
function addFrameCore(soup: TriSoup, f: HouseFrame, inset: number): void {
  const L = 0.5 * f.len - inset;
  const W = 0.5 * f.wid - inset;
  const h = f.wallH - 0.5 * inset;
  const top = f.wallH + f.roofH - 1.2 * inset;
  const p = (x: number, y: number, z: number) => toWorld(f, x, y, z);
  const inside = p(0, 0.5 * h, 0);
  const y0 = -1;
  const c = [p(-L, y0, -W), p(L, y0, -W), p(L, y0, W), p(-L, y0, W), p(-L, h, -W), p(L, h, -W), p(L, h, W), p(-L, h, W)];
  soup.quad(c[0], c[1], c[5], c[4], inside);
  soup.quad(c[1], c[2], c[6], c[5], inside);
  soup.quad(c[2], c[3], c[7], c[6], inside);
  soup.quad(c[3], c[0], c[4], c[7], inside);
  const r0 = p(-L, top, 0);
  const r1 = p(L, top, 0);
  const roofIn = p(0, h + 0.3 * (top - h), 0);
  soup.quad(c[7], c[6], r1, r0, roofIn);
  soup.quad(c[5], c[4], r0, r1, roofIn);
  soup.tri(c[6], c[5], r1, roofIn);
  soup.tri(c[4], c[7], r0, roofIn);
}

/** All house cores in one static mesh (positions from VillageInfo; roofs rebuilt with houseRoofHeight). */
export function buildHouseCoreGeometry(houses: VillageInfo['houses']): BufferGeometry {
  const soup = new TriSoup();
  for (const h of houses) addFrameCore(soup, houseFrame(h), 0.25);
  return soup.geometry();
}

/** Church core: nave box + roof, octagonal shaft, 16-sided spire (inset under the strokes, tip 1.5 m short). */
export function buildChurchCoreGeometry(): BufferGeometry {
  const g = CHURCH_GEO;
  const soup = new TriSoup();
  addFrameCore(soup, naveFrame(), 0.3);
  const ring = (r: number, y: number, n: number, phase: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * 2 * Math.PI) / n;
      return new Vector3(g.base.x + r * Math.sin(a), y, g.base.z + r * Math.cos(a));
    });
  const rs = g.shaftR - 0.3;
  const lo = ring(rs, -1, 8, SHAFT_PHI0 + Math.PI / 8);
  const hi = ring(rs, g.shaftTop, 8, SHAFT_PHI0 + Math.PI / 8);
  const shaftIn = new Vector3(g.base.x, 0.5 * g.shaftTop, g.base.z);
  for (let i = 0; i < 8; i++) soup.quad(lo[i], lo[(i + 1) % 8], hi[(i + 1) % 8], hi[i], shaftIn);
  const sp = ring(g.spireR - 0.35, g.shaftTop, 16, 0);
  const tip = new Vector3(g.base.x, g.spireTop - 1.5, g.base.z);
  const spireIn = new Vector3(g.base.x, g.shaftTop + 10, g.base.z);
  for (let i = 0; i < 16; i++) soup.tri(sp[i], sp[(i + 1) % 16], tip, spireIn);
  for (let i = 0; i < 16; i++) soup.tri(sp[i], sp[(i + 1) % 16], new Vector3(g.base.x, g.shaftTop, g.base.z), spireIn.clone().setY(g.shaftTop + 5));
  return soup.geometry();
}

// ------------------------------------------------------------------ groves layout (shared by terrain.ts and the underlays)

/** §4.7 grove budgets (High): 6,000 strokes on 220 village clumps + 30 around the cypress knoll. */
export const GROVE_COUNTS = { strokes: 6000, villageClumps: 220, knollClumps: 30 } as const;

/** Ground point seen through canvas (u, v) from E (on groundHeight); false above the horizon. */
function groundAt(u: number, v: number, out: Vector3): boolean {
  const d = groundHitDepth(u, v);
  if (!Number.isFinite(d) || d <= 0) return false;
  canvasToWorld(u, v, d, out);
  return true;
}

export interface GroveClump { c: Vector3; rh: number; rv: number; d: number }
type Clump = GroveClump;

const GROVE_SEED = 0x6a07e5;
let groveCache: GroveClump[] | null = null;
/**
 * The 250 grove clumps (220 among the village, 30 around the cypress knoll) from a fixed internal seed, so the
 * stroke generator and the grove cores in createLandUnderlays agree whatever rng generateGround receives.
 * Clump: ellipsoid centre c, horizontal radius rh, vertical radius rv (sunk by rv / 4), depth d of c from E.
 */
export function groveLayout(): readonly GroveClump[] {
  if (!groveCache) groveCache = placeClumps(mulberry32(GROVE_SEED));
  return groveCache;
}

function placeClumps(rng: Rng): Clump[] {
  const out: Clump[] = [];
  const frames = villageLayout().map(houseFrame);
  const hR = frames.map((f) => 0.5 * Math.hypot(f.len, f.wid) + 0.5);
  const g = CHURCH_GEO;
  const naveEnd = new Vector3(g.base.x + 44 * Math.cos(g.naveYaw), 0, g.base.z - 44 * Math.sin(g.naveYaw));
  // Canvas boxes of the houses (shrunk 20 % per side) and the church: a grove may sit behind them, never in front.
  const boxes = frames.map((f) => {
    const b = frameCanvasBox(f);
    const su = 0.2 * (b.u1 - b.u0);
    const sv = 0.2 * (b.v1 - b.v0);
    return { u0: b.u0 + su, u1: b.u1 - su, v0: b.v0 + sv, v1: b.v1 - sv, d: b.d };
  });
  boxes.push({ u0: 0.535, u1: 0.64, v0: 0.1, v1: 0.46, d: 645 });
  const hidesVillage = (c: Vector3, rh: number, rv: number) => {
    const cc = worldToCanvas(c);
    const hu = rh / (2 * AT * cc.d);
    const hv = rv / (2 * T_HALF * cc.d);
    for (const b of boxes) {
      if (cc.d < b.d + 4 && cc.u + hu > b.u0 && cc.u - hu < b.u1 && cc.v + hv > b.v0 && cc.v - hv < b.v1) return true;
    }
    return false;
  };
  const clear = (x: number, z: number, r: number, list: Clump[], k: number) => {
    for (let i = 0; i < frames.length; i++) if (Math.hypot(frames[i].origin.x - x, frames[i].origin.z - z) < hR[i] + r + 1.5) return false;
    // church: shaft and nave (segment base -> naveEnd, half-width 8 m)
    const vx = naveEnd.x - g.base.x;
    const vz = naveEnd.z - g.base.z;
    const t = Math.max(0, Math.min(1, ((x - g.base.x) * vx + (z - g.base.z) * vz) / (vx * vx + vz * vz)));
    if (Math.hypot(x - g.base.x - t * vx, z - g.base.z - t * vz) < r + 11) return false;
    for (const o of list) if (Math.hypot(o.c.x - x, o.c.z - z) < k * (o.rh + r)) return false;
    return true;
  };
  // Village groves: canvas u 0.30-1.25, base v 0.02-0.20 (in front of the front hill's foot).
  for (let tries = 0; out.length < GROVE_COUNTS.villageClumps && tries < 30000; tries++) {
    const u = rng.range(0.3, 1.25);
    const vb = rng.range(0.02, 0.2);
    if (vb > hillFootV(u, 0) - 0.006) continue;
    const c = new Vector3();
    if (!groundAt(u, vb, c)) continue;
    // Foreground clumps stay small so they do not wall off the village from E.
    const near = Math.max(0.45, Math.min(1, (worldToCanvas(c).d - 250) / 450));
    const rh = rng.range(4, 12.5) * near;
    const rv = rh * rng.range(1.0, 1.9 - 0.5 * (1 - near));
    if (!clear(c.x, c.z, rh, out, 0.8)) continue;
    c.y = groundHeight(c.x, c.z) + 0.75 * rv;
    const d = worldToCanvas(c).d;
    if (d - 1.2 * rh < 215 || d + 1.2 * rh > 7400) continue;
    if (hidesVillage(c, rh, rv)) continue;
    out.push({ c, rh, rv, d });
  }
  // Around the cypress knoll: behind / beside the trunk only (GROVE dRange starts at 200 m), tops below ~40 m.
  const knoll: Clump[] = [];
  for (let tries = 0; knoll.length < GROVE_COUNTS.knollClumps && tries < 20000; tries++) {
    const rho = rng.range(32, 140);
    const th = rng.range(-Math.PI, Math.PI);
    const x = -50 + rho * Math.sin(th);
    const z = -195 + rho * Math.cos(th);
    const rh = rng.range(4, 9);
    const rv = rh * rng.range(1.0, 1.6);
    if (rho < 22 + rh) continue;
    if (!clear(x, z, rh, knoll, 0.9)) continue;
    const c = new Vector3(x, groundHeight(x, z) + 0.75 * rv, z);
    const d = worldToCanvas(c).d;
    if (d - 1.2 * rh < 212) continue;
    knoll.push({ c, rh, rv, d });
  }
  return out.concat(knoll);
}

// ------------------------------------------------------------------ underlays

/**
 * Ground underlay grid (§4.7, enlarged): a tensor grid over x [x0, x1], z [z0, z1] on groundHeight, `drop` below it,
 * with `step` cells and `fine.step` cells over the cypress knoll (where the terrain curves). Quads whose four corners
 * have dissolved (landFade = 0) are left out.
 */
export const GROUND_GRID = {
  x0: -8000, x1: 8500, z0: 3250, z1: -9500, step: 125, drop: 0.4,
  fine: { x0: -540, x1: 440, z0: 300, z1: -700, step: 22 },
} as const;
/** Distance bands (metres along -z) of the ground underlay, coloured cypressDark -> prussian (the first band also runs behind E). */
const GROUND_BANDS = [0, 600, 1500, 3000];
export const UNDERLAY_COLORS = { houseCore: 0x26314a, churchCore: 0x1f2840, hillBack: PALETTE.outline, groveCore: 0x17231b } as const;

/**
 * The land as an island of paint (aFade of the ground underlay, 1 = opaque): solid over everything seen from E and
 * from the wide-FOV shots near E (the ground before the hills over u in [-1.6, 2.6]) and under the three walls, then
 * dissolving outward in lobes and horizontal streaks (the field swathes' direction) into the void. The outline is a fan
 * (its half-width grows with depth like the view from E) closed by an ellipse in depth.
 */
export function landFade(x: number, z: number): number {
  const s = (x - 300) / (4600 + 0.5 * Math.max(0, -z));
  const t = (z + 3600) / 6000;
  const th = Math.atan2(t, s);
  let rho = Math.hypot(s, t) * (1 + 0.05 * Math.sin(3 * th + 0.7) + 0.04 * Math.sin(5 * th + 2.1));
  // blotchy coast + horizontal brush streaks that fray the rim into fingers of paint
  rho += 0.1 * valueNoise2(x / 2600 + 3.7, z / 2300 - 1.3) + 0.12 * streakNoise(x, z);
  const f = 1 - Math.max(0, Math.min(1, (rho - 0.78) / 0.2));
  return f * f * (3 - 2 * f);
}

/** Sorted grid lines over [a, b] (a < b): `step` apart, `fineStep` apart over [fa, fb], plus the `extra` lines. */
function gridLines(a: number, b: number, step: number, fa: number, fb: number, fineStep: number, extra: readonly number[] = []): number[] {
  const out: number[] = [];
  for (let x = a; x < fa; x += step) out.push(x);
  for (let x = fa; x < fb; x += fineStep) out.push(x);
  for (let x = fb; x < b; x += step) out.push(x);
  out.push(b, ...extra);
  out.sort((p, q) => p - q);
  return out.filter((x, i) => i === 0 || x - out[i - 1] > 0.5 * fineStep);
}

let groundCache: { xs: number[]; zs: number[]; fade: Float32Array } | null = null;
function groundLattice(): { xs: number[]; zs: number[]; fade: Float32Array } {
  if (groundCache) return groundCache;
  const G = GROUND_GRID;
  const xs = gridLines(G.x0, G.x1, G.step, G.fine.x0, G.fine.x1, G.fine.step);
  // z runs from z0 (behind E) toward -z; the band boundaries are grid rows.
  const zs = gridLines(G.z1, G.z0, G.step, G.fine.z1, G.fine.z0, G.fine.step, GROUND_BANDS.slice(1).map((d) => -d)).reverse();
  const fade = new Float32Array(xs.length * zs.length);
  for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) fade[j * xs.length + i] = landFade(xs[i], zs[j]);
  groundCache = { xs, zs, fade };
  return groundCache;
}

/** Ground underlay rows [j0, j1] of the lattice (with aFade); fully dissolved quads are dropped. */
function groundBandGeometry(j0: number, j1: number): BufferGeometry {
  const G = GROUND_GRID;
  const { xs, zs, fade } = groundLattice();
  const nx = xs.length - 1;
  const pos = new Float32Array((nx + 1) * (j1 - j0 + 1) * 3);
  const fa = new Float32Array((nx + 1) * (j1 - j0 + 1));
  let p = 0;
  for (let j = j0; j <= j1; j++) {
    const z = zs[j];
    for (let i = 0; i <= nx; i++) {
      const x = xs[i];
      fa[p / 3] = fade[j * (nx + 1) + i];
      pos[p++] = x;
      pos[p++] = groundHeight(x, z) - G.drop;
      pos[p++] = z;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < j1 - j0; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const c = a + nx + 1;
      if (fa[a] + fa[a + 1] + fa[c] + fa[c + 1] <= 0) continue;
      // (x, z) -> (x+1, z) -> (x, z-1): normal +Y.
      idx.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aFade', new BufferAttribute(fa, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Grove cores: low-poly ellipsoids at 88 % of each clump (strokes sit on the full surface), above ground only. */
function groveCoreGeometry(): BufferGeometry {
  const NA = 10;
  const NR = 6;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const cl of groveLayout()) {
    const base = pos.length / 3;
    const rh = 0.88 * cl.rh;
    const rv = 0.88 * cl.rv;
    for (let j = 0; j <= NR; j++) {
      // latitude from -0.3 rad (below the ground line) to the pole
      const lat = -0.3 + ((0.5 * Math.PI + 0.3) * j) / NR;
      for (let i = 0; i <= NA; i++) {
        const lon = (2 * Math.PI * i) / NA;
        pos.push(cl.c.x + rh * Math.cos(lat) * Math.sin(lon), cl.c.y + rv * Math.sin(lat), cl.c.z + rh * Math.cos(lat) * Math.cos(lon));
      }
    }
    for (let j = 0; j < NR; j++) {
      for (let i = 0; i < NA; i++) {
        const a = base + j * (NA + 1) + i;
        const b = a + NA + 1;
        // lon increases toward +x from +z (counter-clockwise seen from above): (a, a+1, b) faces outward.
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Land underlays (§4.7), 8 meshes: the ground island (tensor grid on groundHeight, 4 distance bands #1d2b1f -> #0b1a3a,
 * aFade dissolving its rim into the void, see landFade), hill wall faces + rounded backs (#142454, aFade: opaque toward
 * E across HILL_U_FULL, backs melting toward their foot), house cores (#26314a, one merged static mesh), the
 * church/steeple core and dark grove cores. Every surface is inset/dropped slightly behind the strokes that lie on it,
 * so the strokes win the depth test independently of polygonOffset. Windings are outward, so FrontSide materials work.
 * Materials are requested once per (colour, vertexFade); a colour is never requested both with and without vertexFade,
 * so a factory that caches by colour alone still hands out the right program.
 */
export function createLandUnderlays(makeMaterial: UnderlayMaterialFactory, info: VillageInfo): Group {
  const group = new Group();
  group.name = 'landUnderlays';
  const mats = new Map<string, Material>();
  const mat = (hex: number, vertexFade: boolean) => {
    const key = `${hex}:${vertexFade}`;
    let m = mats.get(key);
    if (!m) {
      m = vertexFade ? makeMaterial(hex, { vertexFade: true }) : makeMaterial(hex);
      mats.set(key, m);
    }
    return m;
  };
  const add = (name: string, g: BufferGeometry, hex: number) => {
    const mesh = new Mesh(g, mat(hex, g.getAttribute('aFade') !== undefined));
    mesh.name = name;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
  };
  const { zs } = groundLattice();
  const rowOf = (dist: number) => {
    if (dist === 0) return 0;
    let best = 0;
    for (let j = 1; j < zs.length; j++) if (Math.abs(zs[j] + dist) < Math.abs(zs[best] + dist)) best = j;
    return best;
  };
  for (let b = 0; b < GROUND_BANDS.length; b++) {
    const t = b / (GROUND_BANDS.length - 1);
    const j1 = b + 1 < GROUND_BANDS.length ? rowOf(GROUND_BANDS[b + 1]) : zs.length - 1;
    add(`ground${b}`, groundBandGeometry(rowOf(GROUND_BANDS[b]), j1), mixHex(P.cypressDark, P.prussian, t));
  }
  add('hillWalls', buildHillUnderlayGeometry(), UNDERLAY_COLORS.hillBack);
  add('houseCores', buildHouseCoreGeometry(info.houses), UNDERLAY_COLORS.houseCore);
  add('churchCore', buildChurchCoreGeometry(), UNDERLAY_COLORS.churchCore);
  add('groveCores', groveCoreGeometry(), UNDERLAY_COLORS.groveCore);
  return group;
}
