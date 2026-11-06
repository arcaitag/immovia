import { StepFooterNav, StepHeader } from "@/components/property-wizard/step-header";
import { ValuationHistory } from "@/components/valuation/valuation-history";
import { ValuationMethod } from "@/components/valuation/valuation-method";
import { ValuationResult } from "@/components/valuation/valuation-result";
import { ValuationStarter } from "@/components/valuation/valuation-starter";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { checkValuationPrerequisites } from "@/lib/valuation/prerequisites";
import { externalAvmStatus } from "@/lib/valuation/providers/external-avm";
import { isUuid } from "@/lib/utils";
import { isAiConfigured } from "@/lib/ai/provider";
import { stepHref } from "@/lib/properties/steps";
import { getPropertyWorkspace, propertyStepTitle } from "@/services/properties";
import { getFeatureAvailability, hasAiConsent } from "@/services/ai/access";
import { toValuationSubject } from "@/services/ai/property-data";
import { loadAiSettings } from "@/services/ai/settings";

export const maxDuration = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: await propertyStepTitle(id, "Bewertung") };
}

export default async function ValuationPage({
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
  const settings = await loadAiSettings();

  const { data: valuations } = await supabase
    .from("property_valuations")
    .select("id, status, estimated_value, created_at")
    .eq("property_id", ws.property.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const list = valuations ?? [];
  const requested = typeof query.bewertung === "string" && isUuid(query.bewertung) ? query.bewertung : null;
  const selectedId = list.find((v) => v.id === requested)?.id ?? list[0]?.id ?? null;

  let detail = null;
  let publicSlugs: Record<string, string> = {};
  if (selectedId) {
    const [valuationRes, sourcesRes, comparablesRes] = await Promise.all([
      supabase.from("property_valuations").select("*").eq("id", selectedId).maybeSingle(),
      supabase.from("valuation_sources").select("*").eq("valuation_id", selectedId).order("created_at"),
      supabase.from("valuation_comparables").select("*").eq("valuation_id", selectedId).order("similarity", { ascending: false }),
    ]);
    if (valuationRes.data) {
      detail = { valuation: valuationRes.data, sources: sourcesRes.data ?? [], comparables: comparablesRes.data ?? [] };
      const listingIds = detail.comparables.map((c) => c.listing_id).filter((v): v is string => Boolean(v));
      const publicClient = createPublicClient();
      if (listingIds.length && publicClient) {
        const { data: open } = await publicClient.from("listings").select("id, slug").in("id", listingIds);
        publicSlugs = Object.fromEntries((open ?? []).filter((l) => l.slug).map((l) => [l.id, l.slug as string]));
      }
    }
  }

  const prerequisites = checkValuationPrerequisites(toValuationSubject(ws.property));
  const availability = await getFeatureAvailability({
    supabase,
    userId: ws.user.id,
    flag: "valuation",
    quotaFeature: "valuation",
    requiresAi: false,
    requiresConsent: false,
    settings,
  });
  const rent = ws.property.offer_type === "rent";
  // Die Bewertung selbst ist rein rechnerisch; nur die zusätzliche KI-Erklärung braucht die Einwilligung
  const explanation = !isAiConfigured() ? "unavailable" : (await hasAiConsent(supabase, ws.user.id)) ? "available" : "needs_consent";

  return (
    <div className="grid gap-6">
      <StepHeader
        step={2}
        title="Immobilienbewertung"
        description="Eine erste Orientierung zum Wert Ihrer Immobilie – nachvollziehbar berechnet und ehrlich gekennzeichnet. Frühere Bewertungen bleiben gespeichert."
      />
      <ValuationStarter
        propertyId={ws.property.id}
        items={prerequisites.items}
        ready={prerequisites.ready}
        availability={availability}
        hasValuation={list.length > 0}
        editHref={stepHref(ws.property.id, "erfassen")}
        explanation={explanation}
      />
      {detail ? <ValuationResult detail={detail} rent={rent} publicSlugs={publicSlugs} /> : null}
      {list.length > 1 ? <ValuationHistory items={list} selectedId={selectedId} propertyId={ws.property.id} rent={rent} /> : null}
      <ValuationMethod params={settings.valuation} avmConfigured={externalAvmStatus().configured} />
      <StepFooterNav propertyId={ws.property.id} current="bewertung" />
    </div>
  );
}
