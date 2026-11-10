import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-source",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Miravelt Admin",
  description: "Admin dashboard for the Miravelt backend.",
};

/**
 * Sets the `.dark` class before first paint so a dark-mode reload doesn't flash light.
 * Mirrors ThemeToggle's rule: the stored choice ("boardui:theme"), else the OS preference.
 * Inline scripts are allowed by next.config.ts's CSP (`script-src 'self' 'unsafe-inline'`).
 */
const THEME_INIT = `try{var t=localStorage.getItem("boardui:theme");if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full bg-background-full font-sans text-text-primary">{children}</body>
    </html>
  );
}
