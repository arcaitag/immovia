import "server-only";

import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import {
  DEFAULT_PLATFORM_SETTINGS,
  parsePlatformSettings,
  type FeatureSection,
  type PlatformSettings,
} from "@/lib/validation/admin";

export type {
  AiQuotaSection,
  FeatureSection,
  MaintenanceSection,
  PlatformSection,
  PlatformSettings,
  PublishingSection,
  ValuationSection,
} from "@/lib/validation/admin";

/**
 * Plattform-Einstellungen aus feature_settings (öffentlich lesbar).
 * Gecacht über den Next.js Data Cache (60 s) und sofort neu geladen, wenn
 * Admins eine Einstellung ändern (Tag PLATFORM_SETTINGS_TAG).
 */
export const PLATFORM_SETTINGS_TAG = "platform-settings";

const loadSettingRows = unstable_cache(
  async (): Promise<Array<{ key: string; value: unknown }>> => {
    const supabase = createPublicClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from("feature_settings").select("key, value");
    // Fehler nicht cachen: werfen, der Aufrufer fällt auf die Standardwerte zurück
    if (error) throw new Error(`feature_settings: ${error.message}`);
    return data ?? [];
  },
  ["immovia-platform-settings-v1"],
  { tags: [PLATFORM_SETTINGS_TAG], revalidate: 60 },
);

/** Alle Plattform-Einstellungen mit Standardwerten für fehlende oder ungültige Felder. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    return parsePlatformSettings(await loadSettingRows());
  } catch (error) {
    console.error("[settings] Einstellungen konnten nicht geladen werden, Standardwerte aktiv", error);
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

/** Ob eine Funktion aktiviert ist (z. B. isFeatureEnabled("assistant")). */
export async function isFeatureEnabled(feature: keyof FeatureSection): Promise<boolean> {
  return (await getPlatformSettings()).features[feature];
}

/** Wartungsmodus: aktiv und Hinweistext. */
export async function getMaintenanceState(): Promise<{ enabled: boolean; message: string }> {
  return (await getPlatformSettings()).maintenance;
}
