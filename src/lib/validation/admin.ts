import { z } from "zod";
import type { Tone } from "@/lib/constants";
import type { Enums } from "@/types/database";

/**
 * Administration: Labels für Status-Enums, Plattform-Einstellungen
 * (feature_settings) mit Standardwerten sowie Eingabeschemas der Admin-Aktionen.
 */

// =============================================================================
// Labels
// =============================================================================
export type UserStatus = Enums<"user_status">;
export type AppRole = Enums<"app_role">;
export type ReportStatus = Enums<"report_status">;
export type ModerationStatus = Enums<"moderation_status">;
export type VerificationKind = Enums<"verification_kind">;
export type VerificationStatus = Enums<"verification_status">;
export type ContactStatus = "open" | "answered" | "closed" | "spam";
export type AiFeature = "description" | "valuation_explanation" | "assistant" | "image_enhance" | "virtual_staging" | "perspective";

export const USER_STATUS: Record<UserStatus, { label: string; tone: Tone }> = {
  active: { label: "Aktiv", tone: "green" },
  suspended: { label: "Gesperrt", tone: "red" },
  deleted: { label: "Gelöscht", tone: "neutral" },
};

export const APP_ROLES: Record<AppRole, { label: string; description: string }> = {
  admin: { label: "Administrator/in", description: "Voller Zugriff inkl. Einstellungen, Rollen und Sperren." },
  moderator: { label: "Moderator/in", description: "Prüft Inserate, Meldungen und Kontaktanfragen." },
};

export const REPORT_STATUS: Record<ReportStatus, { label: string; tone: Tone }> = {
  open: { label: "Offen", tone: "amber" },
  in_review: { label: "In Prüfung", tone: "blue" },
  resolved: { label: "Erledigt", tone: "green" },
  dismissed: { label: "Verworfen", tone: "neutral" },
};

export const REPORT_TARGET_TYPES: Record<string, string> = {
  listing: "Inserat",
  user: "Benutzer",
  message: "Nachricht",
  conversation: "Konversation",
  organization: "Firma",
};

export const MODERATION_STATUS: Record<ModerationStatus, { label: string; tone: Tone }> = {
  ok: { label: "Unauffällig", tone: "neutral" },
  flagged: { label: "Markiert", tone: "amber" },
  blocked: { label: "Gesperrt", tone: "red" },
};

export const VERIFICATION_KINDS: Record<VerificationKind, { label: string; subject: "user" | "property" | "organization" }> = {
  identity: { label: "Identität verifiziert", subject: "user" },
  ownership: { label: "Eigentümerberechtigung geprüft", subject: "property" },
  documentation_complete: { label: "Objektdokumentation vollständig", subject: "property" },
  organization: { label: "Firma verifiziert", subject: "organization" },
};

export const VERIFICATION_STATUS: Record<VerificationStatus, { label: string; tone: Tone }> = {
  pending: { label: "Ausstehend", tone: "amber" },
  verified: { label: "Geprüft", tone: "green" },
  rejected: { label: "Abgelehnt", tone: "red" },
  revoked: { label: "Widerrufen", tone: "neutral" },
};

export const CONTACT_STATUS: Record<ContactStatus, { label: string; tone: Tone }> = {
  open: { label: "Offen", tone: "amber" },
  answered: { label: "Beantwortet", tone: "green" },
  closed: { label: "Abgeschlossen", tone: "neutral" },
  spam: { label: "Spam", tone: "red" },
};

export const AI_FEATURES: Record<AiFeature, string> = {
  description: "KI-Texte für Inserate",
  valuation_explanation: "Bewertungserklärungen",
  assistant: "KI-Assistent",
  image_enhance: "Bildoptimierung",
  virtual_staging: "Virtuelle Möblierung",
  perspective: "Perspektivkorrektur",
};

export function aiFeatureLabel(feature: string): string {
  return (AI_FEATURES as Record<string, string>)[feature] ?? feature;
}

export const AUDIT_ENTITY_TYPES: Record<string, string> = {
  user: "Benutzer",
  listing: "Inserat",
  property: "Immobilie",
  organization: "Firma",
  report: "Meldung",
  contact_request: "Kontaktanfrage",
  feature_setting: "Einstellung",
};

const AUDIT_ACTIONS: Record<string, string> = {
  "user.set_status": "Benutzerstatus geändert",
  "role.grant": "Rolle vergeben",
  "role.revoke": "Rolle entzogen",
  "listing.approve": "Inserat freigegeben",
  "listing.reject": "Inserat zurückgewiesen",
  "listing.block": "Inserat gesperrt",
  "listing.unblock": "Inserat entsperrt",
  "listing.flag": "Inserat markiert",
  "report.open": "Meldung wieder geöffnet",
  "report.in_review": "Meldung in Prüfung",
  "report.resolved": "Meldung erledigt",
  "report.dismissed": "Meldung verworfen",
  "setting.update": "Einstellung geändert",
  "verification.verified": "Verifizierung bestätigt",
  "verification.rejected": "Verifizierung abgelehnt",
  "verification.revoked": "Verifizierung widerrufen",
  "verification.pending": "Verifizierung ausstehend",
  "organization.set_status": "Firmenstatus geändert",
  "contact_request.open": "Kontaktanfrage wieder geöffnet",
  "contact_request.answered": "Kontaktanfrage beantwortet",
  "contact_request.closed": "Kontaktanfrage abgeschlossen",
  "contact_request.spam": "Kontaktanfrage als Spam markiert",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS[action] ?? action;
}

// =============================================================================
// Plattform-Einstellungen (feature_settings)
// =============================================================================
const trimmedOrNull = (max: number) =>
  z.union([z.string(), z.null()]).transform((value, ctx) => {
    const text = (value ?? "").trim();
    if (text.length > max) {
      ctx.addIssue({ code: "custom", message: `Höchstens ${max} Zeichen.` });
      return z.NEVER;
    }
    return text === "" ? null : text;
  });

const emailOrNull = z.union([z.string(), z.null()]).transform((value, ctx) => {
  const text = (value ?? "").trim().toLowerCase();
  if (text === "") return null;
  if (text.length > 254 || !z.email().safeParse(text).success) {
    ctx.addIssue({ code: "custom", message: "Bitte geben Sie eine gültige E-Mail-Adresse ein." });
    return z.NEVER;
  }
  return text;
});

const intIn = (min: number, max: number) =>
  z.coerce
    .number({ error: "Bitte geben Sie eine Zahl ein." })
    .int("Bitte geben Sie eine ganze Zahl ein.")
    .min(min, `Mindestens ${min}.`)
    .max(max, `Höchstens ${max}.`);

const numberIn = (min: number, max: number) =>
  z.coerce.number({ error: "Bitte geben Sie eine Zahl ein." }).min(min, `Mindestens ${min}.`).max(max, `Höchstens ${max}.`);

export const platformSettingShape = {
  name: z.string().trim().min(2, "Mindestens 2 Zeichen.").max(60, "Höchstens 60 Zeichen."),
  contact_email: emailOrNull,
  contact_phone: trimmedOrNull(30),
  address: trimmedOrNull(300),
};

export const maintenanceSettingShape = {
  enabled: z.boolean(),
  message: z.string().trim().min(10, "Bitte geben Sie einen Hinweistext mit mindestens 10 Zeichen ein.").max(300, "Höchstens 300 Zeichen."),
};

export const publishingSettingShape = {
  require_review: z.boolean(),
  min_images: intIn(0, 20),
  max_images: intIn(1, 100),
};

export const aiQuotaSettingShape = {
  description_per_month: intIn(0, 10_000),
  valuation_per_month: intIn(0, 10_000),
  image_enhance_per_month: intIn(0, 10_000),
  virtual_staging_per_month: intIn(0, 10_000),
  assistant_messages_per_day: intIn(0, 10_000),
};

export const featureSettingShape = {
  valuation: z.boolean(),
  ai_descriptions: z.boolean(),
  image_ai: z.boolean(),
  assistant: z.boolean(),
  dossiers: z.boolean(),
  search_alerts: z.boolean(),
  business_accounts: z.boolean(),
  registration: z.boolean(),
};

export const valuationSettingShape = {
  min_comparables: intIn(1, 100),
  max_age_days: intIn(30, 3650),
  radius_km: numberIn(1, 100),
  area_tolerance: numberIn(0.05, 1),
};

type ShapeOutput<S extends Record<string, z.ZodType>> = { [K in keyof S]: z.output<S[K]> };

export type PlatformSection = ShapeOutput<typeof platformSettingShape>;
export type MaintenanceSection = ShapeOutput<typeof maintenanceSettingShape>;
export type PublishingSection = ShapeOutput<typeof publishingSettingShape>;
export type AiQuotaSection = ShapeOutput<typeof aiQuotaSettingShape>;
export type FeatureSection = ShapeOutput<typeof featureSettingShape>;
export type ValuationSection = ShapeOutput<typeof valuationSettingShape>;

export interface PlatformSettings {
  platform: PlatformSection;
  maintenance: MaintenanceSection;
  publishing: PublishingSection;
  ai_quotas: AiQuotaSection;
  features: FeatureSection;
  valuation: ValuationSection;
}

export type SettingKey = keyof PlatformSettings;
export const SETTING_KEYS = ["platform", "maintenance", "publishing", "ai_quotas", "features", "valuation"] as const satisfies readonly SettingKey[];

/** Standardwerte (identisch mit Migration 9, Referenzdaten). */
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platform: { name: "Immovia", contact_email: null, contact_phone: null, address: null },
  maintenance: {
    enabled: false,
    message: "Wir führen gerade Wartungsarbeiten durch. Bitte versuchen Sie es später erneut.",
  },
  publishing: { require_review: false, min_images: 1, max_images: 40 },
  ai_quotas: {
    description_per_month: 30,
    valuation_per_month: 10,
    image_enhance_per_month: 200,
    virtual_staging_per_month: 0,
    assistant_messages_per_day: 40,
  },
  features: {
    valuation: true,
    ai_descriptions: true,
    image_ai: true,
    assistant: true,
    dossiers: true,
    search_alerts: true,
    business_accounts: true,
    registration: true,
  },
  valuation: { min_comparables: 5, max_age_days: 365, radius_km: 15, area_tolerance: 0.35 },
};

const SECTION_SHAPES: { [K in SettingKey]: Record<keyof PlatformSettings[K], z.ZodType> } = {
  platform: platformSettingShape,
  maintenance: maintenanceSettingShape,
  publishing: publishingSettingShape,
  ai_quotas: aiQuotaSettingShape,
  features: featureSettingShape,
  valuation: valuationSettingShape,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Liest einen gespeicherten Abschnitt tolerant: Jedes Feld wird einzeln geprüft,
 * fehlende oder ungültige Felder erhalten den Standardwert.
 */
export function parseSettingSection<K extends SettingKey>(key: K, raw: unknown): PlatformSettings[K] {
  const defaults = DEFAULT_PLATFORM_SETTINGS[key];
  const shape = SECTION_SHAPES[key] as Record<string, z.ZodType>;
  const source = isRecord(raw) ? raw : {};
  const result: Record<string, unknown> = { ...defaults };
  for (const field of Object.keys(defaults)) {
    if (!(field in source)) continue;
    const schema = shape[field];
    if (!schema) continue;
    const parsed = schema.safeParse(source[field]);
    if (parsed.success) result[field] = parsed.data;
  }
  const section = result as PlatformSettings[K];
  if (key === "publishing") {
    const publishing = section as PublishingSection;
    if (publishing.max_images < publishing.min_images) {
      return { ...publishing, max_images: Math.max(publishing.min_images, 1) } as PlatformSettings[K];
    }
  }
  return section;
}

/** Baut die vollständigen Einstellungen aus den Zeilen von feature_settings. */
export function parsePlatformSettings(rows: ReadonlyArray<{ key: string; value: unknown }> | null | undefined): PlatformSettings {
  const byKey = new Map((rows ?? []).map((row) => [row.key, row.value] as const));
  return {
    platform: parseSettingSection("platform", byKey.get("platform")),
    maintenance: parseSettingSection("maintenance", byKey.get("maintenance")),
    publishing: parseSettingSection("publishing", byKey.get("publishing")),
    ai_quotas: parseSettingSection("ai_quotas", byKey.get("ai_quotas")),
    features: parseSettingSection("features", byKey.get("features")),
    valuation: parseSettingSection("valuation", byKey.get("valuation")),
  };
}

/** Strikte Schemas für die Admin-Formulare (alle Felder Pflicht). */
export const settingInputSchemas = {
  platform: z.object(platformSettingShape),
  maintenance: z.object(maintenanceSettingShape),
  publishing: z
    .object(publishingSettingShape)
    .refine((v) => v.max_images >= v.min_images, {
      path: ["max_images"],
      message: "Die Höchstzahl muss mindestens der Mindestanzahl entsprechen.",
    })
    .refine((v) => v.max_images >= 1, { path: ["max_images"], message: "Mindestens 1." }),
  ai_quotas: z.object(aiQuotaSettingShape),
  features: z.object(featureSettingShape),
  valuation: z.object(valuationSettingShape),
} as const;

export const settingKeySchema = z.enum(SETTING_KEYS);

export const SETTING_SECTIONS: Record<SettingKey, { title: string; description: string }> = {
  platform: {
    title: "Plattform und Kontakt",
    description: "Name und Kontaktdaten, die auf der Plattform und in E-Mails verwendet werden.",
  },
  maintenance: {
    title: "Wartungsmodus",
    description: "Zeigt allen Besucherinnen und Besuchern einen Hinweis auf Wartungsarbeiten an.",
  },
  publishing: {
    title: "Veröffentlichungsvorgaben",
    description: "Regeln, die beim Veröffentlichen von Inseraten serverseitig geprüft werden.",
  },
  ai_quotas: {
    title: "Freikontingente für KI",
    description: "Kostenlose Kontingente pro Benutzer für kostenintensive Funktionen.",
  },
  features: {
    title: "Funktionen",
    description: "Einzelne Funktionen der Plattform aktivieren oder deaktivieren.",
  },
  valuation: {
    title: "Bewertungsparameter",
    description: "Parameter der Vergleichsbewertung auf Basis echter Angebotspreise.",
  },
};

export const FEATURE_FLAGS: Record<keyof FeatureSection, { label: string; description: string }> = {
  valuation: { label: "KI-Immobilienbewertung", description: "Bewertungen im Verkaufsassistenten und auf /bewerten." },
  ai_descriptions: { label: "KI-Texte für Inserate", description: "Beschreibungen und Highlights mit KI erstellen." },
  image_ai: { label: "KI-Bildbearbeitung", description: "Optimierung und Visualisierungen im Bilderstudio." },
  assistant: { label: "KI-Assistent", description: "Chat-Assistent im Dashboard." },
  dossiers: { label: "Verkaufsdossiers", description: "PDF-Dossiers erstellen und herunterladen." },
  search_alerts: { label: "Suchaufträge", description: "Benachrichtigungen zu neuen passenden Inseraten." },
  business_accounts: { label: "Firmenkonten", description: "Neue Firmenkonten anlegen und Mitglieder einladen." },
  registration: { label: "Registrierung", description: "Neue Benutzerkonten können erstellt werden." },
};

export const AI_QUOTA_FIELDS: Record<keyof AiQuotaSection, string> = {
  description_per_month: "KI-Texte pro Monat",
  valuation_per_month: "Bewertungen pro Monat",
  image_enhance_per_month: "Bildoptimierungen pro Monat",
  virtual_staging_per_month: "Virtuelle Möblierungen pro Monat",
  assistant_messages_per_day: "Assistent-Nachrichten pro Tag",
};

export const VALUATION_FIELDS: Record<keyof ValuationSection, { label: string; hint: string; step: string }> = {
  min_comparables: {
    label: "Mindestanzahl Vergleichsobjekte",
    hint: "Unterhalb dieser Anzahl wird keine Zahl angezeigt.",
    step: "1",
  },
  max_age_days: { label: "Maximales Alter der Vergleichsinserate (Tage)", hint: "30 bis 3650 Tage.", step: "1" },
  radius_km: { label: "Suchradius (km)", hint: "1 bis 100 km.", step: "0.5" },
  area_tolerance: {
    label: "Flächentoleranz",
    hint: "Anteil der Wohnfläche, z. B. 0.35 entspricht ±35 %.",
    step: "0.05",
  },
};

// =============================================================================
// Eingaben der Admin-Aktionen
// =============================================================================
const reasonText = z.string().trim().max(1000, "Höchstens 1000 Zeichen.");
const REASON_REQUIRED = "Bitte geben Sie eine Begründung mit mindestens 5 Zeichen an.";

export const userStatusInputSchema = z
  .object({
    userId: z.uuid(),
    status: z.enum(["active", "suspended"]),
    reason: z.string().trim().max(500, "Höchstens 500 Zeichen."),
  })
  .refine((v) => v.status !== "suspended" || v.reason.length >= 5, { path: ["reason"], message: REASON_REQUIRED });

export const roleInputSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["admin", "moderator"]),
  grant: z.boolean(),
});

export const verificationInputSchema = z
  .object({
    subjectType: z.enum(["user", "property", "organization"]),
    subjectId: z.uuid(),
    kind: z.enum(["identity", "ownership", "documentation_complete", "organization"]),
    status: z.enum(["verified", "rejected", "revoked"]),
    method: z.string().trim().max(200, "Höchstens 200 Zeichen."),
  })
  .refine((v) => VERIFICATION_KINDS[v.kind].subject === v.subjectType, {
    path: ["kind"],
    message: "Diese Prüfung passt nicht zum gewählten Eintrag.",
  })
  .refine((v) => v.status !== "verified" || v.method.length >= 3, {
    path: ["method"],
    message: "Bitte beschreiben Sie kurz, wie geprüft wurde.",
  });

export const LISTING_MODERATION_ACTIONS = ["approve", "reject", "block", "unblock", "flag"] as const;
export type ListingModerationAction = (typeof LISTING_MODERATION_ACTIONS)[number];

export const LISTING_ACTION_LABELS: Record<ListingModerationAction, { label: string; requiresReason: boolean; destructive: boolean }> = {
  approve: { label: "Freigeben", requiresReason: false, destructive: false },
  reject: { label: "Zurückweisen", requiresReason: true, destructive: false },
  block: { label: "Sperren", requiresReason: true, destructive: true },
  unblock: { label: "Entsperren", requiresReason: false, destructive: false },
  flag: { label: "Markieren", requiresReason: true, destructive: false },
};

export const moderateListingInputSchema = z
  .object({
    listingId: z.uuid(),
    action: z.enum(LISTING_MODERATION_ACTIONS),
    reason: reasonText,
  })
  .refine((v) => !LISTING_ACTION_LABELS[v.action].requiresReason || v.reason.length >= 5, {
    path: ["reason"],
    message: REASON_REQUIRED,
  });

export const reportUpdateInputSchema = z.object({
  reportId: z.uuid(),
  status: z.enum(["open", "in_review", "resolved", "dismissed"]),
  note: z.string().trim().max(2000, "Höchstens 2000 Zeichen."),
});

export const orgStatusInputSchema = z
  .object({
    organizationId: z.uuid(),
    status: z.enum(["active", "suspended"]),
    reason: z.string().trim().max(500, "Höchstens 500 Zeichen."),
  })
  .refine((v) => v.status !== "suspended" || v.reason.length >= 5, { path: ["reason"], message: REASON_REQUIRED });

export const contactStatusInputSchema = z.object({
  requestId: z.uuid(),
  status: z.enum(["open", "answered", "closed", "spam"]),
});

// =============================================================================
// Such- und Filterparameter (URL)
// =============================================================================
export type SearchParamValue = string | string[] | undefined;

export function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePageParam(value: SearchParamValue): number {
  const n = Number.parseInt(firstParam(value) ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1000) : 1;
}

export const PERIOD_OPTIONS = [7, 30, 90, 365] as const;

export function parseDaysParam(value: SearchParamValue, fallback = 30): number {
  const n = Number.parseInt(firstParam(value) ?? "", 10);
  return (PERIOD_OPTIONS as readonly number[]).includes(n) ? n : fallback;
}

export function parseEnumParam<T extends string>(value: SearchParamValue, allowed: readonly T[]): T | undefined {
  const v = firstParam(value);
  return v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Freitext aus der URL: getrimmt, ohne Steuerzeichen, auf 100 Zeichen gekürzt. */
export function parseQueryParam(value: SearchParamValue): string | undefined {
  const v = firstParam(value)?.replace(/[\u0000-\u001f]/g, "").trim();
  return v ? v.slice(0, 100) : undefined;
}

/** Datum im Format JJJJ-MM-TT aus der URL. */
export function parseDateParam(value: SearchParamValue): string | undefined {
  const v = firstParam(value);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const date = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : v;
}

/** Escaping für ILIKE-Muster (PostgREST): %, _ und \ werden wörtlich gesucht. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Bereinigt einen Suchbegriff für PostgREST-or()-Filter: Zeichen mit Sonderbedeutung
 * in der Filtersyntax (Komma, Klammern, Anführungszeichen, Platzhalter) werden entfernt.
 */
export function sanitizeOrFilterValue(value: string): string {
  return value
    .replace(/[,()"'\\*%_:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export const ADMIN_PAGE_SIZE = 25;
