// M7 check inside the real app: boots src/app/composition exactly like src/main.ts, then (only while the integrator's
// material factory still drops UnderlayOptions) swaps the land underlays that carry aFade onto M3's vertexFade material,
// i.e. what `(hex, opts) => makeUnderlayMaterial(hex, u, FrontSide, opts)` in composition.ts will hand out.
// Same URL flags as index.html (?t=&freeze&tier=&free ...). Adds ?nofade to see the unpatched app.
import { FrontSide, Mesh, type Material, type ShaderMaterial } from 'three';
import type { SharedUniforms } from '../src/contracts';
import { boot } from '../src/app/composition';
import { makeUnderlayMaterial } from '../src/strokes/strokeBuffer';

interface Debug { world: { underlays: { traverse(fn: (o: unknown) => void): void } }; uniforms: SharedUniforms }

const container = document.getElementById('app')!;
await boot(container);
const dbg = (window as unknown as { __punctum: Debug }).__punctum;
let swapped = 0;
if (!new URLSearchParams(location.search).has('nofade')) {
  const cache = new Map<number, Material>();
  dbg.world.underlays.traverse((o) => {
    if (!(o instanceof Mesh) || !o.geometry.getAttribute('aFade')) return;
    const m = o.material as ShaderMaterial;
    if (m.defines && 'UL_VERTEX_FADE' in m.defines) return; // composition already passes the options through
    const hex = (m.uniforms.uUlColor.value as { getHex(): number }).getHex();
    let f = cache.get(hex);
    if (!f) cache.set(hex, (f = makeUnderlayMaterial(hex, dbg.uniforms, FrontSide, { vertexFade: true })));
    o.material = f;
    swapped++;
  });
}
console.info(`[landApp] fade materials swapped onto ${swapped} land underlay mesh(es)`);
