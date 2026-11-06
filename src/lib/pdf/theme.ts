/**
 * Farben der PDF-Vorlagen. Grundlage sind die Markenfarben (globals.css) und die
 * Konfiguration in dossier_templates.config (accent, background, surface, heading).
 */

export interface PdfTheme {
  accent: string;
  background: string;
  surface: string;
  heading: string;
  text: string;
  muted: string;
  border: string;
  mint: string;
  forest: string;
  brand: string;
}

const BASE = {
  text: "#192820",
  muted: "#69736D",
  border: "#E4EAE1",
  mint: "#EAF3DF",
  forest: "#274B32",
  brand: "#5A8A30",
};

export const DEFAULT_TEMPLATE_THEMES: Record<"modern" | "premium" | "classic", PdfTheme> = {
  modern: { ...BASE, accent: "#5A8A30", background: "#FFFFFF", surface: "#F8FAF6", heading: "#274B32" },
  premium: { ...BASE, accent: "#274B32", background: "#FFFFFF", surface: "#F3F5F1", heading: "#192820" },
  classic: { ...BASE, accent: "#5A8A30", background: "#FFFFFF", surface: "#FFFFFF", heading: "#192820" },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Übernimmt gültige Farben aus dossier_templates.config. */
export function themeFromConfig(templateId: "modern" | "premium" | "classic", config: unknown): PdfTheme {
  const base = DEFAULT_TEMPLATE_THEMES[templateId];
  if (!config || typeof config !== "object" || Array.isArray(config)) return base;
  const raw = config as Record<string, unknown>;
  const pick = (key: keyof PdfTheme) => (typeof raw[key] === "string" && HEX.test(raw[key] as string) ? (raw[key] as string) : base[key]);
  return { ...base, accent: pick("accent"), background: pick("background"), surface: pick("surface"), heading: pick("heading") };
}
