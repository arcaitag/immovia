import Link from "next/link";
import { ArrowLeft, Eye, FileX } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StepHeader } from "@/components/property-wizard/step-header";
import { ListingPreview } from "@/components/listing-editor/listing-preview";
import { createClient } from "@/lib/supabase/server";
import { isPublicStatus } from "@/lib/properties/listing-status";
import { getPropertyFeatures, getPropertyWorkspace, listRenovations, propertyStepTitle } from "@/services/properties";
import { getListingContact } from "@/services/listings";
import { listPropertyImages } from "@/services/property-images";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: await propertyStepTitle(id, "Vorschau") };
}

export default async function ListingPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getPropertyWorkspace(id);
  const { property, listing } = ws;
  const base = `/dashboard/immobilien/${property.id}`;

  if (!listing) {
    return (
      <EmptyState
        icon={FileX}
        title="Noch kein Inserat"
        description="Sobald ein Inserat besteht, sehen Sie hier die Vorschau."
        action={
          <Button asChild variant="outline">
            <Link href={`${base}/inserat`}>Zum Inserat</Link>
          </Button>
        }
      />
    );
  }

  const supabase = await createClient();
  const [images, features, renovations, contact] = await Promise.all([
    listPropertyImages(supabase, property.id),
    getPropertyFeatures(supabase, property.id),
    listRenovations(supabase, property.id),
    getListingContact(supabase, listing.id),
  ]);
  const publicUrl = isPublicStatus(listing.status) && listing.slug ? `/immobilien/${listing.slug}` : null;

  return (
    <div className="grid gap-6">
      <StepHeader
        title="Vorschau des Inserats"
        description="So sehen Interessenten Ihr Inserat – mit dem zuletzt gespeicherten Stand."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`${base}/inserat`}>
                <ArrowLeft aria-hidden /> Zurück zum Bearbeiten
              </Link>
            </Button>
            {publicUrl ? (
              <Button asChild>
                <Link href={publicUrl} target="_blank" rel="noopener">
                  <Eye aria-hidden /> Öffentliche Seite
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <Alert tone="info">
        Vorschau – nicht öffentlich. Angezeigt wird die Adresse gemäss gewählter Standortgenauigkeit; Ihre exakte Adresse bleibt
        privat, ausser Sie haben «Exakte Adresse» gewählt.
      </Alert>
      <div className="rounded-3xl border border-border bg-white p-4 shadow-card sm:p-8">
        <ListingPreview
          listing={listing}
          contactPhone={contact.contact_phone}
          images={images
            .filter((image) => image.status === "ready")
            .map((image) => ({
              id: image.id,
              display_path: image.display_path,
              external_url: image.external_url,
              caption: image.caption,
              is_floor_plan: image.is_floor_plan,
              is_ai_visualization: image.is_ai_visualization,
            }))}
          features={features}
          renovations={renovations.map((r) => ({ id: r.id, year: r.year, category: r.category, description: r.description }))}
        />
      </div>
    </div>
  );
}
