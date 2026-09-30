import { useEffect, useRef, useState } from "react";
import { VIDEO_PATH, CARD_IMAGE_PATH, INVITE } from "./config.js";

const INVITE_START = 5;

export default function App() {
  const videoRef = useRef(null);
  const stageRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const stage = stageRef.current;

    if (!video || !stage) return;

    let startedOnce = false;

    const startExperience = () => {
      if (startedOnce) return;

      startedOnce = true;
      setStarted(true);

      video.play().catch(() => {
        // بعض المتصفحات تمنع التشغيل حتى يحدث تفاعل من المستخدم
      });
    };

    const handleLoaded = () => {
      setReady(true);

      // لا يبدأ الفيديو تلقائيًا
      video.pause();
      video.currentTime = 0;
    };

    const handleTimeUpdate = () => {
      if (video.currentTime >= INVITE_START) {
        setShowInvite(true);
      }
    };

    const handleEnded = () => {
      setShowInvite(true);
    };

    /*
     * على الهاتف:
     * أول سحب يبدأ التجربة.
     */
    const handleTouchStart = () => {
      startExperience();
    };

    /*
     * على الكمبيوتر:
     * أول Scroll يبدأ الفيديو.
     */
    const handleWheel = () => {
      startExperience();
    };

    video.addEventListener("loadeddata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    stage.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });

    stage.addEventListener("wheel", handleWheel, {
      passive: true,
    });

    if (video.readyState >= 2) {
      handleLoaded();
    }

    return () => {
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);

      stage.removeEventListener("touchstart", handleTouchStart);
      stage.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <main className="page">
      <section
        ref={stageRef}
        className={`stage ${started ? "started" : ""}`}
        aria-label="Birthday invitation"
      >
        {/* الفيديو */}
        <video
          ref={videoRef}
          src={VIDEO_PATH}
          muted
          playsInline
          preload="auto"
          aria-label="Invitation video"
        />

        {/* الدعوة */}
        <div
          className={`invitation-overlay ${
            showInvite ? "show" : ""
          }`}
          aria-hidden={!showInvite}
        >
          <div className="floating-invitation">
            <img
              src={CARD_IMAGE_PATH}
              alt="Birthday invitation"
              decoding="async"
            />

            <div className="invite-text">
              <p className="kicker">{INVITE.kicker}</p>

              <p className="name">{INVITE.name}</p>

              <p className="line">{INVITE.line}</p>

              <i className="rule" />

              <p className="info">{INVITE.date}</p>
              <p className="info">{INVITE.time}</p>
              <p className="info">{INVITE.place}</p>
            </div>
          </div>
        </div>

        {/* رسالة البداية */}
        {!started && ready && (
          <div className="start-hint">
            <span>اسحب للبدء</span>
            <i />
          </div>
        )}

        {/* التحميل */}
        <div className={`loader ${ready ? "off" : ""}`}>
          ✉
        </div>
      </section>
    </main>
  );
}
