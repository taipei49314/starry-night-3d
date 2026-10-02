// Dynamic resolution (§7.3) as a pure state machine: no WebGL, no DOM, no wall clock.
// Time is the running sum of the frame deltas fed to update(), so synthetic dt sequences test it exactly.
import { RENDER_SCALE_STEPS, type QualitySettings } from '../contracts';

export const EMA_ALPHA = 0.1;
/** Step down when EMA > DOWN_RATIO * target for DOWN_FRAMES consecutive frames. */
export const DOWN_RATIO = 1.1;
export const DOWN_FRAMES = 30;
/** Timer-query mode: step up when EMA < UP_RATIO * target for UP_FRAMES_TIMER consecutive frames. */
export const UP_RATIO = 0.7;
export const UP_FRAMES_TIMER = 120;
/** rAF-only mode: step up when dt <= UP_DT_RAF_MS for UP_FRAMES_RAF consecutive frames. */
export const UP_DT_RAF_MS = 17.5;
export const UP_FRAMES_RAF = 300;
/** At most one scale change per CHANGE_GAP_MS (a revert is exempt: it must land inside that window). */
export const CHANGE_GAP_MS = 2000;
/** A down-step within REVERT_WINDOW_MS of an up-step reverts it and bans up-steps for UP_BAN_MS. */
export const REVERT_WINDOW_MS = 2000;
export const UP_BAN_MS = 10_000;
/** Pinned at the tier minimum (EMA still > DOWN_RATIO * target) for PINNED_MS drops one tier. */
export const PINNED_MS = 2000;
/** Benchmark: median > BENCH_RATIO * target drops one tier. */
export const BENCH_RATIO = 1.3;
/** Hitch guard: a frame delta is clamped to this before it feeds the clock and the EMA (tab switch, compile stall). */
export const MAX_DT_MS = 250;

export type DynResAction =
  | { kind: 'none' }
  | { kind: 'scale'; scale: number; from: number; reason: 'down' | 'up' | 'revert'; atMs: number }
  | { kind: 'tierDrop'; reason: 'pinned' | 'benchmark'; atMs: number; median?: number };

export interface BenchmarkResult { median: number; n: number; targetMs: number; dropped: boolean; atMs: number }

type DynResQuality = Pick<QualitySettings, 'tier' | 'targetFrameMs' | 'renderScaleInit' | 'renderScaleMin' | 'renderScaleMax'>;

const NONE: DynResAction = { kind: 'none' };

/** RENDER_SCALE_STEPS clamped to [min, max], de-duplicated and sorted; the tier's init scale is always a member. */
export function scaleStepsFor(q: Pick<QualitySettings, 'renderScaleInit' | 'renderScaleMin' | 'renderScaleMax'>): number[] {
  const set = new Set<number>();
  for (const s of RENDER_SCALE_STEPS) set.add(Math.min(q.renderScaleMax, Math.max(q.renderScaleMin, s)));
  set.add(Math.min(q.renderScaleMax, Math.max(q.renderScaleMin, q.renderScaleInit)));
  return [...set].sort((a, b) => a - b);
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
}

/**
 * §7.3 controller. Feed one update() per frame:
 *  - dtMs: the rAF delta (drives the clock; also the measurement when gpuSamples is null),
 *  - gpuSamples: GPU timer results (ms) that arrived this frame, possibly empty; null = no timer query (rAF mode),
 *  - benchmarking: true during the shot-1 benchmark window. Samples are collected; scale steps and tier drops are
 *    frozen while it is true. On the true -> false edge the median rule may return a tierDrop.
 * The caller applies the returned action: 'scale' -> renderScale = action.scale; 'tierDrop' -> switch to the next
 * lower tier and call setQuality() with its preset. A tierDrop is never returned for the 'low' tier.
 */
export class DynamicResolution {
  private q!: DynResQuality;
  private stepList: number[] = [];
  private idx = 0;
  private clock = 0;
  private emaMs: number | null = null;
  private timerMode: boolean | null = null;
  private downCount = 0;
  private upCount = 0;
  private lastChangeAt = 0;
  private lastUp: { at: number; fromIdx: number } | null = null;
  private upBanUntil = -Infinity;
  private pinnedSince: number | null = null;
  private wasBenchmarking = false;
  private bench: number[] = [];
  /** Last completed benchmark (null until one finishes). */
  lastBenchmark: BenchmarkResult | null = null;

  constructor(q: DynResQuality) {
    this.setQuality(q);
  }

  /**
   * Tier change (benchmark, pinned, or a manual setTier): steps re-derived, scale := new init, counters cleared.
   * The change counts as a scale change for the 2 s rule. The EMA is kept (it adapts within a few frames).
   */
  setQuality(q: DynResQuality): void {
    this.q = { tier: q.tier, targetFrameMs: q.targetFrameMs, renderScaleInit: q.renderScaleInit, renderScaleMin: q.renderScaleMin, renderScaleMax: q.renderScaleMax };
    this.stepList = scaleStepsFor(q);
    const init = Math.min(q.renderScaleMax, Math.max(q.renderScaleMin, q.renderScaleInit));
    this.idx = Math.max(0, this.stepList.indexOf(init));
    this.downCount = 0;
    this.upCount = 0;
    this.lastChangeAt = this.clock;
    this.lastUp = null;
    this.upBanUntil = -Infinity;
    this.pinnedSince = null;
    this.bench = [];
  }

  get scale(): number { return this.stepList[this.idx]; }
  get steps(): readonly number[] { return this.stepList; }
  get tier() { return this.q.tier; }
  get targetMs(): number { return this.q.targetFrameMs; }
  /** EMA of the measured frame cost (GPU ms in timer mode, rAF delta otherwise); null before the first sample. */
  get ema(): number | null { return this.emaMs; }
  /** Accumulated (clamped) frame time in ms since construction. */
  get clockMs(): number { return this.clock; }
  get usingTimer(): boolean { return this.timerMode === true; }
  get upBanned(): boolean { return this.clock < this.upBanUntil; }
  get pinned(): boolean { return this.pinnedSince !== null; }

  update(dtMs: number, gpuSamples: readonly number[] | null, benchmarking: boolean): DynResAction {
    const dt = Number.isFinite(dtMs) ? Math.min(MAX_DT_MS, Math.max(0, dtMs)) : 0;
    this.clock += dt;
    const timer = gpuSamples !== null;
    if (timer !== this.timerMode) {
      // The measured quantity changed (timer appeared / went stale): restart the average and the run counters.
      this.timerMode = timer;
      this.emaMs = null;
      this.downCount = 0;
      this.upCount = 0;
    }

    // ---- measurement
    if (timer) {
      for (const g of gpuSamples!) this.sample(g, benchmarking);
    } else if (dt > 0) {
      this.sample(dt, benchmarking);
    }

    // ---- benchmark edge (frames 30-120 of shot 1)
    let result: DynResAction = NONE;
    if (this.wasBenchmarking && !benchmarking) result = this.finishBenchmark();
    this.wasBenchmarking = benchmarking;
    if (result.kind !== 'none') return result;

    if (this.emaMs === null) return NONE;
    const target = this.q.targetFrameMs;
    const over = this.emaMs > DOWN_RATIO * target;
    this.downCount = over ? this.downCount + 1 : 0;
    const fast = timer ? this.emaMs < UP_RATIO * target : dt > 0 && dt <= UP_DT_RAF_MS;
    this.upCount = fast ? this.upCount + 1 : 0;

    // pinned = at the tier minimum while still over budget
    if (this.idx === 0 && over) {
      if (this.pinnedSince === null) this.pinnedSince = this.clock;
    } else {
      this.pinnedSince = null;
    }

    if (benchmarking) return NONE;

    if (this.pinnedSince !== null && this.clock - this.pinnedSince >= PINNED_MS && this.q.tier !== 'low') {
      this.pinnedSince = null;
      return { kind: 'tierDrop', reason: 'pinned', atMs: this.clock };
    }

    if (this.downCount >= DOWN_FRAMES && this.idx > 0) {
      const from = this.scale;
      if (this.lastUp !== null && this.clock - this.lastUp.at < REVERT_WINDOW_MS) {
        // The last up-step caused this down-step: revert it (exempt from the 2 s gap) and ban up-steps for 10 s.
        this.idx = this.lastUp.fromIdx;
        this.upBanUntil = this.clock + UP_BAN_MS;
        this.markChange();
        return { kind: 'scale', scale: this.scale, from, reason: 'revert', atMs: this.clock };
      }
      if (this.clock - this.lastChangeAt >= CHANGE_GAP_MS) {
        this.idx--;
        this.markChange();
        return { kind: 'scale', scale: this.scale, from, reason: 'down', atMs: this.clock };
      }
    }

    const upFrames = timer ? UP_FRAMES_TIMER : UP_FRAMES_RAF;
    if (
      this.upCount >= upFrames && this.idx < this.stepList.length - 1 &&
      this.clock >= this.upBanUntil && this.clock - this.lastChangeAt >= CHANGE_GAP_MS
    ) {
      const from = this.scale;
      const fromIdx = this.idx;
      this.idx++;
      this.markChange();
      this.lastUp = { at: this.clock, fromIdx };
      return { kind: 'scale', scale: this.scale, from, reason: 'up', atMs: this.clock };
    }
    return NONE;
  }

  private sample(ms: number, benchmarking: boolean): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    const s = Math.min(ms, MAX_DT_MS);
    this.emaMs = this.emaMs === null ? s : this.emaMs + EMA_ALPHA * (s - this.emaMs);
    if (benchmarking) this.bench.push(s);
  }

  private markChange(): void {
    this.lastChangeAt = this.clock;
    this.downCount = 0;
    this.upCount = 0;
    this.lastUp = null;
    this.pinnedSince = null;
  }

  private finishBenchmark(): DynResAction {
    const n = this.bench.length;
    if (n === 0) return NONE;
    const med = median(this.bench);
    this.bench = [];
    const targetMs = this.q.targetFrameMs;
    const dropped = med > BENCH_RATIO * targetMs && this.q.tier !== 'low';
    this.lastBenchmark = { median: med, n, targetMs, dropped, atMs: this.clock };
    return dropped ? { kind: 'tierDrop', reason: 'benchmark', atMs: this.clock, median: med } : NONE;
  }
}
