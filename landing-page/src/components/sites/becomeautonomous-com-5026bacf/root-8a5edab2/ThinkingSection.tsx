"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useScrollState } from "@/components/sites/becomeautonomous-com-5026bacf/shared/smooth-scroll";

/**
 * Modeled on becomeautonomous.com's pinned horizontal-scroll section: the
 * panel sticks to the viewport while the page keeps scrolling, and that
 * extra scroll distance is repurposed to drive a horizontal slide between
 * panels instead of a vertical one — plus a background color crossfade —
 * rather than switching content on click. The vertical pin math is the
 * same trick as `PinnedCta`/the previous version of this file: the
 * section reserves `padding-bottom` equal to the hold distance, and a rAF
 * loop translates the panel by `scroll - pinStart` while inside that
 * range. Touch/reduced-motion visitors don't get the virtual scroll
 * (see `smooth-scroll.tsx`), so for them the tab pills directly set the
 * slide progress instead of a scroll target.
 */
const PIN_TOP_OFFSET = 16; // matches the panel's `top-4` fallback
const HOLD_VH_PER_PANEL = 70; // scroll distance (vh) dedicated to each panel-to-panel slide

function clampPin(scroll: number, pinStart: number, pinEnd: number) {
  if (scroll <= pinStart) return 0;
  if (scroll >= pinEnd) return pinEnd - pinStart;
  return scroll - pinStart;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const TABS = [
  {
    label: "Subscriptions",
    user: "Wait, when did I start paying for this?",
    ai: "This charge first appeared four months ago under a different merchant name. It's been billed monthly since — there was only just enough history to confirm it's recurring.",
    color: [9, 12, 30] as const,
  },
  {
    label: "Spending",
    user: "Why does it feel like I'm spending more this month?",
    ai: "You are. Dining is up 40% over your three-month average, concentrated in the last two weeks. Everything else is roughly flat.",
    color: [30, 10, 18] as const,
  },
  {
    label: "Categorization",
    user: "Why is this filed under bills instead of shopping?",
    ai: "It's billed the same amount on the same day for five straight months, which is what a bill looks like. Happy to move it if that's wrong.",
    color: [4, 58, 38] as const,
  },
];

function mixColor(progress: number) {
  const clamped = Math.max(0, Math.min(TABS.length - 1, progress));
  const i = Math.min(TABS.length - 2, Math.floor(clamped));
  const t = clamped - i;
  const a = TABS[i].color;
  const b = TABS[i + 1].color;
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

export function ThinkingSection() {
  const [active, setActive] = useState(0);

  const sectionRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const pinStartRef = useRef(0);
  const stepRef = useRef(0);

  const ctx = useScrollState();
  const isActive = ctx?.isActive ?? false;

  const applyVisual = (progress: number) => {
    const track = trackRef.current;
    const overlay = colorRef.current;
    if (track) {
      track.style.transform = `translate3d(${-progress * (100 / TABS.length)}%, 0, 0)`;
    }
    if (overlay) {
      overlay.style.backgroundColor = mixColor(progress);
    }
  };

  // Touch / reduced-motion fallback: no virtual scroll, so a tab click is
  // the only way to move — slide straight to it.
  useEffect(() => {
    if (isActive) return;
    applyVisual(active);
  }, [active, isActive]);

  useEffect(() => {
    if (!isActive || !ctx) return;
    const section = sectionRef.current;
    const panel = panelRef.current;
    if (!section || !panel) return;

    let pinStart = 0;
    let pinEnd = 0;
    let holdDistance = 0;

    const measure = () => {
      const docTop = panel.getBoundingClientRect().top + ctx.scrollState.current.current;
      holdDistance = window.innerHeight * (HOLD_VH_PER_PANEL / 100) * (TABS.length - 1);
      pinStart = docTop - PIN_TOP_OFFSET;
      pinEnd = pinStart + holdDistance;
      section.style.paddingBottom = `${holdDistance}px`;
      pinStartRef.current = pinStart;
      stepRef.current = holdDistance / (TABS.length - 1);
    };
    measure();
    window.addEventListener("resize", measure);

    let rafId = 0;
    const tick = () => {
      const scroll = ctx.scrollState.current.current;
      const ty = clampPin(scroll, pinStart, pinEnd);
      panel.style.transform = `translate3d(0, ${ty}px, 0)`;
      const progress = holdDistance > 0 ? (ty / holdDistance) * (TABS.length - 1) : 0;
      applyVisual(progress);
      const nearest = Math.round(clamp01(progress / (TABS.length - 1)) * (TABS.length - 1));
      setActive((prev) => (prev === nearest ? prev : nearest));
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measure);
      panel.style.transform = "";
      section.style.paddingBottom = "";
    };
  }, [isActive, ctx]);

  const handleTabClick = (i: number) => {
    if (isActive && ctx) {
      ctx.setTarget(pinStartRef.current + i * stepRef.current);
    } else {
      setActive(i);
    }
  };

  return (
    <div ref={sectionRef} className="relative py-16 md:py-24">
      <div className="mx-auto max-w-[1100px] px-4 md:px-8">
        <div
          ref={panelRef}
          className={cn(
            "relative overflow-hidden rounded-[28px] bg-[#020203] p-6 md:rounded-[40px] md:p-12",
            !isActive && "sticky top-4"
          )}
        >
          <div
            ref={colorRef}
            className="pointer-events-none absolute inset-x-0 top-0 h-full transition-none"
            style={{ backgroundColor: mixColor(0) }}
          />
          <div className="gradient-akanezora-bg pointer-events-none absolute inset-x-0 top-0 h-full opacity-25" />
          <div className="gradient-akanezora-noise pointer-events-none absolute inset-x-0 top-0 h-full" />
          <nav className="relative flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/10 p-1.5">
              {TABS.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => handleTabClick(i)}
                  className={cn(
                    "rounded-full px-6 py-3.5 text-[15px] font-medium transition-colors duration-300 md:px-8",
                    i === active
                      ? "bg-white text-[#020203]"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="relative mt-14 md:mt-20">
            <p className="text-center text-[15px] text-white/50 md:text-[16px]">
              Ask about any transaction and get an answer grounded in your own data
            </p>

            <div className="mt-10 overflow-hidden">
              <div ref={trackRef} className="flex" style={{ width: `${TABS.length * 100}%` }}>
                {TABS.map((t) => (
                  <div key={t.label} className="shrink-0 px-4" style={{ width: `${100 / TABS.length}%` }}>
                    <div className="mx-auto max-w-[720px] space-y-6">
                      <div className="flex items-start gap-3">
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] text-white">
                          &rdquo;
                        </span>
                        <p className="text-[19px] leading-snug text-white md:text-[22px]">{t.user}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] text-white">
                          ✦
                        </span>
                        <p className="text-[16px] leading-relaxed text-white/70 md:text-[18px]">{t.ai}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
