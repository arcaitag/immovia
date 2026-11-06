"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarDays, CalendarX, ChevronLeft, ChevronRight, Clock, EllipsisVertical, Hourglass, LayoutList, Trash2, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/sonner";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { formatDate, formatTime, formatTimeRange } from "@/lib/format";
import { groupByZurichDay, zurichDateKey } from "@/lib/viewings/calendar";
import { cn } from "@/lib/utils";
import type { AppointmentItem, MoveTarget, SellerSchedule as Schedule, SlotItem } from "@/services/viewings";
import { AppointmentActions, CancelDialog } from "@/components/viewings/appointment-actions";
import { cancelSlotAction, deleteSlotAction } from "@/app/dashboard/besichtigungen/actions";
import { dayLabel } from "@/components/chat/utils";

export interface WeekNavigation {
  days: string[];
  prev: string;
  next: string;
  current: string;
  isCurrentWeek: boolean;
}

function AppointmentRow({ appointment, moveTargets, nowIso }: { appointment: AppointmentItem; moveTargets: MoveTarget[]; nowIso: string }) {
  const status = APPOINTMENT_STATUS[appointment.status];
  return (
    <div className="flex flex-wrap items-start gap-3 py-3">
      <Avatar src={appointment.guest?.avatarUrl} name={appointment.guest?.name} className="size-9" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{appointment.guest?.name ?? "Gelöschtes Konto"}</p>
          <StatusBadge label={status.label} tone={status.tone} />
          {appointment.notes.length ? <Badge tone="outline">{appointment.notes.length} Notiz{appointment.notes.length === 1 ? "" : "en"}</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground tabular">{formatTimeRange(appointment.startsAt, appointment.endsAt)}</p>
        {appointment.guestMessage ? <p className="mt-1 whitespace-pre-wrap text-sm">«{appointment.guestMessage}»</p> : null}
        {appointment.cancelReason && appointment.status !== "confirmed" ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {appointment.status === "reschedule_requested" ? "Wunsch" : "Grund"}: {appointment.cancelReason}
          </p>
        ) : null}
      </div>
      <AppointmentActions appointment={appointment} moveTargets={moveTargets} nowIso={nowIso} />
    </div>
  );
}

function SlotActions({ slot }: { slot: SlotItem }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"cancel" | "delete" | null>(null);
  const [pending, startTransition] = React.useTransition();

  function cancel(reason?: string) {
    startTransition(async () => {
      const res = await cancelSlotAction({ slotId: slot.id, reason });
      if (res.ok) {
        toast.success(res.message ?? "Zeitfenster abgesagt.");
        setDialog(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteSlotAction({ slotId: slot.id });
      if (res.ok) {
        toast.success(res.message ?? "Zeitfenster gelöscht.");
        setDialog(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Aktionen zum Zeitfenster" disabled={pending}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {slot.booked > 0 ? (
            <DropdownMenuItem destructive onSelect={() => setDialog("cancel")}>
              <CalendarX /> Zeitfenster absagen
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem destructive onSelect={() => setDialog("delete")}>
              <Trash2 /> Zeitfenster löschen
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CancelDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => setDialog(o ? "cancel" : null)}
        title="Zeitfenster absagen"
        description={`${slot.booked === 1 ? "Ein Termin wird" : `${slot.booked} Termine werden`} abgesagt. Alle Betroffenen werden benachrichtigt.`}
        pending={pending}
        onConfirm={cancel}
        confirmLabel="Zeitfenster absagen"
      />
      <AlertDialog open={dialog === "delete"} onOpenChange={(o) => setDialog(o ? "delete" : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zeitfenster löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatTimeRange(slot.startsAt, slot.endsAt)}. Es gibt keine Buchungen, das Zeitfenster wird entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SlotCard({ slot, moveTargets, nowIso }: { slot: SlotItem; moveTargets: MoveTarget[]; nowIso: string }) {
  const full = slot.booked >= slot.capacity;
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", full ? "bg-forest text-white" : "bg-mint-100 text-forest")}>
          <Clock className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tabular">
            {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)} Uhr
          </p>
          <p className="text-xs text-muted-foreground">
            {slot.booked} von {slot.capacity} {slot.capacity === 1 ? "Platz" : "Plätzen"} belegt
            {slot.note ? ` · ${slot.note}` : ""}
          </p>
        </div>
        {full ? <Badge tone="dark">Ausgebucht</Badge> : <Badge tone="green">{slot.capacity - slot.booked} frei</Badge>}
        <SlotActions slot={slot} />
      </div>
      {slot.appointments.length ? (
        <div className="divide-y divide-border border-t border-border px-4">
          {slot.appointments.map((a) => (
            <AppointmentRow key={a.id} appointment={a} moveTargets={moveTargets} nowIso={nowIso} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ViewToggle({ listingId, mode, week }: { listingId: string; mode: "liste" | "woche"; week: string }) {
  const base = `/dashboard/besichtigungen?inserat=${listingId}`;
  const item = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors",
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div className="inline-flex h-11 items-center gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Darstellung">
      <Link href={base} className={item(mode === "liste")} aria-current={mode === "liste" ? "page" : undefined}>
        <LayoutList className="size-4" aria-hidden /> Liste
      </Link>
      <Link href={`${base}&darstellung=woche&woche=${week}`} className={item(mode === "woche")} aria-current={mode === "woche" ? "page" : undefined}>
        <CalendarDays className="size-4" aria-hidden /> Woche
      </Link>
    </div>
  );
}

export function SellerScheduleView({
  listingId,
  schedule,
  mode,
  week,
  nowIso,
  createButton,
}: {
  listingId: string;
  schedule: Schedule;
  mode: "liste" | "woche";
  week: WeekNavigation;
  nowIso: string;
  createButton: React.ReactNode;
}) {
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const now = new Date(nowIso);
  const days = groupByZurichDay(schedule.slots, (s) => s.startsAt);
  const slotInDialog = schedule.slots.find((s) => s.id === selectedSlot) ?? null;
  const pastByDay = groupByZurichDay(schedule.past, (a) => a.startsAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Offene Anfragen" value={schedule.stats.openRequests} icon={Hourglass} hint="Warten auf Ihre Bestätigung" />
        <StatCard label="Bestätigte Termine" value={schedule.stats.upcomingConfirmed} icon={CalendarCheck} hint="Anstehend" />
        <StatCard label="Freie Plätze" value={schedule.stats.freeSpots} icon={Users} hint="In künftigen Zeitfenstern" />
      </div>

      {schedule.requests.length ? (
        <Card className="border-mint-300">
          <CardHeader>
            <CardTitle>Offene Anfragen</CardTitle>
            <CardDescription>Bestätigen Sie die Termine oder schlagen Sie ein anderes Zeitfenster vor.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {schedule.requests.map((a) => (
              <AppointmentRow key={a.id} appointment={a} moveTargets={schedule.moveTargets} nowIso={nowIso} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Zeitfenster</h2>
        <ViewToggle listingId={listingId} mode={mode} week={week.current} />
      </div>

      {mode === "woche" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">
              {formatDate(`${week.days[0]}T12:00:00Z`, { day: "numeric", month: "long", year: undefined })} –{" "}
              {formatDate(`${week.days[6]}T12:00:00Z`, { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/besichtigungen?inserat=${listingId}&darstellung=woche&woche=${week.prev}`} aria-label="Vorherige Woche">
                  <ChevronLeft aria-hidden />
                </Link>
              </Button>
              {!week.isCurrentWeek ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/besichtigungen?inserat=${listingId}&darstellung=woche`}>Diese Woche</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/besichtigungen?inserat=${listingId}&darstellung=woche&woche=${week.next}`} aria-label="Nächste Woche">
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-7">
            {week.days.map((day) => {
              const slots = schedule.slots.filter((s) => zurichDateKey(s.startsAt) === day);
              const isToday = day === zurichDateKey(now);
              return (
                <div key={day} className={cn("rounded-2xl border border-border bg-card p-3", isToday && "border-brand")}>
                  <p className={cn("mb-2 text-sm font-semibold", isToday ? "text-primary" : "text-foreground")}>
                    {formatDate(`${day}T12:00:00Z`, { weekday: "short", day: "numeric", month: "numeric", year: undefined })}
                  </p>
                  {slots.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Keine Zeitfenster</p>
                  ) : (
                    <ul className="grid gap-1.5">
                      {slots.map((slot) => {
                        const full = slot.booked >= slot.capacity;
                        const hasRequest = slot.appointments.some((a) => a.status === "requested" || a.status === "reschedule_requested");
                        return (
                          <li key={slot.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedSlot(slot.id)}
                              className={cn(
                                "flex min-h-11 w-full flex-col items-start rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                                full ? "border-forest bg-forest text-white" : "border-mint-200 bg-mint-50 text-forest hover:bg-mint-100",
                                hasRequest && !full && "border-warning/40 bg-warning-bg text-warning",
                              )}
                            >
                              <span className="font-semibold tabular">
                                {formatTime(slot.startsAt)}–{formatTime(slot.endsAt)}
                              </span>
                              <span>
                                {slot.booked}/{slot.capacity} belegt{hasRequest ? " · Anfrage" : ""}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <Dialog open={slotInDialog !== null} onOpenChange={(o) => !o && setSelectedSlot(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{slotInDialog ? dayLabel(zurichDateKey(slotInDialog.startsAt), now) : "Zeitfenster"}</DialogTitle>
                <DialogDescription>Buchungen und Aktionen zu diesem Zeitfenster.</DialogDescription>
              </DialogHeader>
              {slotInDialog ? <SlotCard slot={slotInDialog} moveTargets={schedule.moveTargets} nowIso={nowIso} /> : null}
            </DialogContent>
          </Dialog>
        </div>
      ) : days.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Noch keine anstehenden Zeitfenster"
          description="Legen Sie Zeitfenster an, damit Interessenten auf der Inseratseite und im Chat einen Besichtigungstermin anfragen können."
          action={createButton}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.date} aria-labelledby={`tag-${day.date}`} className="grid gap-3">
              <h3 id={`tag-${day.date}`} className="text-sm font-semibold text-muted-foreground" suppressHydrationWarning>
                {dayLabel(day.date, now)}
              </h3>
              {day.items.map((slot) => (
                <SlotCard key={slot.id} slot={slot} moveTargets={schedule.moveTargets} nowIso={nowIso} />
              ))}
            </section>
          ))}
        </div>
      )}

      {schedule.past.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Vergangene Termine</CardTitle>
            <CardDescription>Letzte 30 Tage. Markieren Sie Termine als durchgeführt oder nicht erschienen.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {pastByDay
              .slice()
              .reverse()
              .map((day) => (
                <div key={day.date}>
                  <p className="text-sm font-semibold text-muted-foreground" suppressHydrationWarning>
                    {dayLabel(day.date, now)}
                  </p>
                  <div className="divide-y divide-border">
                    {day.items.map((a) => (
                      <AppointmentRow key={a.id} appointment={a} moveTargets={schedule.moveTargets} nowIso={nowIso} />
                    ))}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
