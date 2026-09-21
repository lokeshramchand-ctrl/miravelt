import { AutonomousMonogram } from "@/components/sites/becomeautonomous-com-5026bacf/shared/icons";

export function Header() {
  return (
    <header className="flex justify-center pt-10 pb-8 md:pt-16 md:pb-10">
      <div className="flex items-center gap-2 text-[#020203]">
        <AutonomousMonogram className="h-6 w-6" />
        <span className="text-[17px] font-medium tracking-tight">Velar</span>
      </div>
    </header>
  );
}
