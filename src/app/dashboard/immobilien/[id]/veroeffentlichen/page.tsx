import Link from "next/link";
import { CircleCheck, CircleX, Eye, FileX, PartyPopper } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooterNav, StepHeader } from "@/components/property-wizard/step-header";
import { EnsureListingButton } from "@/components/listing-editor/ensure-listing-button";
import { ListingStatusActions, StatusActionButton, type ListingStatusInfo } from "@/components/listing-editor/status-actions";
import { SharePanel } from "@/components/listing-editor/share-panel";
import { StatusHistory } from "@/components/listing-editor/status-history";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { LISTING_STATUS } from "@/lib/constants";
import { formatDateLong, formatDateTime } from "@/lib/format";
import { isDraftStatus, isPublicStatus, publishChecklist } from "@/lib/properties/listing-status";
import { getPropertyWorkspace, propertyStepTitle } from "@/services/properties";
import { getStatusHistory } from "@/services/listings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: await propertyStepTitle(id, "Veröffentlichung") };
}

export default async function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getPropertyWorkspace(id);
  const { property, listing, publishing, user } = ws;
  const base = `/dashboard/immobilien/${property.id}`;

  if (!listing) {
    return (
      <div className="grid gap-6">
        <StepHeader step={7} title="Inserat veröffentlichen" />
        <EmptyState
          icon={FileX}
          title="Für diese Immobilie besteht kein Inserat"
          action={<EnsureListingButton propertyId={property.id} />}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const history = await getStatusHistory(supabase, listing.id);
  const checks = publishChecklist({
    title: listing.title,
    description: listing.description,
    price: listing.price,
    priceOnRequest: listing.price_on_request,
    postalCode: listing.postal_code,
    municipality: listing.municipality,
    textsConfirmedAt: listing.texts_confirmed_at,
    imageCount: ws.imageCount,
    minImages: publishing.minImages,
  });
  const ready = checks.every((check) => check.ok);
  const info: ListingStatusInfo = {
    listingId: listing.id,
    status: listing.status,
    offerType: listing.offer_type,
    requireReview: publishing.requireReview,
    approved: Boolean(listing.approved_at),
  };
  const status = LISTING_STATUS[listing.status];
  const isPublic = isPublicStatus(listing.status);
  const publicUrl = listing.slug ? `${publicEnv.siteUrl}/immobilien/${listing.slug}` : null;
  const blocked = listing.moderation_status === "blocked";

  return (
    <div className="grid gap-6">
      <StepHeader
        step={7}
        title="Inserat veröffentlichen"
        description="Prüfen Sie die Pflichtangaben und veröffentlichen Sie Ihr Inserat. Danach verwalten Sie hier den Status."
        actions={
          <Button asChild variant="outline">
            <Link href={`${base}/inserat/vorschau`}>
              <Eye aria-hidden /> Vorschau
            </Link>
          </Button>
        }
      />

      {blocked ? (
        <Alert tone="error" title="Inserat gesperrt">
          {listing.moderation_reason ?? "Dieses Inserat wurde von der Moderation gesperrt."} Bitte kontaktieren Sie den Support.
        </Alert>
      ) : listing.moderation_status === "flagged" ? (
        <Alert tone="warning" title="Hinweis der Moderation">
          {listing.moderation_reason ?? "Ihr Inserat wird überprüft."}
        </Alert>
      ) : isDraftStatus(listing.status) && listing.moderation_reason ? (
        <Alert tone="warning" title="Nicht freigegeben">
          {listing.moderation_reason} Bitte überarbeiten Sie das Inserat und reichen Sie es erneut ein.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          {isDraftStatus(listing.status) ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Checkliste</CardTitle>
                  <CardDescription>Diese Angaben braucht es für die Veröffentlichung.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2">
                    {checks.map((check) => (
                      <li key={check.key} className="flex items-start gap-3 rounded-xl border border-border p-3.5">
                        {check.ok ? (
                          <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                        ) : (
                          <CircleX className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {check.label}
                            <span className="sr-only">{check.ok ? " (erfüllt)" : " (fehlt)"}</span>
                          </p>
                          {!check.ok ? <p className="text-sm text-muted-foreground">{check.hint}</p> : null}
                        </div>
                        {!check.ok ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`${base}/${check.fix}`}>{check.fixLabel}</Link>
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className={ready ? "border-mint-300" : undefined}>
                <CardHeader>
                  <CardTitle>{publishing.requireReview && !listing.approved_at ? "Zur Prüfung einreichen" : "Jetzt veröffentlichen"}</CardTitle>
                  <CardDescription>
                    {publishing.requireReview && !listing.approved_at
                      ? "Inserate werden derzeit vor der Veröffentlichung von unserem Team geprüft. Sie werden benachrichtigt, sobald Ihr Inserat online ist."
                      : "Ihr Inserat erscheint sofort in der Suche und unter einer eigenen Adresse. Sie können es jederzeit pausieren."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <StatusActionButton info={info} action="publish" disabled={!ready || blocked} size="lg" />
                  {!ready ? <p className="text-sm text-muted-foreground">Erledigen Sie zuerst die offenen Punkte der Checkliste.</p> : null}
                </CardContent>
              </Card>
            </>
          ) : null}

          {listing.status === "pending_review" ? (
            <Card>
              <CardHeader>
                <CardTitle>Ihr Inserat wird geprüft</CardTitle>
                <CardDescription>
                  Eingereicht am {formatDateTime(listing.status_changed_at)}. Sie erhalten eine Benachrichtigung, sobald es
                  freigegeben ist.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ListingStatusActions info={info} />
              </CardContent>
            </Card>
          ) : null}

          {isPublic || listing.status === "paused" ? (
            <Card className={isPublic ? "border-mint-300" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {isPublic ? <PartyPopper className="size-5 text-brand" aria-hidden /> : null}
                  {isPublic ? "Ihr Inserat ist online" : "Ihr Inserat ist pausiert"}
                </CardTitle>
                <CardDescription>
                  {listing.first_published_at ? `Erstmals veröffentlicht am ${formatDateLong(listing.first_published_at)}. ` : ""}
                  {isPublic
                    ? "Teilen Sie den Link, um mehr Interessenten zu erreichen."
                    : "Das Inserat ist derzeit nicht öffentlich sichtbar. Sie können es jederzeit fortsetzen."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                {isPublic && publicUrl ? <SharePanel url={publicUrl} title={listing.title ?? "Inserat auf Immovia"} /> : null}
                <div className="grid gap-3">
                  <p className="text-sm font-semibold">Status ändern</p>
                  <ListingStatusActions info={info} />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {listing.status === "sold" || listing.status === "rented" ? (
            <Card>
              <CardHeader>
                <CardTitle>{listing.status === "sold" ? "Verkauft" : "Vermietet"}</CardTitle>
                <CardDescription>
                  {listing.closed_at ? `Abgeschlossen am ${formatDateLong(listing.closed_at)}. ` : ""}
                  Das Inserat ist nicht mehr in der Suche sichtbar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ListingStatusActions info={info} />
              </CardContent>
            </Card>
          ) : null}

          {listing.status === "archived" ? (
            <Card>
              <CardHeader>
                <CardTitle>Inserat archiviert</CardTitle>
                <CardDescription>
                  Archivierte Inserate bleiben mit Statistik und Verlauf erhalten. Für einen neuen Verkauf oder eine neue Vermietung
                  erstellen Sie ein neues Inserat.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnsureListingButton propertyId={property.id} />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <div className="flex items-center gap-2 pt-1">
              <StatusBadge label={status.label} tone={status.tone} />
              <span className="text-xs text-muted-foreground">seit {formatDateTime(listing.status_changed_at)}</span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm font-semibold">Verlauf</p>
            <StatusHistory entries={history} userId={user.id} />
          </CardContent>
        </Card>
      </div>

      <StepFooterNav propertyId={property.id} current="veroeffentlichung" />
    </div>
  );
}
