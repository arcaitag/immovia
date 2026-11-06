/**
 * Vorbereitung für weitere Landessprachen.
 * Aktuell ist Deutsch (Schweiz) die einzige aktive Sprache. Neue Texte sollen über
 * zentrale Wörterbücher (z. B. src/lib/constants.ts für Fachbegriffe) laufen, damit
 * Französisch, Italienisch und Englisch später ergänzt werden können.
 *
 * Geplantes Vorgehen: Sprachpräfix in der URL (/fr/…, /it/…, /en/…) über ein
 * dynamisches Segment [lang] in src/app, Wörterbücher pro Sprache unter
 * src/lib/i18n/dictionaries/{lang}.ts, profiles.locale als Benutzerpräferenz.
 */
export const LOCALES = ["de-CH", "fr-CH", "it-CH", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de-CH";
export const ACTIVE_LOCALES: readonly Locale[] = ["de-CH"];

export const LOCALE_LABELS: Record<Locale, string> = {
  "de-CH": "Deutsch",
  "fr-CH": "Français",
  "it-CH": "Italiano",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
