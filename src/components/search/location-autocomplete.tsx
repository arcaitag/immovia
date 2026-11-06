"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Building, Loader2, MapPin, Signpost } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { LocationResult } from "@/lib/geo/swisstopo";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<LocationResult["kind"], string> = {
  municipality: "Gemeinde",
  postal_code: "PLZ",
  canton: "Kanton",
  district: "Bezirk",
  address: "Adresse",
};

/**
 * Barrierefreies Autocomplete (Combobox) für Schweizer Orte oder Adressen.
 * Freitext bleibt erlaubt; onSelect liefert den strukturierten Treffer.
 */
export function LocationAutocomplete({
  id,
  value,
  onValueChange,
  onSelect,
  mode = "place",
  placeholder = "Ort, Stadt, PLZ oder Region",
  className,
  inputClassName,
  showIcon = true,
  name,
  required,
  autoFocus,
  ...aria
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (result: LocationResult) => void;
  mode?: "place" | "address";
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  showIcon?: boolean;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const debounced = useDebouncedValue(value, 250);
  const listId = `${id}-liste`;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["orte", mode, debounced],
    enabled: open && debounced.trim().length >= 2,
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/orte?art=${mode === "address" ? "adresse" : "ort"}&q=${encodeURIComponent(debounced)}`, { signal });
      const json = (await res.json()) as { results: LocationResult[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Ortssuche nicht verfügbar");
      return json.results;
    },
  });
  const results = data ?? [];

  function choose(result: LocationResult) {
    onSelect(result);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && open && active >= 0 && results[active]) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && value.trim().length >= 2;
  return (
    <div className={cn("relative", className)}>
      {showIcon ? (
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
      ) : null}
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        autoComplete="off"
        required={required}
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-12 w-full rounded-xl border border-input bg-card pr-9 text-[0.9375rem] text-foreground placeholder:text-muted-foreground/80 hover:border-mint-300 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mint-200/70 aria-invalid:border-destructive",
          showIcon ? "pl-10" : "pl-3.5",
          inputClassName,
        )}
        {...aria}
      />
      {isFetching ? (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-float"
        >
          {isError ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">Die Ortssuche ist momentan nicht erreichbar. Sie können den Ort auch frei eingeben.</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">{isFetching ? "Suche läuft …" : "Keine Treffer"}</li>
          ) : (
            results.map((r, i) => {
              const Icon = r.kind === "address" ? Signpost : r.kind === "canton" ? Building : MapPin;
              return (
                <li
                  key={`${r.kind}-${r.id}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(r);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm", i === active && "bg-mint-50")}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1 truncate font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{KIND_LABEL[r.kind]}</span>
                </li>
              );
            })
          )}
          <li className="px-3 pb-1 pt-2 text-[10px] text-muted-foreground" aria-hidden>
            Ortsdaten © swisstopo
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** Übernimmt einen Treffer in Suchkriterien. */
export function locationToCriteria(result: LocationResult): {
  label: string;
  municipality?: string;
  postal_code?: string;
  canton?: string;
  lat?: number;
  lng?: number;
} {
  switch (result.kind) {
    case "canton":
      return { label: result.label, canton: result.canton };
    case "postal_code":
      return { label: result.label, postal_code: result.postalCode, lat: result.lat, lng: result.lng };
    case "municipality":
      return { label: result.label, municipality: result.municipality, canton: result.canton, lat: result.lat, lng: result.lng };
    default:
      return { label: result.label, lat: result.lat, lng: result.lng };
  }
}
