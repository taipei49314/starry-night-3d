// Stroke vertex shader (§4.3 steps 1-11, normative). One source for every class; all animation is
// closed-form in canvas space, so the image from E is exact while it moves.
//
// Depth warp: every position is built unwarped (d) and then pushed radially about E to its warped depth
// d' = warpDepth(d) (stkWarp). Endpoints therefore equal the prelude's canvasToWorld(uv, d) exactly, and
// every other vertex (ribbon edges, spine bow) keeps its projection from E for any uWarpK.
import { GLSL_PRELUDE } from '../../shared/glsl/flow.glsl';

export const strokeVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
${GLSL_PRELUDE}

attribute vec4 a0;   // u, v, d, cls + FLAG_STRIDE * flags
attribute vec4 a1;   // du, dv, dlnd, W     (VORTEX/RING/JET: L, 0, 0, W)
attribute vec4 a2;   // colA, colB, emissive, seed
attribute vec4 a3;   // kappa, q1, q2, q3

varying vec4 vStk0;  // s, w, seed, lay-in time
varying vec4 vStkA;  // colour A (linear), emissive
varying vec4 vStkB;  // colour B (linear), impasto factor
varying vec4 vStkT;  // tangent, alpha multiplier
varying vec4 vStkBi; // binormal, outline weight
varying vec4 vStkN;  // ribbon normal (toward camera), fog amount
varying vec4 vStkL;  // light direction, fog colour mix
varying vec4 vStkV;  // direction to camera, underlayer flag (2) or specular weight
// per-class specular weight: the wet highlight is white paint catching light, kept faint on near-black motifs
const float STK_SPEC_W[CLASS_COUNT] = float[CLASS_COUNT](1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.6, 0.5, 0.4, 0.3, 1.0, 0.3, 0.25);

const float STK_BAND_T[4] = float[4](8.0, 12.0, 16.0, 24.0);
#ifdef HASHED_ALPHA
const float STK_RING_MIN_PX = 2.0;   // no MSAA, low render scale: dithered 1 px bands read as dotted rings
#else
const float STK_RING_MIN_PX = 1.0;
#endif
#ifndef STK_LOD_PX
#define STK_LOD_PX 20.0
#endif

vec3 stkC2W(vec2 uv, float d) { return uEye + d * canvasDir(uv); }

// Radial depth warp about E: keeps the direction from E, maps the forward depth d to warpDepth(d).
vec3 stkWarp(vec3 P) {
  if (uWarpK == 1.0) return P;
  vec3 q = P - uEye;
  float dz = -dot(uEyeBasis[2], q);
  if (dz <= 1e-3) return P;
  return uEye + q * (warpDepth(dz) / dz);
}

void main() {
  float s = position.x;
  float wv = position.y;

  // ---- 1. decode
  int packedCls = int(a0.w + 0.5);
  int stride = int(FLAG_STRIDE);
  int cls = packedCls - (packedCls / stride) * stride;
  int flags = packedCls / stride;
  bool under = (flags & FLAG_UNDERLAYER) != 0;
  bool outlined = (flags & FLAG_OUTLINE) != 0;
  int kind = ANIM_KIND[cls];
  float seed = a2.w;

  vec2 uv = a0.xy;
  float d = a0.z;
  vec2 dH = a1.xy;          // stroke vector in h-units
  float dlnd = a1.z;
  float W = a1.w;
  float emissive = a2.z;
  vec3 cA = unpackSrgb(a2.x);
  vec3 cB = unpackSrgb(a2.y);
  float alphaMul = 1.0;
  // minimum screen footprint (px) for small emissive strokes (windows, star cores) and the church
  bool emisFoot = a2.z >= 1.5;
  float minWpx = emisFoot ? 1.5 : (cls == CLS_CHURCH ? 1.6 : 0.0);
  float minLpx = emisFoot ? 2.0 : (cls == CLS_CHURCH ? 2.2 : 0.0);

  // ---- 2. animate in canvas space (all periods divide 96 s)
  if (kind == ANIM_VORTEX) {
    float q1h = floor(a3.y * 0.5);
    int vi = clamp(int(q1h), 0, N_VORT - 1);
    float arm = a3.y - 2.0 * q1h;
    float sig = fract(a3.z - uTime / 24.0);
    vec2 tH; float dlS;
    armPoint(vi, arm, sig, a3.w, uv, d, tH, dlS);
    d *= 1.0 + 0.02 * (seed - 0.5);
    if (under) d *= 1.01;                       // funnel shell sits just behind the arms
    // a stroke streams through every radius: keep it sized for where it is now, r(sig) / r(sigma0)
    // (exactly 1 at t = 0, where sig == fract(sigma0), so the canvas pose is unchanged)
    float vScale = clamp(exp(log(VORT_GEO[vi].y / VORT_GEO[vi].x) * (sig - fract(a3.z))), 0.4, 2.5);
    W *= vScale;
    float tl = max(length(tH), 1e-9);
    dH = tH / tl * (a1.x * vScale);
    dlnd = dlS * (a1.x * vScale) / tl;
    alphaMul *= smoothstep(0.0, 0.06, sig) * smoothstep(1.0, 0.94, sig);
  } else if (kind == ANIM_RING) {
    int si = clamp(int(a3.y + 0.5), 0, MOON_INDEX);
    int ki = int(a3.z + 0.5);
    vec2 cH; float rho; float dr;
    ringGeom(si, float(ki), cH, rho, dr);
    float spinDir = (ki - (ki / 2) * 2) == 0 ? 1.0 : -1.0;
    float turns = float(1 + ki - (ki / 3) * 3);
    vec2 rel = vec2(a0.x * CANVAS_ASPECT - cH.x, a0.y - cH.y);
    float ang = atan(rel.y, rel.x) + spinDir * SN_TAU * turns * uTime / LOOP_SECONDS;
    float rr = rho * (1.0 + 0.04 * a3.w);
    vec2 cs = vec2(cos(ang), sin(ang));
    uv = hToUv(cH + rr * cs);
    // d = d_k; a generator depth jitter (record d / d_k within 3 %) is kept so overlapping ring strokes never z-fight.
    float jr = a0.z / dr;
    d = dr * (abs(jr - 1.0) < 1e-5 ? 1.0 + 0.01 * (seed - 0.5) : clamp(jr, 0.97, 1.03));
    // the coloured bands (in front of their ring, jr < 1) keep a minimum on-screen width so a halo never breaks into
    // dots at a low render scale; the dark backing rings behind them (jr > 1) keep their painted width
    if (jr < 1.005) minWpx = max(minWpx, STK_RING_MIN_PX);
    dH = vec2(-cs.y, cs.x) * a1.x;
    dlnd = 0.0;
  } else if (kind == ANIM_BAND) {
    int bandIdx = clamp(int(a3.z + 0.5), 0, 3);
    float k = 0.5 * a3.y * sin(SN_TAU * uTime / STK_BAND_T[bandIdx] + SN_TAU * a3.w);
    uv += vec2(a1.x / CANVAS_ASPECT, a1.y) * k;
  } else if (kind == ANIM_CYPRESS) {
    uv.x += 0.004 * sin(SN_TAU * uTime / 6.0 + 5.0 * a0.y + SN_TAU * seed) * clamp(a0.y, 0.0, 1.0);
  } else if (kind == ANIM_JET) {
    float sig = fract(a3.y + uTime / 8.0);
    vec2 tH;
    jetPoint(sig, a3.z, uv, d, tH);
    d *= 1.0 + a3.w;
    float tl = max(length(tH), 1e-9);
    dH = tH / tl * a1.x;
    dlnd = log(JET_D1 / JET_D0) * a1.x / tl;
    // colour ramp along sigma: cypress green -> cerulean -> zinc white; the record colours tint it 35 %
    vec3 ramp = sig < 0.5 ? mix(PAL_CYPRESS_GREEN, PAL_CERULEAN, sig * 2.0) : mix(PAL_CERULEAN, PAL_ZINC_WHITE, sig * 2.0 - 1.0);
    cA = mix(ramp, cA, 0.35);
    cB = mix(ramp, cB, 0.35);
    emissive *= sig;                             // a2.z = emissive at the Venus end (0 -> 1.1 along sigma)
    alphaMul *= smoothstep(0.0, 0.05, sig) * smoothstep(1.0, 0.95, sig);
  } else if (kind == ANIM_FLICKER) {
    emissive *= 0.85 + 0.15 * sin(SN_TAU * uTime / 4.0 + 6.283 * seed);
  }

  // ---- 3. stir the sky (h-units about uStir.xy)
  if (CLASS_SKY[cls] > 0.5 && uStir.z > 0.0) {
    vec2 q = uvToH(uv) - uStir.xy;
    float ang = 1.2 * uStir.z * exp(-dot(q, q) / max(uStir.w * uStir.w, 1e-8));
    mat2 R = rot2(ang);
    uv = hToUv(uStir.xy + R * q);
    dH = R * dH;
  }

  // ---- 4. endpoints (unwarped)
  vec2 hOff = 0.5 * vec2(dH.x / CANVAS_ASPECT, dH.y);
  float eHalf = exp(0.5 * dlnd);
  vec3 PA = stkC2W(uv - hOff, d / eHalf);
  vec3 PB = stkC2W(uv + hOff, d * eHalf);
  vec3 Tv = PB - PA;
  float Lw = length(Tv);
  vec3 T = Tv / max(Lw, 1e-9);

  // ---- 5. storm (uniform branch)
  if (uScatter != 0.0 || (uSnapTime >= 0.0 && uScatterAtSnap != 0.0)) {
    vec2 snapOrigin = uSkyMode < 0.05 ? STAR[0].xy : uvToH(worldToCanvas(uMoonPos).xy);
    float amp = uSnapTime < 0.0 ? uScatter
      : uScatterAtSnap * spring(uTime - uSnapTime - 0.9 * length(uvToH(uv) - snapOrigin), seed);
    vec3 Pc = stkC2W(uv, d);
    vec3 D = amp * 0.05 * d * stormField(Pc / (0.15 * d) + 7.0 * seed, uTime);
    float dl = length(D);
    if (dl > 1e-9) T = normalize(T + 0.8 * amp * D / dl);
    vec3 Pm0 = 0.5 * (PA + PB) + D;
    PA = Pm0 - 0.5 * Lw * T;
    PB = Pm0 + 0.5 * Lw * T;
  }
  vec3 Pm = 0.5 * (PA + PB);

  // minimum footprint: lengthen along T about the midpoint (stays on the same canvas line seen from E)
  float pxW = length(cameraPosition - Pm) / max(uPxPerRad, 1e-6);   // world metres per pixel at the stroke
  if (minLpx > 0.0 && Lw < minLpx * pxW) {
    Lw = minLpx * pxW;
    PA = Pm - 0.5 * Lw * T;
    PB = Pm + 0.5 * Lw * T;
  }

  // ---- 6. frame
  float Ww = max(W * 2.0 * T_HALF * d * uWidthComp[cls] * (under ? 3.0 : 1.0), minWpx * pxW);
  vec3 Bimg = uEyeBasis * vec3(-dH.y, dH.x, 0.0);
  Bimg -= T * dot(Bimg, T);
  float bl = length(Bimg);
  Bimg = bl > 1e-12 ? Bimg / bl : normalize(cross(T, uEyeBasis[2]) + vec3(1e-7, 0.0, 0.0));
  vec3 B = Bimg;
  if (CLASS_SOLID[cls] > 0.5) {
    vec3 N = a3.yzw;
    vec3 Bs = cross(N, T);
    float l = length(Bs);
    if (l > 1e-4 * max(length(N), 1e-9)) B = Bs / l;
  } else if (uOff > 0.0) {
    vec3 Bv = cross(T, normalize(cameraPosition - Pm));
    float bvl = length(Bv);
    if (bvl >= 0.05) {
      Bv /= bvl;
      if (dot(Bv, Bimg) < 0.0) Bv = -Bv;
      B = normalize(mix(Bimg, Bv, uOff));
    }
  }
  vec3 Nb = cross(B, T);
  if (dot(Nb, cameraPosition - Pm) < 0.0) Nb = -Nb;

  // Per-stroke screen measures (identical for every vertex of the stroke). They use the unwarped stroke, i.e. the
  // stroke as painted: equal to the warped values at uWarpK = 1, and exactly warp-invariant seen from E.
  float dist = length(cameraPosition - Pm);
  float Lpx = Lw / max(dist, 1e-6) * uPxPerRad;
  vec3 PAw = stkWarp(PA), PBw = stkWarp(PB);
  float LwW = max(length(PBw - PAw), 1e-9);

  // ---- 7. spine (bowed along Nb by kappa) and ribbon edge
  // Vertex LOD: a stroke shorter than STK_LOD_PX keeps only its end stations, so its interior triangles collapse to
  // zero area and are rejected before rasterisation (thin slivers cost whole 2x2 quads); the bow is sub-pixel there.
  bool lod = Lpx < STK_LOD_PX;
  float sv = lod ? step(0.5, s) : s;
  float kap = a3.x;
  vec3 Ps = mix(PA, PB, sv) + Nb * (kap * 4.0 * sv * (1.0 - sv) * 0.25 * Lw);
  vec3 Pv = Ps + B * (wv * 0.5 * Ww * (lod ? 1.0 : 0.85 + 0.15 * sin(SN_PI * sv)));
  float bend = kap * (1.0 - 2.0 * sv);          // spine slope along Nb (per unit Lw)
  vec3 Ts = normalize(T + Nb * bend);
  vec3 Ns = normalize(Nb - T * bend);

  // depth warp (identity at uWarpK = 1); the unwarped vertex keeps driving the log depth (see the end of main)
  vec3 PvU = Pv;
  Pv = stkWarp(Pv);

  // ---- 8. velocity stretch
  if (uVelStretch > 0.5) {
    float vl = length(uCamVel);
    if (vl > 1e-4) {
      float stretch = min(vl * (1.0 / 60.0) * 1.5, 3.0 * LwW);
      if (sv < 0.5) Pv -= uCamVel / vl * stretch * (0.5 - sv) * 2.0;
      // thin the stretched streak to keep its energy, but never let near solids or the cypress turn see-through
      if (cls != CLS_CYPRESS && CLASS_SOLID[cls] < 0.5) alphaMul *= max(0.5, 1.0 / (1.0 + stretch / LwW));
    }
  }

  // ---- 9. overdraw guards
  float kpx = uViewportH / 1080.0;
  // upper screen-size fade; VORTEX strokes are exempt (the funnel walls must frame a camera inside the throat) and
  // keep only a near-lens guard at about one screen height, on top of the dist / Lw guard below
  float upper = (cls == CLS_UNDERPAINT || uAlign > 0.5) ? 1.0
    : kind == ANIM_VORTEX ? 1.0 - smoothstep(0.35 * uViewportH, 0.8 * uViewportH, Lpx)
    : 1.0 - smoothstep(180.0 * kpx, 320.0 * kpx, Lpx);
  bool minFoot = minLpx > 0.0;                 // already at least minLpx long: no low-end fade, no sub-pixel cull
  // near-lens guard: a stroke closer than a few of its own lengths dissolves (wider window for the streaming vortex
  // walls, whose strokes otherwise pass the lens as long translucent planks)
  vec2 nearG = kind == ANIM_VORTEX ? (under ? vec2(4.0, 10.0) : vec2(2.5, 6.0)) : vec2(0.8, 2.5);
  alphaMul *= (minFoot ? 1.0 : smoothstep(1.5, 4.0, Lpx)) * upper * smoothstep(nearG.x, nearG.y, dist / max(Lw, 1e-9));
  // extended sky (SKY_GEN_EXT): dissolve toward the generated extent's edge so wide shots never see its rectangle
  // the wind jet is a 3D-only motif: from the painter's eye it would read as a scratch across the canvas
  if (kind == ANIM_JET) alphaMul *= 1.0 - uAlign;
  if (cls == CLS_UNDERPAINT || cls == CLS_SKY_BAND) {
    // left, right and top edges only: the bottom of the extent sits behind the hills and must stay solid
    vec2 m2 = min(a0.xy - SKY_GEN_EXT.xy, SKY_GEN_EXT.zw - a0.xy);
    alphaMul *= smoothstep(0.0, SKY_EDGE_FADE, min(m2.x, SKY_GEN_EXT.w - a0.y));
  }
  if (uLayerFade < 0.9999) {
    alphaMul *= smoothstep(0.0, 0.55, uLayerFade - 0.45 * seed);
  }
  vec4 vA = viewMatrix * vec4(PAw, 1.0);
  vec4 vB = viewMatrix * vec4(PBw, 1.0);
  bool behind = vA.z > 0.0 && vB.z > 0.0;
  bool cull = behind || (!minFoot && Lpx < 0.35) || alphaMul < 1e-3;

  // ---- 10. varyings
  vec2 pH = uvToH(uv);
  float tLay = cls == CLS_UNDERPAINT ? -1.0 : 2.0 * clamp(length(pH - LAYIN_CENTER) / 1.25, 0.0, 1.0);
  float imp = smoothstep(0.0, 0.12, 0.55 * uInflate - length(pH - STAR[0].xy)) * uImpastoGain;
  if (uInflate >= 10.0) imp = uImpastoGain;
  if (under) imp = 0.0;

  vec3 toCam = cameraPosition - Pv;
  float dc = length(toCam);
  float dE = max(length(Pv - uEye), 1.0);
  float fog = 0.7 * (1.0 - exp(-0.5 * max(0.0, log(dc / dE))));
  if (cls == CLS_CHURCH) fog *= 0.35;
  float fogMix = smoothstep(3.0, 5.3, log2(dE) * 0.30102999566);

  vStk0 = vec4(sv, wv, seed, tLay);
  vStkA = vec4(cA, emissive);
  vStkB = vec4(cB, imp);
  vStkT = vec4(Ts, alphaMul);
  vStkBi = vec4(B, outlined && !under ? OUTLINE_W[cls] : 0.0);   // underlayers are flat fills: no outline
  vStkN = vec4(Ns, fog);
  vStkL = vec4(normalize(mix(normalize(uMoonPos - Pv), uGalleryLight, uAlign)), fogMix);
  // w: 2 = underlayer, else the class's specular weight (wet glints are subdued on dark motifs)
  vStkV = vec4(toCam / max(dc, 1e-6), under ? 2.0 : STK_SPEC_W[cls]);

  gl_Position = cull ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(Pv, 1.0);
  // Under the depth warp, rescale the clip vector so its w is the UNWARPED view depth. A positive rescale keeps
  // the vertex's NDC (and so its pixel and clipping) unchanged, but makes the perspective-correct interpolation
  // weights and the log depth (1 + w) exactly those of the unwarped stroke: from E the warp then changes neither
  // the varyings across a depth-spanning stroke nor the depth test (at k = 0 every stroke sits at 1 km and would
  // otherwise z-fight; at k = 1.6 the underpainting would land beyond the far plane).
  if (uWarpK != 1.0 && !cull) {
    float wU = -(viewMatrix * vec4(PvU, 1.0)).z;
    if (gl_Position.w > 1e-6 && wU > 1e-6) gl_Position *= wU / gl_Position.w;
  }
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
  // log depth comes from gl_FragDepth, so clip z only has to keep warped strokes inside the far plane
  gl_Position.z = min(gl_Position.z, gl_Position.w);
#endif
  // ---- 11.
#include <logdepthbuf_vertex>
}
`;
