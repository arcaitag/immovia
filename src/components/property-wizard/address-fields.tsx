"use client";

import * as React from "react";
import { CircleCheck, Info } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { LocationAutocomplete } from "@/components/search/location-autocomplete";
import { CANTONS } from "@/lib/constants";
import type { LocationResult } from "@/lib/geo/swisstopo";

export interface AddressValues {
  street: string;
  house_number: string;
  postal_code: string;
  municipality: string;
  canton: string;
  latitude: number | null;
  longitude: number | null;
  egid: number | null;
}

type AddressTextField = "street" | "house_number" | "postal_code" | "municipality";

const CANTON_SET = new Set<string>(CANTONS.map((c) => c.code));

/**
 * Adresseingabe mit Schweizer Adresssuche (geo.admin.ch). Ein Vorschlag füllt alle
 * Felder inkl. Koordinaten und EGID; manuelle Korrekturen bleiben möglich. Wird eine
 * Adresse von Hand geändert, werden die Koordinaten verworfen (sie passen nicht mehr).
 */
export function AddressFields({
  idPrefix,
  values,
  errors,
  onChange,
  required = false,
}: {
  idPrefix: string;
  values: AddressValues;
  errors?: Partial<Record<keyof AddressValues, string | undefined>>;
  onChange: (patch: Partial<AddressValues>) => void;
  required?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const hasCoordinates = values.latitude !== null && values.longitude !== null;

  function select(result: LocationResult) {
    onChange({
      street: result.street ?? values.street,
      house_number: result.houseNumber ?? (result.street ? "" : values.house_number),
      postal_code: result.postalCode ?? values.postal_code,
      municipality: result.municipality ?? values.municipality,
      canton: result.canton && CANTON_SET.has(result.canton) ? result.canton : values.canton,
      latitude: result.lat,
      longitude: result.lng,
      egid: result.egid ?? null,
    });
    setQuery(result.label);
  }

  function edit(field: AddressTextField, value: string) {
    onChange(hasCoordinates ? { [field]: value, latitude: null, longitude: null, egid: null } : { [field]: value });
  }

  return (
    <div className="grid gap-5">
      <Field
        label="Adresse suchen"
        htmlFor={`${idPrefix}-suche`}
        hint="Tippen Sie Strasse und Ort ein und wählen Sie einen Vorschlag. Die Felder darunter werden automatisch ausgefüllt."
      >
        <LocationAutocomplete
          id={`${idPrefix}-suche`}
          mode="address"
          value={query}
          onValueChange={setQuery}
          onSelect={select}
          placeholder="z. B. Bernstrasse 12, Ostermundigen"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <Field label="Strasse" htmlFor={`${idPrefix}-strasse`} error={errors?.street} optional>
          <Input
            value={values.street}
            onChange={(e) => edit("street", e.target.value)}
            autoComplete="address-line1"
            maxLength={120}
          />
        </Field>
        <Field label="Nr." htmlFor={`${idPrefix}-nummer`} error={errors?.house_number} optional>
          <Input value={values.house_number} onChange={(e) => edit("house_number", e.target.value)} maxLength={12} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1.4fr)]">
        <Field label="PLZ" htmlFor={`${idPrefix}-plz`} error={errors?.postal_code} required={required}>
          <Input
            value={values.postal_code}
            onChange={(e) => edit("postal_code", e.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={4}
          />
        </Field>
        <Field label="Gemeinde / Ort" htmlFor={`${idPrefix}-ort`} error={errors?.municipality} required={required}>
          <Input
            value={values.municipality}
            onChange={(e) => edit("municipality", e.target.value)}
            autoComplete="address-level2"
            maxLength={80}
          />
        </Field>
        <Field label="Kanton" htmlFor={`${idPrefix}-kanton`} error={errors?.canton} required={required}>
          <NativeSelect value={values.canton} onChange={(e) => onChange({ canton: e.target.value })}>
            <option value="">Bitte wählen</option>
            {CANTONS.map((canton) => (
              <option key={canton.code} value={canton.code}>
                {canton.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground" aria-live="polite">
        {hasCoordinates ? (
          <>
            <CircleCheck className="mt-px size-4 shrink-0 text-primary" aria-hidden />
            Standort aus dem amtlichen Adressverzeichnis übernommen{values.egid ? ` (Gebäude-ID ${values.egid})` : ""}.
          </>
        ) : (
          <>
            <Info className="mt-px size-4 shrink-0" aria-hidden />
            Ohne Adressvorschlag wird kein Kartenstandort gespeichert. Die Suche funktioniert dann nur über PLZ und Ort.
          </>
        )}
      </p>
    </div>
  );
}
