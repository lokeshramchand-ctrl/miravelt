import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

// AI answer/search engines: fetch pages in real time to answer or cite a user's
// query. Allowed — this is how the site gets surfaced in AI answers.
const AI_ANSWER_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-User",
  "Claude-SearchBot",
  "Applebot",
];

// AI training crawlers: bulk-scrape content to train models, unrelated to any
// single user request. Blocked — no benefit to the site, only bandwidth cost.
const AI_TRAINING_BOTS = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "Bytespider",
  "Meta-ExternalAgent",
  "Applebot-Extended",
  "Diffbot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Omgilibot",
  "Omgili",
  "FacebookBot",
];

// SEO/backlink-tool crawlers: no referral value, just repeated full-site
// crawls. Blocked outright rather than merely rate-limited.
const SCRAPER_BOTS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "DataForSeoBot",
  "SerpstatBot",
  "MauiBot",
  "Barkrowler",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["Googlebot", "Bingbot", ...AI_ANSWER_BOTS],
        allow: "/",
      },
      {
        userAgent: [...AI_TRAINING_BOTS, ...SCRAPER_BOTS],
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        crawlDelay: 1,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
