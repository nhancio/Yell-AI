import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

// "*" covers Googlebot, Bingbot and AI crawlers (GPTBot, PerplexityBot, ClaudeBot); only private app routes are hidden.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/connect", "/onboarding-preview", "/ads", "/api/", "/payment/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
