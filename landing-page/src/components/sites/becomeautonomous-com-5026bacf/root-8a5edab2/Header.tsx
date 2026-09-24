import Image from "next/image";

export function Header() {
  return (
    <header className="flex justify-center pt-10 pb-8 md:pt-16 md:pb-10">
      <div className="flex items-center gap-2 text-[#020203]">
        <Image src="/images/brand-mark-ink.png" alt="" width={24} height={24} className="h-6 w-6" />
        <span className="text-[17px] font-medium tracking-tight">Miravelt</span>
      </div>
    </header>
  );
}
