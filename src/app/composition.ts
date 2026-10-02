// M10: world assembly and the per-frame loop (§4.10).
import { Group, Scene, Vector2, Vector3, type Material, type PerspectiveCamera } from 'three';
import {
  CANVAS_ASPECT, LOOP_SECONDS, type DirectorFrame, type Engine, type PostFrame, type QualitySettings, type SharedUniforms,
  type Tier, type UnderlayMaterialFactory, type World,
} from '../contracts';
import { createEngine } from '../engine/engine';
import { StrokeBuffer, buildStrokeLayer, makeUnderlayMaterial } from '../strokes/strokeBuffer';
import { generateSky } from '../sky/skyGen';
import { createBackdrop, setBackdropQuality } from '../sky/backdrop';
import { createDust } from '../sky/dust';
import { generateStars } from '../celestial/starsGen';
import { generateMoon } from '../celestial/moonGen';
import { createCypressCore, generateCypress } from '../earth/cypressGen';
import { generateGround } from '../earth/terrain';
import { generateHills } from '../earth/hillsGen';
import { createLandUnderlays, generateVillage } from '../earth/villageGen';
import { Director, type DirectorFrameEx } from '../camera/director';
import { createPost } from '../post/post';
import { canvasPoseFovDeg, EYE, FORWARD, galleryLightDir } from '../shared/canvasSpace';
import { forkRng } from '../shared/rng';
import { createSharedUniforms } from '../shared/uniforms';
import { StormController } from './storm';
import { assertPaintOrder, runInvarianceSelfTest } from './selfTest';
import { DebugOverlay } from './debugOverlay';

export interface BuiltWorld extends World { buffer: StrokeBuffer; timings: Record<string, number> }

export function buildWorld(u: SharedUniforms, q: QualitySettings, seed: number): BuiltWorld {
  const timings: Record<string, number> = {};
  const time = <T>(name: string, fn: () => T): T => {
    const t0 = performance.now();
    const r = fn();
    timings[name] = Math.round((performance.now() - t0) * 10) / 10;
    return r;
  };
  const buffer = new StrokeBuffer(200_000);
  time('sky', () => generateSky(buffer, forkRng(seed, 'sky')));
  time('stars', () => generateStars(buffer, forkRng(seed, 'stars')));
  time('moon', () => generateMoon(buffer, forkRng(seed, 'moon')));
  time('cypress', () => generateCypress(buffer, forkRng(seed, 'cypress')));
  time('ground', () => generateGround(buffer, forkRng(seed, 'ground')));
  time('hills', () => generateHills(buffer, forkRng(seed, 'hills')));
  const village = time('village', () => generateVillage(buffer, forkRng(seed, 'village')));

  const violations = assertPaintOrder(buffer);
  if (violations.length) console.warn(`[punctum] paint order: ${violations.length} violation(s)\n  ${violations.join('\n  ')}`);

  const strokes = time('upload', () => buildStrokeLayer(buffer, u, q));
  const scene = new Scene();
  const backdrop = createBackdrop(u, q);
  const dust = createDust(u, q, forkRng(seed, 'dust'));
  const materials = new Map<string, Material>();
  const mat: UnderlayMaterialFactory = (hex, opts) => {
    const key = `${hex}:${opts?.vertexFade ? 'fade' : ''}`;
    let m = materials.get(key);
    if (!m) materials.set(key, (m = makeUnderlayMaterial(hex, u, undefined, opts)));
    return m;
  };
  const underlays = new Group();
  underlays.name = 'underlays';
  underlays.add(createLandUnderlays(mat, village));
  underlays.add(createCypressCore(mat(0x0f1712)));
  scene.add(backdrop, strokes.group, underlays, dust);
  timings.strokes = buffer.count;
  return { scene, strokes, backdrop, dust, underlays, village, buffer, timings };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Flags { t?: number; boot?: number; tier?: Tier; free: boolean; overlay: boolean; seed: number; calm: boolean; freeze: boolean; hud: boolean }

function readFlags(): Flags {
  const p = new URLSearchParams(location.search);
  const num = (k: string) => (p.has(k) && p.get(k) !== '' && Number.isFinite(Number(p.get(k))) ? Number(p.get(k)) : undefined);
  const tierRaw = p.get('tier');
  let calmStored = false;
  try { calmStored = localStorage.getItem('punctum.calm') === '1'; } catch { /* storage blocked */ }
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
  };
}

function canvasRect(w: number, h: number): [number, number, number, number] {
  if (w / h >= CANVAS_ASPECT) {
    const cw = h * CANVAS_ASPECT;
    return [(w - cw) / 2, 0, cw, h];
  }
  const ch = w / CANVAS_ASPECT;
  return [0, (h - ch) / 2, w, ch];
}

const camF = new Vector3();
function derivedUniforms(u: SharedUniforms, f: DirectorFrame, camera: PerspectiveCamera, viewportH: number): void {
  const t = (f as DirectorFrameEx).animTime ?? f.loopTime;
  u.uTime.value = ((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
  const dist = camera.position.distanceTo(EYE);
  u.uOff.value = smoothstep(0.5, 40, dist);
  camera.getWorldDirection(camF);
  const fovCanvas = canvasPoseFovDeg(camera.aspect);
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
  const t0 = performance.now();
  const world = buildWorld(u, engine.quality, flags.seed);
  const self = runInvarianceSelfTest(world.buffer);
  if (!self.ok) console.error(`[punctum] invariance self-test failed: max canvas error ${self.maxErr.toExponential(2)}`);
  const post = createPost(engine.renderer, u, engine.quality);
  const director = new Director(engine.camera, engine.canvas, {
    calm: flags.calm, startTime: flags.t, free: flags.free, firstBoot: flags.t === undefined,
  });
  const storm = new StormController();
  const overlay = flags.overlay ? new DebugOverlay(container) : null;
  console.info(`[punctum] ${world.buffer.count} strokes, tier ${engine.quality.tier}, build ${Math.round(performance.now() - t0)} ms`, world.timings, `self-test ${self.maxErr.toExponential(1)}`);

  const resize = (cssW: number, cssH: number, pr: number) => {
    post.setSize(cssW, cssH, pr);
  };
  engine.onResize(resize);
  resize(engine.cssWidth, engine.cssHeight, engine.pixelRatio);
  engine.onQualityChange((q) => {
    world.strokes.setQuality(q);
    post.setQuality(q);
    setBackdropQuality(world.backdrop, q);
    world.dust.geometry.setDrawRange(0, q.dustCount);
  });
  engine.renderer.compile(world.scene, engine.camera);

  const bufSize = new Vector2();
  let last = performance.now();
  let frames = 0;
  let shotFrames = 0;
  const debug = { engine, director, world, uniforms: u, post, storm, frames: () => frames };
  (window as unknown as { __punctum: typeof debug }).__punctum = debug;

  const frame = (now: number) => {
    const dtMs = Math.min(100, now - last);
    last = now;
    // ?freeze holds the clock after the first frame; ?boot=<s> (with ?freeze) jumps the first-boot sequence to s seconds
    if (frames === 0 && flags.boot) for (let k = 0; k < Math.round(flags.boot / 0.1) - 1; k++) director.update(0.1);
    const dt = flags.freeze ? (frames === 0 && flags.boot ? 0.1 : 0) : dtMs / 1000;
    engine.beginFrame();
    const f = director.update(dt);
    engine.renderer.getDrawingBufferSize(bufSize);
    const bufW = bufSize.x;
    const bufH = bufSize.y;
    derivedUniforms(u, f, engine.camera, bufH);
    storm.update(f, engine.camera.position, dt, u, world.strokes);
    const warped = f.warpK !== 1;
    world.strokes.setCullingEnabled(!warped);
    world.underlays.visible = !warped;
    const matte = f.mode === 'free' ? u.uAlign.value : f.env.matte;
    const pf: PostFrame = {
      bloom: f.env.bloom, exposure: f.env.exposure, matte, align: u.uAlign.value, smear: f.env.smear,
      fade: f.env.fade, time: u.uTime.value, canvasRectPx: canvasRect(bufW, bufH),
    };
    post.render(world.scene, engine.camera, pf);
    engine.endFrame();
    shotFrames = f.shot === 0 && f.mode === 'cinematic' ? shotFrames + 1 : 0;
    engine.updateDynamicResolution(dtMs, shotFrames >= 30 && shotFrames <= 120);
    if (f.hud || flags.hud) {
      const s = engine.stats;
      director.setHudText(`${s.fps.toFixed(0)} fps · ${s.frameMs.toFixed(1)} ms${s.gpuMs !== null ? ` (gpu ${s.gpuMs.toFixed(1)})` : ''} · ${engine.quality.tier} · scale ${engine.renderScale.toFixed(2)} · t ${f.loopTime.toFixed(1)} s · ${f.mode}`);
    }
    overlay?.draw(engine.camera);
    frames++;
    if (frames === 3) (window as unknown as { __ready: boolean }).__ready = true;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
