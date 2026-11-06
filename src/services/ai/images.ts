import "server-only";

import sharp from "sharp";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/session";
import { AppError, fromDbError } from "@/lib/errors";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { IMAGE_VARIANTS, processImage, suggestAdjustments, variantPaths, type Adjustments, type ImageVariant } from "@/lib/images/processing";
import { getImageAiProvider } from "@/lib/images/ai-providers";
import { STAGING_ROOM_TYPES, STAGING_STYLES } from "@/lib/images/ai-providers/types";
import { logAiUsage } from "@/lib/ai/usage";
import {
  assertAvailable,
  enforceRateLimit,
  enqueueAndRun,
  getFeatureAvailability,
  requireManagedProperty,
} from "@/services/ai/access";
import { IMAGE_SOURCE_COLUMNS, loadImageSource, type ImageSourceRow } from "@/services/ai/image-source";
import { revalidateProperty } from "@/services/ai/revalidate";

/**
 * Bilderstudio: automatische Optimierung (Bildverarbeitung mit sharp, keine KI),
 * Vorschau, Übernehmen, Original wiederherstellen und Aufträge an einen Bild-KI-Anbieter.
 */

export const adjustmentsSchema = z.object({
  brightness: z.number().min(-0.5).max(0.5).default(0),
  contrast: z.number().min(-0.5).max(0.5).default(0),
  saturation: z.number().min(-0.5).max(0.5).default(0),
  exposure: z.number().min(-0.5).max(0.5).default(0),
  warmth: z.number().min(-1).max(1).default(0),
  sharpen: z.number().min(0).max(1).default(0),
  straighten: z.number().min(-15).max(15).default(0),
  autoLevels: z.boolean().default(false),
  autoWhiteBalance: z.boolean().default(false),
});
export type AdjustmentsInput = z.infer<typeof adjustmentsSchema>;

interface StudioImage extends ImageSourceRow {
  is_enhanced: boolean;
  is_ai_visualization: boolean;
}

async function loadStudioImage(supabase: ServerSupabaseClient, user: SessionUser, imageId: string): Promise<StudioImage> {
  const parsed = z.guid().safeParse(imageId);
  if (!parsed.success) throw new AppError("not_found");
  const { data } = await supabase
    .from("property_images")
    .select(`${IMAGE_SOURCE_COLUMNS}, is_enhanced, is_ai_visualization`)
    .eq("id", imageId)
    .maybeSingle();
  if (!data) throw new AppError("not_found", "Das Bild wurde nicht gefunden.");
  await requireManagedProperty(supabase, user, data.property_id);
  return data;
}

/** Kleiner Zwischenspeicher für verkleinerte Quellbilder (beschleunigt die Vorschau). */
const previewSourceCache = new Map<string, { at: number; buffer: Buffer }>();
const CACHE_TTL_MS = 10 * 60_000;

async function previewSource(supabase: ServerSupabaseClient, image: StudioImage): Promise<Buffer> {
  const key = `${image.id}:${image.original_path ?? image.base_path ?? image.external_url}`;
  const hit = previewSourceCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.buffer;
  const source = await loadImageSource(supabase, image);
  const buffer = await sharp(source.buffer).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  previewSourceCache.set(key, { at: Date.now(), buffer });
  if (previewSourceCache.size > 30) {
    const oldest = [...previewSourceCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) previewSourceCache.delete(oldest[0]);
  }
  return buffer;
}

function assertEditable(image: StudioImage) {
  if (image.external_url) throw new AppError("invalid_state", "Demo-Bilder können nicht bearbeitet werden.");
  if (image.is_ai_visualization) throw new AppError("invalid_state", "KI-Visualisierungen werden nicht weiter bearbeitet.");
}

/** Vorschau (nicht gespeichert): liefert die optimierte md-Variante als Data-URL. */
export async function renderImagePreview(supabase: ServerSupabaseClient, user: SessionUser, imageId: string, raw: unknown): Promise<{ dataUrl: string; width: number; height: number }> {
  const adjustments = adjustmentsSchema.safeParse(raw ?? {});
  if (!adjustments.success) throw new AppError("validation", "Ungültige Einstellungen.");
  const image = await loadStudioImage(supabase, user, imageId);
  assertEditable(image);
  await enforceRateLimit(`image-preview:${user.id}`, 90, 60);
  const source = await previewSource(supabase, image);
  const processed = await processImage(source, adjustments.data as Adjustments);
  return { dataUrl: `data:image/webp;base64,${processed.variants.md.toString("base64")}`, width: processed.width, height: processed.height };
}

/** Vorschlag der automatischen Optimierung (Bildstatistik, keine KI). */
export async function suggestImageAdjustments(supabase: ServerSupabaseClient, user: SessionUser, imageId: string): Promise<AdjustmentsInput> {
  const image = await loadStudioImage(supabase, user, imageId);
  assertEditable(image);
  const source = await previewSource(supabase, image);
  return adjustmentsSchema.parse(await suggestAdjustments(source));
}

function isEnhancedPrefix(image: StudioImage, prefix: string | null): prefix is string {
  return Boolean(prefix && prefix.startsWith(`${image.property_id}/${image.id}/enh-`));
}

async function removeVariants(supabase: ServerSupabaseClient, prefix: string) {
  const paths = Object.values(variantPaths(prefix));
  const { error } = await supabase.storage.from("property-images").remove(paths);
  if (error) console.warn("[images] Alte Varianten konnten nicht entfernt werden", error.message);
}

/**
 * Übernimmt die Optimierung: rechnet vom Original neu, speichert die Varianten
 * {pid}/{iid}/enh-{ts}-{sm|md|lg}.webp und setzt display_path. Das Original bleibt erhalten.
 */
export async function acceptImageEnhancement(supabase: ServerSupabaseClient, user: SessionUser, imageId: string, raw: unknown): Promise<{ displayPath: string }> {
  const adjustments = adjustmentsSchema.safeParse(raw ?? {});
  if (!adjustments.success) throw new AppError("validation", "Ungültige Einstellungen.");
  const image = await loadStudioImage(supabase, user, imageId);
  assertEditable(image);
  assertAvailable(
    await getFeatureAvailability({
      supabase,
      userId: user.id,
      flag: "image_ai",
      quotaFeature: "image_enhance",
      requiresAi: false,
      requiresConsent: false,
    }).then((availability) =>
      // Grundkorrekturen sind keine KI: der Schalter image_ai betrifft nur die KI-Funktionen
      availability.reason === "feature_disabled" ? { available: true } : availability,
    ),
  );

  const source = await loadImageSource(supabase, image);
  const processed = await processImage(source.buffer, adjustments.data as Adjustments);
  const prefix = `${image.property_id}/${image.id}/enh-${Date.now()}`;
  const paths = variantPaths(prefix);
  for (const variant of Object.keys(IMAGE_VARIANTS) as ImageVariant[]) {
    const { error } = await supabase.storage
      .from("property-images")
      .upload(paths[variant], processed.variants[variant], { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (error) throw new AppError("unknown", "Das optimierte Bild konnte nicht gespeichert werden.");
  }
  const previous = image.display_path;
  const { error: updateError } = await supabase
    .from("property_images")
    .update({ display_path: prefix, is_enhanced: true, width: processed.width, height: processed.height, size_bytes: processed.variants.lg.length })
    .eq("id", image.id);
  if (updateError) {
    await removeVariants(supabase, prefix);
    throw fromDbError(updateError);
  }
  const { data: transformation } = await supabase
    .from("image_transformations")
    .insert({ image_id: image.id, provider: "sharp", kind: "enhance", operations: adjustments.data as unknown as Json, status: "accepted", output_path: prefix })
    .select("id")
    .single();
  if (transformation) {
    await supabase.from("image_transformations").update({ accepted_at: new Date().toISOString() }).eq("id", transformation.id);
  }
  if (isEnhancedPrefix(image, previous)) await removeVariants(supabase, previous);
  await logAiUsage({ userId: user.id, feature: "image_enhance", provider: "sharp", imageCount: 1, success: true });
  await revalidateProperty(supabase, image.property_id, [
    "/dashboard/bilderstudio",
    `/dashboard/bilderstudio/${image.id}`,
    `/dashboard/immobilien/${image.property_id}/bilder`,
  ]);
  return { displayPath: prefix };
}

/** Stellt das Original wieder her (display_path = base_path). */
export async function restoreOriginalImage(supabase: ServerSupabaseClient, user: SessionUser, imageId: string): Promise<void> {
  const image = await loadStudioImage(supabase, user, imageId);
  if (!image.base_path) throw new AppError("invalid_state", "Für dieses Bild gibt es keine Originalversion.");
  const previous = image.display_path;
  const { error } = await supabase.from("property_images").update({ display_path: image.base_path, is_enhanced: false }).eq("id", image.id);
  if (error) throw fromDbError(error);
  await supabase
    .from("image_transformations")
    .update({ status: "discarded" })
    .eq("image_id", image.id)
    .eq("kind", "enhance")
    .eq("status", "accepted");
  if (isEnhancedPrefix(image, previous)) await removeVariants(supabase, previous);
  await revalidateProperty(supabase, image.property_id, [
    "/dashboard/bilderstudio",
    `/dashboard/bilderstudio/${image.id}`,
    `/dashboard/immobilien/${image.property_id}/bilder`,
  ]);
}

const roomTypes = Object.keys(STAGING_ROOM_TYPES) as [keyof typeof STAGING_ROOM_TYPES, ...(keyof typeof STAGING_ROOM_TYPES)[]];
const styles = Object.keys(STAGING_STYLES) as [keyof typeof STAGING_STYLES, ...(keyof typeof STAGING_STYLES)[]];

export const imageAiRequestSchema = z.object({
  imageId: z.guid(),
  capability: z.enum(["perspective", "virtual_staging"]),
  roomType: z.enum(roomTypes).optional(),
  style: z.enum(styles).optional(),
});

/** Auftrag an den Bild-KI-Anbieter. Ohne Anbieter: klare Meldung, kein Auftrag. */
export async function requestImageAi(supabase: ServerSupabaseClient, user: SessionUser, raw: unknown): Promise<{ jobId: string }> {
  const parsed = imageAiRequestSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("validation");
  const input = parsed.data;
  const image = await loadStudioImage(supabase, user, input.imageId);
  assertEditable(image);
  if (!getImageAiProvider(input.capability)) {
    throw new AppError("service_unavailable", "Für diese Funktion ist kein Bild-KI-Anbieter eingerichtet.");
  }
  assertAvailable(
    await getFeatureAvailability({
      supabase,
      userId: user.id,
      flag: "image_ai",
      quotaFeature: input.capability === "virtual_staging" ? "virtual_staging" : "image_enhance",
      requiresAi: false,
      requiresConsent: true,
    }),
  );
  await enforceRateLimit(`image-ai:${user.id}`, 5, 60);
  const job = await enqueueAndRun({
    userId: user.id,
    type: input.capability === "virtual_staging" ? "virtual_staging" : "image_enhance",
    propertyId: image.property_id,
    input: input as unknown as Json,
    maxAttempts: 2,
  });
  return { jobId: job.id };
}
