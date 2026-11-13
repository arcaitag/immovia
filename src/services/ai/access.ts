import "server-only";

import { after } from "next/server";
import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { enqueueJob, runJobNow, type EnqueueInput } from "@/lib/jobs/queue";
import type { JobRow } from "@/lib/jobs/types";
import { aiConsentRequiredError, readAiConsent, type AiConsentKind } from "@/lib/ai/consent";
import { AI_NOT_CONFIGURED_MESSAGE, isAiConfigured } from "@/lib/ai/provider";
import { buildQuotaStatus, type FeatureFlags, type QuotaFeature, type QuotaStatus } from "@/lib/ai/settings";
import { countQuotaUsage } from "@/lib/ai/usage";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/lib/utils";
import type { Tables } from "@/types/database";
import { loadAiSettings, type AiPlatformSettings } from "@/services/ai/settings";

/**
 * Gemeinsame Prüfungen für KI-, Bewertungs-, Bild- und Dossier-Funktionen.
 */

/** Darf der Benutzer das Objekt verwalten (Eigentümer oder Mitglied der Organisation)? */
export function canManageProperty(user: SessionUser, row: { owner_id: string; organization_id: string | null }): boolean {
  return row.owner_id === user.id || (row.organization_id !== null && user.organizations.some((o) => o.id === row.organization_id));
}

/**
 * Lädt eine Immobilie mit dem Benutzer-Client (RLS) und prüft die Verwaltungsberechtigung.
 * Moderatoren sehen fremde Objekte zwar, dürfen hier aber nicht handeln.
 */
export async function requireManagedProperty(supabase: ServerSupabaseClient, user: SessionUser, propertyId: string): Promise<Tables<"properties">> {
  if (!isUuid(propertyId)) throw new AppError("not_found");
  const { data, error } = await supabase.from("properties").select("*").eq("id", propertyId).is("deleted_at", null).maybeSingle();
  if (error) throw new AppError("unknown", undefined, { raw: error.message });
  if (!data || !canManageProperty(user, data)) throw new AppError("not_found", "Die Immobilie wurde nicht gefunden.");
  return data;
}

/** Filter für eigene bzw. Firmen-Objekte (ohne Moderationszugriff auf fremde Objekte). */
export function managedPropertiesFilter(user: SessionUser): string {
  const orgIds = user.organizations.map((o) => o.id);
  return orgIds.length ? `owner_id.eq.${user.id},organization_id.in.(${orgIds.join(",")})` : `owner_id.eq.${user.id}`;
}

export type UnavailableReason = "not_configured" | "service_role_missing" | "feature_disabled" | "quota_exceeded";

export interface FeatureAvailability {
  available: boolean;
  reason?: UnavailableReason;
  message?: string;
  quota?: QuotaStatus;
  /**
   * Die Einwilligung zur KI-Verarbeitung fehlt. Die Funktion ist nicht gesperrt: Die Oberfläche
   * fragt vor dem Start im Einwilligungsdialog nach, der Server prüft vor jedem KI-Aufruf erneut.
   */
  consentRequired?: boolean;
  /** Welche Einwilligung fehlt (KI-Texte oder Bild-KI) */
  consentKind?: AiConsentKind;
}

/** Einwilligung zur KI-Verarbeitung (Standard: aus; fehlende Zeile = keine Einwilligung). */
export async function hasAiConsent(supabase: ServerSupabaseClient, userId: string, kind: AiConsentKind = "text"): Promise<boolean> {
  return readAiConsent(supabase, userId, kind);
}

export interface AvailabilityOptions {
  supabase: ServerSupabaseClient;
  userId: string;
  flag: keyof FeatureFlags;
  quotaFeature?: QuotaFeature;
  /** Braucht die Funktion den Anthropic-Zugang? */
  requiresAi: boolean;
  /** Braucht die Funktion die Einwilligung zur KI-Verarbeitung? */
  requiresConsent: boolean;
  /** Welche Einwilligung (Standard: KI-Texte) */
  consentKind?: AiConsentKind;
  settings?: AiPlatformSettings;
}

export async function getFeatureAvailability(options: AvailabilityOptions): Promise<FeatureAvailability> {
  const settings = options.settings ?? (await loadAiSettings());
  if (!settings.features[options.flag]) {
    return { available: false, reason: "feature_disabled", message: "Diese Funktion ist auf Immovia vorübergehend deaktiviert." };
  }
  if (!isServiceRoleConfigured()) {
    return {
      available: false,
      reason: "service_role_missing",
      message: "Hintergrundaufträge sind auf diesem Server nicht eingerichtet (SUPABASE_SECRET_KEY fehlt).",
    };
  }
  if (options.requiresAi && !isAiConfigured()) {
    return { available: false, reason: "not_configured", message: AI_NOT_CONFIGURED_MESSAGE };
  }
  const consentKind = options.consentKind ?? "text";
  const consentRequired = options.requiresConsent && !(await hasAiConsent(options.supabase, options.userId, consentKind));
  if (options.quotaFeature) {
    const used = await countQuotaUsage(createAdminClient(), options.userId, options.quotaFeature);
    const quota = buildQuotaStatus(options.quotaFeature, settings.quotas, used);
    if (quota.limit === 0) {
      return { available: false, reason: "quota_exceeded", message: "Diese Funktion ist in Ihrem Kontingent derzeit nicht enthalten.", quota };
    }
    if (quota.remaining <= 0) {
      return {
        available: false,
        reason: "quota_exceeded",
        message: `Ihr Kontingent ist ausgeschöpft (${quota.used} von ${quota.limit} ${quota.unit} ${quota.period === "day" ? "heute" : "in diesem Monat"}). Es wird am ${formatDate(quota.resetsAt)} zurückgesetzt.`,
        quota,
      };
    }
    return { available: true, quota, consentRequired, consentKind };
  }
  return { available: true, consentRequired, consentKind };
}

/** Wirft bei gesperrter Funktion einen passenden AppError, bei fehlender Einwilligung aiConsentRequiredError(). */
export function assertAvailable(availability: FeatureAvailability): void {
  if (!availability.available) {
    throw new AppError(availability.reason === "quota_exceeded" ? "quota_exceeded" : "service_unavailable", availability.message);
  }
  if (availability.consentRequired) throw aiConsentRequiredError(availability.consentKind);
}

/** Kurzfristiges Rate Limit über check_rate_limit (PostgreSQL, Service Role). */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  const { data, error } = await createAdminClient().rpc("check_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error("[ai] Rate Limit konnte nicht geprüft werden", error.message);
    return;
  }
  if (data === false) throw new AppError("rate_limited");
}

/** Reiht einen Job ein und verarbeitet ihn direkt nach der Antwort (after). */
export async function enqueueAndRun(input: EnqueueInput): Promise<JobRow> {
  const job = await enqueueJob(input);
  if (job.status === "queued") {
    after(async () => {
      try {
        await runJobNow(job.id);
      } catch (error) {
        console.error(`[jobs] Sofortverarbeitung von ${job.id} fehlgeschlagen`, error);
      }
    });
  }
  return job;
}
