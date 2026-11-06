import "server-only";

import { getPlatformSettings } from "@/lib/settings";
import { parseAiQuotas, parseFeatureFlags, type AiQuotas, type FeatureFlags } from "@/lib/ai/settings";
import { parseValuationParams, type ValuationParams } from "@/lib/valuation/config";

export interface AiPlatformSettings {
  features: FeatureFlags;
  quotas: AiQuotas;
  valuation: ValuationParams;
  /** Höchstzahl Bilder pro Objekt (publishing.max_images), relevant, wenn die Bild-KI neue Bilder anlegt. */
  maxImages: number;
}

/**
 * Admin-Schalter (features), Kontingente (ai_quotas), Bewertungsparameter (valuation) und
 * publishing.max_images über die zentralen Plattform-Einstellungen (getPlatformSettings, gecacht).
 * Die Werte werden zusätzlich durch die eigenen Parser geführt (z. B. min_comparables mindestens 3,
 * weil Quartile mit weniger Werten nicht aussagekräftig sind).
 */
export async function loadAiSettings(): Promise<AiPlatformSettings> {
  const settings = await getPlatformSettings();
  return {
    features: parseFeatureFlags(settings.features),
    quotas: parseAiQuotas(settings.ai_quotas),
    valuation: parseValuationParams(settings.valuation),
    maxImages: settings.publishing.max_images,
  };
}
