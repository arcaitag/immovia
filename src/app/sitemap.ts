import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { ARTICLES } from "@/lib/content/ratgeber";
import { LEGAL_PAGES, LEGAL_PAGES_ARE_DRAFTS } from "@/lib/content/legal";
import { absoluteUrl } from "@/lib/seo/site";

/** Sitemap: statische Seiten, Ratgeber, öffentliche Inserate und Firmenprofile. Stündlich aktualisiert. */
export const revalidate = 3600;

const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/immobilien", priority: 0.9, changeFrequency: "hourly" },
  { path: "/kaufen", priority: 0.9, changeFrequency: "hourly" },
  { path: "/mieten", priority: 0.9, changeFrequency: "hourly" },
  { path: "/verkaufen", priority: 0.8, changeFrequency: "monthly" },
  { path: "/bewerten", priority: 0.8, changeFrequency: "monthly" },
  { path: "/so-funktionierts", priority: 0.6, changeFrequency: "monthly" },
  { path: "/fuer-makler", priority: 0.6, changeFrequency: "monthly" },
  { path: "/ratgeber", priority: 0.7, changeFrequency: "weekly" },
  { path: "/faq", priority: 0.5, changeFrequency: "monthly" },
  { path: "/kontakt", priority: 0.4, changeFrequency: "yearly" },
];

const MAX_LISTINGS = 45_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  if (!LEGAL_PAGES_ARE_DRAFTS) {
    for (const page of LEGAL_PAGES) entries.push({ url: absoluteUrl(page.href), changeFrequency: "yearly", priority: 0.2 });
  }

  for (const article of ARTICLES) {
    entries.push({
      url: absoluteUrl(`/ratgeber/${article.slug}`),
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  const supabase = createPublicClient();
  if (supabase) {
    const [listings, organizations] = await Promise.all([
      supabase
        .from("listings")
        .select("slug, updated_at")
        .not("slug", "is", null)
        .eq("is_demo", false)
        .order("updated_at", { ascending: false })
        .limit(MAX_LISTINGS),
      supabase.from("organizations").select("slug, updated_at").order("updated_at", { ascending: false }).limit(5000),
    ]);
    for (const listing of listings.data ?? []) {
      if (!listing.slug) continue;
      entries.push({
        url: absoluteUrl(`/immobilien/${listing.slug}`),
        lastModified: new Date(listing.updated_at),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
    for (const org of organizations.data ?? []) {
      entries.push({
        url: absoluteUrl(`/firmen/${org.slug}`),
        lastModified: new Date(org.updated_at),
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
    if (listings.error) console.error("[sitemap] Inserate konnten nicht geladen werden", listings.error.message);
  }

  return entries;
}
