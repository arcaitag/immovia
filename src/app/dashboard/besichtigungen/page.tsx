import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, House } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SlotFormDialog } from "@/components/viewings/slot-form-dialog";
import { SellerScheduleView } from "@/components/viewings/seller-schedule";
import { GuestAppointments } from "@/components/viewings/guest-appointments";
import { ListingPicker } from "@/components/viewings/listing-picker";
import { requireUser } from "@/lib/auth/session";
import { utcToZurichParts } from "@/lib/format";
import { addDaysIso, isValidDateKey, startOfWeekIso, weekDaysIso, zurichDayStartUtc } from "@/lib/viewings/calendar";
import { cn, isUuid } from "@/lib/utils";
import { getManagedListings } from "@/services/leads";
import { countOpenRequestsByListing, getGuestAppointments, getSellerSchedule } from "@/services/viewings";

export const metadata: Metadata = { title: "Besichtigungen" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const BOOKABLE = new Set(["published", "reserved"]);

export default async function ViewingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/dashboard/besichtigungen");
  const sp = await searchParams;
  const now = new Date();
  const nowIso = now.toISOString();

  const [listings, guestAppointments] = await Promise.all([getManagedListings(user), getGuestAppointments(user.id)]);
  const hasListings = listings.length > 0;
  const view = first(sp.ansicht) === "termine" || !hasListings ? "termine" : "verwalten";
  const upcomingGuest = guestAppointments.filter(
    (a) => new Date(a.endsAt).getTime() > now.getTime() && ["requested", "confirmed", "reschedule_requested"].includes(a.status),
  ).length;

  const requested = first(sp.inserat);
  const listing =
    (requested && isUuid(requested) ? listings.find((l) => l.id === requested) : undefined) ??
    listings.find((l) => BOOKABLE.has(l.status)) ??
    listings[0] ??
    null;

  const tabs = (
    <nav aria-label="Ansicht" className="inline-flex h-11 items-center gap-1 self-start rounded-xl bg-muted p-1">
      {hasListings ? (
        <Link
          href={listing ? `/dashboard/besichtigungen?inserat=${listing.id}` : "/dashboard/besichtigungen"}
          aria-current={view === "verwalten" ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold transition-colors",
            view === "verwalten" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Meine Inserate
        </Link>
      ) : null}
      <Link
        href="/dashboard/besichtigungen?ansicht=termine"
        aria-current={view === "termine" ? "page" : undefined}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors",
          view === "termine" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
      >
        Meine Termine
        {upcomingGuest ? <span className="rounded-full bg-brand px-2 text-[11px] font-bold leading-5 text-white">{upcomingGuest}</span> : null}
      </Link>
    </nav>
  );

  if (view === "termine") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Besichtigungen"
          description="Ihre angefragten und bestätigten Besichtigungstermine. Alle Zeiten in Schweizer Zeit."
        />
        {tabs}
        <GuestAppointments appointments={guestAppointments} nowIso={nowIso} />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Besichtigungen" description="Zeitfenster anlegen und Termine verwalten." />
        <EmptyState
          icon={House}
          title="Noch kein Inserat"
          description="Erfassen Sie zuerst eine Immobilie und ein Inserat. Danach legen Sie hier Zeitfenster für Besichtigungen an."
          action={
            <Button asChild>
              <Link href="/dashboard/immobilien">Meine Immobilien</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const mode = first(sp.darstellung) === "woche" ? "woche" : "liste";
  const today = utcToZurichParts(now).date;
  const weekParam = first(sp.woche);
  const weekStart = startOfWeekIso(weekParam && isValidDateKey(weekParam) ? weekParam : today);
  const currentWeek = startOfWeekIso(today);
  const range =
    mode === "woche"
      ? { from: zurichDayStartUtc(weekStart), to: zurichDayStartUtc(addDaysIso(weekStart, 7)) }
      : { from: now, to: null };

  const [schedule, openCounts] = await Promise.all([
    getSellerSchedule(listing.id, user.id, range),
    countOpenRequestsByListing(listings.map((l) => l.id)),
  ]);
  const createButton = <SlotFormDialog key={listing.id} listingId={listing.id} listingTitle={listing.title} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Besichtigungen"
        description="Zeitfenster anlegen, Anfragen bestätigen und Termine verwalten. Alle Zeiten in Schweizer Zeit."
        actions={createButton}
      />
      {tabs}
      <div className="grid gap-4 sm:max-w-xl">
        <ListingPicker
          basePath="/dashboard/besichtigungen"
          value={listing.id}
          listings={listings.map((l) => {
            const open = openCounts.get(l.id) ?? 0;
            return {
              id: l.id,
              title: l.title,
              status: l.status,
              hint: open ? `${open} offene ${open === 1 ? "Anfrage" : "Anfragen"}` : undefined,
            };
          })}
        />
      </div>
      {!BOOKABLE.has(listing.status) ? (
        <Alert tone="warning" title="Dieses Inserat ist nicht veröffentlicht">
          Sie können bereits Zeitfenster anlegen. Interessenten können sie erst buchen, wenn das Inserat online ist.
        </Alert>
      ) : null}
      <SellerScheduleView
        listingId={listing.id}
        schedule={schedule}
        mode={mode}
        nowIso={nowIso}
        createButton={createButton}
        week={{
          days: weekDaysIso(weekStart),
          prev: addDaysIso(weekStart, -7),
          next: addDaysIso(weekStart, 7),
          current: weekStart,
          isCurrentWeek: weekStart === currentWeek,
        }}
      />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarCheck className="size-4" aria-hidden /> Doppelbuchungen sind ausgeschlossen: Die Datenbank sperrt jedes Zeitfenster während einer
        Buchung.
      </p>
    </div>
  );
}
