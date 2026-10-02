// M9 Painterly Lens (§6 step 4): one full-screen ShaderPass between UnrealBloomPass and OutputPass.
// Order inside the pass: radial speed smear (+ chroma split; its taps are sampled first so the later steps act on
// the smeared colour) -> isophote halo banding -> OKLab pigment pull -> canvas treatment (weave, varnish,
// outside darkening; gated by align) -> matte -> vignette -> fade -> 8-bit dither -> Neutral toe pre-compensation.
// Screen-space pass: no logdepth chunks. Pigment and matte colours are generated here from contracts.ts.
import { ShaderMaterial, Vector2, Vector4 } from 'three';
import { PALETTE, PIGMENTS, type QualitySettings, type SharedUniforms } from '../contracts';
import { srgbHexToLinear } from '../shared/palette';
import { GLSL_PRELUDE } from '../shared/glsl/flow.glsl';
import { f } from '../shared/glsl/header';

// ---------------------------------------------------------------- OKLab (Ottosson), shared by TS and GLSL
const M_LMS: readonly number[] = [
  0.4122214708, 0.5363325363, 0.0514459929,
  0.2119034982, 0.6806995451, 0.1073969566,
  0.0883024619, 0.2817188376, 0.6299787005,
];
const M_LAB: readonly number[] = [
  0.2104542553, 0.7936177850, -0.0040720468,
  1.9779984951, -2.4285922050, 0.4505937099,
  0.0259040371, 0.7827717662, -0.8086757660,
];
const M_LAB_INV: readonly number[] = [
  1.0, 0.3963377774, 0.2158037573,
  1.0, -0.1055613458, -0.0638541728,
  1.0, -0.0894841775, -1.2914855480,
];
const M_LMS_INV: readonly number[] = [
  4.0767416621, -3.3077115913, 0.2309699292,
  -1.2684380046, 2.6097574011, -0.3413193965,
  -0.0041960863, -0.7034186147, 1.7076147010,
];
const mul3 = (m: readonly number[], x: number, y: number, z: number): [number, number, number] => [
  m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z,
];

/** Linear sRGB -> OKLab (L, a, b). */
export function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  const [l, m, s] = mul3(M_LMS, r, g, b);
  return mul3(M_LAB, Math.cbrt(l), Math.cbrt(m), Math.cbrt(s));
}

/** OKLab -> linear sRGB. */
export function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const [l, m, s] = mul3(M_LAB_INV, L, a, b);
  return mul3(M_LMS_INV, l * l * l, m * m * m, s * s * s);
}

/** OKLCh hue in degrees (-180, 180]. */
export function oklabHueDeg(lab: readonly number[]): number {
  return (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
}

/** The 12 pigments of §6 in OKLab, in PIGMENTS order. */
export const PIGMENT_OKLAB: readonly [number, number, number][] = PIGMENTS.map((k) => {
  const c = srgbHexToLinear(PALETTE[k]);
  return linearToOklab(c[0], c[1], c[2]);
});

/** Matte bar and frame-line colours (§6 step 4.5), sRGB hex. */
export const MATTE_HEX = 0x0a0b10;
export const FRAME_LINE_HEX = 0x3a2a18;

// ---------------------------------------------------------------- GLSL
const m3 = (m: readonly number[]) =>
  // GLSL mat3 is column-major: transpose the row-major TS matrix.
  `mat3(${[0, 3, 6, 1, 4, 7, 2, 5, 8].map((i) => f(m[i])).join(', ')})`;
const v3 = (c: readonly number[]) => `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;

const LENS_CONSTS = /* glsl */ `
const mat3 SN_M_LMS = ${m3(M_LMS)};
const mat3 SN_M_LAB = ${m3(M_LAB)};
const mat3 SN_M_LAB_INV = ${m3(M_LAB_INV)};
const mat3 SN_M_LMS_INV = ${m3(M_LMS_INV)};
// chromaticity ab / L of each pigment (OKLab scales uniformly with intensity, so this is intensity invariant)
const vec2 SN_PIG_CHR[${PIGMENTS.length}] = vec2[${PIGMENTS.length}](
  ${PIGMENT_OKLAB.map((p) => `vec2(${f(p[1] / p[0])}, ${f(p[2] / p[0])})`).join(',\n  ')});
const vec3 SN_MATTE = ${v3(srgbHexToLinear(MATTE_HEX))};
const vec3 SN_FRAME_LINE = ${v3(srgbHexToLinear(FRAME_LINE_HEX))};
#define SN_N_PIG ${PIGMENTS.length}
`;

const lensVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const lensFrag = /* glsl */ `
#include <common>
${GLSL_PRELUDE}
${LENS_CONSTS}
uniform sampler2D tDiffuse;
uniform vec2 uLensRes;        // drawing-buffer px of the composer targets
uniform vec4 uCanvasRect;     // x, y, w, h in px, y from the bottom (gl_FragCoord convention)
uniform float uLensMatte;
uniform float uLensAlign;
uniform float uLensSmear;
uniform float uLensFade;
uniform float uLensExposure;  // = renderer.toneMappingExposure applied by OutputPass
varying vec2 vUv;

float snCbrt(float x) { return sign(x) * pow(abs(x), 1.0 / 3.0); }
vec3 snLinToOklab(vec3 c) {
  vec3 lms = SN_M_LMS * c;
  return SN_M_LAB * vec3(snCbrt(lms.x), snCbrt(lms.y), snCbrt(lms.z));
}
vec3 snOklabToLin(vec3 lab) {
  vec3 lms = SN_M_LAB_INV * lab;
  return SN_M_LMS_INV * (lms * lms * lms);
}

// Soft snap of hue/chroma toward the nearest pigment. OKLab scales uniformly with intensity (k c -> k^(1/3) lab),
// so the nearest pigment is chosen by chromaticity ab/L and taken at the pixel's own lightness: HDR values and
// the value structure are preserved, a pigment at any intensity is a fixed point, only chromaticity is pulled.
vec3 snPigmentPull(vec3 c, float lum) {
  vec3 p = snLinToOklab(c);
  float L = max(p.x, 1e-4);
  vec2 chr = p.yz / L;
  float best = 1e9;
  vec2 q = SN_PIG_CHR[0];
  for (int k = 0; k < SN_N_PIG; k++) {
    vec2 dv = chr - SN_PIG_CHR[k];
    float dd = dot(dv, dv);
    if (dd < best) { best = dd; q = SN_PIG_CHR[k]; }
  }
  vec3 target = vec3(L, L * q);   // the nearest pigment at the pixel's own lightness
  float w = mix(0.25, 0.12, smoothstep(0.95, 1.05, lum));
  return max(snOklabToLin(mix(p, target, w)), 0.0);
}

// Peak curve of three r186 NeutralToneMapping's shoulder (StartCompression 0.76) and its inverse. The toe is
// handled separately (LENS_TOE_COMP), so (lens value * exposure) -> display peak is this curve alone.
float snNeutralPeak(float p) { return p < 0.76 ? p : 1.0 - 0.0576 / (p - 0.52); }
float snNeutralPeakInv(float q) { return q < 0.76 ? q : 0.0576 / (1.0 - min(q, 0.9995)) + 0.52; }

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec3 c = max(texture2D(tDiffuse, vUv).rgb, 0.0);
  float ex = max(uLensExposure, 1e-3);
  vec2 fromC = vUv - 0.5;
  vec2 pc = fromC * uLensRes;                       // px from the centre
  float rMax = 0.5 * length(uLensRes);              // screen radius (half diagonal)

  // 3 (sampled first). radial speed smear toward the screen centre over 0.025 * smear of the radius, with a
  // radial chroma split <= 1.5 px * smear on High. The taps read the bloomed input; banding and the pigment pull
  // then act on the smeared colour, so HDR cores never go negative. smear = 0 is an exact no-op.
  if (uLensSmear > 1e-4) {
    float k = 0.025 * uLensSmear;
    float j = ign(fc);
    vec3 acc = vec3(0.0);
#ifdef LENS_CHROMA
    float rl = length(pc);
    vec2 sh = rl > 1e-3 ? (pc / rl) / uLensRes * (1.5 * uLensSmear * rl / rMax) : vec2(0.0);
#endif
    for (int i = 0; i < LENS_TAPS; i++) {
      vec2 uvT = vUv - fromC * (k * (float(i) + j) / float(LENS_TAPS));
#ifdef LENS_CHROMA
      acc += vec3(textureLod(tDiffuse, uvT + sh, 0.0).r, textureLod(tDiffuse, uvT, 0.0).g, textureLod(tDiffuse, uvT - sh, 0.0).b);
#else
      acc += textureLod(tDiffuse, uvT, 0.0).rgb;
#endif
    }
    c = max(acc / float(LENS_TAPS), 0.0);
  }
  float lum = snLum(c);

  // 1. isophote halo banding: bloom halos become concentric stroke rings
#ifdef LENS_ISOPHOTE
  if (lum > 0.35) {
    vec2 o = 2.0 / uLensRes;
    float lx = snLum(textureLod(tDiffuse, vUv + vec2(o.x, 0.0), 0.0).rgb) - snLum(textureLod(tDiffuse, vUv - vec2(o.x, 0.0), 0.0).rgb);
    float ly = snLum(textureLod(tDiffuse, vUv + vec2(0.0, o.y), 0.0).rgb) - snLum(textureLod(tDiffuse, vUv - vec2(0.0, o.y), 0.0).rgb);
    vec2 g = vec2(lx, ly);
    float gl = length(g);
    vec2 t = gl > 1e-6 ? vec2(-g.y, g.x) / gl : vec2(1.0, 0.0);
    vec2 nrm = vec2(t.y, -t.x);
    float band = fract(3.0 * log2(lum));
    float ring = smoothstep(0.0, 0.12, band) * (1.0 - smoothstep(0.55, 0.7, band));
    // bristle noise streaked along the isophote tangent (1/6 px scale across, 5x longer along)
    float n = vnoise2(vec2(dot(fc, t) / 30.0, dot(fc, nrm) / 6.0)) * 2.0 - 1.0;
    float mIso = 1.0 + smoothstep(0.35, 1.2, lum) * (ISO_RING_GAIN * (ring - 0.5) + ISO_NOISE_GAIN * n);
#ifdef LENS_ISO_DISPLAY
    // modulate the tone-mapped peak (identical to c *= mIso below the shoulder) so the bands survive the Neutral
    // shoulder; the scene colour is scaled uniformly, so its hue is kept. Brightening stops at max(peak, 0.99).
    float pk = max(max(c.r, max(c.g, c.b)) * ex, 1e-6);
    float q0 = snNeutralPeak(pk);
    float q1 = min(q0 * mIso, max(q0, 0.99));
    c *= snNeutralPeakInv(q1) / pk;
#else
    c *= mIso;
#endif
  }
#endif

  // 2. OKLab pigment pull
#ifdef LENS_OKLAB
  c = snPigmentPull(c, lum);
#endif

  // 4. canvas treatment, gated by align
  vec4 R = uCanvasRect;
  vec2 dIn = min(fc - R.xy, R.xy + R.zw - fc);
  float inside = clamp(min(dIn.x, dIn.y) + 0.5, 0.0, 1.0);
  if (uLensAlign > 0.0) {
    float period = max(R.w / 280.0, 1.0);
    vec2 q = (fc - R.xy) / period;
    vec2 cell = floor(q);
    vec2 fr = fract(q);
    float over = mod(cell.x + cell.y, 2.0);         // over/under checker: which thread is on top
    float th = 0.85 + 0.3 * hash21(cell);           // thread irregularity
    float warpT = sin(SN_PI * fr.x) * (0.7 + 0.3 * sin(SN_PI * fr.y));
    float weftT = sin(SN_PI * fr.y) * (0.7 + 0.3 * sin(SN_PI * fr.x));
    float weave = mix(warpT, weftT, over) * th;     // ~0.57 mean
    float alias = smoothstep(1.4, 2.8, period);     // fade the weave out before it aliases
    float a = uLensAlign * inside;
    c *= 1.0 + 0.06 * a * alias * (weave - 0.57) * 2.3;
    c *= mix(vec3(1.0), PAL_VARNISH, 0.08 * a);
    c *= 1.0 - 0.35 * uLensAlign * (1.0 - inside);
  }

  // display-referred from here on: z is what NeutralToneMapping receives after the exposure multiply
  vec3 z = c * ex;

  // 5. matte: bars slide from the screen edges to the canvas rect
  vec4 gap = max(vec4(R.x, R.y, uLensRes.x - R.x - R.z, uLensRes.y - R.y - R.w), 0.0);   // left, bottom, right, top
  float barW = max(4.0, 0.01 * uLensRes.y);
  vec4 e = (1.0 - uLensMatte) * (gap + barW);
  vec2 lo = R.xy - e.xy;
  vec2 hi = R.xy + R.zw + e.zw;
  vec2 dd = min(fc - lo, hi - fc);
  float dInner = min(dd.x, dd.y);                   // > 0 inside the opening
  float bar = clamp(0.5 - dInner, 0.0, 1.0);
  float line = clamp(dInner + 2.5, 0.0, 1.0);       // 2 px band on the bar's inner edge
  vec3 barCol = mix(SN_MATTE, SN_FRAME_LINE, 0.6 * uLensMatte * line);
  z = mix(z, barCol, bar);

  // 6. vignette and fade
  float rv = length(pc) / rMax;
  z *= 1.0 - 0.22 * rv * rv;
  z = mix(z, PAL_PRUSSIAN * 0.3, clamp(uLensFade, 0.0, 1.0));

#ifdef LENS_DITHER
  // +-0.5 LSB of the 8-bit sRGB output (exact below the Neutral shoulder): no banding in haze, vignette and
  // dark gradients, and patch averages of flat colours are unbiased.
  // d(linear)/d(sRGB) ~ 2.2 z^0.545 (within ~15 %), floored by the 1/12.92 linear segment: zero-mean in sRGB units
  float dn = (ign(fc) - 0.5) / 255.0;
  z = max(z + dn * max(2.2 * pow(max(z, vec3(1e-6)), vec3(0.545)), vec3(1.0 / 12.92)), 0.0);
#endif

#ifdef LENS_TOE_COMP
  // NeutralToneMapping subtracts offset(min) = x - 6.25 x^2 (x < 0.08) else 0.04 before its shoulder.
  // Pre-add its exact inverse so the palette (and the matte colours) survive below the shoulder.
  float mn = max(min(z.r, min(z.g, z.b)), 0.0);
  z += mn < 0.04 ? 0.4 * sqrt(mn) - mn : 0.04;
#endif

  gl_FragColor = vec4(z / ex, 1.0);
}
`;

export interface LensOptions {
  /** Pre-invert the Neutral tone mapper's toe offset (default true; needed for the < 3 deg palette hue test). */
  toeCompensation?: boolean;
  /** +-0.5 LSB ordered dither of the final 8-bit output (default true). */
  dither?: boolean;
  /** Apply the isophote modulation to the tone-mapped value (default true) instead of the scene value. */
  isoDisplay?: boolean;
  /** Isophote ring modulation (§6: 0.18) and bristle-noise (§6: 0.1) gains. */
  isoRingGain?: number;
  isoNoiseGain?: number;
}

export function lensDefines(q: QualitySettings, opts: LensOptions = {}): Record<string, string> {
  const d: Record<string, string> = {
    LENS_TAPS: String(q.smearTaps),
    ISO_RING_GAIN: f(opts.isoRingGain ?? 0.18),
    ISO_NOISE_GAIN: f(opts.isoNoiseGain ?? 0.1),
  };
  if (q.lensIsophote) d.LENS_ISOPHOTE = '';
  if (q.lensOklab) d.LENS_OKLAB = '';
  if (q.lensChroma) d.LENS_CHROMA = '';
  if (opts.toeCompensation ?? true) d.LENS_TOE_COMP = '';
  if (opts.dither ?? true) d.LENS_DITHER = '';
  if (opts.isoDisplay ?? true) d.LENS_ISO_DISPLAY = '';
  return d;
}

export function createPainterlyLens(u: SharedUniforms, q: QualitySettings, opts: LensOptions = {}): ShaderMaterial {
  return new ShaderMaterial({
    name: 'PainterlyLens',
    defines: lensDefines(q, opts),
    uniforms: {
      ...u,
      tDiffuse: { value: null },
      uLensRes: { value: new Vector2(1, 1) },
      uCanvasRect: { value: new Vector4(0, 0, 1, 1) },
      uLensMatte: { value: 0 },
      uLensAlign: { value: 0 },
      uLensSmear: { value: 0 },
      uLensFade: { value: 0 },
      uLensExposure: { value: 1 },
    },
    vertexShader: lensVert,
    fragmentShader: lensFrag,
    depthTest: false,
    depthWrite: false,
  });
}

/** Swap tier-dependent features (#defines) in place; recompiles once. */
export function setLensQuality(mat: ShaderMaterial, q: QualitySettings, opts: LensOptions = {}): void {
  const next = lensDefines(q, opts);
  const prev = mat.defines ?? {};
  const same = Object.keys(next).length === Object.keys(prev).length && Object.keys(next).every((k) => prev[k] === next[k]);
  if (same) return;
  mat.defines = next;
  mat.needsUpdate = true;
}
