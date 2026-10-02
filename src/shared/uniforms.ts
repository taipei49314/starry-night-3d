import { Vector3, Vector4 } from 'three';
import { CLASS_COUNT, MOON_DEF, T_HALF, type SharedUniforms } from '../contracts';
import { canvasToWorld, EYE, EYE_BASIS, galleryLightDir } from './canvasSpace';

/** The shared uniform objects (§4.2). Create once; materials spread them into their own `uniforms` by reference. */
export function createSharedUniforms(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uEye: { value: EYE.clone() },
    uEyeBasis: { value: EYE_BASIS.clone() },
    uWarpK: { value: 1 },
    uOff: { value: 0 },
    uAlign: { value: 1 },
    uScatter: { value: 0 },
    uSnapTime: { value: -1 },
    uScatterAtSnap: { value: 0 },
    uLayIn: { value: -1 },
    uInflate: { value: 10 },
    uImpastoGain: { value: 1 },
    uGalleryLight: { value: galleryLightDir(-15) },
    uMoonPos: { value: canvasToWorld(MOON_DEF.u, MOON_DEF.v, MOON_DEF.d) },
    uCamVel: { value: new Vector3() },
    uPxPerRad: { value: 1080 / (2 * T_HALF) },
    uViewportH: { value: 1080 },
    uWidthComp: { value: new Float32Array(CLASS_COUNT).fill(1) },
    uStir: { value: new Vector4(0, 0, 0, 0.08) },
    uSpecular: { value: 1 },
    uVelStretch: { value: 1 },
    uDustAlpha: { value: 1 },
  };
}
