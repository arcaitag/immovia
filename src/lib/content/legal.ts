/**
 * Status der Rechtstexte (Impressum, Datenschutz, AGB).
 * Solange die Texte Entwürfe sind, werden sie nicht indexiert und nicht in die Sitemap aufgenommen.
 * Nach der rechtlichen Prüfung: Platzhalter ersetzen und LEGAL_PAGES_ARE_DRAFTS auf false setzen.
 */
export const LEGAL_PAGES_ARE_DRAFTS = true;

/** Datum des Entwurfs (Anzeige «Stand»). */
export const LEGAL_DRAFT_DATE = "2026-11-06";

export const LEGAL_PAGES = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutzerklärung" },
  { href: "/agb", label: "Allgemeine Geschäftsbedingungen" },
] as const;
