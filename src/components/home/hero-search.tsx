"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, House, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { LocationAutocomplete, locationToCriteria } from "@/components/search/location-autocomplete";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/constants";
import { toSearchParams, type SearchCriteria } from "@/lib/search/criteria";
import { formatChf } from "@/lib/format";
import { cn } from "@/lib/utils";

const BUDGETS = {
  sale: [300_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000],
  rent: [1_000, 1_500, 2_000, 2_500, 3_000, 4_000, 5_000],
} as const;
const ROOMS = [1, 2, 3, 3.5, 4, 4.5, 5, 6];
const AREAS = [40, 60, 80, 100, 120, 150, 200];

export function HeroSearch({ defaultOffer = "sale" }: { defaultOffer?: "sale" | "rent" }) {
  const router = useRouter();
  const [offer, setOffer] = React.useState<"sale" | "rent">(defaultOffer);
  const [place, setPlace] = React.useState("");
  const [location, setLocation] = React.useState<Partial<SearchCriteria>>({});
  const [type, setType] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [rooms, setRooms] = React.useState("");
  const [area, setArea] = React.useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const criteria: SearchCriteria = {
      offer,
      ...(location.label === place ? location : place.trim() ? { q: place.trim(), label: place.trim() } : {}),
      types: type ? [type as SearchCriteria["types"] extends (infer T)[] | undefined ? T : never] : undefined,
      price_max: budget ? Number(budget) : undefined,
      rooms_min: rooms ? Number(rooms) : undefined,
      area_min: area ? Number(area) : undefined,
    };
    if (criteria.lat && criteria.lng && !criteria.radius && !criteria.canton) criteria.radius = 10;
    const params = toSearchParams({ criteria }, { omitOffer: true });
    router.push(`/${offer === "sale" ? "kaufen" : "mieten"}${params.size ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="relative">
      <div role="tablist" aria-label="Angebotsart" className="inline-flex gap-1 rounded-t-2xl bg-white px-3 pt-3 sm:px-4">
        {(
          [
            { value: "sale", label: "Kaufen", icon: House },
            { value: "rent", label: "Mieten", icon: Building2 },
          ] as const
        ).map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={offer === tab.value}
            onClick={() => {
              setOffer(tab.value);
              setBudget("");
            }}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[0.9375rem] font-semibold transition-colors",
              offer === tab.value ? "bg-mint-200 text-forest" : "text-foreground/80 hover:bg-muted",
            )}
          >
            <tab.icon className="size-[18px]" aria-hidden />
            {tab.label}
          </button>
        ))}
      </div>
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-2xl rounded-tl-none bg-white p-3 shadow-float sm:p-4 lg:grid-cols-[minmax(0,2.2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-center"
        role="search"
        aria-label="Immobilien suchen"
      >
        <LocationAutocomplete
          id="hero-ort"
          aria-label="Ort, Stadt, PLZ oder Region"
          value={place}
          onValueChange={(v) => {
            setPlace(v);
            if (v !== location.label) setLocation({});
          }}
          onSelect={(r) => {
            const c = locationToCriteria(r);
            setPlace(c.label);
            setLocation(c);
          }}
        />
        <NativeSelect aria-label="Immobilientyp" value={type} onChange={(e) => setType(e.target.value)} className="h-12">
          <option value="">Alle Typen</option>
          {PROPERTY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Maximales Budget" value={budget} onChange={(e) => setBudget(e.target.value)} className="h-12">
          <option value="">Budget bis</option>
          {BUDGETS[offer].map((b) => (
            <option key={b} value={b}>
              {formatChf(b)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Zimmer ab" value={rooms} onChange={(e) => setRooms(e.target.value)} className="h-12">
          <option value="">Zimmer ab</option>
          {ROOMS.map((r) => (
            <option key={r} value={r}>
              ab {r}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Wohnfläche ab" value={area} onChange={(e) => setArea(e.target.value)} className="h-12">
          <option value="">Fläche ab</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              ab {a} m²
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" size="lg" className="h-12 px-6">
          <Search className="size-5" aria-hidden />
          Suchen
        </Button>
      </form>
    </div>
  );
}
