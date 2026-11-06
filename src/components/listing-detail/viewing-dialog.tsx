"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarX, Clock, LogIn, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
import { createClient } from "@/lib/supabase/client";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bookViewingAction } from "@/components/listing-detail/actions";
import { OwnListingNotice } from "@/components/listing-detail/login-prompt";
import { loginHref } from "@/components/search/use-location-hash";
import type { InquiryTarget } from "@/components/listing-detail/inquiry-dialog";

/** Mindestvorlauf für Buchungen (wie in book_viewing). */
const MIN_LEAD_MS = 60 * 60 * 1000;

interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  available: number;
  capacity: number;
  note: string | null;
  myAppointmentId: string | null;
  myStatus: keyof typeof APPOINTMENT_STATUS | null;
  /** Mindestens eine Stunde im Voraus (sonst lehnt book_viewing ab) */
  bookable: boolean;
}

function useViewingSlots(listingId: string, enabled: boolean, userId: string | null) {
  return useQuery({
    queryKey: ["viewing-slots", listingId, userId ?? "anon"],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<Slot[]> => {
      const { data, error } = await createClient().rpc("get_viewing_slots", { p_listing_id: listingId });
      if (error) throw new Error(error.message);
      const now = Date.now();
      return (data ?? [])
        .filter((row): row is typeof row & { id: string; starts_at: string; ends_at: string } => Boolean(row.id && row.starts_at && row.ends_at))
        .map((row) => ({
          id: row.id,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          available: row.available ?? 0,
          capacity: row.capacity ?? 1,
          note: row.note,
          myAppointmentId: row.my_appointment_id,
          myStatus: row.my_status,
          bookable: new Date(row.starts_at).getTime() - now > MIN_LEAD_MS,
        }));
    },
  });
}

function groupByDay(slots: Slot[]): { day: string; slots: Slot[] }[] {
  const groups = new Map<string, Slot[]>();
  for (const slot of slots) {
    const day = formatDate(slot.startsAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    groups.set(day, [...(groups.get(day) ?? []), slot]);
  }
  return [...groups.entries()].map(([day, list]) => ({ day, slots: list }));
}

export function ViewingDialog({
  open,
  onOpenChange,
  target,
  onRequestByMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: InquiryTarget;
  onRequestByMessage: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Besichtigung anfragen</DialogTitle>
          <DialogDescription>Wählen Sie ein freies Zeitfenster. Alle Zeiten in Schweizer Zeit (Europe/Zurich).</DialogDescription>
        </DialogHeader>
        {open ? <ViewingBody target={target} onClose={() => onOpenChange(false)} onRequestByMessage={onRequestByMessage} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ViewingBody({ target, onClose, onRequestByMessage }: { target: InquiryTarget; onClose: () => void; onRequestByMessage: () => void }) {
  const { data: user, isLoading: userLoading } = useAuthUser();
  const queryClient = useQueryClient();
  const slotsQuery = useViewingSlots(target.listingId, !userLoading, user?.id ?? null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [bookedSlot, setBookedSlot] = React.useState<Slot | null>(null);

  if (userLoading || slotsQuery.isLoading) return <Spinner className="justify-self-center py-8" label="Zeitfenster werden geladen" />;
  if (user && user.id === target.ownerId) return <OwnListingNotice />;

  if (slotsQuery.isError) {
    return (
      <div className="grid gap-4">
        <Alert tone="error">Die Zeitfenster konnten nicht geladen werden. Bitte versuchen Sie es erneut.</Alert>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void slotsQuery.refetch()}>
            Erneut versuchen
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (bookedSlot) {
    return (
      <div className="grid gap-5">
        <Alert tone="success" title="Besichtigung angefragt">
          {formatDate(bookedSlot.startsAt, { weekday: "long", day: "numeric", month: "long" })}, {formatTime(bookedSlot.startsAt)}–
          {formatTime(bookedSlot.endsAt)} Uhr. Die Inserentin bzw. der Inserent bestätigt den Termin; Sie werden benachrichtigt.
        </Alert>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Schliessen
          </Button>
          <Button asChild>
            <Link href="/dashboard/besichtigungen">
              <CalendarCheck aria-hidden /> Meine Termine
            </Link>
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const all = slotsQuery.data ?? [];
  const existing = all.find((s) => s.myAppointmentId && s.myStatus && s.myStatus !== "cancelled");
  const bookable = all.filter((s) => s.bookable);
  const groups = groupByDay(bookable);

  if (existing) {
    return (
      <div className="grid gap-5">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold">Sie haben für dieses Inserat bereits einen Termin</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(existing.startsAt, { weekday: "long", day: "numeric", month: "long" })}, {formatTime(existing.startsAt)}–
            {formatTime(existing.endsAt)} Uhr
          </p>
          {existing.myStatus ? (
            <StatusBadge className="mt-2" label={APPOINTMENT_STATUS[existing.myStatus].label} tone={APPOINTMENT_STATUS[existing.myStatus].tone} />
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onRequestByMessage}>
            Nachricht senden
          </Button>
          <Button asChild>
            <Link href="/dashboard/besichtigungen">Termin verwalten</Link>
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className="grid gap-5">
        <div className="flex items-start gap-3 rounded-xl bg-surface p-4 text-sm">
          <CalendarX className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p>
            Derzeit sind keine Besichtigungstermine freigeschaltet. Fragen Sie per Nachricht nach einem Termin – die
            Inserentin bzw. der Inserent meldet sich bei Ihnen.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Schliessen
          </Button>
          <Button type="button" onClick={onRequestByMessage}>
            Besichtigung per Nachricht anfragen
          </Button>
        </DialogFooter>
      </div>
    );
  }

  async function book() {
    const slot = bookable.find((s) => s.id === selected);
    if (!slot) {
      toast.error("Bitte wählen Sie ein Zeitfenster.");
      return;
    }
    setSubmitting(true);
    const result = await bookViewingAction({ listingId: target.listingId, slotId: slot.id, message });
    setSubmitting(false);
    void queryClient.invalidateQueries({ queryKey: ["viewing-slots", target.listingId] });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Besichtigung angefragt.");
    setBookedSlot(slot);
  }

  return (
    <div className="grid gap-5">
      <div className="grid max-h-[46dvh] gap-5 overflow-y-auto overscroll-contain pr-1" role="group" aria-label="Freie Zeitfenster">
        {groups.map((group) => (
          <section key={group.day} aria-label={group.day}>
            <h3 className="mb-2 text-sm font-bold">{group.day}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.slots.map((slot) => {
                const full = slot.available <= 0;
                const active = selected === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    aria-pressed={active}
                    disabled={full}
                    onClick={() => setSelected(slot.id)}
                    className={cn(
                      "flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-xl border px-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55",
                      active ? "border-brand bg-mint-100 text-forest" : "border-border bg-card hover:border-mint-300 hover:bg-mint-50",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold tabular">
                      <Clock className="size-4" aria-hidden />
                      {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)} Uhr
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3.5" aria-hidden />
                      {full ? "Ausgebucht" : slot.capacity > 1 ? `${slot.available} von ${slot.capacity} Plätzen frei` : "Frei"}
                    </span>
                    {slot.note ? <span className="text-xs text-muted-foreground">{slot.note}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {user ? (
        <>
          <Field label="Nachricht an die Inserentin bzw. den Inserenten" htmlFor="besichtigung-nachricht" optional>
            <Textarea rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="z. B. Wir kommen zu zweit." />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onRequestByMessage}>
              Anderen Termin per Nachricht
            </Button>
            <Button type="button" onClick={() => void book()} loading={submitting} disabled={!selected}>
              <CalendarCheck aria-hidden /> Termin anfragen
            </Button>
          </DialogFooter>
        </>
      ) : (
        <DialogFooter>
          <Button asChild variant="outline">
            <Link href={loginHref(`/immobilien/${target.slug}`, "besichtigung", "/registrieren")}>Kostenlos registrieren</Link>
          </Button>
          <Button asChild>
            <Link href={loginHref(`/immobilien/${target.slug}`, "besichtigung")}>
              <LogIn aria-hidden /> Anmelden und Termin anfragen
            </Link>
          </Button>
        </DialogFooter>
      )}
    </div>
  );
}
