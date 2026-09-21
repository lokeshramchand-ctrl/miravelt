import type { Metadata } from "next";
import localFont from "next/font/local";
import { SmoothScrollProvider } from "@/components/sites/becomeautonomous-com-5026bacf/shared/smooth-scroll";
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
  title: "Velar — Clarity on every transaction.",
  description: "Automatic categorization, merchant cleanup and explanations grounded in your own spending data.",
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
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
