"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { toast } from "@/components/ui/sonner";
import { updatePreferencesAction } from "@/app/dashboard/einstellungen/actions";
import {
  DEFAULT_OFFER_OPTIONS,
  preferencesSchema,
  type PreferencesInput,
  type PreferencesValues,
} from "@/lib/validation/account";

export function PreferencesForm({
  defaultValues,
  aiConfigured,
  imageAi,
}: {
  defaultValues: PreferencesInput;
  aiConfigured: boolean;
  /** Bild-KI: eingerichtet? Empfänger der Fotos und Zusage «keine Speicherung» */
  imageAi: { configured: boolean; recipient: string; noRetention: boolean };
}) {
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<PreferencesInput, unknown, PreferencesValues>({ resolver: zodResolver(preferencesSchema), defaultValues });

  const onSubmit = handleSubmit(async () => {
    setFormError(null);
    const raw = getValues();
    const res = await updatePreferencesAction(raw);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    reset(raw);
    toast.success(res.message ?? "Gespeichert.");
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <Controller
          control={control}
          name="ai_processing_consent"
          render={({ field }) => (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest sm:flex">
                  <Sparkles className="size-[18px]" aria-hidden />
                </span>
                <div className="grid gap-1">
                  <Label htmlFor="pref-ai" className="cursor-pointer">
                    KI-Verarbeitung erlauben
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Für KI-Texte, Erklärungen zur Bewertung und den KI-Assistenten.
                  </p>
                </div>
              </div>
              <Switch
                id="pref-ai"
                aria-describedby="pref-ai-details"
                checked={field.value}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                className="mt-0.5"
              />
            </div>
          )}
        />
        <div id="pref-ai-details" className="mt-4 grid gap-2 text-xs leading-relaxed text-muted-foreground sm:pl-12">
          <p>
            Wenn Sie eine KI-Funktion verwenden, übermitteln wir die dafür nötigen Angaben an unseren KI-Anbieter Anthropic
            (USA): Angaben zum Objekt wie Objektart, Zimmer, Fläche, Ausstattung und Ort sowie Ihre Eingaben im
            Assistenten. Es werden nur die Daten gesendet, die für die jeweilige Funktion nötig sind.
          </p>
          <p>
            Gemäss den kommerziellen Nutzungsbedingungen von Anthropic werden diese Daten nicht zum Training von KI-Modellen
            verwendet und standardmässig innert 30 Tagen gelöscht.
          </p>
          <p>
            Ohne Einwilligung stehen Ihnen die KI-Funktionen nicht zur Verfügung; alle anderen Funktionen bleiben nutzbar.
            Bildkorrekturen wie Helligkeit oder Zuschnitt erfolgen auf unseren eigenen Servern.{" "}
            <Link href="/datenschutz" className="font-semibold text-primary underline-offset-2 hover:underline">
              Mehr in der Datenschutzerklärung
            </Link>
          </p>
          {!aiConfigured ? (
            <p className="font-medium text-foreground">KI-Funktionen sind auf Immovia derzeit nicht aktiviert.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <Controller
          control={control}
          name="ai_image_consent"
          render={({ field }) => (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest sm:flex">
                  <ImageIcon className="size-[18px]" aria-hidden />
                </span>
                <div className="grid gap-1">
                  <Label htmlFor="pref-ai-image" className="cursor-pointer">
                    Bild-KI erlauben
                  </Label>
                  <p className="text-xs text-muted-foreground">Für Designvorschläge im Bilderstudio («Aufräumen», «Neu einrichten»).</p>
                </div>
              </div>
              <Switch
                id="pref-ai-image"
                aria-describedby="pref-ai-image-details"
                checked={field.value}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                className="mt-0.5"
              />
            </div>
          )}
        />
        <div id="pref-ai-image-details" className="mt-4 grid gap-2 text-xs leading-relaxed text-muted-foreground sm:pl-12">
          <p>
            Wenn Sie einen Designvorschlag erstellen, senden wir das ausgewählte Foto ohne Standortdaten über das AI Gateway von Vercel
            (USA) an den Anbieter des Bildmodells: {imageAi.recipient}. Wir verlangen bei jeder Anfrage, dass das Foto nicht zum Training
            von KI-Modellen verwendet wird
            {imageAi.noRetention ? " und der Anbieter es nach der Bearbeitung nicht speichert" : ""}.
          </p>
          <p>Vorschläge werden als neues Bild gespeichert und erst nach Ihrer Prüfung veröffentlicht, gekennzeichnet als «KI-Visualisierung».</p>
          {!imageAi.configured ? <p className="font-medium text-foreground">Die Bild-KI ist auf Immovia derzeit nicht aktiviert.</p> : null}
        </div>
      </div>

      <ul className="divide-y divide-border">
        <li>
          <Controller
            control={control}
            name="analytics_consent"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 py-4">
                <div className="grid gap-1">
                  <Label htmlFor="pref-analytics" className="cursor-pointer">
                    Nutzungsstatistik
                  </Label>
                  <p id="pref-analytics-hint" className="text-xs leading-relaxed text-muted-foreground">
                    Erlaubt uns, pseudonymisiert auszuwerten, wie Sie Immovia nutzen, um die Plattform zu verbessern. Die
                    Aufrufzahlen von Inseraten werden unabhängig davon mit einer gehashten Kennung ohne IP-Adresse gezählt.
                  </p>
                </div>
                <Switch
                  id="pref-analytics"
                  aria-describedby="pref-analytics-hint"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className="mt-0.5"
                />
              </div>
            )}
          />
        </li>
        <li>
          <Controller
            control={control}
            name="marketing_consent"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 py-4">
                <div className="grid gap-1">
                  <Label htmlFor="pref-marketing" className="cursor-pointer">
                    Angebote und Aktionen
                  </Label>
                  <p id="pref-marketing-hint" className="text-xs leading-relaxed text-muted-foreground">
                    Informationen zu Angeboten von Immovia per E-Mail. Die Einwilligung können Sie jederzeit widerrufen.
                  </p>
                </div>
                <Switch
                  id="pref-marketing"
                  aria-describedby="pref-marketing-hint"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className="mt-0.5"
                />
              </div>
            )}
          />
        </li>
      </ul>

      <Field
        label="Standard-Angebotsart"
        htmlFor="pref-offer"
        hint="Wird als Voreinstellung verwendet, wenn Sie zwischen Kaufen und Mieten wählen."
        className="max-w-sm"
      >
        <NativeSelect id="pref-offer" {...register("default_offer_type")}>
          {DEFAULT_OFFER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="flex justify-end border-t border-border pt-5">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Speichern
        </Button>
      </div>
    </form>
  );
}
