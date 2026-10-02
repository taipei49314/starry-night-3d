// Shared flow field and motif laws (§3); line-for-line twin of src/shared/flowField.ts and canvasSpace.jetPoint.
import { GLSL_HEADER } from './header';
import { GLSL_COMMON, GLSL_SHARED_UNIFORMS } from './common.glsl';

export const GLSL_FLOW = /* glsl */ `
vec2 perp(vec2 a) { return vec2(-a.y, a.x); }

float ridgeV(float u, float k) {
  return 0.300 + 0.030 * k
       + 0.028 * sin(SN_TAU * (1.6 * u + 0.15 + 0.21 * k))
       + 0.011 * sin(SN_TAU * (4.7 * u + 0.40 - 0.30 * k));
}

float skyMask(vec2 p) {
  float r = ridgeV(p.x / CANVAS_ASPECT, 2.0);
  return smoothstep(r, r + 0.05, p.y);
}

vec2 bandFlow(vec2 p) {
  float a = 4.0 * p.x + 9.0 * p.y;
  float b = 9.3 * p.x - 5.0 * p.y + 1.7;
  vec2 v = vec2(1.0 - 0.198 * cos(a) + 0.060 * cos(b), 0.088 * cos(a) + 0.1116 * cos(b));
  float strength = 0.62 + 0.38 * sin(SN_TAU * 7.0 * p.y + 1.3 * sin(2.1 * p.x));
  return 0.25 * strength * v;
}

vec2 vortexFlow(vec2 p, vec4 V, vec2 W) {
  vec2 d = p - V.xy;
  float r2 = max(dot(d, d), 1e-6);
  float prof = (1.0 - exp(-r2 / (V.w * V.w))) * exp(-r2 / (2.0 * W.x * W.x)) / r2;
  return prof * (V.z * perp(d) - W.y * abs(V.z) * d);
}

vec2 haloFlow(vec2 p, vec4 S) {
  vec2 d = p - S.xy;
  float r = length(d) + 1e-5;
  float R = abs(S.w);
  float m = smoothstep(R * 1.15, R * 0.85, r) * smoothstep(S.z * 0.5, S.z * 1.2, r);
  return 0.35 * sign(S.w) * m * perp(d) / r;
}

vec2 hillFlow(vec2 p) {
  float u = p.x / CANVAS_ASPECT, e = 0.002;
  float slope = (ridgeV(u + e, 1.0) - ridgeV(u - e, 1.0)) / (2.0 * e * CANVAS_ASPECT);
  return 0.12 * normalize(vec2(1.0, slope));
}

// p = (u * A, v)
vec2 flowField(vec2 p) {
  vec2 v = bandFlow(p);
  for (int i = 0; i < N_VORT; i++) v += vortexFlow(p, VORT[i], VORT_W[i]);
  for (int k = 0; k < N_STAR; k++) v += haloFlow(p, STAR[k]);
  v += haloFlow(p, MOON);
  return mix(hillFlow(p), v, skyMask(p));
}

// Arm law: r = r0 (rmax/r0)^sigma; theta = arm*PI + 0.37 vi - sign(gamma) ln(r/r0)/beta; d = dThroat (r/r0)^expo.
// Outputs canvas uv, depth d, tangent tH (h-units per unit sigma) and dlnd per unit sigma.
void armPoint(int vi, float arm, float sigma, float across, out vec2 uv, out float d, out vec2 tH, out float dlndS) {
  vec4 V = VORT[vi];
  vec2 W = VORT_W[vi];
  vec4 G = VORT_GEO[vi];
  float lnR = log(G.y / G.x);
  float r = G.x * exp(lnR * sigma);
  float sg = sign(V.z);
  float th = arm * SN_PI + 0.37 * float(vi) - sg * lnR * sigma / W.y;
  vec2 er = vec2(cos(th), sin(th));
  float dth = -sg * lnR / W.y;
  vec2 dp = lnR * r * er + r * dth * perp(er);
  vec2 n = normalize(perp(dp));
  vec2 p = V.xy + r * er + n * (across * 0.2 * r);
  uv = vec2(p.x / CANVAS_ASPECT, p.y);
  d = G.z * exp(G.w * lnR * sigma);
  tH = dp;
  dlndS = G.w * lnR;
}

// Ring k of star si (moon = MOON_INDEX): centre (h-units), radius rho (h-units), depth d.
void ringGeom(int si, float k, out vec2 cH, out float rho, out float d) {
  if (si == MOON_INDEX) {
    cH = MOON.xy; rho = MOON.z + MOON_RING_RHO * k; d = MOON_D.x * (1.0 + MOON_RING_D * k);
  } else {
    vec4 S = STAR[si];
    cH = S.xy; rho = S.z * (1.0 + STAR_RING_RHO * k); d = STAR_D[si].x * (1.0 + STAR_RING_D * k);
  }
}

// Wind-jet filament: cubic Bezier over JET_CTRL, offset along its normal by off (h-units). tH in h-units per unit sigma.
void jetPoint(float s, float off, out vec2 uv, out float d, out vec2 tH) {
  float m = 1.0 - s;
  uv = m * m * m * JET_CTRL[0] + 3.0 * m * m * s * JET_CTRL[1] + 3.0 * m * s * s * JET_CTRL[2] + s * s * s * JET_CTRL[3];
  vec2 t = 3.0 * m * m * (JET_CTRL[1] - JET_CTRL[0]) + 6.0 * m * s * (JET_CTRL[2] - JET_CTRL[1]) + 3.0 * s * s * (JET_CTRL[3] - JET_CTRL[2]);
  tH = vec2(t.x * CANVAS_ASPECT, t.y);
  vec2 n = normalize(perp(tH));
  uv += vec2(n.x / CANVAS_ASPECT, n.y) * off;
  d = JET_D0 * pow(JET_D1 / JET_D0, s);
}
`;

/** Everything a scene shader needs before its own code: constants, shared uniforms, helpers, flow field. */
export const GLSL_PRELUDE = GLSL_HEADER + GLSL_SHARED_UNIFORMS + GLSL_COMMON + GLSL_FLOW;
