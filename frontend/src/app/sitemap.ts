import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/whatsapp-ai-assistants", "/brands", "/privacy", "/data-deletion"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path ? "monthly" : "weekly",
    priority: path ? 0.5 : 1,
  }));
}
