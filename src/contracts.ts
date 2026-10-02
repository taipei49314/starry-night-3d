// Shared contracts for PUNCTUM (docs/SPEC.md). Frozen before the module fan-out:
// every module imports only this file, `three` and src/shared/*. Changes go through the lead.
import type {
  BufferGeometry, Group, IUniform, Material, Matrix3, Mesh, PerspectiveCamera, Points, Scene, Vector3, Vector4, WebGLRenderer,
} from 'three';

// ---------------------------------------------------------------- canvas pose (§2.1)
export const LOOP_SECONDS = 96;
export const CANVAS_ASPECT = 1.2497; // 92.1 / 73.7
export const VFOV_DEG = 36;
export const T_HALF = 0.3249197; // tan(18 deg)
export const AT = 0.4060487; // CANVAS_ASPECT * T_HALF
export const EYE_POS: readonly [number, number, number] = [0, 50, 0];
export const EYE_PITCH_DEG = 10;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 600_000;
/** Generated canvas extent (fractions). The 16:9 canvas pose shows u in [-0.21, 1.21]. */
export const GEN_U: readonly [number, number] = [-0.3, 1.3];
export const GEN_V: readonly [number, number] = [-0.12, 1.1];
/**
 * Extended sky generation extent (fractions) for UNDERPAINT and SKY_BAND, so wide-FOV shots near E (up to ~80 deg vertical)
 * see painted sky instead of the generated-canvas rectangle. Density falls off outside GEN_U/GEN_V (larger, sparser strokes),
 * and the stroke shader dissolves sky strokes over SKY_EDGE_FADE (canvas fractions) inside this extent.
 */
export const SKY_GEN_U: readonly [number, number] = [-1.0, 2.0];
export const SKY_GEN_V: readonly [number, number] = [0.15, 1.75];
export const SKY_EDGE_FADE = 0.12;

// ---------------------------------------------------------------- stroke classes (§4.1, §4.3)
export enum StrokeClass {
  UNDERPAINT = 0, SKY_BAND = 1, SWIRL = 2, EDDY = 3, STAR_CORE = 4, STAR_RING = 5, MOON = 6,
  MOON_RING = 7, WIND_JET = 8, HILL = 9, GROUND = 10, GROVE = 11, HOUSE = 12, WINDOW = 13, CHURCH = 14, CYPRESS = 15,
}
export const CLASS_COUNT = 16;

/**
 * Per-stroke flags, packed into a0.w as `cls + FLAG_STRIDE * flags`.
 * (The spec's separate UNDERLAYER class is replaced by this flag so an underlayer stroke keeps its parent
 * class's animation, chunking and depth range.)
 *  - UNDERLAYER: flat, no bristle, width x3, dark fill that closes holes in a motif seen off-axis.
 *  - OUTLINE: the stroke's long edges darken toward PALETTE.outline with weight CLASS_INFO[cls].outline.
 */
export const FLAG_STRIDE = 32;
export enum StrokeFlag { NONE = 0, UNDERLAYER = 1, OUTLINE = 2 }

export enum AnimKind { STATIC = 0, VORTEX = 1, RING = 2, BAND = 3, CYPRESS = 4, JET = 5, FLICKER = 6 }

export type ChunkRule = 'morton' | 'vortex' | 'ring';
export interface ClassInfo {
  anim: AnimKind;
  /** Solid classes carry a world face normal in a3.yzw; the ribbon lies in that face. */
  solid: boolean;
  /** Outline weight applied to strokes flagged OUTLINE. */
  outline: number;
  /** Sky classes respond to the stir-the-sky gesture. */
  sky: boolean;
  tierFraction: { high: number; medium: number; low: number };
  budgetHigh: number;
  /** Allowed depth range (metres from E) for paint-order assertions. */
  dRange: [number, number];
  /** morton: Morton-sorted chunks of <= 4096; vortex: one chunk per vortex (a3.y = vi*2+arm); ring: one chunk per star (a3.y = star index, moon = 11). */
  chunk: ChunkRule;
}

const tf = (high: number, medium: number, low: number) => ({ high, medium, low });
// Star and moon halos are never thinned: their concentric bands alternate with dark backing rings, and a thinned,
// width-compensated subset lets the backing swallow the bands (dark discs with dotted rings). They are ~10 % of the strokes.
export const CLASS_INFO: Record<StrokeClass, ClassInfo> = {
  [StrokeClass.UNDERPAINT]: { anim: AnimKind.STATIC, solid: false, outline: 0, sky: false, tierFraction: tf(1, 1, 1), budgetHigh: 6000, dRange: [229_000, 251_000], chunk: 'morton' },
  [StrokeClass.SKY_BAND]: { anim: AnimKind.BAND, solid: false, outline: 0, sky: true, tierFraction: tf(1, 0.55, 0.25), budgetHigh: 44000, dRange: [94_000, 212_000], chunk: 'morton' },
  [StrokeClass.SWIRL]: { anim: AnimKind.VORTEX, solid: false, outline: 0.6, sky: true, tierFraction: tf(1, 0.6, 0.3), budgetHigh: 33000, dRange: [39_000, 93_500], chunk: 'vortex' },
  [StrokeClass.EDDY]: { anim: AnimKind.VORTEX, solid: false, outline: 0.6, sky: true, tierFraction: tf(1, 0.5, 0.25), budgetHigh: 6000, dRange: [44_000, 82_000], chunk: 'vortex' },
  [StrokeClass.STAR_CORE]: { anim: AnimKind.STATIC, solid: false, outline: 0, sky: false, tierFraction: tf(1, 1, 1), budgetHigh: 2200, dRange: [11_800, 16_100], chunk: 'morton' },
  [StrokeClass.STAR_RING]: { anim: AnimKind.RING, solid: false, outline: 0, sky: true, tierFraction: tf(1, 1, 1), budgetHigh: 14000, dRange: [11_900, 32_000], chunk: 'ring' },
  [StrokeClass.MOON]: { anim: AnimKind.STATIC, solid: false, outline: 0, sky: false, tierFraction: tf(1, 1, 1), budgetHigh: 1800, dRange: [10_800, 11_200], chunk: 'morton' },
  [StrokeClass.MOON_RING]: { anim: AnimKind.RING, solid: false, outline: 0, sky: true, tierFraction: tf(1, 1, 1), budgetHigh: 4200, dRange: [10_900, 25_000], chunk: 'ring' },
  [StrokeClass.WIND_JET]: { anim: AnimKind.JET, solid: false, outline: 0, sky: true, tierFraction: tf(1, 0.6, 0.35), budgetHigh: 2400, dRange: [200, 12_500], chunk: 'morton' },
  [StrokeClass.HILL]: { anim: AnimKind.STATIC, solid: true, outline: 0.9, sky: false, tierFraction: tf(1, 0.55, 0.3), budgetHigh: 16500, dRange: [1_600, 6_100], chunk: 'morton' },
  [StrokeClass.GROUND]: { anim: AnimKind.STATIC, solid: true, outline: 0, sky: false, tierFraction: tf(1, 0.55, 0.25), budgetHigh: 8000, dRange: [200, 7_500], chunk: 'morton' },
  [StrokeClass.GROVE]: { anim: AnimKind.STATIC, solid: true, outline: 0.5, sky: false, tierFraction: tf(1, 0.55, 0.3), budgetHigh: 6000, dRange: [200, 7_500], chunk: 'morton' },
  [StrokeClass.HOUSE]: { anim: AnimKind.STATIC, solid: true, outline: 0.9, sky: false, tierFraction: tf(1, 0.6, 0.35), budgetHigh: 14000, dRange: [450, 2_900], chunk: 'morton' },
  [StrokeClass.WINDOW]: { anim: AnimKind.FLICKER, solid: true, outline: 0, sky: false, tierFraction: tf(1, 1, 1), budgetHigh: 400, dRange: [450, 2_900], chunk: 'morton' },
  [StrokeClass.CHURCH]: { anim: AnimKind.STATIC, solid: true, outline: 0.9, sky: false, tierFraction: tf(1, 0.8, 0.5), budgetHigh: 3600, dRange: [600, 760], chunk: 'morton' },
  [StrokeClass.CYPRESS]: { anim: AnimKind.CYPRESS, solid: false, outline: 0.9, sky: false, tierFraction: tf(1, 0.6, 0.3), budgetHigh: 19500, dRange: [140, 245], chunk: 'morton' },
};

/** Paint-order assertions (§2.2): every d of `near` must be < every d of `far` where they overlap on the canvas. */
export const PAINT_ORDER: readonly [StrokeClass, StrokeClass][] = [
  [StrokeClass.STAR_CORE, StrokeClass.SWIRL],
  [StrokeClass.STAR_RING, StrokeClass.SWIRL],
  [StrokeClass.SWIRL, StrokeClass.SKY_BAND],
  [StrokeClass.SKY_BAND, StrokeClass.UNDERPAINT],
  [StrokeClass.MOON, StrokeClass.SKY_BAND],
  [StrokeClass.MOON_RING, StrokeClass.SKY_BAND],
  [StrokeClass.HILL, StrokeClass.STAR_CORE],
  [StrokeClass.EDDY, StrokeClass.SKY_BAND],
  [StrokeClass.CYPRESS, StrokeClass.HOUSE],
];

// ---------------------------------------------------------------- instance record (§4.1)
/**
 * 16 float32 = 64 bytes, four vec4 instanced attributes a0..a3:
 *  a0 = (u, v, d, cls + FLAG_STRIDE*flags)      u,v canvas fractions; d metres from E along the eye forward axis
 *  a1 = (du, dv, dlnd, W)       du,dv in h-units (stroke spans centre +- 0.5*(du/A, dv)); dlnd = ln(dEnd/dStart); W width in h-units
 *                               VORTEX/RING/JET kinds: a1 = (L, 0, 0, W) - direction recomputed in the shader
 *  a2 = (colA, colB, emissive, seed)   colA/colB = sRGB 0xRRGGBB stored as a float (exact below 2^24); seed in [0,1)
 *  a3 = (kappa, q1, q2, q3)     solid classes: (kappa, nx, ny, nz) world face normal
 *                               VORTEX: (kappa, vortexIdx*2 + arm, sigma0, across in [-1,1])  arm may be 0.5 for shell strokes
 *                               RING:   (kappa, starIdx (moon = 11), ringK, radialJitter in [-1,1])
 *                               BAND:   (kappa, slideAmp, periodIdx 0..3 -> {8,12,16,24} s, phase in [0,1))
 *                               CYPRESS:(kappa, tongueIdx, phi, 0)
 *                               JET:    (kappa, sigma0, filamentOffset (h-units), depthJitter)
 *                               FLICKER:(kappa, nx, ny, nz); emissive animated by seed
 *  kappa = signed bow of the stroke spine as a fraction of its length (0 = straight).
 */
export const FLOATS_PER_STROKE = 16;
export interface StrokeRecord {
  u: number; v: number; d: number; cls: StrokeClass; flags: number;
  du: number; dv: number; dlnd: number; w: number;
  colA: number; colB: number; emissive: number; seed: number;
  kappa: number; q1: number; q2: number; q3: number;
}
export interface StrokeSink { push(r: StrokeRecord): void; readonly count: number; }
export interface Rng { next(): number; range(a: number, b: number): number; int(n: number): number; normal(): number; pick<T>(xs: readonly T[]): T; }

// ---------------------------------------------------------------- motifs (§2.3, §2.4)
export interface StarDef { name: string; u: number; v: number; dCore: number; rhoCore: number; rings: number; }
export const STARS: readonly StarDef[] = [
  { name: 'Venus', u: 0.300, v: 0.720, dCore: 12000, rhoCore: 0.016, rings: 9 },
  { name: 'S2', u: 0.070, v: 0.870, dCore: 14500, rhoCore: 0.010, rings: 6 },
  { name: 'S3', u: 0.265, v: 0.925, dCore: 15000, rhoCore: 0.011, rings: 6 },
  { name: 'S4', u: 0.415, v: 0.905, dCore: 13500, rhoCore: 0.010, rings: 6 },
  { name: 'S5', u: 0.535, v: 0.860, dCore: 14000, rhoCore: 0.011, rings: 6 },
  { name: 'S6', u: 0.660, v: 0.900, dCore: 15500, rhoCore: 0.010, rings: 6 },
  { name: 'S7', u: 0.745, v: 0.790, dCore: 13000, rhoCore: 0.012, rings: 7 },
  { name: 'S8', u: 0.925, v: 0.690, dCore: 14500, rhoCore: 0.010, rings: 6 },
  { name: 'S9', u: 0.810, v: 0.600, dCore: 16000, rhoCore: 0.010, rings: 6 },
  { name: 'S10', u: 0.640, v: 0.520, dCore: 13000, rhoCore: 0.011, rings: 6 },
  { name: 'S11', u: 0.470, v: 0.495, dCore: 14000, rhoCore: 0.010, rings: 6 },
];
/** Star ring k: radius rhoCore*(1 + STAR_RING_RHO*k) h-units at depth dCore*(1 + STAR_RING_D*k). */
export const STAR_RING_RHO = 0.62;
export const STAR_RING_D = 0.12;
/** Moon ring k: radius rCrescent + MOON_RING_RHO*k at depth d*(1 + MOON_RING_D*k). Ring 0 is the crescent edge. */
export const MOON_DEF = { u: 0.86, v: 0.85, d: 11000, rCrescent: 0.035, rings: 10 } as const;
export const MOON_RING_RHO = 0.0095;
export const MOON_RING_D = 0.13;
/** Star index used for the moon in RING records and ring helpers. */
export const MOON_INDEX = 11;

export interface VortexDef {
  name: string; u: number; v: number;
  /** circulation; negative = clockwise */ gamma: number; rc: number;
  /** Gaussian window */ sigma: number; /** sink (spiral pitch) */ beta: number;
  r0: number; rmax: number; dThroat: number; expo: number; arms: number;
}
export const VORTICES: readonly VortexDef[] = [
  { name: 'c1', u: 0.43, v: 0.66, gamma: -0.0200, rc: 0.035, sigma: 0.16, beta: 0.17, r0: 0.020, rmax: 0.130, dThroat: 40000, expo: 0.433, arms: 2 },
  { name: 'c2', u: 0.59, v: 0.61, gamma: 0.0170, rc: 0.030, sigma: 0.15, beta: 0.17, r0: 0.020, rmax: 0.120, dThroat: 42000, expo: 0.433, arms: 2 },
  { name: 'E1', u: 0.18, v: 0.62, gamma: -0.0050, rc: 0.020, sigma: 0.06, beta: 0.10, r0: 0.006, rmax: 0.050, dThroat: 45000, expo: 0.200, arms: 2 },
  { name: 'E2', u: 0.335, v: 0.83, gamma: 0.0045, rc: 0.018, sigma: 0.05, beta: 0.10, r0: 0.006, rmax: 0.040, dThroat: 48000, expo: 0.200, arms: 2 },
  { name: 'E3', u: 0.71, v: 0.69, gamma: -0.0050, rc: 0.020, sigma: 0.06, beta: 0.10, r0: 0.006, rmax: 0.045, dThroat: 52000, expo: 0.200, arms: 2 },
  { name: 'E4', u: 0.95, v: 0.80, gamma: 0.0045, rc: 0.020, sigma: 0.06, beta: 0.10, r0: 0.006, rmax: 0.050, dThroat: 50000, expo: 0.200, arms: 2 },
];
export const HILL_WALL_D: readonly number[] = [3000, 4200, 5600];
export const JET_CTRL: readonly (readonly [number, number])[] = [[0.17, 1.02], [0.24, 0.92], [0.29, 0.80], [0.30, 0.735]];
export const JET_D0 = 220;
export const JET_D1 = 12000;
/** Cypress silhouette rows [v, uL, uR] (§2.3). */
export const CYPRESS_SIL: readonly (readonly [number, number, number])[] = [
  [-0.10, 0.10, 0.29], [0.00, 0.08, 0.30], [0.15, 0.06, 0.30], [0.30, 0.05, 0.30], [0.45, 0.06, 0.29],
  [0.60, 0.08, 0.28], [0.72, 0.10, 0.27], [0.82, 0.12, 0.25], [0.92, 0.14, 0.24], [1.00, 0.16, 0.23], [1.08, 0.19, 0.21],
];
export const CYPRESS_AXIS_D = 192;
export const CHURCH = { u: 0.55, vBase: 0.11, base: [27, 0, -678] as const, shaftTop: 75, spireTop: 145 } as const;
/** Swirl lay-in centre in h-units (§4.3 step 10). */
export const LAYIN_CENTER: readonly [number, number] = [0.6374, 0.64];

export const PALETTE = {
  ultramarine: 0x1b2f6e, prussian: 0x0b1a3a, cobalt: 0x2a52be, cerulean: 0x5e8fb0,
  blueGreen: 0x8fb8a8, zincWhite: 0xe8edf0, chrome: 0xf2c230, lemon: 0xf5e27a, ochre: 0xd98a1e,
  cypressDark: 0x1d2b1f, cypressGreen: 0x2f3d26, roof: 0x4a5a73, outline: 0x142454, voidDeep: 0x050a18,
  varnish: 0xf4e9cf, grove: 0x2e4a3a, groveLight: 0x3d5c4a,
} as const;
export type PaletteKey = keyof typeof PALETTE;
/** The 12 pigments the post OKLab pull snaps toward (§6). */
export const PIGMENTS: readonly PaletteKey[] = [
  'ultramarine', 'prussian', 'cobalt', 'cerulean', 'blueGreen', 'zincWhite', 'chrome', 'lemon', 'ochre', 'cypressDark', 'cypressGreen', 'roof',
];

// ---------------------------------------------------------------- quality (§7)
export type Tier = 'high' | 'medium' | 'low';
export interface QualitySettings {
  tier: Tier; msaa: 0 | 2 | 4; ribbonSegments: 3 | 4 | 5; dustCount: number;
  bloomScale: number; lensIsophote: boolean; lensOklab: boolean; lensChroma: boolean; smearTaps: 4 | 8;
  backdropLayers: 1 | 2; specular: boolean; velocityStretch: boolean; renderScaleInit: number;
  renderScaleMin: number; renderScaleMax: number; targetFrameMs: number; maxPixelRatio: number;
}
export const QUALITY_PRESETS: Record<Tier, QualitySettings> = {
  high: { tier: 'high', msaa: 4, ribbonSegments: 5, dustCount: 30000, bloomScale: 0.5, lensIsophote: true, lensOklab: true, lensChroma: true, smearTaps: 8, backdropLayers: 2, specular: true, velocityStretch: true, renderScaleInit: 1.0, renderScaleMin: 0.75, renderScaleMax: 1.0, targetFrameMs: 16.7, maxPixelRatio: 1.25 },
  medium: { tier: 'medium', msaa: 2, ribbonSegments: 4, dustCount: 16000, bloomScale: 0.5, lensIsophote: true, lensOklab: true, lensChroma: false, smearTaps: 8, backdropLayers: 2, specular: true, velocityStretch: true, renderScaleInit: 0.85, renderScaleMin: 0.6, renderScaleMax: 1.0, targetFrameMs: 16.7, maxPixelRatio: 1.0 },
  low: { tier: 'low', msaa: 0, ribbonSegments: 3, dustCount: 6000, bloomScale: 0.25, lensIsophote: false, lensOklab: false, lensChroma: false, smearTaps: 4, backdropLayers: 1, specular: false, velocityStretch: false, renderScaleInit: 0.67, renderScaleMin: 0.5, renderScaleMax: 0.8, targetFrameMs: 22, maxPixelRatio: 1.0 },
};
export const RENDER_SCALE_STEPS: readonly number[] = [0.5, 0.6, 0.67, 0.75, 0.85, 1.0];

// ---------------------------------------------------------------- shared uniforms (§4.2)
export interface SharedUniforms {
  uTime: IUniform<number>;            // loop time in [0, 96)
  uEye: IUniform<Vector3>;
  uEyeBasis: IUniform<Matrix3>;
  uWarpK: IUniform<number>;           // depth warp exponent (1 by default)
  uOff: IUniform<number>;             // smoothstep(0.5, 40, |C-E|)
  uAlign: IUniform<number>;           // §6
  uScatter: IUniform<number>;         // storm amplitude before the snap
  uSnapTime: IUniform<number>;        // -1 when no snap
  uScatterAtSnap: IUniform<number>;
  uLayIn: IUniform<number>;           // seconds since boot; -1 disables
  uInflate: IUniform<number>;         // seconds since wave start; >= 10 means inflated
  uImpastoGain: IUniform<number>;
  uGalleryLight: IUniform<Vector3>;   // world direction
  uMoonPos: IUniform<Vector3>;
  uCamVel: IUniform<Vector3>;         // m/s; zero on cut
  uPxPerRad: IUniform<number>;        // viewportH / (2 tan(fov/2)), in device pixels
  uViewportH: IUniform<number>;       // device pixels
  uWidthComp: IUniform<Float32Array>; // CLASS_COUNT entries
  uStir: IUniform<Vector4>;           // (u, v, strength, radius) - u,v in h-units
  uSpecular: IUniform<number>;
  uVelStretch: IUniform<number>;
  uDustAlpha: IUniform<number>;
  [name: string]: IUniform<any>;
}

// ---------------------------------------------------------------- engine (M1)
export interface Engine {
  readonly renderer: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  readonly quality: QualitySettings;
  readonly renderScale: number;
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** min(devicePixelRatio, quality.maxPixelRatio) * renderScale */
  readonly pixelRatio: number;
  /** Called after a CSS resize or a render-scale change with the new drawing-buffer parameters. */
  onResize(cb: (cssW: number, cssH: number, pixelRatio: number) => void): void;
  /** Called after a tier change (benchmark, pinned at the minimum scale, or setTier). */
  onQualityChange(cb: (q: QualitySettings) => void): void;
  setTier(tier: Tier): void;
  /** Bracket the frame's GPU work (timer query when available). */
  beginFrame(): void;
  endFrame(): void;
  /** Feed the frame delta; may step the render scale or drop a tier (§7.3). `benchmarking` = shot-1 benchmark window. */
  updateDynamicResolution(dtMs: number, benchmarking: boolean): void;
  readonly stats: { fps: number; frameMs: number; gpuMs: number | null };
  dispose(): void;
}

// ---------------------------------------------------------------- strokes (M3)
export interface StrokeChunk { mesh: Mesh; cls: StrokeClass; n: number; baseRadius: number; dMax: number; }
export interface StrokeLayer {
  group: Group;
  chunks: StrokeChunk[];
  setQuality(q: QualitySettings): void;               // instanceCount prefixes + ribbon LOD + uWidthComp
  setCullInflation(extraFractionOfD: number): void;   // storm: radius += extra * dMax
  setCullingEnabled(on: boolean): void;               // false while uWarpK != 1
  readonly ribbon: BufferGeometry;
}

// ---------------------------------------------------------------- underlay meshes (M3 material, M6/M7 geometry)
/**
 * vertexFade: the geometry carries `attribute float aFade` in [0, 1] (1 = opaque); the material dissolves low values with
 * hashed (IGN) discard so an underlay can melt into the void at its edges instead of ending in a hard polygon.
 */
export interface UnderlayOptions { vertexFade?: boolean }
export type UnderlayMaterialFactory = (colorHex: number, opts?: UnderlayOptions) => Material;

// ---------------------------------------------------------------- land (M7)
export interface VillageInfo {
  steepleBase: Vector3; steepleTip: Vector3;
  houses: { center: Vector3; size: Vector3; yaw: number }[];
}

// ---------------------------------------------------------------- director (M8, §5)
export interface ShotEnvelope {
  bloom: number; exposure: number; matte: number; smear: number; storm: number;
  galleryLightDeg: number; impastoGain: number; fade: number; dust: number;
}
export type DirectorMode = 'cinematic' | 'free' | 'rejoin' | 'returning';
export interface DirectorFrame {
  mode: DirectorMode; loopTime: number; shot: number; shotT: number;
  firstBoot: boolean; bootSeconds: number; cut: boolean; camVelocity: [number, number, number];
  env: ShotEnvelope; stir: [number, number, number, number] | null; warpK: number;
  stormToggled: boolean; calm: boolean; hud: boolean;
}

// ---------------------------------------------------------------- post (M9, §6)
export interface PostFrame {
  bloom: number; exposure: number; matte: number; align: number; smear: number;
  fade: number; time: number; canvasRectPx: [number, number, number, number]; // x, y, w, h in drawing-buffer px, y from bottom
}
export interface PostChain {
  render(scene: Scene, camera: PerspectiveCamera, f: PostFrame): void;
  setSize(cssW: number, cssH: number, pixelRatio: number): void;
  setQuality(q: QualitySettings): void;
}

// ---------------------------------------------------------------- composition (M10)
export interface World {
  scene: Scene; strokes: StrokeLayer; backdrop: Mesh; dust: Points; underlays: Group; village: VillageInfo;
}
