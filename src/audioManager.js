import { AUDIO_PATH, ENVELOPE_SOUND_PATH, REVEAL_SOUND_PATH } from "./config.js";

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.buffers = {
      bg: null,
      flap: null,
      reveal: null,
    };
    this.bgSource = null;
    this.htmlAudio = {
      bg: null,
      flap: null,
      reveal: null,
    };
    this.isUnlocked = false;
    this.isPlayingBg = false;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Create HTML5 audio elements as immediate fallback and iOS audio session anchor
    try {
      this.htmlAudio.bg = new Audio(AUDIO_PATH);
      this.htmlAudio.bg.loop = true;
      this.htmlAudio.bg.volume = 0.65;
      this.htmlAudio.bg.preload = "auto";
      this.htmlAudio.bg.setAttribute("playsinline", "true");

      this.htmlAudio.flap = new Audio(ENVELOPE_SOUND_PATH);
      this.htmlAudio.flap.volume = 0.85;
      this.htmlAudio.flap.preload = "auto";
      this.htmlAudio.flap.setAttribute("playsinline", "true");

      this.htmlAudio.reveal = new Audio(REVEAL_SOUND_PATH);
      this.htmlAudio.reveal.volume = 0.85;
      this.htmlAudio.reveal.preload = "auto";
      this.htmlAudio.reveal.setAttribute("playsinline", "true");
    } catch (e) {
      console.warn("HTML5 audio initialization failed:", e);
    }

    // Initialize Web Audio Context
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (AudioContextClass) {
      try {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // Preload and decode all audio files for zero-latency mobile playback
        this.loadBuffer(AUDIO_PATH, "bg");
        this.loadBuffer(ENVELOPE_SOUND_PATH, "flap");
        this.loadBuffer(REVEAL_SOUND_PATH, "reveal");
      } catch (err) {
        console.warn("Web Audio Context initialization error:", err);
      }
    }

    this.setupUnlockListeners();
  }

  async loadBuffer(url, key) {
    if (!this.ctx) return;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.ctx.decodeAudioData(
        arrayBuffer,
        (decoded) => {
          this.buffers[key] = decoded;
          // If user already touched screen and background music should be playing
          if (key === "bg" && this.isUnlocked && !this.isPlayingBg) {
            this.playBackgroundMusic();
          }
        },
        (decodeErr) => {
          console.warn(`Error decoding audio buffer for ${key}:`, decodeErr);
        }
      );
    } catch (fetchErr) {
      console.warn(`Error fetching audio buffer for ${key}:`, fetchErr);
    }
  }

  unlock() {
    if (this.isUnlocked) {
      // If already unlocked but background music stopped, ensure it plays
      if (!this.isPlayingBg) {
        this.playBackgroundMusic();
      }
      return;
    }

    // 1. Resume Web Audio Context if suspended
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }

      // Play a tiny silent buffer to warm up iOS hardware output
      try {
        const silentBuffer = this.ctx.createBuffer(1, 1, 22050);
        const silentSource = this.ctx.createBufferSource();
        silentSource.buffer = silentBuffer;
        silentSource.connect(this.ctx.destination);
        silentSource.start(0);
      } catch {}
    }

    // 2. Play HTML5 audio to establish iOS audio session
    if (this.htmlAudio.bg) {
      const playPromise = this.htmlAudio.bg.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.isUnlocked = true;
            this.isPlayingBg = true;
          })
          .catch(() => {
            // If HTML5 audio was blocked, Web Audio or next gesture will retry
          });
      }
    }

    if (this.ctx && this.ctx.state === "running") {
      this.isUnlocked = true;
      this.playBackgroundMusic();
    }
  }

  setupUnlockListeners() {
    // Attempt immediate autoplay (works on desktops & some Android browsers)
    this.unlock();

    // Use touch and click gestures ONLY (never scroll or wheel, which browsers reject as non-gestures)
    const handleGesture = () => {
      this.unlock();
      if (this.isUnlocked) {
        window.removeEventListener("touchstart", handleGesture, true);
        window.removeEventListener("touchend", handleGesture, true);
        window.removeEventListener("pointerdown", handleGesture, true);
        window.removeEventListener("click", handleGesture, true);
        window.removeEventListener("keydown", handleGesture, true);
      }
    };

    window.addEventListener("touchstart", handleGesture, { capture: true, passive: true });
    window.addEventListener("touchend", handleGesture, { capture: true, passive: true });
    window.addEventListener("pointerdown", handleGesture, { capture: true, passive: true });
    window.addEventListener("click", handleGesture, { capture: true, passive: true });
    window.addEventListener("keydown", handleGesture, { capture: true, passive: true });
  }

  playBackgroundMusic() {
    // If Web Audio buffer is available and context is running, use Web Audio for seamless mobile playback
    if (this.ctx && this.ctx.state === "running" && this.buffers.bg) {
      if (!this.bgSource) {
        try {
          const source = this.ctx.createBufferSource();
          source.buffer = this.buffers.bg;
          source.loop = true;

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.65, this.ctx.currentTime);

          source.connect(gain);
          gain.connect(this.masterGain);

          source.start(0);
          this.bgSource = source;
          this.isPlayingBg = true;

          // Mute or pause HTML5 audio so they don't double play
          if (this.htmlAudio.bg) {
            this.htmlAudio.bg.pause();
          }
          return;
        } catch (e) {
          console.warn("Web Audio background music start error:", e);
        }
      } else {
        return; // Already playing
      }
    }

    // Otherwise use HTML5 audio fallback
    if (this.htmlAudio.bg && this.htmlAudio.bg.paused) {
      this.htmlAudio.bg
        .play()
        .then(() => {
          this.isPlayingBg = true;
        })
        .catch(() => {});
    }
  }

  playFlapSound() {
    this.unlock();

    // 1. Try Web Audio (instant, no user activation needed once unlocked)
    if (this.ctx && this.ctx.state === "running" && this.buffers.flap) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers.flap;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.9, this.ctx.currentTime);

        source.connect(gain);
        gain.connect(this.masterGain);

        source.start(0);
        return;
      } catch (err) {
        console.warn("Web audio flap sound error:", err);
      }
    }

    // 2. HTML5 audio fallback
    if (this.htmlAudio.flap) {
      try {
        this.htmlAudio.flap.currentTime = 0;
        this.htmlAudio.flap.play().catch(() => {});
      } catch {}
    }
  }

  playRevealSound() {
    this.unlock();

    // 1. Try Web Audio (instant, no user activation needed once unlocked)
    if (this.ctx && this.ctx.state === "running" && this.buffers.reveal) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers.reveal;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.9, this.ctx.currentTime);

        source.connect(gain);
        gain.connect(this.masterGain);

        source.start(0);
        return;
      } catch (err) {
        console.warn("Web audio reveal sound error:", err);
      }
    }

    // 2. HTML5 audio fallback
    if (this.htmlAudio.reveal) {
      try {
        this.htmlAudio.reveal.currentTime = 0;
        this.htmlAudio.reveal.play().catch(() => {});
      } catch {}
    }
  }
}

export const audioManager = new AudioManager();
