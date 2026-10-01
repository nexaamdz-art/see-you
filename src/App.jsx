import { useEffect, useRef } from "react";
import {
  VIDEO_PATH,
  CARD_IMAGE_PATH,
  AUDIO_PATH,
  ENVELOPE_SOUND_PATH,
  REVEAL_SOUND_PATH,
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

export default function App() {
  const track = useRef(null);
  const video = useRef(null);
  const card = useRef(null);
  const hint = useRef(null);
  const audioRef = useRef(null);
  const envelopeAudioRef = useRef(null);
  const revealAudioRef = useRef(null);

  const hasPlayedFlapSoundRef = useRef(false);
  const hasPlayedRevealSoundRef = useRef(false);

  const targetTimeRef = useRef(0);
  const isSeekingRef = useRef(false);
  const seekTimeoutRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.65;

    const startAudio = () => {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    };

    // Attempt autoplay immediately
    startAudio();

    // If browser blocks autoplay, activate seamlessly on first user gesture
    const handleInteraction = () => {
      startAudio();
      if (envelopeAudioRef.current) {
        envelopeAudioRef.current.load();
      }
      if (revealAudioRef.current) {
        revealAudioRef.current.load();
      }
      removeInteractionListeners();
    };

    const removeInteractionListeners = () => {
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("scroll", handleInteraction);
      window.removeEventListener("wheel", handleInteraction);
    };

    window.addEventListener("pointerdown", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction, { passive: true });
    window.addEventListener("touchstart", handleInteraction, { passive: true });
    window.addEventListener("scroll", handleInteraction, { passive: true });
    window.addEventListener("wheel", handleInteraction, { passive: true });

    return () => {
      removeInteractionListeners();
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

      // Play paper friction & envelope flap opening sound effect once in sync with flap opening
      if (currentTime >= 0.35 && !hasPlayedFlapSoundRef.current) {
        hasPlayedFlapSoundRef.current = true;
        const envAudio = envelopeAudioRef.current;
        if (envAudio) {
          try {
            envAudio.currentTime = 0;
            envAudio.volume = 0.85;
            envAudio.play().catch(() => {});
          } catch {}
        }
      } else if (progress <= 0.02) {
        // Reset when user scrolls completely back to top
        hasPlayedFlapSoundRef.current = false;
      }

      // Play invitation reveal sound effect (sparkle chime) once when invitation appears
      if (currentTime >= INVITE_START && !hasPlayedRevealSoundRef.current) {
        hasPlayedRevealSoundRef.current = true;
        const revAudio = revealAudioRef.current;
        if (revAudio) {
          try {
            revAudio.currentTime = 0;
            revAudio.volume = 0.85;
            revAudio.play().catch(() => {});
          } catch {}
        }
      } else if (currentTime < INVITE_START - 0.4) {
        // Reset if user scrolls back up
        hasPlayedRevealSoundRef.current = false;
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
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    }
    if (track.current) {
      const scrollableHeight = track.current.offsetHeight - window.innerHeight;
      window.scrollTo({ top: scrollableHeight, behavior: "smooth" });
    }
  };

  return (
    <>
      {/* Background audio playing continuously across the entire website */}
      <audio
        ref={audioRef}
        src={AUDIO_PATH}
        loop
        preload="auto"
        playsInline
      />

      {/* Envelope flap opening & paper friction sound effect */}
      <audio
        ref={envelopeAudioRef}
        src={ENVELOPE_SOUND_PATH}
        preload="auto"
        playsInline
      />

      {/* Invitation reveal sound effect (magical warm bells / sparkle chime) */}
      <audio
        ref={revealAudioRef}
        src={REVEAL_SOUND_PATH}
        preload="auto"
        playsInline
      />

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
    </>
  );
}
