import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

/**
 * Öffentlich lesbare Plattform-Einstellungen (feature_settings, plans) für Inhaltsseiten.
 * So zeigen die Seiten die tatsächlich konfigurierten Werte statt fest eingetragener Zahlen.
 */

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function getSetting(key: string): Promise<JsonObject | null> {
  const supabase = createPublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("feature_settings").select("value").eq("key", key).maybeSingle();
  if (error) return null;
  return asObject(data?.value);
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

export interface PublicPlan {
  id: string;
  name: string;
  audience: "private" | "business";
  priceChfMonthly: number;
  activeListings: number | null;
  members: number | null;
}

export async function getPublicPlans(): Promise<PublicPlan[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("plans").select("id, name, audience, price_chf_monthly, limits").eq("is_active", true);
  if (error || !data) return [];
  return data
    .filter((plan): plan is typeof plan & { audience: "private" | "business" } => plan.audience === "private" || plan.audience === "business")
    .map((plan) => {
      const limits = asObject(plan.limits);
      return {
        id: plan.id,
        name: plan.name,
        audience: plan.audience,
        priceChfMonthly: Number(plan.price_chf_monthly),
        activeListings: asNumber(limits?.active_listings),
        members: asNumber(limits?.members),
      };
    });
}
