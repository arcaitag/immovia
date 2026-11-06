import { serializeJsonLd } from "@/lib/seo/site";

/** Bindet strukturierte Daten (schema.org) als JSON-LD ein. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
