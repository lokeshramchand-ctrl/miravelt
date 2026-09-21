"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useScrollState } from "@/components/sites/becomeautonomous-com-5026bacf/shared/smooth-scroll";

const PIN_TOP_OFFSET = 16; // matches the panel's `top-4` fallback
const PIN_HOLD_VH = 60; // how much extra scroll the panel stays pinned for

function clampPin(scroll: number, pinStart: number, pinEnd: number) {
  if (scroll <= pinStart) return 0;
  if (scroll >= pinEnd) return pinEnd - pinStart;
  return scroll - pinStart;
}

const TABS = [
  {
    label: "Subscriptions",
    user: "Wait, when did I start paying for this?",
    ai: "This charge first appeared four months ago under a different merchant name. It's been billed monthly since — there was only just enough history to confirm it's recurring.",
  },
  {
    label: "Spending",
    user: "Why does it feel like I'm spending more this month?",
    ai: "You are. Dining is up 40% over your three-month average, concentrated in the last two weeks. Everything else is roughly flat.",
  },
  {
    label: "Categorization",
    user: "Why is this filed under bills instead of shopping?",
    ai: "It's billed the same amount on the same day for five straight months, which is what a bill looks like. Happy to move it if that's wrong.",
  },
];

export function ThinkingSection() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  const sectionRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const ctx = useScrollState();
  const isActive = ctx?.isActive ?? false;

  useEffect(() => {
    if (!isActive || !ctx) return;
    const section = sectionRef.current;
    const panel = panelRef.current;
    if (!section || !panel) return;

    let pinStart = 0;
    let pinEnd = 0;

    const measure = () => {
      // Read the panel's true document-space top: getBoundingClientRect()
      // already reflects the ancestor content transform, so adding back
      // the current virtual scroll recovers the untransformed position.
      const docTop = panel.getBoundingClientRect().top + ctx.scrollState.current.current;
      pinStart = docTop - PIN_TOP_OFFSET;
      pinEnd = pinStart + window.innerHeight * (PIN_HOLD_VH / 100);
      section.style.paddingBottom = `${window.innerHeight * (PIN_HOLD_VH / 100)}px`;
    };
    measure();
    window.addEventListener("resize", measure);

    let rafId = 0;
    const tick = () => {
      const scroll = ctx.scrollState.current.current;
      const ty = clampPin(scroll, pinStart, pinEnd);
      panel.style.transform = `translate3d(0, ${ty}px, 0)`;
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

  return (
    <div ref={sectionRef} className="relative py-16 md:py-24">
      <div className="mx-auto max-w-[1100px] px-4 md:px-8">
        <div
          ref={panelRef}
          className={cn(
            "overflow-hidden rounded-[28px] bg-[#020203] p-6 md:rounded-[40px] md:p-12",
            !isActive && "sticky top-4"
          )}
        >
          <div className="gradient-akanezora-bg pointer-events-none absolute inset-x-0 top-0 h-full" />
          <div className="gradient-akanezora-noise pointer-events-none absolute inset-x-0 top-0 h-full" />
          <nav className="relative flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/10 p-1.5">
              {TABS.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => setActive(i)}
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

            <div key={active} className="mx-auto mt-10 max-w-[720px] animate-[fade-in_0.5s_ease] space-y-6">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] text-white">
                  &rdquo;
                </span>
                <p className="text-[19px] leading-snug text-white md:text-[22px]">{tab.user}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] text-white">
                  ✦
                </span>
                <p className="text-[16px] leading-relaxed text-white/70 md:text-[18px]">{tab.ai}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
