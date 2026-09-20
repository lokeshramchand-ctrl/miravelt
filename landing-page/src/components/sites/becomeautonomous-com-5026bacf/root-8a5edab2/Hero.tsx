import Image from "next/image";

export function Hero() {
  return (
    <div className="mx-auto max-w-[1352px] px-4 md:px-8">
      <div className="relative overflow-hidden rounded-[32px] bg-[#d2d4d9] md:rounded-[52px]">
        <Image
          src="/sites/becomeautonomous-com-5026bacf/root-8a5edab2/images/autonomous-ui-1.jpg"
          alt="Autonomous App Interface"
          width={1920}
          height={1920}
          priority
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
