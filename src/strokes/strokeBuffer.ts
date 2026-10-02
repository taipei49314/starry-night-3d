// Stroke collection (§4.1 record layout, §4.3): a growable packed Float32Array, 16 floats per stroke.
//  a0 = (u, v, d, cls + FLAG_STRIDE * flags)   a1 = (du, dv, dlnd, w)
//  a2 = (colA, colB, emissive, seed)           a3 = (kappa, q1, q2, q3)
import { CLASS_COUNT, FLAG_STRIDE, FLOATS_PER_STROKE, type StrokeClass, type StrokeRecord, type StrokeSink } from '../contracts';

export class StrokeBuffer implements StrokeSink {
  private buf: Float32Array;
  private n = 0;
  private readonly dMinC = new Float64Array(CLASS_COUNT).fill(Infinity);
  private readonly dMaxC = new Float64Array(CLASS_COUNT).fill(-Infinity);
  private readonly nC = new Uint32Array(CLASS_COUNT);

  constructor(capacity = 4096) {
    this.buf = new Float32Array(Math.max(1, capacity) * FLOATS_PER_STROKE);
  }

  get count(): number {
    return this.n;
  }

  /** Packed records, length count * 16 (a view; do not hold it across pushes). */
  get data(): Float32Array {
    return this.buf.subarray(0, this.n * FLOATS_PER_STROKE);
  }

  push(r: StrokeRecord): void {
    const cls = r.cls | 0;
    if (cls < 0 || cls >= CLASS_COUNT) throw new Error(`StrokeBuffer: bad class ${r.cls}`);
    if (!Number.isFinite(r.u + r.v + r.d + r.du + r.dv + r.dlnd + r.w + r.kappa + r.q1 + r.q2 + r.q3 + r.emissive + r.seed)) {
      throw new Error(`StrokeBuffer: non-finite field in a ${cls} record`);
    }
    if ((this.n + 1) * FLOATS_PER_STROKE > this.buf.length) {
      const next = new Float32Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    const o = this.n * FLOATS_PER_STROKE;
    const b = this.buf;
    const flags = (r.flags ?? 0) | 0;
    b[o] = r.u; b[o + 1] = r.v; b[o + 2] = r.d; b[o + 3] = cls + FLAG_STRIDE * flags;
    b[o + 4] = r.du; b[o + 5] = r.dv; b[o + 6] = r.dlnd; b[o + 7] = r.w;
    b[o + 8] = r.colA; b[o + 9] = r.colB; b[o + 10] = r.emissive; b[o + 11] = r.seed;
    b[o + 12] = r.kappa; b[o + 13] = r.q1; b[o + 14] = r.q2; b[o + 15] = r.q3;
    this.n++;
    if (r.d < this.dMinC[cls]) this.dMinC[cls] = r.d;
    if (r.d > this.dMaxC[cls]) this.dMaxC[cls] = r.d;
    this.nC[cls]++;
  }

  /** Depth range (record d, metres from E) and count of a class, for the paint-order assertions. */
  classRange(cls: StrokeClass): { dMin: number; dMax: number; n: number } {
    return { dMin: this.dMinC[cls], dMax: this.dMaxC[cls], n: this.nC[cls] };
  }

  /** Decode record i (float32-rounded values). */
  get(i: number, out: StrokeRecord): StrokeRecord {
    if (i < 0 || i >= this.n) throw new RangeError(`StrokeBuffer.get(${i}) of ${this.n}`);
    const b = this.buf;
    const o = i * FLOATS_PER_STROKE;
    const packed = Math.round(b[o + 3]);
    out.u = b[o]; out.v = b[o + 1]; out.d = b[o + 2];
    out.cls = (packed % FLAG_STRIDE) as StrokeClass;
    out.flags = Math.floor(packed / FLAG_STRIDE);
    out.du = b[o + 4]; out.dv = b[o + 5]; out.dlnd = b[o + 6]; out.w = b[o + 7];
    out.colA = b[o + 8]; out.colB = b[o + 9]; out.emissive = b[o + 10]; out.seed = b[o + 11];
    out.kappa = b[o + 12]; out.q1 = b[o + 13]; out.q2 = b[o + 14]; out.q3 = b[o + 15];
    return out;
  }

  /** Class and flags of record i without a full decode. */
  clsOf(i: number): StrokeClass {
    return (Math.round(this.buf[i * FLOATS_PER_STROKE + 3]) % FLAG_STRIDE) as StrokeClass;
  }
  flagsOf(i: number): number {
    return Math.floor(Math.round(this.buf[i * FLOATS_PER_STROKE + 3]) / FLAG_STRIDE);
  }
}

/** A zeroed record to use as a `get` target or generator template. */
export function emptyRecord(): StrokeRecord {
  return {
    u: 0, v: 0, d: 0, cls: 0 as StrokeClass, flags: 0, du: 0, dv: 0, dlnd: 0, w: 0,
    colA: 0, colB: 0, emissive: 0, seed: 0, kappa: 0, q1: 0, q2: 0, q3: 0,
  };
}

// Convenience re-exports: the integrator imports the whole M3 API from this file.
// (strokeMaterial.ts only imports the StrokeBuffer *type* back, so there is no runtime cycle.)
export { buildStrokeLayer, makeStrokeMaterial, type StrokeLayerEx, type StrokeChunkEx } from './strokeMaterial';
export { makeUnderlayMaterial } from './underlay';
export { makeRibbonGeometry } from './ribbonGeometry';
export { generateDebugStrokes } from './debugGen';
