// Shared GLSL: uniform declarations, hashing/noise, colour unpack, canvas mapping, storm field.
// Include order in every scene shader:  GLSL_PRELUDE (= header + uniforms + common + flow), then module code.
// Never redeclare a uniform that GLSL_SHARED_UNIFORMS declares.
import { CLASS_COUNT } from '../../contracts';

export const GLSL_SHARED_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform vec3 uEye;
uniform mat3 uEyeBasis;
uniform float uWarpK;
uniform float uOff;
uniform float uAlign;
uniform float uScatter;
uniform float uSnapTime;
uniform float uScatterAtSnap;
uniform float uLayIn;
uniform float uInflate;
uniform float uImpastoGain;
uniform vec3 uGalleryLight;
uniform vec3 uMoonPos;
uniform vec3 uCamVel;
uniform float uPxPerRad;
uniform float uViewportH;
uniform float uWidthComp[${CLASS_COUNT}];
uniform vec4 uStir;
uniform float uSpecular;
uniform float uVelStretch;
uniform float uDustAlpha;
uniform vec3 uFogNear;
uniform vec3 uFogFar;
uniform float uSkyMode;
uniform float uLayerFade;
`;

export const GLSL_COMMON = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash31(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise2(vec2 p) {
  vec2 i = floor(p), fr = fract(p);
  vec2 w = fr * fr * (3.0 - 2.0 * fr);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), w.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), w.x), w.y);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p), fr = fract(p);
  vec3 w = fr * fr * (3.0 - 2.0 * fr);
  float a = mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), w.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), w.x), w.y);
  float b = mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), w.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), w.x), w.y);
  return mix(a, b, w.z);
}
// interleaved gradient noise (hashed alpha on the no-MSAA tier)
float ign(vec2 px) { return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))); }

vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
// a2.x / a2.y: sRGB 0xRRGGBB stored as float -> linear RGB
vec3 unpackSrgb(float c) {
  int ci = int(c + 0.5);
  return srgbToLinear(vec3(float((ci >> 16) & 255), float((ci >> 8) & 255), float(ci & 255)) / 255.0);
}
float snLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// ---- canvas mapping (§2.1); identical to src/shared/canvasSpace.ts
vec3 canvasDir(vec2 uv) { return uEyeBasis * vec3((2.0 * uv.x - 1.0) * AT, (2.0 * uv.y - 1.0) * T_HALF, -1.0); }
float warpDepth(float d) { return uWarpK == 1.0 ? d : 1000.0 * pow(max(d, 1e-3) / 1000.0, uWarpK); }
vec3 canvasToWorld(vec2 uv, float d) { return uEye + warpDepth(d) * canvasDir(uv); }
// returns (u, v, d) for an unwarped world point
vec3 worldToCanvas(vec3 P) {
  vec3 q = transpose(uEyeBasis) * (P - uEye);
  float d = -q.z;
  return vec3(0.5 + q.x / (2.0 * AT * d), 0.5 + q.y / (2.0 * T_HALF * d), d);
}
// canvas fractions <-> flow space (h-units)
vec2 uvToH(vec2 uv) { return vec2(uv.x * CANVAS_ASPECT, uv.y); }
vec2 hToUv(vec2 p) { return vec2(p.x / CANVAS_ASPECT, p.y); }

// ---- storm (§3): divergence-free, periodic in 24 s; |result| ~ 1
vec3 stormField(vec3 q, float t) {
  float w = SN_TAU * t / 24.0;
  const float a = 1.7, b = 1.1;
  vec3 c1 = vec3(b * cos(b * q.y + 2.1 + w) - a * cos(a * q.z + 0.7 - w),
                 b * cos(b * q.z + 4.4 - w) - a * cos(a * q.x + 1.9 + w),
                 b * cos(b * q.x + 0.3 + w) - a * cos(a * q.y + 5.2 - w));
  vec3 r = vec3(0.8 * q.y + 0.6 * q.z, 0.8 * q.z - 0.6 * q.x, 0.8 * q.x + 0.6 * q.y) * 2.3;
  vec3 c2 = vec3(cos(r.y + 1.3 - w) - cos(r.z + 2.8 + w),
                 cos(r.z + 0.4 + w) - cos(r.x + 3.6 - w),
                 cos(r.x + 5.0 - w) - cos(r.y + 0.9 + w));
  return (c1 + 0.45 * c2) * 0.42;
}
// damped spring used by the snap: 1 before the wave front arrives, then rings down
float spring(float tau, float seed) { return tau < 0.0 ? 1.0 : exp(-6.0 * tau) * cos(18.0 * tau + 2.0 * seed); }
`;
