import { StepHeader } from "@/components/property-wizard/step-header";
import { PropertyForm } from "@/components/property-wizard/property-form";
import { createClient } from "@/lib/supabase/server";
import { isSectionKey } from "@/lib/properties/fields";
import { propertyToFormValues } from "@/lib/validation/property";
import { getPropertyFeatures, getPropertyWorkspace, listRenovations, propertyStepTitle } from "@/services/properties";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: await propertyStepTitle(id, "Erfassen") };
}

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const ws = await getPropertyWorkspace(id);
  const supabase = await createClient();
  const [features, renovations] = await Promise.all([getPropertyFeatures(supabase, id), listRenovations(supabase, id)]);
  const section = isSectionKey(query.abschnitt) ? query.abschnitt : null;

  return (
    <div className="grid gap-6">
      <StepHeader
        step={1}
        title="Immobilie erfassen"
        description="Je vollständiger die Angaben, desto besser funktionieren Bewertung, KI-Texte und Suche. Pflichtfelder sind mit * markiert – alles andere ist freiwillig."
      />
      <PropertyForm
        propertyId={ws.property.id}
        initialValues={propertyToFormValues(ws.property, features)}
        initialSection={section}
        renovations={renovations.map((r) => ({ id: r.id, year: r.year, category: r.category, description: r.description }))}
      />
    </div>
  );
}
