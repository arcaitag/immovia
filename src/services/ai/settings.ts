import "server-only";

import { parsePricingOverrides } from "@/lib/ai/cost";
import type { ModelPricing } from "@/lib/ai/config";
import { parseAiQuotas, parseFeatureFlags, type AiQuotas, type FeatureFlags } from "@/lib/ai/settings";
import { parseValuationParams, type ValuationParams } from "@/lib/valuation/config";
import type { DbClient } from "@/services/ai/db";

export interface AiPlatformSettings {
  features: FeatureFlags;
  quotas: AiQuotas;
  valuation: ValuationParams;
  pricing: Record<string, ModelPricing>;
}

/** Liest die relevanten feature_settings (für Benutzer lesbar, RLS erlaubt Select). */
export async function loadAiSettings(client: DbClient): Promise<AiPlatformSettings> {
  const { data, error } = await client
    .from("feature_settings")
    .select("key, value")
    .in("key", ["features", "ai_quotas", "valuation", "ai_pricing"]);
  if (error) console.error("[ai] Einstellungen konnten nicht gelesen werden", error.message);
  const map = new Map((data ?? []).map((row) => [row.key, row.value]));
  return {
    features: parseFeatureFlags(map.get("features")),
    quotas: parseAiQuotas(map.get("ai_quotas")),
    valuation: parseValuationParams(map.get("valuation")),
    pricing: parsePricingOverrides(map.get("ai_pricing")),
  };
}
