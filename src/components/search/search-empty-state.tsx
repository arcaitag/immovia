import Link from "next/link";
import { ArrowRight, HousePlus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { countActiveFilters } from "@/lib/search/criteria";
import { OFFER_TYPES } from "@/lib/constants";
import { SaveSearchButton } from "@/components/saved-searches/save-search-dialog";
import { hasLocation, patchCriteria, searchHref, withoutFilters, type SearchSnapshot } from "@/components/search/url-state";

const RADIUS_STEPS = [5, 10, 20, 30, 50, 100];

interface Suggestion {
  href: string;
  label: string;
}

/** Konkrete Vorschläge, wie die Suche zu Treffern führt. */
export function emptyStateSuggestions(snapshot: SearchSnapshot): Suggestion[] {
  const c = snapshot.criteria;
  const base = { view: snapshot.view, sort: snapshot.sort };
  const suggestions: Suggestion[] = [];
  if (countActiveFilters(c) > 0) {
    suggestions.push({ href: searchHref({ ...base, criteria: withoutFilters(c), bbox: snapshot.bbox }), label: "Filter entfernen und Ort behalten" });
  }
  if (snapshot.bbox) {
    suggestions.push({ href: searchHref({ ...base, criteria: c, bbox: null }), label: "Kartenausschnitt aufheben" });
  }
  if (c.lat !== undefined && c.lng !== undefined) {
    const next = c.radius ? RADIUS_STEPS.find((km) => km > (c.radius ?? 0)) : 10;
    if (next) {
      suggestions.push({
        href: searchHref({ ...base, criteria: patchCriteria(c, { radius: next }), bbox: snapshot.bbox }),
        label: c.radius ? `Umkreis auf ${next} km vergrössern` : `Umkreis von ${next} km einbeziehen`,
      });
    }
  }
  if (c.offer) {
    const other = c.offer === "sale" ? "rent" : "sale";
    suggestions.push({
      href: searchHref({ ...base, criteria: patchCriteria(c, { offer: other, price_min: undefined, price_max: undefined, pets: undefined }), bbox: snapshot.bbox }),
      label: `Angebote zum ${OFFER_TYPES[other].label} ansehen`,
    });
  }
  return suggestions;
}

export function SearchEmptyState({ snapshot, returnTo }: { snapshot: SearchSnapshot; returnTo: string }) {
  const c = snapshot.criteria;
  const noCriteria = !hasLocation(c) && countActiveFilters(c) === 0 && !snapshot.bbox;

  if (noCriteria) {
    return (
      <EmptyState
        icon={HousePlus}
        title="Noch keine passenden Inserate online"
        description={
          c.offer
            ? `Aktuell ist kein Angebot zum ${OFFER_TYPES[c.offer].label} veröffentlicht. Speichern Sie einen Suchauftrag – wir melden uns, sobald etwas Passendes erscheint.`
            : "Aktuell sind noch keine Inserate veröffentlicht. Speichern Sie einen Suchauftrag oder inserieren Sie Ihre eigene Immobilie kostenlos."
        }
        action={
          <>
            <SaveSearchButton criteria={c} hasBbox={false} returnTo={returnTo} variant="default" label="Suchauftrag anlegen" autoOpenFromHash={false} />
            <Button asChild variant="outline">
              <Link href="/verkaufen/start">Kostenlos inserieren</Link>
            </Button>
          </>
        }
      />
    );
  }

  const suggestions = emptyStateSuggestions(snapshot);
  return (
    <EmptyState
      icon={SearchX}
      title="Keine Immobilien gefunden"
      description="Zu diesen Kriterien gibt es gerade kein Angebot. Erweitern Sie die Suche oder lassen Sie sich benachrichtigen, sobald ein passendes Inserat veröffentlicht wird."
      action={
        <div className="grid w-full max-w-md gap-4">
          {suggestions.length ? (
            <ul className="grid gap-2 text-left">
              {suggestions.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:border-mint-300 hover:bg-mint-50"
                  >
                    {s.label}
                    <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <SaveSearchButton
            criteria={c}
            hasBbox={Boolean(snapshot.bbox)}
            returnTo={returnTo}
            variant="default"
            label="Suchauftrag für diese Suche anlegen"
            autoOpenFromHash={false}
            className="w-full"
          />
        </div>
      }
    />
  );
}
