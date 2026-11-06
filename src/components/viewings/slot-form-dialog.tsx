"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { formatDate, formatTime, utcToZurichParts } from "@/lib/format";
import { buildSlotSeries } from "@/lib/viewings/series";
import {
  SLOT_DURATION_OPTIONS,
  SLOT_MODES,
  SLOT_REPEATS,
  slotFormSchema,
  type SlotFormInput,
  type SlotFormValues,
} from "@/lib/validation/viewing";
import { createSlotsAction } from "@/app/dashboard/besichtigungen/actions";

const PREVIEW_LIMIT = 6;

/** Zeitfenster anlegen: einzeln oder als Serie. Eingaben in Zürcher Ortszeit. */
export function SlotFormDialog({ listingId, listingTitle }: { listingId: string; listingTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const today = utcToZurichParts(new Date()).date;

  const form = useForm<SlotFormInput, unknown, SlotFormValues>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: {
      listingId,
      mode: "single",
      date: today,
      startTime: "10:00",
      endTime: "11:00",
      durationMinutes: 30,
      repeat: "none",
      occurrences: 1,
      capacity: 1,
      note: "",
    },
  });
  const { register, handleSubmit, control, setValue, formState, reset } = form;
  const values = useWatch({ control });
  const mode = values.mode ?? "single";
  const repeat = values.repeat ?? "none";

  const preview = React.useMemo(() => {
    if (!values.date || !values.startTime || !values.endTime) return null;
    try {
      return buildSlotSeries({
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        durationMinutes: mode === "single" ? 0 : Number(values.durationMinutes ?? 0),
        repeat: mode === "single" ? "none" : repeat,
        occurrences: Number(values.occurrences ?? 1) || 1,
      });
    } catch {
      return null;
    }
  }, [values.date, values.startTime, values.endTime, values.durationMinutes, values.occurrences, mode, repeat]);

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setServerError(null);
      reset();
    }
  }

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    const res = await createSlotsAction({ ...data, listingId });
    if (res.ok) {
      toast.success(res.message ?? "Zeitfenster angelegt.");
      close(false);
      router.refresh();
    } else {
      setServerError(res.error);
    }
  });

  const err = (name: keyof SlotFormInput) => formState.errors[name]?.message;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus aria-hidden /> Zeitfenster anlegen
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={onSubmit} className="grid gap-5" noValidate>
            <DialogHeader>
              <DialogTitle>Zeitfenster anlegen</DialogTitle>
              <DialogDescription>{listingTitle}. Alle Zeiten gelten in Schweizer Zeit (Europe/Zurich).</DialogDescription>
            </DialogHeader>

            <RadioGroup
              value={mode}
              onValueChange={(v) => setValue("mode", v as SlotFormInput["mode"], { shouldValidate: true })}
              className="grid gap-3 sm:grid-cols-2"
              aria-label="Art"
            >
              {(Object.keys(SLOT_MODES) as Array<keyof typeof SLOT_MODES>).map((key) => (
                <RadioCard key={key} value={key} className="flex-col items-start gap-1">
                  <span>{SLOT_MODES[key].label}</span>
                  <span className="text-xs font-normal text-muted-foreground">{SLOT_MODES[key].description}</span>
                </RadioCard>
              ))}
            </RadioGroup>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={mode === "series" && repeat !== "none" ? "Erster Tag" : "Datum"} htmlFor="slot-date" error={err("date")} required>
                <Input type="date" min={today} {...register("date")} />
              </Field>
              <Field label="Von" htmlFor="slot-start" error={err("startTime")} required>
                <Input type="time" step={300} {...register("startTime")} />
              </Field>
              <Field label="Bis" htmlFor="slot-end" error={err("endTime")} required>
                <Input type="time" step={300} {...register("endTime")} />
              </Field>
            </div>

            {mode === "series" ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Dauer pro Termin" htmlFor="slot-duration" error={err("durationMinutes")}>
                  <NativeSelect {...register("durationMinutes", { valueAsNumber: true })}>
                    {SLOT_DURATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Wiederholen" htmlFor="slot-repeat" error={err("repeat")}>
                  <NativeSelect {...register("repeat")}>
                    {(Object.keys(SLOT_REPEATS) as Array<keyof typeof SLOT_REPEATS>).map((key) => (
                      <option key={key} value={key}>
                        {SLOT_REPEATS[key]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                {repeat !== "none" ? (
                  <Field label={repeat === "daily" ? "Anzahl Tage" : "Anzahl Wochen"} htmlFor="slot-occurrences" error={err("occurrences")}>
                    <Input type="number" inputMode="numeric" min={1} max={12} {...register("occurrences", { valueAsNumber: true })} />
                  </Field>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <Field label="Plätze pro Termin" htmlFor="slot-capacity" error={err("capacity")} hint="Personen bzw. Parteien">
                <Input type="number" inputMode="numeric" min={1} max={50} {...register("capacity", { valueAsNumber: true })} />
              </Field>
              <Field label="Hinweis für Interessenten" htmlFor="slot-note" optional error={err("note")} hint="Z. B. Treffpunkt oder Parkmöglichkeit.">
                <Input maxLength={300} {...register("note")} />
              </Field>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold">Vorschau</p>
              {preview === null ? (
                <p className="mt-1 text-sm text-muted-foreground">Bitte Datum und Uhrzeiten angeben.</p>
              ) : !preview.ok ? (
                <p className="mt-1 text-sm font-medium text-destructive">{preview.error}</p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {preview.slots.length === 1 ? "Es wird 1 Zeitfenster angelegt:" : `Es werden ${preview.slots.length} Zeitfenster angelegt:`}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {preview.slots.slice(0, PREVIEW_LIMIT).map((slot) => (
                      <li key={slot.startsAt.toISOString()} className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium tabular">
                        {formatDate(slot.startsAt, { weekday: "short", day: "2-digit", month: "2-digit", year: undefined })} {formatTime(slot.startsAt)}–
                        {formatTime(slot.endsAt)}
                      </li>
                    ))}
                    {preview.slots.length > PREVIEW_LIMIT ? (
                      <li className="px-1 py-1 text-xs text-muted-foreground">und {preview.slots.length - PREVIEW_LIMIT} weitere</li>
                    ) : null}
                  </ul>
                </>
              )}
            </div>

            {serverError ? <Alert tone="error">{serverError}</Alert> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Abbrechen
              </Button>
              <Button type="submit" loading={formState.isSubmitting} disabled={preview !== null && !preview.ok}>
                Anlegen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
