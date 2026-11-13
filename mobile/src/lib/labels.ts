import type { Enums } from "@/lib/supabase";

/** Bezeichnungen wie auf der Website (src/lib/constants.ts). */
export const PROPERTY_TYPES: Record<Enums<"property_type">, string> = {
  apartment: "Wohnung",
  single_family_house: "Einfamilienhaus",
  semi_detached_house: "Doppeleinfamilienhaus",
  terraced_house: "Reihenhaus",
  multi_family_house: "Mehrfamilienhaus",
  plot: "Grundstück",
  commercial: "Gewerbeimmobilie",
  office: "Büro",
  new_build_project: "Neubauprojekt",
  other: "Weitere Immobilie",
};

export const OFFER_TYPES: Record<Enums<"offer_type">, { label: string; verb: string; priceLabel: string }> = {
  sale: { label: "Kaufen", verb: "Zu verkaufen", priceLabel: "Kaufpreis" },
  rent: { label: "Mieten", verb: "Zu vermieten", priceLabel: "Miete / Monat" },
};

export const CONDITIONS: Record<Enums<"property_condition">, string> = {
  new_build: "Neubau / Erstbezug",
  as_new: "Neuwertig",
  good: "Gepflegt",
  needs_refresh: "Auffrischung nötig",
  needs_renovation: "Renovationsbedürftig",
};

export const LISTING_STATUS: Record<Enums<"listing_status">, { label: string; tone: "neutral" | "green" | "amber" | "blue" }> = {
  draft: { label: "Entwurf", tone: "neutral" },
  in_progress: { label: "In Bearbeitung", tone: "neutral" },
  ready: { label: "Bereit", tone: "blue" },
  pending_review: { label: "In Prüfung", tone: "amber" },
  published: { label: "Veröffentlicht", tone: "green" },
  paused: { label: "Pausiert", tone: "amber" },
  reserved: { label: "Reserviert", tone: "amber" },
  sold: { label: "Verkauft", tone: "neutral" },
  rented: { label: "Vermietet", tone: "neutral" },
  archived: { label: "Archiviert", tone: "neutral" },
};

export const CANTONS = [
  ["AG", "Aargau"], ["AI", "Appenzell Innerrhoden"], ["AR", "Appenzell Ausserrhoden"], ["BE", "Bern"],
  ["BL", "Basel-Landschaft"], ["BS", "Basel-Stadt"], ["FR", "Freiburg"], ["GE", "Genf"], ["GL", "Glarus"],
  ["GR", "Graubünden"], ["JU", "Jura"], ["LU", "Luzern"], ["NE", "Neuenburg"], ["NW", "Nidwalden"],
  ["OW", "Obwalden"], ["SG", "St. Gallen"], ["SH", "Schaffhausen"], ["SO", "Solothurn"], ["SZ", "Schwyz"],
  ["TG", "Thurgau"], ["TI", "Tessin"], ["UR", "Uri"], ["VD", "Waadt"], ["VS", "Wallis"], ["ZG", "Zug"], ["ZH", "Zürich"],
] as const;

/** Pflichtangaben, die die Datenbank beim Veröffentlichen meldet (listing_incomplete). */
const LISTING_FIELDS: Record<string, string> = {
  title: "Titel",
  description: "Beschreibung",
  price: "Preis",
  location: "PLZ und Ort",
  texts_confirmed: "Bestätigung der Texte",
  images: "mindestens ein Foto",
};

const DB_MESSAGES: Record<string, string> = {
  not_authenticated: "Bitte melden Sie sich an.",
  forbidden: "Dafür fehlt Ihnen die Berechtigung.",
  not_found: "Der Eintrag wurde nicht gefunden.",
  rate_limited: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut.",
  account_inactive: "Ihr Konto ist derzeit gesperrt. Bitte kontaktieren Sie den Support.",
  own_listing: "Sie können Ihr eigenes Inserat nicht anfragen.",
  blocked: "Eine Kontaktaufnahme ist nicht möglich.",
  invalid_message: "Die Nachricht muss zwischen 10 und 3000 Zeichen lang sein.",
  invalid_phone: "Bitte geben Sie eine gültige Telefonnummer ein.",
  invalid_status_transition: "Diese Aktion ist im aktuellen Zustand nicht möglich.",
  listing_blocked: "Dieses Inserat wurde gesperrt und kann nicht veröffentlicht werden.",
  listing_incomplete: "Das Inserat ist noch nicht vollständig.",
  review_required: "Inserate werden vor der Veröffentlichung geprüft. Bitte reichen Sie es auf der Website zur Prüfung ein.",
  invalid_path: "Die Datei gehört nicht zu dieser Immobilie.",
};

/** Übersetzt Fehler von Supabase (Datenbank, Anmeldung, Netzwerk) in verständliche Meldungen. */
export function errorMessage(error: unknown): string {
  const e = error as { message?: string; details?: string | null; code?: string } | null;
  const raw = (e?.message ?? "").trim();
  if (DB_MESSAGES[raw]) {
    if (raw === "listing_incomplete" && e?.details) {
      const missing = e.details.split(",").map((f) => LISTING_FIELDS[f.trim()] ?? f.trim()).join(", ");
      return `Das Inserat ist noch nicht vollständig. Es fehlt: ${missing}.`;
    }
    return DB_MESSAGES[raw];
  }
  if (/Invalid login credentials/i.test(raw)) return "E-Mail-Adresse oder Passwort ist falsch.";
  if (/Email not confirmed/i.test(raw)) return "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse über den Link in unserer E-Mail.";
  if (/already registered/i.test(raw)) return "Für diese E-Mail-Adresse besteht bereits ein Konto.";
  if (/rate limit|too many/i.test(raw)) return "Zu viele Versuche. Bitte warten Sie einen Moment.";
  if (/Network request failed|Failed to fetch/i.test(raw)) return "Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung.";
  if (e?.code === "23514" || e?.code === "22P02" || e?.code === "23502") return "Bitte prüfen Sie Ihre Eingaben. Ein Wert ist ungültig.";
  if (e?.code === "42501") return "Dafür fehlt Ihnen die Berechtigung.";
  return "Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.";
}
