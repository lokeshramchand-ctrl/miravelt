import { Reveal } from "@/components/sites/becomeautonomous-com-5026bacf/shared/Reveal";

export function CardsRow({
  cards,
}: {
  cards: { number: string; text: string }[];
}) {
  return (
    <div className="mx-auto max-w-[1352px] px-4 pb-6 md:px-8 md:pb-10">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {cards.map((card, i) => (
          <Reveal key={card.number} delay={i * 100}>
            <div className="flex h-full min-h-[280px] flex-col justify-between rounded-[28px] bg-[#fcfcfd] p-8 md:min-h-[360px] md:rounded-[40px] md:p-10">
              <span className="font-mono text-[13px] text-[#a8acb3]">{card.number}</span>
              <p className="max-w-[420px] text-[26px] font-medium leading-[1.25] text-[#020203] md:text-[34px]">
                {card.text}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
