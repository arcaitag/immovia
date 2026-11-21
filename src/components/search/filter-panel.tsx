"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CANTONS, CONDITIONS, PROPERTY_TYPE_OPTIONS, type OfferType, type PropertyCondition, type PropertyType } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { SearchCriteria } from "@/lib/search/criteria";
import {
  AREA_STEPS,
  FEATURE_FILTERS,
  PLOT_STEPS,
  ROOM_STEPS,
  YEAR_STEPS,
  maxOptions,
  minOptions,
  priceSteps,
} from "@/lib/search/filter-options";
import { useSearch } from "@/components/search/search-context";
import { LOCATION_KEYS, patchCriteria, withoutFilters } from "@/components/search/url-state";
import { cn } from "@/lib/utils";

/** Merkmale für die Chips der aktiven Filter (gleiche Reihenfolge wie im Filter) */
export const AMENITY_FILTERS = FEATURE_FILTERS;

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

/** Umschaltbarer Chip (Objektart, Merkmale, Zustand) */
function Pill({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        pressed ? "border-forest bg-forest text-white" : "border-border bg-card text-foreground hover:border-forest/40 hover:bg-mint-50",
      )}
    >
      {children}
    </button>
  );
}

/** «Kein Min.» bis «Kein Max.» mit Vorschlagswerten; die Auswahl schliesst widersprüchliche Werte aus. */
function RangeSelect({
  id,
  label,
  steps,
  min,
  max,
  format,
  onChange,
}: {
  id: string;
  label: string;
  steps: number[];
  min: number | undefined;
  max: number | undefined;
  format: (value: number) => string;
  onChange: (min: number | undefined, max: number | undefined) => void;
}) {
  const parse = (value: string) => (value ? Number(value) : undefined);
  // In der schmalen Seitenleiste ohne «bis» und mit kleinerer Schrift, damit die Werte lesbar bleiben
  const selectClass = "pl-3 pr-8 text-sm @[20rem]:pl-3.5 @[20rem]:text-[0.9375rem]";
  return (
    <div className="grid grid-cols-2 items-center gap-2 @[20rem]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <NativeSelect
        id={`${id}-von`}
        aria-label={`${label} von`}
        className={selectClass}
        value={min ?? ""}
        onChange={(e) => onChange(parse(e.target.value), max)}
      >
        <option value="">Kein Min.</option>
        {minOptions(steps, min, max).map((v) => (
          <option key={v} value={v}>
            {format(v)}
          </option>
        ))}
      </NativeSelect>
      <span aria-hidden className="hidden text-sm text-muted-foreground @[20rem]:inline">
        bis
      </span>
      <NativeSelect
        id={`${id}-bis`}
        aria-label={`${label} bis`}
        className={selectClass}
        value={max ?? ""}
        onChange={(e) => onChange(min, parse(e.target.value))}
      >
        <option value="">Kein Max.</option>
        {maxOptions(steps, max, min).map((v) => (
          <option key={v} value={v}>
            {format(v)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

const rooms = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const squareMetres = (v: number) => `${formatNumber(v)} m²`;

/**
 * Alle Suchfilter. Änderungen werden sofort in die URL übernommen; die Trefferliste aktualisiert sich serverseitig.
 */
export function FilterPanel({
  idPrefix,
  className,
  footer,
  routeChangeHash,
  showReset = true,
}: {
  idPrefix: string;
  className?: string;
  footer?: React.ReactNode;
  /** Anker für Wechsel der Angebotsart (neue Route), damit ein umgebendes Sheet wieder aufgeht */
  routeChangeHash?: string;
  /** «Filter zurücksetzen» unten anzeigen (im Sheet steht der Knopf im Kopf) */
  showReset?: boolean;
}) {
  const { snapshot, navigate } = useSearch();
  const criteria = snapshot.criteria;
  const offer = criteria.offer;

  const update = (patch: Partial<SearchCriteria>) => navigate({ criteria: patchCriteria(criteria, patch) });

  function toggleInList<T extends string>(list: T[] | undefined, value: T): T[] | undefined {
    const next = new Set(list ?? []);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next.size ? [...next] : undefined;
  }

  function setOffer(next: OfferType | undefined) {
    if (next === offer) return;
    // Jede Angebotsart hat eine eigene Route (/immobilien, /kaufen, /mieten); Preise passen nicht zur anderen Art
    navigate(
      { criteria: patchCriteria(criteria, { offer: next, price_min: undefined, price_max: undefined, pets: next === "rent" ? criteria.pets : undefined }) },
      { hash: routeChangeHash },
    );
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

  const priceLabel = offer === "rent" ? "Miete pro Monat (CHF)" : offer === "sale" ? "Kaufpreis (CHF)" : "Preis (CHF)";
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className={cn("@container grid gap-5", className)}>
      <FilterSection title="Angebot">
        <div role="group" aria-label="Angebotsart" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {OFFER_CHOICES.map((choice) => {
            const active = choice.value === offer;
            return (
              <button
                key={choice.label}
                type="button"
                aria-pressed={active}
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

      <FilterSection title="Objektart">
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPE_OPTIONS.map((option) => (
            <Pill
              key={option.value}
              pressed={criteria.types?.includes(option.value) ?? false}
              onClick={() => update({ types: toggleInList<PropertyType>(criteria.types, option.value) })}
            >
              {option.label}
            </Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={priceLabel}>
        <RangeSelect
          id={id("preis")}
          label="Preis"
          steps={priceSteps(offer)}
          min={criteria.price_min}
          max={criteria.price_max}
          format={(v) => formatNumber(v)}
          onChange={(price_min, price_max) => update({ price_min, price_max })}
        />
        {offer === "rent" ? <p className="text-xs text-muted-foreground">Miete inklusive Nebenkosten.</p> : null}
        <div className="flex min-h-9 items-center justify-between gap-4">
          <Label htmlFor={id("mit-preis")} className="cursor-pointer font-medium">
            Nur Inserate mit Preis
          </Label>
          <Switch id={id("mit-preis")} checked={criteria.with_price === true} onCheckedChange={(on) => update({ with_price: on ? true : undefined })} />
        </div>
      </FilterSection>

      <FilterSection title="Zimmer">
        <RangeSelect
          id={id("zimmer")}
          label="Zimmer"
          steps={ROOM_STEPS}
          min={criteria.rooms_min}
          max={criteria.rooms_max}
          format={rooms}
          onChange={(rooms_min, rooms_max) => update({ rooms_min, rooms_max })}
        />
      </FilterSection>

      <FilterSection title="Wohnfläche">
        <RangeSelect
          id={id("flaeche")}
          label="Wohnfläche"
          steps={AREA_STEPS}
          min={criteria.area_min}
          max={criteria.area_max}
          format={squareMetres}
          onChange={(area_min, area_max) => update({ area_min, area_max })}
        />
      </FilterSection>

      <FilterSection title="Grundstücksfläche">
        <RangeSelect
          id={id("grundstueck")}
          label="Grundstücksfläche"
          steps={PLOT_STEPS}
          min={criteria.plot_min}
          max={criteria.plot_max}
          format={squareMetres}
          onChange={(plot_min, plot_max) => update({ plot_min, plot_max })}
        />
      </FilterSection>

      <FilterSection title="Merkmale und Ausstattung">
        <div className="flex flex-wrap gap-2">
          {FEATURE_FILTERS.filter((f) => !f.rentOnly || offer === "rent").map((feature) => (
            <Pill
              key={feature.key}
              pressed={criteria[feature.key] === true}
              onClick={() => {
                const patch: Partial<SearchCriteria> = {};
                patch[feature.key] = criteria[feature.key] === true ? undefined : true;
                update(patch);
              }}
            >
              {feature.label}
            </Pill>
          ))}
        </div>
        {offer !== "rent" ? <p className="text-xs text-muted-foreground">«Haustiere erlaubt» gibt es bei Mietobjekten.</p> : null}
      </FilterSection>

      <FilterSection title="Zustand">
        <div className="flex flex-wrap gap-2">
          {(Object.entries(CONDITIONS) as [PropertyCondition, string][]).map(([value, label]) => (
            <Pill
              key={value}
              pressed={criteria.conditions?.includes(value) ?? false}
              onClick={() => update({ conditions: toggleInList<PropertyCondition>(criteria.conditions, value) })}
            >
              {label}
            </Pill>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Baujahr">
        <NativeSelect
          id={id("baujahr")}
          aria-label="Baujahr ab"
          value={criteria.year_min ?? ""}
          onChange={(e) => update({ year_min: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Alle</option>
          {minOptions(YEAR_STEPS, criteria.year_min, undefined).map((year) => (
            <option key={year} value={year}>
              ab {year}
            </option>
          ))}
        </NativeSelect>
      </FilterSection>

      <FilterSection title="Kanton">
        <NativeSelect id={id("kanton")} aria-label="Kanton" value={criteria.canton ?? ""} onChange={(e) => setCanton(e.target.value)}>
          <option value="">Alle Kantone</option>
          {CANTONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </FilterSection>

      {footer || showReset ? (
        <div className="grid gap-2 border-t border-border pt-5">
          {footer}
          {showReset ? (
            <Button type="button" variant="ghost" onClick={() => navigate({ criteria: withoutFilters(criteria) })}>
              <RotateCcw aria-hidden /> Filter zurücksetzen
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
