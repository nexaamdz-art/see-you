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

const playEnvelopeSynth = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    if (!window._envelopeAudioCtx) {
      window._envelopeAudioCtx = new AudioContext();
    }
    const ctx = window._envelopeAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // 1. Paper friction / rustle sound (Filtered white noise)
    const bufferSize = ctx.sampleRate * 0.7;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + 0.45);
    filter.Q.setValueAtTime(3.5, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.7);

    // 2. Envelope flap opening snap/pop (Oscillator + filtered noise)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.38);

    oscGain.gain.setValueAtTime(0.01, now + 0.12);
    oscGain.gain.linearRampToValueAtTime(0.25, now + 0.16);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now + 0.12);
    osc.stop(now + 0.45);

  } catch (e) {
    console.log("Audio play error:", e);
  }
};

const playEnvelopeSound = () => {
  try {
    const audio = new Audio(ENVELOPE_SOUND_PATH);
    audio.volume = 0.85;
    audio.play().catch(() => {
      playEnvelopeSynth();
    });
  } catch (e) {
    playEnvelopeSynth();
  }
};

const playWarmBellsSynth = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    if (!window._envelopeAudioCtx) {
      window._envelopeAudioCtx = new AudioContext();
    }
    const ctx = window._envelopeAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const frequencies = [523.25, 659.25, 783.99, 1046.50];

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.05);

      const startTime = now + index * 0.05;
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.3 / frequencies.length, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 2.1);
    });
  } catch (e) {
    console.log("Bell synth error:", e);
  }
};

const playInvitationSound = () => {
  try {
    const audio = new Audio(INVITATION_SOUND_PATH);
    audio.volume = 0.8;
    audio.play().catch(() => {
      playWarmBellsSynth();
    });
  } catch (e) {
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

      // Safety fallback if 'seeked' event is delayed
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

      if (progress > 0.005 && !hasPlayedSound.current) {
        hasPlayedSound.current = true;
        playEnvelopeSound();
      } else if (progress < 0.002) {
        hasPlayedSound.current = false;
      }

      if (currentTime >= INVITE_START && !hasPlayedInviteSound.current) {
        hasPlayedInviteSound.current = true;
        playInvitationSound();
      } else if (currentTime < INVITE_START - 0.5) {
        hasPlayedInviteSound.current = false;
      }

      if (invitation) {
        /*
          Invitation starts appearing at 5 seconds.
        */
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
