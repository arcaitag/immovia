import { FileX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StepFooterNav, StepHeader } from "@/components/property-wizard/step-header";
import { EnsureListingButton } from "@/components/listing-editor/ensure-listing-button";
import { ListingForm } from "@/components/listing-editor/listing-form";
import { createClient } from "@/lib/supabase/server";
import type { ListingFormValues } from "@/lib/validation/listing";
import { getLatestValuationSuggestion, getPropertyWorkspace, propertyStepTitle } from "@/services/properties";
import { getDossierSummary, type ListingRow } from "@/services/listings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: await propertyStepTitle(id, "Inserat") };
}

function toFormValues(listing: ListingRow): ListingFormValues {
  const money = (value: number | null) => (value === null ? "" : String(Number(value)));
  return {
    price: money(listing.price),
    price_on_request: listing.price_on_request,
    additional_costs: money(listing.additional_costs),
    parking_price: money(listing.parking_price),
    title: listing.title ?? "",
    short_description: listing.short_description ?? "",
    description: listing.description ?? "",
    location_description: listing.location_description ?? "",
    equipment_description: listing.equipment_description ?? "",
    highlights: listing.highlights ?? [],
    search_summary: listing.search_summary ?? "",
    location_precision: listing.location_precision,
    contact_name: listing.contact_name ?? "",
    contact_phone: listing.contact_phone ?? "",
    contact_email: listing.contact_email ?? "",
    show_contact_phone: listing.show_contact_phone,
    dossier_public: listing.dossier_public,
    texts_confirmed: Boolean(listing.texts_confirmed_at),
  };
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getPropertyWorkspace(id);
  const { property, listing } = ws;

  if (!listing) {
    return (
      <div className="grid gap-6">
        <StepHeader step={6} title="Inserat vorbereiten" />
        <EmptyState
          icon={FileX}
          title="Für diese Immobilie besteht kein Inserat"
          description="Legen Sie ein neues Inserat an. Preis, Texte und Kontakt erfassen Sie danach hier."
          action={<EnsureListingButton propertyId={property.id} />}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const [dossiers, valuation] = await Promise.all([
    getDossierSummary(supabase, property.id),
    getLatestValuationSuggestion(supabase, property.id),
  ]);

  return (
    <div className="grid gap-6">
      <StepHeader
        step={6}
        title="Preis, Texte und Kontakt"
        description="Legen Sie fest, was Interessenten im Inserat sehen. Gespeichert wird erst mit «Speichern»; die Vorschau zeigt den gespeicherten Stand."
      />
      <ListingForm
        key={listing.id}
        propertyId={property.id}
        listingId={listing.id}
        offerType={listing.offer_type}
        initialValues={toFormValues(listing)}
        textsConfirmedAt={listing.texts_confirmed_at}
        parkingSpaces={property.garage_spaces + property.underground_parking_spaces + property.outdoor_parking_spaces}
        propertyAddress={{
          street: property.street,
          house_number: property.house_number,
          postal_code: property.postal_code,
          municipality: property.municipality,
        }}
        dossier={{
          available: dossiers.readyCount > 0,
          publicVersion: dossiers.publicVersion?.version ?? null,
          latestVersion: dossiers.latestReady?.version ?? null,
          latestDate: dossiers.latestReady?.created_at ?? null,
        }}
        valuation={valuation}
        serviceCharges={property.service_charges}
        locked={listing.status === "archived"}
      />
      <StepFooterNav propertyId={property.id} current="inserat" />
    </div>
  );
}
