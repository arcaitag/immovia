import type { Tone } from "@/lib/constants";
import type { ConfidenceLevel, ValuationStatus } from "@/lib/valuation/types";

/** Anzeigetexte der Bewertung (Kandidaten für src/lib/constants.ts). */

export const VALUATION_STATUS_LABELS: Record<ValuationStatus, { label: string; tone: Tone; description: string }> = {
  completed: { label: "Schätzung vorhanden", tone: "green", description: "Ausreichend Vergleichsangebote im Umkreis." },
  limited: { label: "Eingeschränkte Schätzung", tone: "amber", description: "Vergleich mit einem erweiterten Gebiet." },
  insufficient_data: { label: "Zu wenig Daten", tone: "neutral", description: "Noch keine belastbare Bewertung möglich." },
  failed: { label: "Fehlgeschlagen", tone: "red", description: "Die Bewertung konnte nicht durchgeführt werden." },
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, { label: string; tone: Tone }> = {
  none: { label: "Keine Aussage", tone: "neutral" },
  low: { label: "Tief", tone: "amber" },
  medium: { label: "Mittel", tone: "blue" },
  high: { label: "Hoch", tone: "green" },
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  platform_offers: "Angebotspreise (Plattform)",
  transaction_data: "Transaktionspreise",
  statistical_index: "Statistischer Marktindikator",
  external_model: "Modellschätzung eines Anbieters",
  owner_input: "Angaben des Eigentümers",
};
