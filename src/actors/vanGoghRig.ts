// Historically informed 3D Van Gogh actor rig (5 era attire & prop configurations, 1885–1890).
// Enforces two core structural principles:
//  1. Independent human agency (`actorClock` advances by real un-frozen delta time; the viewer can dwell in space
//     but never freezes Van Gogh like a game NPC).
//  2. Separation of the realistic stage from the mathematical alignment point E: as the painting reassembles at E,
//     Van Gogh naturally walks/steps out of the camera frame so E remains 100% pure.
import {
  BoxGeometry, CylinderGeometry, DoubleSide, FrontSide, Group, SphereGeometry, ShaderMaterial, Vector3,
  type BufferGeometry, type Object3D,
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
void main() {
  vActLocal = position;
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
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uFillColor;
uniform float uRoughness;
uniform float uSubsurface;
uniform float uActorOpacity;
varying vec3 vActWorld;
varying vec3 vActNormal;
varying vec3 vActLocal;

void main() {
  if (uActorOpacity <= 0.002) discard;
  if (uActorOpacity < 0.998 && uActorOpacity <= ign(gl_FragCoord.xy)) discard;

  vec3 N = normalize(vActNormal);
  vec3 V = normalize(cameraPosition - vActWorld);
  if (dot(N, V) < 0.0) N = -N;
  vec3 L = normalize(uKeyDir);

  // Subtle fabric/skin micro-grain in world space
  float grain = 0.94 + 0.06 * vnoise3(vActWorld * 14.0 + vActLocal * 8.0);
  vec3 albedo = uBaseColor * grain;

  // Wrapped diffuse + subsurface warmth for natural human/cloth rendering
  float ndl = dot(N, L);
  float wrapDiff = max(0.0, (ndl + 0.35) / 1.35);
  float backScatter = max(0.0, dot(-N, L)) * uSubsurface;

  // Soft Fresnel rim light so his silhouette reads clearly against dim interiors or bright skies
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2) * (1.0 - 0.5 * uRoughness);

  vec3 H = normalize(L + V);
  float specPower = mix(42.0, 8.0, uRoughness);
  float spec = pow(max(dot(N, H), 0.0), specPower) * (1.0 - uRoughness) * 0.22;

  vec3 lit = albedo * (uFillColor + uKeyColor * (wrapDiff + 0.35 * backScatter))
           + uKeyColor * (spec + 0.18 * rim);

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

export function makeRealisticStageMaterial(
  hex: number,
  sharedLight: ActorMaterialUniforms,
  opts?: { roughness?: number; subsurface?: number; doubleSide?: boolean },
): ShaderMaterial {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  // sRGB to linear approx
  const lin = new Vector3(Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2));
  return new ShaderMaterial({
    name: `actor#${hex.toString(16).padStart(6, '0')}`,
    uniforms: {
      uBaseColor: { value: lin },
      uKeyDir: sharedLight.uKeyDir,
      uKeyColor: sharedLight.uKeyColor,
      uFillColor: sharedLight.uFillColor,
      uRoughness: { value: opts?.roughness ?? 0.78 },
      uSubsurface: { value: opts?.subsurface ?? 0.1 },
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

interface EraCoatColors {
  coatHex: number;
  lapelHex: number;
  trouserHex: number;
  shirtHex: number;
  hatMode: 'none' | 'felt' | 'straw';
  propMode: 'sketch' | 'portfolio' | 'paintbox' | 'easel' | 'backpack';
}

const ERA_STYLES: Record<ChapterId, EraCoatColors> = {
  // Ch I: Nuenen 1885 — Dark coarse wool coat, bareheaded, sketching on stool
  earth: {
    coatHex: 0x2a2019,
    lapelHex: 0x1e1611,
    trouserHex: 0x221d18,
    shirtHex: 0x7c7264,
    hatMode: 'none',
    propMode: 'sketch',
  },
  // Ch II: Paris 1887 — French blue worker's jacket (Bleu de travail), grey felt hat, portfolio
  color: {
    coatHex: 0x253d61,
    lapelHex: 0x1c2f4c,
    trouserHex: 0x333942,
    shirtHex: 0xb8c0c8,
    hatMode: 'felt',
    propMode: 'portfolio',
  },
  // Ch III: Arles 1888 — Provençal yellow straw hat, cobalt work jacket, wooden paintbox
  sun: {
    coatHex: 0x1f457d,
    lapelHex: 0x173562,
    trouserHex: 0x7e6b4e,
    shirtHex: 0xd8d2c2,
    hatMode: 'straw',
    propMode: 'paintbox',
  },
  // Ch IV: Saint-Rémy 1889 — Unpretentious pale blue-grey linen studio smock, daytime indoor easel
  cosmos: {
    coatHex: 0x4e687a,
    lapelHex: 0x3d5363,
    trouserHex: 0x363d45,
    shirtHex: 0xc8cfd4,
    hatMode: 'none',
    propMode: 'easel',
  },
  // Ch V: Auvers 1890 — Weathered dark country coat, straw hat, strapped field easel & pack
  road: {
    coatHex: 0x272f38,
    lapelHex: 0x1d232b,
    trouserHex: 0x38332c,
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
  private readonly lapelMat: ShaderMaterial;
  private readonly trouserMat: ShaderMaterial;
  private readonly shirtMat: ShaderMaterial;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: ShaderMaterial[] = [];

  constructor() {
    this.root.name = 'vanGoghActorStageRoot';
    this.figureRoot.name = 'vanGoghFigure';
    this.root.add(this.figureRoot, this.stoolGroup, this.easelGroup);

    const mkMat = (hex: number, rough = 0.8, sss = 0.08, dbl = false) => {
      const m = makeRealisticStageMaterial(hex, this.lightUniforms, { roughness: rough, subsurface: sss, doubleSide: dbl });
      this.materials.push(m);
      return m;
    };
    const trackGeo = <T extends BufferGeometry>(g: T): T => {
      this.geometries.push(g);
      return g;
    };

    const skinMat = mkMat(0xd8a98c, 0.58, 0.35);
    const beardMat = mkMat(0x964822, 0.85, 0.15); // Reddish-ochre Van Gogh hair & beard
    const bootMat = mkMat(0x1f1712, 0.65, 0.04);
    const woodMat = mkMat(0x5c3e26, 0.72, 0.05);
    const paperMat = mkMat(0xe8dec8, 0.88, 0.12, true);
    const strawMat = mkMat(0xdab44e, 0.82, 0.14, true);
    const feltMat = mkMat(0x88857e, 0.84, 0.10, true);

    this.coatMat = mkMat(0x2a2019, 0.82, 0.08);
    this.lapelMat = mkMat(0x1e1611, 0.84, 0.06);
    this.trouserMat = mkMat(0x221d18, 0.85, 0.05);
    this.shirtMat = mkMat(0x7c7264, 0.78, 0.10);

    // Build articulated human proportions (height ~1.70 m, historically accurate for Vincent)
    this.pelvis.position.set(0, 0.90, 0);
    this.figureRoot.add(this.pelvis);

    const hipsMesh = new Group();
    const hipBox = trackGeo(new BoxGeometry(0.33, 0.16, 0.21));
    hipsMesh.add(this.mesh(hipBox, this.trouserMat, 0, 0, 0));
    this.pelvis.add(hipsMesh);

    // Torso & Coat
    this.torso.position.set(0, 0.06, 0);
    this.pelvis.add(this.torso);
    const chestGeo = trackGeo(new BoxGeometry(0.37, 0.48, 0.23));
    const coatSkirtGeo = trackGeo(new BoxGeometry(0.36, 0.24, 0.24));
    const lapelGeo = trackGeo(new BoxGeometry(0.10, 0.30, 0.245));
    const shirtGeo = trackGeo(new BoxGeometry(0.14, 0.22, 0.235));
    this.torso.add(
      this.mesh(chestGeo, this.coatMat, 0, 0.24, 0),
      this.mesh(coatSkirtGeo, this.coatMat, 0, -0.06, 0),
      this.mesh(lapelGeo, this.lapelMat, -0.09, 0.31, 0),
      this.mesh(lapelGeo, this.lapelMat, 0.09, 0.31, 0),
      this.mesh(shirtGeo, this.shirtMat, 0, 0.35, 0),
    );

    // Neck & Head with characteristic ginger-red beard, brow, and cheekbones
    this.neck.position.set(0, 0.50, 0);
    this.torso.add(this.neck);
    const neckGeo = trackGeo(new CylinderGeometry(0.058, 0.064, 0.10, 10));
    this.neck.add(this.mesh(neckGeo, skinMat, 0, 0.04, 0));

    this.head.position.set(0, 0.09, 0);
    this.neck.add(this.head);
    const craniumGeo = trackGeo(new SphereGeometry(0.108, 14, 12));
    const jawGeo = trackGeo(new BoxGeometry(0.145, 0.12, 0.155));
    const noseGeo = trackGeo(new BoxGeometry(0.028, 0.055, 0.045));
    const hairTopGeo = trackGeo(new SphereGeometry(0.113, 12, 10));
    const beardChinGeo = trackGeo(new BoxGeometry(0.152, 0.095, 0.162));
    const cranium = this.mesh(craniumGeo, skinMat, 0, 0.09, 0);
    cranium.scale.set(0.92, 1.08, 1.02);
    const hair = this.mesh(hairTopGeo, beardMat, 0, 0.105, -0.012);
    hair.scale.set(0.94, 1.02, 1.04);
    this.head.add(
      cranium,
      hair,
      this.mesh(jawGeo, skinMat, 0, 0.035, 0.01),
      this.mesh(noseGeo, skinMat, 0, 0.065, 0.10),
      this.mesh(beardChinGeo, beardMat, 0, 0.008, 0.018),
    );

    // Era Hats (Paris grey felt hat & Arles/Auvers yellow straw hat)
    const brimGeo = trackGeo(new CylinderGeometry(0.21, 0.22, 0.014, 18));
    const crownGeo = trackGeo(new CylinderGeometry(0.105, 0.118, 0.11, 16));
    this.feltHatGroup.position.set(0, 0.155, 0);
    this.feltHatGroup.rotation.x = -0.08;
    this.feltHatGroup.add(
      this.mesh(brimGeo, feltMat, 0, 0, 0),
      this.mesh(crownGeo, feltMat, 0, 0.055, 0),
    );
    this.strawHatGroup.position.set(0, 0.158, 0);
    this.strawHatGroup.rotation.x = -0.10;
    const strawBrimGeo = trackGeo(new CylinderGeometry(0.24, 0.25, 0.016, 18));
    this.strawHatGroup.add(
      this.mesh(strawBrimGeo, strawMat, 0, 0, 0),
      this.mesh(crownGeo, strawMat, 0, 0.055, 0),
    );
    this.head.add(this.feltHatGroup, this.strawHatGroup);

    // Arms & Forearms
    const upperArmGeo = trackGeo(new CylinderGeometry(0.054, 0.046, 0.29, 10));
    const foreArmGeo = trackGeo(new CylinderGeometry(0.044, 0.036, 0.27, 10));
    const handGeo = trackGeo(new BoxGeometry(0.045, 0.085, 0.065));

    this.armL.position.set(-0.22, 0.44, 0);
    this.torso.add(this.armL);
    this.armL.add(this.mesh(upperArmGeo, this.coatMat, 0, -0.14, 0));
    this.foreArmL.position.set(0, -0.28, 0);
    this.armL.add(this.foreArmL);
    this.foreArmL.add(
      this.mesh(foreArmGeo, this.coatMat, 0, -0.13, 0),
      this.mesh(handGeo, skinMat, 0, -0.29, 0),
    );

    this.armR.position.set(0.22, 0.44, 0);
    this.torso.add(this.armR);
    this.armR.add(this.mesh(upperArmGeo, this.coatMat, 0, -0.14, 0));
    this.foreArmR.position.set(0, -0.28, 0);
    this.armR.add(this.foreArmR);
    this.foreArmR.add(
      this.mesh(foreArmGeo, this.coatMat, 0, -0.13, 0),
      this.mesh(handGeo, skinMat, 0, -0.29, 0),
    );

    // Legs & Boots
    const thighGeo = trackGeo(new CylinderGeometry(0.078, 0.064, 0.43, 10));
    const shinGeo = trackGeo(new CylinderGeometry(0.060, 0.048, 0.42, 10));
    const bootGeo = trackGeo(new BoxGeometry(0.095, 0.085, 0.23));

    this.legL.position.set(-0.095, -0.04, 0);
    this.pelvis.add(this.legL);
    this.legL.add(this.mesh(thighGeo, this.trouserMat, 0, -0.21, 0));
    this.shinL.position.set(0, -0.42, 0);
    this.legL.add(this.shinL);
    this.shinL.add(
      this.mesh(shinGeo, this.trouserMat, 0, -0.21, 0),
      this.mesh(bootGeo, bootMat, 0, -0.42, 0.04),
    );

    this.legR.position.set(0.095, -0.04, 0);
    this.pelvis.add(this.legR);
    this.legR.add(this.mesh(thighGeo, this.trouserMat, 0, -0.21, 0));
    this.shinR.position.set(0, -0.42, 0);
    this.legR.add(this.shinR);
    this.shinR.add(
      this.mesh(shinGeo, this.trouserMat, 0, -0.21, 0),
      this.mesh(bootGeo, bootMat, 0, -0.42, 0.04),
    );

    // Props attached to hands / torso
    // 1. Nuenen Sketchboard (left hand/lap) & Charcoal stick (right hand)
    const boardGeo = trackGeo(new BoxGeometry(0.36, 0.015, 0.28));
    const sheetGeo = trackGeo(new BoxGeometry(0.32, 0.006, 0.24));
    const charcoalGeo = trackGeo(new CylinderGeometry(0.005, 0.005, 0.13, 6));
    this.sketchPropGroup.position.set(0.08, -0.27, 0.12);
    this.sketchPropGroup.rotation.set(0.35, 0.2, 0);
    this.sketchPropGroup.add(
      this.mesh(boardGeo, woodMat, 0, 0, 0),
      this.mesh(sheetGeo, paperMat, 0, 0.01, 0),
    );
    this.foreArmL.add(this.sketchPropGroup);

    const charcoalStick = this.mesh(charcoalGeo, bootMat, 0, -0.32, 0.05);
    charcoalStick.rotation.x = Math.PI * 0.38;
    this.brushPropGroup.add(charcoalStick);
    this.foreArmR.add(this.brushPropGroup);

    // 2. Paris Portfolio under left arm
    const portGeo = trackGeo(new BoxGeometry(0.03, 0.42, 0.54));
    this.portfolioPropGroup.position.set(-0.04, -0.16, 0.06);
    this.portfolioPropGroup.add(this.mesh(portGeo, woodMat, 0, 0, 0));
    this.foreArmL.add(this.portfolioPropGroup);

    // 3. Arles Wooden Paintbox in left hand
    const boxGeo = trackGeo(new BoxGeometry(0.16, 0.24, 0.38));
    this.paintboxPropGroup.position.set(-0.04, -0.34, 0.02);
    this.paintboxPropGroup.add(this.mesh(boxGeo, woodMat, 0, 0, 0));
    this.foreArmL.add(this.paintboxPropGroup);

    // 4. Saint-Rémy Palette (left hand) & H-frame studio easel
    const palGeo = trackGeo(new BoxGeometry(0.26, 0.012, 0.34));
    this.palettePropGroup.position.set(0.04, -0.29, 0.08);
    this.palettePropGroup.add(this.mesh(palGeo, woodMat, 0, 0, 0));
    this.foreArmL.add(this.palettePropGroup);

    // H-Frame Studio Easel (placed in front of him in Saint-Rémy)
    const postGeo = trackGeo(new BoxGeometry(0.045, 1.85, 0.045));
    const shelfGeo = trackGeo(new BoxGeometry(0.76, 0.045, 0.09));
    const easelCanvasGeo = trackGeo(new BoxGeometry(0.72, 0.58, 0.025));
    this.easelGroup.add(
      this.mesh(postGeo, woodMat, -0.28, 0.92, 0),
      this.mesh(postGeo, woodMat, 0.28, 0.92, 0),
      this.mesh(shelfGeo, woodMat, 0, 0.96, 0.03),
      this.mesh(easelCanvasGeo, paperMat, 0, 1.27, 0.04),
    );

    // Nuenen Wooden Stool
    const stoolTopGeo = trackGeo(new CylinderGeometry(0.19, 0.19, 0.04, 14));
    const stoolLegGeo = trackGeo(new CylinderGeometry(0.024, 0.02, 0.48, 8));
    this.stoolGroup.add(
      this.mesh(stoolTopGeo, woodMat, 0, 0.48, 0),
      this.mesh(stoolLegGeo, woodMat, -0.11, 0.24, -0.10),
      this.mesh(stoolLegGeo, woodMat, 0.11, 0.24, -0.10),
      this.mesh(stoolLegGeo, woodMat, 0, 0.24, 0.12),
    );

    // 5. Auvers Field Backpack (strapped wooden box + folded easel poles on back)
    const packBoxGeo = trackGeo(new BoxGeometry(0.32, 0.44, 0.16));
    const packPoleGeo = trackGeo(new CylinderGeometry(0.018, 0.018, 1.15, 8));
    this.backpackPropGroup.position.set(0, 0.26, -0.19);
    this.backpackPropGroup.add(
      this.mesh(packBoxGeo, woodMat, 0, 0, 0),
      this.mesh(packPoleGeo, woodMat, -0.12, 0.14, -0.06),
      this.mesh(packPoleGeo, woodMat, 0.12, 0.14, -0.06),
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

  private setColorHex(mat: ShaderMaterial, hex: number): void {
    const r = ((hex >> 16) & 255) / 255;
    const g = ((hex >> 8) & 255) / 255;
    const b = (hex & 255) / 255;
    (mat.uniforms.uBaseColor.value as Vector3).set(Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2));
  }

  applyChapterStyle(chapterId: ChapterId): void {
    this.activeChapter = chapterId;
    const s = ERA_STYLES[chapterId];
    this.setColorHex(this.coatMat, s.coatHex);
    this.setColorHex(this.lapelMat, s.lapelHex);
    this.setColorHex(this.trouserMat, s.trouserHex);
    this.setColorHex(this.shirtMat, s.shirtHex);

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
    const departFade = 1 - smooth01(( stageProgress - 0.78 ) / 0.20);
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
        // Chapter I (Nuenen): Seated on a wooden stool in the dim corner (-1.15m left, -1.65m below E, 4.2m ahead).
        // As the camera moves past his right shoulder toward the table, he remains quietly seated in the corner behind the lens.
        this.lightUniforms.uKeyDir.value.set(0.45, 0.65, -0.60).normalize();
        this.lightUniforms.uKeyColor.value.set(1.15, 0.74, 0.36); // Warm oil lamp glow
        this.lightUniforms.uFillColor.value.set(0.08, 0.06, 0.05);

        stageCoords(-1.12, -1.55, 4.4, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, -0.32, 0);
        this.stoolGroup.position.copy(_wPos);

        // Seated posture
        this.pelvis.position.set(0, 0.52, 0);
        this.torso.rotation.set(0.28 + 0.02 * breath, 0.06, 0);
        this.legL.rotation.set(-1.32, 0.12, 0);
        this.shinL.rotation.set(1.38, 0, 0);
        this.legR.rotation.set(-1.28, -0.12, 0);
        this.shinR.rotation.set(1.34, 0, 0);

        // Left hand holds sketchboard on knee; right hand sketches rhythmically, occasionally glancing up at the table
        const lookUp = Math.max(0, Math.sin(t * 0.55) - 0.35);
        this.head.rotation.set(0.36 - 0.42 * lookUp, -0.12 * Math.sin(t * 0.8), 0);
        this.armL.rotation.set(-0.62, 0.22, 0.12);
        this.foreArmL.rotation.set(-0.78, 0, 0);
        this.armR.rotation.set(-0.72 + 0.06 * Math.sin(t * 3.8), -0.18, -0.10);
        this.foreArmR.rotation.set(-0.85 + 0.11 * Math.cos(t * 4.6), 0.14 * Math.sin(t * 3.2), 0);
        break;
      }

      case 'color': {
        // Chapter II (Paris): Walking along the misty boulevard ahead of the viewer, observing the city and light,
        // then naturally turning toward the sidewalk edge as the street colors awaken.
        this.lightUniforms.uKeyDir.value.set(-0.35, 0.82, 0.44).normalize();
        this.lightUniforms.uKeyColor.value.set(0.95, 0.98, 1.05);
        this.lightUniforms.uFillColor.value.set(0.26, 0.30, 0.36);

        const walkDist = 4.6 + stageProgress * 5.2;
        const sideDrift = -0.35 - Math.pow(Math.max(0, stageProgress - 0.45), 1.6) * 3.8;
        stageCoords(sideDrift, -1.62, walkDist, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, Math.PI + (stageProgress > 0.45 ? 0.38 * (stageProgress - 0.45) : 0), 0);

        const stride = t * 3.4;
        const sSin = Math.sin(stride);
        const sCos = Math.cos(stride);
        this.pelvis.position.y = 0.90 + 0.028 * Math.abs(sCos);
        this.torso.rotation.set(0.07, -0.06 * sSin, 0.02 * sCos);
        // Observing the street trees, facades, and sky light
        this.head.rotation.set(-0.08 + 0.08 * Math.sin(t * 0.7), 0.38 * Math.sin(t * 0.55), 0);
        this.legL.rotation.x = 0.36 * sSin;
        this.shinL.rotation.x = Math.max(0, -0.52 * sCos);
        this.legR.rotation.x = -0.36 * sSin;
        this.shinR.rotation.x = Math.max(0, 0.52 * sCos);
        // Left arm holds portfolio; right arm swings gently
        this.armL.rotation.set(-0.24, 0.10, 0.14);
        this.foreArmL.rotation.set(-0.65, 0, 0);
        this.armR.rotation.x = 0.26 * sSin;
        this.foreArmR.rotation.x = -0.22 - 0.12 * Math.max(0, sSin);
        break;
      }

      case 'sun': {
        // Chapter III (Arles): Walking into the Yellow House / standing quietly in the doorway of the pale-lilac Bedroom,
        // looking at the simple furniture with quiet anticipation before stepping out of the frame.
        this.lightUniforms.uKeyDir.value.set(-0.55, 0.72, 0.42).normalize();
        this.lightUniforms.uKeyColor.value.set(1.12, 1.02, 0.80); // Warm Provençal afternoon sun
        this.lightUniforms.uFillColor.value.set(0.28, 0.25, 0.32); // Subtle pale-lilac wall bounce

        const enterP = Math.min(1, stageProgress * 2.2);
        const departP = Math.max(0, (stageProgress - 0.58) / 0.42);
        const rightOff = 0.85 - 0.30 * enterP + 2.4 * departP * departP;
        const fwdOff = 3.8 + 1.1 * enterP - 0.8 * departP;
        stageCoords(rightOff, -1.58, fwdOff, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, Math.PI + 0.35 - 0.85 * departP, 0);

        const isWalking = enterP < 0.95 || departP > 0.08;
        const walkAmp = isWalking ? 0.26 : 0.02;
        const wPhase = t * 2.8;
        this.pelvis.position.y = 0.90 + 0.02 * walkAmp * Math.abs(Math.cos(wPhase));
        this.torso.rotation.set(0.04, 0.05 * Math.sin(t * 0.6), 0);
        // Looking around the quiet room with calm expectation
        this.head.rotation.set(-0.04 + 0.05 * Math.sin(t * 0.5), 0.32 * Math.sin(t * 0.45), 0);
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
        // Chapter IV (Saint-Rémy): Standing calmly at his easel in the daytime indoor studio.
        // Zero melodrama: steady, composed brushwork as the camera slowly leaves his side and enters the canvas cosmos.
        this.lightUniforms.uKeyDir.value.set(-0.48, 0.78, 0.40).normalize();
        this.lightUniforms.uKeyColor.value.set(0.96, 0.98, 1.02); // Clear daytime studio window light
        this.lightUniforms.uFillColor.value.set(0.20, 0.24, 0.30);

        stageCoords(-0.88, -1.56, 3.9, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, Math.PI - 0.28, 0);

        stageCoords(-0.46, -1.56, 4.55, _wPos);
        this.easelGroup.position.copy(_wPos);
        this.easelGroup.rotation.set(0, -0.22, 0);

        // Calm, deliberate painting gesture at the easel
        const strokeCycle = t * 2.1;
        const reach = 0.5 + 0.5 * Math.sin(strokeCycle * 0.7);
        this.torso.rotation.set(0.05 + 0.02 * breath, -0.10 + 0.06 * reach, 0);
        this.head.rotation.set(-0.06 + 0.04 * Math.sin(strokeCycle), 0.12, 0);
        // Left hand holds palette steadily
        this.armL.rotation.set(-0.48, 0.24, 0.16);
        this.foreArmL.rotation.set(-0.88, 0.15, 0);
        // Right hand places calm, measured strokes onto the canvas
        this.armR.rotation.set(-0.82 - 0.18 * reach, -0.16 + 0.10 * Math.cos(strokeCycle), -0.12);
        this.foreArmR.rotation.set(-0.62 + 0.14 * Math.sin(strokeCycle * 1.5), 0.12 * Math.cos(strokeCycle), 0);
        break;
      }

      case 'road': {
        // Chapter V (Auvers): Walking ahead along the open field path with his strapped easel & pack,
        // pausing briefly to look out over the wheat and sky before walking onward past the edge of the frame.
        this.lightUniforms.uKeyDir.value.set(0.32, 0.84, 0.43).normalize();
        this.lightUniforms.uKeyColor.value.set(1.04, 0.98, 0.86);
        this.lightUniforms.uFillColor.value.set(0.22, 0.28, 0.34);

        const pauseWindow = smooth01((stageProgress - 0.28) / 0.14) * (1 - smooth01((stageProgress - 0.62) / 0.14));
        const strideAmp = 0.32 * (1 - 0.88 * pauseWindow);
        const fwdDist = 4.5 + stageProgress * 6.8;
        const pathCurve = 0.25 * Math.sin(stageProgress * Math.PI) + Math.max(0, stageProgress - 0.68) * 4.2;
        stageCoords(pathCurve, -1.60, fwdDist, _wPos);
        this.figureRoot.position.copy(_wPos);
        this.figureRoot.rotation.set(0, Math.PI + (stageProgress > 0.65 ? -0.42 * (stageProgress - 0.65) : 0.06), 0);

        const wPhase = t * 3.1;
        const sSin = Math.sin(wPhase);
        const sCos = Math.cos(wPhase);
        this.pelvis.position.y = 0.90 + 0.025 * (strideAmp / 0.32) * Math.abs(sCos);
        this.torso.rotation.set(0.11, -0.04 * sSin, 0); // Slight forward lean from the heavy canvas pack
        this.head.rotation.set(-0.06 - 0.08 * pauseWindow, 0.28 * Math.sin(t * 0.42), 0);
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

// Lightweight wrapper around Three.js Mesh to keep imports clean
import { Mesh } from 'three';
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
