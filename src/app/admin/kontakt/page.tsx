import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Reply } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, FilterField, Pagination } from "@/components/admin/admin-ui";
import { ContactStatusSelect } from "@/components/admin/contact-status-select";
import { requireModerator } from "@/lib/auth/session";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  CONTACT_STATUS,
  parseEnumParam,
  parsePageParam,
  parseQueryParam,
  type ContactStatus,
  type SearchParamValue,
} from "@/lib/validation/admin";
import { listContactRequests } from "@/services/admin";

export const metadata: Metadata = { title: "Kontaktanfragen" };

const STATUSES = Object.keys(CONTACT_STATUS) as ContactStatus[];

export default async function AdminContactPage({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  await requireModerator();
  const params = await searchParams;
  const q = parseQueryParam(params.q);
  const status = parseEnumParam(params.status, STATUSES);
  const page = parsePageParam(params.seite);
  const result = await listContactRequests({ q, status, page });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Kontaktanfragen"
        description="Nachrichten aus dem Kontaktformular. Antworten Sie per E-Mail und setzen Sie danach den Status."
      />

      <FilterBar resetHref="/admin/kontakt">
        <FilterField label="Suche" htmlFor="q" className="sm:flex-1">
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Name, E-Mail oder Betreff" />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <NativeSelect id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Alle</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTACT_STATUS[s].label}
              </option>
            ))}
          </NativeSelect>
        </FilterField>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState icon={Inbox} title="Keine Kontaktanfragen" description="Für diese Filter gibt es keine Anfragen." />
      ) : (
        <ul className="grid gap-4" aria-label="Kontaktanfragen">
          {result.rows.map((request) => (
            <li key={request.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{request.subject}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {request.name} · <span className="break-all">{request.email}</span>
                    {request.userId ? (
                      <>
                        {" · "}
                        <Link href={`/admin/benutzer/${request.userId}`} className="font-medium text-primary hover:underline">
                          Konto
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground" title={formatDateTime(request.createdAt)}>
                    {formatRelative(request.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {request.status === "open" ? <Badge tone="amber">Neu</Badge> : null}
                  <ContactStatusSelect requestId={request.id} status={request.status} label={`Status der Anfrage «${request.subject}»`} />
                </div>
              </div>
              <p className="mt-4 whitespace-pre-line rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed">{request.message}</p>
              <div className="mt-4 flex justify-end">
                <Button asChild variant="outline" size="sm">
                  <a href={`mailto:${encodeURIComponent(request.email).replace("%40", "@")}?subject=${encodeURIComponent(`Ihre Anfrage: ${request.subject}`)}`}>
                    <Reply aria-hidden /> Per E-Mail antworten
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination basePath="/admin/kontakt" params={{ q, status }} page={result.page} pageCount={result.pageCount} total={result.total} />
    </div>
  );
}
