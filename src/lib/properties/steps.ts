import type { ListingStatus } from "@/lib/constants";

/**
 * Die acht Schritte des Verkaufsassistenten. Der Status jedes Schritts wird
 * ausschliesslich aus echten Daten abgeleitet (keine gespeicherten Häkchen).
 */

export const PROPERTY_STEPS = [
  { key: "erfassen", number: 1, label: "Erfassen", title: "Immobilie erfassen", segment: "bearbeiten", required: true },
  { key: "bewertung", number: 2, label: "Bewertung", title: "Immobilie bewerten", segment: "bewertung", required: false },
  { key: "bilder", number: 3, label: "Bilder", title: "Bilder hochladen", segment: "bilder", required: true },
  { key: "beschreibung", number: 4, label: "Beschreibung", title: "Beschreibung erstellen", segment: "beschreibung", required: true },
  { key: "dossier", number: 5, label: "Dossier", title: "Verkaufsdossier erstellen", segment: "dossier", required: false },
  { key: "inserat", number: 6, label: "Inserat", title: "Preis, Texte und Kontakt festlegen", segment: "inserat", required: true },
  { key: "veroeffentlichung", number: 7, label: "Veröffentlichung", title: "Inserat veröffentlichen", segment: "veroeffentlichen", required: true },
  { key: "verwaltung", number: 8, label: "Verkaufsverwaltung", title: "Verkauf verwalten", segment: "verwaltung", required: false },
] as const;

export type PropertyStep = (typeof PROPERTY_STEPS)[number];
export type StepKey = PropertyStep["key"];
export type StepState = "done" | "in_progress" | "open";
export type StepStates = Record<StepKey, StepState>;

export const STEP_STATE_LABELS: Record<StepState, string> = {
  done: "Erledigt",
  in_progress: "In Arbeit",
  open: "Offen",
};

export function stepByKey(key: StepKey): PropertyStep {
  const step = PROPERTY_STEPS.find((s) => s.key === key);
  if (!step) throw new Error(`Unbekannter Schritt: ${key}`);
  return step;
}

export function stepHref(propertyId: string, key: StepKey): string {
  return `/dashboard/immobilien/${propertyId}/${stepByKey(key).segment}`;
}

export interface StepListingFacts {
  status: ListingStatus;
  title: string | null;
  short_description: string | null;
  description: string | null;
  price: number | null;
  price_on_request: boolean;
  texts_confirmed_at: string | null;
  first_published_at: string | null;
}

export interface StepFacts {
  completeness: { percent: number; isComplete: boolean };
  hasValuation: boolean;
  imageCount: number;
  minImages: number;
  dossierStatus: string | null;
  listing: StepListingFacts | null;
}

const hasText = (value: string | null | undefined) => typeof value === "string" && value.trim() !== "";

export function computeStepStates(facts: StepFacts): StepStates {
  const listing = facts.listing;
  const status = listing?.status ?? null;
  const wasPublished = Boolean(listing?.first_published_at);
  const hasPrice = Boolean(listing && (listing.price !== null || listing.price_on_request));

  const published: ListingStatus[] = ["published", "reserved", "paused", "sold", "rented"];
  const live: ListingStatus[] = ["published", "reserved", "paused"];
  const closed: ListingStatus[] = ["sold", "rented"];

  return {
    erfassen: facts.completeness.isComplete ? "done" : facts.completeness.percent > 0 ? "in_progress" : "open",
    bewertung: facts.hasValuation ? "done" : "open",
    bilder: facts.imageCount >= Math.max(1, facts.minImages) ? "done" : facts.imageCount > 0 ? "in_progress" : "open",
    beschreibung:
      listing && hasText(listing.title) && hasText(listing.description)
        ? "done"
        : listing && (hasText(listing.title) || hasText(listing.short_description) || hasText(listing.description))
          ? "in_progress"
          : "open",
    dossier: facts.dossierStatus === "ready" ? "done" : facts.dossierStatus === "generating" ? "in_progress" : "open",
    inserat:
      listing && hasPrice && listing.texts_confirmed_at
        ? "done"
        : listing && (hasPrice || listing.texts_confirmed_at)
          ? "in_progress"
          : "open",
    veroeffentlichung:
      status && (published.includes(status) || (status === "archived" && wasPublished))
        ? "done"
        : status === "pending_review"
          ? "in_progress"
          : "open",
    verwaltung:
      status && (closed.includes(status) || (status === "archived" && wasPublished))
        ? "done"
        : status && live.includes(status)
          ? "in_progress"
          : "open",
  };
}

const REQUIRED_STEPS = PROPERTY_STEPS.filter((s) => s.required);

/** Fortschritt der Vermarktung über die Pflichtschritte. */
export function marketingProgress(states: StepStates): { done: number; total: number; percent: number } {
  const done = REQUIRED_STEPS.filter((s) => states[s.key] === "done").length;
  return { done, total: REQUIRED_STEPS.length, percent: Math.round((done / REQUIRED_STEPS.length) * 100) };
}

/**
 * Nächster sinnvoller Schritt: der erste nicht erledigte Pflichtschritt.
 * Ist alles erledigt, folgt die Verkaufsverwaltung; nach Abschluss nichts mehr.
 */
export function nextStep(states: StepStates): PropertyStep | null {
  const pending = REQUIRED_STEPS.find((s) => states[s.key] !== "done");
  if (pending) return pending;
  if (states.verwaltung !== "done") return stepByKey("verwaltung");
  return null;
}

/** Vorheriger und nächster Schritt in der festen Reihenfolge (für «Zurück/Weiter»). */
export function adjacentSteps(key: StepKey): { previous: PropertyStep | null; next: PropertyStep | null } {
  const index = PROPERTY_STEPS.findIndex((s) => s.key === key);
  return {
    previous: index > 0 ? (PROPERTY_STEPS[index - 1] ?? null) : null,
    next: index >= 0 && index < PROPERTY_STEPS.length - 1 ? (PROPERTY_STEPS[index + 1] ?? null) : null,
  };
}
