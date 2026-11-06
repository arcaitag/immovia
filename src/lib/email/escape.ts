/**
 * Hilfsfunktionen gegen HTML-Injektion in E-Mails. Alle Benutzerinhalte
 * (Namen, Titel, Nachrichten, Gründe) laufen durch escapeHtml().
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"'`]/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Entfernt Steuerzeichen (ausser Zeilenumbruch und Tab) und vereinheitlicht Zeilenenden. */
export function cleanText(value: unknown): string {
  let result = "";
  for (const char of String(value ?? "").replace(/\r\n|\r/g, "\n")) {
    const code = char.codePointAt(0) ?? 0;
    if ((code < 32 && char !== "\n" && char !== "\t") || code === 127) continue;
    result += char;
  }
  return result.trim();
}

/** Text für HTML: escapen und Zeilenumbrüche als <br> darstellen. */
export function htmlText(value: unknown): string {
  return escapeHtml(cleanText(value)).replace(/\n/g, "<br>");
}

/** Betreffzeile: einzeilig, ohne Steuerzeichen, gekürzt. */
export function sanitizeSubject(value: string, max = 150): string {
  const single = cleanText(value).replace(/\s+/g, " ").trim();
  if (single.length <= max) return single;
  return `${single.slice(0, max - 1).trimEnd()}…`;
}

/** Kürzt Text für Vorschauen. */
export function shorten(value: string, max: number): string {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Absolute URL aus Basis-URL und Pfad (Pfad muss mit «/» beginnen). */
export function absoluteUrl(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
