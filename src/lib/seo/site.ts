import { publicEnv } from "@/lib/env";

/** Absolute URL zu einem Pfad der Website (für Sitemap, JSON-LD, Open Graph). */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Serialisiert strukturierte Daten für ein <script type="application/ld+json">.
 * Zeichen, die das Script-Tag beenden oder als HTML interpretiert werden könnten, werden maskiert.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

/** Kürzt einen Text für Meta-Beschreibungen auf ganze Wörter. */
export function metaDescription(text: string | null | undefined, max = 158): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}
