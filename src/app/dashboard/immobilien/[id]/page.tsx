import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, CircleDashed, ListChecks, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StepHeader } from "@/components/property-wizard/step-header";
import { DeletePropertyButton } from "@/components/property-wizard/delete-property-button";
import { CONDITIONS, HEATING_TYPES, OFFER_TYPES, PROPERTY_TYPES } from "@/lib/constants";
import { formatArea, formatChf, formatFloor, formatRooms } from "@/lib/format";
import { COMPLETENESS_LABELS } from "@/lib/properties/completeness";
import { sectionOf } from "@/lib/properties/fields";
import { isPublicStatus, publishChecklist } from "@/lib/properties/listing-status";
import { PROPERTY_STEPS, STEP_STATE_LABELS, nextStep, stepHref, type StepState } from "@/lib/properties/steps";
import { getPropertyWorkspace } from "@/services/properties";

function StateIcon({ state }: { state: StepState }) {
  if (state === "done") return <CircleCheck className="size-5 shrink-0 text-primary" aria-hidden />;
  if (state === "in_progress") return <CircleDashed className="size-5 shrink-0 text-warning" aria-hidden />;
  return <span className="size-5 shrink-0 rounded-full border-2 border-border" aria-hidden />;
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? <span className="text-muted-foreground">–</span>}</dd>
    </div>
  );
}

export default async function PropertyOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getPropertyWorkspace(id);
  const { property, listing, completeness, steps } = ws;
  const base = `/dashboard/immobilien/${property.id}`;
  const next = nextStep(steps);

  const checks = listing
    ? publishChecklist({
        title: listing.title,
        description: listing.description,
        price: listing.price,
        priceOnRequest: listing.price_on_request,
        postalCode: property.postal_code,
        municipality: property.municipality,
        textsConfirmedAt: listing.texts_confirmed_at,
        imageCount: ws.imageCount,
        minImages: ws.publishing.minImages,
      })
    : [];
  const openChecks = checks.filter((check) => !check.ok && check.key !== "location");
  const alreadyPublished = listing ? isPublicStatus(listing.status) || listing.status === "paused" : false;
  const nothingMissing = completeness.missingRequired.length === 0 && (alreadyPublished || openChecks.length === 0);

  return (
    <div className="grid gap-6">
      <StepHeader
        title="Übersicht"
        description="Was bereits erledigt ist und was noch fehlt. Sie können jeden Schritt jederzeit öffnen."
        actions={
          next ? (
            <Button asChild>
              <Link href={stepHref(property.id, next.key)}>
                Weiter: {next.title} <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-5 text-brand" aria-hidden /> Was fehlt noch
            </CardTitle>
            <CardDescription>Pflichtangaben für die Erfassung und für die Veröffentlichung.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {nothingMissing ? (
              <p className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm font-medium text-success">
                <CircleCheck className="size-5" aria-hidden /> Alle Pflichtangaben sind vorhanden.
              </p>
            ) : null}

            {completeness.missingRequired.length ? (
              <div className="grid gap-2">
                <p className="text-sm font-semibold">Objektdaten</p>
                <ul className="grid gap-1.5">
                  {completeness.missingRequired.map((field) => (
                    <li key={field}>
                      <Link
                        href={`${base}/bearbeiten?abschnitt=${sectionOf(field)}`}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3.5 text-sm hover:bg-mint-50"
                      >
                        <span className="flex items-center gap-2">
                          <CircleAlert className="size-4 text-warning" aria-hidden /> {COMPLETENESS_LABELS[field]}
                        </span>
                        <span className="font-semibold text-primary">Ergänzen</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!alreadyPublished && openChecks.length ? (
              <div className="grid gap-2">
                <p className="text-sm font-semibold">Für die Veröffentlichung</p>
                <ul className="grid gap-1.5">
                  {openChecks.map((check) => (
                    <li key={check.key}>
                      <Link
                        href={`${base}/${check.fix}`}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3.5 text-sm hover:bg-mint-50"
                      >
                        <span className="flex items-center gap-2">
                          <CircleAlert className="size-4 text-warning" aria-hidden /> {check.label}
                        </span>
                        <span className="font-semibold text-primary">{check.fixLabel}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {completeness.missingRecommended.length ? (
              <details className="rounded-xl border border-border px-3.5 py-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  Empfohlene Angaben ({completeness.missingRecommended.length})
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">
                  Nicht zwingend, verbessern aber Bewertung, Suche und Vertrauen.
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {completeness.missingRecommended.map((field) => (
                    <li key={field}>
                      <Link
                        href={`${base}/bearbeiten?abschnitt=${sectionOf(field)}`}
                        className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm hover:border-mint-300 hover:bg-mint-50"
                      >
                        {COMPLETENESS_LABELS[field]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {steps.beschreibung !== "done" ? (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                Tipp: Im Schritt «Beschreibung» erstellt die KI Texte auf Basis Ihrer Angaben – Sie prüfen und bearbeiten sie danach.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ihr Fortschritt</CardTitle>
            <CardDescription>Optionale Schritte sind gekennzeichnet.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-1">
              {PROPERTY_STEPS.map((step) => (
                <li key={step.key}>
                  <Link href={`${base}/${step.segment}`} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-mint-50">
                    <StateIcon state={steps[step.key]} />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold">
                        {step.number}. {step.label}
                      </span>
                      {!step.required ? <span className="text-muted-foreground"> · optional</span> : null}
                    </span>
                    <Badge tone={steps[step.key] === "done" ? "green" : steps[step.key] === "in_progress" ? "amber" : "neutral"}>
                      {STEP_STATE_LABELS[steps[step.key]]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Eckdaten</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/bearbeiten`}>Bearbeiten</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <dl>
              <Fact label="Objekt" value={`${PROPERTY_TYPES[property.property_type].label} · ${OFFER_TYPES[property.offer_type].verb}`} />
              {property.property_type !== "plot" ? <Fact label="Zimmer" value={property.rooms !== null ? formatRooms(property.rooms) : null} /> : null}
              {property.living_area !== null ? <Fact label="Nettowohnfläche" value={formatArea(property.living_area)} /> : null}
              {property.usable_area !== null ? <Fact label="Nutzfläche" value={formatArea(property.usable_area)} /> : null}
              {property.plot_area !== null ? <Fact label="Grundstück" value={formatArea(property.plot_area)} /> : null}
              {property.floor !== null ? <Fact label="Etage" value={formatFloor(property.floor)} /> : null}
              <Fact label="Baujahr" value={property.year_built !== null ? String(property.year_built) : null} />
              <Fact label="Zustand" value={property.condition ? CONDITIONS[property.condition] : null} />
              <Fact label="Heizung" value={property.heating_type ? HEATING_TYPES[property.heating_type] : null} />
              {listing && (listing.price !== null || listing.price_on_request) ? (
                <Fact label="Preis" value={listing.price_on_request ? "Auf Anfrage" : formatChf(listing.price)} />
              ) : null}
              <Fact label="Bilder" value={String(ws.imageCount)} />
            </dl>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Immobilie löschen</CardTitle>
            <CardDescription>
              Entfernt die Immobilie aus Ihrem Dashboard. Ein Inserat wird vorher archiviert und ist nicht mehr öffentlich.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeletePropertyButton
              propertyId={property.id}
              name={ws.displayName}
              listingPublic={listing ? isPublicStatus(listing.status) : false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
