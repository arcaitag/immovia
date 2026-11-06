import Link from "next/link";
import Form from "next/form";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Gemeinsame Bausteine der Admin-Seiten (Server Components):
 * Filterleiste (GET-Formular), Seitennavigation und responsive Listen.
 */

export function FilterBar({ children, resetHref, className }: { children: React.ReactNode; resetHref: string; className?: string }) {
  return (
    <Form
      action=""
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-end", className)}
    >
      {children}
      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          <ListFilter aria-hidden /> Filtern
        </Button>
        <Button asChild variant="ghost">
          <Link href={resetHref}>Zurücksetzen</Link>
        </Button>
      </div>
    </Form>
  );
}

export function FilterField({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5 sm:min-w-44", className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Baut eine URL mit den aktuellen Filtern und einer anderen Seite. */
export function hrefWith(basePath: string, params: Record<string, string | undefined>, overrides: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  basePath,
  params,
  page,
  pageCount,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <nav aria-label="Seiten" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        {formatNumber(total)} {total === 1 ? "Eintrag" : "Einträge"} · Seite {page} von {pageCount}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefWith(basePath, params, { seite: String(page - 1) })} rel="prev">
              <ChevronLeft aria-hidden /> Zurück
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft aria-hidden /> Zurück
          </Button>
        )}
        {page < pageCount ? (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefWith(basePath, params, { seite: String(page + 1) })} rel="next">
              Weiter <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Weiter <ChevronRight aria-hidden />
          </Button>
        )}
      </div>
    </nav>
  );
}

/**
 * Liste mit Kopfzeile ab md (Tabellenoptik) und Karten auf Mobile.
 * columns: CSS-Grid-Spaltendefinition für md und grösser.
 */
export function DataList({ columns, headers, children, label }: { columns: string; headers: string[]; children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div
        className="hidden border-b border-border bg-muted/60 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid md:gap-4 md:[grid-template-columns:var(--cols)]"
        style={{ "--cols": columns } as React.CSSProperties}
        aria-hidden
      >
        {headers.map((header, index) => (
          <span key={`${header}-${index}`}>{header}</span>
        ))}
      </div>
      <ul aria-label={label} className="divide-y divide-border">
        {children}
      </ul>
    </div>
  );
}

export function DataRow({ columns, children, className }: { columns: string; children: React.ReactNode; className?: string }) {
  return (
    <li
      className={cn("grid gap-3 px-5 py-4 md:items-center md:gap-4 md:[grid-template-columns:var(--cols)] [&>*]:min-w-0", className)}
      style={{ "--cols": columns } as React.CSSProperties}
    >
      {children}
    </li>
  );
}

/** Beschriftung einer Zelle auf Mobile (ab md ausgeblendet, dort gibt es die Kopfzeile). */
export function CellLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:hidden">{children}</span>;
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {action}
    </div>
  );
}

/** Zeitraumwahl (7/30/90/365 Tage) als Links. */
export function PeriodNav({ basePath, days, options = [7, 30, 90, 365] }: { basePath: string; days: number; options?: readonly number[] }) {
  return (
    <nav aria-label="Zeitraum" className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Link
          key={option}
          href={option === 30 ? basePath : `${basePath}?tage=${option}`}
          aria-current={days === option ? "page" : undefined}
          className={cn(
            "rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:border-mint-300 hover:bg-mint-50",
            days === option && "border-brand bg-mint-100 text-forest",
          )}
        >
          {option === 365 ? "12 Monate" : `${option} Tage`}
        </Link>
      ))}
    </nav>
  );
}

/** Werte eines Diagramms als aufklappbare Tabelle (Barrierefreiheit, exakte Werte). */
export function ValuesTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <details className="group rounded-xl border border-border">
      <summary className="cursor-pointer select-none rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted">
        Werte als Tabelle anzeigen
      </summary>
      <div className="max-h-80 overflow-auto border-t border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-card">
            <tr>
              {columns.map((column, index) => (
                <th key={column} scope="col" className={cn("px-4 py-2 text-xs font-semibold text-muted-foreground", index === 0 ? "text-left" : "text-right")}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border">
                {row.map((cell, index) => (
                  <td key={index} className={cn("px-4 py-1.5", index === 0 ? "text-left" : "text-right")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
