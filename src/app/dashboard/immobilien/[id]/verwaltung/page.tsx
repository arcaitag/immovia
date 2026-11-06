import Link from "next/link";
import { ArrowRight, CalendarCheck, ChartColumn, Eye, FileX, FolderLock, Heart, Inbox, MessageSquare, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { StepFooterNav, StepHeader } from "@/components/property-wizard/step-header";
import { ConversationList, ViewingList } from "@/components/dashboard/overview/activity-lists";
import { ListingStatusActions, type ListingStatusInfo } from "@/components/listing-editor/status-actions";
import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUS, LEAD_STATUS_ORDER } from "@/lib/constants";
import { formatDateLong, formatNumber } from "@/lib/format";
import { managementActions } from "@/lib/properties/listing-status";
import { getPropertyWorkspace, propertyStepTitle } from "@/services/properties";
import { getLeadStatusCounts, getListingStatistics, getRecentConversations, getUpcomingViewings } from "@/services/listings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: await propertyStepTitle(id, "Verkaufsverwaltung") };
}

function LinkRow({ href, icon: Icon, title, text }: { href: string; icon: typeof Users; title: string; text: string }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 rounded-xl border border-border p-3 hover:border-mint-300 hover:bg-mint-50">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export default async function SalesManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getPropertyWorkspace(id);
  const { property, listing, publishing, user } = ws;

  if (!listing) {
    return (
      <div className="grid gap-6">
        <StepHeader step={8} title="Verkaufsverwaltung" />
        <EmptyState icon={FileX} title="Für diese Immobilie besteht kein Inserat" />
      </div>
    );
  }

  const supabase = await createClient();
  const wasPublished = Boolean(listing.first_published_at);
  const [stats, leads, viewings, conversations] = await Promise.all([
    wasPublished ? getListingStatistics(supabase, listing.id, 30) : Promise.resolve(null),
    getLeadStatusCounts(supabase, listing.id),
    getUpcomingViewings(supabase, user, { limit: 5, listingId: listing.id }),
    getRecentConversations(supabase, { limit: 5, listingId: listing.id }),
  ]);
  const info: ListingStatusInfo = {
    listingId: listing.id,
    status: listing.status,
    offerType: listing.offer_type,
    requireReview: publishing.requireReview,
    approved: Boolean(listing.approved_at),
  };
  const closeActions = managementActions(info).filter((action) => action === "mark_sold" || action === "mark_rented");
  const isRent = listing.offer_type === "rent";

  return (
    <div className="grid gap-6">
      <StepHeader
        step={8}
        title="Verkaufsverwaltung"
        description={`Anfragen, Besichtigungen und Nachrichten zu diesem Inserat${listing.first_published_at ? ` – online seit ${formatDateLong(listing.first_published_at)}` : ""}.`}
      />

      {!wasPublished ? (
        <Alert
          tone="info"
          title="Noch nicht veröffentlicht"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/immobilien/${property.id}/veroeffentlichen`}>Zur Veröffentlichung</Link>
            </Button>
          }
        >
          Interessenten können erst nach der Veröffentlichung anfragen. Kennzahlen erscheinen ab dann hier.
        </Alert>
      ) : null}

      {stats ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Kennzahlen">
          <li>
            <StatCard label="Aufrufe" value={formatNumber(stats.views_total)} icon={Eye} hint="Pro Besucher und Tag einmal gezählt" />
          </li>
          <li>
            <StatCard label="Auf Merklisten" value={formatNumber(stats.favorites)} icon={Heart} />
          </li>
          <li>
            <StatCard label="Anfragen" value={formatNumber(stats.inquiries)} icon={Inbox} hint={`${formatNumber(stats.leads)} Interessenten`} />
          </li>
          <li>
            <StatCard label="Besichtigungen" value={formatNumber(stats.viewings)} icon={CalendarCheck} hint="Bestätigt oder durchgeführt" />
          </li>
        </ul>
      ) : wasPublished ? (
        <Alert tone="warning">Die Kennzahlen konnten gerade nicht geladen werden.</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Interessenten nach Status</CardTitle>
              <CardDescription>{leads.total === 0 ? "Noch keine Interessenten." : `${formatNumber(leads.total)} insgesamt`}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {leads.total > 0 ? (
              <ul className="grid gap-2">
                {LEAD_STATUS_ORDER.filter((status) => (leads.byStatus[status] ?? 0) > 0).map((status) => (
                  <li key={status} className="flex items-center justify-between gap-3">
                    <StatusBadge label={LEAD_STATUS[status].label} tone={LEAD_STATUS[status].tone} />
                    <span className="font-display font-bold tabular">{formatNumber(leads.byStatus[status] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <LinkRow
              href={`/dashboard/interessenten?inserat=${listing.id}`}
              icon={Users}
              title="Interessenten verwalten"
              text="Status, Notizen und Kontakte"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nächste Besichtigungen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ViewingList items={viewings} showListing={false} />
            <LinkRow
              href={`/dashboard/besichtigungen?inserat=${listing.id}`}
              icon={CalendarCheck}
              title="Zeitfenster und Termine"
              text="Besichtigungen anbieten und bestätigen"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Letzte Nachrichten</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 px-2 sm:px-3">
            <ConversationList items={conversations} />
            <div className="px-3">
              <LinkRow href="/dashboard/nachrichten" icon={MessageSquare} title="Alle Nachrichten" text="Mit Interessenten schreiben" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unterlagen und Auswertung</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <LinkRow
              href={`/dashboard/dokumente?immobilie=${property.id}`}
              icon={FolderLock}
              title="Dokumente"
              text="Grundbuchauszug, Pläne und Reglemente gezielt freigeben"
            />
            <LinkRow
              href={`/dashboard/statistiken?inserat=${listing.id}`}
              icon={ChartColumn}
              title="Statistik"
              text="Aufrufe und Anfragen im Zeitverlauf"
            />
          </CardContent>
        </Card>
      </div>

      {closeActions.length ? (
        <Card className="border-mint-300">
          <CardHeader>
            <CardTitle>{isRent ? "Mieter gefunden?" : "Käufer gefunden?"}</CardTitle>
            <CardDescription>
              Markieren Sie das Inserat als {isRent ? "vermietet" : "verkauft"}. Es verschwindet aus der Suche; Nachrichten und
              Unterlagen bleiben erhalten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ListingStatusActions info={info} only={closeActions} />
          </CardContent>
        </Card>
      ) : listing.status === "sold" || listing.status === "rented" ? (
        <Alert tone="success" title={listing.status === "sold" ? "Verkauft" : "Vermietet"}>
          {listing.closed_at ? `Abgeschlossen am ${formatDateLong(listing.closed_at)}.` : "Abgeschlossen."}
        </Alert>
      ) : null}

      <StepFooterNav propertyId={property.id} current="verwaltung" />
    </div>
  );
}
