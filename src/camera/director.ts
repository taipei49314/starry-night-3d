// M8 camera director (§4.8, §5): cinematic timeline, free explore, idle rejoin, Return to the Eye, envelopes and UI.
//
// Integration (M10):
//   const director = new Director(camera, canvas, { calm, startTime, free, firstBoot });
//   each frame: const f = director.update(dt)   // writes camera position / quaternion / fov (+ projection, matrixWorld)
//   director.setHudText('60 fps · high · scale 1.00')   // shown under the H HUD; call any time
// The returned frame is a fresh object each call (safe to keep). Extra fields beyond DirectorFrame: animTime, align.
import { Matrix4, type PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { CANVAS_ASPECT, LOOP_SECONDS, type DirectorFrame, type DirectorMode, type ShotEnvelope } from '../contracts';
import { canvasPoseFovDeg, EYE, FORWARD, worldToCanvas } from '../shared/canvasSpace';
import { FreeFly, PilotInput, type DirectorCommand } from './freeFly';
import { ease, logPolarAboutEye } from './paths';
import {
  applyComfort, COMFORT, lerpEnv, newEnv, newPose, SHOT_STARTS, shotAt, Timeline, timelineEnv, type CamPose, type EnvSample,
} from './shots';
import { DirectorUI, projectEyeRing } from './ui';

export interface DirectorOptions {
  calm: boolean;
  /** loop time to start at (?t=) */
  startTime?: number;
  /** start in free mode (?free); idle hand-back stays off until the cinematic is resumed once */
  free?: boolean;
  /** first boot: lay-in / inflation flags on the first pass of shot 1 */
  firstBoot: boolean;
  /** create the DOM overlay (default true) */
  ui?: boolean;
  /** listen to pointer / keyboard / wheel / touch on `input` (default true) */
  listen?: boolean;
}

export interface DirectorFrameEx extends DirectorFrame {
  /** Continuous animation clock in [0, 96): equals loopTime except after an idle rejoin, where loopTime jumps to the
   *  rejoin sample and animTime keeps running. Use it for uTime if stroke animation must never jump outside cuts. */
  animTime: number;
  /** The director's own §6 alignment estimate (same formula as M10's uAlign). */
  align: number;
}

const DEG = Math.PI / 180;
const FADE_UP = 0.15;
const FADE_DOWN = 0.15;
const IDLE_SECONDS = 12;
/** free-mode lens: time constant of the relax from the hand-off FOV to the canvas-pose FOV */
const FREE_FOV_RELAX_S = 1.5;
export const REJOIN_SAMPLES = 960;
export const REJOIN_DT = 0.1;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const wrap = (t: number) => ((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;

const tv1 = new Vector3(), tv2 = new Vector3(), tv3 = new Vector3();
const tq1 = new Quaternion();
const mLook = new Matrix4();
const qRoll = new Quaternion();
const ZERO = new Vector3();
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
/** Camera quaternion looking along unit `d` with aviation roll (deg, + = bank right). */
export function poseQuaternion(d: Vector3, rollDeg: number, out: Quaternion): Quaternion {
  mLook.lookAt(ZERO, d, AXIS_Y);
  out.setFromRotationMatrix(mLook);
  if (rollDeg !== 0) out.multiply(qRoll.setFromAxisAngle(AXIS_Z, -rollDeg * DEG));
  return out;
}

/** §6 uAlign formula, evaluated from a pose. */
export function alignOf(pos: Vector3, quat: Quaternion, fovDeg: number, aspect: number): number {
  const dist = pos.distanceTo(EYE);
  const f = tv1.set(0, 0, -1).applyQuaternion(quat);
  return (1 - smooth(0.05, 3, dist)) * smooth(0.999, 0.99995, f.dot(FORWARD)) * (1 - smooth(0.2, 2.0, Math.abs(fovDeg - canvasPoseFovDeg(aspect))));
}

interface Flight {
  t: number; dur: number; fromPos: Vector3; fromQuat: Quaternion; fromFov: number; fromEnv: EnvSample; fromWarp: number;
  targetT: number; isStatic: boolean; phase: 1 | 2;
}

export class Director {
  readonly timeline: Timeline;
  readonly ui: DirectorUI | null;
  readonly input: PilotInput | null;
  readonly pilot = new FreeFly();
  /** Rejoin table (§4.8): pose every 0.1 s, positions and view directions interleaved xyz. */
  readonly table = { p: new Float64Array(REJOIN_SAMPLES * 3), d: new Float64Array(REJOIN_SAMPLES * 3) };
  /** ms spent building the timeline + rejoin table at construction */
  readonly tableBuildMs: number;

  private _mode: DirectorMode = 'cinematic';
  private _calm: boolean;
  private hud = false;
  private loopTime: number;
  private animTime: number;
  private loopCount = 0;
  private bootSeconds = 0;
  private firstBoot: boolean;
  private freeLock: boolean;
  private interacted = false;
  private lastActivity = 0;
  private cutPending = true;
  private stormToggled = false;
  private fadePhase: 0 | 1 | 2 = 0;
  private fadeT = 0;
  private fadeShot = 0;
  private flight: Flight | null = null;
  private readonly pose: CamPose = newPose();
  private readonly target: CamPose = newPose();
  private readonly pos = new Vector3();
  private readonly quat = new Quaternion();
  private fov = 36;
  private rollOut = 0;
  private readonly prevPos = new Vector3();
  private readonly vel = new Vector3();
  private env: EnvSample = newEnv();
  private readonly envTmp: EnvSample = newEnv();
  private stirStrength = 0;
  private stirU = 0;
  private stirV = 0;
  private stirEver = false;

  constructor(private readonly camera: PerspectiveCamera, private readonly inputEl: HTMLElement, opts: DirectorOptions) {
    const t0 = performance.now();
    this.timeline = new Timeline();
    this.buildTable();
    this.tableBuildMs = performance.now() - t0;

    let reduced = false;
    try { reduced = !!inputEl.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { /* no matchMedia */ }
    this._calm = opts.calm || reduced;
    this.loopTime = this.animTime = wrap(opts.startTime ?? 0);
    this.firstBoot = opts.firstBoot;
    this.freeLock = !!opts.free;
    this.ui = opts.ui === false ? null : new DirectorUI(inputEl);
    this.input = opts.listen === false ? null : new PilotInput(inputEl, {
      onHandOff: () => this.handOff(),
      onCommand: (c) => this.command(c),
      onActivity: () => { this.lastActivity = this.bootSeconds; },
    });

    // initial pose (valid before the first update)
    this.cinematicPose(this.loopTime, 0, true);
    this.writeCamera();
    this.prevPos.copy(this.pos);
    if (opts.free) {
      this._mode = 'free';
      this.pilot.takeOver(this.pos, this.quat, this.fov, ZERO);
      this.input?.resetWarp();
    }
  }

  get mode(): DirectorMode { return this._mode; }
  get calm(): boolean { return this._calm; }
  get hudVisible(): boolean { return this.hud; }

  setCalm(on: boolean): void { this._calm = on; }
  setHudText(text: string): void {
    this.ui?.setHudText(text);
  }
  setHud(on: boolean): void { this.hud = on; }

  /** Jump to the start of shot `index` (0..9) through a 0.3 s Prussian fade; the frame at the fade peak has cut = true. */
  jumpToShot(index: number): void {
    const i = Math.max(0, Math.min(SHOT_STARTS.length - 1, Math.floor(index)));
    const cur = this.fadeValue();
    this.fadePhase = 1;
    this.fadeT = cur * FADE_UP;
    this.fadeShot = i;
  }

  /** Return to the Eye: log-polar flight to H0 (3-6 s), the shot-10 homecoming, then free mode at E. */
  returnToEye(): void {
    const dist = this.pos.distanceTo(EYE);
    const fwd = tv1.set(0, 0, -1).applyQuaternion(this.quat);
    const ang = Math.acos(Math.max(-1, Math.min(1, fwd.dot(FORWARD))));
    const dur = Math.max(3, Math.min(6, 3 + 1.2 * Math.abs(Math.log10(Math.max(dist, 1) / 360)) + (1.5 * ang) / Math.PI));
    this.cancelPendingJump();
    this.flight = this.newFlight(dur, 88, true);
    this._mode = 'returning';
    this.interacted = true;
  }

  /** Resume the cinematic now: fly to the best timeline sample (as the idle hand-back does). */
  resumeCinematic(): void {
    this.freeLock = false;
    if (this._mode === 'free' || this._mode === 'returning') this.startRejoin();
  }

  dispose(): void {
    this.input?.dispose();
    this.ui?.dispose();
  }

  // ------------------------------------------------------------ frame
  update(dtSeconds: number): DirectorFrameEx {
    const dt = Math.max(0, Math.min(0.1, Number.isFinite(dtSeconds) ? dtSeconds : 0));
    this.bootSeconds += dt;
    let cut = this.cutPending;
    this.cutPending = false;
    const stormToggled = this.stormToggled;
    this.stormToggled = false;

    // fade-through-Prussian jump cuts
    if (this.fadePhase === 1) {
      this.fadeT += dt;
      if (this.fadeT >= FADE_UP) {
        this.setCinematic(SHOT_STARTS[this.fadeShot]);
        cut = true;
        this.fadePhase = 2;
        this.fadeT = 0;
      }
    } else if (this.fadePhase === 2) {
      this.fadeT += dt;
      if (this.fadeT >= FADE_DOWN) this.fadePhase = 0;
    }

    if (!cut) this.animTime = wrap(this.animTime + dt);
    // first boot covers the first pass of shot 1 (lay-in + inflation); jump cuts clear it in setCinematic
    if (this.firstBoot && this.bootSeconds >= 6) this.firstBoot = false;

    const aspect = this.camera.aspect || 16 / 9;
    let analyticVel = false;
    switch (this._mode) {
      case 'cinematic': {
        if (!cut) this.advanceLoop(dt);
        this.cinematicPose(this.loopTime, dt, cut);
        this.timeline.velocity(this.loopTime, this.vel);
        analyticVel = true;
        timelineEnv(this.loopTime, this.pos.distanceTo(EYE), this._calm, this.env);
        if (!this.firstBoot && this.loopTime < 2) this.env.impastoGain = 1 + 0.15 * Math.sin((Math.PI * this.loopTime) / 2);
        break;
      }
      case 'free': {
        this.advanceLoop(dt);
        this.pilot.update(dt, this.input, this.inputEl.clientHeight || 720);
        // The hand-off keeps the shot's FOV (no blend), then the lens relaxes to the canvas-pose FOV. Without this a
        // pilot who took over at 26 or 78 deg could never reach uAlign > 0.95 at E (the matte, ring and warp demo
        // all need the canvas FOV within 2 deg).
        this.pilot.fov += (canvasPoseFovDeg(aspect) - this.pilot.fov) * (1 - Math.exp(-dt / FREE_FOV_RELAX_S));
        this.pos.copy(this.pilot.pos);
        this.quat.copy(this.pilot.quat);
        this.fov = this.pilot.fov;
        this.vel.copy(this.pilot.vel);
        analyticVel = true;
        this.freeEnv(dt);
        if (!this.freeLock && this.input && this.input.idle && this.bootSeconds - this.lastActivity >= IDLE_SECONDS) this.startRejoin();
        break;
      }
      case 'rejoin': {
        const F = this.flight!;
        F.t = Math.min(F.dur, F.t + dt);
        const s = ease.inOutSine(F.t / F.dur);
        const tt = F.isStatic ? F.targetT : wrap(F.targetT + F.t);
        this.loopTime = tt;
        this.timeline.pose(tt, this.target);
        applyComfort(this.target, aspect, this._calm);
        logPolarAboutEye(F.fromPos, this.target.p, s, this.pos);
        this.quat.slerpQuaternions(F.fromQuat, poseQuaternion(this.target.d, this.target.roll, tq1), s);
        this.fov = F.fromFov + (this.target.fov - F.fromFov) * s;
        timelineEnv(tt, this.pos.distanceTo(EYE), this._calm, this.envTmp);
        lerpEnv(F.fromEnv, this.envTmp, s, this.env);
        if (this.input) this.input.warpK = F.fromWarp + (1 - F.fromWarp) * s;
        if (F.t >= F.dur) {
          this._mode = 'cinematic';
          this.rollOut = this.target.roll;
          this.flight = null;
          if (this.input) this.input.resetWarp();
        }
        break;
      }
      case 'returning': {
        const F = this.flight!;
        this.advanceLoop(dt);
        if (F.phase === 1) {
          F.t = Math.min(F.dur, F.t + dt);
          const s = ease.inOutSine(F.t / F.dur);
          this.timeline.pose(88, this.target);
          applyComfort(this.target, aspect, this._calm);
          logPolarAboutEye(F.fromPos, this.target.p, s, this.pos);
          this.quat.slerpQuaternions(F.fromQuat, poseQuaternion(this.target.d, this.target.roll, tq1), s);
          this.fov = F.fromFov + (this.target.fov - F.fromFov) * s;
          timelineEnv(88, this.pos.distanceTo(EYE), this._calm, this.envTmp);
          lerpEnv(F.fromEnv, this.envTmp, s, this.env);
          if (this.input) this.input.warpK = F.fromWarp + (1 - F.fromWarp) * s;
          if (F.t >= F.dur) { F.phase = 2; F.t = 0; this.input?.resetWarp(); }
        } else {
          F.t += dt;
          const tt = Math.min(LOOP_SECONDS, 88 + F.t);
          this.timeline.pose(tt, this.target);
          applyComfort(this.target, aspect, this._calm);
          this.pos.copy(this.target.p);
          poseQuaternion(this.target.d, this.target.roll, this.quat);
          this.fov = this.target.fov;
          timelineEnv(tt, this.pos.distanceTo(EYE), this._calm, this.env);
          if (88 + F.t >= LOOP_SECONDS) {
            // home: free mode again at E in the canvas pose
            this.flight = null;
            this._mode = 'free';
            this.pilot.takeOver(EYE, this.quat, canvasPoseFovDeg(aspect), ZERO);
            this.lastActivity = this.bootSeconds;
          }
        }
        break;
      }
    }

    this.writeCamera();

    // velocity: analytic in cinematic / free, finite difference (lightly smoothed) in flights; zero on cuts
    if (cut) this.vel.set(0, 0, 0);
    else if (!analyticVel && dt > 0) {
      tv2.subVectors(this.pos, this.prevPos).divideScalar(dt);
      this.vel.lerp(tv2, 0.5);
    }
    this.prevPos.copy(this.pos);

    const align = alignOf(this.pos, this.quat, this.fov, aspect);
    if (this._mode === 'free') this.env.matte = align;

    // stir the sky
    const sa = this.input?.stirAt ?? null;
    if (sa && this._mode === 'free') this.updateStir(sa.x, sa.y);
    else this.stirStrength *= Math.exp(-dt / 1.5);
    const stir: [number, number, number, number] | null =
      this.stirEver && this.stirStrength > 1e-3 ? [this.stirU, this.stirV, this.stirStrength, 0.08] : null;

    const fade = this.fadeValue();
    const env: ShotEnvelope = { ...this.env, fade };
    const shot = shotAt(this.loopTime);
    const frame: DirectorFrameEx = {
      mode: this._mode,
      loopTime: this.loopTime,
      shot,
      shotT: this.loopTime - SHOT_STARTS[shot],
      firstBoot: this.firstBoot,
      bootSeconds: this.bootSeconds,
      cut,
      camVelocity: [this.vel.x, this.vel.y, this.vel.z],
      env,
      stir,
      warpK: this.input ? this.input.warpK : 1,
      stormToggled,
      calm: this._calm,
      hud: this.hud,
      animTime: this.animTime,
      align,
    };
    this.renderUi(frame);
    return frame;
  }

  // ------------------------------------------------------------ internals
  private advanceLoop(dt: number): void {
    const t = this.loopTime + dt;
    if (t >= LOOP_SECONDS) {
      this.loopCount++;
      this.loopTime = t - LOOP_SECONDS;
    } else this.loopTime = t;
  }

  /** Timeline pose at t with comfort caps and the 25 deg/s roll slew (skipped on cuts / dt = 0). */
  private cinematicPose(t: number, dt: number, cut: boolean): void {
    const P = this.timeline.pose(t, this.pose);
    applyComfort(P, this.camera.aspect || 16 / 9, this._calm);
    let roll = P.roll;
    if (!cut && dt > 0) {
      const m = COMFORT.rollRateMaxDegS * dt;
      roll = Math.max(this.rollOut - m, Math.min(this.rollOut + m, roll));
    }
    this.rollOut = roll;
    this.pos.copy(P.p);
    poseQuaternion(P.d, roll, this.quat);
    this.fov = P.fov;
  }

  private writeCamera(): void {
    const c = this.camera;
    c.position.copy(this.pos);
    c.quaternion.copy(this.quat);
    if (c.fov !== this.fov) c.fov = this.fov;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }

  private setCinematic(t: number): void {
    this._mode = 'cinematic';
    this.flight = null;
    this.loopTime = this.animTime = wrap(t);
    this.firstBoot = false;
    this.freeLock = false;
    this.input?.resetWarp();
  }

  private fadeValue(): number {
    if (this.fadePhase === 1) return ease.smoothstep(this.fadeT / FADE_UP);
    if (this.fadePhase === 2) return 1 - ease.smoothstep(this.fadeT / FADE_DOWN);
    return 0;
  }

  /** A later command wins over a jump still fading up: fade back down from the current level, no cut. */
  private cancelPendingJump(): void {
    if (this.fadePhase === 1) { const v = this.fadeValue(); this.fadePhase = 2; this.fadeT = (1 - v) * FADE_DOWN; }
  }

  private handOff(): void {
    this.interacted = true;
    this.lastActivity = this.bootSeconds;
    this.cancelPendingJump();
    if (this._mode === 'free') return;
    this.pilot.takeOver(this.pos, this.quat, this.fov, this.vel);
    this.flight = null;
    this._mode = 'free';
  }

  private command(c: DirectorCommand): void {
    this.interacted = true;
    switch (c.kind) {
      case 'return': this.returnToEye(); break;
      case 'resume': this.resumeCinematic(); break;
      case 'restart': this.jumpToShot(0); break;
      case 'shot': this.jumpToShot(c.index); break;
      case 'storm': this.stormToggled = true; break;
      case 'calm': this.setCalm(!this._calm); break;
      case 'hud': this.hud = !this.hud; break;
    }
  }

  private newFlight(dur: number, targetT: number, isStatic: boolean): Flight {
    return {
      t: 0, dur, fromPos: this.pos.clone(), fromQuat: this.quat.clone(), fromFov: this.fov,
      fromEnv: { ...this.env }, fromWarp: this.input ? this.input.warpK : 1, targetT, isStatic, phase: 1,
    };
  }

  /** Idle / C hand-back (§5.3): best of the 960 samples by the log-distance + angle cost, flown to in 3-5 s. */
  startRejoin(): void {
    const dist = this.pos.distanceTo(EYE);
    let best = 0;
    let bestCost = 0;
    if (dist >= 50) {
      const r = this.rejoinChoice(this.pos, tv3.set(0, 0, -1).applyQuaternion(this.quat));
      best = r.index;
      bestCost = r.cost;
    }
    const dur = 3 + 2 * Math.min(1, bestCost / 1.5);
    this.cancelPendingJump();
    this.flight = this.newFlight(dur, best * REJOIN_DT, dist < 50);
    this._mode = 'rejoin';
    this.freeLock = false;
  }

  /** The §5.3 rejoin cost minimum over the table. Exposed for tests. */
  rejoinChoice(camPos: Vector3, viewDir: Vector3): { index: number; cost: number } {
    const P = this.table.p, D = this.table.d;
    const cx = camPos.x - EYE.x, cy = camPos.y - EYE.y, cz = camPos.z - EYE.z;
    const dc = Math.hypot(cx, cy, cz);
    const lc = Math.log10(Math.max(dc, 10));
    let best = 0, bestCost = Infinity;
    for (let i = 0; i < REJOIN_SAMPLES; i++) {
      const sx = P[i * 3] - EYE.x, sy = P[i * 3 + 1] - EYE.y, sz = P[i * 3 + 2] - EYE.z;
      const ds = Math.hypot(sx, sy, sz);
      let cost = 2 * Math.abs(lc - Math.log10(Math.max(ds, 10)));
      if (dc > 1e-6 && ds > 1e-6) cost += Math.acos(Math.max(-1, Math.min(1, (cx * sx + cy * sy + cz * sz) / (dc * ds)))) / Math.PI;
      const vd = viewDir.x * D[i * 3] + viewDir.y * D[i * 3 + 1] + viewDir.z * D[i * 3 + 2];
      cost += (0.5 * Math.acos(Math.max(-1, Math.min(1, vd)))) / Math.PI;
      if (cost < bestCost) { bestCost = cost; best = i; }
    }
    return { index: best, cost: bestCost };
  }

  private buildTable(): void {
    const P = newPose();
    for (let i = 0; i < REJOIN_SAMPLES; i++) {
      this.timeline.pose(i * REJOIN_DT, P);
      this.table.p[i * 3] = P.p.x; this.table.p[i * 3 + 1] = P.p.y; this.table.p[i * 3 + 2] = P.p.z;
      this.table.d[i * 3] = P.d.x; this.table.d[i * 3 + 1] = P.d.y; this.table.d[i * 3 + 2] = P.d.z;
    }
  }

  /** Free-mode envelopes: relax toward calm exploring values; matte follows align; storm is the integrator's (G). */
  private freeEnv(dt: number): void {
    const k = 1 - Math.exp(-dt / 0.8);
    const e = this.env;
    const dist = this.pos.distanceTo(EYE);
    const speed = this.pilot.vel.length();
    const smearT = this._calm ? 0 : Math.min(0.45, (0.25 * speed) / Math.max(30, 0.35 * Math.max(dist, 30)));
    e.bloom += (0.7 - e.bloom) * k;
    e.exposure += (1 - e.exposure) * k;
    e.smear += (smearT - e.smear) * k;
    e.storm += (0 - e.storm) * k;
    e.galleryLightDeg += (15 - e.galleryLightDeg) * k;
    e.impastoGain += (1 - e.impastoGain) * k;
    e.dust += (smooth(0.5, 40, dist) - e.dust) * k;
  }

  private updateStir(clientX: number, clientY: number): void {
    const r = this.inputEl.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((clientY - r.top) / r.height) * 2 - 1);
    const far = tv1.set(nx, ny, 1).unproject(this.camera);
    const c = worldToCanvas(far);
    if (!(c.d > 0)) return;
    this.stirU = c.u * CANVAS_ASPECT;
    this.stirV = c.v;
    this.stirStrength = 1;
    this.stirEver = true;
  }

  private renderUi(f: DirectorFrameEx): void {
    if (!this.ui) return;
    const w = this.inputEl.clientWidth;
    const h = this.inputEl.clientHeight;
    let hint = 0;
    if (this.loopCount === 0 && !this.interacted && this._mode === 'cinematic' && f.loopTime >= 90) {
      hint = smooth(90, 90.6, f.loopTime) * (1 - smooth(95.3, 95.9, f.loopTime));
    }
    const ring = this._mode === 'free'
      ? projectEyeRing(this.camera, w, h, f.align)
      : { x: 0, y: 0, r: 0, visible: false, opacity: 0 };
    const hudLine = `${f.mode} · t ${f.loopTime.toFixed(1)} s · shot ${f.shot + 1} · fov ${this.fov.toFixed(1)}°` +
      `${f.calm ? ' · calm' : ''}${f.warpK !== 1 ? ` · warp ${f.warpK.toFixed(1)}` : ''}` +
      `${this._mode === 'free' ? ` · speed 2^${this.input?.speedExp ?? 0}` : ''}`;
    this.ui.render({ hud: this.hud, hudLine, hintOpacity: hint, ring });
  }
}
