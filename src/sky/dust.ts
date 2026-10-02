// M4 pigment dust (SPEC §4.4): motes scattered through the whole 50 m - 250 km volume at canvas positions, so from
// E they are invisible (uOff = 0) and off-axis they give parallax at every depth. One additive Points draw.
import { AdditiveBlending, Box3, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Sphere, Vector3 } from 'three';
import {
  CANVAS_ASPECT, GEN_U, GEN_V, PALETTE, QUALITY_PRESETS, type QualitySettings, type Rng, type SharedUniforms,
} from '../contracts';
import { canvasToWorld, EYE, groundHitDepth, Region, regionAt } from '../shared/canvasSpace';
import { flowField } from '../shared/flowField';
import { srgbHexToLinear } from '../shared/palette';
import { GLSL_PRELUDE } from '../shared/glsl/flow.glsl';

const D_MIN = 50;
const D_MAX = 250_000;

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
${GLSL_PRELUDE}
attribute vec4 aDust;    // (u, v, d, seed)
attribute vec4 aFlow;    // (unit flow direction in h-units xy, point size px @1080, 0)
attribute vec3 aColor;   // linear
varying vec3 vCol;
varying float vAlpha;
void main() {
  // drift along the flow (§4.4): p = p0 + 0.02 normalize(flowField(p0)) sin(2 pi t / 16 + 6.28 seed)
  vec2 p = uvToH(aDust.xy) + 0.02 * aFlow.xy * sin(SN_TAU * uTime / 16.0 + 6.28 * aDust.w);
  // camera-relative world position (avoids cancellation at 250 km)
  vec3 rel = (uEye - cameraPosition) + warpDepth(aDust.z) * canvasDir(hToUv(p));
  vec4 mv = vec4(mat3(viewMatrix) * rel, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aFlow.z * uViewportH / 1080.0;
  vCol = aColor;
  // Anamorphic size ratio: a mote's world size grows with its depth d, so its true apparent size from the camera is
  // ~ d / |P - C| (1 at E). Fixed-pixel points ignore that: seen from 44 km out (shot 8), the ~13k motes within
  // 2 km of E would pile up additively into a white blob over the village. Fade the far-and-small ones.
  float ratio = warpDepth(aDust.z) / max(length(rel), 1e-3);
  vAlpha = 0.25 * uOff * uDustAlpha * smoothstep(0.03, 0.25, ratio);
  if (vAlpha <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vCol;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = vAlpha * (1.0 - smoothstep(0.3, 0.5, r));
  if (a <= 0.002) discard;
  gl_FragColor = vec4(vCol, a);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

/** Region palettes for the motes (sRGB hex); additive at alpha <= 0.25 so they read as glints of pigment. */
const MOTE_COLOURS: Record<Region, readonly number[]> = {
  [Region.SKY]: [PALETTE.zincWhite, PALETTE.zincWhite, PALETTE.cerulean, PALETTE.blueGreen, PALETTE.lemon, PALETTE.cobalt],
  [Region.HILL]: [PALETTE.cerulean, PALETTE.cobalt, PALETTE.blueGreen],
  [Region.VILLAGE]: [PALETTE.chrome, PALETTE.ochre, PALETTE.cerulean, PALETTE.lemon],
  [Region.FIELD]: [PALETTE.groveLight, PALETTE.ochre, PALETTE.blueGreen, PALETTE.cypressGreen],
  [Region.CYPRESS]: [PALETTE.groveLight, PALETTE.blueGreen, PALETTE.cypressGreen],
};

/**
 * Pigment motes. Generates the High-tier count (or q.dustCount if larger) so a tier change only needs
 * `geometry.setDrawRange(0, q.dustCount)`; any prefix is a uniform subsample. frustumCulled = false (one draw).
 */
export function createDust(u: SharedUniforms, q: QualitySettings, rng: Rng): Points {
  const n = Math.max(q.dustCount, QUALITY_PRESETS.high.dustCount);
  const aDust = new Float32Array(n * 4);
  const aFlow = new Float32Array(n * 4);
  const aColor = new Float32Array(n * 3);
  const f = [0, 0];
  const lnMin = Math.log(D_MIN);
  for (let i = 0; i < n; i++) {
    const uu = rng.range(GEN_U[0], GEN_U[1]);
    const vv = rng.range(GEN_V[0], GEN_V[1]);
    // log-uniform depth, kept above the ground plane for canvas rows below the horizon
    const dHit = groundHitDepth(uu, vv);
    const dMax = Math.max(D_MIN * 1.5, Math.min(D_MAX, dHit * 0.98));
    const d = Math.exp(lnMin + rng.next() * (Math.log(dMax) - lnMin));
    aDust.set([uu, vv, d, rng.next()], i * 4);
    flowField(uu * CANVAS_ASPECT, vv, f);
    const m = Math.hypot(f[0], f[1]);
    const size = rng.range(1.5, 3.0);
    aFlow.set(m > 1e-9 ? [f[0] / m, f[1] / m, size, 0] : [1, 0, size, 0], i * 4);
    const c = srgbHexToLinear(rng.pick(MOTE_COLOURS[regionAt(uu, vv)]));
    const k = rng.range(0.7, 1.15);
    aColor.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('aDust', new BufferAttribute(aDust, 4));
  g.setAttribute('aFlow', new BufferAttribute(aFlow, 4));
  g.setAttribute('aColor', new BufferAttribute(aColor, 3));
  // a 'position' attribute only caps the draw count for three; the shader never reads it (so it is never bound)
  g.setAttribute('position', new BufferAttribute(new Float32Array(n), 1));
  g.setDrawRange(0, q.dustCount);
  // hand-set bounds (never computed from 'position'): the whole dust volume, used only for transparent sorting
  const far = canvasToWorld(0.5, 0.5, D_MAX * 0.5);
  g.boundingSphere = new Sphere(far, EYE.distanceTo(far) * 1.6);
  g.boundingBox = new Box3().setFromCenterAndSize(far, new Vector3().setScalar(g.boundingSphere.radius * 2));
  const material = new ShaderMaterial({
    name: 'punctum.dust',
    uniforms: { ...u },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    fog: false,
    lights: false,
  });
  const pts = new Points(g, material);
  pts.name = 'dust';
  pts.frustumCulled = false;
  pts.matrixAutoUpdate = false;
  return pts;
}
