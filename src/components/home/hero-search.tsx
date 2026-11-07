"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BedDouble, Building2, ChevronDown, Coins, House, KeyRound, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/select";
import { LocationAutocomplete, locationToCriteria } from "@/components/search/location-autocomplete";
import type { OfferType } from "@/lib/constants";
import type { SearchCriteria } from "@/lib/search/criteria";
import { HERO_PRICE_OPTIONS, HERO_ROOM_OPTIONS, HERO_TYPE_GROUPS, heroSearchHref } from "@/lib/search/hero";
import { formatChf, formatRooms } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "sale", label: "Kaufen", icon: House },
  { value: "rent", label: "Mieten", icon: KeyRound },
] as const satisfies ReadonlyArray<{ value: OfferType; label: string; icon: typeof House }>;

const fieldClass = "h-14 rounded-xl border-input bg-white pl-11 text-[0.9375rem] hover:border-mint-300";

/** Auswahlfeld mit Symbol links; ohne Auswahl wirkt der Text wie ein Platzhalter. */
function IconSelect({
  icon: Icon,
  value,
  className,
  children,
  ...props
}: React.ComponentProps<"select"> & { icon: typeof House }) {
  return (
    <div className={cn("relative", className)}>
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
      <NativeSelect value={value} className={cn(fieldClass, value ? "text-foreground" : "text-foreground/75")} {...props}>
        {children}
      </NativeSelect>
    </div>
  );
}

export function HeroSearch({ defaultOffer = "sale" }: { defaultOffer?: OfferType }) {
  const router = useRouter();
  const [offer, setOffer] = React.useState<OfferType>(defaultOffer);
  const [place, setPlace] = React.useState("");
  const [location, setLocation] = React.useState<Partial<SearchCriteria>>({});
  const [typeGroup, setTypeGroup] = React.useState("");
  const [priceMax, setPriceMax] = React.useState("");
  const [roomsMin, setRoomsMin] = React.useState("");
  // Mobil: Objektart, Preis und Zimmer erst auf Wunsch einblenden
  const [moreOpen, setMoreOpen] = React.useState(false);
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const input = { offer, place, location, typeGroup, priceMax, roomsMin };

  function chooseOffer(next: OfferType) {
    if (next === offer) return;
    setOffer(next);
    // Kaufpreise und Mieten haben unterschiedliche Grenzen
    setPriceMax("");
  }

  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    chooseOffer(TABS[nextIndex]!.value);
    tabRefs.current[nextIndex]?.focus();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    router.push(heroSearchHref(input));
  }

  function openAllFilters() {
    router.push(heroSearchHref(input, { openFilters: true }));
  }

  const actionClass =
    "inline-flex min-h-10 items-center gap-2 rounded-lg text-[0.9375rem] font-semibold text-forest transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-11";

  return (
    <div className="relative">
      <div role="tablist" aria-label="Angebotsart" className="relative inline-flex gap-1 rounded-t-[1.25rem] bg-white px-2 pt-2 sm:px-3 sm:pt-3">
        {TABS.map((tab, index) => {
          const selected = offer === tab.value;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              id={`hero-tab-${tab.value}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="hero-suche"
              tabIndex={selected ? 0 : -1}
              onClick={() => chooseOffer(tab.value)}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              className={cn(
                "inline-flex h-12 items-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors sm:px-7",
                selected ? "bg-mint-200 text-forest" : "text-foreground/80 hover:bg-mint-50 hover:text-forest",
              )}
            >
              <tab.icon className="size-[18px]" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id="hero-suche"
        role="tabpanel"
        aria-labelledby={`hero-tab-${offer}`}
        className="rounded-[1.25rem] rounded-tl-none bg-white p-3 shadow-[0_2px_6px_rgb(25_40_32/0.06),0_28px_56px_-28px_rgb(25_40_32/0.35)] sm:p-4"
      >
        <form
          onSubmit={submit}
          role="search"
          aria-label="Immobilien suchen"
          className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_repeat(3,minmax(0,1fr))_auto] lg:items-center"
        >
          <LocationAutocomplete
            id="hero-ort"
            aria-label="Ort, PLZ oder Region"
            placeholder="Ort, PLZ oder Region"
            value={place}
            inputClassName="h-14 rounded-xl bg-white pl-11 text-[0.9375rem]"
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

          <div id="hero-filter-felder" className={cn("gap-3 sm:grid-cols-3", moreOpen ? "grid" : "hidden", "lg:contents")}>
            <IconSelect icon={Building2} aria-label="Immobilientyp" value={typeGroup} onChange={(e) => setTypeGroup(e.target.value)}>
              <option value="">Immobilientyp</option>
              {HERO_TYPE_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </IconSelect>
            <IconSelect
              icon={Coins}
              aria-label={offer === "sale" ? "Kaufpreis bis" : "Miete pro Monat bis"}
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            >
              <option value="">Preis bis</option>
              {HERO_PRICE_OPTIONS[offer].map((p) => (
                <option key={p} value={p}>
                  {offer === "sale" ? `bis ${formatChf(p)}` : `bis ${formatChf(p)} / Monat`}
                </option>
              ))}
            </IconSelect>
            <IconSelect icon={BedDouble} aria-label="Zimmer ab" value={roomsMin} onChange={(e) => setRoomsMin(e.target.value)}>
              <option value="">Zimmer ab</option>
              {HERO_ROOM_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  ab {formatRooms(r)}
                </option>
              ))}
            </IconSelect>
          </div>

          <Button type="submit" size="lg" className="h-14 rounded-xl px-6 text-base font-semibold">
            <Search className="size-5" aria-hidden />
            Immobilien suchen
          </Button>
        </form>

        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-0 px-1 sm:mt-3 sm:px-2">
          {/* Mobil: Schnellfilter ein- und ausblenden; Desktop: alle Filter auf der Suchseite */}
          <button
            type="button"
            className={cn(actionClass, "lg:hidden")}
            aria-expanded={moreOpen}
            aria-controls="hero-filter-felder"
            onClick={() => setMoreOpen((v) => !v)}
          >
            <SlidersHorizontal className="size-[18px]" aria-hidden />
            Weitere Filter
            <ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} aria-hidden />
          </button>
          <button type="button" className={cn(actionClass, "hidden lg:inline-flex")} onClick={openAllFilters}>
            <SlidersHorizontal className="size-[18px]" aria-hidden />
            Weitere Filter
          </button>
          {moreOpen ? (
            <button type="button" className={cn(actionClass, "lg:hidden")} onClick={openAllFilters}>
              Alle Filter
              <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : null}
          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <Link href="/verkaufen" className={actionClass}>
            Immobilie verkaufen
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/bewerten" className={actionClass}>
            Kostenlos bewerten
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
