import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ChevronRight, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CellLabel, DataList, DataRow, FilterBar, FilterField, Pagination } from "@/components/admin/admin-ui";
import { requireModerator } from "@/lib/auth/session";
import { formatDate, formatRelative } from "@/lib/format";
import {
  APP_ROLES,
  USER_STATUS,
  parseEnumParam,
  parsePageParam,
  parseQueryParam,
  type SearchParamValue,
} from "@/lib/validation/admin";
import { searchUsers } from "@/services/admin";

export const metadata: Metadata = { title: "Benutzer" };

const COLUMNS = "minmax(0,2.2fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr) 2.5rem";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  const viewer = await requireModerator();
  const params = await searchParams;
  const q = parseQueryParam(params.q);
  const status = parseEnumParam(params.status, ["active", "suspended"] as const);
  const role = viewer.isAdmin ? parseEnumParam(params.rolle, ["admin", "moderator"] as const) : undefined;
  const page = parsePageParam(params.seite);
  const result = await searchUsers({ q, status, role, page });
  const current = { q, status, rolle: role };

  return (
    <div className="grid gap-6">
      <PageHeader title="Benutzer" description="Konten suchen, prüfen und bei Bedarf sperren. Änderungen werden im Protokoll festgehalten." />

      <FilterBar resetHref="/admin/benutzer">
        <FilterField label="Suche" htmlFor="q" className="sm:flex-1">
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="E-Mail, Name oder Benutzer-ID" />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <NativeSelect id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Alle</option>
            <option value="active">{USER_STATUS.active.label}</option>
            <option value="suspended">{USER_STATUS.suspended.label}</option>
          </NativeSelect>
        </FilterField>
        {viewer.isAdmin ? (
          <FilterField label="Rolle" htmlFor="rolle">
            <NativeSelect id="rolle" name="rolle" defaultValue={role ?? ""}>
              <option value="">Alle</option>
              <option value="admin">{APP_ROLES.admin.label}</option>
              <option value="moderator">{APP_ROLES.moderator.label}</option>
            </NativeSelect>
          </FilterField>
        ) : null}
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState icon={Users} title="Keine Benutzer gefunden" description="Passen Sie die Suche oder die Filter an." />
      ) : (
        <DataList label="Benutzer" columns={COLUMNS} headers={["Benutzer", "Status", viewer.isAdmin ? "Rollen" : "Inserate", "Registriert", ""]}>
          {result.rows.map((user) => (
            <DataRow key={user.id} columns={COLUMNS} className="relative hover:bg-mint-50/60">
              <div>
                <Link href={`/admin/benutzer/${user.id}`} className="font-semibold after:absolute after:inset-0 hover:text-forest">
                  {user.displayName}
                </Link>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  {user.email ?? "–"}
                  {user.identityVerified ? <BadgeCheck className="size-3.5 shrink-0 text-brand" aria-label="Identität verifiziert" /> : null}
                </p>
              </div>
              <div>
                <CellLabel>Status</CellLabel>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge label={USER_STATUS[user.status].label} tone={USER_STATUS[user.status].tone} />
                  {!user.emailConfirmed ? <Badge tone="amber">E-Mail offen</Badge> : null}
                </div>
              </div>
              <div>
                <CellLabel>{viewer.isAdmin ? "Rollen" : "Inserate"}</CellLabel>
                {viewer.isAdmin ? (
                  user.roles && user.roles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles.map((r) => (
                        <Badge key={r} tone="dark">
                          {APP_ROLES[r].label}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">–</span>
                  )
                ) : (
                  <span className="text-sm tabular">{user.listingCount}</span>
                )}
              </div>
              <div className="text-sm">
                <CellLabel>Registriert</CellLabel>
                <p>{formatDate(user.createdAt)}</p>
                <p className="text-xs text-muted-foreground">
                  {user.lastSignInAt ? `aktiv ${formatRelative(user.lastSignInAt)}` : "noch nie angemeldet"}
                </p>
              </div>
              <ChevronRight className="hidden size-4 justify-self-end text-muted-foreground md:block" aria-hidden />
            </DataRow>
          ))}
        </DataList>
      )}

      <Pagination basePath="/admin/benutzer" params={current} page={result.page} pageCount={result.pageCount} total={result.total} />
    </div>
  );
}
