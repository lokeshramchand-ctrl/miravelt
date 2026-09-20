import { Reveal } from "@/components/sites/becomeautonomous-com-5026bacf/shared/Reveal";

export function HeadlineSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1352px] px-4 pt-20 pb-10 md:px-8 md:pt-32 md:pb-16">
      <Reveal>
        <h2 className="max-w-[880px] text-[42px] font-normal leading-[1.05] tracking-tight text-[#020203] md:text-[72px]">
          {children}
        </h2>
      </Reveal>
    </div>
  );
}
