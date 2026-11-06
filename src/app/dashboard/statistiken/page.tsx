import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ChartColumn, Eye, Heart, Inbox, Rocket } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ListingCharts } from "@/components/statistics/listing-charts";
import { ListingPicker } from "@/components/statistics/listing-picker";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LISTING_STATUS, PROPERTY_TYPES } from "@/lib/constants";
import { formatDateLong, formatNumber, formatRooms } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getListingStatistics, getStatisticsListings } from "@/services/listings";

export const metadata: Metadata = { title: "Statistiken" };

const RANGES = [30, 90] as const;

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser("/dashboard/statistiken");
  const supabase = await createClient();
  const listings = await getStatisticsListings(supabase, user);

  const header = (
    <PageHeader
      title="Statistiken"
      description="Aufrufe, Merklisten, Anfragen und Besichtigungen Ihrer Inserate. Gezählt werden nur echte Ereignisse; wiederholte Aufrufe derselben Person am selben Tag zählen einmal."
    />
  );

  if (listings.length === 0) {
    return (
      <div className="grid gap-6">
        {header}
        <EmptyState
          icon={ChartColumn}
          title="Noch keine Statistik"
          description="Sobald ein Inserat veröffentlicht ist, sehen Sie hier, wie oft es aufgerufen, gemerkt und angefragt wird."
          action={
            <Button asChild>
              <Link href="/dashboard/immobilien">Zu meinen Immobilien</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const days = params.tage === "90" ? 90 : 30;
  const selected = listings.find((listing) => listing.id === params.inserat) ?? listings[0];
  if (!selected) return null;
  const stats = await getListingStatistics(supabase, selected.id, days);
  const options = listings.map((listing) => {
    const fallback = [
      listing.rooms !== null && listing.property_type !== "plot" ? `${formatRooms(listing.rooms, false)}-Zimmer-` : "",
      PROPERTY_TYPES[listing.property_type].label,
      listing.municipality ? ` in ${listing.municipality}` : "",
    ].join("");
    return { id: listing.id, label: `${listing.title?.trim() || fallback} · ${LISTING_STATUS[listing.status].label}` };
  });
  const periodViews = stats ? stats.series.reduce((sum, point) => sum + point.views, 0) : 0;
  const periodInquiries = stats ? stats.series.reduce((sum, point) => sum + point.inquiries, 0) : 0;

  return (
    <div className="grid gap-6">
      {header}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <ListingPicker options={options} value={selected.id} days={days} />
        <nav aria-label="Zeitraum" className="flex gap-1 rounded-xl bg-muted p-1">
          {RANGES.map((range) => (
            <Link
              key={range}
              href={`/dashboard/statistiken?inserat=${selected.id}&tage=${range}`}
              scroll={false}
              aria-current={range === days ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold transition-colors",
                range === days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {range} Tage
            </Link>
          ))}
        </nav>
      </div>

      {stats ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge label={LISTING_STATUS[selected.status].label} tone={LISTING_STATUS[selected.status].tone} />
            {stats.published_at ? <span>Veröffentlicht seit {formatDateLong(stats.published_at)}</span> : null}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Summen seit der Veröffentlichung">
            <li>
              <StatCard label="Aufrufe" value={formatNumber(stats.views_total)} icon={Eye} hint={`${formatNumber(periodViews)} in ${days} Tagen`} />
            </li>
            <li>
              <StatCard label="Auf Merklisten" value={formatNumber(stats.favorites)} icon={Heart} />
            </li>
            <li>
              <StatCard
                label="Anfragen"
                value={formatNumber(stats.inquiries)}
                icon={Inbox}
                hint={`${formatNumber(periodInquiries)} in ${days} Tagen`}
              />
            </li>
            <li>
              <StatCard label="Besichtigungen" value={formatNumber(stats.viewings)} icon={CalendarCheck} hint="Bestätigt oder durchgeführt" />
            </li>
          </ul>
          {stats.views_total === 0 && stats.inquiries === 0 ? (
            <Alert tone="neutral" title="Noch keine Aufrufe">
              Teilen Sie den Link zu Ihrem Inserat, um mehr Interessenten zu erreichen.
            </Alert>
          ) : null}
          <ListingCharts series={stats.series} />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Rocket className="size-3.5" aria-hidden /> Datengrundlage: Aufrufe der öffentlichen Inseratseite (anonymisiert),
            Merklisten, Kontaktanfragen und Besichtigungstermine.
          </p>
        </>
      ) : (
        <Alert tone="warning">Die Statistik konnte nicht geladen werden. Bitte versuchen Sie es später erneut.</Alert>
      )}
    </div>
  );
}
