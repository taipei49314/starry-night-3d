// Stroke layer (§4.3): chunked instanced draws over one shared ribbon, one shader source, static buffers,
// tier prefixes, hand-set bounding spheres (with animation envelopes).
import {
  BufferGeometry, DoubleSide, Group, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute,
  Mesh, ShaderMaterial, Sphere, StaticDrawUsage, Vector3,
} from 'three';
import {
  AnimKind, CANVAS_ASPECT, CLASS_COUNT, CLASS_INFO, FLOATS_PER_STROKE, JET_D1, StrokeClass, StrokeFlag, T_HALF, VORTICES,
  type QualitySettings, type SharedUniforms, type StrokeChunk, type StrokeLayer,
} from '../contracts';
import { canvasToWorld, jetPoint } from '../shared/canvasSpace';
import { ringGeom } from '../shared/flowField';
import { mulberry32 } from '../shared/rng';
import { sharedRibbon } from './ribbonGeometry';
import type { StrokeBuffer } from './strokeBuffer';
import { strokeFrag } from './glsl/stroke.frag';
import { strokeVert } from './glsl/stroke.vert';

/** Max instances in a Morton chunk. */
export const MAX_CHUNK = 4096;
/**
 * Bound of |stormField| used for the storm cull inflation (radius += extra * dMax * this). Each component of the
 * §3 field is at most (1.1 + 1.7 + 0.45 * 2) * 0.42 = 1.554, so |field| <= sqrt(3) * 1.554 = 2.69.
 */
export const STORM_FIELD_BOUND = 2.7;
/**
 * Stir-the-sky envelope for sky classes, in h-units: the rotation 1.2 z exp(-r^2/R^2) about the cursor moves a
 * point by at most 0.515 z R (at r = R / sqrt 2); z <= 1 and R = 0.08 (§5.3) give 0.041. 0.05 allows R up to 0.097.
 */
const STIR_PAD_H = 0.05;
/** Max uWidthComp any tier can produce (sqrt(1 / 0.25)). */
const MAX_WIDTH_COMP = 2;
/** Velocity stretch can drag a stroke's tail up to 3 Lw. */
const STRETCH_LW = 3;
/** Upper clamp of the VORTEX streaming size factor r(sigma) / r(sigma0) in the vertex shader. */
const VORTEX_SCALE_MAX = 2.5;

export interface StrokeChunkEx extends StrokeChunk {
  /** Underlayer strokes sit first in the chunk and are always drawn. */
  nUnder: number;
  /** Bounding-sphere centre (world, t = 0 envelope). */
  center: Vector3;
}
export interface StrokeLayerEx extends StrokeLayer {
  chunks: StrokeChunkEx[];
  readonly material: ShaderMaterial;
  /** Draw calls this layer issues with every chunk visible. */
  readonly drawCalls: number;
  dispose(): void;
}

/** The stroke ShaderMaterial (one program for every class). Spread the shared uniforms by reference. */
export function makeStrokeMaterial(u: SharedUniforms, q: QualitySettings): ShaderMaterial {
  const m = new ShaderMaterial({
    name: 'strokes',
    uniforms: { ...u },
    vertexShader: strokeVert,
    fragmentShader: strokeFrag,
    side: DoubleSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
  applyAlphaMode(m, q);
  return m;
}

function applyAlphaMode(m: ShaderMaterial, q: QualitySettings): boolean {
  const a2c = q.msaa > 0;
  const hashed = !a2c;
  const had = 'HASHED_ALPHA' in m.defines;
  const changed = m.alphaToCoverage !== a2c || had !== hashed;
  m.alphaToCoverage = a2c;
  if (hashed) m.defines.HASHED_ALPHA = '';
  else delete m.defines.HASHED_ALPHA;
  if (changed) m.needsUpdate = true;
  return changed;
}

// ------------------------------------------------------------------ Morton order
function part1by2(x: number): number {
  x &= 0x3ff;
  x = (x | (x << 16)) & 0x030000ff;
  x = (x | (x << 8)) & 0x0300f00f;
  x = (x | (x << 4)) & 0x030c30c3;
  x = (x | (x << 2)) & 0x09249249;
  return x >>> 0;
}
function morton3(a: number, b: number, c: number): number {
  return (part1by2(a) | (part1by2(b) << 1) | (part1by2(c) << 2)) >>> 0;
}

function shuffle(a: number[], seed: number): void {
  const rng = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
}

// ------------------------------------------------------------------ bounds
class SphereAcc {
  private p: number[] = [];
  add(x: number, y: number, z: number, r: number): void {
    this.p.push(x, y, z, r);
  }
  finish(): { center: Vector3; radius: number } {
    const p = this.p;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i + 3];
      x0 = Math.min(x0, p[i] - r); x1 = Math.max(x1, p[i] + r);
      y0 = Math.min(y0, p[i + 1] - r); y1 = Math.max(y1, p[i + 1] + r);
      z0 = Math.min(z0, p[i + 2] - r); z1 = Math.max(z1, p[i + 2] + r);
    }
    const c = new Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    let rad = 0;
    for (let i = 0; i < p.length; i += 4) {
      const dx = p[i] - c.x, dy = p[i + 1] - c.y, dz = p[i + 2] - c.z;
      rad = Math.max(rad, Math.sqrt(dx * dx + dy * dy + dz * dz) + p[i + 3]);
    }
    return { center: c, radius: rad * 1.001 + 1e-3 };
  }
}

const vA = new Vector3();
const vB = new Vector3();
const TWO_T = 2 * T_HALF;

/** World pad of a stroke beyond its spine: half width (max tier compensation, x3 underlayer) + bow + stretch, per metre of depth. */
function padPerDepth(L: number, W: number, kappa: number, under: boolean): number {
  return TWO_T * (L * (0.5 + STRETCH_LW + 0.25 * Math.abs(kappa)) + 0.5 * W * MAX_WIDTH_COMP * (under ? 3 : 1));
}

function chunkBounds(data: Float32Array, idx: number[], cls: StrokeClass, rule: 'morton' | 'vortex' | 'ring'): { center: Vector3; radius: number; dMax: number } {
  const anim = CLASS_INFO[cls].anim;
  const stirPad = CLASS_INFO[cls].sky ? STIR_PAD_H * TWO_T : 0; // world pad per metre of depth
  const acc = new SphereAcc();
  let dMax = 0;
  const F = FLOATS_PER_STROKE;

  if (anim === AnimKind.VORTEX || rule === 'vortex') {
    // Strokes stream across the whole funnel: bound the funnel surface (all angles, across offset 0.2 r).
    let pad = 0;
    const vis = new Set<number>();
    for (const i of idx) {
      const o = i * F;
      const under = (Math.floor(Math.round(data[o + 3]) / 32) & StrokeFlag.UNDERLAYER) !== 0;
      // the shader scales VORTEX L and W by r(sigma) / r(sigma0), clamped to [0.4, 2.5]
      pad = Math.max(pad, padPerDepth(VORTEX_SCALE_MAX * data[o + 4], VORTEX_SCALE_MAX * data[o + 7], data[o + 12], under));
      vis.add(Math.floor(data[o + 13] / 2));
    }
    for (const vi of vis) {
      const V = VORTICES[Math.max(0, Math.min(VORTICES.length - 1, vi))];
      const cx = V.u * CANVAS_ASPECT;
      for (let j = 0; j <= 32; j++) {
        const sg = j / 32;
        const r = V.r0 * Math.pow(V.rmax / V.r0, sg);
        const dd = V.dThroat * Math.pow(r / V.r0, V.expo);
        for (const f of [0.99, 1.0201]) {
          const d = dd * f;
          dMax = Math.max(dMax, d);
          for (let a = 0; a < 24; a++) {
            const th = (a / 24) * Math.PI * 2;
            canvasToWorld((cx + 1.25 * r * Math.cos(th)) / CANVAS_ASPECT, V.v + 1.25 * r * Math.sin(th), d, vA);
            acc.add(vA.x, vA.y, vA.z, (pad + stirPad) * d);
          }
        }
      }
    }
  } else if (anim === AnimKind.RING || rule === 'ring') {
    let pad = 0;
    const rings = new Set<string>();
    for (const i of idx) {
      const o = i * F;
      const under = (Math.floor(Math.round(data[o + 3]) / 32) & StrokeFlag.UNDERLAYER) !== 0;
      pad = Math.max(pad, padPerDepth(data[o + 4], data[o + 7], data[o + 12], under));
      rings.add(`${Math.round(data[o + 13])},${Math.round(data[o + 14])}`);
    }
    for (const key of rings) {
      const [si, k] = key.split(',').map(Number);
      const g = ringGeom(si, k);
      for (const f of [0.97, 1.03]) {
        const d = g.d * f;
        dMax = Math.max(dMax, d);
        for (let a = 0; a < 24; a++) {
          const th = (a / 24) * Math.PI * 2;
          const rr = g.rho * 1.06;
          canvasToWorld((g.cx + rr * Math.cos(th)) / CANVAS_ASPECT, g.cy + rr * Math.sin(th), d, vA);
          acc.add(vA.x, vA.y, vA.z, (pad + stirPad) * d + 0.02 * g.rho * TWO_T * d);
        }
      }
    }
  } else if (anim === AnimKind.JET) {
    let pad = 0, qMin = Infinity, qMax = -Infinity, jMin = Infinity, jMax = -Infinity;
    for (const i of idx) {
      const o = i * F;
      const under = (Math.floor(Math.round(data[o + 3]) / 32) & StrokeFlag.UNDERLAYER) !== 0;
      pad = Math.max(pad, padPerDepth(data[o + 4], data[o + 7], data[o + 12], under));
      qMin = Math.min(qMin, data[o + 14]); qMax = Math.max(qMax, data[o + 14]);
      jMin = Math.min(jMin, data[o + 15]); jMax = Math.max(jMax, data[o + 15]);
    }
    for (let j = 0; j <= 48; j++) {
      const sg = j / 48;
      for (const off of [qMin, qMax]) {
        const jp = jetPoint(sg, off);
        for (const f of [1 + jMin, 1 + jMax]) {
          const d = jp.d * f;
          dMax = Math.max(dMax, d);
          canvasToWorld(jp.u, jp.v, d, vA);
          acc.add(vA.x, vA.y, vA.z, (pad + stirPad) * d + 0.03 * d * TWO_T);
        }
      }
    }
    dMax = Math.max(dMax, JET_D1);
  } else {
    for (const i of idx) {
      const o = i * F;
      const u = data[o], v = data[o + 1], d = data[o + 2];
      const du = data[o + 4], dv = data[o + 5], dlnd = data[o + 6], W = data[o + 7];
      const kappa = data[o + 12];
      const under = (Math.floor(Math.round(data[o + 3]) / 32) & StrokeFlag.UNDERLAYER) !== 0;
      const eh = Math.exp(0.5 * dlnd);
      canvasToWorld(u - (0.5 * du) / CANVAS_ASPECT, v - 0.5 * dv, d / eh, vA);
      canvasToWorld(u + (0.5 * du) / CANVAS_ASPECT, v + 0.5 * dv, d * eh, vB);
      const Lw = vA.distanceTo(vB);
      const dm = d * Math.exp(0.5 * Math.abs(dlnd));
      dMax = Math.max(dMax, dm);
      let r = Lw * (0.5 + STRETCH_LW + 0.25 * Math.abs(kappa)) + 0.5 * W * MAX_WIDTH_COMP * (under ? 3 : 1) * TWO_T * dm;
      r += stirPad * dm;
      if (anim === AnimKind.BAND) r += 0.5 * Math.abs(data[o + 13]) * Lw;
      if (anim === AnimKind.CYPRESS) r += Math.max(2, 0.004 * 2 * CANVAS_ASPECT * T_HALF * dm);
      acc.add(0.5 * (vA.x + vB.x), 0.5 * (vA.y + vB.y), 0.5 * (vA.z + vB.z), r);
    }
  }
  const s = acc.finish();
  return { ...s, dMax };
}

// ------------------------------------------------------------------ build
function tierFraction(cls: StrokeClass, q: QualitySettings): number {
  return Math.max(1e-3, Math.min(1, CLASS_INFO[cls].tierFraction[q.tier]));
}

/**
 * Collect the buffer into chunked instanced meshes (§4.3). Chunks: Morton (u, v, log d) <= 4096, one per vortex
 * (floor(q1/2)) or per star (q1). Inside a chunk: underlayer strokes first (always drawn), then the rest; each part is
 * Fisher-Yates shuffled with a fixed seed so any prefix is a uniform subsample.
 */
export function buildStrokeLayer(buf: StrokeBuffer, u: SharedUniforms, q: QualitySettings): StrokeLayerEx {
  const data = buf.data;
  const F = FLOATS_PER_STROKE;
  const material = makeStrokeMaterial(u, q);
  const group = new Group();
  group.name = 'strokes';
  group.matrixAutoUpdate = false;
  const chunks: StrokeChunkEx[] = [];
  let ribbon: BufferGeometry = sharedRibbon(q.ribbonSegments);

  // indices per class
  const perClass: number[][] = Array.from({ length: CLASS_COUNT }, () => []);
  for (let i = 0; i < buf.count; i++) perClass[Math.round(data[i * F + 3]) % 32].push(i);

  for (let cls = 0 as StrokeClass; cls < CLASS_COUNT; cls++) {
    const ids = perClass[cls];
    if (ids.length === 0) continue;
    const info = CLASS_INFO[cls];
    const groups: number[][] = [];
    if (info.chunk === 'vortex' || info.chunk === 'ring') {
      const m = new Map<number, number[]>();
      for (const i of ids) {
        const key = info.chunk === 'vortex' ? Math.floor(data[i * F + 13] / 2) : Math.round(data[i * F + 13]);
        let g = m.get(key);
        if (!g) m.set(key, (g = []));
        g.push(i);
      }
      for (const k of [...m.keys()].sort((a, b) => a - b)) groups.push(m.get(k)!);
    } else {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, l0 = Infinity, l1 = -Infinity;
      for (const i of ids) {
        const o = i * F;
        const ld = Math.log(Math.max(data[o + 2], 1e-3));
        u0 = Math.min(u0, data[o]); u1 = Math.max(u1, data[o]);
        v0 = Math.min(v0, data[o + 1]); v1 = Math.max(v1, data[o + 1]);
        l0 = Math.min(l0, ld); l1 = Math.max(l1, ld);
      }
      const qz = (x: number, a: number, b: number) => Math.max(0, Math.min(1023, Math.floor(((x - a) / Math.max(b - a, 1e-9)) * 1023.999)));
      const codes = new Map<number, number>();
      for (const i of ids) {
        const o = i * F;
        codes.set(i, morton3(qz(data[o], u0, u1), qz(data[o + 1], v0, v1), qz(Math.log(Math.max(data[o + 2], 1e-3)), l0, l1)));
      }
      const sorted = ids.slice().sort((a, b) => codes.get(a)! - codes.get(b)! || a - b);
      const nChunks = Math.ceil(sorted.length / MAX_CHUNK);
      const size = Math.ceil(sorted.length / nChunks);
      for (let c = 0; c < nChunks; c++) groups.push(sorted.slice(c * size, (c + 1) * size));
    }

    groups.forEach((g, gi) => {
      const under: number[] = [];
      const rest: number[] = [];
      for (const i of g) ((Math.floor(Math.round(data[i * F + 3]) / 32) & StrokeFlag.UNDERLAYER) !== 0 ? under : rest).push(i);
      const seed = 0x5713 + cls * 977 + gi * 131;
      shuffle(under, seed ^ 0x2545);
      shuffle(rest, seed);
      const order = under.concat(rest);
      const arr = new Float32Array(order.length * F);
      order.forEach((src, k) => arr.set(data.subarray(src * F, src * F + F), k * F));

      const ib = new InstancedInterleavedBuffer(arr, F, 1);
      ib.setUsage(StaticDrawUsage);
      const geo = new InstancedBufferGeometry();
      geo.setIndex(ribbon.index);
      geo.setAttribute('position', ribbon.getAttribute('position'));
      geo.setAttribute('a0', new InterleavedBufferAttribute(ib, 4, 0));
      geo.setAttribute('a1', new InterleavedBufferAttribute(ib, 4, 4));
      geo.setAttribute('a2', new InterleavedBufferAttribute(ib, 4, 8));
      geo.setAttribute('a3', new InterleavedBufferAttribute(ib, 4, 12));
      const b = chunkBounds(data, g, cls, info.chunk);
      geo.boundingSphere = new Sphere(b.center.clone(), b.radius);
      geo.instanceCount = order.length;
      geo.name = `strokes:${StrokeClass[cls]}:${gi}`;

      const mesh = new Mesh(geo, material);
      mesh.name = geo.name;
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = true;
      group.add(mesh);
      chunks.push({ mesh, cls, n: order.length, nUnder: under.length, baseRadius: b.radius, dMax: b.dMax, center: b.center });
    });
  }

  let inflation = 0;
  const layer: StrokeLayerEx = {
    group,
    chunks,
    material,
    get ribbon() {
      return ribbon;
    },
    get drawCalls() {
      return chunks.length;
    },
    setQuality(qs: QualitySettings) {
      const next = sharedRibbon(qs.ribbonSegments);
      const swap = next !== ribbon;
      ribbon = next;
      const comp = u.uWidthComp.value;
      for (let c = 0; c < CLASS_COUNT; c++) comp[c] = Math.sqrt(1 / tierFraction(c as StrokeClass, qs));
      for (const ch of chunks) {
        const geo = ch.mesh.geometry as InstancedBufferGeometry;
        geo.instanceCount = ch.nUnder + Math.ceil((ch.n - ch.nUnder) * tierFraction(ch.cls, qs));
        if (swap) {
          geo.setIndex(ribbon.index);
          geo.setAttribute('position', ribbon.getAttribute('position'));
        }
      }
      u.uSpecular.value = qs.specular ? 1 : 0;
      u.uVelStretch.value = qs.velocityStretch ? 1 : 0;
      applyAlphaMode(material, qs);
    },
    setCullInflation(extra: number) {
      if (extra === inflation) return;
      inflation = extra;
      for (const ch of chunks) ch.mesh.geometry.boundingSphere!.radius = ch.baseRadius + Math.max(0, extra) * ch.dMax * STORM_FIELD_BOUND;
    },
    setCullingEnabled(on: boolean) {
      for (const ch of chunks) ch.mesh.frustumCulled = on;
    },
    dispose() {
      for (const ch of chunks) ch.mesh.geometry.dispose();
      material.dispose();
    },
  };
  layer.setQuality(q);
  return layer;
}
