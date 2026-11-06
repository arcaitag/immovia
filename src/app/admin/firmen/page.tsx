import type { Metadata } from "next";
import { BadgeCheck, Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CellLabel, DataList, DataRow, FilterBar, FilterField, Pagination } from "@/components/admin/admin-ui";
import { OrganizationActions } from "@/components/admin/organization-actions";
import { requireModerator } from "@/lib/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import { parseEnumParam, parsePageParam, parseQueryParam, type SearchParamValue } from "@/lib/validation/admin";
import { ORG_STATUS } from "@/lib/validation/organization";
import { listOrganizations } from "@/services/admin";

export const metadata: Metadata = { title: "Firmen" };

const COLUMNS = "minmax(0,2fr) minmax(0,1.4fr) minmax(0,0.9fr) minmax(0,1fr) 2.75rem";

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  const viewer = await requireModerator();
  const params = await searchParams;
  const q = parseQueryParam(params.q);
  const status = parseEnumParam(params.status, ["active", "suspended"] as const);
  const page = parsePageParam(params.seite);
  const result = await listOrganizations({ q, status, page });

  return (
    <div className="grid gap-6">
      <PageHeader title="Firmen" description="Firmenkonten von Immobilienfirmen, Maklern und Verwaltungen prüfen, verifizieren oder sperren." />

      <FilterBar resetHref="/admin/firmen">
        <FilterField label="Suche" htmlFor="q" className="sm:flex-1">
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Name, Ort oder UID" />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <NativeSelect id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Alle</option>
            <option value="active">{ORG_STATUS.active.label}</option>
            <option value="suspended">{ORG_STATUS.suspended.label}</option>
          </NativeSelect>
        </FilterField>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState icon={Building2} title="Keine Firmen gefunden" description="Es gibt noch keine Firmenkonten oder keine passen zu den Filtern." />
      ) : (
        <DataList label="Firmen" columns={COLUMNS} headers={["Firma", "Inhaber/in", "Team", "Status", ""]}>
          {result.rows.map((org) => (
            <DataRow key={org.id} columns={COLUMNS}>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-semibold">
                  {org.name}
                  {org.verification === "verified" ? <BadgeCheck className="size-4 shrink-0 text-brand" aria-label="Verifiziert" /> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[org.location, org.uidNumber].filter(Boolean).join(" · ") || "Keine Adresse"} · seit {formatDate(org.createdAt)}
                </p>
              </div>
              <div className="min-w-0 text-sm">
                <CellLabel>Inhaber/in</CellLabel>
                <p className="truncate">{org.owner?.displayName ?? "–"}</p>
                <p className="truncate text-xs text-muted-foreground">{org.owner?.email ?? ""}</p>
              </div>
              <div className="text-sm">
                <CellLabel>Team</CellLabel>
                {formatNumber(org.memberCount)} {org.memberCount === 1 ? "Mitglied" : "Mitglieder"}
                <p className="text-xs text-muted-foreground">{formatNumber(org.activeListings)} aktive Inserate</p>
              </div>
              <div>
                <CellLabel>Status</CellLabel>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge label={ORG_STATUS[org.status].label} tone={ORG_STATUS[org.status].tone} />
                  {!org.isPublic ? <Badge tone="neutral">Nicht öffentlich</Badge> : null}
                </div>
              </div>
              <div className="flex md:justify-end">
                <OrganizationActions
                  organizationId={org.id}
                  name={org.name}
                  slug={org.slug}
                  status={org.status}
                  isPublic={org.isPublic}
                  ownerId={org.owner?.id ?? null}
                  verification={org.verification}
                  isAdmin={viewer.isAdmin}
                />
              </div>
            </DataRow>
          ))}
        </DataList>
      )}

      <Pagination basePath="/admin/firmen" params={{ q, status }} page={result.page} pageCount={result.pageCount} total={result.total} />
    </div>
  );
}
