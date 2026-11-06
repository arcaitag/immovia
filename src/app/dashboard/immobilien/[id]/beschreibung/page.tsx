import { StepFooterNav, StepHeader } from "@/components/property-wizard/step-header";
import { DescriptionFacts } from "@/components/ai/description-facts";
import { DescriptionHistory, type DescriptionHistoryItem } from "@/components/ai/description-history";
import { DescriptionStudio, type DescriptionVersionView, type SectionValue } from "@/components/ai/description-studio";
import { TextsConfirmation } from "@/components/ai/texts-confirmation";
import { createClient } from "@/lib/supabase/server";
import { buildPropertyFacts } from "@/lib/ai/property-facts";
import { DESCRIPTION_SECTIONS, DESCRIPTION_SECTION_KEYS, parseStoredDescription, type DescriptionSectionKey } from "@/lib/ai/prompts/description";
import { stepHref } from "@/lib/properties/steps";
import { isUuid } from "@/lib/utils";
import { getPropertyWorkspace, propertyStepTitle } from "@/services/properties";
import { getFeatureAvailability } from "@/services/ai/access";
import { loadPropertyContext } from "@/services/ai/property-data";

export const maxDuration = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: await propertyStepTitle(id, "Beschreibung") };
}

export default async function DescriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  // Lädt die Immobilie mit dem Benutzer-Client und prüft die Verwaltungsberechtigung (404 sonst)
  const ws = await getPropertyWorkspace(id);
  const supabase = await createClient();

  const [versionsRes, context, availability] = await Promise.all([
    supabase
      .from("generated_descriptions")
      .select("id, style, content, model, applied_at, created_at")
      .eq("property_id", ws.property.id)
      .order("created_at", { ascending: false })
      .limit(30),
    loadPropertyContext(supabase, ws.property.id),
    getFeatureAvailability({
      supabase,
      userId: ws.user.id,
      flag: "ai_descriptions",
      quotaFeature: "description",
      requiresAi: true,
      requiresConsent: true,
    }),
  ]);

  const rows = versionsRes.data ?? [];
  const requested = typeof query.version === "string" && isUuid(query.version) ? query.version : null;
  const selectedRow = rows.find((row) => row.id === requested) ?? rows.find((row) => !parseStoredDescription(row.content).rephrasedSection) ?? rows[0] ?? null;

  let version: DescriptionVersionView | null = null;
  if (selectedRow) {
    const stored = parseStoredDescription(selectedRow.content);
    version = {
      id: selectedRow.id,
      style: selectedRow.style,
      createdAt: selectedRow.created_at,
      model: selectedRow.model,
      content: Object.fromEntries(DESCRIPTION_SECTION_KEYS.map((key) => [key, stored[key]])) as Record<DescriptionSectionKey, SectionValue>,
      rephrasedSection: stored.rephrasedSection ?? null,
    };
  }
  const history: DescriptionHistoryItem[] = rows.map((row) => ({
    id: row.id,
    style: row.style,
    createdAt: row.created_at,
    appliedAt: row.applied_at,
    rephrasedSection: parseStoredDescription(row.content).rephrasedSection ?? null,
  }));

  const listing = ws.listing && ws.listing.status !== "archived" ? ws.listing : null;
  const listingTexts = Object.fromEntries(
    DESCRIPTION_SECTION_KEYS.map((key) => [key, listing ? (listing[DESCRIPTION_SECTIONS[key].listingColumn] ?? null) : null]),
  ) as Record<DescriptionSectionKey, SectionValue | null>;
  const facts = context ? buildPropertyFacts({ property: context.property, featureKeys: context.featureKeys, renovations: context.renovations }) : {};

  return (
    <div className="grid gap-6">
      <StepHeader
        step={4}
        title="Beschreibung erstellen"
        description="Lassen Sie Inseratetexte aus Ihren Angaben erstellen, passen Sie sie an und übernehmen Sie jeden Abschnitt einzeln ins Inserat."
      />
      <DescriptionStudio
        key={version?.id ?? "neu"}
        propertyId={ws.property.id}
        availability={availability}
        version={version}
        listingTexts={listingTexts}
      />
      <TextsConfirmation
        propertyId={ws.property.id}
        confirmedAt={listing?.texts_confirmed_at ?? null}
        canConfirm={Boolean(listing?.title?.trim() && listing.description?.trim())}
        listingHref={stepHref(ws.property.id, "inserat")}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <DescriptionFacts facts={facts} />
        {history.length ? <DescriptionHistory items={history} selectedId={version?.id ?? null} propertyId={ws.property.id} /> : null}
      </div>
      <StepFooterNav propertyId={ws.property.id} current="beschreibung" />
    </div>
  );
}
