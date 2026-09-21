"use client";

import { useEffect, useRef } from "react";
import { ArrowRightIcon } from "@/components/sites/becomeautonomous-com-5026bacf/shared/icons";

/**
 * Reverse-engineered from becomeautonomous.com's production bundle
 * (chunk app/page-a88d8cd2371bed13.js, function `k`): the card track isn't
 * a plain horizontally-scrollable row. On non-touch devices the wrapper
 * stays scroll-hidden and a rAF loop translates the track horizontally as
 * a function of the *vertical* scroll position — the wrapper's
 * bounding-rect top drives how far the track has drifted left, at a fixed
 * 0.55px of drift per px of vertical scroll, with a small head start so
 * the drift begins slightly before the section is fully in view. Touch
 * devices get real native horizontal scrolling instead (the site falls
 * back to a CSS `animation-timeline: view()` track there; native swipe is
 * the equivalent user experience without reimplementing that CSS path).
 */
const DRIFT_SPEED = 0.55;
const DRIFT_LOOKAHEAD = 0.1;
const IO_ROOT_MARGIN = "100% 0px";

function useGalleryDrift(
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  trackRef: React.RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    if (!wrapper || !track) return;

    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || prefersReducedMotion) return;

    let maxDrift = 0;
    let current = -1;
    let rafId = 0;
    let running = false;

    const measure = () => {
      maxDrift = Math.max(0, track.scrollWidth - wrapper.clientWidth);
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(track);
    resizeObserver.observe(wrapper);
    window.addEventListener("resize", measure);

    const tick = () => {
      if (!running) return;
      const rect = wrapper.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const drift = Math.min(
        Math.max((viewportHeight - rect.top + DRIFT_LOOKAHEAD * viewportHeight) * DRIFT_SPEED, 0),
        maxDrift
      );
      if (drift !== current) {
        current = drift;
        track.style.transform = `translate3d(${-drift}px, 0, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          rafId = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(rafId);
        }
      },
      { rootMargin: IO_ROOT_MARGIN }
    );
    observer.observe(wrapper);

    wrapper.style.overflow = "hidden";
    track.style.willChange = "transform";

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
      wrapper.style.overflow = "";
      track.style.willChange = "";
      track.style.transform = "";
    };
  }, [wrapperRef, trackRef]);
}

type GalleryCard = {
  label: string;
  time: string;
  body: string;
} & (
  | { kind: "stat"; statLabel: string; statValue: string; cta: string }
  | {
      kind: "stat2";
      statLabel: string;
      statValue: string;
      statLabel2: string;
      statValue2: string;
      cta: string;
    }
  | { kind: "chart" }
  | { kind: "plain" }
);

const CARDS: GalleryCard[] = [
  {
    label: "NEW SUBSCRIPTION",
    time: "YESTERDAY",
    body: "A recurring charge from a streaming service showed up for the first time this month. It's now tracked alongside everything else you're billed for on a schedule.",
    kind: "stat",
    statLabel: "MONTHLY SUBSCRIPTIONS",
    statValue: "$142",
    cta: "Review subscriptions",
  },
  {
    label: "MERCHANT CLEANED UP",
    time: "2 HRS AGO",
    body: "\"SQ *TSTDRAFTHOUSE 04471\" came in unreadable off the statement. It's now filed under Draft House, matched against three earlier visits.",
    kind: "stat",
    statLabel: "MERCHANTS RESOLVED THIS MONTH",
    statValue: "38",
    cta: "See merchant history",
  },
  {
    label: "SPENDING BREAKDOWN",
    time: "TODAY",
    body: "Here's where this month actually went, grouped by category instead of by raw bank descriptions.",
    kind: "chart",
  },
  {
    label: "UNUSUAL SPEND",
    time: "TODAY",
    body: "Dining is running well above your usual monthly pace, concentrated in the last nine days. Nothing looks miscategorized — it's a genuine shift.",
    kind: "stat",
    statLabel: "DINING THIS MONTH",
    statValue: "$612",
    cta: "See the detail",
  },
  {
    label: "TRUST UPDATE",
    time: "15 MINUTES AGO",
    body: "After six consistent visits, this merchant graduated from a first guess to a confirmed category. Future charges here get sorted automatically.",
    kind: "stat2",
    statLabel: "REVIEWS SO FAR",
    statValue: "6",
    statLabel2: "CONFIDENCE",
    statValue2: "98%",
    cta: "View merchant",
  },
  {
    label: "ASK WHY",
    time: "YESTERDAY",
    body: "\"Why is this marked as a bill and not shopping?\" The answer draws only on your own transaction history — never a guess dressed up as one.",
    kind: "stat",
    statLabel: "EXPLANATION CONFIDENCE",
    statValue: "High",
    cta: "Ask a question",
  },
];

const CHART_SEGMENTS = [
  { label: "FOOD", value: 32 },
  { label: "BILLS", value: 24 },
  { label: "TRANSPORT", value: 18 },
  { label: "SHOPPING", value: 16 },
  { label: "OTHER", value: 10 },
];

const CHART_RADIUS = 52;
const CHART_CIRCUMFERENCE = 2 * Math.PI * CHART_RADIUS;
const CHART_OFFSETS = CHART_SEGMENTS.reduce<number[]>((offsets, seg, i) => {
  const prev = i === 0 ? 0 : offsets[i - 1] + CHART_SEGMENTS[i - 1].value;
  offsets.push(prev);
  return offsets;
}, []);

function DonutChart() {
  return (
    <div className="relative flex h-[160px] w-[160px] items-center justify-center self-end">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        {CHART_SEGMENTS.map((seg, i) => {
          const dash = (seg.value / 100) * CHART_CIRCUMFERENCE;
          return (
            <circle
              key={seg.label}
              cx="60"
              cy="60"
              r={CHART_RADIUS}
              fill="none"
              stroke={i === 0 ? "#fcfcfd" : "rgba(252,252,253,0.35)"}
              strokeWidth={i === 0 ? 10 : 8}
              strokeDasharray={`${dash} ${CHART_CIRCUMFERENCE - dash}`}
              strokeDashoffset={-((CHART_OFFSETS[i] / 100) * CHART_CIRCUMFERENCE)}
            />
          );
        })}
      </svg>
      <div className="absolute right-full top-0 flex flex-col items-end gap-1 pr-3 font-mono text-[10px] text-[#fcfcfd]/70">
        {CHART_SEGMENTS.map((seg) => (
          <span key={seg.label}>
            {seg.label} {seg.value}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function CardGallery() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  useGalleryDrift(wrapperRef, trackRef);

  return (
    <div className="py-6 md:py-10">
      <div
        ref={wrapperRef}
        className="overflow-x-auto px-4 pb-4 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden"
      >
        <div ref={trackRef} className="flex gap-4 md:gap-6">
          {CARDS.map((card) => (
            <div
              key={card.label + card.time}
              className="flex h-[420px] w-[320px] shrink-0 flex-col justify-between rounded-[28px] bg-[#020203] p-7 md:h-[400px] md:w-[360px] md:rounded-[32px] md:p-8"
            >
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wide text-[#707785]">
                  {card.label} · {card.time}
                </p>
                <p className="mt-4 text-[17px] leading-snug text-[#e8e9eb] md:text-[18px]">
                  {card.body}
                </p>
              </div>

              {card.kind === "chart" && <DonutChart />}

              {card.kind === "stat" && (
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wide text-[#707785]">
                    {card.statLabel}
                  </p>
                  <p className="mt-1 text-[30px] text-[#fcfcfd]">{card.statValue}</p>
                  <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#fcfcfd] py-3.5 text-[15px] font-medium text-[#020203] transition-transform hover:scale-[1.02]">
                    {card.cta}
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {card.kind === "stat2" && (
                <div>
                  <div className="flex gap-6">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wide text-[#707785]">
                        {card.statLabel}
                      </p>
                      <p className="mt-1 text-[24px] text-[#fcfcfd]">{card.statValue}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wide text-[#707785]">
                        {card.statLabel2}
                      </p>
                      <p className="mt-1 text-[24px] text-[#fcfcfd]">{card.statValue2}</p>
                    </div>
                  </div>
                  <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#fcfcfd] py-3.5 text-[15px] font-medium text-[#020203] transition-transform hover:scale-[1.02]">
                    {card.cta}
                    <ArrowRightIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
