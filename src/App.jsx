import { useCallback, useEffect, useRef } from "react";
import {
  VIDEO_PATH,
  CARD_IMAGE_PATH,
  INVITE,
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

  const updateScene = useCallback((progress) => {
    const v = video.current;
    const invitation = card.current;
    const scrollHint = hint.current;

    if (!v || !invitation) return;

    /*
     * الـ scroll هو الـ timeline.
     *
     * بداية الصفحة = 00:00
     * نهاية الصفحة = نهاية الفيديو
     */
    const duration = v.duration || 6;
    const currentTime = progress * duration;

    /*
     * التحكم في الفيديو عن طريق الـ scroll
     */
    if (
      Math.abs(v.currentTime - currentTime) > 0.01
    ) {
      v.currentTime = Math.min(
        currentTime,
        Math.max(0, duration - 0.02)
      );
    }

    /*
     * الدعوة تبدأ عند الثانية 5
     */
    const inviteProgress = clamp(
      (currentTime - INVITE_START) /
        Math.max(0.01, duration - INVITE_START)
    );

    const reveal = ease(inviteProgress);

    /*
     * ظهور الدعوة
     */
    invitation.style.opacity = reveal;

    /*
     * تدخل من الأسفل وتكبر تدريجيًا
     */
    const translateY = (1 - reveal) * 35;
    const scale = 0.92 + reveal * 0.08;

    invitation.style.transform =
      `translate(-50%, -50%)
       translateY(${translateY}px)
       scale(${scale})`;

    /*
     * حركة الطفو
     */
    const floatAmount =
      Math.sin(inviteProgress * Math.PI * 4) *
      8 *
      reveal;

    invitation.style.setProperty(
      "--float-y",
      `${
