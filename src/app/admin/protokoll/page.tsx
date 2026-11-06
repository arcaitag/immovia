import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { CellLabel, DataList, DataRow, FilterBar, FilterField, Pagination } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { isUuid } from "@/lib/utils";
import {
  AUDIT_ENTITY_TYPES,
  auditActionLabel,
  firstParam,
  parseDateParam,
  parseEnumParam,
  parsePageParam,
  parseQueryParam,
  type SearchParamValue,
} from "@/lib/validation/admin";
import { listAuditLogs, type AuditLogRow } from "@/services/admin";
import type { Json } from "@/types/database";

export const metadata: Metadata = { title: "Protokoll" };

const COLUMNS = "minmax(0,1fr) minmax(0,1.6fr) minmax(0,1.4fr) minmax(0,1.2fr)";
const ENTITY_TYPES = Object.keys(AUDIT_ENTITY_TYPES);

function entityHref(row: AuditLogRow): string | null {
  if (!row.entityId) return null;
  if (row.entityType === "user" && isUuid(row.entityId)) return `/admin/benutzer/${row.entityId}`;
  if (row.entityType === "feature_setting") return "/admin/einstellungen";
  if (row.entityType === "report") return "/admin/meldungen?ansicht=alle";
  if (row.entityType === "contact_request") return "/admin/kontakt";
  return null;
}

function hasDetails(details: Json): boolean {
  return details !== null && typeof details === "object" && !Array.isArray(details) && Object.keys(details).length > 0;
}

export default async function AdminAuditLogPage({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  await requireAdmin();
  const params = await searchParams;
  const entityType = parseEnumParam(params.typ, ENTITY_TYPES);
  const action = parseQueryParam(params.aktion);
  const objectParam = firstParam(params.objekt)?.trim();
  const entityId = objectParam && objectParam.length <= 80 ? objectParam : undefined;
  const from = parseDateParam(params.von);
  const to = parseDateParam(params.bis);
  const page = parsePageParam(params.seite);
  const result = await listAuditLogs({ entityType, action, entityId, from, to, page });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Protokoll"
        description="Alle administrativen Eingriffe, unveränderlich gespeichert. Neueste Einträge zuerst."
      />

      <FilterBar resetHref="/admin/protokoll">
        <FilterField label="Bereich" htmlFor="typ">
          <NativeSelect id="typ" name="typ" defaultValue={entityType ?? ""}>
            <option value="">Alle</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {AUDIT_ENTITY_TYPES[t]}
              </option>
            ))}
          </NativeSelect>
        </FilterField>
        <FilterField label="Aktion beginnt mit" htmlFor="aktion">
          <Input id="aktion" name="aktion" defaultValue={action} placeholder="z. B. listing." />
        </FilterField>
        <FilterField label="Objekt-ID" htmlFor="objekt">
          <Input id="objekt" name="objekt" defaultValue={entityId} placeholder="UUID oder Schlüssel" />
        </FilterField>
        <FilterField label="Von" htmlFor="von">
          <Input id="von" name="von" type="date" defaultValue={from} />
        </FilterField>
        <FilterField label="Bis" htmlFor="bis">
          <Input id="bis" name="bis" type="date" defaultValue={to} />
        </FilterField>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="Keine Einträge" description="Für diese Filter gibt es keine Protokolleinträge." />
      ) : (
        <DataList label="Protokolleinträge" columns={COLUMNS} headers={["Zeitpunkt", "Aktion", "Objekt", "Ausgeführt von"]}>
          {result.rows.map((row) => {
            const href = entityHref(row);
            return (
              <DataRow key={row.id} columns={COLUMNS}>
                <div className="text-sm tabular">{formatDateTime(row.createdAt)}</div>
                <div className="min-w-0">
                  <CellLabel>Aktion</CellLabel>
                  <p className="text-sm font-semibold">{auditActionLabel(row.action)}</p>
                  {hasDetails(row.details) ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs font-medium text-primary">Details</summary>
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted px-3 py-2 font-mono text-[11px] leading-relaxed">
                        {JSON.stringify(row.details, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
                <div className="min-w-0 text-sm">
                  <CellLabel>Objekt</CellLabel>
                  <p>{AUDIT_ENTITY_TYPES[row.entityType] ?? row.entityType}</p>
                  {row.entityId ? (
                    href ? (
                      <Link href={href} className="block truncate font-mono text-xs text-primary hover:underline">
                        {row.entityId}
                      </Link>
                    ) : (
                      <p className="truncate font-mono text-xs text-muted-foreground">{row.entityId}</p>
                    )
                  ) : null}
                </div>
                <div className="min-w-0 text-sm">
                  <CellLabel>Ausgeführt von</CellLabel>
                  {row.actor ? (
                    <Link href={`/admin/benutzer/${row.actor.id}`} className="block truncate font-medium hover:text-forest">
                      {row.actor.displayName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">System</span>
                  )}
                </div>
              </DataRow>
            );
          })}
        </DataList>
      )}

      <Pagination
        basePath="/admin/protokoll"
        params={{ typ: entityType, aktion: action, objekt: entityId, von: from, bis: to }}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
      />
    </div>
  );
}
