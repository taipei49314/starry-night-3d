// Stroke fragment shader (§4.3 normative block): bristle, width profile, dry brush, lay-in mask, impasto height
// with an analytic normal, gallery/moon diffuse, wet specular, two-colour mix, outline, emissive, ratio fog.
// Loop-free. HASHED_ALPHA (no-MSAA tier) discards against interleaved gradient noise; otherwise the alpha is
// written for alpha-to-coverage.
import { GLSL_PRELUDE } from '../../shared/glsl/flow.glsl';

export const strokeFrag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${GLSL_PRELUDE}

varying vec4 vStk0;  // s, w, seed, lay-in time
varying vec4 vStkA;  // colour A, emissive
varying vec4 vStkB;  // colour B, impasto factor
varying vec4 vStkT;  // tangent, alpha multiplier
varying vec4 vStkBi; // binormal, outline weight
varying vec4 vStkN;  // ribbon normal, fog amount
varying vec4 vStkL;  // light direction, fog colour mix
varying vec4 vStkV;  // direction to camera, underlayer flag

// 1-D value noise along the stroke, one independent lane per stroke (the spec's vnoise2(vec2(x, k*seed)) has a constant
// second coordinate per stroke, so this is the same family at half the hashes).
float stkNoise1(float x, float lane) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i + lane), hash11(i + 1.0 + lane), f);
}

void main() {
  float s = vStk0.x;
  float w = vStk0.y;
  float seed = vStk0.z;
  float tl = vStk0.w;
  bool under = vStkV.w > 1.5;
  float aw = abs(w);
  float fw = fwidth(w);

  // bristle(w) = 0.5 + 0.5 sin(PI nb w + 6.283 seed + 0.7 noise(3s, seed)), nb = 9 + 5 seed.
  // Its amplitude fades as a bristle period drops from 4 px to 2 px (anti-aliasing LOD); underlayers have none.
  float nb = 9.0 + 5.0 * seed;
  float ph = 6.283 * seed + 0.7 * stkNoise1(3.0 * s, 97.31 * seed);
  float bAmp = under ? 0.0 : 1.0 - smoothstep(0.5, 1.0, fw * nb);
  float arg = SN_PI * nb * w + ph;
  float sinA = sin(arg);
  float br = 0.5 + 0.5 * bAmp * sinA;

  // width profile and coverage mask
  // underlayers: flat, full-bodied lozenge with a ragged edge (fills holes without reading as CG rectangles)
  float wn = stkNoise1(18.0 * s, 53.17 * seed + 11.0);
  float wp = under ? smoothstep(0.0, 0.18, s) * smoothstep(1.0, 0.82, s) * (0.8 + 0.2 * wn)
                   : smoothstep(0.0, 0.1, s) * (1.0 - 0.4 * s) * (1.0 + 0.1 * wn);
  wp = max(wp, 1e-3);
  float mask = 1.0 - smoothstep(1.0 - 1.5 * fw / wp, 1.0, aw / wp);
  // dry brush tail: mask *= step(0.55 (s - 0.72) / 0.28, bristle(w)), edge anti-aliased by fwidth
  // (all derivatives are taken here, in uniform control flow, before any discard)
  float fbr = max(fwidth(br), 1e-4);
  float eDry = 0.55 * (s - 0.72) / 0.28;
  mask *= (!under && s > 0.72) ? clamp((br - eDry) / fbr + 0.5, 0.0, 1.0) : 1.0;
  // lay-in: the stroke is drawn from s = 0 to 1 over 0.4 s, starting at its lay-in time
  if (uLayIn >= 0.0 && tl >= 0.0) mask *= step(s, (uLayIn - tl) / 0.4);

  // coverage first: discarded fragments skip all shading
  float alpha = mask * vStkT.w;
#ifdef HASHED_ALPHA
  if (alpha <= 0.0 || alpha < ign(gl_FragCoord.xy)) discard;
  alpha = 1.0;
#else
  if (alpha < 0.004) discard;
#endif

  // impasto height h = (0.3 + exp(-2.2 s)) (1 - w^2) (0.62 + 0.38 bristle(w)) imp, analytic partials
  float imp = vStkB.w;
  float e22 = exp(-2.2 * s);
  float prof = 0.3 + e22;
  float bri = 0.62 + 0.38 * br;
  float cosA = cos(arg);
  float dbr = 0.5 * bAmp * cosA * SN_PI * nb;
  float omw = 1.0 - w * w;
  float dhdw = prof * imp * (-2.0 * w * bri + omw * 0.38 * dbr);
  float dhds = -2.2 * e22 * omw * bri * imp;
  // interpolated frame vectors are within a few 1e-3 of unit length; only n is renormalised
  vec3 n = normalize(vStkBi.xyz * (-1.4 * dhdw) + vStkT.xyz * (-1.4 * dhds) + vStkN.xyz);

  vec3 L = normalize(vStkL.xyz);
  vec3 V = normalize(vStkV.xyz);
  float ndl = max(dot(n, L), 0.0);
  float diffuse = mix(0.55 + 0.45 * ndl, 0.72 + 0.28 * ndl, uAlign);
  float spec = min(uSpecular * 0.16 * pow(max(dot(reflect(-L, n), V), 0.0), 28.0) * imp, 4.0) * min(vStkV.w, 1.0);

  // bristle(w + 0.37) by angle addition (per-stroke constant phase step)
  float c37 = SN_PI * nb * 0.37;
  float br2 = 0.5 + 0.5 * bAmp * (sinA * cos(c37) + cosA * sin(c37));
  vec3 col = mix(vStkA.rgb, vStkB.rgb, 0.45 * smoothstep(0.35, 0.65, br2));
  col = mix(col, PAL_OUTLINE, vStkBi.w * smoothstep(0.7, 1.0, aw / wp));
  float em = vStkA.w;
  // the glint takes on some of the paint's own hue so dark blues do not wash out to grey
  vec3 specC = spec * mix(vec3(1.0), col / max(max(col.r, max(col.g, col.b)), 1e-3), 0.6);
  col = col * diffuse + specC + col * em;
  vec3 fogC = mix(0.5 * PAL_ULTRAMARINE, PAL_PRUSSIAN, vStkL.w);
  col = mix(col, fogC, vStkN.w * (em > 0.0 ? 0.25 : 1.0));

  gl_FragColor = vec4(col, alpha);
#ifdef STK_DEBUG
  // harness inspection: 1 diffuse, 2 specular x 10, 3 normal, 4 impasto factor / 4, 5 bristle
  gl_FragColor.rgb = STK_DEBUG == 1 ? vec3(diffuse) : STK_DEBUG == 2 ? specC * 10.0 : STK_DEBUG == 3 ? n * 0.5 + 0.5
    : STK_DEBUG == 4 ? vec3(imp * 0.25) : vec3(br);
#endif
#include <logdepthbuf_fragment>
#include <tonemapping_fragment>
#include <colorspace_fragment>
}
`;
