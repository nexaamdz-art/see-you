
import { useEffect, useRef, useState } from "react";
import { VIDEO_PATH, CARD_IMAGE_PATH, INVITE } from "./config.js";

const INVITE_START = 5; // تظهر الدعوة عند الثانية الخامسة

export default function App() {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      setReady(true);

      video.currentTime = 0;

      video.play().catch(() => {
        // المتصفح قد يمنع التشغيل التلقائي في بعض الحالات
      });
    };

    const handleTimeUpdate = () => {
      if (video.currentTime >= INVITE_START) {
        setShowInvite(true);
      }
    };

    const handleEnded = () => {
      setShowInvite(true);
    };

    video.addEventListener("loadeddata", handleLoaded);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    if (video.readyState >= 2) {
      handleLoaded();
    }

    return () => {
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <main className="page">
      <section className="stage" aria-label="Birthday invitation">

        {/* الفيديو */}
        <video
          ref={videoRef}
          src={VIDEO_PATH}
          muted
          playsInline
          autoPlay
          preload="auto"
          aria-label="Invitation video"
        />

        {/* الدعوة تظهر فوق الفيديو عند الثانية 5 */}
        <div
          className={`invitation-overlay ${
            showInvite ? "show" : ""
          }`}
          aria-hidden={!showInvite}
        >
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

        {/* شاشة التحميل */}
        <div className={`loader ${ready ? "off" : ""}`}>
          ✉
        </div>

      </section>
    </main>
  );
}
