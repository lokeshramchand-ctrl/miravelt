"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  MOBILE_BREAKPOINT_PX,
  PARALLAX_SPEED,
  useScrollGetter,
} from "@/components/sites/becomeautonomous-com-5026bacf/shared/smooth-scroll";

/**
 * Reverse-engineered from becomeautonomous.com's production bundle
 * (chunk app/page-a88d8cd2371bed13.js): the hero frame isn't a static
 * image. It mounts at a slightly smaller "rest" scale with a negative
 * margin-bottom compensating for the gap, plays a 900ms ease-out entrance
 * (opacity + translateY + scale), and then keeps widening on scroll —
 * scaleX grows from restScale toward `min(1, EXPANSION_MAX_WIDTH_PX /
 * width)` as the user scrolls from the page top to the frame's own top
 * offset, while scaleY stays at the entrance value. The inner artwork
 * layer is inverse-scaled so the image itself never distorts, then
 * parallax-shifted vertically at PARALLAX_SPEED. Border radius is
 * counter-scaled per axis so corners stay round through the non-uniform
 * stretch.
 */
const ENTRANCE_DELAY_MS = 100;
const ENTRANCE_DURATION_MS = 900;
const ENTRANCE_TRANSLATE_Y_PX = 50;
const ENTRANCE_SCALE_FROM = 0.85;
const ENTRANCE_SCALE_FROM_MOBILE = 0.89;
const REST_SCALE = 0.9;
const REST_SCALE_MOBILE = 0.94;
const EXPANSION_MAX_WIDTH_PX = 1600;
const ARTWORK_TOP_INSET_RATIO_MOBILE = 0.04;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

export function Hero() {
  const frameRef = useRef<HTMLDivElement>(null);
  const artworkRef = useRef<HTMLDivElement>(null);
  const getScroll = useScrollGetter();

  useEffect(() => {
    const frame = frameRef.current;
    const artwork = artworkRef.current;
    if (!frame || !artwork) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame.style.opacity = "1";
      return;
    }

    const geometry = {
      top: 0,
      width: 0,
      borderRadius: 0,
      restScale: REST_SCALE,
      scaleFrom: ENTRANCE_SCALE_FROM,
      artworkInset: 0,
    };

    const measure = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT_PX;
      frame.style.borderRadius = "";
      const height = frame.offsetHeight;
      geometry.top = frame.getBoundingClientRect().top + getScroll();
      geometry.width = frame.offsetWidth;
      geometry.borderRadius = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0;
      geometry.restScale = isMobile ? REST_SCALE_MOBILE : REST_SCALE;
      geometry.scaleFrom = isMobile ? ENTRANCE_SCALE_FROM_MOBILE : ENTRANCE_SCALE_FROM;
      geometry.artworkInset = isMobile ? height * ARTWORK_TOP_INSET_RATIO_MOBILE : 0;
      frame.style.marginBottom = `${-height * (1 - geometry.restScale)}px`;
    };
    measure();
    window.addEventListener("resize", measure);

    let entranceStart: number | null = null;
    let rafId = 0;

    const tick = () => {
      const scroll = getScroll();
      const now = performance.now();
      if (entranceStart === null) entranceStart = now + ENTRANCE_DELAY_MS;

      const t = easeOutCubic((now - entranceStart) / ENTRANCE_DURATION_MS);
      const o = geometry.restScale;
      const top = geometry.top;
      const l = top > 0 ? clamp01(scroll / top) : 1;
      const scaleY = geometry.scaleFrom + (o - geometry.scaleFrom) * t;
      const d = Math.max(o, Math.min(1, geometry.width > 0 ? EXPANSION_MAX_WIDTH_PX / geometry.width : 1));
      const scaleX = (scaleY / o) * (o + (d - o) * l);
      const translateY = (1 - t) * ENTRANCE_TRANSLATE_Y_PX;

      frame.style.opacity = `${t}`;
      frame.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
      const radius = geometry.borderRadius;
      frame.style.borderRadius = `${radius / scaleX}px / ${radius / scaleY}px`;

      const parallax = (scroll - top) * PARALLAX_SPEED + geometry.artworkInset;
      artwork.style.transform = `scale(${1 / scaleX}, ${1 / scaleY}) translate3d(0, ${parallax}px, 0)`;

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measure);
    };
  }, [getScroll]);

  return (
    <div className="mx-auto max-w-[1352px] px-4 md:px-8">
      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-[32px] bg-[#d2d4d9] opacity-0 md:rounded-[52px]"
        style={{ willChange: "transform, opacity" }}
      >
        <div ref={artworkRef} className="h-full w-full" style={{ willChange: "transform" }}>
          <Image
            src="/images/app-mockups/dashboard_screen.png"
            alt="Velar Dashboard Screen"
            width={1920}
            height={1920}
            priority
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
