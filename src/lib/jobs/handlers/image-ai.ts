import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Json } from "@/types/database";
import { matchAspectRatio, prepareForImageAi, processImage, variantPaths, IMAGE_VARIANTS, type ImageVariant } from "@/lib/images/processing";
import { getImageAiProvider } from "@/lib/images/ai-providers";
import {
  IMAGE_AI_CAPABILITIES,
  ImageAiProviderError,
  STAGING_ROOM_TYPES,
  STAGING_STYLES,
  imageAiJobType,
  type ImageAiOutput,
} from "@/lib/images/ai-providers/types";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { logAiUsage } from "@/lib/ai/usage";
import { assertAiConsent } from "@/lib/ai/consent";
import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import { IMAGE_SOURCE_COLUMNS, loadImageSource, type ImageSourceRow } from "@/services/ai/image-source";
import { loadAiSettings } from "@/services/ai/settings";

/**
 * Jobs «virtual_staging» (Designvorschläge «Aufräumen» und «Neu einrichten») und «image_enhance»
 * (Perspektive) über einen externen Bild-KI-Anbieter.
 *
 * - Ohne konfigurierten Anbieter: PermanentJobError (keine erfundenen Ergebnisse).
 * - Vorlage ist die angezeigte Version des Bildes (inkl. Zuschnitt/Optimierung), als JPEG ohne
 *   Metadaten (kein EXIF/GPS) und höchstens 2048 px.
 * - Das Ergebnis wird als NEUES Bild gespeichert (source_image_id = Vorlage), als KI-Visualisierung
 *   gekennzeichnet und mit status = 'review' angelegt: öffentlich erst, wenn der Inserent im
 *   Bilderstudio bestätigt, dass Raum und feste Ausstattung dem Original entsprechen.
 * - Vor dem Aufruf: Admin-Schalter image_ai, Einwilligung zur Bild-KI und Höchstzahl Bilder pro
 *   Objekt (publishing.max_images) werden erneut geprüft.
 */

const roomTypes = Object.keys(STAGING_ROOM_TYPES) as [keyof typeof STAGING_ROOM_TYPES, ...(keyof typeof STAGING_ROOM_TYPES)[]];
const styles = Object.keys(STAGING_STYLES) as [keyof typeof STAGING_STYLES, ...(keyof typeof STAGING_STYLES)[]];

export const imageAiJobInputSchema = z.object({
  imageId: z.guid(),
  capability: z.enum(["perspective", "virtual_staging", "declutter"]),
  roomType: z.enum(roomTypes).optional(),
  style: z.enum(styles).optional(),
});

const UNCHANGED = "Es wurde nichts verändert.";

/** Angezeigte Version (lg) laden; fehlt sie, die beste sonstige Quelle (Original, Basis, Demo). */
async function loadDisplayedVersion(admin: AdminSupabaseClient, image: ImageSourceRow): Promise<Buffer> {
  if (image.display_path) {
    const { data } = await admin.storage.from("property-images").download(variantPaths(image.display_path).lg);
    if (data) return Buffer.from(await data.arrayBuffer());
  }
  return (await loadImageSource(admin, image)).buffer;
}

async function removeUploaded(admin: AdminSupabaseClient, prefix: string) {
  const { error } = await admin.storage.from("property-images").remove(Object.values(variantPaths(prefix)));
  if (error) console.warn("[bild-ki] Hochgeladene Varianten konnten nicht entfernt werden", error.message);
}

export const imageAiJobHandler: JobHandler = async ({ job, admin }) => {
  const parsed = imageAiJobInputSchema.safeParse(job.input);
  if (!parsed.success || !job.property_id) throw new PermanentJobError("Ungültiger Auftrag für die Bild-KI.");
  const input = parsed.data;
  if (job.job_type !== imageAiJobType(input.capability)) throw new PermanentJobError("Auftragstyp passt nicht zur Funktion.");

  const provider = getImageAiProvider(input.capability);
  if (!provider) throw new PermanentJobError(`Für diese Funktion ist kein Bild-KI-Anbieter eingerichtet. ${UNCHANGED}`);
  const settings = await loadAiSettings();
  if (!settings.features.image_ai) throw new PermanentJobError(`Die Bild-KI ist derzeit deaktiviert. ${UNCHANGED}`);
  // Ohne Einwilligung kein Aufruf des Anbieters (AppError gilt in der Warteschlange als endgültig)
  await assertAiConsent(job.user_id, admin, "image");
  const { count: imageCount } = await admin
    .from("property_images")
    .select("id", { count: "exact", head: true })
    .eq("property_id", job.property_id);
  if ((imageCount ?? 0) >= settings.maxImages) {
    throw new PermanentJobError(`Die Höchstzahl von ${settings.maxImages} Bildern pro Objekt ist erreicht. Bitte entfernen Sie zuerst ein Bild.`);
  }

  const { data: image } = await admin
    .from("property_images")
    .select(`${IMAGE_SOURCE_COLUMNS}, status, is_ai_visualization`)
    .eq("id", input.imageId)
    .eq("property_id", job.property_id)
    .maybeSingle();
  if (!image) throw new PermanentJobError("Das Bild wurde nicht gefunden.");
  if (image.is_ai_visualization) throw new PermanentJobError(`KI-Visualisierungen werden nicht weiter bearbeitet. ${UNCHANGED}`);
  if (image.status !== "ready") throw new PermanentJobError(`Das Bild ist noch nicht fertig verarbeitet. ${UNCHANGED}`);

  const source = await prepareForImageAi(await loadDisplayedVersion(admin, image));
  const feature = input.capability === "perspective" ? "perspective" : "virtual_staging";
  let output: ImageAiOutput;
  try {
    output = await provider.run(input.capability, { image: source.buffer, mimeType: "image/jpeg", roomType: input.roomType, style: input.style });
  } catch (error) {
    await logAiUsage({ userId: job.user_id, jobId: job.id, feature, provider: provider.id, imageCount: 1, success: false });
    if (error instanceof ImageAiProviderError) throw new PermanentJobError(error.message);
    console.error("[bild-ki] Unerwarteter Fehler beim Anbieter", error);
    throw new PermanentJobError(`Die Bild-KI konnte das Bild nicht bearbeiten. ${UNCHANGED}`);
  }
  await logAiUsage({
    userId: job.user_id,
    jobId: job.id,
    feature,
    provider: provider.id,
    model: output.model ?? null,
    imageCount: 1,
    costUsd: output.costUsd,
    success: true,
  });

  let processed;
  try {
    processed = await processImage(await matchAspectRatio(output.image, source));
  } catch (error) {
    console.error("[bild-ki] Ergebnis konnte nicht verarbeitet werden", error);
    throw new PermanentJobError(`Das Ergebnis der Bild-KI war kein gültiges Bild. ${UNCHANGED}`);
  }

  const newId = randomUUID();
  const prefix = `${job.property_id}/${newId}/base`;
  const paths = variantPaths(prefix);
  for (const variant of Object.keys(IMAGE_VARIANTS) as ImageVariant[]) {
    const { error } = await admin.storage
      .from("property-images")
      .upload(paths[variant], processed.variants[variant], { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (error) {
      await removeUploaded(admin, prefix);
      throw new Error(`Bild konnte nicht gespeichert werden: ${error.message}`);
    }
  }

  const { data: last } = await admin
    .from("property_images")
    .select("sort_order")
    .eq("property_id", job.property_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const capability = IMAGE_AI_CAPABILITIES[input.capability];
  const styleLabel = input.capability === "virtual_staging" && input.style ? ` (${STAGING_STYLES[input.style]})` : "";
  const { error: insertError } = await admin.from("property_images").insert({
    id: newId,
    property_id: job.property_id,
    uploaded_by: job.user_id,
    base_path: prefix,
    display_path: prefix,
    width: processed.width,
    height: processed.height,
    size_bytes: processed.variants.lg.length,
    mime_type: "image/webp",
    sort_order: (last?.sort_order ?? 0) + 1,
    caption: `${capability.caption}${styleLabel}`,
    is_ai_visualization: capability.marksAsVisualization,
    source_image_id: image.id,
    // Erst nach der Prüfung durch den Inserenten öffentlich (Bilderstudio → «Freigeben»)
    status: "review",
  });
  if (insertError) {
    await removeUploaded(admin, prefix);
    throw new Error(`Bild konnte nicht gespeichert werden: ${insertError.message}`);
  }

  const { error: logError } = await admin.from("image_transformations").insert({
    id: randomUUID(),
    image_id: image.id,
    user_id: job.user_id,
    provider: provider.id,
    kind: input.capability,
    operations: { roomType: input.roomType ?? null, style: input.style ?? null, model: output.model ?? null } as Json,
    status: "ready",
    output_path: prefix,
  });
  if (logError) console.warn("[bild-ki] Bearbeitung konnte nicht protokolliert werden", logError.message);

  return { imageId: newId, sourceImageId: image.id, capability: input.capability };
};
