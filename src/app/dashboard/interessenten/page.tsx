import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, House, MessageSquare, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { LeadFilters } from "@/components/leads/lead-filters";
import { RatingStars } from "@/components/leads/lead-rating";
import { requireUser } from "@/lib/auth/session";
import { LEAD_STATUS, LEAD_STATUS_ORDER, type LeadStatus } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn, isUuid } from "@/lib/utils";
import { parseLeadSort, type LeadSort } from "@/lib/validation/lead";
import { getManagedListings, LEAD_PAGE_SIZE, listLeads } from "@/services/leads";

export const metadata: Metadata = { title: "Interessenten" };

const SOURCE_LABELS: Record<string, string> = { inquiry: "Anfrage", viewing: "Besichtigung", manual: "Manuell erfasst" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function hrefWith(params: { inserat?: string | null; status?: string | null; sortierung?: LeadSort; seite?: number }): string {
  const search = new URLSearchParams();
  if (params.inserat) search.set("inserat", params.inserat);
  if (params.status) search.set("status", params.status);
  if (params.sortierung && params.sortierung !== "aktivitaet") search.set("sortierung", params.sortierung);
  if (params.seite && params.seite > 1) search.set("seite", String(params.seite));
  return `/dashboard/interessenten${search.size ? `?${search.toString()}` : ""}`;
}

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/dashboard/interessenten");
  const sp = await searchParams;
  const listingParam = first(sp.inserat);
  const statusParam = first(sp.status);
  const listingId = listingParam && isUuid(listingParam) ? listingParam : null;
  const status = statusParam && statusParam in LEAD_STATUS ? (statusParam as LeadStatus) : null;
  const sort = parseLeadSort(first(sp.sortierung));
  const pageNumber = Math.max(1, Math.min(500, Number(first(sp.seite)) || 1));

  const [listings, result] = await Promise.all([
    getManagedListings(user),
    listLeads({ listingId: listingId ?? undefined, status: status ?? undefined, sort, page: pageNumber }),
  ]);
  const totalAll = Object.values(result.statusCounts).reduce((sum, n) => sum + n, 0);
  const pages = Math.max(1, Math.ceil(result.total / LEAD_PAGE_SIZE));
  const selectedListing = listings.find((l) => l.id === listingId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Interessenten"
        description="Alle Personen, die sich für Ihre Inserate interessieren. Status, Bewertung und Notizen sehen nur Sie."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/nachrichten">
              <MessageSquare aria-hidden /> Nachrichten
            </Link>
          </Button>
        }
      />

      {listings.length === 0 && totalAll === 0 ? (
        <EmptyState
          icon={Users}
          title="Noch keine Interessenten"
          description="Sobald jemand eine Anfrage zu einem Ihrer Inserate sendet oder eine Besichtigung bucht, erscheint die Person hier."
          action={
            <Button asChild>
              <Link href="/dashboard/immobilien">
                <House aria-hidden /> Meine Immobilien
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <LeadFilters
            listings={listings.map((l) => ({ id: l.id, title: l.title }))}
            listingId={listingId}
            status={status}
            sort={sort}
          />

          <nav aria-label="Nach Status filtern" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex min-w-max gap-2 pb-1 sm:min-w-0 sm:flex-wrap">
              <li>
                <Link
                  href={hrefWith({ inserat: listingId, sortierung: sort })}
                  aria-current={!status ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                    !status ? "border-forest bg-forest text-white" : "border-border bg-card hover:border-mint-300 hover:bg-mint-50",
                  )}
                >
                  Alle <span className={cn("tabular", !status ? "text-white/80" : "text-muted-foreground")}>{totalAll}</span>
                </Link>
              </li>
              {LEAD_STATUS_ORDER.map((key) => {
                const count = result.statusCounts[key] ?? 0;
                const active = status === key;
                if (!count && !active) return null;
                return (
                  <li key={key}>
                    <Link
                      href={hrefWith({ inserat: listingId, status: key, sortierung: sort })}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                        active ? "border-forest bg-forest text-white" : "border-border bg-card hover:border-mint-300 hover:bg-mint-50",
                      )}
                    >
                      {LEAD_STATUS[key].label}
                      <span className={cn("tabular", active ? "text-white/80" : "text-muted-foreground")}>{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {result.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title={status || listingId ? "Keine Interessenten mit diesem Filter" : "Noch keine Interessenten"}
              description={
                selectedListing
                  ? `Zu «${selectedListing.title}» gibt es noch keine passenden Kontakte.`
                  : "Sobald jemand eine Anfrage sendet oder eine Besichtigung bucht, erscheint die Person hier."
              }
              action={
                status || listingId ? (
                  <Button asChild variant="outline">
                    <Link href="/dashboard/interessenten">Filter zurücksetzen</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_12rem_7rem_9rem] gap-4 border-b border-border bg-surface py-3 pl-5 pr-16 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Person</span>
                <span>Inserat</span>
                <span>Status</span>
                <span>Bewertung</span>
                <span>Letzte Aktivität</span>
              </div>
              <ul className="divide-y divide-border">
                {result.items.map((lead) => (
                  <li key={lead.id} className="relative transition-colors hover:bg-mint-50/60">
                    <div className="grid gap-3 py-4 pl-4 pr-16 sm:pl-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_12rem_7rem_9rem] lg:items-center lg:gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar src={lead.interested?.avatarUrl} name={lead.interested?.name} className="size-10" />
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/interessenten/${lead.id}`}
                            className="block truncate font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                          >
                            {lead.interested?.name ?? "Gelöschtes Konto"}
                          </Link>
                          <p className="text-xs text-muted-foreground">{SOURCE_LABELS[lead.source] ?? "Kontakt"}</p>
                        </div>
                      </div>
                      <p className="truncate text-sm text-muted-foreground lg:text-foreground">{lead.listing?.title ?? "Inserat entfernt"}</p>
                      <div className="flex flex-wrap items-center gap-3 lg:contents">
                        <span>
                          <StatusBadge label={LEAD_STATUS[lead.status].label} tone={LEAD_STATUS[lead.status].tone} />
                        </span>
                        <RatingStars value={lead.rating} />
                        <span className="text-xs text-muted-foreground lg:text-sm" title={formatDateTime(lead.lastActivityAt)} suppressHydrationWarning>
                          {formatRelative(lead.lastActivityAt)}
                        </span>
                      </div>
                    </div>
                    {lead.conversationId ? (
                      <Link
                        href={`/dashboard/nachrichten/${lead.conversationId}`}
                        className="absolute right-3 top-3 z-10 inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-mint-100 hover:text-forest lg:top-1/2 lg:-translate-y-1/2"
                        aria-label={`Nachrichten mit ${lead.interested?.name ?? "Interessent"}`}
                      >
                        <MessageSquare className="size-5" aria-hidden />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {pages > 1 ? (
            <nav aria-label="Seiten" className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Seite {pageNumber} von {pages} · {result.total} Interessenten
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className={cn(pageNumber <= 1 && "pointer-events-none opacity-50")}>
                  <Link href={hrefWith({ inserat: listingId, status, sortierung: sort, seite: pageNumber - 1 })} aria-disabled={pageNumber <= 1}>
                    <ChevronLeft aria-hidden /> Zurück
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className={cn(pageNumber >= pages && "pointer-events-none opacity-50")}>
                  <Link href={hrefWith({ inserat: listingId, status, sortierung: sort, seite: pageNumber + 1 })} aria-disabled={pageNumber >= pages}>
                    Weiter <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
