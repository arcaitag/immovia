"use client";

/**
 * Globaler next/image-Loader.
 * - Supabase Storage (property-images): Varianten -sm/-md/-lg werden beim Upload erzeugt.
 * - Unsplash (nur Demo-Daten und Marketingbilder): Grösse über URL-Parameter.
 * - Lokale Dateien: unverändert.
 */
interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

const VARIANT_PATTERN = /-(sm|md|lg)\.webp$/;

export default function immoviaImageLoader({ src, width, quality }: LoaderArgs): string {
  if (src.startsWith("https://images.unsplash.com/")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(quality ?? 70));
    url.searchParams.set("auto", "format");
    url.searchParams.set("fit", "crop");
    return url.toString();
  }
  if (VARIANT_PATTERN.test(src)) {
    const variant = width <= 640 ? "sm" : width <= 1280 ? "md" : "lg";
    return src.replace(VARIANT_PATTERN, `-${variant}.webp`);
  }
  return src;
}
