// M8 free explore (§5.3): input plumbing (pointer, touch, keyboard, wheel; no pointer lock) and the pilot integrator.
// The director owns the mode machine; this file turns events into pilot state and commands.
import { Euler, type PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { EYE } from '../shared/canvasSpace';

const DEG = Math.PI / 180;

export type DirectorCommand =
  | { kind: 'return' } | { kind: 'resume' } | { kind: 'restart' } | { kind: 'storm' } | { kind: 'calm' } | { kind: 'hud' }
  | { kind: 'shot'; index: number };

export interface InputCallbacks {
  /** Any pointerdown, movement/unbound keydown or wheel: the pilot takes over (§5.3 hand-off). */
  onHandOff(): void;
  onCommand(cmd: DirectorCommand): void;
  /** Every input event (for the 12 s idle timer). */
  onActivity(): void;
}

interface Ptr { id: number; x: number; y: number; stir: boolean; touch: boolean }

const MOVE_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);
const PASSIVE_CODES = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'Tab',
  'CapsLock', 'ContextMenu', 'Escape',
]);

/** Event collector bound to the input element (pointer/wheel/touch) and its window (keys, filtered by target). */
export class PilotInput {
  readonly keys = new Set<string>();
  /** accumulated look drag (CSS px) since the last consume */
  lookDX = 0;
  lookDY = 0;
  /** accumulated pinch, ln(distance ratio), since the last consume */
  pinch = 0;
  /** wheel speed exponent n in [-4, 4] (speed x 2^n) */
  speedExp = 0;
  /** depth warp exponent in [0, 1.6], steps of 0.1 (Shift + wheel) */
  warpK = 1;
  /** active stir pointer position (client px) or null */
  stirAt: { x: number; y: number } | null = null;

  private readonly ptrs = new Map<number, Ptr>();
  private pinchDist = 0;
  private wheelAcc = 0;
  private warpAcc = 0;
  private readonly win: Window;
  private readonly off: (() => void)[] = [];

  constructor(private readonly el: HTMLElement, private readonly cb: InputCallbacks) {
    this.win = el.ownerDocument.defaultView ?? window;
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      el.addEventListener(t, f as EventListener, o);
      this.off.push(() => el.removeEventListener(t, f as EventListener, o));
    };
    const onW = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void, o?: AddEventListenerOptions) => {
      this.win.addEventListener(t, f as EventListener, o);
      this.off.push(() => this.win.removeEventListener(t, f as EventListener, o));
    };
    el.style.touchAction = 'none';
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => this.up(e));
    on('lostpointercapture', (e) => this.up(e));
    on('contextmenu', (e) => e.preventDefault());
    on('wheel', (e) => this.wheel(e), { passive: false });
    onW('keydown', (e) => this.keyDown(e));
    onW('keyup', (e) => this.keys.delete(e.code));
    onW('blur', () => { this.keys.clear(); this.ptrs.clear(); this.stirAt = null; });
  }

  /** True while nothing is held: no keys, no pointers. */
  get idle(): boolean {
    return this.keys.size === 0 && this.ptrs.size === 0;
  }

  consumeLook(): [number, number] {
    const r: [number, number] = [this.lookDX, this.lookDY];
    this.lookDX = 0;
    this.lookDY = 0;
    return r;
  }

  consumePinch(): number {
    const p = this.pinch;
    this.pinch = 0;
    return p;
  }

  resetWarp(): void {
    this.warpK = 1;
    this.warpAcc = 0;
  }

  dispose(): void {
    for (const f of this.off) f();
    this.off.length = 0;
  }

  // ------------------------------------------------------------ events
  private ours(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    if (!t || t === this.el) return true;
    const doc = this.el.ownerDocument;
    if (t === doc.body || t === doc.documentElement) return true;
    const tag = t.tagName;
    return !(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable);
  }

  private down(e: PointerEvent): void {
    this.cb.onActivity();
    try { this.el.focus({ preventScroll: true }); } catch { /* not focusable */ }
    try { this.el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    const touch = e.pointerType === 'touch';
    const stir = !touch && (e.button === 2 || e.altKey);
    this.ptrs.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY, stir, touch });
    if (stir) this.stirAt = { x: e.clientX, y: e.clientY };
    if (this.touchCount() === 2) this.pinchDist = this.touchDistance();
    this.cb.onHandOff();
  }

  private move(e: PointerEvent): void {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.cb.onActivity();
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (p.stir) {
      this.stirAt = { x: e.clientX, y: e.clientY };
      return;
    }
    if (p.touch && this.touchCount() >= 2) {
      const d = this.touchDistance();
      if (this.pinchDist > 0 && d > 0) this.pinch += Math.log(d / this.pinchDist);
      this.pinchDist = d;
      return;
    }
    this.lookDX += dx;
    this.lookDY += dy;
  }

  private up(e: PointerEvent): void {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    if (p.stir && ![...this.ptrs.values()].some((q) => q.stir)) this.stirAt = null;
    this.pinchDist = this.touchCount() === 2 ? this.touchDistance() : 0;
    this.cb.onActivity();
  }

  private touchCount(): number {
    let n = 0;
    for (const p of this.ptrs.values()) if (p.touch) n++;
    return n;
  }

  private touchDistance(): number {
    const t = [...this.ptrs.values()].filter((p) => p.touch);
    if (t.length < 2) return 0;
    return Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y);
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    this.cb.onActivity();
    // Shift + wheel is reported on deltaX by some platforms
    const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    const px = raw * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 100 : 1);
    if (e.shiftKey) {
      this.warpAcc += px;
      while (Math.abs(this.warpAcc) >= 100) {
        const step = this.warpAcc > 0 ? -1 : 1; // wheel up = deeper
        this.warpAcc -= -step * 100;
        this.warpK = Math.round(Math.max(0, Math.min(1.6, this.warpK + step * 0.1)) * 10) / 10;
      }
    } else {
      this.wheelAcc += px;
      while (Math.abs(this.wheelAcc) >= 100) {
        const step = this.wheelAcc > 0 ? -1 : 1; // wheel up = faster
        this.wheelAcc -= -step * 100;
        this.speedExp = Math.max(-4, Math.min(4, this.speedExp + step));
      }
    }
    this.cb.onHandOff();
  }

  private keyDown(e: KeyboardEvent): void {
    if (!this.ours(e) || e.ctrlKey || e.metaKey) return;
    const c = e.code;
    this.cb.onActivity();
    if (e.repeat && !MOVE_CODES.has(c)) return;
    const cmd = (k: DirectorCommand) => { e.preventDefault(); this.cb.onCommand(k); };
    if (c === 'Space') return cmd({ kind: 'return' });
    if (/^Digit[0-9]$/.test(c) || /^Numpad[0-9]$/.test(c)) {
      const n = Number(c.slice(-1));
      return cmd({ kind: 'shot', index: n === 0 ? 9 : n - 1 });
    }
    if (c === 'KeyC') return cmd({ kind: 'resume' });
    if (c === 'KeyR') return cmd({ kind: 'restart' });
    if (c === 'KeyG') return cmd({ kind: 'storm' });
    if (c === 'KeyM') return cmd({ kind: 'calm' });
    if (c === 'KeyH') return cmd({ kind: 'hud' });
    if (MOVE_CODES.has(c)) {
      e.preventDefault();
      this.keys.add(c);
      this.cb.onHandOff();
      return;
    }
    if (PASSIVE_CODES.has(c) || /^F\d+$/.test(c)) return;
    this.cb.onHandOff();
  }
}

// ---------------------------------------------------------------- pilot
const euler = new Euler(0, 0, 0, 'YXZ');
const qA = new Quaternion();
const vF = new Vector3(), vR = new Vector3(), vDes = new Vector3();
const Y = new Vector3(0, 1, 0);

/** Pilot state: position with inertia (0.4 s), yaw/pitch look with 0.12 s damping, residual roll decaying at 0.4 s. */
export class FreeFly {
  readonly pos = new Vector3();
  readonly vel = new Vector3();
  readonly quat = new Quaternion();
  yaw = 0;
  pitch = 0;
  yawT = 0;
  pitchT = 0;
  /** aviation degrees (+ = bank right) */
  roll = 0;
  fov = 36;

  static readonly INERTIA_S = 0.4;
  static readonly LOOK_S = 0.12;
  static readonly PITCH_MAX = 85 * DEG;

  /** Take the current pose, FOV and velocity as the pilot state (no blend). */
  takeOver(pos: Vector3, quat: Quaternion, fovDeg: number, vel: Vector3): void {
    this.pos.copy(pos);
    this.vel.copy(vel);
    this.fov = fovDeg;
    vF.set(0, 0, -1).applyQuaternion(quat);
    this.yaw = this.yawT = Math.atan2(-vF.x, -vF.z);
    this.pitch = this.pitchT = Math.asin(Math.max(-1, Math.min(1, vF.y)));
    // residual roll = rotation about the view axis between the no-roll frame and the given frame
    euler.set(this.pitch, this.yaw, 0, 'YXZ');
    qA.setFromEuler(euler).invert().multiply(quat);
    this.roll = (-2 * Math.atan2(qA.z, qA.w)) / DEG;
    if (this.roll > 180) this.roll -= 360;
    if (this.roll < -180) this.roll += 360;
    this.compose();
  }

  /** Base speed v = 0.35 max(|C - E|, 30 m) per second, times 2^n. */
  speed(n: number): number {
    return 0.35 * Math.max(this.pos.distanceTo(EYE), 30) * Math.pow(2, n);
  }

  update(dt: number, input: PilotInput | null, viewportHeightPx: number): void {
    if (input) {
      const [dx, dy] = input.consumeLook();
      const k = (this.fov * DEG) / Math.max(1, viewportHeightPx); // grab: the scene follows the drag
      this.yawT += dx * k;
      this.pitchT = Math.max(-FreeFly.PITCH_MAX, Math.min(FreeFly.PITCH_MAX, this.pitchT + dy * k));
    }
    const a = 1 - Math.exp(-dt / FreeFly.LOOK_S);
    this.yaw += (this.yawT - this.yaw) * a;
    this.pitch += (this.pitchT - this.pitch) * a;
    this.roll *= Math.exp(-dt / FreeFly.INERTIA_S);
    this.compose();

    vDes.set(0, 0, 0);
    const v = this.speed(input ? input.speedExp : 0);
    if (input) {
      vF.set(0, 0, -1).applyQuaternion(this.quat);
      vR.set(1, 0, 0).applyQuaternion(this.quat);
      vR.y = 0;
      if (vR.lengthSq() < 1e-8) vR.set(1, 0, 0);
      vR.normalize();
      const K = input.keys;
      if (K.has('KeyW') || K.has('ArrowUp')) vDes.add(vF);
      if (K.has('KeyS') || K.has('ArrowDown')) vDes.sub(vF);
      if (K.has('KeyD') || K.has('ArrowRight')) vDes.add(vR);
      if (K.has('KeyA') || K.has('ArrowLeft')) vDes.sub(vR);
      if (K.has('KeyE')) vDes.add(Y);
      if (K.has('KeyQ')) vDes.sub(Y);
      if (vDes.lengthSq() > 0) vDes.normalize().multiplyScalar(v);
      const pinch = input.consumePinch();
      if (pinch !== 0) this.pos.addScaledVector(vF, pinch * v);
    }
    const b = 1 - Math.exp(-dt / FreeFly.INERTIA_S);
    this.vel.lerp(vDes, b);
    this.pos.addScaledVector(this.vel, dt);
  }

  private compose(): void {
    euler.set(this.pitch, this.yaw, -this.roll * DEG, 'YXZ');
    this.quat.setFromEuler(euler);
  }

  write(camera: PerspectiveCamera): void {
    camera.position.copy(this.pos);
    camera.quaternion.copy(this.quat);
    if (camera.fov !== this.fov) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
  }
}
