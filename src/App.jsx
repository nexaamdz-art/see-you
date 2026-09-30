import { useEffect, useRef } from "react";
import {
  VIDEO_PATH,
  CARD_IMAGE_PATH,
  INVITE,
  HINT,
} from "./config.js";
import { soundManager } from "./soundEffects.js";

const INVITE_START = 5;
const FLAP_OPEN_PROGRESS = 0.035;
const FLAP_CLOSE_PROGRESS = 0.015;

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

  const targetTimeRef = useRef(0);
  const isSeekingRef = useRef(false);
  const seekTimeoutRef = useRef(null);
  const hasPlayedFlapSoundRef = useRef(false);
  const hasPlayedBellsRef = useRef(false);

  useEffect(() => {
    const v = video.current;
    const t = track.current;
    const invitation = card.current;
    const scrollHint = hint.current;

    // Unlock audio context on initial interaction
    const unlockAudio = () => {
      soundManager.unlock();
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true, once: true });
    window.addEventListener("touchstart", unlockAudio, { passive: true, once: true });
    window.addEventListener("wheel", unlockAudio, { passive: true, once: true });
    window.addEventListener("keydown", unlockAudio, { passive: true, once: true });

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

      // Trigger paper friction and envelope flap sound effect once in sync with opening motion
      if (progress >= FLAP_OPEN_PROGRESS && !hasPlayedFlapSoundRef.current) {
        hasPlayedFlapSoundRef.current = true;
        soundManager.playEnvelopeFlapSound();
      } else if (progress <= FLAP_CLOSE_PROGRESS) {
        // Reset when envelope is fully closed at top
        hasPlayedFlapSoundRef.current = false;
        hasPlayedBellsRef.current = false;
      }

      // Trigger warm celebration bells when the invitation card emerges and ascends
      if (progress >= 0.72 && !hasPlayedBellsRef.current) {
        hasPlayedBellsRef.current = true;
        soundManager.playWarmBells();
      }

      // Update ambient magical music box melody smoothly
      soundManager.updateMusicProgress(progress);

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
      soundManager.unlock();

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
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("wheel", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      v.removeEventListener("loadedmetadata", handleLoadedMetadata);
      v.removeEventListener("seeked", handleSeeked);
    };
  }, []);

  const handleHintClick = () => {
    soundManager.unlock();
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
