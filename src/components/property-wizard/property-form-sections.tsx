"use client";

import * as React from "react";
import { Controller, useWatch } from "react-hook-form";
import { Check, KeyRound, Lightbulb, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { AddressFields, type AddressValues } from "@/components/property-wizard/address-fields";
import {
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
  type PropertyForm,
} from "@/components/property-wizard/form-controls";
import {
  AMENITY_FLAGS,
  CONDITIONS,
  FEATURE_CATALOG,
  HEATING_TYPES,
  OWNERSHIP_TYPES,
  PROPERTY_TYPE_OPTIONS,
  type FeatureKey,
  type OfferType,
  type PropertyType,
} from "@/lib/constants";
import { ENERGY_LABELS, FLOOR_OPTIONS, fieldLabel, isBuilding, isFieldVisible } from "@/lib/properties/fields";
import { cn } from "@/lib/utils";

interface SectionProps {
  form: PropertyForm;
  type: PropertyType;
  offer: OfferType;
}

const options = (record: Record<string, string>) => Object.entries(record).map(([value, label]) => ({ value, label }));

export const HELP = {
  rooms: {
    title: "Zimmer nach Schweizer Zählweise",
    text: "Halbe Zimmer stehen meist für eine Wohnküche oder einen offenen Essbereich, z. B. 3.5 Zimmer. Bad, WC und Korridor zählen nicht.",
  },
  living_area: {
    title: "Nettowohnfläche",
    text: "Alle Wohnräume inklusive Küche, Bad und Korridor innerhalb der Wohnung – ohne Wände, Balkon, Keller und Estrich. Das ist die übliche Angabe in Schweizer Inseraten.",
  },
  gross_living_area: {
    title: "Bruttowohnfläche",
    text: "Fläche inklusive Innen- und Aussenwände. Nur angeben, wenn sie bekannt ist, z. B. aus den Plänen.",
  },
  usable_area: {
    title: "Nutzfläche",
    text: "Für Gewerbe und Büro: die nutzbare bzw. vermietbare Fläche ohne Wände.",
  },
  plot_area: {
    title: "Grundstücksfläche",
    text: "Fläche der Parzelle gemäss Grundbuchauszug. Bei Stockwerkeigentum leer lassen.",
  },
  energy_label: {
    title: "GEAK – Gebäudeenergieausweis der Kantone",
    text: "Der GEAK bewertet die Energieeffizienz eines Gebäudes von A (sehr effizient) bis G (wenig effizient). Nur angeben, wenn ein GEAK vorliegt.",
  },
  energy_demand_kwh: {
    title: "Energiekennzahl",
    text: "Jährlicher Energiebedarf pro Quadratmeter Energiebezugsfläche in kWh/m²a, z. B. aus dem GEAK oder einem Energienachweis.",
  },
  ownership_type: {
    title: "Eigentumsform",
    text: "Stockwerkeigentum (STWE): Sie besitzen einen Anteil am Gebäude mit dem Sonderrecht an Ihrer Wohnung – typisch für Eigentumswohnungen. Baurecht: Das Gebäude steht auf fremdem Boden, dafür wird ein Baurechtszins bezahlt.",
  },
  floor: {
    title: "Etage",
    text: "Erdgeschoss ist die Etage 0. Untergeschosse werden negativ gezählt.",
  },
} as const;

function SectionGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-5 sm:grid-cols-2", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Adresse & Lage
// ---------------------------------------------------------------------------

const ADDRESS_KEYS = ["street", "house_number", "postal_code", "municipality", "canton", "latitude", "longitude", "egid"] as const;

export function AddressSection({ form }: SectionProps) {
  const [street, houseNumber, postalCode, municipality, canton, latitude, longitude, egid] = useWatch({
    control: form.control,
    name: ADDRESS_KEYS,
  });
  const errors = form.formState.errors;
  const values: AddressValues = {
    street: street ?? "",
    house_number: houseNumber ?? "",
    postal_code: postalCode ?? "",
    municipality: municipality ?? "",
    canton: canton ?? "",
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    egid: egid ?? null,
  };

  function update(patch: Partial<AddressValues>) {
    const opts = { shouldDirty: true, shouldValidate: true };
    if (patch.street !== undefined) form.setValue("street", patch.street, opts);
    if (patch.house_number !== undefined) form.setValue("house_number", patch.house_number, opts);
    if (patch.postal_code !== undefined) form.setValue("postal_code", patch.postal_code, opts);
    if (patch.municipality !== undefined) form.setValue("municipality", patch.municipality, opts);
    if (patch.canton !== undefined) form.setValue("canton", patch.canton, opts);
    if (patch.latitude !== undefined) form.setValue("latitude", patch.latitude, opts);
    if (patch.longitude !== undefined) form.setValue("longitude", patch.longitude, opts);
    if (patch.egid !== undefined) form.setValue("egid", patch.egid, opts);
  }

  return (
    <AddressFields
      idPrefix="objekt-adresse"
      values={values}
      onChange={update}
      required
      errors={{
        street: errors.street?.message,
        house_number: errors.house_number?.message,
        postal_code: errors.postal_code?.message,
        municipality: errors.municipality?.message,
        canton: errors.canton?.message,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Objektart & Eigentum
// ---------------------------------------------------------------------------

export function ObjectSection({
  form,
  type,
  offer,
  onTypeChange,
  onOfferChange,
}: SectionProps & { onTypeChange: (type: PropertyType) => void; onOfferChange: (offer: OfferType) => void }) {
  const ownership = useWatch({ control: form.control, name: "ownership_type" });
  const suggestCondominium = type === "apartment" && offer === "sale" && !ownership;
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p id="angebotsart-label" className="text-sm font-semibold">
          Angebotsart <span className="text-destructive" aria-hidden>*</span>
        </p>
        <RadioGroup
          aria-labelledby="angebotsart-label"
          value={offer}
          onValueChange={(value) => onOfferChange(value as OfferType)}
          className="grid gap-3 sm:grid-cols-2"
        >
          <RadioCard value="sale">
            <Tag className="size-5 text-brand" aria-hidden /> Verkaufen
          </RadioCard>
          <RadioCard value="rent">
            <KeyRound className="size-5 text-brand" aria-hidden /> Vermieten
          </RadioCard>
        </RadioGroup>
      </div>

      <SectionGrid>
        <SelectField
          form={form}
          name="property_type"
          label="Immobilientyp"
          options={PROPERTY_TYPE_OPTIONS}
          placeholder={null}
          required
          hint="Beim Wechsel werden Angaben entfernt, die nicht mehr passen."
          onValueChange={(value) => onTypeChange(value as PropertyType)}
        />
        {isFieldVisible("ownership_type", type, offer) ? (
          <SelectField
            form={form}
            name="ownership_type"
            label="Eigentumsform"
            options={options(OWNERSHIP_TYPES)}
            info={HELP.ownership_type}
            optional
          />
        ) : null}
      </SectionGrid>

      {suggestCondominium ? (
        <div className="flex flex-col gap-3 rounded-xl border border-mint-200 bg-mint-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-sm text-forest">
            <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
            Eigentumswohnungen sind in der Schweiz in der Regel im Stockwerkeigentum.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => form.setValue("ownership_type", "condominium", { shouldDirty: true })}
          >
            <Check aria-hidden /> Stockwerkeigentum übernehmen
          </Button>
        </div>
      ) : null}

      <TextField
        form={form}
        name="internal_name"
        label="Interne Bezeichnung"
        optional
        maxLength={120}
        placeholder="z. B. Wohnung Bernstrasse"
        hint="Nur für Sie sichtbar, hilft bei mehreren Immobilien."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flächen & Zimmer
// ---------------------------------------------------------------------------

export function AreasSection({ form, type, offer }: SectionProps) {
  const show = (field: Parameters<typeof isFieldVisible>[0]) => isFieldVisible(field, type, offer);
  return (
    <SectionGrid>
      {show("rooms") ? (
        <TextField
          form={form}
          name="rooms"
          label={fieldLabel("rooms", type)}
          inputMode="decimal"
          placeholder="z. B. 4.5"
          info={HELP.rooms}
          required={type === "apartment" || type === "single_family_house" || type === "semi_detached_house" || type === "terraced_house" || type === "new_build_project"}
        />
      ) : null}
      {show("bathrooms") ? (
        <TextField form={form} name="bathrooms" label="Badezimmer" inputMode="numeric" placeholder="z. B. 2" optional hint="Bäder und Duschen mit WC." />
      ) : null}
      {show("living_area") ? (
        <TextField
          form={form}
          name="living_area"
          label={fieldLabel("living_area", type)}
          inputMode="decimal"
          suffix="m²"
          info={HELP.living_area}
          required={type !== "other"}
        />
      ) : null}
      {show("gross_living_area") ? (
        <TextField form={form} name="gross_living_area" label="Bruttowohnfläche" inputMode="decimal" suffix="m²" info={HELP.gross_living_area} optional />
      ) : null}
      {show("usable_area") ? (
        <TextField
          form={form}
          name="usable_area"
          label="Nutzfläche"
          inputMode="decimal"
          suffix="m²"
          info={HELP.usable_area}
          required={type === "commercial" || type === "office"}
          optional={type !== "commercial" && type !== "office"}
        />
      ) : null}
      {show("plot_area") ? (
        <TextField
          form={form}
          name="plot_area"
          label="Grundstücksfläche"
          inputMode="decimal"
          suffix="m²"
          info={HELP.plot_area}
          required={type === "plot" || type === "single_family_house" || type === "semi_detached_house" || type === "terraced_house" || type === "multi_family_house"}
          optional={type === "commercial" || type === "new_build_project" || type === "other"}
        />
      ) : null}
    </SectionGrid>
  );
}

// ---------------------------------------------------------------------------
// Gebäude
// ---------------------------------------------------------------------------

export function BuildingSection({ form, type, offer }: SectionProps) {
  return (
    <SectionGrid>
      <TextField form={form} name="year_built" label="Baujahr" inputMode="numeric" maxLength={4} placeholder="z. B. 1998" optional />
      <TextField
        form={form}
        name="year_renovated"
        label="Letzte Gesamtrenovation"
        inputMode="numeric"
        maxLength={4}
        placeholder="z. B. 2018"
        optional
        hint="Einzelne Erneuerungen erfassen Sie im Abschnitt «Renovationen»."
      />
      {isFieldVisible("floor", type, offer) ? (
        <SelectField
          form={form}
          name="floor"
          label="Etage"
          options={FLOOR_OPTIONS}
          info={HELP.floor}
          required={type === "apartment"}
          optional={type !== "apartment"}
        />
      ) : null}
      <TextField
        form={form}
        name="floors_total"
        label={fieldLabel("floors_total", type)}
        inputMode="numeric"
        placeholder="z. B. 4"
        optional
        hint={type === "apartment" ? "Alle Geschosse des Gebäudes inklusive Erdgeschoss." : undefined}
      />
    </SectionGrid>
  );
}

// ---------------------------------------------------------------------------
// Zustand & Energie
// ---------------------------------------------------------------------------

export function ConditionSection({ form }: SectionProps) {
  return (
    <div className="grid gap-5">
      <SectionGrid>
        <SelectField form={form} name="condition" label="Zustand" options={options(CONDITIONS)} optional />
        <SelectField form={form} name="heating_type" label="Heizung" options={options(HEATING_TYPES)} optional />
        <SelectField
          form={form}
          name="energy_label"
          label="GEAK-Klasse"
          options={ENERGY_LABELS.map((label) => ({
            value: label,
            label: label === "A" ? "A (sehr effizient)" : label === "G" ? "G (wenig effizient)" : label,
          }))}
          placeholder="Kein GEAK vorhanden"
          info={HELP.energy_label}
          optional
        />
        <TextField
          form={form}
          name="energy_demand_kwh"
          label="Energiekennzahl"
          inputMode="decimal"
          suffix="kWh/m²a"
          info={HELP.energy_demand_kwh}
          optional
        />
      </SectionGrid>
      <SwitchField form={form} name="is_minergie" label="Minergie-zertifiziert" description="Nur aktivieren, wenn ein gültiges Zertifikat vorliegt." />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ausstattung
// ---------------------------------------------------------------------------

const FEATURE_GROUPS = Array.from(new Set(Object.values(FEATURE_CATALOG).map((f) => f.group)));

export function AmenitiesSection({ form, type, offer }: SectionProps) {
  const building = isBuilding(type);
  // Garage steht bei den Parkplätzen, Minergie beim Zustand
  const amenities = AMENITY_FLAGS.filter(
    (flag) => flag.key !== "has_garage" && flag.key !== "is_minergie" && isFieldVisible(flag.key, type, offer),
  );
  const groups = building ? FEATURE_GROUPS : FEATURE_GROUPS.filter((group) => group === "Lage");
  return (
    <div className="grid gap-7">
      {amenities.length ? (
        <fieldset className="grid gap-3">
          <legend className="mb-3 text-sm font-semibold">Vorhanden</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {amenities.map((flag) => (
              <SwitchField key={flag.key} form={form} name={flag.key} label={flag.label} />
            ))}
          </div>
        </fieldset>
      ) : null}

      {isFieldVisible("pets_allowed", type, offer) ? (
        <SelectField
          form={form}
          name="pets_allowed"
          label="Haustiere"
          options={[
            { value: "yes", label: "Haustiere erlaubt" },
            { value: "no", label: "Keine Haustiere" },
          ]}
          placeholder="Keine Angabe"
          optional
          className="sm:max-w-xs"
        />
      ) : null}

      <Controller
        control={form.control}
        name="features"
        render={({ field }) => {
          const selected = new Set(field.value);
          function toggle(key: FeatureKey) {
            const next = new Set(selected);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            field.onChange(Array.from(next));
          }
          return (
            <div className="grid gap-5">
              {groups.map((group) => (
                <fieldset key={group}>
                  <legend className="mb-3 text-sm font-semibold">{group}</legend>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(FEATURE_CATALOG) as [FeatureKey, (typeof FEATURE_CATALOG)[FeatureKey]][])
                      .filter(([, feature]) => feature.group === group)
                      .map(([key, feature]) => {
                        const active = selected.has(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggle(key)}
                            className={cn(
                              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                              active
                                ? "border-brand bg-mint-100 text-forest"
                                : "border-border bg-card text-foreground/80 hover:border-mint-300 hover:bg-mint-50",
                            )}
                          >
                            {active ? <Check className="size-4" aria-hidden /> : null}
                            {feature.label}
                          </button>
                        );
                      })}
                  </div>
                </fieldset>
              ))}
            </div>
          );
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parkplätze
// ---------------------------------------------------------------------------

export function ParkingSection({ form }: SectionProps) {
  function autoGarage(value: string) {
    const count = Number(value.replace(/\s/g, ""));
    if (Number.isFinite(count) && count > 0 && !form.getValues("has_garage")) {
      form.setValue("has_garage", true, { shouldDirty: true });
    }
  }
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField form={form} name="garage_spaces" label="Garagenplätze" inputMode="numeric" placeholder="0" onValueChange={autoGarage} />
        <TextField form={form} name="underground_parking_spaces" label="Tiefgaragenplätze" inputMode="numeric" placeholder="0" />
        <TextField form={form} name="outdoor_parking_spaces" label="Aussenparkplätze" inputMode="numeric" placeholder="0" />
      </div>
      <SwitchField form={form} name="has_garage" label="Garage vorhanden" description="Einzel- oder Doppelgarage, auch ohne genaue Platzzahl." />
      <p className="text-sm text-muted-foreground">Den Preis für Parkplätze legen Sie im Schritt «Inserat» fest.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verfügbarkeit & Kosten
// ---------------------------------------------------------------------------

export function AvailabilitySection({ form, type, offer }: SectionProps) {
  const byArrangement = useWatch({ control: form.control, name: "available_by_arrangement" });
  return (
    <div className="grid gap-5">
      <SwitchField
        form={form}
        name="available_by_arrangement"
        label="Verfügbar nach Vereinbarung"
        description="Kein fixes Datum – Bezug nach Absprache."
        onCheckedChange={(checked) => {
          if (checked) form.setValue("available_from", "", { shouldDirty: true });
        }}
      />
      <SectionGrid>
        {byArrangement ? (
          <p className="self-center text-sm text-muted-foreground">Kein Datum nötig – die Verfügbarkeit wird «nach Vereinbarung» angezeigt.</p>
        ) : (
          <TextField form={form} name="available_from" label="Verfügbar ab" type="date" optional />
        )}
        {isFieldVisible("service_charges", type, offer) ? (
          <TextField
            form={form}
            name="service_charges"
            label="Nebenkosten pro Monat"
            inputMode="decimal"
            prefix="CHF"
            optional
            hint={
              offer === "rent"
                ? "Akonto für Heizung, Warmwasser, Hauswartung usw."
                : "Bei Stockwerkeigentum die monatliche Akontozahlung an die Gemeinschaft."
            }
          />
        ) : null}
      </SectionGrid>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Besonderheiten & Aussicht
// ---------------------------------------------------------------------------

export function SpecialSection({ form }: SectionProps) {
  return (
    <div className="grid gap-5">
      <TextField
        form={form}
        name="view_description"
        label="Aussicht"
        optional
        maxLength={300}
        placeholder="z. B. Weitsicht auf die Berner Alpen"
      />
      <TextAreaField
        form={form}
        name="special_features"
        label="Besonderheiten"
        maxLength={4000}
        rows={6}
        placeholder="z. B. Wohnküche mit Kochinsel, neue Fenster 2021, ruhige Lage am Waldrand"
        hint="Stichworte genügen. Die KI-Texte im Schritt «Beschreibung» verwenden nur, was Sie hier und in den anderen Feldern angeben."
      />
    </div>
  );
}
