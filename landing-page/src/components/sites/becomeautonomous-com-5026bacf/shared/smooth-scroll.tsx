"use client";

/**
 * Reverse-engineered from becomeautonomous.com's production bundle
 * (chunks 627-1bcab8d6f9e6c58f.js + 139-85430af645beddad.js): the site has
 * no scroll library (no GSAP/Lenis) — it hand-rolls a "virtual scroll".
 * A fixed, viewport-clipped wrapper hosts a content div that a rAF loop
 * translates via `translate3d(0, -current, 0)`, where `current` lerps
 * toward a wheel/keyboard-driven `target` at a fixed smoothing factor.
 * Touch devices (`ontouchstart` or maxTouchPoints) get real native
 * scrolling instead — the virtual scroll never activates for them.
 * Constants below (SMOOTHNESS, SENSITIVITY, ...) are copied verbatim
 * from the site's `139` chunk.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

export const SMOOTHNESS = 0.08;
export const SENSITIVITY = 1.5;
export const TOUCH_SENSITIVITY = 1;
export const ARROW_SCROLL_DELTA = 100;
export const PAGE_SCROLL_FACTOR = 0.8;
export const SUBPIXEL_PRECISION = 100;
export const MOBILE_BREAKPOINT_PX = 768;

export interface ScrollState {
  current: number;
  target: number;
  velocity: number;
}

interface SmoothScrollContextValue {
  scrollState: MutableRefObject<ScrollState>;
  isActive: boolean;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue | null>(null);

export function useScrollState() {
  return useContext(SmoothScrollContext);
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const scrollState = useRef<ScrollState>({ current: 0, target: 0, velocity: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || prefersReducedMotion) return;

    const s = scrollState.current;
    let disabled = false;
    let rafId = 0;

    // Cached instead of read from content.scrollHeight on every wheel event
    // and every rAF tick: a read-after-write geometry query on a hot path
    // forces a synchronous layout recalc each time (verified via a
    // performance trace — real, measurable jank the production site's own
    // per-frame `scrollHeight` read shares, but has no reason to keep).
    const getMax = () => Math.max(0, content.scrollHeight - window.innerHeight);
    let maxScroll = getMax();
    const refreshMax = () => {
      maxScroll = getMax();
      s.target = clamp(s.target, 0, maxScroll);
      s.current = clamp(s.current, 0, maxScroll);
    };
    const resizeObserver = new ResizeObserver(refreshMax);
    resizeObserver.observe(content);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 15;
      else if (e.deltaMode === 2) delta *= 100;
      s.target = clamp(s.target + delta * SENSITIVITY, 0, maxScroll);
    };

    let touchY = 0;
    let touchStartTarget = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
      touchStartTarget = s.target;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const delta = (touchY - e.touches[0].clientY) * TOUCH_SENSITIVITY;
      s.target = clamp(touchStartTarget + delta, 0, maxScroll);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isEditable =
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isEditable) return;

      let delta = 0;
      switch (e.key) {
        case "ArrowDown":
          delta = ARROW_SCROLL_DELTA;
          break;
        case "ArrowUp":
          delta = -ARROW_SCROLL_DELTA;
          break;
        case "PageDown":
          delta = window.innerHeight * PAGE_SCROLL_FACTOR;
          break;
        case "PageUp":
          delta = -window.innerHeight * PAGE_SCROLL_FACTOR;
          break;
        case "Home":
          e.preventDefault();
          s.target = 0;
          return;
        case "End":
          e.preventDefault();
          s.target = maxScroll;
          return;
        case " ":
          delta = e.shiftKey
            ? -window.innerHeight * PAGE_SCROLL_FACTOR
            : window.innerHeight * PAGE_SCROLL_FACTOR;
          break;
        default:
          return;
      }
      e.preventDefault();
      s.target = clamp(s.target + delta, 0, maxScroll);
    };

    const onResize = () => {
      refreshMax();
    };

    const disable = () => {
      if (disabled) return;
      disabled = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onTabDisable);
      wrapper.style.position = "static";
      wrapper.style.overflow = "visible";
      wrapper.style.height = "auto";
      content.style.transform = "";
      content.style.willChange = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
      window.scrollTo(0, s.current);
      setIsActive(false);
    };

    // Accessibility escape hatch, matching the site: the first Tab press
    // permanently drops back to native scrolling so keyboard focus can
    // rely on the browser's own scroll-into-view behavior.
    const onTabDisable = (e: KeyboardEvent) => {
      if (e.key === "Tab") disable();
    };

    let announced = false;
    const tick = () => {
      s.target = clamp(s.target, 0, maxScroll);
      s.current += (s.target - s.current) * SMOOTHNESS;
      s.velocity = s.target - s.current;
      const rounded = Math.round(s.current * SUBPIXEL_PRECISION) / SUBPIXEL_PRECISION;
      content.style.transform = `translate3d(0, ${-rounded}px, 0)`;
      if (!announced) {
        announced = true;
        setIsActive(true);
      }
      rafId = requestAnimationFrame(tick);
    };

    s.current = window.scrollY || 0;
    s.target = s.current;
    content.style.willChange = "transform";
    content.style.transform = "translate3d(0, 0, 0)";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("keydown", onTabDisable, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      disable();
    };
  }, []);

  return (
    <SmoothScrollContext.Provider value={{ scrollState, isActive }}>
      <div ref={wrapperRef} className={isActive ? "fixed inset-0 overflow-hidden" : undefined}>
        <div ref={contentRef}>{children}</div>
      </div>
    </SmoothScrollContext.Provider>
  );
}
