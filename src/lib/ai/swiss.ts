/**
 * Schweizer Rechtschreibung für KI-Ausgaben: kein «ß».
 * Wird auf alle Texte angewendet, bevor sie gespeichert oder angezeigt werden.
 */

/** Ersetzt ß durch ss und ẞ (Versal-Eszett) durch SS. */
export function toSwissSpelling(text: string): string {
  if (!text) return text;
  return text.replace(/ß/g, "ss").replace(/ẞ/g, "SS");
}

/** Wendet toSwissSpelling rekursiv auf alle Zeichenketten eines Werts an (Objekte, Arrays). */
export function deepSwissSpelling<T>(value: T): T {
  if (typeof value === "string") return toSwissSpelling(value) as T;
  if (Array.isArray(value)) return value.map((item) => deepSwissSpelling(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = deepSwissSpelling(item);
    }
    return out as T;
  }
  return value;
}

/** Normalisiert Text für Vergleiche (Leerraum, Zeilenenden, ß). */
export function normalizeForCompare(text: string | null | undefined): string {
  return toSwissSpelling(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
