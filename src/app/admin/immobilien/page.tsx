import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileCheck, Flag, House } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { CellLabel, DataList, DataRow, FilterBar, FilterField, Pagination, hrefWith } from "@/components/admin/admin-ui";
import { ListingActions } from "@/components/admin/listing-actions";
import { requireModerator } from "@/lib/auth/session";
import { LISTING_STATUS, OFFER_TYPES, PROPERTY_TYPES, type ListingStatus } from "@/lib/constants";
import { formatChf, formatRelative } from "@/lib/format";
import { cn, isUuid } from "@/lib/utils";
import {
  MODERATION_STATUS,
  firstParam,
  parseEnumParam,
  parsePageParam,
  parseQueryParam,
  type SearchParamValue,
} from "@/lib/validation/admin";
import { listListings } from "@/services/admin";

export const metadata: Metadata = { title: "Inserate" };

const COLUMNS = "minmax(0,2.4fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,0.9fr) 2.75rem";
const LISTING_STATUSES = Object.keys(LISTING_STATUS) as ListingStatus[];

const QUICK_FILTERS = [
  { label: "Alle", params: {} },
  { label: "Zur Prüfung", params: { status: "pending_review" } },
  { label: "Veröffentlicht", params: { status: "published" } },
  { label: "Markiert", params: { moderation: "flagged" } },
  { label: "Gesperrt", params: { moderation: "blocked" } },
] as const;

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  const viewer = await requireModerator();
  const params = await searchParams;
  const q = parseQueryParam(params.q);
  const status = parseEnumParam(params.status, LISTING_STATUSES);
  const moderation = parseEnumParam(params.moderation, ["ok", "flagged", "blocked"] as const);
  const ownerParam = firstParam(params.inhaber);
  const ownerId = isUuid(ownerParam) ? ownerParam : undefined;
  const page = parsePageParam(params.seite);
  const result = await listListings({ q, status, moderation, ownerId, page });
  const current = { q, status, moderation, inhaber: ownerId };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Inserate"
        description="Inserate prüfen, freigeben, markieren oder sperren. Eigentümer werden bei Sperren und Zurückweisungen informiert."
      />

      <nav aria-label="Schnellfilter" className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((filter) => {
          const filterStatus = "status" in filter.params ? filter.params.status : undefined;
          const filterModeration = "moderation" in filter.params ? filter.params.moderation : undefined;
          const active = filterStatus === status && filterModeration === moderation && !q && !ownerId;
          return (
            <Link
              key={filter.label}
              href={hrefWith("/admin/immobilien", {}, filter.params)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:border-mint-300 hover:bg-mint-50",
                active && "border-brand bg-mint-100 text-forest",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <FilterBar resetHref="/admin/immobilien">
        <FilterField label="Suche" htmlFor="q" className="sm:flex-1">
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Titel, Ort oder PLZ" />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <NativeSelect id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Alle</option>
            {LISTING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LISTING_STATUS[s].label}
              </option>
            ))}
          </NativeSelect>
        </FilterField>
        <FilterField label="Moderation" htmlFor="moderation">
          <NativeSelect id="moderation" name="moderation" defaultValue={moderation ?? ""}>
            <option value="">Alle</option>
            {(["ok", "flagged", "blocked"] as const).map((m) => (
              <option key={m} value={m}>
                {MODERATION_STATUS[m].label}
              </option>
            ))}
          </NativeSelect>
        </FilterField>
        {ownerId ? <input type="hidden" name="inhaber" value={ownerId} /> : null}
      </FilterBar>

      {ownerId ? (
        <Alert tone="info">
          Es werden nur Inserate eines bestimmten Kontos angezeigt.{" "}
          <Link href={`/admin/benutzer/${ownerId}`} className="font-semibold underline underline-offset-2">
            Konto anzeigen
          </Link>
        </Alert>
      ) : null}

      {result.rows.length === 0 ? (
        <EmptyState icon={House} title="Keine Inserate gefunden" description="Für diese Filter gibt es keine Inserate." />
      ) : (
        <DataList label="Inserate" columns={COLUMNS} headers={["Inserat", "Status", "Prüfungen", "Geändert", ""]}>
          {result.rows.map((listing) => (
            <DataRow key={listing.id} columns={COLUMNS}>
              <div className="min-w-0">
                <p className="truncate font-semibold">{listing.title ?? "Ohne Titel"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {PROPERTY_TYPES[listing.propertyType].label} · {OFFER_TYPES[listing.offerType].verb} ·{" "}
                  {listing.priceOnRequest ? "Preis auf Anfrage" : formatChf(listing.price)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {listing.location || "Ort fehlt"} · {listing.owner.displayName}
                  {listing.organization ? ` · ${listing.organization.name}` : ""}
                </p>
                {listing.moderationReason && listing.moderationStatus !== "ok" ? (
                  <p className="mt-1 text-xs text-warning">Grund: {listing.moderationReason}</p>
                ) : null}
              </div>
              <div>
                <CellLabel>Status</CellLabel>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge label={LISTING_STATUS[listing.status].label} tone={LISTING_STATUS[listing.status].tone} />
                  {listing.moderationStatus !== "ok" ? (
                    <StatusBadge label={MODERATION_STATUS[listing.moderationStatus].label} tone={MODERATION_STATUS[listing.moderationStatus].tone} />
                  ) : null}
                  {listing.isDemo ? <Badge tone="outline">Demo</Badge> : null}
                  {listing.openReports > 0 ? (
                    <Badge tone="amber">
                      <Flag aria-hidden /> {listing.openReports}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div>
                <CellLabel>Prüfungen</CellLabel>
                <div className="flex flex-wrap gap-1.5">
                  {listing.verifications.ownership === "verified" ? (
                    <Badge tone="green">
                      <BadgeCheck aria-hidden /> Eigentum
                    </Badge>
                  ) : null}
                  {listing.verifications.documentation_complete === "verified" ? (
                    <Badge tone="green">
                      <FileCheck aria-hidden /> Unterlagen
                    </Badge>
                  ) : null}
                  {listing.verifications.ownership !== "verified" && listing.verifications.documentation_complete !== "verified" ? (
                    <span className="text-sm text-muted-foreground">Keine</span>
                  ) : null}
                </div>
              </div>
              <div className="text-sm">
                <CellLabel>Geändert</CellLabel>
                {formatRelative(listing.status === "pending_review" ? listing.statusChangedAt : listing.updatedAt)}
              </div>
              <div className="flex md:justify-end">
                <ListingActions
                  listingId={listing.id}
                  propertyId={listing.propertyId}
                  ownerId={listing.owner.id}
                  slug={listing.slug}
                  status={listing.status}
                  moderationStatus={listing.moderationStatus}
                  verifications={listing.verifications}
                  isAdmin={viewer.isAdmin}
                  title={listing.title ?? "Ohne Titel"}
                />
              </div>
            </DataRow>
          ))}
        </DataList>
      )}

      <Pagination basePath="/admin/immobilien" params={current} page={result.page} pageCount={result.pageCount} total={result.total} />
    </div>
  );
}
