import { z } from "zod";
import { AppError } from "@/lib/errors";
import {
  DOSSIER_SECTIONS,
  DOSSIER_SECTION_KEYS,
  DOSSIER_TEMPLATE_IDS,
  DOSSIER_TEMPLATE_INFO,
  dossierOptionsSchema,
  type DossierTemplateId,
} from "@/lib/pdf/dossier/options";
import { propertyImageUrl } from "@/lib/storage";
import { getFeatureAvailability, requireManagedProperty } from "@/services/ai/access";
import { loadDossierImages, loadOpenListing } from "@/services/ai/dossier-data";
import { requestDossierJob } from "@/services/ai/dossiers";
import { getListingContact } from "@/services/listings";
import { readJson, withSession } from "../valuation/_lib";

export const runtime = "nodejs";
// Wie die Dossierseite der Website: die PDF-Erstellung läuft nach der Antwort weiter (after)
export const maxDuration = 300;

const querySchema = z.object({ propertyId: z.guid() });
const bodySchema = z.object({ propertyId: z.guid(), options: z.unknown().optional() });

function isTemplateId(value: string): value is DossierTemplateId {
  return (DOSSIER_TEMPLATE_IDS as readonly string[]).includes(value);
}

/**
 * Mobile App: Stand des Verkaufsdossiers – dieselben Daten wie die Seite
 * /dashboard/immobilien/[id]/dossier (Vorlagen, Versionen, Bilder, Vorgaben, Verfügbarkeit).
 */
export async function GET(request: Request) {
  return withSession(request, async ({ supabase, user }) => {
    const parsed = querySchema.safeParse({ propertyId: new URL(request.url).searchParams.get("propertyId") ?? "" });
    if (!parsed.success) throw new AppError("validation", "Ungültige Anfrage.");
    const property = await requireManagedProperty(supabase, user, parsed.data.propertyId);
    const listing = await loadOpenListing(supabase, property.id);

    const [templatesRes, versionsRes, images, contact, availability] = await Promise.all([
      supabase.from("dossier_templates").select("id, name, description").eq("is_active", true).order("sort_order"),
      supabase
        .from("generated_dossiers")
        .select("id, version, status, template_id, file_size, page_count, is_public, error_message, options, created_at")
        .eq("property_id", property.id)
        .order("version", { ascending: false })
        .limit(50),
      loadDossierImages(supabase, property.id),
      listing ? getListingContact(supabase, listing.id).catch(() => null) : Promise.resolve(null),
      getFeatureAvailability({ supabase, userId: user.id, flag: "dossiers", requiresAi: false, requiresConsent: false }),
    ]);

    const templates = (templatesRes.data ?? [])
      .filter((t) => isTemplateId(t.id))
      .map((t) => ({ id: t.id as DossierTemplateId, label: t.name, description: t.description ?? DOSSIER_TEMPLATE_INFO[t.id as DossierTemplateId].description }));
    const templateOptions = templates.length
      ? templates
      : DOSSIER_TEMPLATE_IDS.map((tid) => ({ id: tid, label: DOSSIER_TEMPLATE_INFO[tid].label, description: DOSSIER_TEMPLATE_INFO[tid].description }));
    const templateLabel = (tid: string) => templateOptions.find((t) => t.id === tid)?.label ?? tid;

    const versions = (versionsRes.data ?? []).map((row) => ({
      id: row.id,
      version: row.version,
      status: row.status === "generating" || row.status === "failed" ? row.status : ("ready" as const),
      templateLabel: templateLabel(row.template_id),
      createdAt: row.created_at,
      fileSize: row.file_size,
      pageCount: row.page_count,
      isPublic: row.is_public,
      error: row.error_message,
    }));

    // Optionen der letzten Version als Ausgangspunkt (z. B. Bildauswahl und Reihenfolge)
    const lastOptions = versionsRes.data?.[0] ? dossierOptionsSchema.safeParse(versionsRes.data[0].options) : null;
    const initial = lastOptions?.success
      ? {
          templateId: templateOptions.some((t) => t.id === lastOptions.data.templateId) ? lastOptions.data.templateId : (templateOptions[0]?.id ?? "modern"),
          sections: lastOptions.data.sections,
          excludedImageIds: lastOptions.data.excludedImageIds,
          imageOrder: lastOptions.data.imageOrder,
          title: lastOptions.data.title,
          intro: lastOptions.data.intro,
          contact: lastOptions.data.contact,
        }
      : null;

    const isPublished = Boolean(listing && (listing.status === "published" || listing.status === "reserved") && listing.moderation_status !== "blocked");

    return {
      availability,
      templates: templateOptions,
      sections: DOSSIER_SECTION_KEYS.map((key) => ({ key, ...DOSSIER_SECTIONS[key] })),
      images: images.map((img) => ({
        id: img.id,
        url: propertyImageUrl(img, "sm"),
        caption: img.caption,
        isFloorPlan: img.is_floor_plan,
        isAiVisualization: img.is_ai_visualization,
        isCover: img.is_cover,
      })),
      initial,
      defaults: {
        title: listing?.title?.trim() ?? "",
        intro: listing?.short_description?.trim() ?? "",
        contactName: listing?.contact_name?.trim() ?? "",
        contactPhone: contact?.contact_phone ?? "",
        contactEmail: contact?.contact_email ?? "",
        showsPhone: Boolean(listing?.show_contact_phone),
        isPublished,
      },
      versions,
      listing: { exists: Boolean(listing), dossierPublic: Boolean(listing?.dossier_public), isPublished },
    };
  });
}

/** «Dossier erstellen»: PDF als Hintergrundauftrag (neue Version). options = dossierOptionsSchema. */
export async function POST(request: Request) {
  return withSession(request, async ({ supabase, user }) => {
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation", "Ungültige Anfrage.");
    return requestDossierJob(supabase, user, parsed.data.propertyId, parsed.data.options);
  });
}
