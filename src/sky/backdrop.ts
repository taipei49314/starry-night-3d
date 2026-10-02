// M4 backdrop (SPEC §4.4): a screen pass at infinity that paints the whole sphere of directions as a continuation of
// the generated sky. Splats are placed on a seamless latitude-ring grid of the world sphere (no fold, no wrap seam,
// near-uniform angular density), so the sky behind E is as fully painted as the sky in front. Their colours come from
// "paint coordinates" evaluated at each splat centre: the canvas (gnomonic) band stream inside the SKY_GEN extent,
// where the SKY_BAND field dissolves into this pass, blended into an azimuth-periodic version of the same stream
// outside it. Below the rear ridge (in front, near E) / the horizon (elsewhere) it paints night earth.
//
// Drawn AFTER the opaque strokes at the far plane with a depth test (renderOrder +1000, depthTest on, depthWrite off):
// it only shades pixels no stroke or underlay covers, so at the canvas pose it costs almost nothing.
import { BufferAttribute, BufferGeometry, Mesh, ShaderMaterial } from 'three';
import { AT, CANVAS_ASPECT, EYE_PITCH_DEG, T_HALF, type QualitySettings, type SharedUniforms } from '../contracts';
import { f } from '../shared/glsl/header';
import { GLSL_PRELUDE } from '../shared/glsl/flow.glsl';
import { srgbHexToLinear } from '../shared/palette';

const HALF_U = Math.atan(AT);
const HALF_V = Math.atan(T_HALF);
const PITCH = (EYE_PITCH_DEG * Math.PI) / 180;
/** Far-field paint coordinates: x = A/2 + KX az, y = 0.5 + KY (el - pitch); equal to the canvas scale at the centre. */
const KX = CANVAS_ASPECT / (2 * HALF_U);
const KY = 1 / (2 * HALF_V);
/** Canvas row of the true horizon (all u): 0.5 - tan(pitch) / (2 t) = 0.2286. */
const HORIZON_V = 0.5 - Math.tan(PITCH) / (2 * T_HALF);
/**
 * Splat cell (radians). The extended SKY_BAND strokes reach the SKY_GEN edge at x3.5 their GEN size, which from E is
 * 0.04-0.075 rad long (foreshortened by the tangent plane) and ~0.011 rad wide; the splats are 0.038-0.051 rad x
 * 0.008-0.013 rad, over a painterly band-coloured ground (measured from E: the same mean luminance and contrast as the
 * dissolving SKY_BAND edge within a few %). Cells are 3:2 so a 2 x 2 neighbourhood holds every splat
 * that can reach a pixel.
 */
const CELL_Y = 0.023;
const CELL_X = 1.5 * CELL_Y;
const SPLAT_LEN = 0.74 * CELL_X; // max half-length: centre jitter [0.25, 0.75] + 0.74 cell stays within the next cell
// vertical reach at the 15 deg slope cap + 4 deg twist: a sin + (half-width 0.26 a + bow 0.1 a) cos = 0.67 a <= 0.74 cell
/** Directions within this cone of the eye axis may lie in the canvas-blend zone (SKY_GEN extent + 0.35 h, < 61 deg). */
const FRONT_COS = Math.cos((66 * Math.PI) / 180);
const v3 = (hex: number) => {
  const c = srgbHexToLinear(hex);
  return `vec3(${f(+c[0].toFixed(6))}, ${f(+c[1].toFixed(6))}, ${f(+c[2].toFixed(6))})`;
};

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  // fullscreen triangle on the far plane (depth 1.0: it passes LEQUAL only where nothing was drawn); world-space ray
  // through this corner from the inverse projection / view
  vec4 vp = inverse(projectionMatrix) * vec4(position.xy, 1.0, 1.0);
  vDir = transpose(mat3(viewMatrix)) * (vp.xyz / vp.w);
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
#include <common>
${GLSL_PRELUDE}
uniform float uBdLayers;
varying vec3 vDir;

#define BD_KX ${f(KX)}
#define BD_KY ${f(KY)}
#define BD_PITCH ${f(PITCH)}
#define BD_HORIZON_V ${f(HORIZON_V)}
#define BD_CELL_X ${f(CELL_X)}
#define BD_CELL_Y ${f(CELL_Y)}
#define BD_LEN ${f(SPLAT_LEN)}
#define BD_FRONT_COS ${f(FRONT_COS)}
#define BD_PH_A ${f(4 * CANVAS_ASPECT * 0.5)}
#define BD_PH_B ${f(9.3 * CANVAS_ASPECT * 0.5 + 1.7)}
#define BD_HALF_PI 1.5707963267948966
#ifndef BD_PROF
#define BD_PROF 0                     // harness/sky-perf.html timing split: 1 = no splats, 2 = splat shapes only
#endif
#define BD_LIGHT 0.84                 // mean impasto diffuse of a band stroke seen head-on (calibrated against SKY_BAND)
const vec3 BD_COB2 = ${v3(0x22449e)};  // band two-tone partners (skyGen BAND_PAIRS)
const vec3 BD_CER2 = ${v3(0x4a77a8)};
const vec3 BD_EYE_F = vec3(0.0, ${f(Math.sin(PITCH))}, ${f(-Math.cos(PITCH))});

// pcg3d (Jarzynski & Olano 2020): three well-mixed 32-bit words per cell; the fourth value reuses high bits
vec4 bdHash4(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return vec4(v, (v.x ^ (v.y << 7u)) * 2654435761u) * (1.0 / 4294967296.0);
}

// Paint coordinates: S = stripe phase (7 psi of the band stream), R = canvas row, H = height above the earth line.
// Far field: x = A/2 + KX az with the az frequencies 4 KX = 6.48 -> 6 and 9.3 KX = 15.07 -> 15 (periodic over the full
// turn) and the wiggles scaled by cos(el), so the streamlines close smoothly around the poles.
vec3 bdFar(float az, float el, float cel) {
  float Y = 0.5 + (el - BD_PITCH) * BD_KY;
  float af = 6.0 * az + 9.0 * Y + BD_PH_A;
  float bf = 15.0 * az - 5.0 * Y + BD_PH_B;
  return vec3(7.0 * (Y + cel * (-0.022 * sin(af) - 0.012 * sin(bf) + 0.03 * sin(6.0 * az + BD_PH_A))), Y, el * BD_KY);
}
// Canvas (gnomonic) coordinates of eye-frame direction q: (S, R, H) and the far-field blend weight in .w (0 inside the
// SKY_GEN extent, 1 from 0.35 h outside it). Earth line: the rear ridge seen from near E, the horizon from far away.
vec4 bdFront(vec3 q, float farCam, out vec2 pg) {
  float fz = -q.z;
  vec2 g = q.xy / max(fz, 0.05);
  float ug = 0.5 + g.x / (2.0 * AT);
  float vg = 0.5 + g.y / (2.0 * T_HALF);
  pg = vec2(ug * CANVAS_ASPECT, vg);
  float S = 7.0 * (vg - 0.022 * sin(4.0 * pg.x + 9.0 * vg) - 0.012 * sin(9.3 * pg.x - 5.0 * vg + 1.7) + 0.03 * sin(4.0 * pg.x));
  float H = vg - mix(ridgeV(ug, 2.0), BD_HORIZON_V, farCam);
  float eOut = max(max(SKY_GEN_EXT.x - ug, ug - SKY_GEN_EXT.z) * CANVAS_ASPECT, max(vg - SKY_GEN_EXT.w, SKY_GEN_EXT.y - vg));
  float w = max(smoothstep(-0.05, 0.35, eOut), 1.0 - smoothstep(0.12, 0.3, fz));
  return vec4(S, vg, H, w);
}

// Sky splat colours: the skyGen bandColours law on the stripe phase S, with the paleness near the ridge (low) and
// the deepening above v = 0.88 (high). k, r: per-splat randoms.
void bdSkyColours(float S, float low, float high, vec4 k, vec4 r, out vec3 ca, out vec3 cb) {
  float band = fract(S + 0.25 * (k.x + k.y - 1.0));
  float wCob = 0.5 - 0.18 * low + 0.14 * high;
  float wCer = 0.34 + 0.04 * low - 0.06 * high;
  if (band < wCob) {
    ca = r.x < 0.5 * high ? mix(PAL_COBALT, PAL_ULTRAMARINE, 0.6) : PAL_COBALT;
    cb = k.z < 0.5 ? PAL_ULTRAMARINE : BD_COB2;
  } else if (band < wCob + wCer) {
    ca = PAL_CERULEAN;
    cb = k.z < 0.5 ? PAL_COBALT : BD_CER2;
  } else {
    ca = PAL_ZINC_WHITE;
    cb = k.z < 0.5 ? PAL_CERULEAN : PAL_BLUE_GREEN;
  }
  if (low > 0.5 && r.y < 0.3 * low) cb = PAL_BLUE_GREEN;
  ca *= 0.9 + 0.16 * k.w;
}

// Ground between the splats: the band colour of this pixel's stripe, softened, over the underpainting.
vec3 bdBandGround(float S, float low, float high) {
  float band = fract(S);
  float wCob = 0.5 - 0.18 * low + 0.14 * high;
  float wCer = 0.34 + 0.04 * low - 0.06 * high;
  vec3 c = mix(mix(PAL_COBALT, PAL_ULTRAMARINE, 0.35 + 0.3 * high), PAL_CERULEAN, smoothstep(wCob - 0.05, wCob + 0.05, band));
  return mix(c, mix(PAL_CERULEAN, PAL_BLUE_GREEN, 0.4), smoothstep(wCob + wCer - 0.05, wCob + wCer + 0.05, band) * smoothstep(1.0, 0.95, band));
}

// Night earth: deep ultramarine-Prussian strokes, some cobalt-lifted, two-toned toward Prussian / the outline blue.
void bdEarthColours(vec4 k, out vec3 ca, out vec3 cb) {
  ca = k.x < 0.22 ? mix(PAL_ULTRAMARINE, PAL_COBALT, 0.3 + 0.25 * k.y) : mix(PAL_ULTRAMARINE, PAL_PRUSSIAN, 0.1 + 0.6 * k.y);
  cb = mix(PAL_PRUSSIAN, PAL_OUTLINE, k.z);
  ca *= 0.85 + 0.25 * k.w;
}

void main() {
  vec3 dir = normalize(vDir);
  float sel = clamp(dir.y, -1.0, 1.0);
  float el = asin(sel);
  float cel = sqrt(max(1.0 - sel * sel, 1e-8));
  float az = atan(dir.x, -dir.z);
  vec3 east = normalize(vec3(-dir.z, 0.0, dir.x) + vec3(1e-7, 0.0, 0.0));
  vec3 north = cross(east, dir);
  // pixel footprint (radians), from the solid angle of the pixel
  float aaR = sqrt(max(length(cross(dFdx(dir), dFdy(dir))), 1e-14));
  float farCam = smoothstep(2000.0, 30000.0, length(cameraPosition - uEye));
  mat3 toEye = transpose(uEyeBasis);

  // ---- this pixel's paint coordinates and stroke direction (east, north): far field everywhere; inside the front
  // cone (every splat centre that can reach this pixel may have canvas coordinates) the canvas field blended in
  vec3 fa = bdFar(az, el, cel);
  float S = fa.x;
  float R = fa.y;
  float H = fa.z;
  float af = 6.0 * az + 9.0 * fa.y + BD_PH_A;
  float bf = 15.0 * az - 5.0 * fa.y + BD_PH_B;
  vec2 fd = normalize(vec2((1.0 - 0.198 * cos(af) + 0.06 * cos(bf)) / BD_KX, (0.0815 * cos(af) + 0.111 * cos(bf)) / BD_KY));
  bool front = dot(dir, BD_EYE_F) > BD_FRONT_COS;
  if (front) {
    vec3 q = toEye * dir;
    vec2 pg;
    vec4 fr = bdFront(q, farCam, pg);
    S = mix(fr.x, S, fr.w);
    R = mix(fr.y, R, fr.w);
    H = mix(fr.z, H, fr.w);
    // the canvas field without vortex / halo terms (the generated strokes own those regions), carried onto the sphere
    vec3 fq = vec3(mix(hillFlow(pg), bandFlow(pg), skyMask(pg)), 0.0);
    vec3 t3 = uEyeBasis * (fq - q * dot(q, fq));
    vec2 fdG = vec2(dot(t3, east), dot(t3, north));
    fd = mix(fdG / max(length(fdG), 1e-6), fd, fr.w);
  }
  if (H < 0.0) fd.y *= 0.5;                      // the night earth lies flatter
  if (fd.x < 0.0) fd = -fd;
  fd.x = max(fd.x, 1e-4);
  fd = normalize(vec2(fd.x, clamp(fd.y, -0.268 * fd.x, 0.268 * fd.x)));   // <= 15 deg: splats stay in the 2 x 2 reach
  vec2 fn = vec2(-fd.y, fd.x);

  float earthPx = 1.0 - smoothstep(-0.004 - 2.0 * aaR, -0.004 + 2.0 * aaR, H);
  float highPx = clamp((R - 0.88) / 0.22, 0.0, 1.0);
  vec3 skyBase = mix(mix(PAL_ULTRAMARINE, PAL_PRUSSIAN, clamp(0.15 + (R - 0.35), 0.0, 1.0)),
                     bdBandGround(S, 1.0 - clamp(H / 0.16, 0.0, 1.0), highPx), 0.55) * (0.8 * BD_LIGHT);
  vec3 base = mix(skyBase, mix(PAL_PRUSSIAN, PAL_ULTRAMARINE, 0.35) * 0.8, earthPx);
  // splats composited front to back (top layer first, later cells over earlier ones), so a pixel whose upper splats
  // already cover it skips the rest
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // ---- splat layers on the latitude-ring grid (each layer offset by a fraction of a ring and of a cell)
  int nL = int(uBdLayers + 0.5);
#if BD_PROF == 1
  nL = 0;
#endif
  for (int li = 0; li < 3; li++) {
    int layer = nL - 1 - li;
    if (layer < 0 || alpha > 0.995) break;
    float lf = float(layer);
    float oy = fract(0.37 * lf);
    float ox = fract(0.61 * lf);
    float yc = (el + BD_HALF_PI) / BD_CELL_Y + oy;
    float jb = floor(yc - 0.5);
    for (int jj = 1; jj >= 0; jj--) {
      if (alpha > 0.995) break;
      float j = jb + float(jj);
      float elj = (j + 0.5 - oy) * BD_CELL_Y - BD_HALF_PI;
      float nj = max(1.0, floor(SN_TAU * cos(clamp(elj, -BD_HALF_PI, BD_HALF_PI)) / BD_CELL_X));
      float cellAz = SN_TAU / nj;
      float xc = (az + SN_PI) / cellAz + ox;
      float ib = floor(xc - 0.5);
      float elc0 = (j - oy + 0.25) * BD_CELL_Y - BD_HALF_PI;
      for (int ii = 1; ii >= 0; ii--) {
        if (alpha > 0.995) break;                         // covered: everything left lies underneath
        float i = ib + float(ii);
        float im = i < 0.0 ? i + nj : (i >= nj ? i - nj : i);   // azimuth wrap (i is within one cell of [0, nj))
        uvec3 key = uvec3(uint(im), uint(j + 4.0), uint(layer));
        vec4 h = bdHash4(key);
        float azc = (i - ox + 0.25 + 0.5 * h.x) * cellAz - SN_PI;
        float elc = elc0 + 0.5 * BD_CELL_Y * h.y;
        vec2 l = vec2((az - azc) * cel, el - elc);        // pixel - splat centre, radians (east, north)
        float a = BD_LEN * (0.74 + 0.26 * h.z);
        if (dot(l, l) > a * a + 4.0 * aaR * aaR) continue; // outside the splat's bounding circle
        // a ribbon like an M3 stroke: s = 0 head .. 1 tail, width profile smoothstep(0, 0.1, s) (1 - 0.4 s), bowed spine,
        // its direction turned by up to +-4 deg (inside the 2 x 2 reach with the 15 deg cap)
        float tw = (fract(h.w * 53.0) - 0.5) * 0.14;
        vec2 sd = fd + tw * fn;
        vec2 sn = fn - tw * fd;
        float sAl = 0.5 + 0.5 * dot(l, sd) / a;
        float bow = (fract(h.w * 37.0) - 0.5) * 0.4;
        float across = dot(l, sn) - bow * sAl * (1.0 - sAl) * 2.0 * a;
        float b = a * (0.2 + 0.06 * h.w);
        float wp = smoothstep(0.0, 0.1, sAl) * (1.0 - 0.4 * sAl);
        float cov = clamp((wp * b - abs(across)) / aaR + 0.5, 0.0, 1.0) * clamp((0.5 - abs(sAl - 0.5)) * 2.0 * a / aaR + 0.5, 0.0, 1.0);
        if (cov <= 0.0) continue;
        float ac = clamp(across / max(wp * b, 1e-6), -1.0, 1.0); // -1 .. 1 across the ribbon (AA fringe clamped)
        float aw = aaR / b;
#if BD_PROF == 2
        col += (1.0 - alpha) * cov * h.xyz; alpha += (1.0 - alpha) * cov; continue;
#endif

        // paint coordinates at the splat centre (exact in the front cone, so a splat never changes colour across its
        // pixels; in the far field cos(el_c) is taken to first order, an error < 1e-3 of a stripe)
        vec3 pc;
        if (front) {
          float cec = cos(elc);
          vec2 pgc;
          vec4 frc = bdFront(toEye * vec3(sin(azc) * cec, sin(elc), -cos(azc) * cec), farCam, pgc);
          pc = frc.w > 0.0 ? mix(frc.xyz, bdFar(azc, elc, cec), frc.w) : frc.xyz;
        } else {
          pc = bdFar(azc, elc, cel + sel * (el - elc));
        }
        vec4 k = bdHash4(key + uvec3(0u, 0u, 7u));
        vec4 r = fract(k.wxyz * 256.0 + h.yzwx);
        vec3 ca, cb;
        if (pc.z < -0.004) {
          bdEarthColours(k, ca, cb);
        } else {
          bdSkyColours(pc.x, 1.0 - clamp(pc.z / 0.16, 0.0, 1.0), clamp((pc.y - 0.88) / 0.22, 0.0, 1.0), k, r, ca, cb);
        }
        // bristles across the width (only when coarser than ~2 px, as in the stroke shader) and a dry-brush tail
        float nb = 9.0 + 5.0 * r.z;
        float bAmp = 1.0 - smoothstep(0.5, 1.0, aw * nb);
        float br = 0.5;
        float br2 = 0.5;
        if (bAmp > 0.0) {
          float ph = SN_PI * nb * ac + 6.283 * r.w;
          br += 0.5 * bAmp * sin(ph);
          br2 += 0.5 * bAmp * sin(ph + SN_PI * nb * 0.37);
        }
        float eDry = 0.55 * (sAl - 0.72) / 0.28;
        if (sAl > 0.72) cov *= smoothstep(eDry - 0.08, eDry + 0.08, br);
        vec3 sc = mix(ca, cb, 0.45 * smoothstep(0.35, 0.65, br2));
        // impasto light: a lit crown along the stroke, darker flanks, a loaded head
        float crown = (1.0 - ac * ac) * (0.62 + 0.38 * br);
        sc *= BD_LIGHT * (0.86 + 0.2 * crown) * (1.04 - 0.08 * sAl);
        col += (1.0 - alpha) * cov * sc;
        alpha += (1.0 - alpha) * cov;
      }
    }
  }
  col += (1.0 - alpha) * base;
  gl_FragColor = vec4(min(col, vec3(0.95)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * Fullscreen backdrop: one triangle on the far plane, drawn after the opaque scene (renderOrder +1000) with a depth
 * test and no depth write, never culled, so it shades only the pixels no stroke covers. Splat layers follow
 * q.backdropLayers (2 / 2 / 1); call `setBackdropQuality` after a tier change.
 */
export function createBackdrop(u: SharedUniforms, q: QualitySettings): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const material = new ShaderMaterial({
    name: 'punctum.backdrop',
    uniforms: { ...u, uBdLayers: { value: q.backdropLayers } },
    vertexShader,
    fragmentShader,
    depthTest: true,
    depthWrite: false,
    transparent: false,
    fog: false,
    lights: false,
  });
  const mesh = new Mesh(g, material);
  mesh.name = 'backdrop';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/** Apply a tier's backdrop layer count (2 / 2 / 1) without recompiling. */
export function setBackdropQuality(backdrop: Mesh, q: QualitySettings): void {
  const m = backdrop.material as ShaderMaterial;
  m.uniforms.uBdLayers.value = q.backdropLayers;
}
