import { useCallback, useEffect, useRef, useState } from "react";
import { VIDEO_PATH, CARD_IMAGE_PATH, INVITE, HINT } from "./config.js";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const VIDEO_END = 0.8; // 0–80% scrubs the video, 80–100% reveals the invitation

export default function App() {
  const track = useRef(null), video = useRef(null), hint = useRef(null);
  const wash = useRef(null), card = useRef(null), text = useRef(null);
  const [ready, setReady] = useState(false);

  // Applies styles directly (no React state per frame).
  const onFrame = useCallback((p) => {
    hint.current.style.opacity = 0.8 * (1 - clamp(p / 0.05));
    wash.current.style.opacity = ease(clamp((p - 0.7) / 0.18));
    const r = ease(clamp((p - 0.84) / 0.16));
    card.current.style.opacity = r;
    card.current.style.transform = `translate(-50%,-50%) translateY(${(1 - r) * 26}px) scale(${0.94 + 0.06 * r})`;
    text.current.style.opacity = clamp((r - 0.55) / 0.45);
  }, []);

  useEffect(() => {
    const t = track.current, v = video.current;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0, cur = 0, last = -1, raf = 0, started = false;
    const progress = () => clamp(-t.getBoundingClientRect().top / Math.max(1, t.offsetHeight - innerHeight));
    const onScroll = () => (target = progress());
    const tick = () => {
      cur += (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.0002) cur = target;
      const time = clamp(cur / VIDEO_END) * Math.max(0, (v.duration || 0) - 0.05);
      if (Math.abs(time - last) > 0.012) { v.currentTime = time; last = time; }
      onFrame(cur);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (started) return;
      started = true; v.pause(); setReady(true);
      if (reduce) return onFrame(1);
      target = cur = progress();
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onScroll);
      raf = requestAnimationFrame(tick);
    };
    const onLoaded = () => { v.currentTime = 0; setTimeout(start, 400); };
    v.addEventListener("loadeddata", onLoaded);
    if (v.readyState >= 2) onLoaded();
    const fallback = setTimeout(start, 6000);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(fallback);
      v.removeEventListener("loadeddata", onLoaded);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [onFrame]);

  return (
    <main className="track" ref={track}>
      <div className={`loader ${ready ? "off" : ""}`} role="status">✉</div>
      <section className="stage" aria-label="Birthday invitation">
        <video ref={video} src={VIDEO_PATH} muted playsInline preload="auto" aria-hidden="true" tabIndex={-1} />
        <div className="wash" ref={wash} />
        <div className="card" ref={card}>
          <img src={CARD_IMAGE_PATH} alt="Birthday invitation" decoding="async" />
          <div className="invite" ref={text}>
            <p className="kicker">{INVITE.kicker}</p>
            <p className="name">{INVITE.name}</p>
            <p className="line">{INVITE.line}</p>
            <i className="rule" />
            <p className="info">{INVITE.date}</p>
            <p className="info">{INVITE.time}</p>
            <p className="info">{INVITE.place}</p>
          </div>
        </div>
        <div className="hint" ref={hint}>{HINT}<i /></div>
      </section>
    </main>
  );
}
