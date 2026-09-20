"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Reveal } from "@/components/sites/becomeautonomous-com-5026bacf/shared/Reveal";
import {
  PARALLAX_SPEED,
  useScrollGetter,
} from "@/components/sites/becomeautonomous-com-5026bacf/shared/smooth-scroll";

/**
 * Matches the site's secondary hero-image parallax (the same rAF tick
 * that drives Hero's expansion also drives these blocks, just without the
 * scale-expansion term): the inner artwork shifts vertically at
 * PARALLAX_SPEED relative to how far the block's own top offset is from
 * the current scroll position. The site's version has no counter-scale
 * here, which only works because its frame has a fixed height distinct
 * from the image's rendered height; ours matches the image's own aspect
 * ratio, so a small constant overscan (scale) is added to give the
 * parallax translate headroom without ever revealing an edge.
 */
const OVERSCAN_SCALE = 1.12;
const MAX_DRIFT_RATIO = 0.05;

export function HeroImageBlock({ src, alt }: { src: string; alt: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const artworkRef = useRef<HTMLDivElement>(null);
  const getScroll = useScrollGetter();

  useEffect(() => {
    const frame = frameRef.current;
    const artwork = artworkRef.current;
    if (!frame || !artwork) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let topOffset = 0;
    let maxDrift = 0;
    const measure = () => {
      topOffset = frame.getBoundingClientRect().top + getScroll();
      maxDrift = frame.offsetHeight * MAX_DRIFT_RATIO;
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(frame);
    window.addEventListener("resize", measure);

    let rafId = 0;
    const tick = () => {
      const scroll = getScroll();
      const offset = (scroll - topOffset) * PARALLAX_SPEED;
      const clamped = Math.max(-maxDrift, Math.min(maxDrift, offset));
      artwork.style.transform = `scale(${OVERSCAN_SCALE}) translate3d(0, ${clamped}px, 0)`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [getScroll]);

  return (
    <div className="mx-auto max-w-[1352px] px-4 py-6 md:px-8 md:py-10">
      <Reveal>
        <div ref={frameRef} className="relative overflow-hidden rounded-[32px] bg-[#d2d4d9] md:rounded-[52px]">
          <div ref={artworkRef} className="h-full w-full" style={{ willChange: "transform" }}>
            <Image
              src={src}
              alt={alt}
              width={1920}
              height={1920}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </Reveal>
    </div>
  );
}
