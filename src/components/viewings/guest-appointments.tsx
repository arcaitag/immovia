"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarArrowDown, CalendarClock, CalendarX, House, MapPin, MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/sonner";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/format";
import type { AppointmentAction } from "@/lib/validation/viewing";
import type { GuestAppointment } from "@/services/viewings";
import { CancelDialog } from "@/components/viewings/appointment-actions";
import { appointmentAction } from "@/app/dashboard/besichtigungen/actions";

function GuestAppointmentCard({ appointment, nowIso }: { appointment: GuestAppointment; nowIso: string }) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"cancel" | "reschedule" | null>(null);
  const [pending, startTransition] = React.useTransition();
  const status = APPOINTMENT_STATUS[appointment.status];
  const upcoming = new Date(appointment.startsAt).getTime() > new Date(nowIso).getTime();
  const active = ["requested", "confirmed", "reschedule_requested"].includes(appointment.status);
  const listingHref = appointment.listing.slug ? `/immobilien/${appointment.listing.slug}` : null;

  function run(action: AppointmentAction, reason?: string) {
    startTransition(async () => {
      const res = await appointmentAction({ appointmentId: appointment.id, action, reason });
      if (res.ok) {
        toast.success(res.message ?? "Gespeichert.");
        setDialog(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-xl bg-mint-100 sm:h-24 sm:w-32">
          {appointment.listing.imageUrl ? (
            <Image src={appointment.listing.imageUrl} alt="" fill sizes="(min-width: 640px) 128px, 100vw" className="object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-forest">
              <House className="size-6" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={status.label} tone={status.tone} />
            {!appointment.listing.isPublic ? <span className="text-xs text-muted-foreground">Inserat nicht mehr öffentlich</span> : null}
          </div>
          <p className="mt-2 font-display text-lg font-bold leading-snug">
            {formatDate(appointment.startsAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="text-[0.9375rem] font-semibold tabular text-forest">
            {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)} Uhr
          </p>
          <p className="mt-1 truncate text-sm">
            {listingHref ? (
              <Link href={listingHref} className="font-medium hover:underline">
                {appointment.listing.title}
              </Link>
            ) : (
              appointment.listing.title
            )}
          </p>
          {appointment.listing.address ? (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden /> {appointment.listing.address}
            </p>
          ) : null}
          {appointment.cancelReason && appointment.status !== "confirmed" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {appointment.status === "reschedule_requested" ? "Ihr Wunsch" : "Grund"}: {appointment.cancelReason}
            </p>
          ) : null}
          {appointment.status === "requested" ? (
            <p className="mt-2 text-sm text-muted-foreground">Die Verkäuferseite bestätigt den Termin. Sie werden benachrichtigt.</p>
          ) : null}
        </div>
      </div>
      {(active && upcoming) || appointment.conversationId ? (
        <div className="flex flex-wrap gap-2 border-t border-border bg-surface px-4 py-3 sm:px-5">
          {active && upcoming ? (
            <Button asChild size="sm" variant="outline">
              <a href={`/api/viewings/${appointment.id}/ics`}>
                <CalendarArrowDown aria-hidden /> Kalender
              </a>
            </Button>
          ) : null}
          {appointment.conversationId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/nachrichten/${appointment.conversationId}`}>
                <MessageSquare aria-hidden /> Nachricht
              </Link>
            </Button>
          ) : null}
          {active && upcoming && appointment.status !== "reschedule_requested" ? (
            <Button size="sm" variant="ghost" onClick={() => setDialog("reschedule")} disabled={pending}>
              <CalendarClock aria-hidden /> Änderung anfragen
            </Button>
          ) : null}
          {active && upcoming ? (
            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive-bg" onClick={() => setDialog("cancel")} disabled={pending}>
              <CalendarX aria-hidden /> Absagen
            </Button>
          ) : null}
        </div>
      ) : null}
      <CancelDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => setDialog(o ? "cancel" : null)}
        title="Termin absagen"
        description="Die Verkäuferseite wird informiert. Der Platz wird für andere Interessenten frei."
        pending={pending}
        onConfirm={(reason) => run("cancel", reason)}
      />
      <CancelDialog
        open={dialog === "reschedule"}
        onOpenChange={(o) => setDialog(o ? "reschedule" : null)}
        title="Änderung anfragen"
        description="Teilen Sie mit, wann es Ihnen besser passt. Die Verkäuferseite kann den Termin verschieben."
        label="Ihr Wunsch"
        confirmLabel="Änderung anfragen"
        pending={pending}
        onConfirm={(reason) => run("request_reschedule", reason)}
      />
    </Card>
  );
}

export function GuestAppointments({ appointments, nowIso }: { appointments: GuestAppointment[]; nowIso: string }) {
  const now = new Date(nowIso).getTime();
  const upcoming = appointments
    .filter((a) => new Date(a.endsAt).getTime() > now && a.status !== "cancelled")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = appointments.filter((a) => !upcoming.includes(a));

  if (!appointments.length) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Noch keine Besichtigungstermine"
        description="Termine fragen Sie auf der Inseratseite oder im Chat mit der Verkäuferseite an. Hier sehen Sie danach Status, Kalendereintrag und Änderungen."
        action={
          <Button asChild>
            <Link href="/immobilien">
              <Search aria-hidden /> Immobilien suchen
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="termine-anstehend" className="grid gap-4">
        <h2 id="termine-anstehend" className="font-display text-xl font-bold">
          Anstehend
        </h2>
        {upcoming.length ? (
          upcoming.map((a) => <GuestAppointmentCard key={a.id} appointment={a} nowIso={nowIso} />)
        ) : (
          <p className="text-sm text-muted-foreground">Keine anstehenden Termine.</p>
        )}
      </section>
      {past.length ? (
        <section aria-labelledby="termine-frueher" className="grid gap-4">
          <h2 id="termine-frueher" className="font-display text-xl font-bold">
            Frühere und abgesagte Termine
          </h2>
          {past.map((a) => (
            <GuestAppointmentCard key={a.id} appointment={a} nowIso={nowIso} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
