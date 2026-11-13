import { searchListings, EMPTY_FILTERS, type SearchRow } from "@/lib/api";
import { supabase } from "@/lib/supabase";

/**
 * Öffentliche Angaben für die Inhaltsseiten (wie src/lib/content/settings.ts der Website):
 * tatsächlich konfigurierte Werte statt fest eingetragener Zahlen.
 */

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function getSetting(key: string): Promise<JsonObject | null> {
  const { data, error } = await supabase.from("feature_settings").select("value").eq("key", key).maybeSingle();
  if (error) return null;
  return asObject(data?.value);
}

/** Die neuesten veröffentlichten Inserate für die Startseite. */
export async function latestListings(limit: number): Promise<SearchRow[]> {
  const { rows } = await searchListings(EMPTY_FILTERS, 0);
  return rows.slice(0, limit);
}

export interface ValuationSettings {
  enabled: boolean | null;
  minComparables: number | null;
  radiusKm: number | null;
  maxAgeDays: number | null;
  areaTolerance: number | null;
}

export async function getValuationSettings(): Promise<ValuationSettings> {
  const [valuation, features] = await Promise.all([getSetting("valuation"), getSetting("features")]);
  return {
    enabled: typeof features?.valuation === "boolean" ? features.valuation : null,
    minComparables: asNumber(valuation?.min_comparables),
    radiusKm: asNumber(valuation?.radius_km),
    maxAgeDays: asNumber(valuation?.max_age_days),
    areaTolerance: asNumber(valuation?.area_tolerance),
  };
}

export interface AiQuotas {
  descriptionPerMonth: number | null;
  valuationPerMonth: number | null;
  imageEnhancePerMonth: number | null;
}

export async function getAiQuotas(): Promise<AiQuotas> {
  const quotas = await getSetting("ai_quotas");
  return {
    descriptionPerMonth: asNumber(quotas?.description_per_month),
    valuationPerMonth: asNumber(quotas?.valuation_per_month),
    imageEnhancePerMonth: asNumber(quotas?.image_enhance_per_month),
  };
}

export interface BusinessPlan {
  id: string;
  name: string;
  priceChfMonthly: number;
  activeListings: number | null;
  members: number | null;
}

export async function getBusinessPlans(): Promise<BusinessPlan[]> {
  const { data, error } = await supabase.from("plans").select("id, name, audience, price_chf_monthly, limits").eq("is_active", true).eq("audience", "business");
  if (error || !data) return [];
  return data.map((plan) => {
    const limits = asObject(plan.limits);
    return {
      id: plan.id,
      name: plan.name,
      priceChfMonthly: Number(plan.price_chf_monthly),
      activeListings: asNumber(limits?.active_listings),
      members: asNumber(limits?.members),
    };
  });
}

export interface PlatformContact {
  email: string | null;
  phone: string | null;
  address: string | null;
}

/** Kontaktangaben aus den Plattform-Einstellungen, sofern hinterlegt. */
export async function getPlatformContact(): Promise<PlatformContact> {
  const value = await getSetting("platform");
  const read = (key: string) => {
    const v = value?.[key];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return { email: read("contact_email"), phone: read("contact_phone"), address: read("address") };
}

/** Themen des Kontaktformulars (wie CONTACT_SUBJECTS der Website). */
export const CONTACT_SUBJECTS = [
  "Frage zu einem Inserat",
  "Frage zu meinem Konto",
  "Verkaufen oder Vermieten",
  "Firmenkonto",
  "Datenschutz",
  "Technisches Problem",
  "Anderes Anliegen",
] as const;

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/** Prüft die Eingaben mit denselben Grenzen wie die Website; gibt die erste Fehlermeldung zurück. */
export function validateContact(input: ContactInput): string | null {
  if (input.name.trim().length < 2) return "Bitte geben Sie Ihren Namen ein.";
  if (input.name.trim().length > 120) return "Der Name ist zu lang.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || input.email.trim().length > 254) return "Bitte geben Sie eine gültige E-Mail-Adresse ein.";
  if (input.subject.trim().length < 2) return "Bitte wählen Sie ein Thema.";
  if (input.message.trim().length < 10) return "Die Nachricht muss mindestens 10 Zeichen lang sein.";
  if (input.message.trim().length > 4000) return "Die Nachricht darf höchstens 4000 Zeichen lang sein.";
  return null;
}

/** Speichert die Nachricht über dieselbe Datenbankfunktion wie die Website (mit Rate Limit). */
export async function submitContact(input: ContactInput): Promise<void> {
  const { error } = await supabase.rpc("submit_contact_request", {
    p_name: input.name.trim(),
    p_email: input.email.trim().toLowerCase(),
    p_subject: input.subject.trim(),
    p_message: input.message.trim(),
  });
  if (error) throw error;
}
