import { StepFooterNav, StepHeader } from "@/components/property-wizard/step-header";
import { DossierStudio, type DossierImageOption, type DossierInitialOptions } from "@/components/dossier/dossier-studio";
import { DossierVersions, type DossierVersionItem } from "@/components/dossier/dossier-versions";
import { createClient } from "@/lib/supabase/server";
import { propertyImageUrl } from "@/lib/storage";
import { DOSSIER_TEMPLATE_IDS, DOSSIER_TEMPLATE_INFO, dossierOptionsSchema, type DossierTemplateId } from "@/lib/pdf/dossier/options";
import { getPropertyWorkspace, propertyStepTitle } from "@/services/properties";
import { getListingContact } from "@/services/listings";
import { getFeatureAvailability } from "@/services/ai/access";
import { loadDossierImages } from "@/services/ai/dossier-data";

export const maxDuration = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: await propertyStepTitle(id, "Dossier") };
}

function isTemplateId(value: string): value is DossierTemplateId {
  return (DOSSIER_TEMPLATE_IDS as readonly string[]).includes(value);
}

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Lädt die Immobilie mit dem Benutzer-Client und prüft die Verwaltungsberechtigung (404 sonst)
  const ws = await getPropertyWorkspace(id);
  const supabase = await createClient();
  const listing = ws.listing && ws.listing.status !== "archived" ? ws.listing : null;

  const [templatesRes, versionsRes, images, contact, availability] = await Promise.all([
    supabase.from("dossier_templates").select("id, name, description").eq("is_active", true).order("sort_order"),
    supabase
      .from("generated_dossiers")
      .select("id, version, status, template_id, file_size, page_count, is_public, error_message, options, created_at")
      .eq("property_id", ws.property.id)
      .order("version", { ascending: false })
      .limit(50),
    loadDossierImages(supabase, ws.property.id),
    listing ? getListingContact(supabase, listing.id).catch(() => null) : Promise.resolve(null),
    getFeatureAvailability({ supabase, userId: ws.user.id, flag: "dossiers", requiresAi: false, requiresConsent: false }),
  ]);

  const templates = (templatesRes.data ?? [])
    .filter((t) => isTemplateId(t.id))
    .map((t) => ({ id: t.id as DossierTemplateId, label: t.name, description: t.description ?? DOSSIER_TEMPLATE_INFO[t.id as DossierTemplateId].description }));
  const templateOptions = templates.length
    ? templates
    : DOSSIER_TEMPLATE_IDS.map((tid) => ({ id: tid, label: DOSSIER_TEMPLATE_INFO[tid].label, description: DOSSIER_TEMPLATE_INFO[tid].description }));
  const templateLabel = (tid: string) => templateOptions.find((t) => t.id === tid)?.label ?? tid;

  const versions: DossierVersionItem[] = (versionsRes.data ?? []).map((row) => ({
    id: row.id,
    version: row.version,
    status: row.status === "generating" || row.status === "failed" ? row.status : "ready",
    templateLabel: templateLabel(row.template_id),
    createdAt: row.created_at,
    fileSize: row.file_size,
    pageCount: row.page_count,
    isPublic: row.is_public,
    error: row.error_message,
  }));

  // Optionen der letzten Version als Ausgangspunkt (z. B. Bildauswahl und Reihenfolge)
  const lastOptions = versionsRes.data?.[0] ? dossierOptionsSchema.safeParse(versionsRes.data[0].options) : null;
  const initial: DossierInitialOptions | null = lastOptions?.success
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

  const imageOptions: DossierImageOption[] = images.map((img) => ({
    id: img.id,
    url: propertyImageUrl(img, "sm"),
    caption: img.caption,
    isFloorPlan: img.is_floor_plan,
    isAiVisualization: img.is_ai_visualization,
    isCover: img.is_cover,
  }));

  const isPublished = Boolean(listing && (listing.status === "published" || listing.status === "reserved") && listing.moderation_status !== "blocked");

  return (
    <div className="grid gap-8">
      <StepHeader
        step={5}
        title="Verkaufsdossier erstellen"
        description="Ein PDF mit Bildern, Eckdaten, Beschreibung und Kontakt – aus Ihren erfassten Angaben, ohne Ergänzungen. Wählen Sie eine Vorlage und prüfen Sie die Vorschau."
      />
      <DossierStudio
        propertyId={ws.property.id}
        templates={templateOptions}
        images={imageOptions}
        initial={initial}
        availability={availability}
        defaults={{
          title: listing?.title?.trim() ?? "",
          intro: listing?.short_description?.trim() ?? "",
          contactName: listing?.contact_name?.trim() ?? "",
          contactPhone: contact?.contact_phone ?? "",
          contactEmail: contact?.contact_email ?? "",
          showsPhone: Boolean(listing?.show_contact_phone),
          isPublished,
        }}
      />
      <DossierVersions
        propertyId={ws.property.id}
        versions={versions}
        listing={{ exists: Boolean(listing), dossierPublic: Boolean(listing?.dossier_public), isPublished }}
      />
      <StepFooterNav propertyId={ws.property.id} current="dossier" />
    </div>
  );
}
