"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronIcon } from "@/components/sites/becomeautonomous-com-5026bacf/shared/icons";
import { Reveal } from "@/components/sites/becomeautonomous-com-5026bacf/shared/Reveal";

const FAQS = [
  {
    q: "How do I get access?",
    a: "By invitation. You can request an invitation or be referred by an existing member. We open Autonomous to a small group at a time and review every request individually.",
  },
  {
    q: "Who is Autonomous for?",
    a: "Autonomous is for people who want their entire financial life understood and managed in one place. Autonomous is built to handle complex situations with many moving parts: investments held across institutions, private assets, targeted exposure, equity compensation, real estate, taxes, and decisions which cut across all of it.",
  },
  {
    q: "What happens after I join?",
    a: "We start by building a complete picture of your financial life: what you own, what you owe, what matters to you, and what's already underway. From there, Autonomous continuously tracks changes, identifies what needs attention, and coordinates action across investments, taxes, planning, and execution. Autonomous meets you where you are. Whether you want every decision explained in plain language or you'd rather go deep on the mechanics, it calibrates to your financial fluency. Check in as often as you like. Autonomous will reach out when something genuinely needs your attention, and stay quiet when it doesn't. Your financial life is being handled, even when you are not thinking about it.",
  },
  {
    q: "How are my assets protected?",
    a: "Autonomous Wealth Management LLC is an SEC registered investment advisor. We operate under a strict fiduciary duty to act in your best interests at all times. Managed assets are held with Apex, one of the largest independent custodians with $200+ billion in client assets across 22+ million accounts. Apex is a broker-dealer and SIPC member, which means securities in your account are protected up to $500,000 in the unlikely event that Apex becomes insolvent.",
  },
  {
    q: "Who is behind Autonomous?",
    a: "Autonomous is built by Autonomous Technologies Group, an applied AI research lab in New York City and San Francisco. ATG's founders built and sold their last company, then couldn't find a wealth manager they'd actually use. So they built one. Today, our team of engineers, researchers, financial professionals, and operators is building a regulated, full-stack wealth manager from the ground up. We're hiring.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-16 md:px-8 md:py-24">
      <Reveal>
        <h2 className="text-[42px] font-normal text-[#020203] md:text-[57px]">FAQ</h2>
        <div className="mt-6 border-t border-black/10">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-b border-black/10">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-6 text-left md:py-8"
                >
                  <span className="text-[28px] font-normal text-[#020203] md:text-[42px]">
                    {item.q}
                  </span>
                  <ChevronIcon
                    className={cn(
                      "h-6 w-6 shrink-0 text-[#020203] transition-transform duration-300",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className="grid overflow-hidden transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="min-h-0">
                    <p className="max-w-[720px] pb-8 text-[17px] leading-relaxed text-[#020203]/60 md:text-[19px]">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}
