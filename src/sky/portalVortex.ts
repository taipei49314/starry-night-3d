// 3D Spatial Portal Vortex & Halo Particle System:
// Anchors 1,200 orbital impasto light-motes in 3D world space around the active painting's portal (`uMoonPos`).
// - Strictly zero-footprint at the Painter's Eye E (`uOff == 0`), blooming into 3D parallax as the camera leaves E
//   or approaches the portal threshold (`uPortalGain`).
// - Morphs its 3D orbital geometry across the 6 Motif Backbones (`uPortalMotif` 0..5:
//   0 = ✦ Light corona rings, 1 = ⟁ Road perspective tunnel, 2 = ◎ Sky twin-arm spiral vortex,
//   3 = ❀ Flora rising petal helix, 4 = ⌂ Dwelling threshold window frame, 5 = ❖ Gaze iris & pupil rings).
import { AdditiveBlending, Box3, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Sphere, Vector3 } from 'three';
import type { QualitySettings, Rng, SharedUniforms } from '../contracts';
import type { MotifId } from '../chapters/types';
import { canvasToWorld, EYE } from '../shared/canvasSpace';
import { GLSL_PRELUDE } from '../shared/glsl/flow.glsl';

const MAX_VORTEX_COUNT = 1200;

const MOTIF_TO_INDEX: Record<MotifId, number> = {
  light: 0,
  road: 1,
  sky: 2,
  flora: 3,
  dwelling: 4,
  gaze: 5,
};

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
${GLSL_PRELUDE}
uniform float uPortalGain;
uniform float uPortalMotif;
attribute vec4 aOrbit;   // (radiusNorm [0..1], angle0 [0..TAU], zNorm [-1..1], seed [0..1])
attribute vec4 aStyle;   // (colorMix [0..1], sizePx, armIdx [0..1], ringBand [0..1])
varying vec3 vCol;
varying float vAlpha;

void main() {
  float gain = uOff * uPortalGain;
  if (gain <= 0.002) {
    vAlpha = 0.0;
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec3 muvd = worldToCanvas(uMoonPos);
  float md = warpDepth(max(muvd.z, 60.0));
  vec3 Pcenter = uEye + md * canvasDir(muvd.xy);

  float rNorm = aOrbit.x;
  float ang0 = aOrbit.y;
  float zNorm = aOrbit.z;
  float seed = aOrbit.w;
  float t = uTime;

  // Tangent frame aligned with the canvas plane at the portal
  vec3 right = uEyeBasis[0];
  vec3 up = uEyeBasis[1];
  vec3 fwd = -uEyeBasis[2]; // into depth away from E

  float baseR = 0.078 * md;
  vec2 xy = vec2(0.0);
  float zOff = 0.0;
  int mIdx = int(uPortalMotif + 0.5);

  if (mIdx == 0) {
    // 0: ✦ Light — Counter-rotating concentric solar/lamp corona rings
    float dir = aStyle.z < 0.5 ? 1.0 : -1.0;
    float ang = ang0 + dir * SN_TAU * t / (18.0 + 10.0 * rNorm);
    float pulse = 1.0 + 0.08 * sin(SN_TAU * t / 6.0 + 6.0 * rNorm + 6.28 * seed);
    float r = baseR * (0.14 + 0.86 * pow(rNorm, 0.85)) * pulse;
    xy = vec2(cos(ang), sin(ang)) * r;
    zOff = 0.035 * md * zNorm * (1.0 - 0.5 * rNorm);
  } else if (mIdx == 1) {
    // 1: ⟁ Road — Perspective corridor streaming into the vanishing-point threshold
    float zStream = fract(0.5 * (zNorm + 1.0) + t / 10.0);
    float tunnelR = baseR * mix(1.05, 0.22, zStream) * (0.35 + 0.65 * rNorm);
    float ang = ang0 + 0.35 * sin(SN_TAU * t / 14.0 + 4.0 * zStream);
    xy = vec2(cos(ang), sin(ang) * 0.78) * tunnelR;
    zOff = (zStream - 0.35) * 0.24 * md;
  } else if (mIdx == 2) {
    // 2: ◎ Sky — Logarithmic twin-arm celestial vortex
    float arm = aStyle.z < 0.5 ? 0.0 : 3.14159265;
    float spin = SN_TAU * t / 14.0;
    float theta = ang0 * 0.35 + arm + 4.2 * rNorm - spin;
    float r = baseR * (0.10 + 1.15 * rNorm);
    xy = vec2(cos(theta), sin(theta)) * r;
    zOff = 0.09 * md * sin(theta - spin) * (0.3 + 0.7 * rNorm);
  } else if (mIdx == 3) {
    // 3: ❀ Flora — Botanical rising petal helix & wind drift
    float rise = fract(0.5 * (zNorm + 1.0) + t / 12.0);
    float ang = ang0 + SN_TAU * rise * 1.5 + SN_TAU * t / 20.0;
    float r = baseR * (0.18 + 0.85 * rNorm) * (1.0 - 0.25 * rise);
    xy = vec2(cos(ang) * r, (rise - 0.5) * 1.55 * baseR + 0.25 * sin(ang * 2.0) * baseR);
    zOff = 0.06 * md * cos(ang);
  } else if (mIdx == 4) {
    // 4: ⌂ Dwelling — Luminous window/doorway threshold frame
    float perim = fract(ang0 / SN_TAU + t / 28.0);
    float side = floor(perim * 4.0);
    float u = fract(perim * 4.0) * 2.0 - 1.0;
    vec2 box = side < 0.5 ? vec2(u, -1.0)
             : side < 1.5 ? vec2(1.0, u)
             : side < 2.5 ? vec2(-u, 1.0)
             : vec2(-1.0, -u);
    float thickness = 0.72 + 0.38 * rNorm;
    xy = box * vec2(0.76, 0.96) * baseR * thickness;
    zOff = 0.08 * md * zNorm;
  } else {
    // 5: ❖ Gaze — Ocular iris striations & dilating pupil ring
    float pupilRing = aStyle.w < 0.45 ? 0.32 : (0.45 + 0.55 * rNorm);
    float breathe = 1.0 + 0.10 * sin(SN_TAU * t / 5.0);
    float ang = ang0 + (aStyle.w < 0.45 ? -1.0 : 0.35) * SN_TAU * t / 22.0;
    float r = baseR * pupilRing * breathe;
    xy = vec2(cos(ang), sin(ang)) * r;
    zOff = -0.05 * md * (1.0 - pupilRing) + 0.03 * md * zNorm;
  }

  vec3 worldPos = Pcenter + right * xy.x + up * xy.y + fwd * zOff;
  vec3 rel = worldPos - cameraPosition;
  float dist = max(length(rel), 1e-3);
  vec4 mv = vec4(mat3(viewMatrix) * rel, 1.0);
  gl_Position = projectionMatrix * mv;

  float sizeScale = clamp(md / dist, 0.35, 3.2);
  gl_PointSize = aStyle.y * sizeScale * (uViewportH / 1080.0);

  // Harmonize warm golden portal glow with the active painting's atmospheric palette
  vec3 goldCore = mix(PAL_CHROME, PAL_LEMON, aStyle.x);
  vec3 eraTint = mix(uFogFar * 1.45 + vec3(0.08), PAL_ZINC_WHITE, 0.48);
  vCol = mix(goldCore, eraTint, 0.38 * aStyle.w);

  float twinkle = 0.72 + 0.28 * sin(SN_TAU * t / 3.2 + 6.283 * seed);
  vAlpha = 0.58 * gain * twinkle * (1.0 - 0.38 * rNorm);
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
  float core = 1.0 - smoothstep(0.0, 0.22, r);
  float halo = 1.0 - smoothstep(0.12, 0.5, r);
  float a = vAlpha * (0.65 * halo + 0.55 * core);
  if (a <= 0.003) discard;
  vec3 col = mix(vCol, vec3(1.0, 0.98, 0.90), 0.45 * core);
  gl_FragColor = vec4(col, a);
  #include <logdepthbuf_fragment>
  #include <colorspace_fragment>
}
`;

export interface PortalVortexHandle {
  readonly points: Points;
  setPortalState(gain: number, motif: MotifId): void;
  setQuality(q: QualitySettings): void;
}

export function createPortalVortex(
  u: SharedUniforms,
  q: QualitySettings,
  rng: Rng,
): PortalVortexHandle {
  const n = MAX_VORTEX_COUNT;
  const aOrbit = new Float32Array(n * 4);
  const aStyle = new Float32Array(n * 4);

  for (let i = 0; i < n; i++) {
    const rNorm = Math.pow(rng.next(), 0.78);
    const ang0 = rng.next() * Math.PI * 2;
    const zNorm = rng.range(-1, 1);
    const seed = rng.next();
    aOrbit.set([rNorm, ang0, zNorm, seed], i * 4);

    const colorMix = rng.next();
    const sizePx = rng.range(3.2, 7.8);
    const armIdx = i % 2 === 0 ? 0.2 : 0.8;
    const ringBand = rng.next();
    aStyle.set([colorMix, sizePx, armIdx, ringBand], i * 4);
  }

  const g = new BufferGeometry();
  g.setAttribute('aOrbit', new BufferAttribute(aOrbit, 4));
  g.setAttribute('aStyle', new BufferAttribute(aStyle, 4));
  g.setAttribute('position', new BufferAttribute(new Float32Array(n), 1));

  const countForTier = (tier: QualitySettings['tier']) =>
    tier === 'high' ? 1200 : tier === 'medium' ? 800 : 480;
  g.setDrawRange(0, countForTier(q.tier));

  const far = canvasToWorld(0.5, 0.5, 60_000);
  g.boundingSphere = new Sphere(far, EYE.distanceTo(far) * 2.0);
  g.boundingBox = new Box3().setFromCenterAndSize(far, new Vector3().setScalar(g.boundingSphere.radius * 2));

  const uPortalGain = { value: 0 };
  const uPortalMotif = { value: 0 };

  const material = new ShaderMaterial({
    name: 'punctum.portalVortex',
    uniforms: {
      ...u,
      uPortalGain,
      uPortalMotif,
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    fog: false,
    lights: false,
  });

  const points = new Points(g, material);
  points.name = 'portalVortex';
  points.frustumCulled = false;
  points.matrixAutoUpdate = false;

  return {
    points,
    setPortalState(gain: number, motif: MotifId) {
      uPortalGain.value = Math.max(0, Math.min(1.5, gain));
      uPortalMotif.value = MOTIF_TO_INDEX[motif] ?? 0;
    },
    setQuality(nextQ: QualitySettings) {
      g.setDrawRange(0, countForTier(nextQ.tier));
    },
  };
}
