// M4 cross-check: the sky records through M3's real stroke layer (src/strokes, in progress in parallel) plus the real
// backdrop and dust, no post chain. Same views as harness/sky.ts:
//   harness/sky-real.html?view=canvas|zoom|profile|profileb|funnel|eye|jet&t=..  (&cu= &cv= &fov= &th= &r= &tier=)
// This page depends on M3; harness/sky.ts (lib preview) does not.
import { CANVAS_ASPECT, QUALITY_PRESETS, type Tier, VORTICES } from '../src/contracts';
import { canvasToWorld, EYE } from '../src/shared/canvasSpace';
import { forkRng, mulberry32 } from '../src/shared/rng';
import { createSharedUniforms } from '../src/shared/uniforms';
import { generateSky } from '../src/sky/skyGen';
import { createBackdrop } from '../src/sky/backdrop';
import { createDust } from '../src/sky/dust';
import { StrokeBuffer } from '../src/strokes/strokeBuffer';
import { buildStrokeLayer } from '../src/strokes/strokeMaterial';
import { canvasGrid, setupPreview } from './lib/preview';

const qs = new URLSearchParams(location.search);
const view = qs.get('view') ?? 'canvas';
const DEFAULT_T: Record<string, number> = { canvas: 0, zoom: 0, profile: 48, profileb: 52, funnel: 60, jet: 32, eye: 71 };
const t = Number(qs.get('t') ?? DEFAULT_T[view] ?? 0);
const W = window.innerWidth || 1280;
const H = window.innerHeight || 720;
const q = QUALITY_PRESETS[(qs.get('tier') as Tier) ?? 'high'] ?? QUALITY_PRESETS.high;
const deg = Math.PI / 180;

const pv = setupPreview(W, H);
const { renderer, camera, scene } = pv;
const c1 = VORTICES[0];
switch (view) {
  case 'zoom': pv.look(EYE, canvasToWorld(Number(qs.get('cu') ?? 0.51), Number(qs.get('cv') ?? 0.64), 1000), Number(qs.get('fov') ?? 14)); break;
  case 'profile': pv.look({ x: -22600, y: 44000, z: -31700 }, { x: 504, y: 16173, z: -60114 }, 56); break;
  case 'profileb': pv.look({ x: -18201, y: 40775, z: -44746 }, { x: 504, y: 16173, z: -60114 }, 56); break;
  case 'jet': pv.look({ x: -45, y: 210, z: -235 }, canvasToWorld(0.3, 0.72, 12000), 78); break;
  case 'eye': pv.look({ x: -2501, y: 12196, z: -42537 }, EYE, Number(qs.get('fov') ?? 26)); break;
  case 'funnel': {
    const r = Number(qs.get('r') ?? 0.06);
    const th = Number(qs.get('th') ?? -90) * deg;
    const d = c1.dThroat * Math.pow(r / c1.r0, c1.expo);
    pv.look(canvasToWorld(c1.u + (0.8 * r * Math.cos(th)) / CANVAS_ASPECT, c1.v + 0.8 * r * Math.sin(th), d), canvasToWorld(c1.u, c1.v, d - 6000), 72);
    break;
  }
  default: pv.pose();
}
camera.updateMatrixWorld();

const u = createSharedUniforms();
const off = camera.position.distanceTo(EYE);
u.uTime.value = t;
u.uOff.value = off > 0.5 ? 1 : 0;
u.uAlign.value = view === 'canvas' ? 1 : 0;
u.uViewportH.value = H;
u.uPxPerRad.value = H / (2 * Math.tan((camera.fov * deg) / 2));
u.uLayIn.value = -1;
u.uInflate.value = 10;

const buf = new StrokeBuffer(80000);
const t0 = performance.now();
generateSky(buf, forkRng(1, 'sky'));
const genMs = performance.now() - t0;
const layer = buildStrokeLayer(buf, u, q);
layer.setQuality(q);
scene.add(createBackdrop(u, q), layer.group, createDust(u, q, mulberry32(9)));
if (view === 'canvas' && qs.get('grid') === '1') scene.add(canvasGrid());
pv.render();
const info = { view, t, n: buf.count, genMs: Math.round(genMs), chunks: layer.chunks.length, calls: renderer.info.render.calls, tier: q.tier };
console.log(`[sky-real] ${JSON.stringify(info)}`);
const err = renderer.getContext().getError();
if (err) console.error(`[sky-real] GL error ${err}`);
(window as unknown as { __ready: boolean }).__ready = true;
