import { publicEnv } from "@/lib/env";

export type PublicBucket = "property-images" | "avatars" | "org-logos";
export type PrivateBucket = "property-originals" | "documents" | "dossiers" | "message-attachments";

/** Öffentliche URL einer Datei in einem öffentlichen Bucket. */
export function publicStorageUrl(bucket: PublicBucket, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const base = publicEnv.supabaseUrl.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export type ImageSize = "sm" | "md" | "lg";

/**
 * URL eines Immobilienbilds. display_path ist ein Präfix ohne Grössen-Suffix,
 * z. B. "{property}/{image}/base" → ".../base-md.webp". Demo-Bilder nutzen external_url.
 */
export function propertyImageUrl(
  image: { display_path?: string | null; external_url?: string | null } | null | undefined,
  size: ImageSize = "md",
): string | null {
  if (!image) return null;
  if (image.external_url) {
    const width = size === "sm" ? 640 : size === "md" ? 1280 : 2048;
    return `${image.external_url.split("?")[0]}?w=${width}&q=75&auto=format&fit=crop`;
  }
  if (!image.display_path) return null;
  return publicStorageUrl("property-images", `${image.display_path}-${size}.webp`);
}

/** Wie propertyImageUrl, aber für einen beliebigen Pfad-Präfix (z. B. base_path). */
export function imageVariantUrl(prefix: string | null | undefined, size: ImageSize = "md"): string | null {
  if (!prefix) return null;
  return publicStorageUrl("property-images", `${prefix}-${size}.webp`);
}

/**
 * Speicherort eines generierten Dossiers (Bucket «dossiers»). Downloads prüfen den Pfad gegen diese
 * Vorgabe, damit ein Datensatz nicht auf die Datei einer anderen Immobilie zeigen kann.
 */
export function dossierStoragePath(propertyId: string, dossierId: string): string {
  return `${propertyId}/${dossierId}.pdf`;
}
