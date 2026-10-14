// Underlay material (§4.3) for the meshes under the strokes (ground grid, hill backs, house cores, cypress core):
// flat colour x painterly value noise, moonlight Lambert at 0.35, the strokes' ratio fog, log depth,
// polygonOffset(1, 2) so it sits behind the strokes lying on it. Works on Mesh and InstancedMesh.
import { Color, FrontSide, ShaderMaterial, type Side } from 'three';
import type { SharedUniforms, UnderlayOptions } from '../contracts';
import { GLSL_PRELUDE } from '../shared/glsl/flow.glsl';

export const underlayVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
${GLSL_PRELUDE}
varying vec3 vUlWorld;
varying vec3 vUlNormal;
#ifdef UL_VERTEX_FADE
attribute float aFade;
varying float vUlFade;
#endif
void main() {
#ifdef UL_VERTEX_FADE
  vUlFade = aFade;
#endif
  vec4 p = vec4(position, 1.0);
  vec3 nrm = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
  nrm = mat3(instanceMatrix) * nrm;
#endif
  vec4 wp = modelMatrix * p;
  vUlWorld = wp.xyz;
  vUlNormal = normalize(mat3(modelMatrix) * nrm);
  gl_Position = projectionMatrix * viewMatrix * wp;
#include <logdepthbuf_vertex>
}
`;

export const underlayFrag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${GLSL_PRELUDE}
uniform vec3 uUlColor;
uniform float uUlDepthBias;
varying vec3 vUlWorld;
varying vec3 vUlNormal;
#ifdef UL_VERTEX_FADE
varying float vUlFade;
#endif
void main() {
#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
  float ulSlope = fwidth(log2(vFragDepth));      // taken before any discard (uniform control flow)
#endif
#ifdef UL_VERTEX_FADE
  // hashed dissolve: aFade = 1 always survives (ign < 1), aFade = 0 always goes
  float ulFade = clamp(vUlFade, 0.0, 1.0);
  if (ulFade <= ign(gl_FragCoord.xy)) discard;
#endif
  vec3 P = vUlWorld;
  vec3 col = uUlColor * (0.85 + 0.15 * vnoise3(P / 6.0));
  vec3 n = normalize(vUlNormal);
  vec3 toCam = cameraPosition - P;
  if (dot(n, toCam) < 0.0) n = -n;               // double-sided meshes light their visible face
  float lam = max(dot(n, normalize(uMoonPos - P)), 0.0);
  col *= 0.65 + 0.35 * lam;
  float dc = length(toCam);
  float dE = max(length(P - uEye), 1.0);
  float fog = 0.7 * (1.0 - exp(-0.5 * max(0.0, log(dc / dE))));
  vec3 fogC = mix(uFogNear, uFogFar, smoothstep(3.0, 5.3, log2(dE) * 0.30102999566));
  col = mix(col, fogC, fog);
#ifdef UL_VERTEX_FADE
  col = mix(fogC, col, smoothstep(0.0, 0.6, ulFade));   // the surviving speckle also melts into the fog colour
#endif
  gl_FragColor = vec4(col, 1.0);
#include <logdepthbuf_fragment>
#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
  // polygonOffset does not reach a written gl_FragDepth, so log depth gets the same push by hand:
  // slope factor 1 (depth derivative) + a relative distance bias uUlDepthBias.
  if (vIsPerspective != 0.0) gl_FragDepth += 0.5 * logDepthBufFC * (ulSlope + log2(1.0 + uUlDepthBias));
#endif
#include <tonemapping_fragment>
#include <colorspace_fragment>
}
`;

/** Relative distance by which underlays are pushed behind coincident strokes under log depth (0.1 %). */
export const UNDERLAY_DEPTH_BIAS = 1e-3;

/**
 * Underlay ShaderMaterial; colorHex is sRGB 0xRRGGBB. Support for InstancedMesh comes through USE_INSTANCING.
 * opts.vertexFade: the geometry must carry `attribute float aFade` in [0, 1] (1 = opaque); low values dissolve with
 * IGN hashed discard and blend toward the ratio-fog colour. A geometry without aFade reads 0 and draws nothing.
 * The fade variant is a separate program, so cache materials by (colorHex, vertexFade).
 */
export function makeUnderlayMaterial(colorHex: number, u: SharedUniforms, side: Side = FrontSide, opts?: UnderlayOptions): ShaderMaterial {
  const color = new Color().setHex(colorHex); // three converts sRGB hex to linear working space
  const fade = opts?.vertexFade === true;
  const m = new ShaderMaterial({
    name: `underlay#${colorHex.toString(16).padStart(6, '0')}${fade ? ':fade' : ''}`,
    defines: fade ? { UL_VERTEX_FADE: '' } : {},
    uniforms: { ...u, uUlColor: { value: color }, uUlDepthBias: { value: UNDERLAY_DEPTH_BIAS } },
    vertexShader: underlayVert,
    fragmentShader: underlayFrag,
    side,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2,
    transparent: false,
    depthWrite: true,
  });
  return m;
}
