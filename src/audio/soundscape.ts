// Procedural Web Audio Soundscape Engine for the 8-Act Van Gogh Odyssey (1888-1890).
// 100% procedural (zero external MP3/WAV assets): synthesizes warm harmonic drones, stereo cathedral reverb,
// act-specific environmental textures (Rhône river waves, Mistral wheat surf, Auvers bronze church bells,
// flapping crow wings, spring blossom harp droplets), camera-velocity wind rush, portal cross-dissolve brush
// swirl, and interactive sky-stirring starlight chimes.
import type { PaintingId } from '../chapters/types';

interface ActSoundProfile {
  /** 4-voice warm harmonic pad frequencies (Hz). */
  padFreqs: readonly [number, number, number, number];
  /** Melodic / harmonic overtone pool (Hz) for chimes, blossoms, or star sparkles. */
  chimePool: readonly number[];
  /** Base noise filter center frequency (Hz) and Q for environmental texture. */
  envFreq: number;
  envQ: number;
  envGain: number;
  /** LFO rate (Hz) and depth (Hz) modulating the environmental filter (e.g. lapping river waves or wheat surf). */
  lfoRate: number;
  lfoDepth: number;
  /** Average interval (seconds) between ambient harmonic droplets/chimes. */
  chimeInterval: number;
  /** Timbre style for ambient droplets. */
  chimeStyle: 'warm' | 'celesta' | 'lullaby' | 'glass' | 'pastoral' | 'blossom' | 'bell' | 'storm';
}

const ACT_PROFILES: Record<PaintingId, ActSoundProfile> = {
  // Chapter I (Earth): The Potato Eaters — Deep earthen C Dorian / Minor 7 cello warmth & hearth glow
  potato: {
    padFreqs: [98.00, 130.81, 196.00, 233.08], // G2, C3, G3, Bb3
    chimePool: [261.63, 311.13, 392.00, 466.16],
    envFreq: 185,
    envQ: 2.0,
    envGain: 0.024,
    lfoRate: 0.09,
    lfoDepth: 45,
    chimeInterval: 4.4,
    chimeStyle: 'lullaby',
  },
  // Chapter I (Earth): A Pair of Shoes — Warm F Minor / Ab Major earthen studio & wooden footsteps resonance
  shoes: {
    padFreqs: [103.83, 155.56, 207.65, 261.63], // Ab2, Eb3, Ab3, C4
    chimePool: [311.13, 392.00, 466.16, 523.25],
    envFreq: 210,
    envQ: 1.9,
    envGain: 0.025,
    lfoRate: 0.11,
    lfoDepth: 55,
    chimeInterval: 3.9,
    chimeStyle: 'lullaby',
  },
  // Chapter II (Color): Boulevard de Clichy — Sparkling Impressionist A Major 9 pointillist awakening
  paris: {
    padFreqs: [164.81, 220.00, 277.18, 329.63], // E3, A3, C#4, E4
    chimePool: [554.37, 659.25, 880.00, 987.77, 1108.73, 1318.51],
    envFreq: 490,
    envQ: 1.6,
    envGain: 0.032,
    lfoRate: 0.22,
    lfoDepth: 165,
    chimeInterval: 2.1,
    chimeStyle: 'blossom',
  },
  // Chapter II (Color): Self-Portrait with Straw Hat — Luminous B Minor / D Major 9 introspective gaze & aura
  selfportrait: {
    padFreqs: [146.83, 220.00, 277.18, 369.99], // D3, A3, C#4, F#4
    chimePool: [440.00, 554.37, 659.25, 739.99, 880.00],
    envFreq: 390,
    envQ: 1.8,
    envGain: 0.028,
    lfoRate: 0.16,
    lfoDepth: 110,
    chimeInterval: 2.9,
    chimeStyle: 'glass',
  },
  // Chapter III (Sun): Sunflowers — Radiant D Lydian / Major 9 golden solar warmth
  sunflowers: {
    padFreqs: [146.83, 220.00, 293.66, 369.99], // D3, A3, D4, F#4
    chimePool: [587.33, 739.99, 880.00, 1108.73, 1174.66],
    envFreq: 420,
    envQ: 1.5,
    envGain: 0.030,
    lfoRate: 0.17,
    lfoDepth: 130,
    chimeInterval: 2.5,
    chimeStyle: 'warm',
  },
  // Chapter III (Sun): Café Terrace at Night — Warm F Major 9 gaslit nocturnal square
  cafe: {
    padFreqs: [174.61, 220.00, 261.63, 329.63], // F3, A3, C4, E4
    chimePool: [523.25, 659.25, 783.99, 880.00, 1046.50],
    envFreq: 310,
    envQ: 1.4,
    envGain: 0.028,
    lfoRate: 0.14,
    lfoDepth: 85,
    chimeInterval: 3.4,
    chimeStyle: 'warm',
  },
  // Chapter III (Sun): Starry Night Over the Rhône — Serene Db Major 9 + lapping river water
  rhone: {
    padFreqs: [138.59, 207.65, 261.63, 311.13], // Db3, Ab3, C4, Eb4
    chimePool: [523.25, 622.25, 698.46, 830.61, 1046.50, 1244.51],
    envFreq: 380,
    envQ: 2.2,
    envGain: 0.042,
    lfoRate: 0.24,
    lfoDepth: 190,
    chimeInterval: 2.8,
    chimeStyle: 'celesta',
  },
  // Chapter III (Sun): The Bedroom in Arles — Intimate Bb Major 7 wooden sanctuary
  bedroom: {
    padFreqs: [116.54, 174.61, 220.00, 293.66], // Bb2, F3, A3, D4
    chimePool: [440.00, 587.33, 698.46, 880.00],
    envFreq: 220,
    envQ: 1.8,
    envGain: 0.020,
    lfoRate: 0.11,
    lfoDepth: 55,
    chimeInterval: 4.0,
    chimeStyle: 'lullaby',
  },
  // Chapter IV (Cosmos): The Starry Night — Cosmic C# Minor 9 / Dorian 250 km vortex
  starry: {
    padFreqs: [138.59, 207.65, 246.94, 329.63], // C#3, G#3, B3, E4
    chimePool: [493.88, 659.25, 739.99, 987.77, 1108.73, 1318.51],
    envFreq: 520,
    envQ: 1.9,
    envGain: 0.045,
    lfoRate: 0.19,
    lfoDepth: 260,
    chimeInterval: 2.6,
    chimeStyle: 'glass',
  },
  // Chapter IV (Cosmos): Irises — Lush Eb Major 9 garden breeze & solitary white iris celesta
  irises: {
    padFreqs: [155.56, 233.08, 293.66, 349.23], // Eb3, Bb3, D4, F4
    chimePool: [587.33, 698.46, 783.99, 932.33, 1174.66],
    envFreq: 480,
    envQ: 1.7,
    envGain: 0.036,
    lfoRate: 0.18,
    lfoDepth: 175,
    chimeInterval: 2.3,
    chimeStyle: 'celesta',
  },
  // Chapter IV (Cosmos): Wheat Field with Cypresses — Sunlit G Major 9 + Mistral wind in golden grain
  wheat: {
    padFreqs: [196.00, 293.66, 369.99, 440.00], // G3, D4, F#4, A4
    chimePool: [587.33, 739.99, 880.00, 987.77, 1174.66],
    envFreq: 680,
    envQ: 1.5,
    envGain: 0.052,
    lfoRate: 0.21,
    lfoDepth: 320,
    chimeInterval: 3.1,
    chimeStyle: 'pastoral',
  },
  // Chapter IV (Cosmos): Almond Blossom — Radiant E Major Pentatonic spring awakening
  almond: {
    padFreqs: [164.81, 246.94, 329.63, 369.99], // E3, B3, E4, F#4
    chimePool: [659.25, 739.99, 830.61, 987.77, 1108.73, 1318.51],
    envFreq: 560,
    envQ: 2.0,
    envGain: 0.030,
    lfoRate: 0.16,
    lfoDepth: 180,
    chimeInterval: 1.95,
    chimeStyle: 'blossom',
  },
  // Chapter V (Road): The Church at Auvers — Solemn D Minor Add9 Gothic organ & bronze bell
  church: {
    padFreqs: [146.83, 220.00, 261.63, 329.63], // D3, A3, C4, E4
    chimePool: [293.66, 440.00, 523.25, 587.33],
    envFreq: 290,
    envQ: 2.4,
    envGain: 0.036,
    lfoRate: 0.15,
    lfoDepth: 120,
    chimeInterval: 4.6,
    chimeStyle: 'bell',
  },
  // Chapter V (Road): Portrait of Dr. Gachet — Melancholic E Minor 9 / G Major 7 chamber elegy
  gachet: {
    padFreqs: [130.81, 196.00, 246.94, 329.63], // C3, G3, B3, E4
    chimePool: [392.00, 493.88, 587.33, 659.25, 783.99],
    envFreq: 310,
    envQ: 2.1,
    envGain: 0.032,
    lfoRate: 0.14,
    lfoDepth: 95,
    chimeInterval: 3.5,
    chimeStyle: 'lullaby',
  },
  // Chapter V (Road): Wheatfield with Crows — Tempestuous A Minor storm & murder of crows
  crows: {
    padFreqs: [110.00, 164.81, 220.00, 246.94], // A2, E3, A3, B3
    chimePool: [440.00, 493.88, 523.25, 659.25, 880.00],
    envFreq: 460,
    envQ: 1.6,
    envGain: 0.058,
    lfoRate: 0.28,
    lfoDepth: 290,
    chimeInterval: 2.4,
    chimeStyle: 'storm',
  },
};

export interface SoundscapeFrameState {
  primaryId: PaintingId;
  secondaryId: PaintingId | null;
  atmoMix: number;
  /** Camera speed in m/s */
  camSpeed: number;
  /** Alignment at E in [0, 1] */
  align: number;
  /** Off-axis depth factor in [0, 1] */
  off: number;
  /** Brushstroke scatter / cross-dissolve amplitude in [0, 1] */
  scatter: number;
  /** User sky-stirring strength in [0, 1] */
  stirStrength: number;
  /** True on the frame a painting snaps into registration at E */
  snapTriggered: boolean;
}

export class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private dryBus: GainNode | null = null;
  private wetBus: GainNode | null = null;

  private padOscs: OscillatorNode[] = [];
  private padGains: GainNode[] = [];
  private padFilter: BiquadFilterNode | null = null;

  private envFilter: BiquadFilterNode | null = null;
  private envGainNode: GainNode | null = null;
  private envLfo: OscillatorNode | null = null;
  private envLfoGain: GainNode | null = null;

  private windFilter: BiquadFilterNode | null = null;
  private windGainNode: GainNode | null = null;

  private _enabled = true;
  private _unlocked = false;
  private chimeTimer = 1.2;
  private stirTimer = 0;
  private crowTimer = 1.8;
  private lastSnapTime = -10;
  private clock = 0;
  private onStateChange?: (enabled: boolean, active: boolean) => void;

  constructor(opts?: { initialEnabled?: boolean; onStateChange?: (enabled: boolean, active: boolean) => void }) {
    let saved: string | null = null;
    try { saved = localStorage.getItem('punctum.sound'); } catch { /* ignore */ }
    this._enabled = opts?.initialEnabled ?? (saved !== '0');
    this.onStateChange = opts?.onStateChange;

    // Unlock Web Audio automatically on the first user gesture anywhere in the window
    const unlock = () => {
      if (!this._enabled) return;
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this._unlocked = true;
          this.notify();
        }).catch(() => { /* ignore until next gesture */ });
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('wheel', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get active(): boolean {
    return this._enabled && this._unlocked && this.ctx?.state === 'running';
  }

  private notify(): void {
    this.onStateChange?.(this._enabled, this.active);
  }

  /** Toggle soundscape on/off (called from UI pill button or keyboard shortcut `V`). */
  toggle(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
    try { localStorage.setItem('punctum.sound', on ? '1' : '0'); } catch { /* ignore */ }
    if (on) {
      this.ensureContext();
      if (this.ctx) {
        this.ctx.resume().then(() => {
          this._unlocked = true;
          if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(0.78, this.ctx.currentTime, 0.25);
          }
          this.notify();
        }).catch(() => { this.notify(); });
      }
    } else if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
    }
    this.notify();
  }

  /** Build the procedural Web Audio graph on demand. */
  private ensureContext(): void {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    // Master compressor + master gain
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.015;
    comp.release.value = 0.25;

    const masterGain = ctx.createGain();
    masterGain.gain.value = this._enabled ? 0.001 : 0.0001;
    masterGain.connect(comp);
    comp.connect(ctx.destination);
    this.masterGain = masterGain;

    // Synthesize a lush 3.2-second stereo cathedral/nocturnal impulse response
    const reverb = ctx.createConvolver();
    reverb.buffer = this.buildReverbImpulse(ctx, 3.2, 2.4);
    this.reverbNode = reverb;

    const dryBus = ctx.createGain();
    dryBus.gain.value = 0.72;
    dryBus.connect(masterGain);
    this.dryBus = dryBus;

    const wetBus = ctx.createGain();
    wetBus.gain.value = 0.52;
    reverb.connect(wetBus);
    wetBus.connect(masterGain);
    this.wetBus = wetBus;

    // 1. Warm 4-Voice Harmonic Pad (filtered triangle + sine blend)
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 720;
    padFilter.Q.value = 0.7;
    padFilter.connect(dryBus);
    padFilter.connect(reverb);
    this.padFilter = padFilter;

    const initFreqs = ACT_PROFILES.cafe.padFreqs;
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : i % 2 === 1 ? 'triangle' : 'sine';
      osc.frequency.value = initFreqs[i];
      // Subtle organic detune for chorus warmth
      osc.detune.value = (i - 1.5) * 4.5;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.065 : 0.042;
      osc.connect(g);
      g.connect(padFilter);
      osc.start();
      this.padOscs.push(osc);
      this.padGains.push(g);
    }

    // 2. Shared 4-second looping pink-noise buffer for environmental textures & flight wind
    const noiseBuf = this.buildPinkNoiseBuffer(ctx, 4.5);

    // 2a. Act-specific environmental texture filter (river waves, wheat surf, nocturnal breeze)
    const envSource = ctx.createBufferSource();
    envSource.buffer = noiseBuf;
    envSource.loop = true;

    const envFilter = ctx.createBiquadFilter();
    envFilter.type = 'bandpass';
    envFilter.frequency.value = ACT_PROFILES.cafe.envFreq;
    envFilter.Q.value = ACT_PROFILES.cafe.envQ;

    const envLfo = ctx.createOscillator();
    envLfo.type = 'sine';
    envLfo.frequency.value = ACT_PROFILES.cafe.lfoRate;
    const envLfoGain = ctx.createGain();
    envLfoGain.gain.value = ACT_PROFILES.cafe.lfoDepth;
    envLfo.connect(envLfoGain);
    envLfoGain.connect(envFilter.frequency);
    envLfo.start();

    const envGainNode = ctx.createGain();
    envGainNode.gain.value = ACT_PROFILES.cafe.envGain;
    envSource.connect(envFilter);
    envFilter.connect(envGainNode);
    envGainNode.connect(dryBus);
    envGainNode.connect(reverb);
    envSource.start();

    this.envFilter = envFilter;
    this.envGainNode = envGainNode;
    this.envLfo = envLfo;
    this.envLfoGain = envLfoGain;

    // 2b. Camera Flight Wind & Brushstroke Cross-Dissolve Swirl generator
    const windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuf;
    windSource.loop = true;
    windSource.playbackRate.value = 1.15;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 1.8;

    const windGainNode = ctx.createGain();
    windGainNode.gain.value = 0.001;
    windSource.connect(windFilter);
    windFilter.connect(windGainNode);
    windGainNode.connect(dryBus);
    windGainNode.connect(reverb);
    windSource.start();

    this.windFilter = windFilter;
    this.windGainNode = windGainNode;

    if (ctx.state === 'running') {
      this._unlocked = true;
      if (this._enabled) {
        masterGain.gain.setTargetAtTime(0.78, ctx.currentTime, 0.35);
      }
      this.notify();
    }
  }

  private buildReverbImpulse(ctx: AudioContext, durationSec: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * durationSec);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, decay) * (1 - 0.15 * Math.cos(i * 0.002));
        const white = Math.random() * 2 - 1;
        // Warm lowpass damping on reverb tail
        lp = lp * 0.72 + white * 0.28;
        data[i] = lp * env * 0.45;
      }
    }
    return buf;
  }

  private buildPinkNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * durationSec);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const out = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.045;
        b6 = w * 0.115926;
        // Crossfade loop ends smoothly so loop seam is completely inaudible
        const fade = i < 2048 ? i / 2048 : i > len - 2048 ? (len - i) / 2048 : 1;
        out[i] = pink * fade + (i > len - 2048 ? out[i - (len - 2048)] * (1 - fade) : 0);
      }
    }
    return buf;
  }

  /** Per-frame update driven by composition.ts. */
  update(dt: number, state: SoundscapeFrameState): void {
    this.clock += dt;
    if (!this._enabled || !this.ctx || this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const profA = ACT_PROFILES[state.primaryId];
    const profB = state.secondaryId ? ACT_PROFILES[state.secondaryId] : profA;
    const mix = state.secondaryId ? Math.max(0, Math.min(1, state.atmoMix)) : 0;

    // 1. Glide the 4 harmonic pad voices between outgoing and incoming paintings
    for (let i = 0; i < 4; i++) {
      const targetFreq = profA.padFreqs[i] + (profB.padFreqs[i] - profA.padFreqs[i]) * mix;
      this.padOscs[i].frequency.setTargetAtTime(targetFreq, now, 0.18);
      // Gentle breathing modulation across the 4 voices
      const breath = 1 + 0.18 * Math.sin(this.clock * (0.45 + i * 0.13) + i * 1.4);
      const baseGain = i === 0 ? 0.062 : 0.038;
      this.padGains[i].gain.setTargetAtTime(baseGain * breath, now, 0.15);
    }

    // Pad filter & cathedral reverb swell as camera leaves E into the 250 km 3D world or enters a portal
    if (this.padFilter) {
      const cutoff = 580 + 1150 * state.off + 650 * state.scatter;
      this.padFilter.frequency.setTargetAtTime(cutoff, now, 0.14);
    }
    if (this.wetBus) {
      const wetLevel = 0.40 + 0.24 * state.off + 0.14 * state.scatter;
      this.wetBus.gain.setTargetAtTime(wetLevel, now, 0.2);
    }

    // 2. Blend act-specific environmental soundscape (river waves, wheat surf, nocturnal breeze)
    if (this.envFilter && this.envGainNode && this.envLfo && this.envLfoGain) {
      const envF = profA.envFreq + (profB.envFreq - profA.envFreq) * mix;
      const envQ = profA.envQ + (profB.envQ - profA.envQ) * mix;
      const envG = (profA.envGain + (profB.envGain - profA.envGain) * mix) * (0.55 + 0.65 * state.off);
      const lfoR = profA.lfoRate + (profB.lfoRate - profA.lfoRate) * mix;
      const lfoD = profA.lfoDepth + (profB.lfoDepth - profA.lfoDepth) * mix;

      this.envFilter.frequency.setTargetAtTime(envF, now, 0.2);
      this.envFilter.Q.setTargetAtTime(envQ, now, 0.2);
      this.envGainNode.gain.setTargetAtTime(envG, now, 0.2);
      this.envLfo.frequency.setTargetAtTime(lfoR, now, 0.25);
      this.envLfoGain.gain.setTargetAtTime(lfoD, now, 0.25);
    }

    // 3. Camera flight wind rush & 3D brushstroke cross-dissolve whoosh
    if (this.windFilter && this.windGainNode) {
      const speedNorm = Math.min(1, Math.log1p(Math.max(0, state.camSpeed) * 0.015) / 3.2);
      const portalSwirl = state.scatter;
      const windIntensity = Math.min(1, Math.max(speedNorm * 0.75, portalSwirl * 0.95, state.stirStrength * 0.6));
      const windFreq = 320 + 1450 * windIntensity;
      const windGain = 0.001 + 0.075 * Math.pow(windIntensity, 1.35);
      this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.08);
      this.windGainNode.gain.setTargetAtTime(windGain, now, 0.08);
    }

    // 4. Ambient melodic/harmonic droplets (stars, blossoms, Auvers bronze church bell, etc.)
    const activeProf = mix > 0.5 ? profB : profA;
    this.chimeTimer -= dt;
    if (this.chimeTimer <= 0) {
      this.chimeTimer = activeProf.chimeInterval * (0.65 + 0.7 * Math.random());
      this.triggerAmbientNote(activeProf);
    }

    // 5. Act VIII (Wheatfield with Crows): procedural wing-flutter & distant crow call in the storm
    if (state.primaryId === 'crows' || state.secondaryId === 'crows') {
      this.crowTimer -= dt;
      if (this.crowTimer <= 0) {
        this.crowTimer = 1.6 + Math.random() * 2.2;
        this.triggerCrowFlutter();
      }
    }

    // 6. Interactive sky-stirring starlight chimes
    if (state.stirStrength > 0.05) {
      this.stirTimer -= dt;
      if (this.stirTimer <= 0) {
        this.stirTimer = Math.max(0.07, 0.22 - 0.14 * state.stirStrength);
        this.triggerStirSparkle(activeProf.chimePool, state.stirStrength);
      }
    }

    // 7. Snap-to-Eye resonant chord when a painting locks into registration at E
    if (state.snapTriggered && this.clock - this.lastSnapTime > 1.2) {
      this.lastSnapTime = this.clock;
      const targetId = state.secondaryId ?? state.primaryId;
      this.triggerSnapChord(targetId);
    }
  }

  /** Trigger an act-specific harmonic chime, blossom pluck, or Gothic bronze church bell. */
  private triggerAmbientNote(prof: ActSoundProfile): void {
    if (!this.ctx || !this.dryBus || !this.reverbNode) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freq = prof.chimePool[Math.floor(Math.random() * prof.chimePool.length)];

    if (prof.chimeStyle === 'bell') {
      // Auvers Gothic Church Bronze Bell: modal synthesis with inharmonic partials (1 : 2.0 : 2.41 : 3.01)
      const ratios = [1.0, 2.0, 2.41, 3.01];
      const amps = [0.045, 0.024, 0.016, 0.010];
      const decays = [4.2, 3.1, 2.2, 1.5];
      for (let i = 0; i < ratios.length; i++) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * 0.5 * ratios[i];
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(amps[i], now + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);
        osc.connect(g);
        g.connect(this.reverbNode);
        if (i === 0) g.connect(this.dryBus);
        osc.start(now);
        osc.stop(now + decays[i] + 0.05);
      }
      return;
    }

    // Harmonic droplet / celesta / blossom harp pluck / glass armonica swell
    const isGlass = prof.chimeStyle === 'glass' || prof.chimeStyle === 'lullaby';
    const attack = isGlass ? 0.18 : 0.015;
    const decay = prof.chimeStyle === 'blossom' ? 1.8 : isGlass ? 2.6 : 2.1;
    const peak = prof.chimeStyle === 'blossom' ? 0.036 : 0.028;

    const osc = ctx.createOscillator();
    osc.type = prof.chimeStyle === 'warm' || prof.chimeStyle === 'pastoral' ? 'triangle' : 'sine';
    osc.frequency.value = freq;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    osc.connect(g);
    g.connect(this.reverbNode);
    g.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + attack + decay + 0.05);
  }

  /** Synthesize soft 3D wing-flaps and distant wind-swept crow resonance for Act VIII. */
  private triggerCrowFlutter(): void {
    if (!this.ctx || !this.dryBus || !this.reverbNode) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // 3 to 4 rapid wing-beat whooshes using filtered noise bursts
    const beats = 3 + Math.floor(Math.random() * 2);
    for (let b = 0; b < beats; b++) {
      const t0 = now + b * 0.14;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190 + Math.random() * 45, t0);
      osc.frequency.exponentialRampToValueAtTime(95, t0 + 0.09);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.022, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
      osc.connect(g);
      g.connect(this.reverbNode);
      osc.start(t0);
      osc.stop(t0 + 0.12);
    }
  }

  /** Sparkle high-register starlight chimes when the user stirs the sky with Alt-drag / right-drag. */
  private triggerStirSparkle(pool: readonly number[], strength: number): void {
    if (!this.ctx || !this.reverbNode || !this.dryBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const baseFreq = pool[Math.floor(Math.random() * pool.length)];
    const freq = baseFreq * (Math.random() < 0.45 ? 2 : 1);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.015, now + 0.65);

    const g = ctx.createGain();
    const amp = Math.min(0.045, 0.016 + 0.028 * strength);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

    osc.connect(g);
    g.connect(this.reverbNode);
    g.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  /** Warm arpeggiated resonant chord when brushstrokes snap into registration at the Painter's Eye E. */
  triggerSnapChord(paintingId: PaintingId): void {
    if (!this._enabled || !this.ctx || this.ctx.state !== 'running' || !this.reverbNode || !this.dryBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freqs = ACT_PROFILES[paintingId].padFreqs;

    for (let i = 0; i < freqs.length; i++) {
      const t0 = now + i * 0.055;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freqs[i] * 2, t0);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.034, t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);

      osc.connect(g);
      g.connect(this.reverbNode);
      g.connect(this.dryBus);
      osc.start(t0);
      osc.stop(t0 + 2.45);
    }
  }
}
