import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Json } from "@/types/database";
import { processImage, variantPaths, IMAGE_VARIANTS, type ImageVariant } from "@/lib/images/processing";
import { getImageAiProvider } from "@/lib/images/ai-providers";
import { IMAGE_AI_CAPABILITIES, STAGING_ROOM_TYPES, STAGING_STYLES } from "@/lib/images/ai-providers/types";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { logAiUsage } from "@/lib/ai/usage";
import { IMAGE_SOURCE_COLUMNS, loadImageSource } from "@/services/ai/image-source";

/**
 * Jobs «virtual_staging» und «image_enhance» (Perspektive) über einen externen Bild-KI-Anbieter.
 * Ohne konfigurierten Anbieter: PermanentJobError (keine erfundenen Ergebnisse).
 * Das Ergebnis wird als NEUES Bild gespeichert (source_image_id = Original), virtuelle
 * Möblierung mit is_ai_visualization = true (sichtbare Kennzeichnung).
 */

const roomTypes = Object.keys(STAGING_ROOM_TYPES) as [keyof typeof STAGING_ROOM_TYPES, ...(keyof typeof STAGING_ROOM_TYPES)[]];
const styles = Object.keys(STAGING_STYLES) as [keyof typeof STAGING_STYLES, ...(keyof typeof STAGING_STYLES)[]];

export const imageAiJobInputSchema = z.object({
  imageId: z.guid(),
  capability: z.enum(["perspective", "virtual_staging"]),
  roomType: z.enum(roomTypes).optional(),
  style: z.enum(styles).optional(),
});

export const imageAiJobHandler: JobHandler = async ({ job, admin }) => {
  const parsed = imageAiJobInputSchema.safeParse(job.input);
  if (!parsed.success || !job.property_id) throw new PermanentJobError("Ungültiger Auftrag für die Bild-KI.");
  const input = parsed.data;
  const expectedType = input.capability === "virtual_staging" ? "virtual_staging" : "image_enhance";
  if (job.job_type !== expectedType) throw new PermanentJobError("Auftragstyp passt nicht zur Funktion.");

  const provider = getImageAiProvider(input.capability);
  if (!provider) {
    throw new PermanentJobError("Für diese Funktion ist kein Bild-KI-Anbieter konfiguriert. Es wurde nichts verändert.");
  }

  const { data: image } = await admin
    .from("property_images")
    .select(`${IMAGE_SOURCE_COLUMNS}, caption, sort_order, is_floor_plan`)
    .eq("id", input.imageId)
    .eq("property_id", job.property_id)
    .maybeSingle();
  if (!image) throw new PermanentJobError("Das Bild wurde nicht gefunden.");

  const source = await loadImageSource(admin, image);
  const feature = input.capability === "virtual_staging" ? "virtual_staging" : "perspective";
  let output;
  try {
    output = await provider.run(input.capability, { image: source.buffer, mimeType: "image/jpeg", roomType: input.roomType, style: input.style });
  } catch (error) {
    await logAiUsage({ userId: job.user_id, jobId: job.id, feature, provider: provider.id, imageCount: 1, success: false });
    throw error;
  }
  await logAiUsage({ userId: job.user_id, jobId: job.id, feature, provider: provider.id, model: output.model ?? null, imageCount: 1, success: true });

  const processed = await processImage(output.image);
  const newId = randomUUID();
  const prefix = `${job.property_id}/${newId}/base`;
  const paths = variantPaths(prefix);
  for (const variant of Object.keys(IMAGE_VARIANTS) as ImageVariant[]) {
    const { error } = await admin.storage
      .from("property-images")
      .upload(paths[variant], processed.variants[variant], { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`Bild konnte nicht gespeichert werden: ${error.message}`);
  }

  const { data: last } = await admin
    .from("property_images")
    .select("sort_order")
    .eq("property_id", job.property_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const capability = IMAGE_AI_CAPABILITIES[input.capability];
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
    caption: capability.marksAsVisualization ? "KI-Visualisierung (virtuelle Möblierung)" : "Perspektive mit Bild-KI korrigiert",
    is_ai_visualization: capability.marksAsVisualization,
    source_image_id: image.id,
    status: "ready",
  });
  if (insertError) throw new Error(`Bild konnte nicht gespeichert werden: ${insertError.message}`);

  await admin.from("image_transformations").insert({
    image_id: image.id,
    user_id: job.user_id,
    provider: provider.id,
    kind: input.capability,
    operations: { roomType: input.roomType ?? null, style: input.style ?? null } as Json,
    status: "ready",
    output_path: prefix,
  });

  return { imageId: newId, sourceImageId: image.id, capability: input.capability };
};
