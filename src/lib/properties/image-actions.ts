"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/session";
import { AppError, runAction, validationError, type ActionResult } from "@/lib/errors";
import { revalidatePropertyViews } from "@/lib/properties/revalidate";
import { isPublicStatus } from "@/lib/properties/listing-status";
import {
  createUploadTargets,
  cropPropertyImage,
  deleteImage,
  processUploadedImage,
  reorderImages,
  resetImageCrop,
  setCoverImage,
  updateImageDetails,
  type PropertyImageRow,
  type UploadTarget,
} from "@/services/property-images";
import { getListingsForProperties, pickCurrentListing, syncDraftStatus } from "@/services/listings";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Server Actions für Bilder. Dateien laufen nie durch eine Action (Limit 2 MB):
 * der Browser lädt direkt in den Storage, die Actions erhalten nur Kennungen.
 */

const uuid = z.uuid("Ungültige Kennung.");

const uploadRequestSchema = z.object({
  propertyId: uuid,
  files: z
    .array(
      z.object({
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"], { error: "Bitte laden Sie JPG-, PNG- oder WebP-Bilder hoch." }),
        size: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(50, "Bitte laden Sie höchstens 50 Bilder auf einmal hoch."),
});

const processSchema = z.object({
  propertyId: uuid,
  imageId: uuid,
  ext: z.enum(["jpg", "png", "webp"]),
});

const detailsSchema = z
  .object({
    caption: z
      .string()
      .trim()
      .max(300, "Die Bildunterschrift darf höchstens 300 Zeichen lang sein.")
      .transform((value) => (value === "" ? null : value))
      .optional(),
    is_floor_plan: z.boolean().optional(),
  })
  .strict();

const reorderSchema = z.object({ propertyId: uuid, orderedIds: z.array(uuid).max(500) });

const cropSchema = z.object({
  imageId: uuid,
  area: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().gt(0).max(100),
    height: z.number().gt(0).max(100),
  }),
});

function parseImageId(value: unknown): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new AppError("not_found", "Das Bild wurde nicht gefunden.");
  return parsed.data;
}

async function afterImageChange(supabase: ServerSupabaseClient, propertyId: string, syncStatus = false) {
  if (syncStatus) await syncDraftStatus(supabase, propertyId);
  const listing = pickCurrentListing(await getListingsForProperties(supabase, [propertyId]));
  revalidatePropertyViews({ publicSlugs: listing && isPublicStatus(listing.status) ? [listing.slug] : [] });
}

export async function createImageUploadTargetsAction(input: unknown): Promise<ActionResult<UploadTarget[]>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = uploadRequestSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors, parsed.error.issues[0]?.message);
    const supabase = await createClient();
    return createUploadTargets(supabase, user, parsed.data.propertyId, parsed.data.files);
  });
}

export async function processUploadedImageAction(input: unknown): Promise<ActionResult<PropertyImageRow>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = processSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation");
    const supabase = await createClient();
    const image = await processUploadedImage(supabase, user, parsed.data);
    await afterImageChange(supabase, parsed.data.propertyId, true);
    return image;
  });
}

export async function updateImageDetailsAction(imageId: unknown, input: unknown): Promise<ActionResult<PropertyImageRow>> {
  return runAction(async () => {
    const user = await assertUser();
    const id = parseImageId(imageId);
    const parsed = detailsSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors, parsed.error.issues[0]?.message);
    const supabase = await createClient();
    const image = await updateImageDetails(supabase, user, id, parsed.data);
    await afterImageChange(supabase, image.property_id);
    return image;
  }, "Gespeichert.");
}

export async function setCoverImageAction(imageId: unknown): Promise<ActionResult<PropertyImageRow>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    const image = await setCoverImage(supabase, user, parseImageId(imageId));
    await afterImageChange(supabase, image.property_id);
    return image;
  }, "Titelbild festgelegt.");
}

export async function reorderImagesAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = reorderSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation");
    const supabase = await createClient();
    await reorderImages(supabase, user, parsed.data.propertyId, parsed.data.orderedIds);
    await afterImageChange(supabase, parsed.data.propertyId);
    return null;
  });
}

export async function deleteImageAction(imageId: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    const { propertyId } = await deleteImage(supabase, user, parseImageId(imageId));
    await afterImageChange(supabase, propertyId, true);
    return null;
  }, "Das Bild wurde gelöscht.");
}

export async function cropImageAction(input: unknown): Promise<ActionResult<PropertyImageRow>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = cropSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation", "Bitte wählen Sie einen gültigen Ausschnitt.");
    const supabase = await createClient();
    const image = await cropPropertyImage(supabase, user, parsed.data.imageId, parsed.data.area);
    await afterImageChange(supabase, image.property_id);
    return image;
  }, "Der Zuschnitt wurde gespeichert.");
}

export async function resetImageCropAction(imageId: unknown): Promise<ActionResult<PropertyImageRow>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    const image = await resetImageCrop(supabase, user, parseImageId(imageId));
    await afterImageChange(supabase, image.property_id);
    return image;
  }, "Das Bild wird wieder vollständig angezeigt.");
}
