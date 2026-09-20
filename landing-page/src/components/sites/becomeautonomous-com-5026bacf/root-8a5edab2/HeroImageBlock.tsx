import Image from "next/image";
import { Reveal } from "@/components/sites/becomeautonomous-com-5026bacf/shared/Reveal";

export function HeroImageBlock({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto max-w-[1352px] px-4 py-6 md:px-8 md:py-10">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] bg-[#d2d4d9] md:rounded-[52px]">
          <Image
            src={src}
            alt={alt}
            width={1920}
            height={1920}
            className="h-full w-full object-cover"
          />
        </div>
      </Reveal>
    </div>
  );
}
