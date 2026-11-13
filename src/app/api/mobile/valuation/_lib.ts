import "server-only";

import { NextResponse } from "next/server";
import { getBearerSession } from "@/lib/auth/bearer";
import { AppError, fail, type ErrorCode } from "@/lib/errors";
import { isAiConsentRequiredError } from "@/lib/ai/consent";

/**
 * Gemeinsames für die Mobile-Routen Bewertung, KI-Texte und Dossier: Anmeldung per Bearer-Token
 * und dieselbe Fehlerübersetzung wie die Server Actions der Website (fail → Meldungstext).
 * Fehlt die Einwilligung zur KI-Verarbeitung, enthält die Antwort zusätzlich consentRequired: true
 * (wie runAiAction in src/services/ai/action.ts).
 */

export const NO_STORE = { "Cache-Control": "no-store" };

const STATUS: Record<ErrorCode, number> = {
  not_authenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation: 422,
  rate_limited: 429,
  account_inactive: 403,
  service_unavailable: 503,
  quota_exceeded: 429,
  conflict: 409,
  invalid_state: 409,
  unknown: 500,
};

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function errorResponse(error: unknown): NextResponse {
  const result = fail(error);
  const status = error instanceof AppError ? STATUS[error.code] : 500;
  return json(
    {
      error: result.error,
      code: result.code,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
      ...(isAiConsentRequiredError(error) ? { consentRequired: true } : {}),
    },
    status,
  );
}

type Session = NonNullable<Awaited<ReturnType<typeof getBearerSession>>>;

/** Führt den Handler mit angemeldetem Benutzer aus; Fehler werden wie auf der Website übersetzt. */
export async function withSession(request: Request, handler: (session: Session) => Promise<unknown>): Promise<NextResponse> {
  const session = await getBearerSession(request);
  if (!session) return json({ error: "Bitte melden Sie sich an." }, 401);
  try {
    return json(await handler(session));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
