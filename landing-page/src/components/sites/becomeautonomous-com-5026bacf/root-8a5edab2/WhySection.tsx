import { Reveal } from "@/components/sites/becomeautonomous-com-5026bacf/shared/Reveal";

export function WhySection() {
  return (
    <div className="mx-auto max-w-[1352px] px-4 py-10 md:px-8 md:py-16">
      <Reveal>
        <div className="rounded-[28px] bg-[#fcfcfd] p-8 md:rounded-[52px] md:p-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
            <p className="text-[21px] font-medium tracking-tight text-[#020203]">Why</p>
            <p className="text-[26px] font-normal leading-[1.2] text-[#020203] md:text-[36px]">
              Built on three commitments: read every transaction correctly,
              understand the person behind them, and only ever explain what the
              data actually supports.
            </p>
            <p className="hidden md:block" />
            <p className="text-[26px] font-normal leading-[1.2] text-[#020203] md:text-[36px]">
              Merchant names get cleaned up, spending gets clustered into
              patterns, and subscriptions and anomalies get caught as they
              happen. Every correction you make teaches it directly, so what
              you&rsquo;re using next month is sharper than what you started with.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
