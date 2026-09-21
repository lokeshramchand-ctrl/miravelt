"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpIcon } from "@/components/sites/becomeautonomous-com-5026bacf/shared/icons";

export function CtaButton({ className, dark = false }: { className?: string; dark?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => e.key === "Enter" && handleOpen()}
      className={cn(
        "relative flex h-14 items-center rounded-full transition-all duration-300 ease-out cursor-pointer overflow-hidden",
        dark ? "bg-[#fcfcfd] text-[#020203]" : "bg-[#fcfcfd] text-[#020203] shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
        expanded ? "w-[300px] px-2" : "w-[220px] justify-center px-6",
        className
      )}
    >
      {!expanded && (
        <p className="text-[16px] font-medium whitespace-nowrap">Get early access</p>
      )}
      {expanded && (
        <div className="flex w-full items-center gap-2 pl-4">
          <input
            ref={inputRef}
            type="text"
            inputMode="email"
            placeholder="Enter your email"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent text-[15px] text-[#020203] placeholder:text-[#707785] outline-none"
          />
          <button
            type="button"
            disabled={!email}
            aria-label="Apply"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
              email ? "bg-[#020203] text-white" : "bg-[#e5e6e8] text-[#a8acb3]"
            )}
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
