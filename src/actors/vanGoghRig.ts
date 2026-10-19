// Historically informed 3D Van Gogh actor rig (5 era attire & prop configurations, 1885–1890).
// Visual architecture (A2):
//  - Over-the-shoulder / three-quarter back witness perspective ("身後／側後背影見證視角").
//  - Zero BoxGeometry on the human figure: built from smooth anatomical lofted surfaces (`buildLoftGeometry`),
//    contoured hats, and a 3D volumetric charcoal/impasto brushstroke shell (`buildStrokeShellGeometry`) so the
//    figure blends organically with the surrounding 3D brushstroke universe.
// Enforces two core structural principles:
//  1. Independent human agency (`actorClock` advances by real un-frozen delta time; the viewer can dwell in space
//     but never freezes Van Gogh like a game NPC).
//  2. Separation of the realistic stage from the mathematical alignment point E: as the painting reassembles at E,
//     Van Gogh naturally walks/steps out of the camera frame so E remains 100% pure.
import {
  BufferGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, FrontSide, Group, Mesh,
  ShaderMaterial, SphereGeometry, Vector3,
  type Object3D,
} from 'three';
import { EYE, FORWARD, RIGHT, UP } from '../shared/canvasSpace';
import type { ChapterId } from '../chapters/types';
import { GLSL_PRELUDE } from '../shared/glsl/flow.glsl';

const actorVert = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vActWorld;
varying vec3 vActNormal;
varying vec3 vActLocal;
varying vec2 vActUv;
void main() {
  vActLocal = position;
  vActUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vActWorld = wp.xyz;
  vActNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
#include <logdepthbuf_vertex>
}
`;

const actorFrag = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${GLSL_PRELUDE}
uniform vec3 uBaseColor;
uniform vec3 uAccentColor;
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uFillColor;
uniform float uRoughness;
uniform float uSubsurface;
uniform float uBrushRelief;
uniform float uActorOpacity;
varying vec3 vActWorld;
varying vec3 vActNormal;
varying vec3 vActLocal;
varying vec2 vActUv;

void main() {
  if (uActorOpacity <= 0.002) discard;

  vec3 N = normalize(vActNormal);
  vec3 V = normalize(cameraPosition - vActWorld);
  if (dot(N, V) < 0.0) N = -N;
  vec3 L = normalize(uKeyDir);

  // Directional painterly impasto / charcoal bristle ridges in local + world coordinates
  float bristle = sin(vActUv.x * 42.0 + vnoise3(vActLocal * 18.0) * 3.5);
  float strokeTex = vnoise3(vec3(vActLocal.x * 22.0, vActLocal.y * 9.0, vActLocal.z * 22.0));
  float charcoalGrain = vnoise3(vActWorld * 16.0 + vActLocal * 12.0);

  // Perturb normal slightly with bristle relief so light catches impasto ridges like oil paint / charcoal
  vec3 T = normalize(cross(N, vec3(0.0, 1.0, 0.15)));
  vec3 B = cross(N, T);
  float ridge = (bristle * 0.55 + (strokeTex - 0.5) * 0.9) * uBrushRelief;
  N = normalize(N + T * ridge * 0.28 + B * (charcoalGrain - 0.5) * uBrushRelief * 0.18);

  // Painterly edge dither & soft grazing-angle dissolution so silhouette merges with 3D brushstrokes
  float ndv = max(dot(N, V), 0.0);
  float edgeSoft = smoothstep(0.02, 0.22, ndv + 0.18 * strokeTex);
  float effOpacity = uActorOpacity * (0.82 + 0.18 * edgeSoft);
  if (effOpacity < 0.998 && effOpacity <= ign(gl_FragCoord.xy)) discard;

  // Blend base pigment with secondary accent along brushstroke ridges
  float mixK = clamp(0.5 + 0.42 * (strokeTex - 0.5) + 0.18 * bristle, 0.0, 1.0);
  vec3 albedo = mix(uBaseColor, uAccentColor, mixK * 0.48) * (0.90 + 0.16 * charcoalGrain);

  // Wrapped chiaroscuro diffuse + warm subsurface scatter
  float ndl = dot(N, L);
  float wrapDiff = max(0.0, (ndl + 0.38) / 1.38);
  float backScatter = max(0.0, dot(-N, L)) * uSubsurface;

  // Warm painterly Fresnel rim light (oil lamp / Provençal sun / studio window) framing his back & shoulder contour
  float rim = pow(1.0 - ndv, 2.6) * (0.65 + 0.35 * max(0.0, ndl + 0.5));

  vec3 H = normalize(L + V);
  float specPower = mix(28.0, 6.0, uRoughness);
  float spec = pow(max(dot(N, H), 0.0), specPower) * (1.0 - uRoughness) * 0.20;

  vec3 lit = albedo * (uFillColor + uKeyColor * (wrapDiff + 0.38 * backScatter))
           + uKeyColor * (spec + 0.26 * rim);

  gl_FragColor = vec4(lit, 1.0);
#include <logdepthbuf_fragment>
#include <tonemapping_fragment>
#include <colorspace_fragment>
}
`;

export interface ActorMaterialUniforms {
  uKeyDir: { value: Vector3 };
  uKeyColor: { value: Vector3 };
  uFillColor: { value: Vector3 };
  uActorOpacity: { value: number };
}

function hexToLinearVec3(hex: number): Vector3 {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return new Vector3(Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2));
}

export function makeRealisticStageMaterial(
  hex: number,
  sharedLight: ActorMaterialUniforms,
  opts?: { roughness?: number; subsurface?: number; doubleSide?: boolean; accentHex?: number; brushRelief?: number },
): ShaderMaterial {
  const baseLin = hexToLinearVec3(hex);
  const accentLin = hexToLinearVec3(opts?.accentHex ?? hex);
  return new ShaderMaterial({
    name: `actor#${hex.toString(16).padStart(6, '0')}`,
    uniforms: {
      uBaseColor: { value: baseLin },
      uAccentColor: { value: accentLin },
      uKeyDir: sharedLight.uKeyDir,
      uKeyColor: sharedLight.uKeyColor,
      uFillColor: sharedLight.uFillColor,
      uRoughness: { value: opts?.roughness ?? 0.78 },
      uSubsurface: { value: opts?.subsurface ?? 0.12 },
      uBrushRelief: { value: opts?.brushRelief ?? 0.45 },
      uActorOpacity: sharedLight.uActorOpacity,
    },
    vertexShader: actorVert,
    fragmentShader: actorFrag,
    side: opts?.doubleSide ? DoubleSide : FrontSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}

interface LoftRing {
  y: number;
  rx: number;
  rz: number;
  ox?: number;
  oz?: number;
  foldAmp?: number;
  foldFreq?: number;
}

/**
 * Build a smooth, organic anatomical or cloth-draped loft geometry from elliptical cross-section rings,
 * with continuous vertex normals and subtle cloth/muscle folds (replacing all blocky BoxGeometry primitives).
 */
function buildLoftGeometry(rings: readonly LoftRing[], radialSegs = 20): BufferGeometry {
  const rowCount = rings.length;
  const cols = radialSegs + 1;
  const positions = new Float32Array(rowCount * cols * 3);
  const uvs = new Float32Array(rowCount * cols * 2);
  const indices: number[] = [];

  let pIdx = 0;
  let uIdx = 0;
  for (let r = 0; r < rowCount; r++) {
    const ring = rings[r];
    const v = rowCount > 1 ? r / (rowCount - 1) : 0;
    const ox = ring.ox ?? 0;
    const oz = ring.oz ?? 0;
    const foldAmp = ring.foldAmp ?? 0;
    const foldFreq = ring.foldFreq ?? 6;
    for (let c = 0; c <= radialSegs; c++) {
      const u = c / radialSegs;
      const theta = u * Math.PI * 2;
      const fold = 1 + foldAmp * Math.sin(theta * foldFreq + v * 2.2);
      // Slight flattening on the back (-Z) and rounding on shoulders for natural human anatomy
      const backContour = 1 - 0.06 * Math.max(0, -Math.cos(theta));
      const x = ox + ring.rx * fold * backContour * Math.sin(theta);
      const z = oz + ring.rz * fold * Math.cos(theta);
      positions[pIdx++] = x;
      positions[pIdx++] = ring.y;
      positions[pIdx++] = z;
      uvs[uIdx++] = u;
      uvs[uIdx++] = v;
    }
  }

  for (let r = 0; r < rowCount - 1; r++) {
    for (let c = 0; c < radialSegs; c++) {
      const a = r * cols + c;
      const b = (r + 1) * cols + c;
      const d = (r + 1) * cols + (c + 1);
      const e = r * cols + (c + 1);
      indices.push(a, b, e, b, d, e);
    }
  }

  // Cap top and bottom smoothly toward ring centers
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build a 3D volumetric impasto / charcoal brushstroke shell that wraps around a lofted body part
 * (shoulders, back of coat, sleeves, hair), so the figure's silhouette breaks into living painterly strokes.
 */
function buildStrokeShellGeometry(
  rings: readonly LoftRing[],
  strokeCount: number,
  strokeLen: number,
  strokeWidth: number,
): BufferGeometry {
  const verts: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vOffset = 0;

  // Deterministic golden-ratio sequence for organic stroke placement
  for (let i = 0; i < strokeCount; i++) {
    const fracV = ((i * 0.61803398875) % 1);
    const theta = (i / strokeCount) * Math.PI * 2 + fracV * 1.7;
    const rFloat = fracV * (rings.length - 1);
    const r0 = Math.min(rings.length - 2, Math.floor(rFloat));
    const t = rFloat - r0;
    const a = rings[r0];
    const b = rings[r0 + 1];

    const y = a.y + (b.y - a.y) * t;
    const rx = a.rx + (b.rx - a.rx) * t + 0.008;
    const rz = a.rz + (b.rz - a.rz) * t + 0.008;
    const ox = (a.ox ?? 0) + ((b.ox ?? 0) - (a.ox ?? 0)) * t;
    const oz = (a.oz ?? 0) + ((b.oz ?? 0) - (a.oz ?? 0)) * t;

    const nx = Math.sin(theta);
    const nz = Math.cos(theta);
    const cx = ox + rx * nx;
    const cz = oz + rz * nz;

    // Tangent along the vertical/diagonal flow of the garment or hair
    const tilt = 0.24 * Math.sin(theta * 3.0 + i * 0.7);
    const tx = Math.cos(theta) * tilt;
    const ty = 1.0;
    const tz = -Math.sin(theta) * tilt;
    const tLen = Math.hypot(tx, ty, tz) || 1;
    const ux = tx / tLen;
    const uy = ty / tLen;
    const uz = tz / tLen;

    // Binormal across the stroke width
    const bx = nyCrossX(uy, uz, nx, nz);
    const by = nyCrossY(uz, ux, nx, nz);
    const bz = nyCrossZ(ux, uy, nx, nz);

    const halfL = strokeLen * (0.75 + 0.5 * ((i * 0.381966) % 1));
    const halfW = strokeWidth * (0.75 + 0.5 * ((i * 0.73205) % 1));
    const lift = 0.003 + 0.006 * ((i * 0.2718) % 1);

    // 3-segment curved impasto ribbon per stroke
    for (let s = 0; s <= 2; s++) {
      const sv = s / 2;
      const along = (sv - 0.5) * 2 * halfL;
      const arch = Math.sin(sv * Math.PI) * lift;
      const px = cx + ux * along + nx * arch;
      const py = y + uy * along;
      const pz = cz + uz * along + nz * arch;

      const wScale = s === 1 ? 1.0 : 0.65;
      verts.push(
        px - bx * halfW * wScale, py - by * halfW * wScale, pz - bz * halfW * wScale,
        px + bx * halfW * wScale, py + by * halfW * wScale, pz + bz * halfW * wScale,
      );
      uvs.push(0, sv, 1, sv);
    }

    indices.push(
      vOffset + 0, vOffset + 1, vOffset + 2,
      vOffset + 1, vOffset + 3, vOffset + 2,
      vOffset + 2, vOffset + 3, vOffset + 4,
      vOffset + 3, vOffset + 5, vOffset + 4,
    );
    vOffset += 6;
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function nyCrossX(uy: number, _uz: number, _nx: number, nz: number): number { return uy * nz; }
function nyCrossY(uz: number, ux: number, nx: number, nz: number): number { return uz * nx - ux * nz; }
function nyCrossZ(_ux: number, uy: number, nx: number, _nz: number): number { return -uy * nx; }

/** Build a contoured hat brim + crown geometry with organic wavy brim curvature. */
function buildContouredHatGeometry(brimRadius: number, crownRadius: number, crownHeight: number): BufferGeometry {
  const rings: LoftRing[] = [
    { y: -0.006, rx: brimRadius, rz: brimRadius * 1.06, foldAmp: 0.03, foldFreq: 3 },
    { y: 0.004, rx: brimRadius * 0.72, rz: brimRadius * 0.76, foldAmp: 0.02, foldFreq: 3 },
    { y: 0.012, rx: crownRadius * 1.04, rz: crownRadius * 1.08, foldAmp: 0.015, foldFreq: 4 },
    { y: crownHeight * 0.55, rx: crownRadius, rz: crownRadius * 1.04, foldAmp: 0.02, foldFreq: 5 },
    { y: crownHeight, rx: crownRadius * 0.86, rz: crownRadius * 0.90, foldAmp: 0.025, foldFreq: 4 },
    { y: crownHeight + 0.012, rx: crownRadius * 0.35, rz: crownRadius * 0.38, foldAmp: 0.01, foldFreq: 2 },
  ];
  return buildLoftGeometry(rings, 24);
}

interface EraCoatColors {
  coatHex: number;
  coatAccentHex: number;
  lapelHex: number;
  trouserHex: number;
  shirtHex: number;
  hatMode: 'none' | 'felt' | 'straw';
  propMode: 'sketch' | 'portfolio' | 'paintbox' | 'easel' | 'backpack';
}

const ERA_STYLES: Record<ChapterId, EraCoatColors> = {
  // Ch I: Nuenen 1885 — Dark coarse peat-wool coat with warm ochre lamp highlights, bareheaded, sketching on stool
  earth: {
    coatHex: 0x281e16,
    coatAccentHex: 0x4a3522,
    lapelHex: 0x1c140e,
    trouserHex: 0x211b15,
    shirtHex: 0x7c705e,
    hatMode: 'none',
    propMode: 'sketch',
  },
  // Ch II: Paris 1887 — French blue worker's jacket (Bleu de travail), grey felt hat, portfolio
  color: {
    coatHex: 0x243d63,
    coatAccentHex: 0x3b5f94,
    lapelHex: 0x1a2d4a,
    trouserHex: 0x323842,
    shirtHex: 0xb8c2cc,
    hatMode: 'felt',
    propMode: 'portfolio',
  },
  // Ch III: Arles 1888 — Provençal yellow straw hat, cobalt work jacket, wooden paintbox
  sun: {
    coatHex: 0x1f457e,
    coatAccentHex: 0x3668ad,
    lapelHex: 0x16335e,
    trouserHex: 0x7e6b4c,
    shirtHex: 0xd8d2c0,
    hatMode: 'straw',
    propMode: 'paintbox',
  },
  // Ch IV: Saint-Rémy 1889 — Unpretentious pale blue-grey linen studio smock, daytime indoor easel
  cosmos: {
    coatHex: 0x4a6678,
    coatAccentHex: 0x6c8ea3,
    lapelHex: 0x395060,
    trouserHex: 0x353c44,
    shirtHex: 0xc8cfd4,
    hatMode: 'none',
    propMode: 'easel',
  },
  // Ch V: Auvers 1890 — Weathered dark country coat, straw hat, strapped field easel & pack
  road: {
    coatHex: 0x262f38,
    coatAccentHex: 0x425160,
    lapelHex: 0x1c222a,
    trouserHex: 0x38322b,
    shirtHex: 0x9ca2a6,
    hatMode: 'straw',
    propMode: 'backpack',
  },
};

const _wPos = new Vector3();
function stageCoords(rightM: number, upM: number, fwdM: number, out = new Vector3()): Vector3 {
  return out
    .copy(EYE)
    .addScaledVector(RIGHT, rightM)
    .addScaledVector(UP, upM)
    .addScaledVector(FORWARD, fwdM);
}

export class VanGoghActorRig {
  readonly root = new Group();
  readonly lightUniforms: ActorMaterialUniforms = {
    uKeyDir: { value: new Vector3(-0.4, 0.75, 0.5).normalize() },
    uKeyColor: { value: new Vector3(1.0, 0.92, 0.78) },
    uFillColor: { value: new Vector3(0.18, 0.20, 0.25) },
    uActorOpacity: { value: 1.0 },
  };

  /** Independent biological/action clock — never frozen when the viewer dwells. */
  actorClock = 0;
  private activeChapter: ChapterId = 'earth';
  private readonly externalModels = new Map<ChapterId, Object3D>();

  // Articulated procedural rig hierarchy
  private readonly figureRoot = new Group();
  private readonly pelvis = new Group();
  private readonly torso = new Group();
  private readonly neck = new Group();
  private readonly head = new Group();
  private readonly armL = new Group();
  private readonly foreArmL = new Group();
  private readonly armR = new Group();
  private readonly foreArmR = new Group();
  private readonly legL = new Group();
  private readonly shinL = new Group();
  private readonly legR = new Group();
  private readonly shinR = new Group();

  // Era headgear & props
  private readonly feltHatGroup = new Group();
  private readonly strawHatGroup = new Group();
  private readonly sketchPropGroup = new Group();
  private readonly portfolioPropGroup = new Group();
  private readonly paintboxPropGroup = new Group();
  private readonly palettePropGroup = new Group();
  private readonly brushPropGroup = new Group();
  private readonly backpackPropGroup = new Group();
  private readonly stoolGroup = new Group();
  private readonly easelGroup = new Group();

  // Dynamic cloth materials updated per chapter
  private readonly coatMat: ShaderMaterial;
  private readonly coatStrokeMat: ShaderMaterial;
  private readonly lapelMat: ShaderMaterial;
  private readonly trouserMat: ShaderMaterial;
  private readonly shirtMat: ShaderMaterial;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: ShaderMaterial[] = [];

  constructor() {
    this.root.name = 'vanGoghActorStageRoot';
    this.figureRoot.name = 'vanGoghFigure';
    this.root.add(this.figureRoot, this.stoolGroup, this.easelGroup);

    const mkMat = (hex: number, rough = 0.8, sss = 0.12, dbl = false, accentHex?: number, relief = 0.52) => {
      const m = makeRealisticStageMaterial(hex, this.lightUniforms, {
        roughness: rough,
        subsurface: sss,
        doubleSide: dbl,
        accentHex,
        brushRelief: relief,
      });
      this.materials.push(m);
      return m;
    };
    const trackGeo = <T extends BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };

    const skinMat = mkMat(0xd4a284, 0.62, 0.36, false, 0xb87e5e, 0.35);
    const beardMat = mkMat(0x8e421e, 0.86, 0.18, true, 0xc4682c, 0.85); // Textured ginger-ochre Van Gogh hair & beard
    const bootMat = mkMat(0x1f1712, 0.68, 0.06, false, 0x382a20, 0.48);
    const woodMat = mkMat(0x523620, 0.76, 0.06, false, 0x785232, 0.55);
    const paperMat = mkMat(0xe4d6bc, 0.88, 0.16, true, 0xc4b08e, 0.42);
    const sketchCharcoalMat = mkMat(0x282018, 0.92, 0.04, true, 0x5c4632, 0.85);
    const strawMat = mkMat(0xdab248, 0.80, 0.18, true, 0xf2cf68, 0.78);
    const feltMat = mkMat(0x7e7b74, 0.84, 0.12, true, 0x9c988e, 0.62);

    this.coatMat = mkMat(0x281e16, 0.82, 0.12, false, 0x4a3522, 0.68);
    this.coatStrokeMat = mkMat(0x36281d, 0.86, 0.16, true, 0x63482e, 0.92);
    this.lapelMat = mkMat(0x1c140e, 0.84, 0.08, false, 0x38281c, 0.62);
    this.trouserMat = mkMat(0x211b15, 0.86, 0.08, false, 0x382e24, 0.58);
    this.shirtMat = mkMat(0x7c705e, 0.78, 0.12, false, 0x9c8e78, 0.45);

    // Build articulated organic human proportions (height ~1.70 m, zero BoxGeometry)
    this.pelvis.position.set(0, 0.90, 0);
    this.figureRoot.add(this.pelvis);

    const pelvisRings: LoftRing[] = [
      { y: -0.09, rx: 0.155, rz: 0.105, foldAmp: 0.03, foldFreq: 6 },
      { y: 0.0, rx: 0.168, rz: 0.115, foldAmp: 0.025, foldFreq: 6 },
      { y: 0.08, rx: 0.158, rz: 0.108, foldAmp: 0.02, foldFreq: 6 },
    ];
    this.pelvis.add(this.mesh(trackGeo(buildLoftGeometry(pelvisRings, 18)), this.trouserMat, 0, 0, 0));

    // Sculpted Torso, Rounded Shoulders, Draped Coat & 3D Impasto/Charcoal Brushstroke Shell
    this.torso.position.set(0, 0.05, 0);
    this.pelvis.add(this.torso);

    const torsoRings: LoftRing[] = [
      { y: -0.14, rx: 0.195, rz: 0.138, oz: -0.010, foldAmp: 0.055, foldFreq: 7 }, // Flared coat skirt hem
      { y: -0.04, rx: 0.178, rz: 0.124, oz: -0.005, foldAmp: 0.045, foldFreq: 7 },
      { y: 0.08, rx: 0.166, rz: 0.116, oz: 0.0, foldAmp: 0.030, foldFreq: 6 },     // Waist
      { y: 0.22, rx: 0.184, rz: 0.126, oz: -0.008, foldAmp: 0.028, foldFreq: 6 },  // Ribcage & upper back
      { y: 0.36, rx: 0.212, rz: 0.132, oz: -0.014, foldAmp: 0.025, foldFreq: 5 },  // Broad rounded shoulders
      { y: 0.45, rx: 0.175, rz: 0.112, oz: -0.010, foldAmp: 0.020, foldFreq: 5 },  // Upper trapezius slope
      { y: 0.50, rx: 0.095, rz: 0.088, oz: -0.004, foldAmp: 0.015, foldFreq: 4 },  // Coat collar ring
    ];
    const torsoGeo = trackGeo(buildLoftGeometry(torsoRings, 24));
    const torsoShellGeo = trackGeo(buildStrokeShellGeometry(torsoRings, 180, 0.095, 0.018));

    // Rolled wool collar & scarf around the neck base
    const collarRings: LoftRing[] = [
      { y: 0.44, rx: 0.125, rz: 0.108, oz: -0.006, foldAmp: 0.04, foldFreq: 5 },
      { y: 0.49, rx: 0.108, rz: 0.098, oz: -0.004, foldAmp: 0.04, foldFreq: 5 },
      { y: 0.525, rx: 0.082, rz: 0.080, oz: 0.002, foldAmp: 0.02, foldFreq: 4 },
    ];
    const collarGeo = trackGeo(buildLoftGeometry(collarRings, 18));

    // Rounded deltoid shoulder caps so arm-to-torso junctions are completely smooth and natural
    const shoulderCapGeo = trackGeo(new SphereGeometry(0.078, 14, 12));
    const leftShoulderCap = this.mesh(shoulderCapGeo, this.coatMat, -0.19, 0.41, -0.01);
    leftShoulderCap.scale.set(1.15, 0.92, 1.05);
    const rightShoulderCap = this.mesh(shoulderCapGeo, this.coatMat, 0.19, 0.41, -0.01);
    rightShoulderCap.scale.set(1.15, 0.92, 1.05);

    this.torso.add(
      this.mesh(torsoGeo, this.coatMat, 0, 0, 0),
      this.mesh(torsoShellGeo, this.coatStrokeMat, 0, 0, 0),
      this.mesh(collarGeo, this.lapelMat, 0, 0, 0),
      leftShoulderCap,
      rightShoulderCap,
    );

    // Neck & Organic Sculpted Head with Wavy Ginger-Ochre Hair Tuft Shell (no BoxGeometry!)
    this.neck.position.set(0, 0.49, 0);
    this.torso.add(this.neck);
    const neckRings: LoftRing[] = [
      { y: 0.0, rx: 0.064, rz: 0.066, oz: 0.0 },
      { y: 0.05, rx: 0.058, rz: 0.060, oz: 0.004 },
      { y: 0.10, rx: 0.060, rz: 0.062, oz: 0.008 },
    ];
    this.neck.add(this.mesh(trackGeo(buildLoftGeometry(neckRings, 14)), skinMat, 0, 0, 0));

    this.head.position.set(0, 0.08, 0.006);
    this.neck.add(this.head);

    // Sculpted anatomical head loft (chin -> cheekbones -> brow -> cranium dome)
    const headRings: LoftRing[] = [
      { y: -0.01, rx: 0.042, rz: 0.048, oz: 0.022 },
      { y: 0.025, rx: 0.068, rz: 0.082, oz: 0.014, foldAmp: 0.02, foldFreq: 4 },
      { y: 0.065, rx: 0.082, rz: 0.098, oz: 0.006, foldAmp: 0.02, foldFreq: 4 },
      { y: 0.110, rx: 0.086, rz: 0.104, oz: -0.004 },
      { y: 0.155, rx: 0.078, rz: 0.096, oz: -0.008 },
      { y: 0.190, rx: 0.045, rz: 0.058, oz: -0.006 },
    ];
    const headLoftGeo = trackGeo(buildLoftGeometry(headRings, 20));

    // Thick textured ginger-red hair & beard loft wrapping the back, nape, temples, and chin
    const hairRings: LoftRing[] = [
      { y: 0.005, rx: 0.062, rz: 0.068, oz: -0.018, foldAmp: 0.08, foldFreq: 9 }, // Nape hair
      { y: 0.055, rx: 0.086, rz: 0.098, oz: -0.016, foldAmp: 0.07, foldFreq: 10 },
      { y: 0.110, rx: 0.094, rz: 0.108, oz: -0.012, foldAmp: 0.06, foldFreq: 11 },
      { y: 0.162, rx: 0.086, rz: 0.100, oz: -0.008, foldAmp: 0.06, foldFreq: 9 },
      { y: 0.198, rx: 0.052, rz: 0.062, oz: -0.006, foldAmp: 0.04, foldFreq: 7 },
    ];
    const hairLoftGeo = trackGeo(buildLoftGeometry(hairRings, 20));
    const hairStrokeShellGeo = trackGeo(buildStrokeShellGeometry(hairRings, 95, 0.048, 0.012));

    // Organic beard contour around jawline & cheeks
    const beardRings: LoftRing[] = [
      { y: -0.022, rx: 0.048, rz: 0.056, oz: 0.032, foldAmp: 0.08, foldFreq: 8 },
      { y: 0.015, rx: 0.074, rz: 0.086, oz: 0.022, foldAmp: 0.07, foldFreq: 9 },
      { y: 0.052, rx: 0.082, rz: 0.088, oz: 0.012, foldAmp: 0.05, foldFreq: 8 },
    ];
    const beardLoftGeo = trackGeo(buildLoftGeometry(beardRings, 16));

    this.head.add(
      this.mesh(headLoftGeo, skinMat, 0, 0, 0),
      this.mesh(hairLoftGeo, beardMat, 0, 0, 0),
      this.mesh(hairStrokeShellGeo, beardMat, 0, 0, 0),
      this.mesh(beardLoftGeo, beardMat, 0, 0, 0),
    );

    // Era Hats (Paris grey felt hat & Arles/Auvers yellow straw hat with contoured wavy brims)
    const feltHatGeo = trackGeo(buildContouredHatGeometry(0.195, 0.098, 0.105));
    this.feltHatGroup.position.set(0, 0.145, -0.005);
    this.feltHatGroup.rotation.set(-0.10, 0, 0.03);
    this.feltHatGroup.add(this.mesh(feltHatGeo, feltMat, 0, 0, 0));

    const strawHatGeo = trackGeo(buildContouredHatGeometry(0.225, 0.102, 0.110));
    this.strawHatGroup.position.set(0, 0.148, -0.005);
    this.strawHatGroup.rotation.set(-0.12, 0, 0.02);
    this.strawHatGroup.add(this.mesh(strawHatGeo, strawMat, 0, 0, 0));
    this.head.add(this.feltHatGroup, this.strawHatGroup);

    // Organic Draped Sleeves, Forearms & Sculpted Hands (zero BoxGeometry!)
    const upperArmRings: LoftRing[] = [
      { y: -0.28, rx: 0.052, rz: 0.054, foldAmp: 0.05, foldFreq: 5 },
      { y: -0.14, rx: 0.058, rz: 0.060, foldAmp: 0.06, foldFreq: 6 },
      { y: 0.0, rx: 0.064, rz: 0.066, foldAmp: 0.04, foldFreq: 5 },
    ];
    const foreArmRings: LoftRing[] = [
      { y: -0.25, rx: 0.038, rz: 0.042, foldAmp: 0.04, foldFreq: 5 },
      { y: -0.12, rx: 0.048, rz: 0.050, foldAmp: 0.05, foldFreq: 6 },
      { y: 0.0, rx: 0.052, rz: 0.054, foldAmp: 0.05, foldFreq: 5 },
    ];
    const handRings: LoftRing[] = [
      { y: -0.085, rx: 0.022, rz: 0.028, oz: 0.008 },
      { y: -0.045, rx: 0.032, rz: 0.038, oz: 0.005 },
      { y: 0.0, rx: 0.030, rz: 0.032, oz: 0.0 },
    ];
    const upperArmGeo = trackGeo(buildLoftGeometry(upperArmRings, 14));
    const upperArmShellGeo = trackGeo(buildStrokeShellGeometry(upperArmRings, 42, 0.065, 0.014));
    const foreArmGeo = trackGeo(buildLoftGeometry(foreArmRings, 14));
    const foreArmShellGeo = trackGeo(buildStrokeShellGeometry(foreArmRings, 36, 0.058, 0.013));
    const handGeo = trackGeo(buildLoftGeometry(handRings, 12));

    this.armL.position.set(-0.20, 0.41, 0);
    this.torso.add(this.armL);
    this.armL.add(
      this.mesh(upperArmGeo, this.coatMat, 0, 0, 0),
      this.mesh(upperArmShellGeo, this.coatStrokeMat, 0, 0, 0),
    );
    this.foreArmL.position.set(0, -0.27, 0);
    this.armL.add(this.foreArmL);
    this.foreArmL.add(
      this.mesh(foreArmGeo, this.coatMat, 0, 0, 0),
      this.mesh(foreArmShellGeo, this.coatStrokeMat, 0, 0, 0),
      this.mesh(handGeo, skinMat, 0, -0.25, 0),
    );

    this.armR.position.set(0.20, 0.41, 0);
    this.torso.add(this.armR);
    this.armR.add(
      this.mesh(upperArmGeo, this.coatMat, 0, 0, 0),
      this.mesh(upperArmShellGeo, this.coatStrokeMat, 0, 0, 0),
    );
    this.foreArmR.position.set(0, -0.27, 0);
    this.armR.add(this.foreArmR);
    this.foreArmR.add(
      this.mesh(foreArmGeo, this.coatMat, 0, 0, 0),
      this.mesh(foreArmShellGeo, this.coatStrokeMat, 0, 0, 0),
      this.mesh(handGeo, skinMat, 0, -0.25, 0),
    );

    // Draped Trousers & Sculpted Leather Boots (zero BoxGeometry!)
    const thighRings: LoftRing[] = [
      { y: -0.42, rx: 0.066, rz: 0.068, foldAmp: 0.04, foldFreq: 5 },
      { y: -0.21, rx: 0.076, rz: 0.078, foldAmp: 0.05, foldFreq: 6 },
      { y: 0.0, rx: 0.084, rz: 0.086, foldAmp: 0.03, foldFreq: 5 },
    ];
    const shinRings: LoftRing[] = [
      { y: -0.38, rx: 0.052, rz: 0.056, foldAmp: 0.04, foldFreq: 5 },
      { y: -0.18, rx: 0.060, rz: 0.062, foldAmp: 0.04, foldFreq: 5 },
      { y: 0.0, rx: 0.064, rz: 0.066, foldAmp: 0.03, foldFreq: 5 },
    ];
    const bootRings: LoftRing[] = [
      { y: -0.06, rx: 0.052, rz: 0.115, oz: 0.038 },
      { y: -0.02, rx: 0.050, rz: 0.105, oz: 0.032 },
      { y: 0.03, rx: 0.046, rz: 0.058, oz: 0.004 },
    ];
    const thighGeo = trackGeo(buildLoftGeometry(thighRings, 14));
    const shinGeo = trackGeo(buildLoftGeometry(shinRings, 14));
    const bootGeo = trackGeo(buildLoftGeometry(bootRings, 14));

    this.legL.position.set(-0.095, -0.04, 0);
    this.pelvis.add(this.legL);
    this.legL.add(this.mesh(thighGeo, this.trouserMat, 0, 0, 0));
    this.shinL.position.set(0, -0.41, 0);
    this.legL.add(this.shinL);
    this.shinL.add(
      this.mesh(shinGeo, this.trouserMat, 0, 0, 0),
      this.mesh(bootGeo, bootMat, 0, -0.39, 0),
    );

    this.legR.position.set(0.095, -0.04, 0);
    this.pelvis.add(this.legR);
    this.legR.add(this.mesh(thighGeo, this.trouserMat, 0, 0, 0));
    this.shinR.position.set(0, -0.41, 0);
    this.legR.add(this.shinR);
    this.shinR.add(
      this.mesh(shinGeo, this.trouserMat, 0, 0, 0),
      this.mesh(bootGeo, bootMat, 0, -0.39, 0),
    );

    // Era Props (contoured wooden boards, charcoal sketch lines, easel, stool, field pack)
    // 1. Nuenen Sketchboard (held on lap/left forearm) & Charcoal stick (right hand)
    const boardRings: LoftRing[] = [
      { y: -0.008, rx: 0.19, rz: 0.145, foldAmp: 0.01, foldFreq: 4 },
      { y: 0.008, rx: 0.19, rz: 0.145, foldAmp: 0.01, foldFreq: 4 },
    ];
    const sheetRings: LoftRing[] = [
      { y: 0.008, rx: 0.165, rz: 0.125, foldAmp: 0.015, foldFreq: 3 },
      { y: 0.013, rx: 0.165, rz: 0.125, foldAmp: 0.015, foldFreq: 3 },
    ];
    const sketchMarksGeo = trackGeo(buildStrokeShellGeometry(sheetRings, 28, 0.045, 0.008));
    const charcoalGeo = trackGeo(new CylinderGeometry(0.0045, 0.0045, 0.13, 8));
    this.sketchPropGroup.position.set(0.09, -0.24, 0.12);
    this.sketchPropGroup.rotation.set(0.32, 0.18, -0.08);
    this.sketchPropGroup.add(
      this.mesh(trackGeo(buildLoftGeometry(boardRings, 16)), woodMat, 0, 0, 0),
      this.mesh(trackGeo(buildLoftGeometry(sheetRings, 16)), paperMat, 0, 0, 0),
      this.mesh(sketchMarksGeo, sketchCharcoalMat, 0, 0.004, 0),
    );
    this.foreArmL.add(this.sketchPropGroup);

    const charcoalStick = this.mesh(charcoalGeo, sketchCharcoalMat, 0, -0.29, 0.04);
    charcoalStick.rotation.x = Math.PI * 0.38;
    this.brushPropGroup.add(charcoalStick);
    this.foreArmR.add(this.brushPropGroup);

    // 2. Paris Portfolio under left arm
    const portRings: LoftRing[] = [
      { y: -0.21, rx: 0.018, rz: 0.26, foldAmp: 0.02, foldFreq: 2 },
      { y: 0.21, rx: 0.018, rz: 0.26, foldAmp: 0.02, foldFreq: 2 },
    ];
    this.portfolioPropGroup.position.set(-0.04, -0.15, 0.06);
    this.portfolioPropGroup.add(this.mesh(trackGeo(buildLoftGeometry(portRings, 12)), woodMat, 0, 0, 0));
    this.foreArmL.add(this.portfolioPropGroup);

    // 3. Arles Wooden Paintbox in left hand
    const boxRings: LoftRing[] = [
      { y: -0.12, rx: 0.075, rz: 0.18, foldAmp: 0.02, foldFreq: 4 },
      { y: 0.12, rx: 0.075, rz: 0.18, foldAmp: 0.02, foldFreq: 4 },
    ];
    this.paintboxPropGroup.position.set(-0.04, -0.32, 0.02);
    this.paintboxPropGroup.add(this.mesh(trackGeo(buildLoftGeometry(boxRings, 12)), woodMat, 0, 0, 0));
    this.foreArmL.add(this.paintboxPropGroup);

    // 4. Saint-Rémy Oval Wooden Palette (left hand) & H-frame studio easel
    const palRings: LoftRing[] = [
      { y: -0.006, rx: 0.13, rz: 0.17, foldAmp: 0.04, foldFreq: 2 },
      { y: 0.006, rx: 0.13, rz: 0.17, foldAmp: 0.04, foldFreq: 2 },
    ];
    this.palettePropGroup.position.set(0.04, -0.27, 0.08);
    this.palettePropGroup.add(this.mesh(trackGeo(buildLoftGeometry(palRings, 16)), woodMat, 0, 0, 0));
    this.foreArmL.add(this.palettePropGroup);

    // H-Frame Studio Easel (placed in front of him in Saint-Rémy)
    const postGeo = trackGeo(new CylinderGeometry(0.022, 0.024, 1.85, 10));
    const shelfGeo = trackGeo(new CylinderGeometry(0.026, 0.026, 0.78, 10));
    const easelCanvasRings: LoftRing[] = [
      { y: -0.28, rx: 0.36, rz: 0.016, foldAmp: 0.01, foldFreq: 4 },
      { y: 0.28, rx: 0.36, rz: 0.016, foldAmp: 0.01, foldFreq: 4 },
    ];
    const shelfMesh = this.mesh(shelfGeo, woodMat, 0, 0.96, 0.03);
    shelfMesh.rotation.z = Math.PI * 0.5;
    this.easelGroup.add(
      this.mesh(postGeo, woodMat, -0.28, 0.92, 0),
      this.mesh(postGeo, woodMat, 0.28, 0.92, 0),
      shelfMesh,
      this.mesh(trackGeo(buildLoftGeometry(easelCanvasRings, 16)), paperMat, 0, 1.27, 0.04),
    );

    // Nuenen Rustic Wooden Stool
    const stoolTopGeo = trackGeo(new CylinderGeometry(0.185, 0.195, 0.042, 16));
    const stoolLegGeo = trackGeo(new CylinderGeometry(0.022, 0.018, 0.48, 10));
    this.stoolGroup.add(
      this.mesh(stoolTopGeo, woodMat, 0, 0.48, 0),
      this.mesh(stoolLegGeo, woodMat, -0.11, 0.24, -0.10),
      this.mesh(stoolLegGeo, woodMat, 0.11, 0.24, -0.10),
      this.mesh(stoolLegGeo, woodMat, 0, 0.24, 0.12),
    );

    // 5. Auvers Field Backpack (strapped wooden paintbox + folded easel poles on back)
    const packRings: LoftRing[] = [
      { y: -0.21, rx: 0.15, rz: 0.078, foldAmp: 0.03, foldFreq: 4 },
      { y: 0.21, rx: 0.145, rz: 0.075, foldAmp: 0.03, foldFreq: 4 },
    ];
    const packPoleGeo = trackGeo(new CylinderGeometry(0.016, 0.016, 1.12, 8));
    this.backpackPropGroup.position.set(0, 0.25, -0.16);
    this.backpackPropGroup.add(
      this.mesh(trackGeo(buildLoftGeometry(packRings, 14)), woodMat, 0, 0, 0),
      this.mesh(packPoleGeo, woodMat, -0.11, 0.12, -0.05),
      this.mesh(packPoleGeo, woodMat, 0.11, 0.12, -0.05),
    );
    this.torso.add(this.backpackPropGroup);

    this.applyChapterStyle('earth');
  }

  private mesh(geo: BufferGeometry, mat: ShaderMaterial, x: number, y: number, z: number): Object3D {
    const m = new MeshNode(geo, mat);
    m.position.set(x, y, z);
    return m;
  }

  /** Optional hot-swap slot: attach a loaded GLTF/GLB scene for a specific chapter. */
  attachExternalModel(chapterId: ChapterId, model: Object3D): void {
    this.externalModels.set(chapterId, model);
    this.root.add(model);
  }

  private setColorHex(mat: ShaderMaterial, hex: number, accentHex?: number): void {
    const base = hexToLinearVec3(hex);
    (mat.uniforms.uBaseColor.value as Vector3).copy(base);
    const acc = hexToLinearVec3(accentHex ?? hex);
    (mat.uniforms.uAccentColor.value as Vector3).copy(acc);
  }

  applyChapterStyle(chapterId: ChapterId): void {
    this.activeChapter = chapterId;
    const s = ERA_STYLES[chapterId];
    this.setColorHex(this.coatMat, s.coatHex, s.coatAccentHex);
    this.setColorHex(this.coatStrokeMat, s.coatAccentHex, s.coatHex);
    this.setColorHex(this.lapelMat, s.lapelHex, s.coatHex);
    this.setColorHex(this.trouserMat, s.trouserHex, s.coatHex);
    this.setColorHex(this.shirtMat, s.shirtHex, s.coatAccentHex);

    this.feltHatGroup.visible = s.hatMode === 'felt';
    this.strawHatGroup.visible = s.hatMode === 'straw';
    this.sketchPropGroup.visible = s.propMode === 'sketch';
    this.portfolioPropGroup.visible = s.propMode === 'portfolio';
    this.paintboxPropGroup.visible = s.propMode === 'paintbox';
    this.palettePropGroup.visible = s.propMode === 'easel';
    this.brushPropGroup.visible = s.propMode === 'sketch' || s.propMode === 'easel';
    this.backpackPropGroup.visible = s.propMode === 'backpack';
    this.stoolGroup.visible = chapterId === 'earth';
    this.easelGroup.visible = chapterId === 'cosmos';

    for (const [ch, ext] of this.externalModels) {
      ext.visible = ch === chapterId;
    }
    this.figureRoot.visible = !this.externalModels.has(chapterId);
  }

  /**
   * Advance the realistic Van Gogh actor for the active chapter.
   * @param realDt Real wall-clock delta time in seconds (never frozen when the viewer dwells!).
   * @param chapterId Active chapter ID.
   * @param stageProgress Normalized progress [0, 1] through the chapter's opening witness stage.
   * @param alignAtE Current alignment with the mathematical point E [0, 1]. When alignAtE approaches 1,
   *                 Van Gogh has naturally stepped outside the canvas frame so E stays 100% pure.
   */
  update(realDt: number, chapterId: ChapterId, stageProgress: number, alignAtE: number): void {
    this.actorClock += Math.max(0, Math.min(0.1, realDt));
    if (chapterId !== this.activeChapter) {
      this.applyChapterStyle(chapterId);
    }

    // Structural Principle #2: E is the pure mathematical alignment point of the oil painting.
    // As the painting reassembles at E (or once the actor has walked out of frame), fade out cleanly.
    const departFade = 1 - smooth01((stageProgress - 0.78) / 0.20);
    const eyePurityFade = 1 - smooth01((alignAtE - 0.68) / 0.16);
    const opacity = Math.min(departFade, eyePurityFade);
    this.lightUniforms.uActorOpacity.value = opacity;
    this.root.visible = opacity > 0.005;
    if (!this.root.visible) return;

    const t = this.actorClock;
    const breath = Math.sin(t * 1.9);

    // Reset neutral joint rotations
    this.pelvis.position.set(0, 0.90, 0);
    this.pelvis.rotation.set(0, 0, 0);
    this.torso.rotation.set(0.03 * breath, 0, 0);
    this.neck.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0);
    this.foreArmL.rotation.set(0, 0, 0);
    this.armR.rotation.set(0, 0, 0);
    this.foreArmR.rotation.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0);
    this.shinL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
    this.shinR.rotation.set(0, 0, 0);

    switch (chapterId) {
      case 'earth': {
        // Chapter I (Nuenen): Seated on a wooden stool in the dim corner (-0.82m left, -1.55m below E, 3.65m ahead),
        // facing AWAY from the camera (Math.PI - 0.26) toward the hanging oil lamp & peasant table!
        // Witness camera looks over his right shoulder ("身後／側後背影見證視角") as he sketches.
        this.lightUniforms.uKeyDir.value.set(0.38, 0.58, -0.72).normalize();
        this.lightUniforms.uKeyColor.value.set(1.28, 0.82, 0.38); // Warm oil lamp amber rim glow
        this.lightUniforms.uFillColor.value.set(0.10, 0.08, 0.06);

        stageCoords(-0.82, -1.55, 3.65, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, Math.PI - 0.26, 0);
        this.stoolGroup.position.copy(_wPos);

        // Seated sketching posture seen from three-quarter back over-the-shoulder angle
        this.pelvis.position.set(0, 0.52, 0);
        this.torso.rotation.set(0.24 + 0.02 * breath, 0.08, 0);
        this.legL.rotation.set(-1.32, 0.12, 0);
        this.shinL.rotation.set(1.38, 0, 0);
        this.legR.rotation.set(-1.28, -0.12, 0);
        this.shinR.rotation.set(1.34, 0, 0);

        // Left hand holds sketchboard; right hand sketches rhythmically, occasionally glancing up toward the table
        const lookUp = Math.max(0, Math.sin(t * 0.55) - 0.35);
        this.head.rotation.set(0.22 - 0.32 * lookUp, -0.14 + 0.10 * Math.sin(t * 0.8), 0);
        this.armL.rotation.set(-0.58, 0.22, 0.12);
        this.foreArmL.rotation.set(-0.76, 0, 0);
        this.armR.rotation.set(-0.68 + 0.06 * Math.sin(t * 3.8), -0.16, -0.12);
        this.foreArmR.rotation.set(-0.82 + 0.11 * Math.cos(t * 4.6), 0.14 * Math.sin(t * 3.2), 0);
        break;
      }

      case 'color': {
        // Chapter II (Paris): Walking along the misty boulevard ahead of the viewer (seen from behind),
        // observing the city and light, then naturally turning toward the sidewalk edge as street colors awaken.
        this.lightUniforms.uKeyDir.value.set(-0.35, 0.82, -0.44).normalize();
        this.lightUniforms.uKeyColor.value.set(0.95, 0.98, 1.05);
        this.lightUniforms.uFillColor.value.set(0.26, 0.30, 0.36);

        const walkDist = 4.2 + stageProgress * 5.2;
        const sideDrift = -0.32 - Math.pow(Math.max(0, stageProgress - 0.45), 1.6) * 3.8;
        stageCoords(sideDrift, -1.58, walkDist, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, Math.PI + (stageProgress > 0.45 ? 0.38 * (stageProgress - 0.45) : 0), 0);

        const stride = t * 3.4;
        const sSin = Math.sin(stride);
        const sCos = Math.cos(stride);
        this.pelvis.position.y = 0.90 + 0.028 * Math.abs(sCos);
        this.torso.rotation.set(0.07, -0.06 * sSin, 0.02 * sCos);
        this.head.rotation.set(-0.06 + 0.07 * Math.sin(t * 0.7), 0.28 * Math.sin(t * 0.55), 0);
        this.legL.rotation.x = 0.36 * sSin;
        this.shinL.rotation.x = Math.max(0, -0.52 * sCos);
        this.legR.rotation.x = -0.36 * sSin;
        this.shinR.rotation.x = Math.max(0, 0.52 * sCos);
        this.armL.rotation.set(-0.24, 0.10, 0.14);
        this.foreArmL.rotation.set(-0.65, 0, 0);
        this.armR.rotation.x = 0.26 * sSin;
        this.foreArmR.rotation.x = -0.22 - 0.12 * Math.max(0, sSin);
        break;
      }

      case 'sun': {
        // Chapter III (Arles): Walking into the Yellow House (seen from behind/three-quarter back),
        // looking at the simple furniture with quiet anticipation before stepping out of the frame.
        this.lightUniforms.uKeyDir.value.set(-0.55, 0.72, -0.42).normalize();
        this.lightUniforms.uKeyColor.value.set(1.12, 1.02, 0.80); // Warm Provençal afternoon sun
        this.lightUniforms.uFillColor.value.set(0.28, 0.25, 0.32); // Subtle pale-lilac wall bounce

        const enterP = Math.min(1, stageProgress * 2.2);
        const departP = Math.max(0, (stageProgress - 0.58) / 0.42);
        const rightOff = 0.72 - 0.26 * enterP + 2.4 * departP * departP;
        const fwdOff = 3.6 + 1.1 * enterP - 0.6 * departP;
        stageCoords(rightOff, -1.56, fwdOff, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, Math.PI + 0.28 - 0.55 * departP, 0);

        const isWalking = enterP < 0.95 || departP > 0.08;
        const walkAmp = isWalking ? 0.26 : 0.02;
        const wPhase = t * 2.8;
        this.pelvis.position.y = 0.90 + 0.02 * walkAmp * Math.abs(Math.cos(wPhase));
        this.torso.rotation.set(0.04, 0.05 * Math.sin(t * 0.6), 0);
        this.head.rotation.set(-0.04 + 0.05 * Math.sin(t * 0.5), 0.24 * Math.sin(t * 0.45), 0);
        this.legL.rotation.x = walkAmp * Math.sin(wPhase);
        this.shinL.rotation.x = Math.max(0, -walkAmp * 1.3 * Math.cos(wPhase));
        this.legR.rotation.x = -walkAmp * Math.sin(wPhase);
        this.shinR.rotation.x = Math.max(0, walkAmp * 1.3 * Math.cos(wPhase));
        this.armL.rotation.set(-0.12, 0, 0.08);
        this.foreArmL.rotation.set(-0.35, 0, 0);
        this.armR.rotation.set(-0.18 + 0.1 * Math.sin(t * 0.8), 0, -0.06);
        this.foreArmR.rotation.set(-0.28, 0, 0);
        break;
      }

      case 'cosmos': {
        // Chapter IV (Saint-Rémy): Standing calmly at his easel in the daytime indoor studio (seen from behind his shoulder).
        // Zero melodrama: steady, composed brushwork as the camera slowly leaves his side and enters the canvas cosmos.
        this.lightUniforms.uKeyDir.value.set(-0.48, 0.78, -0.40).normalize();
        this.lightUniforms.uKeyColor.value.set(0.96, 0.98, 1.02); // Clear daytime studio window light
        this.lightUniforms.uFillColor.value.set(0.20, 0.24, 0.30);

        stageCoords(-0.78, -1.55, 3.7, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, Math.PI - 0.26, 0);

        stageCoords(-0.38, -1.55, 4.35, _wPos);
        this.easelGroup.position.copy(_wPos);
        this.easelGroup.rotation.set(0, -0.22, 0);

        // Calm, deliberate painting gesture at the easel
        const strokeCycle = t * 2.1;
        const reach = 0.5 + 0.5 * Math.sin(strokeCycle * 0.7);
        this.torso.rotation.set(0.05 + 0.02 * breath, -0.10 + 0.06 * reach, 0);
        this.head.rotation.set(-0.04 + 0.04 * Math.sin(strokeCycle), 0.10, 0);
        this.armL.rotation.set(-0.48, 0.24, 0.16);
        this.foreArmL.rotation.set(-0.88, 0.15, 0);
        this.armR.rotation.set(-0.82 - 0.18 * reach, -0.16 + 0.10 * Math.cos(strokeCycle), -0.12);
        this.foreArmR.rotation.set(-0.62 + 0.14 * Math.sin(strokeCycle * 1.5), 0.12 * Math.cos(strokeCycle), 0);
        break;
      }

      case 'road': {
        // Chapter V (Auvers): Walking ahead along the open field path with his strapped easel & pack (seen from behind),
        // pausing briefly to look out over the wheat and sky before walking onward past the edge of the frame.
        this.lightUniforms.uKeyDir.value.set(0.32, 0.84, -0.43).normalize();
        this.lightUniforms.uKeyColor.value.set(1.04, 0.98, 0.86);
        this.lightUniforms.uFillColor.value.set(0.22, 0.28, 0.34);

        const pauseWindow = smooth01((stageProgress - 0.28) / 0.14) * (1 - smooth01((stageProgress - 0.62) / 0.14));
        const strideAmp = 0.32 * (1 - 0.88 * pauseWindow);
        const fwdDist = 4.2 + stageProgress * 6.8;
        const pathCurve = 0.22 * Math.sin(stageProgress * Math.PI) + Math.max(0, stageProgress - 0.68) * 4.2;
        stageCoords(pathCurve, -1.58, fwdDist, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, Math.PI + (stageProgress > 0.65 ? -0.42 * (stageProgress - 0.65) : 0.06), 0);

        const wPhase = t * 3.1;
        const sSin = Math.sin(wPhase);
        const sCos = Math.cos(wPhase);
        this.pelvis.position.y = 0.90 + 0.025 * (strideAmp / 0.32) * Math.abs(sCos);
        this.torso.rotation.set(0.11, -0.04 * sSin, 0);
        this.head.rotation.set(-0.06 - 0.08 * pauseWindow, 0.24 * Math.sin(t * 0.42), 0);
        this.legL.rotation.x = strideAmp * sSin;
        this.shinL.rotation.x = Math.max(0, -strideAmp * 1.4 * sCos);
        this.legR.rotation.x = -strideAmp * sSin;
        this.shinR.rotation.x = Math.max(0, strideAmp * 1.4 * sCos);
        this.armL.rotation.set(-0.18 + 0.16 * sSin, 0.08, 0.12);
        this.foreArmL.rotation.set(-0.48, 0, 0);
        this.armR.rotation.set(0.20 * sSin, 0, -0.08);
        this.foreArmR.rotation.set(-0.28, 0, 0);
        break;
      }
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}

class MeshNode extends Mesh {
  constructor(geo: BufferGeometry, mat: ShaderMaterial) {
    super(geo, mat);
    this.frustumCulled = false;
  }
}

function smooth01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}
