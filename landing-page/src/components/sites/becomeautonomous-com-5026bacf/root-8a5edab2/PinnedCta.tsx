"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CtaButton } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/CtaButton";
import {
  MOBILE_BREAKPOINT_PX,
  useScrollState,
} from "@/components/sites/becomeautonomous-com-5026bacf/shared/smooth-scroll";

/**
 * Reverse-engineered from the live site: the CTA pill's transform is
 * always computed from the raw scroll position (`translateY(min(0, scroll
 * - releaseScroll))`) — there is no separate "entry" phase in the math.
 * What makes it look scoped to one section is a plain reveal: it's
 * invisible until an IntersectionObserver says the section is close, then
 * stays visible (matching becomeautonomous.com's own IO-gated reveal).
 */
export function PinnedCta() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ctx = useScrollState();
  const isActive = ctx?.isActive ?? false;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "20% 0px 0px 0px" }
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isActive || !ctx) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let releaseScroll = 0;
    let pinnedTop = 0;

    const measure = () => {
      const docTop = wrapper.getBoundingClientRect().top + ctx.scrollState.current.current;
      const bottomMargin = window.innerWidth > MOBILE_BREAKPOINT_PX ? 48 : 16;
      pinnedTop = window.innerHeight - wrapper.offsetHeight - bottomMargin;
      releaseScroll = docTop - pinnedTop;
    };
    measure();
    window.addEventListener("resize", measure);

    let rafId = 0;
    const tick = () => {
      const scroll = ctx.scrollState.current.current;
      const ty = Math.min(0, scroll - releaseScroll);
      wrapper.style.transform = `translate3d(0, ${ty}px, 0)`;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measure);
      wrapper.style.transform = "";
    };
  }, [isActive, ctx]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "z-50 flex justify-center pt-8 transition-opacity duration-500",
        !isActive && "sticky bottom-8",
        revealed ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <CtaButton />
    </div>
  );
}
