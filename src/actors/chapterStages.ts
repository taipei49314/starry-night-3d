// Five chapter-specific realistic foreground stages and their bespoke Reality <-> Painting visual treatments:
//  - Ch I (Nuenen): Oil lamp micro-glow imperceptibly reveals brushstrokes; reality vanishes almost unnoticed.
//  - Ch II (Paris): Color awakens bit by bit along the street, embodying his evolving artistic language.
//  - Ch III (Arles): Deliberate restraint of effects; the pale-lilac Bedroom (1888.10), the figure, and quiet time lead.
//  - Ch IV (Saint-Rémy): Daytime indoor studio at the easel -> camera leaves his side and unfolds into the 250 km cosmos.
//  - Ch V (Auvers): Refuses complete absorption into the painting; retains partial reality for an unfinished, open ending.
import {
  BoxGeometry, CylinderGeometry, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3,
  type BufferGeometry,
} from 'three';
import { EYE, FORWARD, RIGHT, UP } from '../shared/canvasSpace';
import type { ChapterId, PaintingId } from '../chapters/types';
import { makeRealisticStageMaterial, VanGoghActorRig, type ActorMaterialUniforms } from './vanGoghRig';

export interface ChapterVisualTreatment {
  /** Opacity of the realistic foreground stage props [0, 1] */
  stageOpacity: number;
  /** Opacity multiplier for the 3D oil brushstroke layer [0, 1] */
  paintFade: number;
  /** Impasto relief gain multiplier [0.3, 1.2] */
  impastoScale: number;
  /** Atmospheric saturation / color awakening factor [0, 1] (used in Ch II Paris) */
  colorAwakening: number;
  /** True in Ch III Arles: strictly suppresses storm, smear, portal stir, and depth warp */
  suppressEffects: boolean;
  /** True in Ch V Auvers: keeps partial realistic ground/horizon present alongside brushstrokes */
  keepPartialReality: boolean;
  /** Normalized progress [0, 1] of the realistic Van Gogh actor along his stage path */
  actorProgress: number;
}

function placeAt(rightM: number, upM: number, fwdM: number, out = new Vector3()): Vector3 {
  return out
    .copy(EYE)
    .addScaledVector(RIGHT, rightM)
    .addScaledVector(UP, upM)
    .addScaledVector(FORWARD, fwdM);
}

function smooth01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

export class ChapterStageSystem {
  readonly root = new Group();
  readonly actor = new VanGoghActorRig();

  private readonly stageGroups: Record<ChapterId, Group> = {
    earth: new Group(),
    color: new Group(),
    sun: new Group(),
    cosmos: new Group(),
    road: new Group(),
  };
  private readonly interludeGroup = new Group();
  private readonly stageLight: ActorMaterialUniforms = {
    uKeyDir: { value: new Vector3(-0.4, 0.75, 0.5).normalize() },
    uKeyColor: { value: new Vector3(1.0, 0.92, 0.78) },
    uFillColor: { value: new Vector3(0.18, 0.20, 0.25) },
    uActorOpacity: { value: 1.0 },
  };
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: ShaderMaterial[] = [];

  constructor() {
    this.root.name = 'chapterStageSystem';
    this.root.visible = false;
    this.root.add(
      this.actor.root,
      this.stageGroups.earth,
      this.stageGroups.color,
      this.stageGroups.sun,
      this.stageGroups.cosmos,
      this.stageGroups.road,
      this.interludeGroup,
    );

    this.buildNuenenStage(this.stageGroups.earth);
    this.buildParisStage(this.stageGroups.color);
    this.buildArlesStage(this.stageGroups.sun);
    this.buildSaintRemyStudioStage(this.stageGroups.cosmos);
    this.buildAuversFieldStage(this.stageGroups.road);
    this.buildInterludeStage(this.interludeGroup);
  }

  private mat(hex: number, rough = 0.85, sss = 0.08, doubleSide = false, accentHex?: number, relief = 0.52): ShaderMaterial {
    const m = makeRealisticStageMaterial(hex, this.stageLight, {
      roughness: rough,
      subsurface: sss,
      doubleSide,
      accentHex,
      brushRelief: relief,
    });
    this.materials.push(m);
    return m;
  }

  private geo<T extends BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private addPart(parent: Group, g: BufferGeometry, m: ShaderMaterial, r: number, u: number, f: number, ry = 0): Mesh {
    const mesh = new Mesh(g, m);
    mesh.frustumCulled = false;
    placeAt(r, u, f, mesh.position);
    mesh.rotation.y = ry;
    parent.add(mesh);
    return mesh;
  }

  // 1. Nuenen Cottage Corner (1885): dark timber floor, rafters, hanging oil lamp, rustic table
  private buildNuenenStage(g: Group): void {
    const floorMat = this.mat(0x1c140d, 0.92, 0.06, false, 0x332417, 0.65);
    const beamMat = this.mat(0x281c12, 0.88, 0.08, false, 0x45301e, 0.68);
    const tableMat = this.mat(0x3b2919, 0.80, 0.12, false, 0x63452a, 0.62);
    const brassMat = this.mat(0xd49b3c, 0.38, 0.35, false, 0xf5cc64, 0.35);
    const flameMat = this.mat(0xffe69e, 0.12, 0.92, false, 0xffb84d, 0.20);

    const floorGeo = this.geo(new BoxGeometry(9.6, 0.08, 9.2));
    const beamGeo = this.geo(new BoxGeometry(8.8, 0.18, 0.22));
    const tableTopGeo = this.geo(new CylinderGeometry(0.88, 0.88, 0.06, 20));
    const tableLegGeo = this.geo(new CylinderGeometry(0.045, 0.038, 0.76, 10));
    const platterGeo = this.geo(new CylinderGeometry(0.26, 0.22, 0.04, 16));
    const lampCordGeo = this.geo(new CylinderGeometry(0.012, 0.012, 1.35, 8));
    const lampShadeGeo = this.geo(new CylinderGeometry(0.11, 0.25, 0.13, 18));
    const lampBulbGeo = this.geo(new SphereGeometry(0.072, 14, 12));

    this.addPart(g, floorGeo, floorMat, 0.0, -1.62, 5.2);
    this.addPart(g, beamGeo, beamMat, 0.0, 1.88, 4.4);
    this.addPart(g, beamGeo, beamMat, 0.0, 1.88, 6.4);
    // Contoured table & steaming potato platter silhouette ahead under the hanging oil lamp
    this.addPart(g, tableTopGeo, tableMat, 0.0, -0.82, 6.5);
    this.addPart(g, tableLegGeo, beamMat, -0.52, -1.22, 6.1);
    this.addPart(g, tableLegGeo, beamMat, 0.52, -1.22, 6.1);
    this.addPart(g, platterGeo, brassMat, -0.04, -0.77, 6.35);
    this.addPart(g, lampCordGeo, beamMat, 0.0, 1.15, 6.35);
    this.addPart(g, lampShadeGeo, brassMat, 0.0, 0.48, 6.35);
    this.addPart(g, lampBulbGeo, flameMat, 0.0, 0.39, 6.35);
  }

  // 2. Paris Boulevard (1887): misty grey cobblestone pavement, curbstone, boulevard trees & iron streetlamp
  private buildParisStage(g: Group): void {
    const cobbleMat = this.mat(0x4b4e54, 0.88);
    const sidewalkMat = this.mat(0x64686e, 0.84);
    const ironMat = this.mat(0x222830, 0.55);
    const trunkMat = this.mat(0x3d352e, 0.90);

    const roadGeo = this.geo(new BoxGeometry(9.0, 0.08, 16.0));
    const walkGeo = this.geo(new BoxGeometry(2.8, 0.16, 16.0));
    const postGeo = this.geo(new CylinderGeometry(0.045, 0.07, 3.4, 10));
    const lanternGeo = this.geo(new BoxGeometry(0.24, 0.36, 0.24));
    const trunkGeo = this.geo(new CylinderGeometry(0.11, 0.15, 3.8, 10));

    this.addPart(g, roadGeo, cobbleMat, 0.4, -1.66, 8.5);
    this.addPart(g, walkGeo, sidewalkMat, -2.2, -1.60, 8.5);
    this.addPart(g, postGeo, ironMat, -1.35, 0.05, 6.2);
    this.addPart(g, lanternGeo, ironMat, -1.35, 1.85, 6.2);
    this.addPart(g, trunkGeo, trunkMat, -1.65, 0.25, 9.4);
    this.addPart(g, trunkGeo, trunkMat, 2.15, 0.25, 8.2);
  }

  // 3. Arles Yellow House & Pale-Lilac Bedroom (1888.09–1888.10):
  // Historically fact-checked: terracotta red tile floor, pale-lilac walls (les murs lilas pâle), green shutter door, butter-yellow chair
  private buildArlesStage(g: Group): void {
    const tileFloorMat = this.mat(0x8c3d28, 0.82); // Red terracotta tiles (le carreau rouge)
    const paleLilacWallMat = this.mat(0xb8a8cc, 0.86); // Fact-checked original pale lilac walls (1888.10 Letter 705)
    const yellowHouseExtMat = this.mat(0xdcb448, 0.84);
    const greenDoorMat = this.mat(0x2d5e40, 0.76);
    const butterWoodMat = this.mat(0xdcb03c, 0.74); // Fresh butter yellow wood

    const floorGeo = this.geo(new BoxGeometry(7.2, 0.08, 9.5));
    const wallSideGeo = this.geo(new BoxGeometry(0.18, 3.6, 8.2));
    const doorFrameGeo = this.geo(new BoxGeometry(0.22, 2.5, 0.95));
    const chairSeatGeo = this.geo(new BoxGeometry(0.46, 0.04, 0.44));
    const chairBackGeo = this.geo(new BoxGeometry(0.46, 0.52, 0.04));
    const chairLegGeo = this.geo(new CylinderGeometry(0.022, 0.018, 0.44, 8));

    this.addPart(g, floorGeo, tileFloorMat, 0.0, -1.62, 5.5);
    this.addPart(g, wallSideGeo, paleLilacWallMat, -2.35, 0.15, 5.8);
    this.addPart(g, wallSideGeo, yellowHouseExtMat, 2.45, 0.15, 3.6);
    this.addPart(g, doorFrameGeo, greenDoorMat, 1.55, -0.35, 4.1, 0.42);
    // Simple yellow wooden chair in the quiet room
    this.addPart(g, chairSeatGeo, butterWoodMat, -1.35, -1.16, 5.6, 0.25);
    this.addPart(g, chairBackGeo, butterWoodMat, -1.35, -0.88, 5.8, 0.25);
    this.addPart(g, chairLegGeo, butterWoodMat, -1.52, -1.38, 5.45);
    this.addPart(g, chairLegGeo, butterWoodMat, -1.18, -1.38, 5.75);
  }

  // 4. Saint-Rémy Daytime Indoor Studio (1889.06):
  // Fact-checked (MoMA): The Starry Night was painted indoors during the day across multiple sessions from observation, memory & imagination.
  private buildSaintRemyStudioStage(g: Group): void {
    const stoneFloorMat = this.mat(0x6e6a62, 0.88);
    const limestoneWallMat = this.mat(0x9e988c, 0.86);
    const windowFrameMat = this.mat(0x4a463f, 0.80);

    const floorGeo = this.geo(new BoxGeometry(7.0, 0.08, 8.0));
    const leftWallGeo = this.geo(new BoxGeometry(0.22, 3.8, 7.5));
    const sillGeo = this.geo(new BoxGeometry(0.32, 0.12, 1.8));

    this.addPart(g, floorGeo, stoneFloorMat, -0.2, -1.60, 4.6);
    this.addPart(g, leftWallGeo, limestoneWallMat, -2.4, 0.25, 4.5);
    this.addPart(g, sillGeo, windowFrameMat, -2.28, 0.10, 4.2);
  }

  // 5. Auvers Field Path (1890.07): earthen path & rustic fence posts that remain partially visible ("保留部分真實世界，留下尚未結束的感覺")
  private buildAuversFieldStage(g: Group): void {
    const earthPathMat = this.mat(0x5c4934, 0.92);
    const grassVergeMat = this.mat(0x465836, 0.90);
    const fencePostMat = this.mat(0x4a3b2c, 0.88);

    const pathGeo = this.geo(new BoxGeometry(2.6, 0.06, 22.0));
    const vergeGeo = this.geo(new BoxGeometry(5.5, 0.05, 22.0));
    const postGeo = this.geo(new CylinderGeometry(0.055, 0.065, 1.05, 8));

    this.addPart(g, pathGeo, earthPathMat, 0.15, -1.63, 10.5, 0.04);
    this.addPart(g, vergeGeo, grassVergeMat, -3.6, -1.64, 10.5, 0.04);
    this.addPart(g, vergeGeo, grassVergeMat, 3.8, -1.64, 10.5, 0.04);
    this.addPart(g, postGeo, fencePostMat, -1.45, -1.12, 6.2, 0.05);
    this.addPart(g, postGeo, fencePostMat, -1.32, -1.12, 9.8, -0.04);
    this.addPart(g, postGeo, fencePostMat, 1.72, -1.12, 8.0, 0.03);
  }

  // 6. Non-painting Interlude Stage: warm raw-linen/epistolary space with a quiet wooden desk edge or train window frame
  private buildInterludeStage(g: Group): void {
    const deskMat = this.mat(0x423020, 0.82);
    const paperMat = this.mat(0xe6dbc4, 0.88, 0.15, true);
    const deskGeo = this.geo(new BoxGeometry(2.4, 0.06, 1.2));
    const letterSheetGeo = this.geo(new BoxGeometry(0.28, 0.008, 0.36));

    this.addPart(g, deskGeo, deskMat, 0.0, -1.18, 3.6);
    this.addPart(g, letterSheetGeo, paperMat, -0.08, -1.14, 3.45, 0.18);
    this.addPart(g, letterSheetGeo, paperMat, 0.16, -1.142, 3.52, -0.12);
  }

  /**
   * Evaluate the bespoke visual treatment for the active chapter and update the 3D actor & foreground stage.
   */
  update(
    realDt: number,
    chapterId: ChapterId,
    paintingId: PaintingId,
    beatTau: number,
    beatDuration: number,
    isActorEntryBeat: boolean,
    isInterlude: boolean,
    isEpilogue: boolean,
    alignAtE: number,
    enabled: boolean,
  ): ChapterVisualTreatment {
    if (!enabled) {
      this.root.visible = false;
      return {
        stageOpacity: 0,
        paintFade: 1,
        impastoScale: 1,
        colorAwakening: 1,
        suppressEffects: false,
        keepPartialReality: false,
        actorProgress: 1,
      };
    }

    this.root.visible = true;
    const frac = Math.max(0, Math.min(1, beatTau / Math.max(1, beatDuration)));

    // Interlude or Epilogue: non-painting breathing space ("完全不進入畫作，只陪著觀眾走過兩個人生階段之間的空白")
    if (isInterlude || isEpilogue) {
      for (const ch of Object.keys(this.stageGroups) as ChapterId[]) {
        this.stageGroups[ch].visible = false;
      }
      this.actor.root.visible = false;
      const interludeEnvFade = smooth01(beatTau / 2.2) * (1 - smooth01((beatTau - (beatDuration - 2.2)) / 2.2));
      this.interludeGroup.visible = interludeEnvFade > 0.01;
      this.stageLight.uActorOpacity.value = 0.85 * interludeEnvFade;
      this.stageLight.uKeyColor.value.set(0.95, 0.86, 0.72);
      this.stageLight.uFillColor.value.set(0.16, 0.14, 0.12);
      return {
        stageOpacity: 0.85 * interludeEnvFade,
        paintFade: 0.0, // Zero oil painting strokes during pure interlude!
        impastoScale: 0.3,
        colorAwakening: 0.3,
        suppressEffects: true,
        keepPartialReality: true,
        actorProgress: 1,
      };
    }

    this.interludeGroup.visible = false;

    // Eye purity guard: whenever the camera approaches exact alignment at E, realistic stage elements step aside
    // (except in Auvers where partial reality stays until very high alignment > 0.94)
    const eyePurityCutoff = chapterId === 'road' ? 0.94 : 0.76;
    const eyeStageMask = 1 - smooth01((alignAtE - eyePurityCutoff) / Math.max(0.05, 0.98 - eyePurityCutoff));

    let stageOpacity = 0;
    let paintFade = 1;
    let impastoScale = 1;
    let colorAwakening = 1;
    let suppressEffects = false;
    let keepPartialReality = false;
    const actorWindowSec = chapterId === 'cosmos' ? 18 : chapterId === 'road' ? 26 : 16;
    const actorProgress = isActorEntryBeat ? Math.max(0, Math.min(1, beatTau / actorWindowSec)) : 1;

    switch (chapterId) {
      case 'earth': {
        // Chapter I (Nuenen): "油燈微光逐漸揭露筆觸，幾乎察覺不到現實何時消失"
        // Warm oil-lamp brushstrokes of The Potato Eaters already glow softly in the background from the start,
        // gradually taking over the room as the realistic cottage stage dissolves imperceptibly.
        if (isActorEntryBeat) {
          const lampBreath = 0.035 * Math.sin(beatTau * 1.6);
          const reveal = smooth01((beatTau - 0.5) / 13.5);
          paintFade = Math.max(0.42, Math.min(1, 0.42 + 0.58 * reveal + lampBreath * (1 - reveal)));
          stageOpacity = (1 - smooth01((beatTau - 5.0) / 14.0)) * eyeStageMask;
          impastoScale = 0.55 + 0.45 * smooth01((beatTau - 2.0) / 13.0);
        }
        suppressEffects = true;
        break;
      }

      case 'color': {
        // Chapter II (Paris): "色彩在街景中一點一點甦醒，呈現藝術語言的轉變"
        if (isActorEntryBeat) {
          const wake = smooth01((beatTau - 1.0) / 14.5);
          // Stepwise color awakening: brushstrokes emerge early, while chroma awakens progressively along the walk
          paintFade = Math.max(0.18, smooth01((beatTau - 0.8) / 10.5));
          colorAwakening = 0.15 + 0.85 * wake;
          stageOpacity = (1 - smooth01((beatTau - 6.0) / 12.0)) * eyeStageMask;
          impastoScale = 0.55 + 0.45 * wake;
        }
        break;
      }

      case 'sun': {
        // Chapter III (Arles): "刻意克制特效，讓人物、房間與安靜的時間成為主角"
        suppressEffects = true;
        if (isActorEntryBeat || paintingId === 'bedroom') {
          const roomFade = smooth01((beatTau - 1.2) / 11.0);
          paintFade = Math.max(0.22, roomFade);
          // In the pale-lilac Bedroom (1888.10), keep subtle room presence while he stands by the doorway, then let the quiet room hold
          stageOpacity = (1 - smooth01((beatTau - 5.5) / 10.5)) * eyeStageMask;
          impastoScale = 0.78 + 0.22 * roomFade;
        }
        break;
      }

      case 'cosmos': {
        // Chapter IV (Saint-Rémy): "從人物身旁緩緩離開，讓畫面空間逐漸展開成巨大宇宙"
        // Daytime indoor studio at the easel -> camera leaves his side and enters the 250 km brushstroke cosmos.
        if (isActorEntryBeat) {
          const departEasel = smooth01((beatTau - 3.2) / 11.5);
          stageOpacity = (1 - smooth01((beatTau - 6.5) / 9.5)) * eyeStageMask;
          paintFade = Math.max(0.25, smooth01((beatTau - 1.0) / 8.5));
          impastoScale = 0.65 + 0.35 * departEasel;
        }
        break;
      }

      case 'road': {
        // Chapter V (Auvers): "不要求完全入畫，保留部分真實世界，留下尚未結束的感覺"
        keepPartialReality = true;
        if (isActorEntryBeat) {
          // Retain ~30% of the realistic field path and horizon throughout the Auvers walk!
          const baseStage = 1 - 0.68 * smooth01((beatTau - 6.0) / 14.0);
          stageOpacity = Math.max(0.30, baseStage) * eyeStageMask;
          // Painting blends to 0.88 so reality and brushstrokes coexist without sealing into a closed picture
          paintFade = alignAtE > 0.92 ? 1.0 : Math.min(0.88, 0.20 + 0.68 * smooth01((beatTau - 1.5) / 11.0));
          impastoScale = 0.72 + 0.20 * frac;
        } else {
          stageOpacity = 0.26 * eyeStageMask;
          paintFade = alignAtE > 0.92 ? 1.0 : 0.90;
        }
        break;
      }
    }

    for (const ch of Object.keys(this.stageGroups) as ChapterId[]) {
      this.stageGroups[ch].visible = ch === chapterId && stageOpacity > 0.005;
    }

    if (isActorEntryBeat && actorProgress < 0.995) {
      this.actor.update(realDt, chapterId, actorProgress, alignAtE);
      this.stageLight.uKeyDir.value.copy(this.actor.lightUniforms.uKeyDir.value);
      this.stageLight.uKeyColor.value.copy(this.actor.lightUniforms.uKeyColor.value);
      this.stageLight.uFillColor.value.copy(this.actor.lightUniforms.uFillColor.value);
    } else {
      this.actor.root.visible = false;
    }
    this.stageLight.uActorOpacity.value = stageOpacity;

    return {
      stageOpacity,
      paintFade,
      impastoScale,
      colorAwakening,
      suppressEffects,
      keepPartialReality,
      actorProgress,
    };
  }

  setHidden(): void {
    this.root.visible = false;
    this.actor.root.visible = false;
  }

  dispose(): void {
    this.actor.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
