import type { Tone } from "@/lib/constants";

/** Farbpunkt passend zu den Tönen von StatusBadge (nur Token-Klassen). */
export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  green: "bg-brand",
  blue: "bg-info",
  amber: "bg-warning",
  red: "bg-destructive",
  dark: "bg-forest",
};
