// Base ribbon shared by every stroke chunk (§4.3): a strip of `segments` quads along s in [0, 1],
// two vertices per station at w = -1 and w = +1. position = (s, w, 0). Indexed, no normals or uvs.
import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three';

const cache = new Map<number, BufferGeometry>();

/** (segments + 1) * 2 vertices, 2 * segments triangles. position = (s, w, 0). */
export function makeRibbonGeometry(segments: 3 | 4 | 5): BufferGeometry {
  const n = segments;
  const pos = new Float32Array((n + 1) * 2 * 3);
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    pos.set([s, -1, 0, s, 1, 0], i * 6);
  }
  const idx = new Uint16Array(n * 6);
  for (let i = 0; i < n; i++) {
    const a = 2 * i;
    idx.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  // Never let three compute bounds from the parameter-space ribbon; this sphere is meaningless in world space.
  g.boundingSphere = new Sphere(new Vector3(0.5, 0, 0), 1.2);
  g.name = `strokeRibbon${n}`;
  return g;
}

/** Shared ribbon per segment count (one instance per LOD for the whole app). */
export function sharedRibbon(segments: 3 | 4 | 5): BufferGeometry {
  let g = cache.get(segments);
  if (!g) {
    g = makeRibbonGeometry(segments);
    cache.set(segments, g);
  }
  return g;
}
