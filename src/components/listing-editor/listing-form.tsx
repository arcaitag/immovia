"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, FileText, Gauge, Lightbulb, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoiceRow, Field } from "@/components/ui/field";
import { Input, InputGroup, Textarea } from "@/components/ui/input";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { HighlightsInput } from "@/components/listing-editor/highlights-input";
import { LOCATION_PRECISION, type LocationPrecision, type OfferType } from "@/lib/constants";
import { formatChf, formatDate, formatDateTime } from "@/lib/format";
import { publicAddressPreview } from "@/lib/properties/display";
import { saveListingAction } from "@/lib/properties/listing-actions";
import {
  LISTING_TEXT_LIMITS,
  listingFormSchema,
  type ListingFormData,
  type ListingFormValues,
  type ListingTextField,
} from "@/lib/validation/listing";
import { parseSwissNumber } from "@/lib/validation/property";
import { cn } from "@/lib/utils";

function toNumber(value: string): number | null {
  const parsed = parseSwissNumber(value);
  return parsed === null || Number.isNaN(parsed) ? null : parsed;
}

type ListingForm = UseFormReturn<ListingFormValues, unknown, ListingFormData>;

const TEXT_KEYS: readonly ListingTextField[] = [
  "title",
  "short_description",
  "description",
  "location_description",
  "equipment_description",
  "search_summary",
];

function textsSignature(values: Pick<ListingFormValues, ListingTextField | "highlights">): string {
  return JSON.stringify([...TEXT_KEYS.map((key) => values[key].trim()), values.highlights.map((h) => h.trim())]);
}

function errorOf(form: ListingForm, name: keyof ListingFormValues): string | undefined {
  const error = form.formState.errors[name];
  return error && "message" in error && typeof error.message === "string" ? error.message : undefined;
}

function TextInputField({
  form,
  name,
  label,
  hint,
  rows,
  placeholder,
}: {
  form: ListingForm;
  name: ListingTextField;
  label: string;
  hint?: string;
  rows?: number;
  placeholder?: string;
}) {
  const value = useWatch({ control: form.control, name }) ?? "";
  const max = LISTING_TEXT_LIMITS[name];
  const id = `inserat-${name}`;
  const counter = `${value.length.toLocaleString("de-CH")} / ${max.toLocaleString("de-CH")} Zeichen`;
  return (
    <Field label={label} htmlFor={id} hint={hint ? `${hint} · ${counter}` : counter} error={errorOf(form, name)}>
      {rows ? (
        <Textarea {...form.register(name)} rows={rows} maxLength={max} placeholder={placeholder} />
      ) : (
        <Input {...form.register(name)} maxLength={max} placeholder={placeholder} />
      )}
    </Field>
  );
}

export interface ListingFormProps {
  propertyId: string;
  listingId: string;
  offerType: OfferType;
  initialValues: ListingFormValues;
  textsConfirmedAt: string | null;
  parkingSpaces: number;
  propertyAddress: { street: string | null; house_number: string | null; postal_code: string | null; municipality: string | null };
  dossier: { available: boolean; publicVersion: number | null; latestVersion: number | null; latestDate: string | null };
  valuation: { suggestedListPrice: number | null; createdAt: string } | null;
  /** Nebenkosten aus den Objektdaten (Schritt 1) als Hinweis */
  serviceCharges: number | null;
  locked: boolean;
}

/** Schritt 6: Preis, Texte, Standortgenauigkeit, Kontakt, Dossier-Freigabe und Bestätigung. */
export function ListingForm({
  propertyId,
  listingId,
  offerType,
  initialValues,
  textsConfirmedAt,
  parkingSpaces,
  propertyAddress,
  dossier,
  valuation,
  serviceCharges,
  locked,
}: ListingFormProps) {
  const [pending, startTransition] = React.useTransition();
  const [confirmedAt, setConfirmedAt] = React.useState(textsConfirmedAt);
  const [confirmationReset, setConfirmationReset] = React.useState(false);
  const savedSignature = React.useRef(textsSignature(initialValues));
  const form = useForm<ListingFormValues, unknown, ListingFormData>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const { isDirty } = form.formState;
  const [priceOnRequest, price, additionalCosts, precision, showPhone] = useWatch({
    control: form.control,
    name: ["price_on_request", "price", "additional_costs", "location_precision", "show_contact_phone"],
  });
  const isRent = offerType === "rent";

  // Geänderte Texte müssen erneut bestätigt werden
  React.useEffect(() => {
    return form.subscribe({
      name: [...TEXT_KEYS, "highlights"],
      formState: { values: true },
      callback: ({ values }) => {
        if (textsSignature(values) !== savedSignature.current && values.texts_confirmed) {
          form.setValue("texts_confirmed", false, { shouldDirty: true });
          setConfirmationReset(true);
        }
      },
    });
  }, [form]);

  React.useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (form.formState.isDirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [form]);

  function save() {
    const values = form.getValues();
    startTransition(async () => {
      const result = await saveListingAction(listingId, values);
      if (!result.ok) {
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages[0]) form.setError(field as keyof ListingFormValues, { type: "server", message: messages[0] });
        }
        toast.error(result.error);
        return;
      }
      savedSignature.current = textsSignature(values);
      setConfirmedAt(result.data.textsConfirmedAt);
      setConfirmationReset(false);
      form.reset(values);
      toast.success(result.message ?? "Gespeichert.");
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    void form.handleSubmit(save, () => toast.error("Bitte prüfen Sie die markierten Felder."))(event);
  }

  const netRent = toNumber(price);
  const charges = toNumber(additionalCosts);
  const grossRent = isRent && netRent !== null ? netRent + (charges ?? 0) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      {locked ? (
        <Alert tone="warning" title="Inserat archiviert">
          Archivierte Inserate können nicht mehr bearbeitet werden. Erstellen Sie unter «Veröffentlichung» ein neues Inserat.
        </Alert>
      ) : null}

      <fieldset disabled={locked || pending} className="grid gap-6">
        {/* Preis */}
        <Card id="preis" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Preis</CardTitle>
            <CardDescription>
              {isRent ? "Monatliche Nettomiete und Nebenkosten." : "Der Verkaufspreis, zu dem Sie die Immobilie anbieten."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Controller
              control={form.control}
              name="price_on_request"
              render={({ field }) => (
                <ChoiceRow
                  htmlFor="inserat-auf-anfrage"
                  className="rounded-xl border border-border p-3.5"
                  label="Preis auf Anfrage"
                  description="Der Preis wird nicht veröffentlicht. Interessenten erfragen ihn über eine Nachricht."
                  control={
                    <Switch
                      id="inserat-auf-anfrage"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) form.setValue("price", "", { shouldDirty: true });
                      }}
                    />
                  }
                />
              )}
            />
            {!priceOnRequest ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={isRent ? "Nettomiete pro Monat" : "Verkaufspreis"} htmlFor="inserat-preis" error={errorOf(form, "price")}>
                  <InputGroup {...form.register("price")} prefix="CHF" inputMode="decimal" placeholder={isRent ? "2'150" : "765'000"} />
                </Field>
                {isRent ? (
                  <Field
                    label="Nebenkosten pro Monat"
                    htmlFor="inserat-nebenkosten"
                    error={errorOf(form, "additional_costs")}
                    hint={serviceCharges !== null ? `In den Objektdaten erfasst: ${formatChf(serviceCharges)}` : undefined}
                    optional
                  >
                    <InputGroup {...form.register("additional_costs")} prefix="CHF" inputMode="decimal" placeholder="250" />
                  </Field>
                ) : null}
              </div>
            ) : null}
            {grossRent !== null && !priceOnRequest ? (
              <p className="text-sm text-muted-foreground">
                Bruttomiete: <strong className="text-foreground">{formatChf(grossRent)}</strong> pro Monat
              </p>
            ) : null}
            {valuation?.suggestedListPrice && !isRent ? (
              <div className="flex flex-col gap-3 rounded-xl border border-mint-200 bg-mint-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2.5 text-sm text-forest">
                  <Gauge className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Möglicher Inseratepreis aus Ihrer Bewertung vom {formatDate(valuation.createdAt)}:{" "}
                    <strong>{formatChf(valuation.suggestedListPrice)}</strong>
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    form.setValue("price_on_request", false, { shouldDirty: true });
                    form.setValue("price", String(valuation.suggestedListPrice), { shouldDirty: true, shouldValidate: true });
                  }}
                >
                  Übernehmen
                </Button>
              </div>
            ) : null}
            {parkingSpaces > 0 ? (
              <Field
                label={isRent ? "Miete pro Parkplatz und Monat" : "Preis pro Parkplatz"}
                htmlFor="inserat-parkplatz"
                error={errorOf(form, "parking_price")}
                hint={`Erfasst: ${parkingSpaces} ${parkingSpaces === 1 ? "Parkplatz" : "Parkplätze"}. Leer lassen, wenn im Preis enthalten.`}
                optional
              >
                <InputGroup {...form.register("parking_price")} prefix="CHF" inputMode="decimal" className="sm:max-w-xs" />
              </Field>
            ) : null}
          </CardContent>
        </Card>

        {/* Texte */}
        <Card id="texte" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Texte</CardTitle>
            <CardDescription>Sie können alle Texte selbst schreiben oder im Schritt «Beschreibung» mit KI erstellen lassen.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Alert
              tone="neutral"
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/immobilien/${propertyId}/beschreibung`}>
                    <Sparkles aria-hidden /> Texte mit KI
                  </Link>
                </Button>
              }
            >
              Die KI schreibt nur auf Basis Ihrer erfassten Angaben. Prüfen und ergänzen Sie die Texte danach hier.
            </Alert>
            <TextInputField form={form} name="title" label="Titel" placeholder="z. B. Helle 4.5-Zimmer-Wohnung mit Balkon" />
            <TextInputField
              form={form}
              name="short_description"
              label="Kurzbeschreibung"
              rows={3}
              hint="Zwei bis drei Sätze für den Einstieg"
            />
            <TextInputField form={form} name="description" label="Beschreibung" rows={10} hint="Die ausführliche Objektbeschreibung" />
            <TextInputField form={form} name="location_description" label="Lage und Umgebung" rows={5} />
            <TextInputField form={form} name="equipment_description" label="Ausstattung" rows={5} />
            <Field label="Highlights" htmlFor="inserat-highlights" hint="Kurze Stichworte, die im Inserat hervorgehoben werden." error={errorOf(form, "highlights")}>
              <Controller
                control={form.control}
                name="highlights"
                render={({ field }) => <HighlightsInput id="inserat-highlights" value={field.value} onChange={field.onChange} />}
              />
            </Field>
            <TextInputField
              form={form}
              name="search_summary"
              label="Zusammenfassung für Suchergebnisse"
              rows={2}
              hint="Erscheint in Trefferlisten"
            />
          </CardContent>
        </Card>

        {/* Standort */}
        <Card id="standort" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>
              <span id="standort-label">Standortanzeige</span>
            </CardTitle>
            <CardDescription>Wie genau sollen Interessenten sehen, wo die Immobilie liegt?</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Controller
              control={form.control}
              name="location_precision"
              render={({ field }) => (
                <RadioGroup
                  aria-labelledby="standort-label"
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as LocationPrecision)}
                  className="grid gap-3 md:grid-cols-3"
                >
                  {(Object.keys(LOCATION_PRECISION) as LocationPrecision[]).map((key) => (
                    <RadioCard key={key} value={key} className="items-start py-4">
                      <span className="grid gap-1">
                        <span>{LOCATION_PRECISION[key].label}</span>
                        <span className="text-xs font-normal text-muted-foreground">{LOCATION_PRECISION[key].description}</span>
                      </span>
                    </RadioCard>
                  ))}
                </RadioGroup>
              )}
            />
            <p className="text-sm text-muted-foreground">
              Im Inserat erscheint:{" "}
              <strong className="text-foreground">{publicAddressPreview(propertyAddress, precision) || "noch keine Adresse erfasst"}</strong>
            </p>
          </CardContent>
        </Card>

        {/* Kontakt */}
        <Card id="kontakt" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Kontakt</CardTitle>
            <CardDescription>
              Interessenten schreiben Ihnen über das Nachrichtensystem von Immovia. Die Telefonnummer erscheint nur, wenn Sie die
              Anzeige aktivieren.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="inserat-kontakt-name" error={errorOf(form, "contact_name")} optional>
              <Input {...form.register("contact_name")} autoComplete="name" maxLength={120} />
            </Field>
            <Field
              label="E-Mail"
              htmlFor="inserat-kontakt-email"
              error={errorOf(form, "contact_email")}
              hint="Wird nicht veröffentlicht – weder im Inserat noch im Verkaufsdossier."
              optional
            >
              <Input {...form.register("contact_email")} type="email" autoComplete="email" maxLength={254} />
            </Field>
            <Field label="Telefon" htmlFor="inserat-kontakt-telefon" error={errorOf(form, "contact_phone")} optional={!showPhone}>
              <Input {...form.register("contact_phone")} type="tel" autoComplete="tel" placeholder="+41 79 123 45 67" maxLength={24} />
            </Field>
            <Controller
              control={form.control}
              name="show_contact_phone"
              render={({ field }) => (
                <ChoiceRow
                  htmlFor="inserat-telefon-anzeigen"
                  className="self-end rounded-xl border border-border p-3.5"
                  label="Telefonnummer im Inserat anzeigen"
                  control={
                    <Switch
                      id="inserat-telefon-anzeigen"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        if (checked) void form.trigger("contact_phone");
                      }}
                    />
                  }
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Dossier */}
        <Card id="dossier" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Verkaufsdossier</CardTitle>
            <CardDescription>Bieten Sie Ihr PDF-Dossier im Inserat zum Download an.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Controller
              control={form.control}
              name="dossier_public"
              render={({ field }) => (
                <ChoiceRow
                  htmlFor="inserat-dossier"
                  className={cn("rounded-xl border border-border p-3.5", !dossier.available && "opacity-70")}
                  label="Dossier öffentlich freigeben"
                  description={
                    dossier.available
                      ? dossier.publicVersion
                        ? `Freigegeben wird Version ${dossier.publicVersion}.`
                        : `Freigegeben wird die neueste Version ${dossier.latestVersion ?? ""}${dossier.latestDate ? ` vom ${formatDate(dossier.latestDate)}` : ""}.`
                      : "Noch kein fertiges Dossier vorhanden."
                  }
                  control={
                    <Switch
                      id="inserat-dossier"
                      checked={field.value}
                      disabled={!dossier.available && !field.value}
                      onCheckedChange={field.onChange}
                    />
                  }
                />
              )}
            />
            {!dossier.available ? (
              <Button asChild variant="link" className="justify-self-start">
                <Link href={`/dashboard/immobilien/${propertyId}/dossier`}>
                  <FileText aria-hidden /> Verkaufsdossier erstellen
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* Bestätigung */}
        <Card id="bestaetigung" className="scroll-mt-24 border-mint-300">
          <CardHeader>
            <CardTitle>Bestätigung</CardTitle>
            <CardDescription>Vor der Veröffentlichung müssen Sie die Texte prüfen und bestätigen.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Controller
              control={form.control}
              name="texts_confirmed"
              render={({ field }) => (
                <ChoiceRow
                  htmlFor="inserat-bestaetigung"
                  label="Ich habe die Texte geprüft und sie entsprechen den Tatsachen."
                  description={
                    confirmedAt && field.value && !isDirty
                      ? `Bestätigt am ${formatDateTime(confirmedAt)}.`
                      : "Gilt für Titel, Beschreibungen, Highlights und die Zusammenfassung."
                  }
                  control={
                    <Checkbox
                      id="inserat-bestaetigung"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true);
                        if (checked === true) setConfirmationReset(false);
                      }}
                    />
                  }
                />
              )}
            />
            {confirmationReset ? (
              <p className="flex items-start gap-2 text-sm text-warning" role="status">
                <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
                Sie haben Texte geändert. Bitte bestätigen Sie sie erneut.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </fieldset>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-3 rounded-2xl border border-border bg-white/95 p-3 shadow-float backdrop-blur sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <p className="px-1 text-sm text-muted-foreground" aria-live="polite">
          {isDirty ? "Sie haben ungespeicherte Änderungen." : "Alle Änderungen sind gespeichert."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/immobilien/${propertyId}/inserat/vorschau`}>
              <Eye aria-hidden /> Vorschau
            </Link>
          </Button>
          {!isDirty && !locked ? (
            <Button asChild variant="outline">
              <Link href={`/dashboard/immobilien/${propertyId}/veroeffentlichen`}>
                Zur Veröffentlichung <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null}
          <Button type="submit" loading={pending} disabled={locked || !isDirty}>
            Speichern
          </Button>
        </div>
      </div>
    </form>
  );
}
