import { Reveal } from "@/components/sites/becomeautonomous-com-5026bacf/shared/Reveal";

export function WhySection() {
  return (
    <div className="mx-auto max-w-[1352px] px-4 py-10 md:px-8 md:py-16">
      <Reveal>
        <div className="rounded-[28px] bg-[#fcfcfd] p-8 md:rounded-[52px] md:p-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
            <p className="text-[21px] font-medium tracking-tight text-[#020203]">Why</p>
            <p className="text-[26px] font-normal leading-[1.2] text-[#020203] md:text-[36px]">
              Autonomous is science-backed financial intelligence, built on three
              commitments: to understand markets, to understand you, and to
              communicate what it knows in the form each moment demands.
            </p>
            <p className="hidden md:block" />
            <p className="text-[26px] font-normal leading-[1.2] text-[#020203] md:text-[36px]">
              It reads the forces moving markets, holds your complete picture
              against your goals, and optimizes as your life changes. The aim is
              autonomy: to handle the complexity so completely that engaging with
              it becomes a choice, made in full confidence that Autonomous is
              always at work on your behalf.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
