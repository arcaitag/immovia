"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, BellRing, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, ChoiceRow } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
import { describeCriteria, type SearchCriteria } from "@/lib/search/criteria";
import { truncate } from "@/lib/utils";
import { saveSearchAction } from "@/components/saved-searches/actions";
import { ALERT_FREQUENCIES, type AlertFrequency } from "@/components/saved-searches/criteria-json";
import { saveSearchFormSchema, type SaveSearchFormValues } from "@/components/saved-searches/schemas";
import { clearLocationHash, loginHref, useLocationHash } from "@/components/search/use-location-hash";

const HASH = "suchauftrag";

/**
 * Button «Suchauftrag speichern» mit Dialog. Nicht angemeldete Besucher werden zum Login geführt
 * und landen danach wieder auf derselben Suche; der Dialog öffnet sich dann automatisch.
 */
export function SaveSearchButton({
  criteria,
  hasBbox,
  returnTo,
  variant = "outline",
  className,
  label = "Suchauftrag speichern",
  autoOpenFromHash = true,
}: {
  criteria: SearchCriteria;
  hasBbox: boolean;
  returnTo: string;
  variant?: "outline" | "default" | "secondary";
  className?: string;
  label?: React.ReactNode;
  /** Nach dem Login (Anker #suchauftrag) automatisch öffnen. Nur bei einem Button pro Seite aktivieren. */
  autoOpenFromHash?: boolean;
}) {
  const hash = useLocationHash();
  const [manualOpen, setManualOpen] = React.useState(false);
  const [dismissedHash, setDismissedHash] = React.useState(false);
  const open = manualOpen || (autoOpenFromHash && hash === `#${HASH}` && !dismissedHash);

  function onOpenChange(next: boolean) {
    setManualOpen(next);
    if (!next) {
      setDismissedHash(true);
      clearLocationHash();
    }
  }

  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => setManualOpen(true)}>
        <Bell aria-hidden />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          {open ? (
            <SaveSearchDialogBody criteria={criteria} hasBbox={hasBbox} returnTo={returnTo} onDone={() => onOpenChange(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SaveSearchDialogBody({
  criteria,
  hasBbox,
  returnTo,
  onDone,
}: {
  criteria: SearchCriteria;
  hasBbox: boolean;
  returnTo: string;
  onDone: () => void;
}) {
  const { data: user, isLoading } = useAuthUser();
  const [savedId, setSavedId] = React.useState<string | null>(null);
  const summary = describeCriteria(criteria);
  const form = useForm<SaveSearchFormValues>({
    resolver: zodResolver(saveSearchFormSchema),
    defaultValues: { name: truncate(summary, 120), alertEnabled: true, frequency: "instant" },
  });
  const alertEnabled = useWatch({ control: form.control, name: "alertEnabled" });

  async function onSubmit(values: SaveSearchFormValues) {
    const result = await saveSearchAction({
      name: values.name,
      alertEnabled: values.alertEnabled,
      frequency: values.frequency,
      criteria: criteria as Record<string, unknown>,
    });
    if (!result.ok) {
      if (result.fieldErrors?.name?.[0]) form.setError("name", { message: result.fieldErrors.name[0] });
      toast.error(result.error);
      return;
    }
    setSavedId(result.data.id);
  }

  if (isLoading) {
    return (
      <DialogHeader>
        <DialogTitle>Suchauftrag speichern</DialogTitle>
        <DialogDescription>Wird geladen …</DialogDescription>
      </DialogHeader>
    );
  }

  if (!user) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Suchauftrag speichern</DialogTitle>
          <DialogDescription>
            Melden Sie sich an, um diese Suche zu speichern. Wir benachrichtigen Sie, sobald passende neue Inserate erscheinen.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-xl bg-surface p-4 text-sm">{summary}</p>
        <DialogFooter>
          <Button asChild variant="outline">
            <Link href={loginHref(returnTo, HASH, "/registrieren")}>Kostenlos registrieren</Link>
          </Button>
          <Button asChild>
            <Link href={loginHref(returnTo, HASH)}>Anmelden</Link>
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (savedId) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleCheck className="size-5 text-brand" aria-hidden /> Suchauftrag gespeichert
          </DialogTitle>
          <DialogDescription>
            {form.getValues("alertEnabled")
              ? "Sie werden benachrichtigt, sobald ein neues passendes Inserat veröffentlicht wird – pro Inserat nur einmal."
              : "Die Benachrichtigung ist ausgeschaltet. Sie können sie jederzeit in Ihren Suchaufträgen aktivieren."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button asChild variant="outline">
            <Link href="/dashboard/suchauftraege">Suchaufträge verwalten</Link>
          </Button>
          <Button type="button" onClick={onDone}>
            Weiter suchen
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>Suchauftrag speichern</DialogTitle>
        <DialogDescription>Speichern Sie Ihre Kriterien und lassen Sie sich über neue passende Inserate informieren.</DialogDescription>
      </DialogHeader>

      <div className="rounded-xl bg-surface p-4 text-sm">
        <p className="font-semibold">Ihre Kriterien</p>
        <p className="mt-1 text-muted-foreground">{summary}</p>
      </div>
      {hasBbox ? (
        <Alert tone="neutral">Der Kartenausschnitt wird nicht gespeichert. Der Suchauftrag berücksichtigt alle übrigen Kriterien.</Alert>
      ) : null}

      <Field label="Name des Suchauftrags" htmlFor="suchauftrag-name" error={form.formState.errors.name?.message}>
        <Input maxLength={120} {...form.register("name")} />
      </Field>

      <Controller
        control={form.control}
        name="alertEnabled"
        render={({ field }) => (
          <ChoiceRow
            htmlFor="suchauftrag-benachrichtigung"
            control={<Switch id="suchauftrag-benachrichtigung" checked={field.value} onCheckedChange={field.onChange} />}
            label={
              <span className="inline-flex items-center gap-2">
                <BellRing className="size-4 text-brand" aria-hidden /> Benachrichtigungen erhalten
              </span>
            }
            description="Per E-Mail und im Dashboard. Die E-Mail-Benachrichtigungen können Sie in den Einstellungen verwalten."
          />
        )}
      />

      <Controller
        control={form.control}
        name="frequency"
        render={({ field }) => (
          <div className="grid gap-2" aria-disabled={!alertEnabled}>
            <p className="text-sm font-semibold" id="suchauftrag-haeufigkeit">
              Häufigkeit
            </p>
            <RadioGroup
              aria-labelledby="suchauftrag-haeufigkeit"
              value={field.value}
              onValueChange={(v) => field.onChange(v as AlertFrequency)}
              disabled={!alertEnabled}
              className="gap-1"
            >
              {(Object.entries(ALERT_FREQUENCIES) as [AlertFrequency, { label: string; description: string }][]).map(([value, option]) => (
                <div key={value} className="flex items-start gap-3 rounded-xl px-1 py-1.5">
                  <RadioGroupItem id={`suchauftrag-${value}`} value={value} className="mt-0.5" />
                  <Label htmlFor={`suchauftrag-${value}`} className="grid cursor-pointer gap-0.5 font-medium">
                    {option.label}
                    <span className="text-xs font-normal text-muted-foreground">{option.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          Speichern
        </Button>
      </DialogFooter>
    </form>
  );
}
