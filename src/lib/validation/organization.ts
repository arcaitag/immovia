import { z } from "zod";
import { emailSchema } from "@/lib/validation/auth";
import { containsPlatformName, optionalPhoneSchema, optionalText } from "@/lib/validation/account";
import { CANTON_CODES, type Tone } from "@/lib/constants";
import type { Enums } from "@/types/database";

/**
 * Validierung für Firmenkonten (Organisationen, Mitglieder, Einladungen).
 */

export type OrgRole = Enums<"org_role">;

export const ORG_ROLES: Record<OrgRole, { label: string; description: string; tone: Tone }> = {
  owner: {
    label: "Inhaber/in",
    description: "Verwaltet das Firmenkonto vollständig und kann die Inhaberschaft übertragen.",
    tone: "dark",
  },
  admin: {
    label: "Administrator/in",
    description: "Bearbeitet das Firmenprofil und verwaltet Mitglieder und Einladungen.",
    tone: "green",
  },
  member: {
    label: "Mitarbeiter/in",
    description: "Arbeitet mit den Immobilien der Firma und sieht das Firmenprofil.",
    tone: "neutral",
  },
};

/** Rollen, die vergeben werden können (Inhaber nur per Übertragung). */
export const ASSIGNABLE_ORG_ROLES = ["admin", "member"] as const;

export const ORG_STATUS: Record<"active" | "suspended", { label: string; tone: Tone }> = {
  active: { label: "Aktiv", tone: "green" },
  suspended: { label: "Gesperrt", tone: "red" },
};

// -----------------------------------------------------------------------------
// UID (Unternehmens-Identifikationsnummer)
// Format CHE-123.456.789, letzte Ziffer = Prüfziffer (Gewichte 5,4,3,2,7,6,5,4; Modulo 11)
// -----------------------------------------------------------------------------
const UID_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4] as const;

export function uidCheckDigit(firstEightDigits: string): number | null {
  if (!/^\d{8}$/.test(firstEightDigits)) return null;
  const sum = UID_WEIGHTS.reduce((acc, weight, index) => acc + weight * Number(firstEightDigits[index]), 0);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? null : check;
}

/** Normalisiert eine UID auf «CHE-123.456.789» oder liefert null bei ungültiger Nummer. */
export function normalizeUid(raw: string): string | null {
  let value = raw.trim().toUpperCase();
  // Zusätze wie «MWST», «TVA», «IVA», «HR» entfernen
  value = value.replace(/\s*(MWST|TVA|IVA|VAT|HR|RC|RI)\s*$/, "");
  value = value.replace(/[\s.\-]/g, "");
  if (/^\d{9}$/.test(value)) value = `CHE${value}`;
  const m = value.match(/^CHE(\d{8})(\d)$/);
  if (!m) return null;
  const digits = m[1] as string;
  const check = uidCheckDigit(digits);
  if (check === null || check !== Number(m[2])) return null;
  const all = `${digits}${m[2]}`;
  return `CHE-${all.slice(0, 3)}.${all.slice(3, 6)}.${all.slice(6, 9)}`;
}

/** Ergänzt fehlendes https:// und prüft die Adresse. Liefert null bei ungültiger Eingabe. */
export function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null;
    if (url.username || url.password) return null;
    return withProtocol;
  } catch {
    return null;
  }
}

const organizationName = z
  .string()
  .trim()
  .min(2, "Bitte geben Sie einen Firmennamen mit mindestens 2 Zeichen ein.")
  .max(120, "Höchstens 120 Zeichen.")
  .refine((value) => !containsPlatformName(value), "Der Firmenname darf «Immovia» nicht enthalten.");

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .transform((value, ctx) => {
    if (!value) return null;
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: "Bitte geben Sie eine gültige E-Mail-Adresse ein." });
      return z.NEVER;
    }
    return parsed.data;
  });

export const createOrganizationSchema = z.object({
  name: organizationName,
  email: optionalEmail,
  phone: optionalPhoneSchema,
});
export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;

export const organizationProfileSchema = z.object({
  organizationId: z.uuid(),
  name: organizationName,
  description: optionalText(4000),
  street: optionalText(120),
  postalCode: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[1-9]\d{3}$/.test(value), "Bitte geben Sie eine vierstellige Schweizer PLZ ein.")
    .transform((value) => (value === "" ? null : value)),
  city: optionalText(80),
  canton: z
    .enum(["", ...CANTON_CODES])
    .transform((value) => (value === "" ? null : value)),
  phone: optionalPhoneSchema,
  email: optionalEmail,
  website: z
    .string()
    .trim()
    .max(200, "Höchstens 200 Zeichen.")
    .transform((value, ctx) => {
      if (!value) return null;
      const normalized = normalizeWebsite(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Bitte geben Sie eine gültige Webadresse ein, z. B. www.firma.ch." });
        return z.NEVER;
      }
      return normalized;
    }),
  uidNumber: z
    .string()
    .trim()
    .max(30)
    .transform((value, ctx) => {
      if (!value) return null;
      const normalized = normalizeUid(value);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Bitte geben Sie eine gültige UID im Format CHE-123.456.789 ein (Prüfziffer stimmt nicht).",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  isPublic: z.boolean(),
});
export type OrganizationProfileInput = z.input<typeof organizationProfileSchema>;
export type OrganizationProfileValues = z.output<typeof organizationProfileSchema>;

export const inviteMemberSchema = z.object({
  organizationId: z.uuid(),
  email: emailSchema,
  role: z.enum(ASSIGNABLE_ORG_ROLES, { error: "Bitte wählen Sie eine Rolle." }),
});
export type InviteMemberInput = z.input<typeof inviteMemberSchema>;

export const memberRoleSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
  role: z.enum(ASSIGNABLE_ORG_ROLES),
});

export const memberRefSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
});

export const organizationRefSchema = z.object({ organizationId: z.uuid() });
export const invitationRefSchema = z.object({ invitationId: z.uuid() });

/** Einladungs-Token aus der E-Mail (64 Hex-Zeichen). */
export const invitationTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{32,128}$/i, "Ungültiger Einladungslink.");

export type InvitationStatus = "open" | "accepted" | "revoked" | "expired" | "invalid";

export interface InvitationPreview {
  status: InvitationStatus;
  organizationName: string | null;
  organizationSlug: string | null;
  logoPath: string | null;
  role: Exclude<OrgRole, "owner"> | null;
  expiresAt: string | null;
  emailHint: string | null;
  emailMatches: boolean | null;
  alreadyMember: boolean;
  invitedBy: string | null;
}

/** Wandelt die Antwort von get_organization_invitation in ein typisiertes Objekt um. */
export function parseInvitationPreview(raw: unknown): InvitationPreview {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const text = (key: string) => (typeof value[key] === "string" ? (value[key] as string) : null);
  const statusRaw = text("status");
  const status: InvitationStatus =
    statusRaw === "open" || statusRaw === "accepted" || statusRaw === "revoked" || statusRaw === "expired"
      ? statusRaw
      : "invalid";
  const roleRaw = text("role");
  return {
    status,
    organizationName: text("organization_name"),
    organizationSlug: text("organization_slug"),
    logoPath: text("logo_path"),
    role: roleRaw === "admin" || roleRaw === "member" ? roleRaw : null,
    expiresAt: text("expires_at"),
    emailHint: text("email_hint"),
    emailMatches: typeof value.email_matches === "boolean" ? value.email_matches : null,
    alreadyMember: value.already_member === true,
    invitedBy: text("invited_by"),
  };
}
