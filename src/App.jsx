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

const ease = (t) => t * t * (3 - 2 * t);

export default function App() {
  const track = useRef(null);
  const video = useRef(null);
  const card = useRef(null);
  const hint = useRef(null);

  const raf = useRef(null);
  const targetProgress = useRef(0);
  const lastProgress = useRef(-1);

  /*
   * تحديث المشهد بالكامل من الـ scroll.
   *
   * scroll progress:
   * 0    -> بداية الفيديو
   * 1    -> نهاية الفيديو
   */
  const updateScene = useCallback((progress) => {
    const v = video.current;
    const invitation = card.current;
    const scrollHint = hint.current;

    if (!v || !invitation) return;

    progress = clamp(progress);

    /*
     * نستخدم مدة الفيديو الحقيقية.
     * fallback فقط في حالة أن metadata لم تُحمّل بعد.
     */
    const duration =
      Number.isFinite(v.duration) && v.duration > 0
        ? v.duration
        : 6;

    /*
     * SCROLL → VIDEO TIMELINE
     *
     * 0%     = 0s
     * 50%    = 3s
     * 83.33% = 5s
     * 100%   = 6s
     */
    const currentTime = clamp(
      progress * duration,
      0,
      duration
    );

    /*
     * الفيديو لا يتم تشغيله.
     * الـ scroll هو الذي يتحكم في currentTime.
     */
    if (
      Math.abs(v.currentTime - currentTime) > 0.015 &&
      v.readyState >= 1
    ) {
      v.currentTime = currentTime;
    }

    /*
     * الدعوة تبدأ بالظهور عند الثانية 5.
     *
     * إذا كان الفيديو 6 ثوانٍ:
     * 5s -> 0
     * 5.5s -> 0.5
     * 6s -> 1
     */
    const inviteProgress = clamp(
      (currentTime - INVITE_START) /
        Math.max(0.001, duration - INVITE_START)
    );

    const reveal = ease(inviteProgress);

    /*
     * قبل الثانية 5:
     * الدعوة مخفية تمامًا.
     */
    invitation.style.opacity = reveal;

    /*
     * دخول سينمائي:
     * تبدأ من الأسفل قليلًا ثم تستقر.
     */
    const translateY = (1 - reveal) * 35;
    const scale = 0.92 + reveal * 0.08;

    invitation.style.transform =
      `translate(-50%, -50%) ` +
      `translateY(${translateY}px) ` +
      `scale(${scale})`;

    /*
     * حركة float إضافية مرتبطة بالـ timeline.
     * CSS يقوم أيضًا بحركة float خفيفة مستمرة.
     */
    const floatAmount =
      Math.sin(inviteProgress * Math.PI * 4) *
      5 *
      reveal;

    invitation.style.setProperty(
      "--scroll-float-y",
      `${floatAmount}px`
    );

    /*
     * إخفاء تعليمات SCROLL TO OPEN
     * تدريجيًا بمجرد بدء التفاعل.
     */
    if (scrollHint) {
      const hintOpacity = 1 - clamp(progress * 8);

      scrollHint.style.opacity = hintOpacity;
    }
  }, []);

  /*
   * حساب scroll progress الحقيقي.
   */
  const calculateProgress = useCallback(() => {
    const element = track.current;

    if (!element) return;

    const rect = element.getBoundingClientRect();

    /*
     * المسافة التي يمكن أن يتحرك فيها الـ track
     * أثناء وجود الـ sticky stage.
     */
    const scrollDistance =
      element.offsetHeight - window.innerHeight;

    if (scrollDistance <= 0) {
      targetProgress.current = 0;
      return;
    }

    /*
     * عندما يكون top = 0:
     * progress = 0
     *
     * عندما يصل scroll إلى نهاية track:
     * progress = 1
     */
    const progress = clamp(
      -rect.top / scrollDistance
    );

    targetProgress.current = progress;
  }, []);

  /*
   * RAF:
   * لا نريد تشغيل updateScene عشرات المرات
   * مباشرة مع كل scroll event.
   */
  const requestUpdate = useCallback(() => {
    if (raf.current !== null) return;

    raf.current = requestAnimationFrame(() => {
      raf.current = null;

      calculateProgress();

      const progress = targetProgress.current;

      /*
       * لا نعيد كتابة currentTime بدون داعٍ.
       */
      if (
        Math.abs(progress - lastProgress.current) >
        0.0001
      ) {
        lastProgress.current = progress;
        updateScene(progress);
      }
    });
  }, [calculateProgress, updateScene]);

  /*
   * تهيئة الفيديو.
   */
  useEffect(() => {
    const v = video.current;

    if (!v) return;

    /*
     * مهم جدًا:
     * الفيديو ليس فيديو autoplay.
     * هو مجرد frame source للـ scroll timeline.
     */
    v.pause();
    v.currentTime = 0;

    const handleMetadata = () => {
      v.pause();
      v.currentTime = 0;
      updateScene(targetProgress.current);
    };

    const handleScroll = () => {
      requestUpdate();
    };

    const handleResize = () => {
      requestUpdate();
    };

    v.addEventListener(
      "loadedmetadata",
      handleMetadata
    );

    window.addEventListener(
      "scroll",
      handleScroll,
      { passive: true }
    );

    window.addEventListener(
      "resize",
      handleResize
    );

    /*
     * الحالة الأولى.
     */
    requestUpdate();

    return () => {
      v.removeEventListener(
        "loadedmetadata",
        handleMetadata
      );

      window.removeEventListener(
        "scroll",
        handleScroll
      );

      window.removeEventListener(
        "resize",
        handleResize
      );

      if (raf.current !== null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
    };
  }, [requestUpdate, updateScene]);

  return (
    <main ref={track} className="track">
      <section className="stage">
        {/*
         * VIDEO BACKGROUND
         *
         * لا autoplay
         * لا controls
         * لا loop
         * الـ scroll هو الذي يتحكم فيه.
         */}
        <video
          ref={video}
          src={VIDEO_PATH}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
        />

        {/*
         * INVITATION OVERLAY
         */}
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

            <div className="invite-text">
              <div className="kicker">
                {INVITE.kicker}
              </div>

              <div className="name">
                {INVITE.name}
              </div>

              <div className="line">
                {INVITE.line}
              </div>

              <span className="rule" />

              <div className="info">
                <div>{INVITE.date}</div>
                <div>{INVITE.time}</div>
                <div>{INVITE.place}</div>
              </div>
            </div>
          </div>
        </div>

        {/*
         * SCROLL HINT
         */}
        <div
          ref={hint}
          className="scroll-hint"
        >
          <span>{HINT}</span>
          <i />
        </div>
      </section>
    </main>
  );
}
