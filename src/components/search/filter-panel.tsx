"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { CANTONS, CONDITIONS, PROPERTY_TYPE_OPTIONS, type OfferType, type PropertyCondition, type PropertyType } from "@/lib/constants";
import type { SearchCriteria } from "@/lib/search/criteria";
import { useSearch } from "@/components/search/search-context";
import { DebouncedNumberInput } from "@/components/search/debounced-number-input";
import { LOCATION_KEYS, patchCriteria, withoutFilters } from "@/components/search/url-state";
import { cn } from "@/lib/utils";

const ROOM_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8];

type BooleanKey = "balcony" | "terrace" | "garden" | "parking" | "garage" | "elevator" | "wheelchair" | "new_build" | "pets";

export const AMENITY_FILTERS: { key: BooleanKey; label: string; rentOnly?: boolean }[] = [
  { key: "balcony", label: "Balkon" },
  { key: "terrace", label: "Terrasse" },
  { key: "garden", label: "Garten" },
  { key: "parking", label: "Parkplatz" },
  { key: "garage", label: "Garage" },
  { key: "elevator", label: "Lift" },
  { key: "wheelchair", label: "Rollstuhlgängig" },
  { key: "new_build", label: "Neubau" },
  { key: "pets", label: "Haustiere erlaubt", rentOnly: true },
];

const OFFER_CHOICES: { value: OfferType | undefined; label: string }[] = [
  { value: undefined, label: "Alle" },
  { value: "sale", label: "Kaufen" },
  { value: "rent", label: "Mieten" },
];

function FilterSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  const headingId = React.useId();
  return (
    <section role="group" aria-labelledby={headingId} className={cn("grid gap-3 border-t border-border pt-5 first:border-t-0 first:pt-0", className)}>
      <h3 id={headingId} className="font-display text-[0.9375rem] font-bold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CheckboxOption({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="cursor-pointer font-medium">
        {label}
      </Label>
    </div>
  );
}

/**
 * Alle Suchfilter gemäss Spezifikation. Änderungen werden sofort (Zahlenfelder verzögert)
 * in die URL übernommen; die Trefferliste aktualisiert sich serverseitig.
 */
export function FilterPanel({ idPrefix, className, footer }: { idPrefix: string; className?: string; footer?: React.ReactNode }) {
  const { snapshot, navigate } = useSearch();
  const criteria = snapshot.criteria;
  const offer = criteria.offer;

  const update = (patch: Partial<SearchCriteria>) => navigate({ criteria: patchCriteria(criteria, patch) });

  function toggleInList<T extends string>(list: T[] | undefined, value: T, on: boolean): T[] | undefined {
    const next = new Set(list ?? []);
    if (on) next.add(value);
    else next.delete(value);
    return next.size ? [...next] : undefined;
  }

  function setOffer(next: OfferType | undefined) {
    if (next === offer) return;
    update({ offer: next, price_min: undefined, price_max: undefined, pets: next === "rent" ? criteria.pets : undefined });
  }

  function setCanton(code: string) {
    if (!code) {
      update({ canton: undefined });
      return;
    }
    if (code === criteria.canton) return;
    const cleared: Partial<SearchCriteria> = {};
    for (const key of LOCATION_KEYS) cleared[key] = undefined;
    navigate({ criteria: patchCriteria(criteria, { ...cleared, canton: code }), bbox: null });
  }

  const priceLabel = offer === "rent" ? "Miete pro Monat (brutto)" : offer === "sale" ? "Kaufpreis" : "Preis";
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className={cn("grid gap-5", className)}>
      <FilterSection title="Angebot">
        <div role="radiogroup" aria-label="Angebotsart" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {OFFER_CHOICES.map((choice) => {
            const active = choice.value === offer;
            return (
              <button
                key={choice.label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setOffer(choice.value)}
                className={cn(
                  "h-10 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  active ? "bg-card text-forest shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection title="Immobilientyp">
        <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-1">
          {PROPERTY_TYPE_OPTIONS.map((option) => (
            <CheckboxOption
              key={option.value}
              id={id(`typ-${option.value}`)}
              label={option.label}
              checked={criteria.types?.includes(option.value) ?? false}
              onChange={(on) => update({ types: toggleInList<PropertyType>(criteria.types, option.value, on) })}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title={priceLabel}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="von" htmlFor={id("preis-von")}>
            <DebouncedNumberInput id={id("preis-von")} prefix="CHF" value={criteria.price_min} onCommit={(v) => update({ price_min: v })} placeholder="0" />
          </Field>
          <Field label="bis" htmlFor={id("preis-bis")}>
            <DebouncedNumberInput id={id("preis-bis")} prefix="CHF" value={criteria.price_max} onCommit={(v) => update({ price_max: v })} placeholder="beliebig" />
          </Field>
        </div>
        {offer === "rent" ? <p className="text-xs text-muted-foreground">Nettomiete inklusive Nebenkosten.</p> : null}
      </FilterSection>

      <FilterSection title="Zimmer">
        <div className="grid grid-cols-2 gap-2">
          <Field label="von" htmlFor={id("zimmer-von")}>
            <NativeSelect
              id={id("zimmer-von")}
              value={criteria.rooms_min ?? ""}
              onChange={(e) => update({ rooms_min: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">beliebig</option>
              {ROOM_STEPS.map((r) => (
                <option key={r} value={r}>
                  {Number.isInteger(r) ? r : r.toFixed(1)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="bis" htmlFor={id("zimmer-bis")}>
            <NativeSelect
              id={id("zimmer-bis")}
              value={criteria.rooms_max ?? ""}
              onChange={(e) => update({ rooms_max: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">beliebig</option>
              {ROOM_STEPS.map((r) => (
                <option key={r} value={r}>
                  {Number.isInteger(r) ? r : r.toFixed(1)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FilterSection>

      <FilterSection title="Wohnfläche">
        <div className="grid grid-cols-2 gap-2">
          <Field label="von" htmlFor={id("flaeche-von")}>
            <DebouncedNumberInput id={id("flaeche-von")} suffix="m²" maxDigits={6} value={criteria.area_min} onCommit={(v) => update({ area_min: v })} />
          </Field>
          <Field label="bis" htmlFor={id("flaeche-bis")}>
            <DebouncedNumberInput id={id("flaeche-bis")} suffix="m²" maxDigits={6} value={criteria.area_max} onCommit={(v) => update({ area_max: v })} />
          </Field>
        </div>
      </FilterSection>

      <FilterSection title="Region">
        <Field label="Kanton" htmlFor={id("kanton")}>
          <NativeSelect id={id("kanton")} value={criteria.canton ?? ""} onChange={(e) => setCanton(e.target.value)}>
            <option value="">Alle Kantone</option>
            {CANTONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </FilterSection>

      <FilterSection title="Ausstattung">
        <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-1">
          {AMENITY_FILTERS.filter((a) => !a.rentOnly || offer === "rent").map((amenity) => (
            <CheckboxOption
              key={amenity.key}
              id={id(`merkmal-${amenity.key}`)}
              label={amenity.label}
              checked={criteria[amenity.key] === true}
              onChange={(on) => {
                const patch: Partial<SearchCriteria> = {};
                patch[amenity.key] = on ? true : undefined;
                update(patch);
              }}
            />
          ))}
        </div>
        {offer !== "rent" ? (
          <p className="text-xs text-muted-foreground">Der Filter «Haustiere erlaubt» steht bei Mietobjekten zur Verfügung.</p>
        ) : null}
      </FilterSection>

      <FilterSection title="Weitere Angaben">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Grundstück ab" htmlFor={id("grundstueck")}>
            <DebouncedNumberInput id={id("grundstueck")} suffix="m²" maxDigits={7} value={criteria.plot_min} onCommit={(v) => update({ plot_min: v })} />
          </Field>
          <Field label="Baujahr ab" htmlFor={id("baujahr")}>
            <DebouncedNumberInput
              id={id("baujahr")}
              grouping={false}
              maxDigits={4}
              placeholder="z. B. 2000"
              value={criteria.year_min}
              onCommit={(v) => update({ year_min: v !== undefined && v >= 1000 && v <= 2100 ? v : undefined })}
            />
          </Field>
        </div>
        <div className="grid gap-y-0.5">
          <p className="mt-1 text-sm font-semibold">Zustand</p>
          {(Object.entries(CONDITIONS) as [PropertyCondition, string][]).map(([value, label]) => (
            <CheckboxOption
              key={value}
              id={id(`zustand-${value}`)}
              label={label}
              checked={criteria.conditions?.includes(value) ?? false}
              onChange={(on) => update({ conditions: toggleInList<PropertyCondition>(criteria.conditions, value, on) })}
            />
          ))}
        </div>
      </FilterSection>

      <div className="grid gap-2 border-t border-border pt-5">
        {footer}
        <Button type="button" variant="ghost" onClick={() => navigate({ criteria: withoutFilters(criteria) })}>
          <RotateCcw aria-hidden /> Filter zurücksetzen
        </Button>
      </div>
    </div>
  );
}
