import { createHmac, timingSafeEqual } from "node:crypto";
import { isUuid } from "@/lib/utils";

/**
 * Besucherkennung der Aufrufstatistik (Cookie «iv_vid»): zufällige UUID plus HMAC-Signatur.
 * Nur vom Server ausgestellte Kennungen zählen. Sonst liessen sich Aufrufe vervielfachen, indem man
 * bei jeder Anfrage eine neue, selbst erfundene Kennung mitschickt.
 */

function signature(id: string, secret: string): string {
  return createHmac("sha256", secret).update(`iv_vid:${id}`).digest("base64url").slice(0, 22);
}

export function signVisitorId(id: string, secret: string): string {
  return `${id}.${signature(id, secret)}`;
}

/** Liefert die Kennung, wenn das Cookie vom Server signiert wurde, sonst null. */
export function verifyVisitorCookie(value: string | undefined | null, secret: string): string | null {
  if (!value) return null;
  const [id, sig, ...rest] = value.split(".");
  if (!id || !sig || rest.length || !isUuid(id)) return null;
  const expected = Buffer.from(signature(id, secret));
  const actual = Buffer.from(sig);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? id : null;
}
