// Procedural Web Audio Soundscape Engine for the 15-Act Van Gogh World System (1885–1890).
// 100% procedural (zero external MP3/WAV assets): synthesizes warm harmonic drones, stereo cathedral reverb,
// act-specific environmental textures (Rhône river waves, Mistral wheat surf, Auvers bronze church bells,
// flapping crow wings, spring blossom harp droplets), camera-velocity wind rush, 6 Motif Transition Musical
// Bridges (✦ Light, ⟁ Road, ◎ Sky, ❀ Flora, ⌂ Dwelling, ❖ Gaze), 3D portal proximity resonance, and sky-stirring chimes.
import type { MotifId, PaintingId } from '../chapters/types';

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
  // ---------------- CHAPTER I: EARTH (Nuenen & Antwerp, 1884–1886) ----------------
  potato: {
    padFreqs: [98.00, 130.81, 196.00, 233.08], // G2, C3, G3, Bb3 (C Dorian cello warmth)
    chimePool: [261.63, 311.13, 392.00, 466.16],
    envFreq: 185, envQ: 2.0, envGain: 0.024, lfoRate: 0.09, lfoDepth: 45, chimeInterval: 4.4, chimeStyle: 'lullaby',
  },
  weaver: {
    padFreqs: [110.00, 146.83, 220.00, 261.63], // A2, D3, A3, C4 (Rhythmic D Dorian handloom shuttle pulse)
    chimePool: [293.66, 349.23, 440.00, 523.25],
    envFreq: 240, envQ: 2.2, envGain: 0.028, lfoRate: 0.32, lfoDepth: 75, chimeInterval: 3.2, chimeStyle: 'lullaby',
  },
  tower: {
    padFreqs: [92.50, 138.59, 185.00, 220.00], // F#2, C#3, F#3, A3 (Nuenen belfry twilight minor drone)
    chimePool: [277.18, 329.63, 369.99, 440.00],
    envFreq: 260, envQ: 2.3, envGain: 0.032, lfoRate: 0.13, lfoDepth: 80, chimeInterval: 4.5, chimeStyle: 'bell',
  },
  shoes: {
    padFreqs: [103.83, 155.56, 207.65, 261.63], // Ab2, Eb3, Ab3, C4
    chimePool: [311.13, 392.00, 466.16, 523.25],
    envFreq: 210, envQ: 1.9, envGain: 0.025, lfoRate: 0.11, lfoDepth: 55, chimeInterval: 3.9, chimeStyle: 'lullaby',
  },
  skull: {
    padFreqs: [98.00, 146.83, 196.00, 233.08], // G2, D3, G3, Bb3 (Antwerp memento mori & glowing ember glass)
    chimePool: [392.00, 466.16, 587.33, 698.46],
    envFreq: 225, envQ: 2.4, envGain: 0.022, lfoRate: 0.10, lfoDepth: 50, chimeInterval: 3.6, chimeStyle: 'glass',
  },

  // ---------------- CHAPTER II: COLOR (Paris & Montmartre, 1886–1887) ----------------
  galette: {
    padFreqs: [146.83, 220.00, 277.18, 329.63], // D3, A3, C#4, E4 (Breezy Montmartre windmill waltz)
    chimePool: [440.00, 554.37, 659.25, 739.99, 880.00],
    envFreq: 510, envQ: 1.6, envGain: 0.035, lfoRate: 0.25, lfoDepth: 185, chimeInterval: 2.4, chimeStyle: 'pastoral',
  },
  paris: {
    padFreqs: [164.81, 220.00, 277.18, 329.63], // E3, A3, C#4, E4
    chimePool: [554.37, 659.25, 880.00, 987.77, 1108.73, 1318.51],
    envFreq: 490, envQ: 1.6, envGain: 0.032, lfoRate: 0.22, lfoDepth: 165, chimeInterval: 2.1, chimeStyle: 'blossom',
  },
  seine: {
    padFreqs: [130.81, 196.00, 246.94, 293.66], // C3, G3, B3, D4 (Shimmering Seine water & steam train overtone)
    chimePool: [523.25, 659.25, 783.99, 987.77, 1046.50],
    envFreq: 440, envQ: 1.9, envGain: 0.038, lfoRate: 0.23, lfoDepth: 170, chimeInterval: 2.3, chimeStyle: 'celesta',
  },
  plum: {
    padFreqs: [146.83, 220.00, 261.63, 329.63], // D3, A3, C4, E4 (Japonisme pentatonic rain koto droplets)
    chimePool: [440.00, 523.25, 587.33, 659.25, 880.00, 1046.50],
    envFreq: 640, envQ: 1.5, envGain: 0.044, lfoRate: 0.26, lfoDepth: 210, chimeInterval: 1.85, chimeStyle: 'blossom',
  },
  tanguy: {
    padFreqs: [138.59, 207.65, 277.18, 349.23], // Db3, Ab3, Db4, F4 (Warm ukiyo-e sanctuary & sage chord)
    chimePool: [466.16, 554.37, 698.46, 830.61, 1108.73],
    envFreq: 340, envQ: 1.8, envGain: 0.025, lfoRate: 0.14, lfoDepth: 85, chimeInterval: 2.7, chimeStyle: 'warm',
  },
  selfportrait: {
    padFreqs: [146.83, 220.00, 277.18, 369.99], // D3, A3, C#4, F#4
    chimePool: [440.00, 554.37, 659.25, 739.99, 880.00],
    envFreq: 390, envQ: 1.8, envGain: 0.028, lfoRate: 0.16, lfoDepth: 110, chimeInterval: 2.9, chimeStyle: 'glass',
  },

  // ---------------- CHAPTER III: SUN (Arles, 1888–1889) ----------------
  yellowhouse: {
    padFreqs: [130.81, 196.00, 261.63, 329.63], // C3, G3, C4, E4 (Place Lamartine bright brassy sunlight)
    chimePool: [523.25, 659.25, 783.99, 987.77, 1046.50],
    envFreq: 380, envQ: 1.6, envGain: 0.029, lfoRate: 0.16, lfoDepth: 115, chimeInterval: 2.6, chimeStyle: 'warm',
  },
  sunflowers: {
    padFreqs: [146.83, 220.00, 293.66, 369.99], // D3, A3, D4, F#4
    chimePool: [587.33, 739.99, 880.00, 1108.73, 1174.66],
    envFreq: 420, envQ: 1.5, envGain: 0.030, lfoRate: 0.17, lfoDepth: 130, chimeInterval: 2.5, chimeStyle: 'warm',
  },
  harvest: {
    padFreqs: [164.81, 246.94, 329.63, 415.30], // E3, B3, E4, G#4 (Wide panoramic La Crau summer breeze)
    chimePool: [493.88, 659.25, 739.99, 830.61, 987.77],
    envFreq: 540, envQ: 1.5, envGain: 0.042, lfoRate: 0.19, lfoDepth: 220, chimeInterval: 2.8, chimeStyle: 'pastoral',
  },
  sower: {
    padFreqs: [146.83, 220.00, 293.66, 392.00], // D3, A3, D4, G4 (Sacred blazing sunset disc & earth cadence)
    chimePool: [440.00, 587.33, 659.25, 783.99, 880.00],
    envFreq: 360, envQ: 1.7, envGain: 0.034, lfoRate: 0.15, lfoDepth: 135, chimeInterval: 2.7, chimeStyle: 'warm',
  },
  cafe: {
    padFreqs: [174.61, 220.00, 261.63, 329.63], // F3, A3, C4, E4
    chimePool: [523.25, 659.25, 783.99, 880.00, 1046.50],
    envFreq: 310, envQ: 1.4, envGain: 0.028, lfoRate: 0.14, lfoDepth: 85, chimeInterval: 3.4, chimeStyle: 'warm',
  },
  nightcafe: {
    padFreqs: [123.47, 185.00, 233.08, 293.66], // B2, F#3, Bb3, D4 (Hypnotic gasolier halo & midnight tension)
    chimePool: [369.99, 466.16, 587.33, 739.99, 932.33],
    envFreq: 275, envQ: 2.3, envGain: 0.030, lfoRate: 0.13, lfoDepth: 95, chimeInterval: 3.1, chimeStyle: 'glass',
  },
  rhone: {
    padFreqs: [138.59, 207.65, 261.63, 311.13], // Db3, Ab3, C4, Eb4
    chimePool: [523.25, 622.25, 698.46, 830.61, 1046.50, 1244.51],
    envFreq: 380, envQ: 2.2, envGain: 0.042, lfoRate: 0.24, lfoDepth: 190, chimeInterval: 2.8, chimeStyle: 'celesta',
  },
  bedroom: {
    padFreqs: [116.54, 174.61, 220.00, 293.66], // Bb2, F3, A3, D4
    chimePool: [440.00, 587.33, 698.46, 880.00],
    envFreq: 220, envQ: 1.8, envGain: 0.020, lfoRate: 0.11, lfoDepth: 55, chimeInterval: 4.0, chimeStyle: 'lullaby',
  },

  // ---------------- CHAPTER IV: COSMOS (Saint-Rémy, 1889–1890) ----------------
  starry: {
    padFreqs: [138.59, 207.65, 246.94, 329.63], // C#3, G#3, B3, E4
    chimePool: [493.88, 659.25, 739.99, 987.77, 1108.73, 1318.51],
    envFreq: 520, envQ: 1.9, envGain: 0.045, lfoRate: 0.19, lfoDepth: 260, chimeInterval: 2.6, chimeStyle: 'glass',
  },
  irises: {
    padFreqs: [155.56, 233.08, 293.66, 349.23], // Eb3, Bb3, D4, F4
    chimePool: [587.33, 698.46, 783.99, 932.33, 1174.66],
    envFreq: 480, envQ: 1.7, envGain: 0.036, lfoRate: 0.18, lfoDepth: 175, chimeInterval: 2.3, chimeStyle: 'celesta',
  },
  olive: {
    padFreqs: [174.61, 261.63, 329.63, 392.00], // F3, C4, E4, G4 (Rustling silver-green olive canopy & sun rays)
    chimePool: [523.25, 659.25, 783.99, 987.77, 1046.50],
    envFreq: 560, envQ: 1.6, envGain: 0.044, lfoRate: 0.20, lfoDepth: 240, chimeInterval: 2.5, chimeStyle: 'pastoral',
  },
  wheat: {
    padFreqs: [196.00, 293.66, 369.99, 440.00], // G3, D4, F#4, A4
    chimePool: [587.33, 739.99, 880.00, 987.77, 1174.66],
    envFreq: 680, envQ: 1.5, envGain: 0.052, lfoRate: 0.21, lfoDepth: 320, chimeInterval: 3.1, chimeStyle: 'pastoral',
  },
  roadcypress: {
    padFreqs: [130.81, 196.00, 233.08, 311.13], // C3, G3, Bb3, Eb4 (Nocturnal Saint-Rémy farewell & starlight)
    chimePool: [466.16, 587.33, 622.25, 783.99, 932.33, 1174.66],
    envFreq: 470, envQ: 1.9, envGain: 0.040, lfoRate: 0.18, lfoDepth: 210, chimeInterval: 2.5, chimeStyle: 'celesta',
  },
  almond: {
    padFreqs: [164.81, 246.94, 329.63, 369.99], // E3, B3, E4, F#4
    chimePool: [659.25, 739.99, 830.61, 987.77, 1108.73, 1318.51],
    envFreq: 560, envQ: 2.0, envGain: 0.030, lfoRate: 0.16, lfoDepth: 180, chimeInterval: 1.95, chimeStyle: 'blossom',
  },

  // ---------------- CHAPTER V: ROAD (Auvers-sur-Oise, May–July 1890) ----------------
  cottages: {
    padFreqs: [146.83, 220.00, 261.63, 349.23], // D3, A3, C4, F4 (Undulating thatched roofs & spring wind)
    chimePool: [440.00, 523.25, 587.33, 698.46, 880.00],
    envFreq: 490, envQ: 1.7, envGain: 0.038, lfoRate: 0.20, lfoDepth: 195, chimeInterval: 2.9, chimeStyle: 'pastoral',
  },
  church: {
    padFreqs: [146.83, 220.00, 261.63, 329.63], // D3, A3, C4, E4
    chimePool: [293.66, 440.00, 523.25, 587.33],
    envFreq: 290, envQ: 2.4, envGain: 0.036, lfoRate: 0.15, lfoDepth: 120, chimeInterval: 4.6, chimeStyle: 'bell',
  },
  gachet: {
    padFreqs: [130.81, 196.00, 246.94, 329.63], // C3, G3, B3, E4
    chimePool: [392.00, 493.88, 587.33, 659.25, 783.99],
    envFreq: 310, envQ: 2.1, envGain: 0.032, lfoRate: 0.14, lfoDepth: 95, chimeInterval: 3.5, chimeStyle: 'lullaby',
  },
  daubigny: {
    padFreqs: [155.56, 233.08, 311.13, 392.00], // Eb3, Bb3, Eb4, G4 (Luminous 2:1 Auvers garden serenity)
    chimePool: [466.16, 587.33, 698.46, 783.99, 932.33, 1174.66],
    envFreq: 460, envQ: 1.8, envGain: 0.032, lfoRate: 0.17, lfoDepth: 155, chimeInterval: 2.2, chimeStyle: 'blossom',
  },
  crows: {
    padFreqs: [110.00, 164.81, 220.00, 246.94], // A2, E3, A3, B3
    chimePool: [440.00, 493.88, 523.25, 659.25, 880.00],
    envFreq: 460, envQ: 1.6, envGain: 0.058, lfoRate: 0.28, lfoDepth: 290, chimeInterval: 2.4, chimeStyle: 'storm',
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
  /** Connecting Motif ID during cross-dissolve or portal approach */
  transitionMotif?: MotifId;
  /** 3D Portal proximity / approach factor in [0, 1] */
  portalProximity?: number;
  /** Next painting ID in sequence (for portal overtone preview) */
  nextPaintingId?: PaintingId;
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
  private lastAutoUnlockMs = -1000;
  private chimeTimer = 1.2;
  private stirTimer = 0;
  private crowTimer = 1.8;
  private portalTimer = 0.85;
  private lastBridgeKey = '';
  private lastSnapTime = -10;
  private clock = 0;
  private onStateChange?: (enabled: boolean, active: boolean) => void;

  constructor(opts?: { initialEnabled?: boolean; onStateChange?: (enabled: boolean, active: boolean) => void }) {
    let saved: string | null = null;
    try { saved = localStorage.getItem('punctum.sound'); } catch { /* ignore */ }
    this._enabled = opts?.initialEnabled ?? (saved !== '0');
    this.onStateChange = opts?.onStateChange;

    // Unlock Web Audio automatically on the first valid user-activation gesture
    // (Note: wheel and touchstart are not valid Web Audio user-activation events in modern browsers)
    const unlock = () => {
      if (!this._enabled || document.hidden) return;
      const wasUnlocked = this.active;
      this.ensureContext();
      if (!wasUnlocked) this.lastAutoUnlockMs = performance.now();
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().then(() => {
            this._unlocked = true;
            this.syncMasterGain();
            this.notify();
          }).catch(() => { /* ignore until next gesture */ });
        } else if (this.ctx.state === 'running') {
          this._unlocked = true;
          this.syncMasterGain();
          this.notify();
        }
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('pointerup', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });

    const onVisibility = () => {
      if (!this.ctx) return;
      if (document.hidden) {
        if (this.masterGain) {
          this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
        }
        if (this.ctx.state === 'running') {
          this.ctx.suspend().then(() => this.notify()).catch(() => {});
        }
      } else if (this._enabled && this._unlocked && this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this.syncMasterGain();
          this.notify();
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => {
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    });
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get active(): boolean {
    return this._enabled && this._unlocked && this.ctx?.state === 'running' && !document.hidden;
  }

  private notify(): void {
    this.onStateChange?.(this._enabled, this.active);
  }

  private syncMasterGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this._enabled && !document.hidden && this.ctx.state === 'running' ? 0.78 : 0.0001;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, target > 0.1 ? 0.22 : 0.12);
  }

  /** Toggle soundscape on/off (called from UI pill button or keyboard shortcut `V`). */
  toggle(): boolean {
    // If enabled but still waiting for browser gesture unlock (or unlocked on this exact pointerdown), activate rather than mute
    if (this._enabled && (!this.active || performance.now() - this.lastAutoUnlockMs < 350)) {
      this.lastAutoUnlockMs = -1000;
      this.setEnabled(true);
      return this._enabled;
    }
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
    try { localStorage.setItem('punctum.sound', on ? '1' : '0'); } catch { /* ignore */ }
    if (on) {
      this.ensureContext();
      if (this.ctx) {
        if (this.ctx.state === 'running') {
          this._unlocked = true;
          this.syncMasterGain();
          this.notify();
        } else if (!document.hidden) {
          this.ctx.resume().then(() => {
            this._unlocked = true;
            this.syncMasterGain();
            this.notify();
          }).catch(() => { this.notify(); });
        }
      }
    } else if (this.ctx && this.masterGain) {
      this.syncMasterGain();
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
    ctx.onstatechange = () => {
      if (ctx.state === 'running' && this._enabled && !document.hidden) {
        this._unlocked = true;
        this.syncMasterGain();
      }
      this.notify();
    };

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

    // 5. Act XV (Wheatfield with Crows): procedural wing-flutter & distant crow call in the storm
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

    // 7. 3D Spatial Portal Proximity Overtone Preview (next world singing softly through the portal)
    const prox = state.portalProximity ?? 0;
    if (prox > 0.25 && !state.secondaryId) {
      this.portalTimer -= dt;
      if (this.portalTimer <= 0) {
        this.portalTimer = Math.max(0.38, 1.35 - 0.85 * prox);
        const nextProf = ACT_PROFILES[state.nextPaintingId ?? state.primaryId];
        this.triggerPortalPreviewGlint(nextProf.chimePool, prox);
      }
    }

    // 8. Motif Transition Musical Bridge when entering a 3D cross-dissolve between two worlds
    if (state.secondaryId && state.atmoMix > 0.02) {
      const bridgeKey = `${state.primaryId}->${state.secondaryId}`;
      if (bridgeKey !== this.lastBridgeKey) {
        this.lastBridgeKey = bridgeKey;
        this.triggerMotifBridge(state.transitionMotif ?? 'light', state.primaryId, state.secondaryId);
      }
    } else if (!state.secondaryId) {
      this.lastBridgeKey = '';
    }

    // 9. Snap-to-Eye resonant chord when a painting locks into registration at E
    if (state.snapTriggered && this.clock - this.lastSnapTime > 1.2) {
      this.lastSnapTime = this.clock;
      const targetId = state.secondaryId ?? state.primaryId;
      this.triggerSnapChord(targetId);
    }
  }

  /** Delicate high-register overtone glint from the upcoming painting when approaching the 3D portal. */
  private triggerPortalPreviewGlint(pool: readonly number[], proximity: number): void {
    if (!this.ctx || !this.reverbNode || !this.dryBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freq = pool[Math.floor(Math.random() * pool.length)] * 1.5;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const g = ctx.createGain();
    const amp = 0.008 + 0.016 * proximity;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

    osc.connect(g);
    g.connect(this.reverbNode);
    osc.start(now);
    osc.stop(now + 1.5);
  }

  /**
   * Synthesize one of the 6 Motif Transition Musical Bridges connecting `fromId` -> `toId`:
   * - `light`:    ✦ Glass harmonica overtone halo with 5.5 Hz shimmer vibrato
   * - `road`:     ⟁ Propulsive bowed-cello bass fifth cadence & rhythmic walking pulse
   * - `sky`:      ◎ 6-note ascending logarithmic celesta/harp spiral across 2 octaves
   * - `flora`:    ❀ Pastoral woodwind duet in thirds & blossom harp cascade
   * - `dwelling`: ⌂ Warm lowpass harmonium / acoustic sanctuary chord roll
   * - `gaze`:     ❖ Ocular mirror unison-to-sixth interval & modal glass-bell dyad
   */
  triggerMotifBridge(motif: MotifId, fromId: PaintingId, toId: PaintingId): void {
    if (!this._enabled || !this.ctx || this.ctx.state !== 'running' || !this.reverbNode || !this.dryBus) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const profFrom = ACT_PROFILES[fromId];
    const profTo = ACT_PROFILES[toId];

    if (motif === 'light') {
      // ✦ Light: Glass harmonica overtone halo (2x, 3x, 4x harmonics of target pad with shimmer vibrato)
      const harmonics = [profTo.padFreqs[1] * 2, profTo.padFreqs[2] * 2, profTo.padFreqs[3] * 2, profTo.padFreqs[1] * 3];
      for (let i = 0; i < harmonics.length; i++) {
        const t0 = now + i * 0.14;
        const osc = ctx.createOscillator();
        const vib = ctx.createOscillator();
        const vibG = ctx.createGain();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(harmonics[i], t0);
        vib.type = 'sine';
        vib.frequency.value = 5.2 + i * 0.4;
        vibG.gain.value = 2.8;
        vib.connect(vibG);
        vibG.connect(osc.frequency);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.026 - i * 0.003, t0 + 0.28);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.9);
        osc.connect(g);
        g.connect(this.reverbNode);
        g.connect(this.dryBus);
        osc.start(t0);
        vib.start(t0);
        osc.stop(t0 + 2.95);
        vib.stop(t0 + 2.95);
      }
      return;
    }

    if (motif === 'road') {
      // ⟁ Road: Propulsive bowed-cello bass cadence stepping from outgoing root -> passing fifth -> incoming root
      const steps = [profFrom.padFreqs[0], profFrom.padFreqs[0] * 1.5, profTo.padFreqs[0] * 1.5, profTo.padFreqs[0]];
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      lp.Q.value = 1.4;
      lp.connect(this.dryBus);
      lp.connect(this.reverbNode);

      for (let i = 0; i < steps.length; i++) {
        const t0 = now + i * 0.34;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(steps[i], t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.032, t0 + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
        osc.connect(g);
        g.connect(lp);
        osc.start(t0);
        osc.stop(t0 + 0.68);
      }
      return;
    }

    if (motif === 'sky') {
      // ◎ Sky: 6-note ascending logarithmic celesta/harp spiral across 2 octaves
      const pool = profTo.chimePool;
      for (let i = 0; i < 6; i++) {
        const t0 = now + i * 0.16;
        const base = pool[i % pool.length];
        const freq = base * (i >= 3 ? 1.5 : 1.0);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.01, t0 + 1.8);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.028, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
        osc.connect(g);
        g.connect(this.reverbNode);
        g.connect(this.dryBus);
        osc.start(t0);
        osc.stop(t0 + 2.25);
      }
      return;
    }

    if (motif === 'flora') {
      // ❀ Flora: Pastoral woodwind duet in thirds & blossom harp cascade
      const pool = profTo.chimePool;
      for (let i = 0; i < 5; i++) {
        const t0 = now + i * 0.19;
        const f1 = pool[i % pool.length];
        const f2 = f1 * 1.25; // warm major third duet
        for (const freq of [f1, f2]) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * 0.75, t0);
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.020, t0 + 0.045);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.65);
          osc.connect(g);
          g.connect(this.reverbNode);
          g.connect(this.dryBus);
          osc.start(t0);
          osc.stop(t0 + 1.7);
        }
      }
      return;
    }

    if (motif === 'dwelling') {
      // ⌂ Dwelling: Intimate low-register harmonium / wooden sanctuary chord roll
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 640;
      lp.connect(this.dryBus);
      lp.connect(this.reverbNode);

      const chord = profTo.padFreqs;
      for (let i = 0; i < chord.length; i++) {
        const t0 = now + i * 0.11;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(chord[i] * 1.5, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.030, t0 + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
        osc.connect(g);
        g.connect(lp);
        osc.start(t0);
        osc.stop(t0 + 2.65);
      }
      return;
    }

    // ❖ Gaze: Ocular mirror interval (unison diverging to sixth) + modal bell partial
    const centerF = profTo.padFreqs[2] * 2;
    const targets = [centerF * 0.8, centerF * 1.25];
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(centerF, now);
      osc.frequency.exponentialRampToValueAtTime(targets[i], now + 0.85);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.028, now + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.7);
      osc.connect(g);
      g.connect(this.reverbNode);
      g.connect(this.dryBus);
      osc.start(now);
      osc.stop(now + 2.75);
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

  /** Synthesize soft 3D wing-flaps and distant wind-swept crow resonance for Act XV. */
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
