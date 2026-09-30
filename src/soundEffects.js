import { ENVELOPE_SOUND_PATH, MUSIC_PATH, WARM_BELLS_PATH } from "./config.js";

/**
 * EnvelopeSoundManager
 * Manages paper friction, envelope flap opening, soft warm bells,
 * and the magical music box melody without any harsh ringing sounds.
 */
class EnvelopeSoundManager {
  constructor() {
    this.audioCtx = null;
    this.flapBuffer = null;
    this.bellsBuffer = null;

    this.flapAudioElement = null;
    this.bellsAudioElement = null;
    this.musicAudioElement = null;

    this.isMuted = false;
    this.isUnlocked = false;
    this.listeners = new Set();

    if (typeof window !== "undefined") {
      try {
        this.flapAudioElement = new Audio(ENVELOPE_SOUND_PATH);
        this.flapAudioElement.preload = "auto";
        this.flapAudioElement.volume = 0.85;

        this.bellsAudioElement = new Audio(WARM_BELLS_PATH);
        this.bellsAudioElement.preload = "auto";
        this.bellsAudioElement.volume = 0.65;

        this.musicAudioElement = new Audio(MUSIC_PATH);
        this.musicAudioElement.preload = "auto";
        this.musicAudioElement.loop = true;
        this.musicAudioElement.volume = 0;
      } catch (e) {
        // Safe fallback
      }
    }
  }

  getAudioContext() {
    if (!this.audioCtx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    return this.audioCtx;
  }

  async loadAudioBuffers() {
    if (typeof window === "undefined") return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Load flap buffer
    if (!this.flapBuffer) {
      fetch(ENVELOPE_SOUND_PATH)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((buf) => {
          if (buf) {
            ctx.decodeAudioData(buf, (decoded) => {
              this.flapBuffer = decoded;
            });
          }
        })
        .catch(() => {});
    }

    // Load bells buffer
    if (!this.bellsBuffer) {
      fetch(WARM_BELLS_PATH)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((buf) => {
          if (buf) {
            ctx.decodeAudioData(buf, (decoded) => {
              this.bellsBuffer = decoded;
            });
          }
        })
        .catch(() => {});
    }
  }

  unlock() {
    if (this.isUnlocked) return;
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    this.loadAudioBuffers();

    if (this.flapAudioElement) this.flapAudioElement.load();
    if (this.bellsAudioElement) this.bellsAudioElement.load();
    if (this.musicAudioElement) this.musicAudioElement.load();

    this.isUnlocked = true;
  }

  /**
   * Synthesize warm, soft celebration bells in real-time using rounded sine waves.
   * Completely excludes harsh high-frequency ringing or piercing resonance.
   */
  synthesizeWarmBells(ctx) {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Warm chord notes (E4, G#4, B4, E5) - soothing and velvety
      const chord = [
        { f: 329.63, delay: 0.0, gain: 0.28 },
        { f: 415.30, delay: 0.18, gain: 0.24 },
        { f: 493.88, delay: 0.36, gain: 0.22 },
        { f: 659.25, delay: 0.58, gain: 0.30 },
      ];

      chord.forEach(({ f, delay, gain: noteGain }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // Low-pass filter to guarantee NO harsh ringing
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1400, now + delay);
        filter.Q.setValueAtTime(0.7, now + delay);

        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + delay);

        const startTime = now + delay;
        const duration = 2.2;

        // Soft attack (prevents click/sharp attack), smooth decay
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(noteGain, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } catch (e) {
      // Audio fallback
    }
  }

  /**
   * Synthesizes soft paper friction as fallback.
   */
  synthesizePaperFlap(ctx) {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const duration = 1.6;
      const bufferSize = ctx.sampleRate * duration;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.35;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(2800, now + 0.4);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 1.0);
      filter.Q.setValueAtTime(2.0, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.4, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.6, now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
    } catch (e) {
      // Audio fallback
    }
  }

  /**
   * Plays the paper friction & envelope flap opening sound.
   */
  playEnvelopeFlapSound() {
    if (this.isMuted) return;

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate([16, 32, 22]);
      } catch (e) {}
    }

    const ctx = this.getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      if (this.flapBuffer) {
        try {
          const source = ctx.createBufferSource();
          source.buffer = this.flapBuffer;
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0.9, ctx.currentTime);
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          source.start(0);
          return;
        } catch (err) {}
      } else {
        this.synthesizePaperFlap(ctx);
      }
    }

    if (this.flapAudioElement) {
      try {
        this.flapAudioElement.currentTime = 0;
        this.flapAudioElement.play().catch(() => {});
      } catch (err) {}
    }
  }

  /**
   * Plays warm, soft celebration bells (no harsh ringing) when the invitation card emerges.
   */
  playWarmBells() {
    if (this.isMuted) return;

    const ctx = this.getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      if (this.bellsBuffer) {
        try {
          const source = ctx.createBufferSource();
          source.buffer = this.bellsBuffer;
          const gainNode = ctx.createGain();
          gainNode.gain.setValueAtTime(0.75, ctx.currentTime);
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          source.start(0);
          return;
        } catch (err) {}
      } else {
        this.synthesizeWarmBells(ctx);
      }
    }

    if (this.bellsAudioElement) {
      try {
        this.bellsAudioElement.currentTime = 0;
        this.bellsAudioElement.play().catch(() => {});
      } catch (err) {}
    }
  }

  /**
   * Controls the magical music box melody smoothly as user scrolls.
   */
  updateMusicProgress(progress) {
    if (this.isMuted || !this.musicAudioElement) return;

    if (progress > 0.25) {
      if (this.musicAudioElement.paused) {
        this.musicAudioElement.play().catch(() => {});
      }
      // Smooth fade-in: gradually rises to comfortable 0.50 volume
      const musicVol = Math.min(0.50, Math.max(0, (progress - 0.25) * 0.75));
      this.musicAudioElement.volume = musicVol;
    } else {
      if (!this.musicAudioElement.paused && this.musicAudioElement.volume <= 0.05) {
        this.musicAudioElement.pause();
      } else {
        this.musicAudioElement.volume = Math.max(0, this.musicAudioElement.volume * 0.85);
      }
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.flapAudioElement) this.flapAudioElement.muted = muted;
    if (this.bellsAudioElement) this.bellsAudioElement.muted = muted;
    if (this.musicAudioElement) {
      if (muted) {
        this.musicAudioElement.pause();
      } else {
        this.musicAudioElement.muted = false;
      }
    }
    this.notify();
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    if (!this.isMuted) {
      this.unlock();
    }
    return this.isMuted;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.isMuted));
  }
}

export const soundManager = new EnvelopeSoundManager();
