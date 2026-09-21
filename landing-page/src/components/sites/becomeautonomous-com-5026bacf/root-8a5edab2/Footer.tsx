import { AutonomousMonogram } from "@/components/sites/becomeautonomous-com-5026bacf/shared/icons";

export function Footer() {
  return (
    <footer className="mx-auto max-w-[1352px] px-4 pb-10 pt-6 md:px-8">
      <div className="grid grid-cols-1 gap-10 border-t border-black/10 pt-10 md:grid-cols-2 md:gap-16">
        <div>
          <p className="text-[13px] font-medium text-[#020203]/60">Legal</p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            This product provides transaction categorization and spending
            insights for informational purposes only. It does not provide
            investment, tax or legal advice, and nothing here should be treated
            as a recommendation to buy, sell or hold any asset.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            Explanations are generated only from your own transaction data.
            When the underlying data doesn&rsquo;t support a confident answer,
            none is given.
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
          <p className="text-[13px] font-medium text-[#020203]/60">Early Access</p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            Access is opening in stages while the categorization models are
            tuned on real usage. If you&rsquo;re on the list, you&rsquo;ll hear
            from us as capacity opens up.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-[#020203]/50">
            There&rsquo;s no cost to join the list, and your data is never sold
            to third parties.
          </p>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-black/10 pt-6 md:flex-row md:items-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#020203] text-white">
          <AutonomousMonogram className="h-5 w-5" />
        </div>
        <div className="flex flex-1 flex-col gap-1 text-[13px] text-[#020203]/50 md:flex-row md:items-center md:gap-4">
          <span>Copyright © 2026 Velar. All rights reserved.</span>
          <a href="/privacy-policy" className="underline underline-offset-2">
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
