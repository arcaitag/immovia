/**
 * Zentrale Fehlerbehandlung.
 * Datenbankfunktionen werfen Fehlercodes als Meldungstext (z. B. "rate_limited"),
 * die hier in verständliche deutsche Meldungen übersetzt werden.
 */

export type ErrorCode =
  | "not_authenticated"
  | "forbidden"
  | "not_found"
  | "validation"
  | "rate_limited"
  | "account_inactive"
  | "service_unavailable"
  | "quota_exceeded"
  | "conflict"
  | "invalid_state"
  | "unknown";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, unknown>) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  not_authenticated: "Bitte melden Sie sich an.",
  forbidden: "Dafür fehlt Ihnen die Berechtigung.",
  not_found: "Der Eintrag wurde nicht gefunden.",
  validation: "Bitte prüfen Sie Ihre Eingaben.",
  rate_limited: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es später erneut.",
  account_inactive: "Ihr Konto ist derzeit gesperrt. Bitte kontaktieren Sie den Support.",
  service_unavailable: "Dieser Dienst ist momentan nicht verfügbar.",
  quota_exceeded: "Ihr Kontingent für diese Funktion ist für diesen Zeitraum ausgeschöpft.",
  conflict: "Der Eintrag wurde inzwischen geändert. Bitte laden Sie die Seite neu.",
  invalid_state: "Diese Aktion ist im aktuellen Zustand nicht möglich.",
  unknown: "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut.",
};

/** Übersetzung der Fehlercodes aus den Datenbankfunktionen. */
const DB_MESSAGES: Record<string, { code: ErrorCode; message: string }> = {
  not_authenticated: { code: "not_authenticated", message: DEFAULT_MESSAGES.not_authenticated },
  forbidden: { code: "forbidden", message: DEFAULT_MESSAGES.forbidden },
  not_found: { code: "not_found", message: DEFAULT_MESSAGES.not_found },
  rate_limited: { code: "rate_limited", message: DEFAULT_MESSAGES.rate_limited },
  account_inactive: { code: "account_inactive", message: DEFAULT_MESSAGES.account_inactive },
  own_listing: { code: "invalid_state", message: "Sie können Ihr eigenes Inserat nicht anfragen." },
  blocked: { code: "forbidden", message: "Eine Kontaktaufnahme ist nicht möglich." },
  invalid_message: { code: "validation", message: "Die Nachricht muss zwischen 10 und 3000 Zeichen lang sein." },
  invalid_phone: { code: "validation", message: "Bitte geben Sie eine gültige Telefonnummer ein." },
  slot_full: { code: "conflict", message: "Dieses Zeitfenster ist leider bereits ausgebucht." },
  slot_too_soon: { code: "invalid_state", message: "Dieses Zeitfenster beginnt zu bald und kann nicht mehr gebucht werden." },
  slot_in_past: { code: "validation", message: "Das Zeitfenster liegt in der Vergangenheit." },
  slot_has_appointments: {
    code: "invalid_state",
    message: "Für dieses Zeitfenster bestehen Termine. Sagen Sie es stattdessen ab.",
  },
  already_booked: { code: "conflict", message: "Sie haben für dieses Inserat bereits einen Besichtigungstermin." },
  invalid_status_transition: { code: "invalid_state", message: DEFAULT_MESSAGES.invalid_state },
  listing_blocked: { code: "forbidden", message: "Dieses Inserat wurde gesperrt und kann nicht veröffentlicht werden." },
  listing_incomplete: { code: "validation", message: "Das Inserat ist noch nicht vollständig." },
  review_required: {
    code: "invalid_state",
    message: "Inserate werden vor der Veröffentlichung geprüft. Bitte reichen Sie es zur Prüfung ein.",
  },
  invitation_invalid: { code: "not_found", message: "Diese Einladung ist ungültig oder abgelaufen." },
  invitation_email_mismatch: {
    code: "forbidden",
    message: "Diese Einladung gilt für eine andere E-Mail-Adresse.",
  },
  already_owner: { code: "conflict", message: "Sie besitzen bereits ein Firmenkonto." },
  grantee_not_in_contact: {
    code: "forbidden",
    message: "Dokumente können nur für Personen freigegeben werden, die Sie zu diesem Objekt kontaktiert haben.",
  },
  transfer_ownership_first: {
    code: "invalid_state",
    message: "Bitte übertragen Sie zuerst die Inhaberschaft Ihres Firmenkontos.",
  },
  cannot_modify_self: { code: "forbidden", message: "Diese Änderung können Sie nicht an Ihrem eigenen Konto vornehmen." },
  invalid_role: { code: "validation", message: "Ungültige Rolle." },
  invalid_email: { code: "validation", message: "Ungültige E-Mail-Adresse." },
  invalid_name: { code: "validation", message: "Bitte geben Sie einen Namen ein." },
  invalid_expiry: { code: "validation", message: "Das Ablaufdatum muss in der Zukunft liegen." },
  invalid_status: { code: "validation", message: "Ungültiger Status." },
  invalid_action: { code: "validation", message: "Diese Aktion ist nicht vorgesehen." },
  invalid_kind: { code: "validation", message: "Diese Art von Prüfung ist hier nicht möglich." },
  invalid_subject: { code: "not_found", message: "Das zu prüfende Konto oder Objekt wurde nicht gefunden." },
  member_inactive: { code: "invalid_state", message: "Dieses Mitglied ist nicht aktiv und kann die Inhaberschaft nicht übernehmen." },
  member_already_owner: { code: "conflict", message: "Diese Person ist bereits Inhaberin oder Inhaber eines Firmenkontos." },
};

const LISTING_FIELDS: Record<string, string> = {
  title: "Titel",
  description: "Beschreibung",
  price: "Preis",
  location: "Ort und PLZ",
  texts_confirmed: "Bestätigung der Texte",
  images: "mindestens ein Bild",
};

interface PostgrestLikeError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}

/** Wandelt einen Supabase/PostgREST-Fehler in einen AppError um. */
export function fromDbError(error: PostgrestLikeError | null | undefined): AppError {
  if (!error) return new AppError("unknown");
  const raw = (error.message ?? "").trim();
  const mapped = DB_MESSAGES[raw];
  if (mapped) {
    if (raw === "listing_incomplete" && error.details) {
      const missing = error.details
        .split(",")
        .map((f) => LISTING_FIELDS[f.trim()] ?? f.trim())
        .join(", ");
      return new AppError("validation", `Es fehlen noch: ${missing}.`, { missing: error.details });
    }
    return new AppError(mapped.code, mapped.message);
  }
  if (error.code === "42501" || /row-level security|permission denied/i.test(raw)) {
    return new AppError("forbidden");
  }
  if (error.code === "23505") {
    return new AppError("conflict", "Dieser Eintrag existiert bereits.");
  }
  if (error.code === "23514" || error.code === "22P02" || error.code === "23502") {
    return new AppError("validation");
  }
  if (error.code === "23P01") {
    return new AppError("conflict", "Dieses Zeitfenster überschneidet sich mit einem bestehenden Zeitfenster.");
  }
  if (error.code === "PGRST116") {
    return new AppError("not_found");
  }
  return new AppError("unknown", DEFAULT_MESSAGES.unknown, { raw });
}

/** Ergebnis von Server Actions: nie Exceptions an den Client werfen. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code: ErrorCode; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: unknown): { ok: false; error: string; code: ErrorCode; fieldErrors?: Record<string, string[]> } {
  if (error instanceof AppError) {
    const fieldErrors = error.details?.fieldErrors as Record<string, string[]> | undefined;
    return { ok: false, error: error.message, code: error.code, fieldErrors };
  }
  if (isNextControlFlow(error)) {
    throw error;
  }
  console.error("[immovia] Unerwarteter Fehler", error);
  return { ok: false, error: DEFAULT_MESSAGES.unknown, code: "unknown" };
}

/** redirect()/notFound() von Next.js dürfen nicht abgefangen werden. */
export function isNextControlFlow(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND");
}

/** Führt eine Server-Action-Funktion aus und liefert immer ein ActionResult. */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return ok(await fn(), message);
  } catch (error) {
    return fail(error);
  }
}

export function validationError(fieldErrors: Record<string, string[] | undefined>, message?: string): AppError {
  const clean = Object.fromEntries(Object.entries(fieldErrors).filter(([, v]) => v && v.length)) as Record<string, string[]>;
  return new AppError("validation", message ?? DEFAULT_MESSAGES.validation, { fieldErrors: clean });
}
