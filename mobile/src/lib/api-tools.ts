import { apiJson } from "@/lib/jobs";
import { supabase, type Enums } from "@/lib/supabase";

/**
 * Bewertung, KI-Inseratetexte und Verkaufsdossier. Diese Funktionen brauchen den Server der Website
 * (Hintergrundaufträge, KI-Anbieter, PDF) und laufen deshalb über /api/mobile/valuation,
 * /api/mobile/description und /api/mobile/dossier – dort werden dieselben Dienste aufgerufen wie
 * von den Seiten des Verkäuferbereichs. Fehler kommen als ApiError (Meldung des Servers,
 * `consentRequired` bei fehlender Einwilligung zur KI-Verarbeitung).
 */

export type Tone = "neutral" | "green" | "blue" | "amber" | "red" | "dark";

/** Verfügbarkeit einer Funktion inkl. Kontingent (FeatureAvailability der Website). */
export interface Availability {
  available: boolean;
  reason?: "not_configured" | "service_role_missing" | "feature_disabled" | "quota_exceeded";
  message?: string;
  quota?: { used: number; limit: number; remaining: number; period: "day" | "month"; resetsAt: string; unit: string };
  consentRequired?: boolean;
}

export const UNAVAILABLE_TITLES: Record<NonNullable<Availability["reason"]>, string> = {
  not_configured: "KI nicht konfiguriert",
  service_role_missing: "Hintergrundaufträge nicht eingerichtet",
  feature_disabled: "Funktion vorübergehend deaktiviert",
  quota_exceeded: "Kontingent ausgeschöpft",
};

const pad = (n: number) => String(n).padStart(2, "0");

/** «13.11.2026» */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** «13.11.2026, 14:05» (immer mit Datum, anders als formatDateTime in format.ts) */
export function formatDateTimeFull(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return `${formatDate(iso)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Einwilligung zur KI-Verarbeitung ------------------------------------------

/**
 * Erteilt die Einwilligung für KI-Texte (user_preferences.ai_processing_consent) – dieselbe
 * Änderung wie grantAiConsent der Website, mit dem Konto des Benutzers (RLS: nur die eigene Zeile).
 * Nur aufrufen, nachdem der Benutzer ausdrücklich zugestimmt hat.
 */
export async function grantTextAiConsent(userId: string): Promise<void> {
  const { data, error } = await supabase.from("user_preferences").update({ ai_processing_consent: true }).eq("user_id", userId).select("user_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Ihre Einstellungen wurden nicht gefunden. Bitte melden Sie sich neu an.");
}

// --- Bewertung -------------------------------------------------------------------

export type ValuationStatus = Enums<"valuation_status">;

export interface ValuationFactor {
  key: string;
  label: string;
  detail: string;
  direction: "positive" | "negative";
}

export interface ValuationDetail {
  id: string;
  status: ValuationStatus;
  statusLabel: string;
  statusTone: Tone;
  createdAt: string;
  /** Nur true, wenn eine belastbare Zahl vorliegt; sonst sind alle Werte null */
  hasNumbers: boolean;
  estimatedValue: number | null;
  valueLow: number | null;
  valueHigh: number | null;
  suggestedListPrice: number | null;
  listPriceExplanation: string | null;
  confidenceLabel: string;
  confidenceTone: Tone;
  confidenceExplanation: string | null;
  summary: string | null;
  explanation: string | null;
  notes: string[];
  missing: string[];
  suggestions: string[];
  sources: { name: string; typeLabel: string; description: string | null; dataAsOf: string | null; recordCount: number | null; licenseNote: string | null }[];
  quality: { label: string; value: string }[];
  sampleSize: number;
  areaLabel: string;
  comparables: {
    id: string;
    location: string;
    typeLabel: string;
    rooms: number | null;
    area: number | null;
    price: number;
    pricePerSqm: number | null;
    observedAt: string;
    distanceKm: number | null;
    /** Nur gesetzt, wenn das Inserat noch öffentlich ist */
    slug: string | null;
  }[];
  positive: ValuationFactor[];
  negative: ValuationFactor[];
  disclaimer: string;
}

export interface ValuationState {
  rent: boolean;
  availability: Availability;
  prerequisites: { ready: boolean; items: { key: string; label: string; ok: boolean; blocking: boolean; hint: string }[] };
  /** Zusätzliche KI-Erklärung in Worten: möglich, nur mit Einwilligung oder nicht verfügbar */
  explanation: "available" | "needs_consent" | "unavailable";
  method: { minComparables: number; radiusKm: number; areaTolerance: number; maxAgeDays: number; avmConfigured: boolean };
  history: { id: string; status: ValuationStatus; statusLabel: string; statusTone: Tone; estimatedValue: number | null; createdAt: string }[];
  selectedId: string | null;
  detail: ValuationDetail | null;
}

export function valuationState(propertyId: string, valuationId?: string | null): Promise<ValuationState> {
  const query = `propertyId=${encodeURIComponent(propertyId)}${valuationId ? `&valuationId=${encodeURIComponent(valuationId)}` : ""}`;
  return apiJson<ValuationState>(`/api/mobile/valuation?${query}`);
}

export function startValuation(propertyId: string): Promise<{ jobId: string }> {
  return apiJson<{ jobId: string }>("/api/mobile/valuation", { body: { propertyId } });
}

// --- KI-Inseratetexte ------------------------------------------------------------

export type DescriptionStyle = Enums<"description_style">;
export type DescriptionSectionKey = "title" | "shortDescription" | "description" | "location" | "equipment" | "highlights" | "searchSummary";
export type SectionValue = string | string[];

export interface DescriptionState {
  availability: Availability;
  styles: { key: DescriptionStyle; label: string; description: string }[];
  sections: { key: DescriptionSectionKey; label: string; hint: string; max: number; rows: number }[];
  version: {
    id: string;
    style: DescriptionStyle;
    createdAt: string;
    model: string | null;
    content: Record<DescriptionSectionKey, SectionValue>;
    rephrasedSection: DescriptionSectionKey | null;
  } | null;
  history: { id: string; style: DescriptionStyle; createdAt: string; appliedAt: string | null; rephrasedSection: DescriptionSectionKey | null }[];
  /** Aktuelle Texte im Inserat (null = kein Inserat oder Feld leer) */
  listingTexts: Record<DescriptionSectionKey, SectionValue | null>;
  confirmation: { hasListing: boolean; confirmedAt: string | null; canConfirm: boolean };
  /** Genau diese Angaben erhält die KI */
  facts: { label: string; value: string }[];
}

export function descriptionState(propertyId: string, versionId?: string | null): Promise<DescriptionState> {
  const query = `propertyId=${encodeURIComponent(propertyId)}${versionId ? `&versionId=${encodeURIComponent(versionId)}` : ""}`;
  return apiJson<DescriptionState>(`/api/mobile/description?${query}`);
}

export type DescriptionRequest =
  | { propertyId: string; style: DescriptionStyle; mode: "full" }
  | {
      propertyId: string;
      style: DescriptionStyle;
      mode: "rephrase";
      section: DescriptionSectionKey;
      baseVersionId: string;
      currentText?: string;
      currentItems?: string[];
    };

export function requestDescription(input: DescriptionRequest): Promise<{ jobId: string }> {
  return apiJson<{ jobId: string }>("/api/mobile/description", { body: input });
}

export interface ApplyResult {
  applied: boolean;
  /** Im Inserat steht ein eigener Text: erst nach Rückfrage mit confirmOverwrite erneut senden */
  needsConfirmation: boolean;
  currentValue?: SectionValue;
}

export function applyDescriptionSection(input: {
  propertyId: string;
  descriptionId: string;
  section: DescriptionSectionKey;
  value: SectionValue;
  confirmOverwrite: boolean;
}): Promise<ApplyResult> {
  return apiJson<ApplyResult>("/api/mobile/description/apply", { body: input });
}

export function confirmListingTexts(propertyId: string): Promise<{ ok: true; message: string }> {
  return apiJson("/api/mobile/description/confirm", { body: { propertyId } });
}

/** Wie toSwissSpelling/normalizeForCompare der Website (Vergleich «steht so im Inserat»). */
export function normalizeForCompare(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/ß/g, "ss")
    .replace(/ẞ/g, "SS")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Zeilen eines Highlight-Felds (eine Zeile pro Eintrag, Aufzählungszeichen entfernt). */
export function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function toDraft(value: SectionValue | null | undefined): string {
  if (Array.isArray(value)) return value.join("\n");
  return value ?? "";
}

export function compareKey(section: DescriptionSectionKey, value: SectionValue | null | undefined): string {
  if (section === "highlights") {
    const items = Array.isArray(value) ? value : toLines(value ?? "");
    return items.map((item) => normalizeForCompare(item)).filter(Boolean).join("\n");
  }
  return normalizeForCompare(Array.isArray(value) ? value.join("\n") : value);
}

// --- Verkaufsdossier -------------------------------------------------------------

export type DossierTemplateId = "modern" | "premium" | "classic";
export type DossierSectionKey =
  | "highlights"
  | "keyFacts"
  | "description"
  | "location"
  | "equipment"
  | "renovations"
  | "gallery"
  | "floorPlans"
  | "documents"
  | "contact"
  | "qrCode";

export interface DossierContact {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
}

/** Optionen einer Dossier-Version (dossierOptionsSchema der Website). */
export interface DossierOptions {
  templateId: DossierTemplateId;
  /** Nur abgewählte Abschnitte mit false */
  sections: Partial<Record<DossierSectionKey, boolean>>;
  excludedImageIds: string[];
  imageOrder: string[];
  title?: string;
  intro?: string;
  contact?: DossierContact;
}

export interface DossierVersion {
  id: string;
  version: number;
  status: "generating" | "ready" | "failed";
  templateLabel: string;
  createdAt: string;
  fileSize: number | null;
  pageCount: number | null;
  isPublic: boolean;
  error: string | null;
}

export interface DossierState {
  availability: Availability;
  templates: { id: DossierTemplateId; label: string; description: string }[];
  sections: { key: DossierSectionKey; label: string; description: string }[];
  images: { id: string; url: string | null; caption: string | null; isFloorPlan: boolean; isAiVisualization: boolean; isCover: boolean }[];
  /** Optionen der letzten Version als Ausgangspunkt */
  initial: (Omit<DossierOptions, "sections"> & { sections: Partial<Record<DossierSectionKey, boolean>> }) | null;
  defaults: { title: string; intro: string; contactName: string; contactPhone: string; contactEmail: string; showsPhone: boolean; isPublished: boolean };
  versions: DossierVersion[];
  listing: { exists: boolean; dossierPublic: boolean; isPublished: boolean };
}

export function dossierState(propertyId: string): Promise<DossierState> {
  return apiJson<DossierState>(`/api/mobile/dossier?propertyId=${encodeURIComponent(propertyId)}`);
}

export function createDossier(propertyId: string, options: DossierOptions): Promise<{ jobId: string }> {
  return apiJson<{ jobId: string }>("/api/mobile/dossier", { body: { propertyId, options } });
}

/** Gibt genau eine Version für das Inserat frei bzw. hebt die Freigabe auf. */
export function setDossierPublic(dossierId: string, isPublic: boolean): Promise<{ ok: true; message: string }> {
  return apiJson(`/api/mobile/dossier/${dossierId}`, { method: "PATCH", body: { isPublic } });
}

export function deleteDossierVersion(dossierId: string): Promise<{ ok: true; message: string }> {
  return apiJson(`/api/mobile/dossier/${dossierId}`, { method: "DELETE" });
}

/** Schalter «Dossier im Inserat zum Download anbieten». */
export function setListingDossierPublic(propertyId: string, value: boolean): Promise<{ ok: true; message: string }> {
  return apiJson("/api/mobile/dossier/listing", { body: { propertyId, value } });
}

/** Kurzlebige signierte URL des PDFs (sofort öffnen, nicht speichern). */
export function dossierPdfUrl(dossierId: string): Promise<{ url: string; expiresIn: number; version: number }> {
  return apiJson(`/api/mobile/dossier/${dossierId}/url`);
}
