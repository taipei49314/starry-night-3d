// Harness-only copy of the pre-2026-10-02 M4 backdrop (folded angular map, 9-cell Voronoi splats, dark back
// hemisphere), kept for A/B timing and look comparisons in harness/sky-perf.html. Not used by the app.
import { BufferAttribute, BufferGeometry, Mesh, ShaderMaterial } from 'three';
import { AT, GEN_V, T_HALF, type QualitySettings, type SharedUniforms } from '../src/contracts';
import { f } from '../src/shared/glsl/header';
import { GLSL_PRELUDE } from '../src/shared/glsl/flow.glsl';

const HALF_U = Math.atan(AT);
const HALF_V = Math.atan(T_HALF);
const U_FOLD: readonly [number, number] = [0.5 - Math.PI / (4 * HALF_U), 0.5 + Math.PI / (4 * HALF_U)];

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 vp = inverse(projectionMatrix) * vec4(position.xy, 1.0, 1.0);
  vDir = transpose(mat3(viewMatrix)) * (vp.xyz / vp.w);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
#include <common>
${GLSL_PRELUDE}
uniform float uBdLayers;
varying vec3 vDir;
#define BD_HALF_U ${f(HALF_U)}
#define BD_HALF_V ${f(HALF_V)}
#define BD_CELL 0.03
#define BD_LEN 0.0225
float bdFold(float x, float a, float b) {
  float t = (x - a) / (b - a);
  return a + (1.0 - abs(mod(t, 2.0) - 1.0)) * (b - a);
}
vec3 bdLayer(vec2 p, vec2 fd, float layer, vec3 base, float earth, float aa) {
  vec2 q = p / BD_CELL + vec2(0.5, 0.37) * layer;
  vec2 cell = floor(q);
  vec2 nrm = vec2(-fd.y, fd.x);
  vec3 col = base;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      vec2 h = hash22(c + 17.0 * layer);
      vec2 l = (q - (c + 0.15 + 0.7 * h)) * BD_CELL;
      float a = BD_LEN * (0.8 + 0.4 * hash21(c * 1.7 + 3.1 + layer));
      float b = 0.25 * a;
      float al = dot(l, fd) / a;
      float ac = dot(l, nrm) / b;
      float e = sqrt(al * al * al * al + ac * ac);
      float cov = 1.0 - smoothstep(1.0 - aa / b, 1.0 + aa / b, e);
      if (cov <= 0.0) continue;
      float k = hash21(c + 5.3 * layer + 11.0);
      float k2 = hash21(c * 0.73 + 2.9 * layer + 41.0);
      vec2 pc = (c + 0.15 + 0.7 * h - vec2(0.5, 0.37) * layer) * BD_CELL;
      float band = fract(7.0 * (pc.y + 0.03 * sin(4.0 * pc.x)) + 0.16 * (k - 0.5));
      vec3 sky = band < 0.47 ? mix(PAL_COBALT, PAL_ULTRAMARINE, 0.6 * k2)
               : band < 0.84 ? mix(PAL_CERULEAN, PAL_COBALT, 0.6 * k2)
               : mix(PAL_ZINC_WHITE, PAL_CERULEAN, 0.35 + 0.4 * k2);
      sky = mix(sky, PAL_PRUSSIAN, 0.25) * 0.62;
      vec3 grd = mix(PAL_PRUSSIAN, PAL_CYPRESS_DARK, k);
      vec3 sc = mix(sky, grd, earth);
      sc *= (0.86 + 0.14 * sin(ac * 7.0 + 6.2831 * k)) * (0.92 + 0.12 * (1.0 - abs(al)));
      col = mix(col, sc, cov);
    }
  }
  return col;
}
void main() {
  vec3 dir = normalize(vDir);
  vec3 q = transpose(uEyeBasis) * dir;
  float ub = 0.5 + atan(q.x, -q.z) / (2.0 * BD_HALF_U);
  float vRaw = 0.5 + asin(clamp(q.y, -1.0, 1.0)) / (2.0 * BD_HALF_V);
  ub = bdFold(ub, ${f(U_FOLD[0])}, ${f(U_FOLD[1])});
  float vb = bdFold(vRaw, ${f(GEN_V[0])}, ${f(GEN_V[1])});
  vec2 p = vec2(ub * CANVAS_ASPECT, vb);
  vec2 fl = flowField(p);
  float fm = length(fl);
  vec2 fd = fm > 1e-6 ? fl / fm : vec2(1.0, 0.0);
  float rv = ridgeV(ub, 2.0);
  float earth = 1.0 - smoothstep(rv - 0.004, rv + 0.004, vRaw);
  vec2 dp = fwidth(p);
  float aa = clamp(0.5 * (dp.x + dp.y), 1e-5, 0.004);
  vec3 base = mix(mix(PAL_ULTRAMARINE, PAL_COBALT, 0.3) * 0.6, mix(PAL_PRUSSIAN, PAL_CYPRESS_DARK, 0.5) * 0.7, earth);
  vec3 col = bdLayer(p, fd, 0.0, base, earth, aa);
  if (uBdLayers > 1.5) col = bdLayer(p, fd, 1.0, col, earth, aa);
  float back = smoothstep(-0.05, 0.45, q.z);
  float st = clamp(snLum(col) / max(snLum(PAL_ZINC_WHITE) * 0.62, 1e-3), 0.0, 1.0);
  vec3 voidCol = PAL_VOID_DEEP * (0.85 + 0.3 * st) + PAL_ULTRAMARINE * (0.06 * st);
  col = mix(col, voidCol, back);
  col = clamp(col, 0.0, 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createBackdropOld(u: SharedUniforms, q: QualitySettings): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const material = new ShaderMaterial({
    name: 'punctum.backdropOld', uniforms: { ...u, uBdLayers: { value: q.backdropLayers } },
    vertexShader, fragmentShader, depthTest: false, depthWrite: false, transparent: false, fog: false, lights: false,
  });
  const mesh = new Mesh(g, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
