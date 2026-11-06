import type { Metadata } from "next";
import { SITE } from "@/lib/constants";

export interface PageMetadataInput {
  title: string;
  description?: string;
  /** Relativer Pfad inkl. kanonischer Query-Parameter, z. B. "/kaufen?kanton=BE" */
  path: string;
  /** Titel ohne Vorlage « · Immovia» verwenden */
  absoluteTitle?: boolean;
  noindex?: boolean;
  images?: { url: string; alt?: string; width?: number; height?: number }[];
  type?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
}

/**
 * Einheitliche Metadaten für öffentliche Seiten: Titel, Beschreibung, canonical und Open Graph.
 * Open Graph wird vollständig gesetzt, weil Next.js verschachtelte Metadaten nicht zusammenführt.
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const description = input.description ?? SITE.description;
  const ogTitle = input.absoluteTitle ? input.title : `${input.title} · ${SITE.name}`;
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description,
    alternates: { canonical: input.path },
    robots: input.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      type: input.type ?? "website",
      locale: "de_CH",
      siteName: SITE.name,
      title: ogTitle,
      description,
      url: input.path,
      images: input.images,
      ...(input.type === "article"
        ? {
            publishedTime: input.publishedTime ?? undefined,
            modifiedTime: input.modifiedTime ?? undefined,
          }
        : {}),
    },
  };
}
