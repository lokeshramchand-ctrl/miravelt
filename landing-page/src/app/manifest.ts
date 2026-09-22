import type { MetadataRoute } from "next";
import { BRAND_BACKGROUND, BRAND_INK, DESCRIPTION, SITE_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — Clarity on every transaction.`,
    short_name: SITE_NAME,
    description: DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: BRAND_BACKGROUND,
    theme_color: BRAND_INK,
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
