// M1 engine: renderer bootstrap (§2.5, §6 step 1), quality tiers and dynamic resolution (§7.3).
// Sandbox-safe (§8 risk 13): no workers, blob URLs, fetches, storage, pointer lock or fullscreen.
import { NeutralToneMapping, PerspectiveCamera, SRGBColorSpace, WebGLRenderer } from 'three';
import { CAMERA_FAR, CAMERA_NEAR, VFOV_DEG, type Engine, type QualitySettings, type Tier } from '../contracts';
import { DynamicResolution, type DynResAction } from './dynamicRes';
import { detectTier, lowerTier, qualityForTier, rendererString } from './tiers';

/** EXT_disjoint_timer_query_webgl2 (not in lib.dom). */
interface TimerQueryExt { readonly TIME_ELAPSED_EXT: number; readonly GPU_DISJOINT_EXT: number }

/** The Engine contract plus read-only diagnostics for the HUD and harnesses. */
export interface EngineInternals extends Engine {
  /** True when EXT_disjoint_timer_query_webgl2 is present and has delivered samples recently. */
  readonly gpuTimerActive: boolean;
  /** UNMASKED_RENDERER_WEBGL (or RENDERER when masked). */
  readonly rendererName: string;
  /** The tier detectTier() chose at boot (before any override, benchmark or pinned drop). */
  readonly detectedTier: Tier;
  readonly dynamicResolution: DynamicResolution;
  /** Every non-'none' dynamic-resolution action so far, oldest first (bounded to the last 64). */
  readonly actionLog: readonly DynResAction[];
}

const MAX_PENDING_QUERIES = 4;
/** Timer mode falls back to rAF deltas after this many frames without a GPU sample (disjoint storms, no brackets). */
const TIMER_STALE_FRAMES = 180;
const STATS_ALPHA = 0.1;

export function createEngine(container: HTMLElement, opts: { tier?: Tier } = {}): EngineInternals {
  const renderer = new WebGLRenderer({
    antialias: false,
    logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
    alpha: false,
    stencil: false,
    depth: true,
  });
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const canvas = renderer.domElement;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  // three r186 always requests a context with alpha: true and maps `alpha: false` to clear alpha 1. An opaque
  // element background keeps the canvas visually opaque even if a pass writes alpha < 1.
  canvas.style.backgroundColor = '#000';
  container.appendChild(canvas);

  const camera = new PerspectiveCamera(VFOV_DEG, 1, CAMERA_NEAR, CAMERA_FAR);

  const rendererName = rendererString(renderer);
  const detectedTier = detectTier(renderer);
  let quality: QualitySettings = qualityForTier(opts.tier ?? detectedTier);
  let renderScale = quality.renderScaleInit;
  const dynres = new DynamicResolution(quality);

  const resizeCbs: ((w: number, h: number, pr: number) => void)[] = [];
  const qualityCbs: ((q: QualitySettings) => void)[] = [];
  const actionLog: DynResAction[] = [];

  // ---------------------------------------------------------------- sizing
  let cssW = 1;
  let cssH = 1;
  let pixelRatio = 1;
  let applied: [number, number, number] | null = null;

  const measure = (): [number, number] => {
    let w = container.clientWidth;
    let h = container.clientHeight;
    if (!(w > 0 && h > 0)) {
      const r = container.getBoundingClientRect();
      w = r.width;
      h = r.height;
    }
    if (!(w > 0 && h > 0)) {
      w = window.innerWidth;
      h = window.innerHeight;
    }
    return [Math.max(1, Math.round(w)), Math.max(1, Math.round(h))];
  };

  /** Push cssW/cssH/renderScale into the renderer and camera; returns false when nothing changed (unless forced). */
  const pushSize = (force: boolean): boolean => {
    const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    pixelRatio = Math.min(dpr, quality.maxPixelRatio) * renderScale;
    if (!force && applied && applied[0] === cssW && applied[1] === cssH && applied[2] === pixelRatio) return false;
    applied = [cssW, cssH, pixelRatio];
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(cssW, cssH, false);
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
    return true;
  };
  const fireResize = (): void => {
    for (const cb of resizeCbs) cb(cssW, cssH, pixelRatio);
  };
  const applySize = (force: boolean): void => {
    if (pushSize(force)) fireResize();
  };

  [cssW, cssH] = measure();
  applySize(true);

  let disposed = false;
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver((entries) => {
      if (disposed) return;
      const e = entries[entries.length - 1];
      const box = e.contentBoxSize?.[0];
      const w = box ? box.inlineSize : e.contentRect.width;
      const h = box ? box.blockSize : e.contentRect.height;
      if (!(w > 0 && h > 0)) return; // hidden container: keep the last size
      cssW = Math.max(1, Math.round(w));
      cssH = Math.max(1, Math.round(h));
      applySize(false);
    })
    : null;
  ro?.observe(container);
  const onWindowResize = () => {
    if (disposed) return;
    [cssW, cssH] = measure();
    applySize(false);
  };
  if (!ro) window.addEventListener('resize', onWindowResize);

  // devicePixelRatio changes (window dragged to another monitor, browser zoom) do not fire ResizeObserver.
  let dprQuery: MediaQueryList | null = null;
  const onDprChange = () => {
    if (disposed) return;
    watchDpr();
    applySize(false);
  };
  const watchDpr = () => {
    dprQuery?.removeEventListener('change', onDprChange);
    dprQuery = typeof window.matchMedia === 'function' ? window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`) : null;
    dprQuery?.addEventListener('change', onDprChange);
  };
  watchDpr();

  // ---------------------------------------------------------------- tiers
  const applyTier = (tier: Tier): void => {
    quality = qualityForTier(tier);
    renderScale = quality.renderScaleInit;
    dynres.setQuality(quality);
    pushSize(true);
    for (const cb of qualityCbs) cb(quality);
    fireResize();
  };

  // ---------------------------------------------------------------- GPU timer (EXT_disjoint_timer_query_webgl2)
  const gl = renderer.getContext() as WebGL2RenderingContext;
  let timerExt: TimerQueryExt | null = null;
  try {
    timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExt | null;
  } catch {
    timerExt = null;
  }
  let activeQuery: WebGLQuery | null = null;
  const pending: WebGLQuery[] = [];
  const freeQueries: WebGLQuery[] = [];
  const gpuInbox: number[] = [];
  let framesWithoutGpu = 0;
  let contextLost = false;

  const releaseQuery = (q: WebGLQuery) => {
    if (freeQueries.length < MAX_PENDING_QUERIES + 1) freeQueries.push(q);
    else gl.deleteQuery(q);
  };

  /** Non-blocking: read finished queries oldest-first; a disjoint event invalidates everything in flight. */
  const pollQueries = (): void => {
    if (!timerExt || contextLost) return;
    while (pending.length > 0) {
      const q = pending[0];
      const available = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) as boolean;
      const disjoint = gl.getParameter(timerExt.GPU_DISJOINT_EXT) as boolean;
      if (disjoint) {
        for (const p of pending) releaseQuery(p);
        pending.length = 0;
        return;
      }
      if (!available) return;
      pending.shift();
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      releaseQuery(q);
      if (Number.isFinite(ns) && ns > 0) gpuInbox.push(ns / 1e6);
    }
  };

  const onContextLost = (e: Event) => {
    e.preventDefault(); // allow restoration; three re-initialises its own state
    contextLost = true;
    activeQuery = null;
    pending.length = 0;
    freeQueries.length = 0;
    gpuInbox.length = 0;
  };
  const onContextRestored = () => {
    contextLost = false;
    try {
      timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExt | null;
    } catch {
      timerExt = null;
    }
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  // ---------------------------------------------------------------- stats
  const stats: { fps: number; frameMs: number; gpuMs: number | null } = { fps: 0, frameMs: 0, gpuMs: null };

  const engine: EngineInternals = {
    renderer,
    camera,
    canvas,
    get quality() { return quality; },
    get renderScale() { return renderScale; },
    get cssWidth() { return cssW; },
    get cssHeight() { return cssH; },
    get pixelRatio() { return pixelRatio; },
    get gpuTimerActive() { return timerExt !== null && !contextLost && framesWithoutGpu < TIMER_STALE_FRAMES; },
    rendererName,
    detectedTier,
    dynamicResolution: dynres,
    actionLog,
    stats,

    onResize(cb) {
      resizeCbs.push(cb);
    },
    onQualityChange(cb) {
      qualityCbs.push(cb);
    },
    setTier(tier) {
      applyTier(tier);
    },

    beginFrame() {
      if (!timerExt || contextLost) return;
      pollQueries();
      if (activeQuery || pending.length >= MAX_PENDING_QUERIES) return;
      const q = freeQueries.pop() ?? gl.createQuery();
      if (!q) return;
      gl.beginQuery(timerExt.TIME_ELAPSED_EXT, q);
      activeQuery = q;
    },
    endFrame() {
      if (!timerExt || !activeQuery || contextLost) return;
      gl.endQuery(timerExt.TIME_ELAPSED_EXT);
      pending.push(activeQuery);
      activeQuery = null;
    },

    updateDynamicResolution(dtMs, benchmarking) {
      if (disposed) return;
      // stats: EMA of the rAF delta; GPU EMA from whatever timer results arrived
      if (Number.isFinite(dtMs) && dtMs > 0) {
        const dt = Math.min(dtMs, 1000);
        stats.frameMs = stats.frameMs > 0 ? stats.frameMs + STATS_ALPHA * (dt - stats.frameMs) : dt;
        stats.fps = 1000 / stats.frameMs;
      }
      for (const g of gpuInbox) stats.gpuMs = stats.gpuMs === null ? g : stats.gpuMs + STATS_ALPHA * (g - stats.gpuMs);
      framesWithoutGpu = gpuInbox.length > 0 ? 0 : framesWithoutGpu + 1;
      const timerOn = timerExt !== null && !contextLost && framesWithoutGpu < TIMER_STALE_FRAMES;
      const action = dynres.update(dtMs, timerOn ? gpuInbox.slice() : null, benchmarking);
      gpuInbox.length = 0;
      if (action.kind === 'none') return;
      actionLog.push(action);
      if (actionLog.length > 64) actionLog.shift();
      if (action.kind === 'scale') {
        renderScale = action.scale;
        applySize(false);
      } else {
        const next = lowerTier(quality.tier);
        if (next) applyTier(next);
      }
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      ro?.disconnect();
      if (!ro) window.removeEventListener('resize', onWindowResize);
      dprQuery?.removeEventListener('change', onDprChange);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (!contextLost) {
        if (activeQuery && timerExt) gl.endQuery(timerExt.TIME_ELAPSED_EXT);
        for (const q of [...pending, ...freeQueries]) gl.deleteQuery(q);
        if (activeQuery) gl.deleteQuery(activeQuery);
      }
      activeQuery = null;
      pending.length = 0;
      freeQueries.length = 0;
      resizeCbs.length = 0;
      qualityCbs.length = 0;
      renderer.dispose();
      canvas.remove();
    },
  };
  return engine;
}
