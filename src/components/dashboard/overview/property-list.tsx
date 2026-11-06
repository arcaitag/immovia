import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PropertyThumb } from "@/components/property-wizard/property-thumb";
import { PropertyRowActions } from "@/components/dashboard/overview/property-row-actions";
import type { ListingStatusInfo } from "@/components/listing-editor/status-actions";
import { LISTING_STATUS, OFFER_TYPES, PROPERTY_TYPES } from "@/lib/constants";
import { isPublicStatus } from "@/lib/properties/listing-status";
import { stepHref } from "@/lib/properties/steps";
import type { PropertyOverview } from "@/services/properties";

function statusInfo(item: PropertyOverview, requireReview: boolean): ListingStatusInfo | null {
  if (!item.listing) return null;
  return {
    listingId: item.listing.id,
    status: item.listing.status,
    offerType: item.listing.offer_type,
    requireReview,
    approved: Boolean(item.listing.approved_at),
  };
}

function publicUrlOf(item: PropertyOverview): string | null {
  return item.listing && isPublicStatus(item.listing.status) && item.listing.slug ? `/immobilien/${item.listing.slug}` : null;
}

function Status({ item }: { item: PropertyOverview }) {
  if (!item.listing) return <Badge>Kein Inserat</Badge>;
  const status = LISTING_STATUS[item.listing.status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StatusBadge label={status.label} tone={status.tone} />
      {item.listing.moderation_status === "blocked" ? <Badge tone="red">Gesperrt</Badge> : null}
    </span>
  );
}

function NextStepLink({ item }: { item: PropertyOverview }) {
  if (!item.next) return <span className="text-sm text-muted-foreground">Abgeschlossen</span>;
  return (
    <Link
      href={stepHref(item.property.id, item.next.key)}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-primary hover:underline"
    >
      {item.next.title} <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

/** «Meine Immobilien»: Tabelle auf grossen Bildschirmen, Karten auf Mobilgeräten. */
export function PropertyList({ items, requireReview }: { items: PropertyOverview[]; requireReview: boolean }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Immobilie</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40">Vollständigkeit</TableHead>
              <TableHead>Nächster Schritt</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Aktionen</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.property.id}>
                <TableCell>
                  <Link href={`/dashboard/immobilien/${item.property.id}`} className="flex items-center gap-3">
                    <PropertyThumb image={item.cover} alt="" className="size-14" sizes="56px" />
                    <span className="min-w-0">
                      <span className="block max-w-xs truncate font-semibold hover:text-primary">{item.displayName}</span>
                      <span className="block max-w-xs truncate text-xs text-muted-foreground">{item.address}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="block text-sm">{PROPERTY_TYPES[item.property.property_type].label}</span>
                  <span className="block text-xs text-muted-foreground">{OFFER_TYPES[item.property.offer_type].verb}</span>
                </TableCell>
                <TableCell>
                  <Status item={item} />
                </TableCell>
                <TableCell>
                  <div className="grid gap-1.5">
                    <span className="text-sm font-semibold tabular">{item.completeness.percent} %</span>
                    <Progress value={item.completeness.percent} className="h-1.5" aria-label={`Vollständigkeit ${item.completeness.percent} Prozent`} />
                  </div>
                </TableCell>
                <TableCell>
                  <NextStepLink item={item} />
                </TableCell>
                <TableCell className="text-right">
                  <PropertyRowActions
                    propertyId={item.property.id}
                    name={item.displayName}
                    listing={statusInfo(item, requireReview)}
                    publicUrl={publicUrlOf(item)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {items.map((item) => (
          <li key={item.property.id} className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex gap-3 p-4">
              <Link href={`/dashboard/immobilien/${item.property.id}`} className="flex min-w-0 flex-1 gap-3">
                <PropertyThumb image={item.cover} alt="" className="size-16" sizes="64px" />
                <span className="min-w-0 space-y-1">
                  <span className="block truncate font-semibold">{item.displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.address}</span>
                  <Status item={item} />
                </span>
              </Link>
              <PropertyRowActions
                propertyId={item.property.id}
                name={item.displayName}
                listing={statusInfo(item, requireReview)}
                publicUrl={publicUrlOf(item)}
              />
            </div>
            <div className="grid gap-2 border-t border-border px-4 py-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  {PROPERTY_TYPES[item.property.property_type].label} · {OFFER_TYPES[item.property.offer_type].verb}
                </span>
                <span className="font-semibold tabular">{item.completeness.percent} % vollständig</span>
              </div>
              <Progress value={item.completeness.percent} className="h-1.5" aria-label={`Vollständigkeit ${item.completeness.percent} Prozent`} />
              <NextStepLink item={item} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
