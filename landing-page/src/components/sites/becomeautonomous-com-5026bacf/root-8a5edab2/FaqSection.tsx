"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronIcon } from "@/components/sites/becomeautonomous-com-5026bacf/shared/icons";
import { Reveal } from "@/components/sites/becomeautonomous-com-5026bacf/shared/Reveal";

const FAQS = [
  {
    q: "How do I get started?",
    a: "Connect a statement or forward a PDF and categorization starts within minutes. No chart of accounts to build first, no manual tagging to get through before it's useful.",
  },
  {
    q: "Who is this for?",
    a: "Anyone who wants an accurate, honest picture of where their money actually goes — without spending an evening reconciling bank descriptions in a spreadsheet by hand.",
  },
  {
    q: "What happens after I connect an account?",
    a: "Every transaction gets read, matched to a real merchant, and sorted into a category. Recurring charges and subscriptions are tracked automatically, unusual spikes get flagged, and any correction you make is remembered so the same mistake doesn't repeat. The more it sees, the more confident it gets — a merchant it's guessed at a few times eventually becomes one it's sure of.",
  },
  {
    q: "How accurate are the explanations?",
    a: "Every explanation is built only from your own transaction history — nothing is invented to fill a gap. If there isn't enough data to answer confidently, it says so instead of guessing.",
  },
  {
    q: "Who's behind it?",
    a: "A small team building the categorization and behavioral-intelligence layer personal finance tools have always needed but rarely gotten right.",
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
