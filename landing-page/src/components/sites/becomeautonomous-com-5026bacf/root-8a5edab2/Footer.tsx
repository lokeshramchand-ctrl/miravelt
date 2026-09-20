import { AutonomousMonogram } from "@/components/sites/becomeautonomous-com-5026bacf/shared/icons";

export function Footer() {
  return (
    <footer className="mx-auto max-w-[1352px] px-4 pb-10 pt-6 md:px-8">
      <div className="grid grid-cols-1 gap-10 border-t border-black/10 pt-10 md:grid-cols-2 md:gap-16">
        <div>
          <p className="text-[13px] font-medium text-[#020203]/60">Legal</p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            Advisory services are provided by Autonomous Wealth Management LLC, an
            SEC registered investment adviser. Additional information about our
            services and fees is available in our{" "}
            <a
              href="https://cdn.atg.science/autonomous-form-adv-part-2a.pdf"
              className="underline underline-offset-2"
            >
              Firm Brochure
            </a>{" "}
            and{" "}
            <a
              href="https://cdn.atg.science/autonomous-form-crs.pdf"
              className="underline underline-offset-2"
            >
              Client Relationship Summary
            </a>
            .
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            The information and results presented are hypothetical and are
            provided for illustrative purposes only. Hypothetical performance
            does not represent actual trading and has inherent limitations. Past
            performance is not indicative of future results, and no guarantees
            are made that any investor will achieve similar results.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            This material is for informational purposes only and is not
            intended to provide personalized investment advice or
            recommendations. It is important that you consider your individual
            financial situation, investment objectives, and risk tolerance
            before choosing to invest.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            When you visit our site, we and our third-party partners may collect
            personal information about you, including through cookies and
            similar technology. To read more about our collection and sharing
            practices, click{" "}
            <a href="/privacy-policy" className="underline underline-offset-2">
              here
            </a>
            .
          </p>
        </div>

        <div>
          <p className="text-[13px] font-medium text-[#020203]/60">Waitlist Referral Disclosure</p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            Autonomous does not pay cash compensation for referrals to our firm.
            However, we do provide non-cash benefits in the form of higher
            scheduling priority or earlier access to certain services, if new
            clients open accounts with Autonomous using a promoter&rsquo;s
            referral link.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            Because promoters receive these benefits, a material conflict of
            interest exists, as they have an incentive to recommend Autonomous
            in order to receive enhanced access or priority.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            Any time a promoter receives compensation for referring clients, a
            conflict of interest exists, which you should be aware of when
            evaluating the referral or signing up for Autonomous&rsquo;
            services.
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-black/10 pt-6 md:flex-row md:items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#020203] text-white">
          <AutonomousMonogram className="h-5 w-5" />
        </div>
        <div className="flex flex-1 flex-col gap-1 text-[13px] text-[#020203]/50 md:flex-row md:items-center md:gap-4">
          <span>Copyright © 2026 Autonomous Technologies Group. All rights reserved.</span>
          <a href="/privacy-policy" className="underline underline-offset-2">
            Privacy Policy
          </a>
        </div>
        <div className="flex items-center gap-3 text-[13px] text-[#020203]/50">
          <a href="https://x.com/a____t____g">X.com</a>
          <span>·</span>
          <a href="https://threads.com/a____t____g">Threads</a>
          <span>·</span>
          <a href="https://www.linkedin.com/company/autonomous-technologies-group/">
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
