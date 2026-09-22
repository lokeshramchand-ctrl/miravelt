import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SmoothScrollProvider } from "@/components/sites/becomeautonomous-com-5026bacf/shared/smooth-scroll";
import {
  BRAND_INK,
  DESCRIPTION,
  LONG_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  TAGLINE,
} from "@/lib/brand";
import "./globals.css";

const diatype = localFont({
  variable: "--font-diatype",
  src: [
    {
      path: "../../public/sites/becomeautonomous-com-5026bacf/root-8a5edab2/fonts/diatype-300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/sites/becomeautonomous-com-5026bacf/root-8a5edab2/fonts/diatype-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/sites/becomeautonomous-com-5026bacf/root-8a5edab2/fonts/diatype-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/sites/becomeautonomous-com-5026bacf/root-8a5edab2/fonts/diatype-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
});

const diatypeMono = localFont({
  variable: "--font-diatype-mono",
  src: [
    {
      path: "../../public/sites/becomeautonomous-com-5026bacf/root-8a5edab2/fonts/diatype-mono-300.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/sites/becomeautonomous-com-5026bacf/root-8a5edab2/fonts/diatype-mono-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/sites/becomeautonomous-com-5026bacf/root-8a5edab2/fonts/diatype-mono-500.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/sites/becomeautonomous-com-5026bacf/root-8a5edab2/fonts/diatype-mono-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: LONG_DESCRIPTION,
  keywords: [
    "Auvren",
    "personal finance app",
    "automatic transaction categorization",
    "spending insights",
    "merchant name cleanup",
    "subscription tracking",
    "budgeting app",
    "expense tracking",
    "AI spending explanations",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  applicationName: SITE_NAME,
  category: "finance",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_INK,
  colorScheme: "light",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon`,
  description: DESCRIPTION,
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${diatype.variable} ${diatypeMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
