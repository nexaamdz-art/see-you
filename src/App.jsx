import { useEffect, useRef } from "react";
import {
  VIDEO_PATH,
  CARD_IMAGE_PATH,
  INVITATION_SOUND_PATH,
  ENVELOPE_SOUND_PATH,
  INVITE,
  HINT,
} from "./config.js";

const INVITE_START = 5;

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const ease = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

// Global audio elements preloaded
let envelopeAudio = null;
let inviteAudio = null;

const initAudioElements = () => {
  if (typeof window === "undefined") return;
  if (!envelopeAudio) {
    envelopeAudio = new Audio(ENVELOPE_SOUND_PATH);
    envelopeAudio.preload = "auto";
    envelopeAudio.volume = 1.0;
  }
  if (!inviteAudio) {
    inviteAudio = new Audio(INVITATION_SOUND_PATH);
    inviteAudio.preload = "auto";
    inviteAudio.volume = 1.0;
  }
};

export const unlockAudio = () => {
  try {
    initAudioElements();
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      if (!window._envelopeAudioCtx) {
        window._envelopeAudioCtx = new AudioContext();
      }
      if (window._envelopeAudioCtx.state === "suspended") {
        window._envelopeAudioCtx.resume();
      }
    }
  } catch (e) {
    console.warn("Audio unlock note:", e);
  }
};

const playEnvelopeSynth = async () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!window._envelopeAudioCtx) {
      window._envelopeAudioCtx = new AudioContext();
    }
    const ctx = window._envelopeAudioCtx;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(1.0, now);
    master.connect(ctx.destination);

    // 1. Tactile envelope flap seal release pop
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = "triangle";
    popOsc.frequency.setValueAtTime(320, now);
    popOsc.frequency.exponentialRampToValueAtTime(60, now + 0.16);
    popGain.gain.setValueAtTime(0.55, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    popOsc.connect(popGain);
    popGain.connect(master);
    popOsc.start(now);
    popOsc.stop(now + 0.2);

    // 2. Paper sliding friction & rustle
    const bufferSize = Math.floor(ctx.sampleRate * 0.9);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1);
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter1 = ctx.createBiquadFilter();
    filter1.type = "bandpass";
    filter1.frequency.setValueAtTime(1500, now);
    filter1.frequency.exponentialRampToValueAtTime(2900, now + 0.45);
    filter1.Q.setValueAtTime(2.0, now);

    const filter2 = ctx.createBiquadFilter();
    filter2.type = "bandpass";
    filter2.frequency.setValueAtTime(3800, now);
    filter2.Q.setValueAtTime(2.6, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.9, now + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    whiteNoise.connect(filter1);
    whiteNoise.connect(filter2);
    filter1.connect(gainNode);
    filter2.connect(gainNode);
    gainNode.connect(master);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.9);
  } catch (e) {
    console.error("Envelope synth error:", e);
  }
};

const playEnvelopeSound = () => {
  unlockAudio();
  initAudioElements();

  let played = false;
  if (envelopeAudio) {
    try {
      envelopeAudio.currentTime = 0;
      envelopeAudio.volume = 1.0;
      const playPromise = envelopeAudio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            played = true;
          })
          .catch((err) => {
            console.warn("Audio file blocked, using synthesized paper effect:", err);
            playEnvelopeSynth();
          });
      }
    } catch {
      playEnvelopeSynth();
    }
  } else {
    playEnvelopeSynth();
  }

  // Backup trigger if audio element didn't produce sound quickly
  setTimeout(() => {
    if (!played && envelopeAudio && envelopeAudio.paused) {
      playEnvelopeSynth();
    }
  }, 100);
};

const playWarmBellsSynth = async () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!window._envelopeAudioCtx) {
      window._envelopeAudioCtx = new AudioContext();
    }
    const ctx = window._envelopeAudioCtx;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const frequencies = [523.25, 659.25, 783.99, 1046.5];

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.05);

      const startTime = now + index * 0.05;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.5 / frequencies.length, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 2.3);
    });
  } catch (e) {
    console.error("Bell synth error:", e);
  }
};

const playInvitationSound = () => {
  unlockAudio();
  initAudioElements();

  if (inviteAudio) {
    try {
      inviteAudio.currentTime = 0;
      inviteAudio.volume = 1.0;
      const playPromise = inviteAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          playWarmBellsSynth();
        });
      }
    } catch {
      playWarmBellsSynth();
    }
  } else {
    playWarmBellsSynth();
  }
};

export default function App() {
  const track = useRef(null);
  const video = useRef(null);
  const card = useRef(null);
  const hint = useRef(null);

  const targetTimeRef = useRef(0);
  const isSeekingRef = useRef(false);
  const seekTimeoutRef = useRef(null);
  const hasPlayedSound = useRef(false);
  const hasPlayedInviteSound = useRef(false);

  useEffect(() => {
    initAudioElements();

    const handleFirstGesture = () => {
      unlockAudio();
    };

    window.addEventListener("pointerdown", handleFirstGesture, { passive: true });
    window.addEventListener("touchstart", handleFirstGesture, { passive: true });
    window.addEventListener("click", handleFirstGesture, { passive: true });
    window.addEventListener("wheel", handleFirstGesture, { passive: true });
    window.addEventListener("keydown", handleFirstGesture, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("touchstart", handleFirstGesture);
      window.removeEventListener("click", handleFirstGesture);
      window.removeEventListener("wheel", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
    };
  }, []);

  useEffect(() => {
    const v = video.current;
    const t = track.current;
    const invitation = card.current;
    const scrollHint = hint.current;

    if (!v || !t) return;

    const performSeek = () => {
      if (!v || isSeekingRef.current) return;

      const diff = Math.abs(v.currentTime - targetTimeRef.current);
      if (diff < 0.02) return;

      isSeekingRef.current = true;
      const duration = v.duration || 6;
      const target = Math.min(
        targetTimeRef.current,
        Math.max(0, duration - 0.02)
      );

      if (typeof v.fastSeek === "function") {
        v.fastSeek(target);
      } else {
        v.currentTime = target;
      }

      clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = setTimeout(() => {
        isSeekingRef.current = false;
        performSeek();
      }, 70);
    };

    const handleSeeked = () => {
      isSeekingRef.current = false;
      clearTimeout(seekTimeoutRef.current);
      performSeek();
    };

    let frame = null;

    const updateScene = (progress) => {
      const duration = v.duration || 6;
      const currentTime = progress * duration;
      targetTimeRef.current = currentTime;

      performSeek();

      // Trigger envelope flap opening & paper friction sound on initial scroll
      if (progress > 0.005 && !hasPlayedSound.current) {
        hasPlayedSound.current = true;
        playEnvelopeSound();
      } else if (progress < 0.002) {
        hasPlayedSound.current = false;
      }

      // Trigger invitation appearance sound
      if (currentTime >= INVITE_START && !hasPlayedInviteSound.current) {
        hasPlayedInviteSound.current = true;
        playInvitationSound();
      } else if (currentTime < INVITE_START - 0.5) {
        hasPlayedInviteSound.current = false;
      }

      if (invitation) {
        const inviteProgress = clamp(
          (currentTime - INVITE_START) /
            Math.max(0.01, duration - INVITE_START)
        );

        const reveal = ease(inviteProgress);

        invitation.style.opacity = reveal;

        const translateY = (1 - reveal) * 35;
        const scale = 0.92 + reveal * 0.08;

        invitation.style.transform = `
          translate(-50%, -50%)
          translateY(${translateY}px)
          scale(${scale})
        `;

        const floatAmount =
          Math.sin(inviteProgress * Math.PI * 4) * 8 * reveal;

        invitation.style.setProperty("--float-y", `${floatAmount}px`);
      }

      if (scrollHint) {
        scrollHint.style.opacity = String(1 - clamp(progress * 8));
      }
    };

    const handleScroll = () => {
      if (frame !== null) return;

      frame = requestAnimationFrame(() => {
        frame = null;

        const rect = t.getBoundingClientRect();
        const scrollableHeight = t.offsetHeight - window.innerHeight;
        const progress = clamp(-rect.top / Math.max(1, scrollableHeight));

        updateScene(progress);
      });
    };

    const handleResize = () => {
      handleScroll();
    };

    const handleLoadedMetadata = () => {
      v.pause();
      v.currentTime = 0;
      handleScroll();
    };

    v.pause();
    v.currentTime = 0;

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    v.addEventListener("loadedmetadata", handleLoadedMetadata);
    v.addEventListener("seeked", handleSeeked);

    handleScroll();

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      clearTimeout(seekTimeoutRef.current);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      v.removeEventListener("loadedmetadata", handleLoadedMetadata);
      v.removeEventListener("seeked", handleSeeked);
    };
  }, []);

  const handleHintClick = () => {
    unlockAudio();
    if (!hasPlayedSound.current) {
      hasPlayedSound.current = true;
      playEnvelopeSound();
    }
    if (track.current) {
      const scrollableHeight = track.current.offsetHeight - window.innerHeight;
      window.scrollTo({ top: scrollableHeight, behavior: "smooth" });
    }
  };

  return (
    <main className="track" ref={track}>
      <section className="stage">
        <video
          ref={video}
          className="video"
          src={VIDEO_PATH}
          muted
          playsInline
          preload="auto"
        />

        <div
          ref={card}
          className="invitation"
          aria-hidden="true"
        >
          <div className="invitation-inner">
            <div className="invitation-floating-card">
              <img
                src={CARD_IMAGE_PATH}
                alt=""
              />

              <div className="invitation-copy">
                <p className="invitation-kicker">
                  {INVITE.kicker}
                </p>

                <h1 className="invitation-name">
                  {INVITE.name}
                </h1>

                <p className="invitation-line">
                  {INVITE.line}
                </p>

                <p className="invitation-date">
                  {INVITE.date}
                </p>

                <p className="invitation-details">
                  {INVITE.time}
                  <br />
                  {INVITE.place}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          ref={hint}
          className="scroll-hint"
          onClick={handleHintClick}
          aria-label="Scroll to open invitation"
        >
          {HINT}
        </button>
      </section>
    </main>
  );
}
