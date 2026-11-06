"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarArrowDown,
  CalendarX,
  Check,
  CircleCheck,
  CircleX,
  EllipsisVertical,
  Lock,
  MessageSquare,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { formatDateTime, formatRelative, formatTime, formatTimeRange } from "@/lib/format";
import type { AppointmentAction } from "@/lib/validation/viewing";
import type { AppointmentItem, AppointmentNote, MoveTarget } from "@/services/viewings";
import {
  addAppointmentNoteAction,
  appointmentAction,
  deleteAppointmentNoteAction,
  moveAppointmentAction,
} from "@/app/dashboard/besichtigungen/actions";

type DialogKind = "cancel" | "move" | "notes" | null;

export function AppointmentActions({
  appointment,
  moveTargets,
  nowIso,
}: {
  appointment: AppointmentItem;
  moveTargets: MoveTarget[];
  nowIso: string;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [pending, startTransition] = React.useTransition();
  const started = new Date(appointment.startsAt).getTime() <= new Date(nowIso).getTime();
  const open = appointment.status === "requested" || appointment.status === "reschedule_requested";
  const confirmed = appointment.status === "confirmed";
  const active = open || confirmed;

  function run(action: AppointmentAction, reason?: string, after?: () => void) {
    startTransition(async () => {
      const res = await appointmentAction({ appointmentId: appointment.id, action, reason });
      if (res.ok) {
        toast.success(res.message ?? "Gespeichert.");
        after?.();
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {open && !started ? (
        <Button size="sm" onClick={() => run("confirm")} loading={pending}>
          <Check aria-hidden /> Bestätigen
        </Button>
      ) : null}
      {confirmed && started ? (
        <Button size="sm" variant="secondary" onClick={() => run("complete")} loading={pending}>
          <CircleCheck aria-hidden /> Durchgeführt
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Weitere Aktionen zum Termin" disabled={pending}>
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {active && !started ? (
            <DropdownMenuItem onSelect={() => setDialog("move")}>
              <CalendarClock /> Verschieben
            </DropdownMenuItem>
          ) : null}
          {confirmed && started ? (
            <DropdownMenuItem onSelect={() => run("no_show")}>
              <CircleX /> Nicht erschienen
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setDialog("notes")}>
            <StickyNote /> Private Notizen{appointment.notes.length ? ` (${appointment.notes.length})` : ""}
          </DropdownMenuItem>
          {appointment.conversationId ? (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/nachrichten/${appointment.conversationId}`}>
                <MessageSquare /> Nachricht schreiben
              </Link>
            </DropdownMenuItem>
          ) : null}
          {appointment.leadId ? (
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/interessenten/${appointment.leadId}`}>
                <User /> Interessent ansehen
              </Link>
            </DropdownMenuItem>
          ) : null}
          {active ? (
            <DropdownMenuItem asChild>
              <a href={`/api/viewings/${appointment.id}/ics`}>
                <CalendarArrowDown /> Kalenderdatei (.ics)
              </a>
            </DropdownMenuItem>
          ) : null}
          {active && !started ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDialog("cancel")}>
                <CalendarX /> Absagen
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <CancelDialog
        open={dialog === "cancel"}
        onOpenChange={(o) => setDialog(o ? "cancel" : null)}
        title="Termin absagen"
        description={`${appointment.guest?.name ?? "Die Person"} wird per Nachricht und E-Mail informiert.`}
        pending={pending}
        onConfirm={(reason) => run("cancel", reason, () => setDialog(null))}
      />
      <MoveDialog
        open={dialog === "move"}
        onOpenChange={(o) => setDialog(o ? "move" : null)}
        appointment={appointment}
        targets={moveTargets.filter((t) => t.id !== appointment.slotId)}
      />
      <NotesDialog open={dialog === "notes"} onOpenChange={(o) => setDialog(o ? "notes" : null)} appointment={appointment} />
    </div>
  );
}

export function CancelDialog({
  open,
  onOpenChange,
  title,
  description,
  pending,
  onConfirm,
  label = "Grund (wird mitgeteilt)",
  confirmLabel = "Absagen",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  pending: boolean;
  onConfirm: (reason?: string) => void;
  label?: string;
  confirmLabel?: string;
}) {
  const [reason, setReason] = React.useState("");
  const id = React.useId();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setReason("");
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(reason.trim() || undefined);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field label={label} htmlFor={id} optional hint="Höchstens 500 Zeichen.">
            <Textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="min-h-24" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Zurück
            </Button>
            <Button type="submit" variant="destructive" loading={pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  open,
  onOpenChange,
  appointment,
  targets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentItem;
  targets: MoveTarget[];
}) {
  const router = useRouter();
  const [slotId, setSlotId] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!slotId) return;
    startTransition(async () => {
      const res = await moveAppointmentAction({ appointmentId: appointment.id, slotId });
      if (res.ok) {
        toast.success(res.message ?? "Termin verschoben.");
        setSlotId("");
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="grid gap-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Termin verschieben</DialogTitle>
            <DialogDescription>
              Bisher: {formatTimeRange(appointment.startsAt, appointment.endsAt)}. Der neue Termin gilt als bestätigt, die Person wird
              benachrichtigt.
            </DialogDescription>
          </DialogHeader>
          {targets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
              Es gibt keine anderen freien Zeitfenster. Legen Sie zuerst ein neues Zeitfenster an.
            </p>
          ) : (
            <Field label="Neues Zeitfenster" htmlFor={id} required>
              <NativeSelect value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                <option value="">Bitte wählen</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formatDateTime(t.startsAt)}–{formatTime(t.endsAt)} ({t.free === 1 ? "1 Platz frei" : `${t.free} Plätze frei`})
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" loading={pending} disabled={!slotId}>
              Verschieben
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotesDialog({ open, onOpenChange, appointment }: { open: boolean; onOpenChange: (open: boolean) => void; appointment: AppointmentItem }) {
  const router = useRouter();
  const [notes, setNotes] = React.useState<AppointmentNote[]>(appointment.notes);
  const [draft, setDraft] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();

  function add(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await addAppointmentNoteAction({ appointmentId: appointment.id, body });
      if (res.ok) {
        setNotes((prev) => [...prev, res.data]);
        setDraft("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove(noteId: string) {
    startTransition(async () => {
      const res = await deleteAppointmentNoteAction({ noteId });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4 text-forest" aria-hidden /> Private Notizen
          </DialogTitle>
          <DialogDescription>
            {appointment.guest?.name ?? "Termin"} · {formatTimeRange(appointment.startsAt, appointment.endsAt)}. Nur für Sie sichtbar, nie für
            Interessenten.
          </DialogDescription>
        </DialogHeader>
        {notes.length ? (
          <ul className="grid max-h-64 gap-2 overflow-y-auto">
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl border border-border bg-surface p-3">
                <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span suppressHydrationWarning>{formatRelative(note.createdAt)}</span>
                  {note.isMine ? (
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(note.id)} disabled={pending} aria-label="Notiz löschen">
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Notizen zu diesem Termin.</p>
        )}
        <form onSubmit={add} className="grid gap-2">
          <label htmlFor={id} className="sr-only">
            Neue Notiz
          </label>
          <Textarea id={id} value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} placeholder="z. B. kommt mit Architekt" />
          <Button type="submit" size="sm" className="justify-self-end" loading={pending} disabled={!draft.trim()}>
            Notiz speichern
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
