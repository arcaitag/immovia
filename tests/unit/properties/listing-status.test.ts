import { describe, expect, it } from "vitest";
import {
  canTransition,
  isPublishReady,
  isStatusActionAvailable,
  managementActions,
  publishChecklist,
  statusActionTarget,
  type PublishFacts,
} from "@/lib/properties/listing-status";
import { computeStepStates, marketingProgress, nextStep, type StepFacts } from "@/lib/properties/steps";

describe("Statusübergänge (wie Trigger)", () => {
  it("erlaubt nur definierte Übergänge", () => {
    expect(canTransition("draft", "published")).toBe(true);
    expect(canTransition("published", "paused")).toBe(true);
    expect(canTransition("paused", "reserved")).toBe(false);
    expect(canTransition("sold", "published")).toBe(false);
    expect(canTransition("archived", "draft")).toBe(false);
    expect(canTransition("rented", "in_progress")).toBe(true);
  });

  it("führt bei Prüfpflicht über die Prüfung", () => {
    const ctx = { offerType: "sale" as const, requireReview: true, approved: false };
    expect(statusActionTarget("publish", ctx)).toBe("pending_review");
    expect(statusActionTarget("publish", { ...ctx, requireReview: false })).toBe("published");
    expect(statusActionTarget("resume", { ...ctx, approved: true })).toBe("published");
  });

  it("bietet Verkauft nur bei Verkauf und Vermietet nur bei Vermietung an", () => {
    const sale = { status: "published" as const, offerType: "sale" as const, requireReview: false, approved: false };
    expect(isStatusActionAvailable("mark_sold", sale)).toBe(true);
    expect(isStatusActionAvailable("mark_rented", sale)).toBe(false);
    expect(isStatusActionAvailable("mark_rented", { ...sale, offerType: "rent" })).toBe(true);
  });

  it("zeigt passende Aktionen je Status", () => {
    const base = { offerType: "sale" as const, requireReview: false, approved: false };
    expect(managementActions({ ...base, status: "published" })).toEqual(["pause", "reserve", "mark_sold", "archive"]);
    expect(managementActions({ ...base, status: "paused" })).toEqual(["resume", "mark_sold", "archive"]);
    expect(managementActions({ ...base, status: "reserved" })).toEqual(["pause", "unreserve", "mark_sold", "archive"]);
    expect(managementActions({ ...base, status: "draft" })).toEqual([]);
    expect(managementActions({ ...base, status: "pending_review" })).toEqual(["withdraw_review", "archive"]);
    expect(managementActions({ ...base, status: "archived" })).toEqual([]);
    expect(managementActions({ ...base, offerType: "rent", status: "rented" })).toEqual(["relist", "archive"]);
  });
});

describe("Checkliste für die Veröffentlichung", () => {
  const ready: PublishFacts = {
    title: "Wohnung",
    description: "Text",
    price: null,
    priceOnRequest: true,
    postalCode: "3011",
    municipality: "Bern",
    textsConfirmedAt: "2026-11-06T10:00:00Z",
    imageCount: 1,
    minImages: 1,
  };

  it("ist erfüllt, wenn alle Pflichtangaben vorhanden sind", () => {
    expect(isPublishReady(ready)).toBe(true);
  });

  it("nennt fehlende Angaben wie der Trigger", () => {
    const checks = publishChecklist({ ...ready, title: " ", priceOnRequest: false, textsConfirmedAt: null, imageCount: 2, minImages: 3 });
    expect(checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(["title", "price", "texts_confirmed", "images"]);
  });
});

describe("Schritte des Verkaufsassistenten", () => {
  const facts: StepFacts = {
    completeness: { percent: 40, isComplete: false },
    hasValuation: false,
    imageCount: 0,
    minImages: 1,
    dossierStatus: null,
    listing: {
      status: "draft",
      title: null,
      short_description: null,
      description: null,
      price: null,
      price_on_request: false,
      texts_confirmed_at: null,
      first_published_at: null,
    },
  };

  it("leitet den Status aus echten Daten ab", () => {
    const states = computeStepStates(facts);
    expect(states.erfassen).toBe("in_progress");
    expect(states.bilder).toBe("open");
    expect(states.veroeffentlichung).toBe("open");
    expect(nextStep(states)?.key).toBe("erfassen");
    expect(marketingProgress(states).done).toBe(0);
  });

  it("überspringt optionale Schritte beim nächsten Schritt", () => {
    const states = computeStepStates({ ...facts, completeness: { percent: 80, isComplete: true }, imageCount: 1 });
    expect(states.bewertung).toBe("open");
    expect(nextStep(states)?.key).toBe("beschreibung");
  });

  it("zeigt nach der Veröffentlichung die Verkaufsverwaltung und nach dem Verkauf nichts mehr", () => {
    const listing = {
      ...facts.listing!,
      title: "T",
      description: "D",
      price: 900000,
      texts_confirmed_at: "2026-11-01T00:00:00Z",
      first_published_at: "2026-11-02T00:00:00Z",
    };
    const live = computeStepStates({
      ...facts,
      completeness: { percent: 90, isComplete: true },
      imageCount: 5,
      listing: { ...listing, status: "published" },
    });
    expect(live.veroeffentlichung).toBe("done");
    expect(live.verwaltung).toBe("in_progress");
    expect(nextStep(live)?.key).toBe("verwaltung");
    expect(marketingProgress(live).percent).toBe(100);
    const sold = computeStepStates({
      ...facts,
      completeness: { percent: 90, isComplete: true },
      imageCount: 5,
      listing: { ...listing, status: "sold" },
    });
    expect(sold.verwaltung).toBe("done");
    expect(nextStep(sold)).toBeNull();
  });
});
