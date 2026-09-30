import { useCallback, useEffect, useRef } from "react";
import {
  VIDEO_PATH,
  CARD_IMAGE_PATH,
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

  const updateScene = useCallback((progress) => {
    const v = video.current;
    const invitation = card.current;
    const scrollHint = hint.current;

    if (!v || !invitation) return;

    const duration = v.duration || 6;

    /*
      Scroll = video timeline
      0%   -> 0s
      50%  -> 3s
      80%  -> 4.8s
      83.33% -> 5s
      100% -> 6s
    */
    const currentTime = progress * duration;

    if (Math.abs(v.currentTime - currentTime) > 0.01) {
      v.currentTime = Math.min(
        currentTime,
        Math.max(0, duration - 0.02)
      );
    }

    /*
      Invitation starts appearing at 5 seconds.
    */
    const inviteProgress = clamp(
      (currentTime - INVITE_START) /
        Math.max(0.01, duration - INVITE_START)
    );

    const reveal = ease(inviteProgress);

    invitation.style.opacity = reveal;

    /*
      Small movement while appearing.
    */
    const translateY = (1 - reveal) * 35;

    const scale = 0.92 + reveal * 0.08;

    invitation.style.transform = `
      translate(-50%, -50%)
      translateY(${translateY}px)
      scale(${scale})
    `;

    /*
      Small floating movement.
    */
    const floatAmount =
      Math.sin(inviteProgress * Math.PI * 4) *
      8 *
      reveal;

    invitation.style.setProperty(
      "--float-y",
      `${floatAmount}px`
    );

    /*
      Hide scroll hint gradually.
    */
    if (scrollHint) {
      scrollHint.style.opacity = String(
        1 - clamp(progress * 8)
      );
    }
  }, []);

  useEffect(() => {
    const v = video.current;
    const t = track.current;

    if (!v || !t) return;

    let frame = null;

    const handleScroll = () => {
      if (frame !== null) return;

      frame = requestAnimationFrame(() => {
        frame = null;

        const rect = t.getBoundingClientRect();

        const scrollableHeight =
          t.offsetHeight - window.innerHeight;

        const progress = clamp(
          -rect.top / Math.max(1, scrollableHeight)
        );

        updateScene(progress);
      });
    };

    const handleResize = () => {
      handleScroll();
    };

    const handleLoadedMetadata = () => {
      v.pause();
      v.currentTime = 0;
      updateScene(0);
    };

    /*
      Make sure the video NEVER starts by itself.
    */
    v.pause();
    v.currentTime = 0;

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    window.addEventListener("resize", handleResize);

    v.addEventListener(
      "loadedmetadata",
      handleLoadedMetadata
    );

    handleScroll();

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }

      window.removeEventListener(
        "scroll",
        handleScroll
      );

      window.removeEventListener(
        "resize",
        handleResize
      );

      v.removeEventListener(
        "loadedmetadata",
        handleLoadedMetadata
      );
    };
  }, [updateScene]);

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

        <div
          ref={hint}
          className="scroll-hint"
          aria-hidden="true"
        >
          {HINT}
        </div>
      </section>
    </main>
  );
}
