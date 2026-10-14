// M10: world assembly, Multi-Punctum Provençal Suite orchestration, and the per-frame loop (§4.10).
import { Group, Scene, Vector2, Vector3, type Material, type PerspectiveCamera } from 'three';
import {
  CANVAS_ASPECT, LOOP_SECONDS, type DirectorFrame, type Engine, type PostFrame, type QualitySettings, type SharedUniforms,
  type Tier, type UnderlayMaterialFactory, type World,
} from '../contracts';
import { createEngine } from '../engine/engine';
import { StrokeBuffer, buildStrokeLayer, makeUnderlayMaterial } from '../strokes/strokeBuffer';
import { createBackdrop, setBackdropQuality } from '../sky/backdrop';
import { createDust } from '../sky/dust';
import { Director, type DirectorFrameEx } from '../camera/director';
import { createPost } from '../post/post';
import { canvasPoseFovDeg, canvasToWorld, EYE, FORWARD, galleryLightDir } from '../shared/canvasSpace';
import { srgbHexToLinear } from '../shared/palette';
import { forkRng } from '../shared/rng';
import { createSharedUniforms } from '../shared/uniforms';
import { getPaintingSpec, nextPaintingId, PAINTING_SUITE } from '../chapters/suite';
import type { PaintingId } from '../chapters/types';
import { StormController } from './storm';
import { assertPaintOrder, runInvarianceSelfTest } from './selfTest';
import { DebugOverlay } from './debugOverlay';

export interface BuiltWorld extends World {
  buffer: StrokeBuffer;
  timings: Record<string, number>;
  paintingId: PaintingId;
}

export function buildWorld(
  u: SharedUniforms,
  q: QualitySettings,
  seed: number,
  paintingId: PaintingId = 'starry',
): BuiltWorld {
  const spec = getPaintingSpec(paintingId);
  const buffer = new StrokeBuffer(200_000);
  const materials = new Map<string, Material>();
  const mat: UnderlayMaterialFactory = (hex, opts) => {
    const key = `${hex}:${opts?.vertexFade ? 'fade' : ''}`;
    let m = materials.get(key);
    if (!m) materials.set(key, (m = makeUnderlayMaterial(hex, u, undefined, opts)));
    return m;
  };

  const { underlays, village, timings } = spec.generate(buffer, seed, mat, u, q);

  const violations = assertPaintOrder(buffer);
  if (violations.length) console.warn(`[punctum:${paintingId}] paint order: ${violations.length} violation(s)\n  ${violations.join('\n  ')}`);

  const tUp = performance.now();
  const strokes = buildStrokeLayer(buffer, u, q);
  timings.upload = Math.round((performance.now() - tUp) * 10) / 10;

  const scene = new Scene();
  const backdrop = createBackdrop(u, q);
  const dust = createDust(u, q, forkRng(seed, `dust:${paintingId}`));
  scene.add(backdrop, strokes.group, underlays, dust);
  timings.strokes = buffer.count;
  return { scene, strokes, backdrop, dust, underlays, village, buffer, timings, paintingId };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Flags {
  t?: number;
  boot?: number;
  tier?: Tier;
  free: boolean;
  overlay: boolean;
  seed: number;
  calm: boolean;
  freeze: boolean;
  hud: boolean;
  painting: PaintingId;
  odyssey: boolean;
}

function readFlags(): Flags {
  const p = new URLSearchParams(location.search);
  const num = (k: string) => (p.has(k) && p.get(k) !== '' && Number.isFinite(Number(p.get(k))) ? Number(p.get(k)) : undefined);
  const tierRaw = p.get('tier');
  const paintRaw = p.get('painting')?.toLowerCase();
  const validPaint = paintRaw === 'cafe' || paintRaw === 'rhone' || paintRaw === 'starry' || paintRaw === 'wheat'
    ? paintRaw
    : undefined;
  let calmStored = false;
  try { calmStored = localStorage.getItem('punctum.calm') === '1'; } catch { /* storage blocked */ }
  const isHarnessPin = num('t') !== undefined || p.has('freeze') || p.has('overlay');
  const odysseyParam = p.get('odyssey');
  const odyssey = odysseyParam === '0' ? false : odysseyParam === '1' ? true : !isHarnessPin;
  return {
    t: num('t'),
    boot: num('boot'),
    tier: tierRaw === 'high' || tierRaw === 'medium' || tierRaw === 'low' ? tierRaw : undefined,
    free: p.has('free'),
    overlay: p.has('overlay'),
    seed: num('seed') ?? 1889,
    calm: p.has('calm') || calmStored || matchMedia('(prefers-reduced-motion: reduce)').matches,
    freeze: p.has('freeze'),
    hud: p.has('hud'),
    painting: validPaint ?? (odysseyParam === '1' ? 'cafe' : 'starry'),
    odyssey,
  };
}

function canvasRect(w: number, h: number, aspect = CANVAS_ASPECT): [number, number, number, number] {
  if (w / h >= aspect) {
    const cw = h * aspect;
    return [(w - cw) / 2, 0, cw, h];
  }
  const ch = w / aspect;
  return [0, (h - ch) / 2, w, ch];
}

function applyPaintingAtmosphere(u: SharedUniforms, id: PaintingId): void {
  const spec = getPaintingSpec(id);
  const fn = srgbHexToLinear(spec.fogNearHex);
  const ff = srgbHexToLinear(spec.fogFarHex);
  u.uFogNear.value.set(fn[0], fn[1], fn[2]);
  u.uFogFar.value.set(ff[0], ff[1], ff[2]);
  u.uSkyMode.value = spec.skyMode;
  const [mu, mv, md] = spec.moonUVD;
  canvasToWorld(mu, mv, md, u.uMoonPos.value);
}

const camF = new Vector3();
function derivedUniforms(
  u: SharedUniforms,
  f: DirectorFrame,
  camera: PerspectiveCamera,
  viewportH: number,
  canvasAspect = CANVAS_ASPECT,
): void {
  const t = (f as DirectorFrameEx).animTime ?? f.loopTime;
  u.uTime.value = ((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  const dist = camera.position.distanceTo(EYE);
  u.uOff.value = smoothstep(0.5, 40, dist);
  camera.getWorldDirection(camF);
  const fovCanvas = canvasPoseFovDeg(camera.aspect, canvasAspect);
  u.uAlign.value = (1 - smoothstep(0.05, 3, dist)) * smoothstep(0.999, 0.99995, camF.dot(FORWARD)) * (1 - smoothstep(0.2, 2.0, Math.abs(camera.fov - fovCanvas)));
  u.uPxPerRad.value = viewportH / (2 * Math.tan((camera.fov * Math.PI) / 360));
  u.uViewportH.value = viewportH;
  u.uCamVel.value.set(f.camVelocity[0], f.camVelocity[1], f.camVelocity[2]);
  u.uWarpK.value = f.warpK;
  if (f.stir) u.uStir.value.set(f.stir[0], f.stir[1], f.stir[2], f.stir[3]);
  else u.uStir.value.z = 0;
  const boot = f.firstBoot ? f.bootSeconds : Infinity;
  u.uLayIn.value = boot < 4 ? boot : -1;
  u.uInflate.value = Math.min(10, boot - 1.2);
  u.uImpastoGain.value = f.env.impastoGain;
  galleryLightDir(f.env.galleryLightDeg, u.uGalleryLight.value);
  u.uDustAlpha.value = f.env.dust;
}

const TRANS_UP = 0.65;
const TRANS_DOWN = 0.95;

export async function boot(container: HTMLElement): Promise<void> {
  const flags = readFlags();
  let engine: Engine;
  try {
    engine = createEngine(container, { tier: flags.tier });
  } catch (e) {
    container.innerHTML = '<p class="fallback">This piece needs WebGL 2. Try a current desktop browser with hardware acceleration on.</p>';
    throw e;
  }
  const u = createSharedUniforms();
  let activeId: PaintingId = flags.painting;
  let odyssey = flags.odyssey;
  applyPaintingAtmosphere(u, activeId);

  const worldCache = new Map<PaintingId, BuiltWorld>();
  const getOrBuildWorld = (id: PaintingId): BuiltWorld => {
    let w = worldCache.get(id);
    if (!w) {
      const tb = performance.now();
      w = buildWorld(u, engine.quality, flags.seed, id);
      const self = runInvarianceSelfTest(w.buffer);
      if (!self.ok) console.error(`[punctum:${id}] invariance self-test failed: max canvas error ${self.maxErr.toExponential(2)}`);
      engine.renderer.compile(w.scene, engine.camera);
      worldCache.set(id, w);
      console.info(`[punctum:${id}] ${w.buffer.count} strokes, tier ${engine.quality.tier}, build ${Math.round(performance.now() - tb)} ms`, w.timings, `self-test ${self.maxErr.toExponential(1)}`);
    }
    return w;
  };

  let world = getOrBuildWorld(activeId);
  const post = createPost(engine.renderer, u, engine.quality);
  const initialSpec = getPaintingSpec(activeId);
  const director = new Director(engine.camera, engine.canvas, {
    calm: flags.calm,
    startTime: flags.t,
    free: flags.free,
    firstBoot: flags.t === undefined,
    track: initialSpec.track,
  });
  const storm = new StormController();
  const overlay = flags.overlay ? new DebugOverlay(container) : null;

  // Transition state for Storm-Snap Morph between Van Gogh paintings
  let transPhase: 0 | 1 | 2 = 0;
  let transT = 0;
  let transTarget: PaintingId = activeId;
  let fromAspect = initialSpec.aspect;
  let displayAspect = initialSpec.aspect;
  let snapHold = 0;

  const triggerTransition = (targetId: PaintingId) => {
    if (targetId === activeId && transPhase === 0) {
      director.jumpToShot(0);
      director.ui?.setSuiteState(activeId, odyssey, true);
      return;
    }
    transTarget = targetId;
    fromAspect = displayAspect;
    if (transPhase === 0) {
      transPhase = 1;
      transT = 0;
    } else if (transPhase === 2) {
      transPhase = 1;
      transT = (1 - transT / TRANS_DOWN) * TRANS_UP;
    }
  };

  const toggleOdyssey = () => {
    odyssey = !odyssey;
    director.ui?.setSuiteState(activeId, odyssey, false);
  };

  const isHarnessPin = flags.t !== undefined || flags.freeze || flags.overlay;
  director.ui?.wireSuite({
    active: activeId,
    odyssey,
    showBar: !isHarnessPin,
    onSelect: (id) => triggerTransition(id),
    onToggleOdyssey: toggleOdyssey,
  });

  // Keyboard shortcuts for Multi-Punctum navigation: [ / ] (prev/next painting), O (toggle Odyssey)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === '[' || e.key === 'PageUp') {
      e.preventDefault();
      triggerTransition(nextPaintingId(activeId, -1));
    } else if (e.key === ']' || e.key === 'PageDown') {
      e.preventDefault();
      triggerTransition(nextPaintingId(activeId, 1));
    } else if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      toggleOdyssey();
    }
  });

  const resize = (cssW: number, cssH: number, pr: number) => {
    post.setSize(cssW, cssH, pr);
  };
  engine.onResize(resize);
  resize(engine.cssWidth, engine.cssHeight, engine.pixelRatio);
  engine.onQualityChange((q) => {
    for (const w of worldCache.values()) {
      w.strokes.setQuality(q);
      setBackdropQuality(w.backdrop, q);
      w.dust.geometry.setDrawRange(0, q.dustCount);
    }
    post.setQuality(q);
  });

  const bufSize = new Vector2();
  let last = performance.now();
  let frames = 0;
  let shotFrames = 0;
  const debug = {
    engine,
    director,
    get world() { return world; },
    uniforms: u,
    post,
    storm,
    suite: PAINTING_SUITE,
    switchPainting: triggerTransition,
    frames: () => frames,
  };
  (window as unknown as { __punctum: typeof debug }).__punctum = debug;

  const frame = (now: number) => {
    const dtMs = Math.min(100, now - last);
    last = now;
    if (frames === 0 && flags.boot) for (let k = 0; k < Math.round(flags.boot / 0.1) - 1; k++) director.update(0.1);
    const dt = flags.freeze ? (frames === 0 && flags.boot ? 0.1 : 0) : dtMs / 1000;
    engine.beginFrame();
    const f = director.update(dt);

    // Odyssey auto-advance at the end of a painting's cinematic take
    if (odyssey && f.wrapped && f.mode === 'cinematic' && transPhase === 0 && !flags.freeze) {
      triggerTransition(nextPaintingId(activeId, 1));
    }

    // Advance Storm-Snap Morph transition between paintings
    let transFade = 0;
    let transScatter = 0;
    let transSmear = 0;
    if (transPhase === 1) {
      transT += dt;
      const p = Math.min(1, transT / TRANS_UP);
      const s = smoothstep(0, 1, p);
      transFade = s * 0.92;
      transScatter = s * 1.1;
      transSmear = flags.calm ? 0 : s * 0.65;
      displayAspect = fromAspect + (getPaintingSpec(transTarget).aspect - fromAspect) * (0.5 * s);
      if (transT >= TRANS_UP) {
        activeId = transTarget;
        const spec = getPaintingSpec(activeId);
        world = getOrBuildWorld(activeId);
        applyPaintingAtmosphere(u, activeId);
        director.setTrack(spec.track, 0, true);
        director.ui?.setSuiteState(activeId, odyssey, true);
        displayAspect = spec.aspect;
        // Arm the Snap Ripple so the new painting's strokes crystallize into registration at E
        u.uSnapTime.value = u.uTime.value;
        u.uScatterAtSnap.value = 0.95;
        snapHold = 2.6;
        transPhase = 2;
        transT = 0;
      }
    } else if (transPhase === 2) {
      transT += dt;
      const p = Math.min(1, transT / TRANS_DOWN);
      const s = 1 - smoothstep(0, 1, p);
      transFade = s * 0.92;
      transSmear = flags.calm ? 0 : s * 0.45;
      displayAspect = getPaintingSpec(activeId).aspect;
      if (transT >= TRANS_DOWN) {
        transPhase = 0;
        transT = 0;
      }
    }

    engine.renderer.getDrawingBufferSize(bufSize);
    const bufW = bufSize.x;
    const bufH = bufSize.y;
    derivedUniforms(u, f, engine.camera, bufH, displayAspect);
    storm.update(f, engine.camera.position, dt, u, world.strokes);

    if (transScatter > 0) {
      u.uScatter.value = Math.max(u.uScatter.value, transScatter);
      world.strokes.setCullInflation(0.05);
    }
    if (snapHold > 0) {
      snapHold = Math.max(0, snapHold - dt);
      if (u.uSnapTime.value < 0) {
        u.uSnapTime.value = Math.max(0, u.uTime.value - (2.6 - snapHold));
        u.uScatterAtSnap.value = 0.95;
      }
      world.strokes.setCullInflation(0.05);
    }

    const warped = f.warpK !== 1;
    world.strokes.setCullingEnabled(!warped);
    world.underlays.visible = !warped;
    const matte = f.mode === 'free' ? u.uAlign.value : f.env.matte;
    const pf: PostFrame = {
      bloom: f.env.bloom,
      exposure: f.env.exposure,
      matte,
      align: u.uAlign.value,
      smear: Math.max(f.env.smear, transSmear),
      fade: Math.max(f.env.fade, transFade),
      time: u.uTime.value,
      canvasRectPx: canvasRect(bufW, bufH, displayAspect),
    };
    post.render(world.scene, engine.camera, pf);
    engine.endFrame();
    shotFrames = f.shot === 0 && f.mode === 'cinematic' ? shotFrames + 1 : 0;
    engine.updateDynamicResolution(dtMs, shotFrames >= 30 && shotFrames <= 120);
    if (f.hud || flags.hud) {
      const s = engine.stats;
      const spec = getPaintingSpec(activeId);
      director.setHudText(`${spec.roman} ${spec.titleZh} · ${s.fps.toFixed(0)} fps · ${s.frameMs.toFixed(1)} ms${s.gpuMs !== null ? ` (gpu ${s.gpuMs.toFixed(1)})` : ''} · ${engine.quality.tier} · scale ${engine.renderScale.toFixed(2)} · t ${f.loopTime.toFixed(1)} s · ${f.mode}`);
    }
    overlay?.draw(engine.camera);
    frames++;
    if (frames === 3) (window as unknown as { __ready: boolean }).__ready = true;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
