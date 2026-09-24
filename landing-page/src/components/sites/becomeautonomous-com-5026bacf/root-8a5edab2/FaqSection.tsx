"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronIcon } from "@/components/sites/becomeautonomous-com-5026bacf/shared/icons";
import { Reveal } from "@/components/sites/becomeautonomous-com-5026bacf/shared/Reveal";
import { FAQS } from "@/lib/faq-data";

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-16 md:px-8 md:py-24">
      <Reveal>
        <h2 className="text-[42px] font-medium text-[#020203] md:text-[57px]">FAQ</h2>
        <div className="mt-6 border-t border-black/10">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-b border-black/10">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-6 text-left md:py-8"
                >
                  <span className="text-[28px] font-medium text-[#020203] md:text-[42px]">
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
