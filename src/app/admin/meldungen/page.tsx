import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { NativeSelect } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CellLabel, DataList, DataRow, FilterBar, FilterField, Pagination, hrefWith } from "@/components/admin/admin-ui";
import { ReportReview } from "@/components/admin/report-review";
import { requireModerator } from "@/lib/auth/session";
import { REPORT_REASONS } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn, truncate } from "@/lib/utils";
import { REPORT_STATUS, REPORT_TARGET_TYPES, parseEnumParam, parsePageParam, type SearchParamValue } from "@/lib/validation/admin";
import { listReports, type ReportQueue } from "@/services/admin";

export const metadata: Metadata = { title: "Meldungen" };

const COLUMNS = "minmax(0,2.2fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,0.9fr) 7rem";
const QUEUES: Array<{ value: ReportQueue; label: string }> = [
  { value: "offen", label: "Offen" },
  { value: "erledigt", label: "Erledigt" },
  { value: "alle", label: "Alle" },
];
const TARGET_TYPES = Object.keys(REPORT_TARGET_TYPES);

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  const viewer = await requireModerator();
  const params = await searchParams;
  const queue = parseEnumParam(params.ansicht, ["offen", "erledigt", "alle"] as const) ?? "offen";
  const targetType = parseEnumParam(params.typ, TARGET_TYPES);
  const page = parsePageParam(params.seite);
  const result = await listReports({ queue, targetType, page });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Meldungen"
        description="Gemeldete Inserate, Benutzer, Nachrichten und Firmen prüfen. Die älteste offene Meldung steht zuoberst."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <nav aria-label="Ansicht" className="flex flex-wrap gap-2">
          {QUEUES.map((q) => (
            <Link
              key={q.value}
              href={hrefWith("/admin/meldungen", { typ: targetType }, { ansicht: q.value === "offen" ? undefined : q.value })}
              aria-current={queue === q.value ? "page" : undefined}
              className={cn(
                "rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:border-mint-300 hover:bg-mint-50",
                queue === q.value && "border-brand bg-mint-100 text-forest",
              )}
            >
              {q.label}
            </Link>
          ))}
        </nav>
        <FilterBar resetHref="/admin/meldungen" className="p-3 shadow-none sm:w-auto">
          {queue !== "offen" ? <input type="hidden" name="ansicht" value={queue} /> : null}
          <FilterField label="Betrifft" htmlFor="typ">
            <NativeSelect id="typ" name="typ" defaultValue={targetType ?? ""}>
              <option value="">Alles</option>
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REPORT_TARGET_TYPES[t]}
                </option>
              ))}
            </NativeSelect>
          </FilterField>
        </FilterBar>
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          icon={Flag}
          title={queue === "offen" ? "Keine offenen Meldungen" : "Keine Meldungen"}
          description={queue === "offen" ? "Alles erledigt. Neue Meldungen erscheinen hier automatisch." : "Für diese Auswahl gibt es keine Meldungen."}
        />
      ) : (
        <DataList label="Meldungen" columns={COLUMNS} headers={["Grund", "Betrifft", "Gemeldet von", "Status", ""]}>
          {result.rows.map((report) => (
            <DataRow key={report.id} columns={COLUMNS}>
              <div className="min-w-0">
                <p className="font-semibold">{(REPORT_REASONS as Record<string, string>)[report.reason] ?? report.reason}</p>
                {report.details ? <p className="text-xs leading-relaxed text-muted-foreground">{truncate(report.details, 160)}</p> : null}
                <p className="text-xs text-muted-foreground" title={formatDateTime(report.createdAt)}>
                  {formatRelative(report.createdAt)}
                </p>
              </div>
              <div className="text-sm">
                <CellLabel>Betrifft</CellLabel>
                {REPORT_TARGET_TYPES[report.targetType] ?? report.targetType}
              </div>
              <div className="min-w-0 text-sm">
                <CellLabel>Gemeldet von</CellLabel>
                {report.reporter ? (
                  <Link href={`/admin/benutzer/${report.reporter.id}`} className="block truncate font-medium hover:text-forest">
                    {report.reporter.displayName}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Gelöschtes Konto</span>
                )}
              </div>
              <div>
                <CellLabel>Status</CellLabel>
                <StatusBadge label={REPORT_STATUS[report.status].label} tone={REPORT_STATUS[report.status].tone} />
                {report.handler ? <p className="mt-1 text-xs text-muted-foreground">von {report.handler}</p> : null}
              </div>
              <div className="flex md:justify-end">
                <ReportReview
                  isAdmin={viewer.isAdmin}
                  report={{
                    id: report.id,
                    targetType: report.targetType,
                    reason: report.reason,
                    details: report.details,
                    status: report.status,
                    createdAt: report.createdAt,
                    reporterName: report.reporter?.displayName ?? null,
                    resolutionNote: report.resolutionNote,
                  }}
                />
              </div>
            </DataRow>
          ))}
        </DataList>
      )}

      <Pagination
        basePath="/admin/meldungen"
        params={{ ansicht: queue === "offen" ? undefined : queue, typ: targetType }}
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
      />
    </div>
  );
}
