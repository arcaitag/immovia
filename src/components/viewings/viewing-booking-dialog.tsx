"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarX } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { formatDateTime, formatTime } from "@/lib/format";
import { groupByZurichDay } from "@/lib/viewings/calendar";
import { dayLabel } from "@/components/chat/utils";
import { bookViewingAction } from "@/app/dashboard/besichtigungen/actions";

interface SlotRow {
  id: string;
  startsAt: string;
  endsAt: string;
  available: number;
  note: string | null;
  myAppointmentId: string | null;
  myStatus: keyof typeof APPOINTMENT_STATUS | null;
}

const BOOKING_LEAD_MS = 60 * 60_000;

/**
 * Besichtigung anfragen: zeigt freie Zeitfenster (get_viewing_slots) und bucht über book_viewing.
 * Kann auch auf der öffentlichen Inseratseite verwendet werden.
 */
export function ViewingBookingDialog({
  listingId,
  listingTitle,
  open,
  onOpenChange,
  onBooked,
}: {
  listingId: string;
  listingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBooked?: (appointmentId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [slotId, setSlotId] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const queryKey = ["viewing-slots", listingId] as const;
  const { data, isPending, isError } = useQuery({
    queryKey,
    enabled: open,
    staleTime: 0,
    queryFn: async (): Promise<SlotRow[]> => {
      const { data: rows, error } = await createClient().rpc("get_viewing_slots", { p_listing_id: listingId });
      if (error) throw new Error(error.message);
      return (rows ?? [])
        .filter((r): r is typeof r & { id: string; starts_at: string; ends_at: string } => Boolean(r.id && r.starts_at && r.ends_at))
        .map((r) => ({
          id: r.id,
          startsAt: r.starts_at,
          endsAt: r.ends_at,
          available: Number(r.available ?? 0),
          note: r.note,
          myAppointmentId: r.my_appointment_id,
          myStatus: r.my_status,
        }));
    },
  });

  const now = new Date();
  const existing = (data ?? []).find((s) => s.myAppointmentId && s.myStatus && s.myStatus !== "cancelled");
  const bookable = (data ?? []).filter((s) => new Date(s.startsAt).getTime() - now.getTime() > BOOKING_LEAD_MS);
  const days = groupByZurichDay(bookable, (s) => s.startsAt);

  function close(next: boolean) {
    if (!next) {
      setSlotId("");
      setMessage("");
    }
    onOpenChange(next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!slotId) {
      toast.error("Bitte wählen Sie ein Zeitfenster.");
      return;
    }
    startTransition(async () => {
      const res = await bookViewingAction({ slotId, message: message.trim() || undefined });
      if (res.ok) {
        toast.success(res.message ?? "Besichtigung angefragt.");
        void queryClient.invalidateQueries({ queryKey });
        onBooked?.(res.data.appointmentId);
        close(false);
      } else {
        toast.error(res.error);
        void queryClient.invalidateQueries({ queryKey });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <form onSubmit={submit} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Besichtigung anfragen</DialogTitle>
            <DialogDescription>
              {listingTitle}. Wählen Sie ein freies Zeitfenster. Die Verkäuferseite bestätigt den Termin, Sie werden benachrichtigt.
            </DialogDescription>
          </DialogHeader>

          {existing ? (
            <Alert tone="info" title="Sie haben bereits einen Termin">
              {formatDateTime(existing.startsAt)}–{formatTime(existing.endsAt)} ({APPOINTMENT_STATUS[existing.myStatus ?? "requested"].label}).
              Pro Inserat ist ein offener Termin möglich. Änderungen verwalten Sie unter «Besichtigungen».
            </Alert>
          ) : null}

          {isPending ? (
            <div className="grid gap-2" aria-hidden>
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : isError ? (
            <Alert tone="error">Die Zeitfenster konnten nicht geladen werden. Bitte versuchen Sie es erneut.</Alert>
          ) : days.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-8 text-center">
              <CalendarX className="mb-3 size-6 text-forest" aria-hidden />
              <p className="font-semibold">Zurzeit sind keine Zeitfenster frei.</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Schreiben Sie der Verkäuferseite eine Nachricht, um einen Termin zu vereinbaren.
              </p>
            </div>
          ) : (
            <RadioGroup value={slotId} onValueChange={setSlotId} aria-label="Zeitfenster" className="max-h-[45dvh] gap-4 overflow-y-auto pr-1">
              {days.map((day) => (
                <div key={day.date} className="grid gap-2">
                  <p className="text-sm font-semibold text-muted-foreground">{dayLabel(day.date, now)}</p>
                  {day.items.map((slot) => {
                    const full = slot.available <= 0;
                    return (
                      <RadioCard key={slot.id} value={slot.id} disabled={full || Boolean(existing)} className="justify-between disabled:cursor-not-allowed disabled:opacity-60">
                        <span>
                          <span className="block tabular">
                            {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)} Uhr
                          </span>
                          {slot.note ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{slot.note}</span> : null}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {full ? "Ausgebucht" : slot.available === 1 ? "1 Platz frei" : `${slot.available} Plätze frei`}
                        </span>
                      </RadioCard>
                    );
                  })}
                </div>
              ))}
            </RadioGroup>
          )}

          {days.length > 0 && !existing ? (
            <Field label="Nachricht an die Verkäuferseite" htmlFor="booking-message" optional hint="Z. B. mit wie vielen Personen Sie kommen.">
              <Textarea id="booking-message" value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} className="min-h-20" />
            </Field>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Schliessen
            </Button>
            {days.length > 0 && !existing ? (
              <Button type="submit" loading={pending} disabled={!slotId}>
                Termin anfragen
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
