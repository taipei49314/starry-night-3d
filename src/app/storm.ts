// Storm and snap controller (§4.10). The storm scatters every stroke by a curl field; it is gated by the camera's
// distance from E, and the painting re-registers (the snap) when the camera first comes back within 360 m.
import type { Vector3 } from 'three';
import type { DirectorFrame, SharedUniforms, StrokeLayer } from '../contracts';
import { EYE } from '../shared/canvasSpace';

const SNAP_RADIUS = 360;
const SNAP_HOLD = 3;

export class StormController {
  private armed = 0; // free-mode storm level, ramps to 1 over 2 s after G
  private arming = false;
  private suppressed = false; // after a snap, until the storm envelope falls back to 0 or the loop wraps
  private snapClock = -1;
  private lastLoopTime = 0;

  update(f: DirectorFrame, camPos: Vector3, dt: number, u: SharedUniforms, layer: StrokeLayer): void {
    const free = f.mode === 'free' || f.mode === 'returning';
    if (f.stormToggled) {
      this.arming = true;
      this.suppressed = false;
    }
    if (this.arming) this.armed = Math.min(1, this.armed + dt / 2);
    const wrapped = f.loopTime < this.lastLoopTime - 1;
    this.lastLoopTime = f.loopTime;

    const envStorm = free ? this.armed : f.env.storm;
    if (wrapped || (!free && f.env.storm <= 0)) this.suppressed = false;

    const dist = camPos.distanceTo(EYE);
    const gate = Math.min(1, Math.max(0.35, 0.35 + (0.65 * Math.log10(Math.max(dist, 1) / SNAP_RADIUS)) / Math.log10(30000 / SNAP_RADIUS)));
    const storm = this.suppressed ? 0 : envStorm;
    u.uScatter.value = storm * gate;

    if (storm > 0 && dist < SNAP_RADIUS && this.snapClock < 0) {
      u.uSnapTime.value = u.uTime.value;
      u.uScatterAtSnap.value = u.uScatter.value;
      u.uScatter.value = 0;
      this.snapClock = 0;
      this.suppressed = true;
      this.arming = false;
      this.armed = 0;
    }
    if (this.snapClock >= 0) {
      this.snapClock += dt;
      if (this.snapClock > SNAP_HOLD || wrapped) {
        this.snapClock = -1;
        u.uSnapTime.value = -1;
        u.uScatterAtSnap.value = 0;
      }
    }
    if (f.cut && this.snapClock < 0) u.uSnapTime.value = -1;
    layer.setCullInflation(u.uScatter.value > 0 || this.snapClock >= 0 ? 0.05 : 0);
  }

  get active(): boolean {
    return this.snapClock >= 0 || this.armed > 0;
  }
}
