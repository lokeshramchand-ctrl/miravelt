import { Header } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/Header";
import { Hero } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/Hero";
import { HeadlineSection } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/HeadlineSection";
import { CardsRow } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/CardsRow";
import { HeroImageBlock } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/HeroImageBlock";
import { CardGallery } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/CardGallery";
import { WhySection } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/WhySection";
import { ThinkingSection } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/ThinkingSection";
import { PinnedCta } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/PinnedCta";
import { FaqSection } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/FaqSection";
import { Footer } from "@/components/sites/becomeautonomous-com-5026bacf/root-8a5edab2/Footer";

export default function Home() {
  return (
    <main className="bg-[#f2f2f2]">
      <Header />
      <Hero />

      <HeadlineSection>Superintelligence that manages your financial life.</HeadlineSection>
      <CardsRow
        cards={[
          { number: "01", text: "The foundation is a secure financial vault that monitors your assets." },
          { number: "02", text: "Autonomous builds an understanding of you, your family and goals." },
        ]}
      />

      <HeroImageBlock
        src="/images/app-mockups/onboarding_screen.png"
        alt="Velar Onboarding Screen"
      />

      <HeadlineSection>
        Autonomous surfaces what needs your attention and proactively takes the next step.
      </HeadlineSection>
      <CardGallery />
      <CardsRow
        cards={[
          { number: "03", text: "Investments, taxes, planning, execution. All coordinated in one system." },
          { number: "04", text: "Ideas are reasoned through together. Aligned decisions are executed instantly." },
        ]}
      />

      <HeroImageBlock
        src="/images/app-mockups/dashboard_screen.png"
        alt="Velar Dashboard Screen"
      />

      <WhySection />

      <div className="relative pb-32">
        <ThinkingSection />
        <PinnedCta />
      </div>

      <FaqSection />
      <Footer />
    </main>
  );
}
