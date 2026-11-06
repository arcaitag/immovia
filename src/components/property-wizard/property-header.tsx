import Link from "next/link";
import { ArrowLeft, ExternalLink, Eye, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { CompletenessMeter } from "@/components/property-wizard/completeness-meter";
import { PropertyThumb } from "@/components/property-wizard/property-thumb";
import { LISTING_STATUS, OFFER_TYPES, PROPERTY_TYPES } from "@/lib/constants";
import { isPublicStatus } from "@/lib/properties/listing-status";
import type { PropertyWorkspace } from "@/services/properties";

/** Kopfbereich aller Schritte einer Immobilie. */
export function PropertyHeader({ workspace }: { workspace: PropertyWorkspace }) {
  const { property, listing, cover, completeness, displayName, address } = workspace;
  const status = listing ? LISTING_STATUS[listing.status] : null;
  const publicUrl = listing && isPublicStatus(listing.status) && listing.slug ? `/immobilien/${listing.slug}` : null;
  return (
    <header className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <Link
        href="/dashboard/immobilien"
        className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted-foreground hover:text-forest"
      >
        <ArrowLeft className="size-4" aria-hidden /> Meine Immobilien
      </Link>
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <PropertyThumb image={cover} alt="" className="hidden size-20 sm:block" sizes="80px" />
          <div className="min-w-0 space-y-1.5">
            <h1 className="truncate font-display text-xl font-extrabold tracking-tight sm:text-2xl">{displayName}</h1>
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0">{address}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {status ? <StatusBadge label={status.label} tone={status.tone} /> : <Badge>Kein Inserat</Badge>}
              <Badge tone="outline">{PROPERTY_TYPES[property.property_type].label}</Badge>
              <Badge tone="outline">{OFFER_TYPES[property.offer_type].verb}</Badge>
              {listing?.moderation_status === "blocked" ? <Badge tone="red">Gesperrt</Badge> : null}
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:w-72">
          <CompletenessMeter fallback={completeness} />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/immobilien/${property.id}/inserat/vorschau`}>
                <Eye aria-hidden /> Vorschau
              </Link>
            </Button>
            {publicUrl ? (
              <Button asChild variant="outline" size="sm">
                <Link href={publicUrl} target="_blank" rel="noopener">
                  <ExternalLink aria-hidden /> Öffentliche Seite
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
