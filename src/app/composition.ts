// M10: world assembly, Van Gogh World System orchestration (5 Chapters, 10 Worlds, Dynamic Path Compiler,
// 3 Viewing Modes: Odyssey / Theme Path / Atlas), dual-world 3D brushstroke cross-dissolve, and per-frame loop (§4.10).
import { Scene, Vector2, Vector3, type Material, type PerspectiveCamera } from 'three';
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
import {
  compilePathTrack, DEFAULT_ODYSSEY_SEQUENCE, evalOdysseyMorph, getPaintingActStart, getPaintingSpec,
  nextPaintingId, PAINTING_SUITE,
} from '../chapters/suite';
import { getThemePathSpec, WORLD_GRAPH } from '../chapters/worldGraph';
import type { PaintingId, ViewMode } from '../chapters/types';
import { StormController } from './storm';
import { assertPaintOrder, runInvarianceSelfTest } from './selfTest';
import { DebugOverlay } from './debugOverlay';
import { SoundscapeEngine } from '../audio/soundscape';

export interface BuiltWorld extends World {
  buffer: StrokeBuffer;
  timings: Record<string, number>;
  paintingId: PaintingId;
  layerUniforms: SharedUniforms;
}

/** Create a per-painting uniform dictionary that shares camera/atmosphere refs with `u` but has independent layer morph controls. */
function createLayerUniforms(u: SharedUniforms): SharedUniforms {
  return {
    ...u,
    uScatter: { value: 0 },
    uSnapTime: { value: -1 },
    uScatterAtSnap: { value: 0 },
    uLayIn: { value: -1 },
    uLayerFade: { value: 1 },
  };
}

export function buildWorld(
  u: SharedUniforms,
  q: QualitySettings,
  seed: number,
  paintingId: PaintingId = 'starry',
): BuiltWorld {
  const spec = getPaintingSpec(paintingId);
  const layerUniforms = createLayerUniforms(u);
  const buffer = new StrokeBuffer(200_000);
  const materials = new Map<string, Material>();
  const mat: UnderlayMaterialFactory = (hex, opts) => {
    const key = `${hex}:${opts?.vertexFade ? 'fade' : ''}`;
    let m = materials.get(key);
    if (!m) materials.set(key, (m = makeUnderlayMaterial(hex, layerUniforms, undefined, opts)));
    return m;
  };

  const { underlays, village, timings } = spec.generate(buffer, seed, mat, layerUniforms, q);

  const violations = assertPaintOrder(buffer);
  if (violations.length) console.warn(`[punctum:${paintingId}] paint order: ${violations.length} violation(s)\n  ${violations.join('\n  ')}`);

  const tUp = performance.now();
  const strokes = buildStrokeLayer(buffer, layerUniforms, q);
  timings.upload = Math.round((performance.now() - tUp) * 10) / 10;

  const scene = new Scene();
  const backdrop = createBackdrop(u, q);
  const dust = createDust(u, q, forkRng(seed, `dust:${paintingId}`));
  scene.add(backdrop, strokes.group, underlays, dust);
  timings.strokes = buffer.count;
  return { scene, strokes, backdrop, dust, underlays, village, buffer, timings, paintingId, layerUniforms };
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
  mode: ViewMode;
  pathId: string;
}

function readFlags(): Flags {
  const p = new URLSearchParams(location.search);
  const num = (k: string) => (p.has(k) && p.get(k) !== '' && Number.isFinite(Number(p.get(k))) ? Number(p.get(k)) : undefined);
  const tierRaw = p.get('tier');
  const paintRaw = p.get('painting')?.toLowerCase();
  const validPaint: PaintingId | undefined =
    paintRaw === 'potato' || paintRaw === 'shoes' || paintRaw === 'paris' || paintRaw === 'selfportrait'
    || paintRaw === 'sunflowers' || paintRaw === 'cafe' || paintRaw === 'rhone' || paintRaw === 'bedroom'
    || paintRaw === 'starry' || paintRaw === 'irises' || paintRaw === 'wheat' || paintRaw === 'almond'
    || paintRaw === 'church' || paintRaw === 'gachet' || paintRaw === 'crows'
      ? paintRaw
      : undefined;
  let calmStored = false;
  try { calmStored = localStorage.getItem('punctum.calm') === '1'; } catch { /* storage blocked */ }
  const isHarnessPin = num('t') !== undefined || p.has('freeze') || p.has('overlay');
  const odysseyParam = p.get('odyssey');
  const modeParam = p.get('mode')?.toLowerCase();
  const pathParam = p.get('path')?.toLowerCase();

  let mode: ViewMode = 'odyssey';
  let pathId = 'odyssey';

  if (odysseyParam === '0' || isHarnessPin) {
    mode = 'theme';
    pathId = 'single';
  } else if (modeParam === 'atlas') {
    mode = 'atlas';
    pathId = pathParam ?? 'odyssey';
  } else if (modeParam === 'theme' || (pathParam && pathParam !== 'odyssey')) {
    mode = 'theme';
    pathId = pathParam ?? 'nights';
  }

  const defaultPaint: PaintingId =
    pathId === 'single'
      ? 'starry'
      : getThemePathSpec(pathId).sequence[0] ?? 'potato';

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
    painting: validPaint ?? defaultPaint,
    mode,
    pathId,
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

const _moonA = new Vector3();
const _moonB = new Vector3();

/** Apply or smoothly blend atmosphere uniforms (fog near/far, sky mode, moon light pos) between two paintings. */
function applyBlendedAtmosphere(u: SharedUniforms, idA: PaintingId, idB: PaintingId | null, mix = 0): void {
  const specA = getPaintingSpec(idA);
  const fnA = srgbHexToLinear(specA.fogNearHex);
  const ffA = srgbHexToLinear(specA.fogFarHex);
  canvasToWorld(specA.moonUVD[0], specA.moonUVD[1], specA.moonUVD[2], _moonA);
  if (!idB || mix <= 0) {
    u.uFogNear.value.set(fnA[0], fnA[1], fnA[2]);
    u.uFogFar.value.set(ffA[0], ffA[1], ffA[2]);
    u.uSkyMode.value = specA.skyMode;
    u.uMoonPos.value.copy(_moonA);
    return;
  }
  const specB = getPaintingSpec(idB);
  const fnB = srgbHexToLinear(specB.fogNearHex);
  const ffB = srgbHexToLinear(specB.fogFarHex);
  canvasToWorld(specB.moonUVD[0], specB.moonUVD[1], specB.moonUVD[2], _moonB);
  u.uFogNear.value.set(
    fnA[0] + (fnB[0] - fnA[0]) * mix,
    fnA[1] + (fnB[1] - fnA[1]) * mix,
    fnA[2] + (fnB[2] - fnA[2]) * mix,
  );
  u.uFogFar.value.set(
    ffA[0] + (ffB[0] - ffA[0]) * mix,
    ffA[1] + (ffB[1] - ffA[1]) * mix,
    ffA[2] + (ffB[2] - ffA[2]) * mix,
  );
  u.uSkyMode.value = specA.skyMode + (specB.skyMode - specA.skyMode) * mix;
  u.uMoonPos.value.copy(_moonA).lerp(_moonB, mix);
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

const MANUAL_MORPH_DUR = 1.65;

interface ManualMorph {
  fromId: PaintingId;
  toId: PaintingId;
  t: number;
}

function resolveSequence(pathId: string, activeId: PaintingId): readonly PaintingId[] {
  if (pathId === 'single') return [activeId];
  return getThemePathSpec(pathId).sequence;
}

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
  let viewMode: ViewMode = flags.mode;
  let pathId: string = flags.pathId;
  let activeSequence: readonly PaintingId[] = resolveSequence(pathId, activeId);
  applyBlendedAtmosphere(u, activeId, null, 0);

  // Master scene holds shared backdrop + dust + all cached paintings' stroke & underlay groups for dual-world 3D cross-dissolve
  const masterScene = new Scene();
  const masterBackdrop = createBackdrop(u, engine.quality);
  const masterDust = createDust(u, engine.quality, forkRng(flags.seed, 'dust:master'));
  masterScene.add(masterBackdrop, masterDust);

  const MAX_CACHED_WORLDS = 4;
  const worldCache = new Map<PaintingId, BuiltWorld>();
  const getOrBuildWorld = (id: PaintingId): BuiltWorld => {
    let w = worldCache.get(id);
    if (w) {
      // Refresh LRU order
      worldCache.delete(id);
      worldCache.set(id, w);
      return w;
    }
    const tb = performance.now();
    w = buildWorld(u, engine.quality, flags.seed, id);
    const self = runInvarianceSelfTest(w.buffer);
    if (!self.ok) console.error(`[punctum:${id}] invariance self-test failed: max canvas error ${self.maxErr.toExponential(2)}`);
    w.strokes.group.visible = false;
    w.underlays.visible = false;
    masterScene.add(w.strokes.group, w.underlays);
    engine.renderer.compile(masterScene, engine.camera);
    worldCache.set(id, w);
    console.info(`[punctum:${id}] ${w.buffer.count} strokes, tier ${engine.quality.tier}, build ${Math.round(performance.now() - tb)} ms`, w.timings, `self-test ${self.maxErr.toExponential(1)}`);
    return w;
  };

  const evictExcessWorlds = (keepA: PaintingId, keepB: PaintingId | null, keepC: PaintingId | null) => {
    if (worldCache.size <= MAX_CACHED_WORLDS) return;
    for (const [id, w] of worldCache.entries()) {
      if (worldCache.size <= MAX_CACHED_WORLDS) break;
      if (id === keepA || id === keepB || id === keepC) continue;
      masterScene.remove(w.strokes.group, w.underlays);
      w.strokes.dispose?.();
      worldCache.delete(id);
    }
  };

  let world = getOrBuildWorld(activeId);
  const post = createPost(engine.renderer, u, engine.quality);
  const initialSpec = getPaintingSpec(activeId);
  const isMultiAct = () => activeSequence.length > 1;
  const initialStartTime = flags.t !== undefined
    ? flags.t
    : isMultiAct()
      ? getPaintingActStart(activeId, activeSequence)
      : 0;
  const director = new Director(engine.camera, engine.canvas, {
    calm: flags.calm,
    startTime: initialStartTime,
    free: flags.free,
    firstBoot: flags.t === undefined,
    track: isMultiAct() ? compilePathTrack(activeSequence) : initialSpec.track,
  });
  const storm = new StormController();
  const overlay = flags.overlay ? new DebugOverlay(container) : null;
  const soundscape = new SoundscapeEngine({
    onStateChange: (enabled) => director.ui?.setSoundState(enabled),
  });

  let manualMorph: ManualMorph | null = null;
  let displayAspect = initialSpec.aspect;
  let snapHoldId: PaintingId | null = null;
  let snapHoldTimer = 0;

  const syncUi = (showCard = true) => {
    director.ui?.setWorldState({
      active: activeId,
      mode: viewMode,
      pathId,
      sequence: activeSequence,
      showCard,
    });
  };

  const triggerTransition = (targetId: PaintingId) => {
    getOrBuildWorld(targetId);
    const prevId = activeId;
    activeId = targetId;

    if (pathId === 'single') {
      activeSequence = [activeId];
      director.setTrack(getPaintingSpec(targetId).track, 0, false);
    } else if (!activeSequence.includes(targetId)) {
      // Jumping to a painting outside the current theme sequence switches to the full 10-Act Odyssey sequence
      pathId = 'odyssey';
      if (viewMode === 'theme') viewMode = 'odyssey';
      activeSequence = DEFAULT_ODYSSEY_SEQUENCE;
      director.setTrack(compilePathTrack(activeSequence), getPaintingActStart(targetId, activeSequence), false);
    } else {
      director.seekTo(getPaintingActStart(targetId, activeSequence));
    }

    syncUi(true);
    soundscape.triggerSnapChord(targetId);
    if (prevId !== targetId) {
      manualMorph = { fromId: prevId, toId: targetId, t: 0 };
    } else {
      snapHoldId = targetId;
      snapHoldTimer = 2.0;
    }
  };

  const selectModeAndPath = (nextMode: ViewMode, nextPathId?: string) => {
    const resolvedPath = nextPathId ?? (nextMode === 'odyssey' ? 'odyssey' : pathId);
    const prevPath = pathId;
    viewMode = nextMode;
    pathId = resolvedPath;
    activeSequence = resolveSequence(pathId, activeId);

    if (prevPath !== pathId) {
      if (pathId === 'single') {
        director.setTrack(getPaintingSpec(activeId).track, 0, false);
      } else {
        if (!activeSequence.includes(activeId)) {
          const prevId = activeId;
          activeId = activeSequence[0];
          getOrBuildWorld(activeId);
          manualMorph = { fromId: prevId, toId: activeId, t: 0 };
        }
        director.setTrack(
          compilePathTrack(activeSequence),
          getPaintingActStart(activeId, activeSequence),
          false,
        );
      }
      soundscape.triggerSnapChord(activeId);
    }
    syncUi(prevPath !== pathId);
  };

  const toggleSound = () => {
    const on = soundscape.toggle();
    director.ui?.setSoundState(on);
  };

  const isHarnessPin = flags.t !== undefined || flags.freeze || flags.overlay;
  director.ui?.wireSuite({
    active: activeId,
    mode: viewMode,
    pathId,
    sequence: activeSequence,
    soundEnabled: soundscape.enabled,
    showBar: !isHarnessPin,
    onSelect: (id) => triggerTransition(id),
    onSelectMode: (m, p) => selectModeAndPath(m, p),
    onToggleSound: toggleSound,
    onSeek: (fraction) => {
      const targetT = fraction * director.activeTrack.loopSeconds;
      director.seekTo(targetT);
      manualMorph = null;
      if (isMultiAct()) {
        const ms = evalOdysseyMorph(targetT, activeSequence);
        if (ms.activeId !== activeId) {
          activeId = ms.activeId;
          syncUi(true);
        }
      }
    },
  });

  // Keyboard shortcuts: [ / ] (prev/next painting), O (toggle Odyssey/Single), U (toggle World Graph Atlas), V (toggle Sound)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const navSeq = activeSequence.length > 1 ? activeSequence : DEFAULT_ODYSSEY_SEQUENCE;
    if (e.key === '[' || e.key === 'PageUp') {
      e.preventDefault();
      triggerTransition(nextPaintingId(activeId, -1, navSeq));
    } else if (e.key === ']' || e.key === 'PageDown') {
      e.preventDefault();
      triggerTransition(nextPaintingId(activeId, 1, navSeq));
    } else if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      if (pathId === 'single') selectModeAndPath('odyssey', 'odyssey');
      else selectModeAndPath('theme', 'single');
    } else if (e.key === 'u' || e.key === 'U') {
      e.preventDefault();
      if (viewMode === 'atlas') {
        selectModeAndPath(pathId === 'odyssey' ? 'odyssey' : 'theme', pathId);
      } else {
        selectModeAndPath('atlas', pathId);
      }
    } else if (e.key === 'Escape' && viewMode === 'atlas') {
      e.preventDefault();
      selectModeAndPath(pathId === 'odyssey' ? 'odyssey' : 'theme', pathId);
    } else if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      toggleSound();
    }
  });

  const resize = (cssW: number, cssH: number, pr: number) => {
    post.setSize(cssW, cssH, pr);
  };
  engine.onResize(resize);
  resize(engine.cssWidth, engine.cssHeight, engine.pixelRatio);
  engine.onQualityChange((q) => {
    setBackdropQuality(masterBackdrop, q);
    masterDust.geometry.setDrawRange(0, q.dustCount);
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
    soundscape,
    suite: PAINTING_SUITE,
    worldGraph: WORLD_GRAPH,
    switchPainting: triggerTransition,
    selectModeAndPath,
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
    const warped = f.warpK !== 1;

    // Determine primary & secondary visible worlds and their 3D brushstroke cross-dissolve parameters
    let primaryId: PaintingId = activeId;
    let secondaryId: PaintingId | null = null;
    let primaryFade = 1;
    let secondaryFade = 0;
    let primaryScatter = 0;
    let secondaryScatter = 0;
    let atmoMix = 0;
    let morphSmear = 0;
    let snapTriggered = false;

    if (manualMorph) {
      manualMorph.t += dt;
      const p = Math.min(1, manualMorph.t / MANUAL_MORPH_DUR);
      primaryId = manualMorph.fromId;
      secondaryId = manualMorph.toId;
      primaryFade = 1 - smoothstep(0.05, 0.88, p);
      secondaryFade = smoothstep(0.05, 0.88, p);
      primaryScatter = 0.85 * smoothstep(0.0, 0.85, p);
      secondaryScatter = 0.88 * Math.pow(1 - smoothstep(0.10, 0.96, p), 1.65);
      atmoMix = smoothstep(0.08, 0.92, p);
      const specA = getPaintingSpec(primaryId);
      const specB = getPaintingSpec(secondaryId);
      displayAspect = specA.aspect + (specB.aspect - specA.aspect) * atmoMix;
      morphSmear = flags.calm ? 0 : 0.35 * Math.sin(Math.PI * p);
      if (p >= 1) {
        activeId = manualMorph.toId;
        primaryId = activeId;
        secondaryId = null;
        primaryFade = 1;
        secondaryFade = 0;
        primaryScatter = 0;
        secondaryScatter = 0;
        atmoMix = 0;
        displayAspect = getPaintingSpec(activeId).aspect;
        manualMorph = null;
        snapTriggered = true;
      }
    } else if (isMultiAct()) {
      const ms = evalOdysseyMorph(f.loopTime, activeSequence);
      primaryId = ms.primaryId;
      secondaryId = ms.secondaryId;
      primaryFade = ms.primaryFade;
      secondaryFade = ms.secondaryFade;
      primaryScatter = ms.primaryScatter;
      secondaryScatter = ms.secondaryScatter;
      atmoMix = ms.atmoMix;
      displayAspect = ms.displayAspect;
      if (ms.secondaryId) {
        morphSmear = flags.calm ? 0 : 0.28 * Math.sin(Math.PI * ms.atmoMix);
      }
      if (ms.snapIncoming && ms.secondaryId) {
        snapHoldId = ms.secondaryId;
        snapHoldTimer = 1.6;
        snapTriggered = true;
      }
      if (ms.activeId !== activeId) {
        activeId = ms.activeId;
        syncUi(true);
      }
    } else {
      primaryId = activeId;
      displayAspect = getPaintingSpec(activeId).aspect;
    }

    world = getOrBuildWorld(primaryId);
    const secondaryWorld = secondaryId ? getOrBuildWorld(secondaryId) : null;

    // Lookahead pre-warming of the next Act's painting + LRU eviction so VRAM stays bounded across all 10 worlds
    const lookaheadSeq = activeSequence.length > 1 ? activeSequence : DEFAULT_ODYSSEY_SEQUENCE;
    const lookaheadId = nextPaintingId(primaryId, 1, lookaheadSeq);
    if (!isHarnessPin && !secondaryId && frames >= 36 && frames % 36 === 0 && !worldCache.has(lookaheadId)) {
      getOrBuildWorld(lookaheadId);
    }
    evictExcessWorlds(primaryId, secondaryId, lookaheadId);

    applyBlendedAtmosphere(u, primaryId, secondaryId, atmoMix);

    engine.renderer.getDrawingBufferSize(bufSize);
    const bufW = bufSize.x;
    const bufH = bufSize.y;
    derivedUniforms(u, f, engine.camera, bufH, displayAspect);
    storm.update(f, engine.camera.position, dt, u, world.strokes);

    const camSpeed = Math.hypot(f.camVelocity[0], f.camVelocity[1], f.camVelocity[2]);
    soundscape.update(dt, {
      primaryId,
      secondaryId,
      atmoMix,
      camSpeed,
      align: u.uAlign.value,
      off: u.uOff.value,
      scatter: Math.max(u.uScatter.value, primaryScatter, secondaryScatter * 0.6),
      stirStrength: f.stir ? f.stir[2] : 0,
      snapTriggered,
    });

    // Hide all cached worlds first, then configure the active primary (and optional secondary morph) worlds
    for (const w of worldCache.values()) {
      w.strokes.group.visible = false;
      w.underlays.visible = false;
    }

    // Configure primary world
    const pU = world.layerUniforms;
    pU.uLayIn.value = u.uLayIn.value;
    pU.uLayerFade.value = primaryFade;
    pU.uScatter.value = Math.max(u.uScatter.value, primaryScatter);
    pU.uSnapTime.value = u.uSnapTime.value;
    pU.uScatterAtSnap.value = u.uScatterAtSnap.value;
    world.strokes.group.visible = primaryFade > 0.002;
    world.strokes.setCullingEnabled(!warped && primaryScatter === 0);
    if (primaryScatter > 0) world.strokes.setCullInflation(0.05);
    world.underlays.visible = !warped && primaryFade > 0.52;

    // Configure secondary world during 3D brushstroke cross-dissolve
    if (secondaryWorld && secondaryFade > 0.002) {
      const sU = secondaryWorld.layerUniforms;
      sU.uLayIn.value = -1;
      sU.uLayerFade.value = secondaryFade;
      sU.uScatter.value = secondaryScatter;
      sU.uSnapTime.value = -1;
      sU.uScatterAtSnap.value = 0;
      secondaryWorld.strokes.group.visible = true;
      secondaryWorld.strokes.setCullingEnabled(false);
      secondaryWorld.strokes.setCullInflation(0.05);
      secondaryWorld.underlays.visible = !warped && secondaryFade > 0.48;
    }

    // Snap ripple hold when locking into a new painting at E
    if (snapHoldTimer > 0 && snapHoldId) {
      snapHoldTimer = Math.max(0, snapHoldTimer - dt);
      const sw = worldCache.get(snapHoldId);
      if (sw && sw.strokes.group.visible) {
        sw.layerUniforms.uSnapTime.value = Math.max(0, u.uTime.value - (1.8 - snapHoldTimer));
        sw.layerUniforms.uScatterAtSnap.value = 0.65;
        sw.strokes.setCullInflation(0.05);
      }
    }

    const matte = f.mode === 'free' ? u.uAlign.value : f.env.matte;
    const pf: PostFrame = {
      bloom: f.env.bloom,
      exposure: f.env.exposure,
      matte,
      align: u.uAlign.value,
      smear: Math.max(f.env.smear, morphSmear),
      fade: f.env.fade,
      time: u.uTime.value,
      canvasRectPx: canvasRect(bufW, bufH, displayAspect),
    };
    post.render(masterScene, engine.camera, pf);
    engine.endFrame();
    shotFrames = f.shot === 0 && f.mode === 'cinematic' ? shotFrames + 1 : 0;
    engine.updateDynamicResolution(dtMs, shotFrames >= 30 && shotFrames <= 120);
    if (f.hud || flags.hud) {
      const s = engine.stats;
      const spec = getPaintingSpec(activeId);
      director.setHudText(`${spec.roman} ${spec.titleZh} [${pathId}] · ${s.fps.toFixed(0)} fps · ${s.frameMs.toFixed(1)} ms${s.gpuMs !== null ? ` (gpu ${s.gpuMs.toFixed(1)})` : ''} · ${engine.quality.tier} · scale ${engine.renderScale.toFixed(2)} · t ${f.loopTime.toFixed(1)} s · ${f.mode}`);
    }
    overlay?.draw(engine.camera);
    frames++;
    if (frames === 3) (window as unknown as { __ready: boolean }).__ready = true;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
