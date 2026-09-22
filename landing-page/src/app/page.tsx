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
import { FAQS } from "@/lib/faq-data";

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export default function Home() {
  return (
    <main className="bg-[#f2f2f2]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
      <Hero />

      <HeadlineSection>A second set of eyes on every transaction you make.</HeadlineSection>
      <CardsRow
        cards={[
          { number: "01", text: "Every transaction is read, cleaned up and categorized the moment it lands — no manual tagging." },
          { number: "02", text: "It builds an understanding of how you actually spend, and gets more confident the longer it watches." },
        ]}
      />

      <HeroImageBlock
        src="/images/app-mockups/onboarding_screen.png"
        alt="Statement import and onboarding screen"
      />

      <HeadlineSection>
        It flags what changed, explains why, and never guesses.
      </HeadlineSection>
      <CardGallery />
      <CardsRow
        cards={[
          { number: "03", text: "Recurring charges, one-off spikes and slow drifts in behavior are all caught automatically." },
          { number: "04", text: "Every explanation is grounded in your own transaction history — if the data can't support an answer, none is given." },
        ]}
      />

      <HeroImageBlock
        src="/images/app-mockups/signals_screen.png"
        alt="Spending insights and category breakdown screen"
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
