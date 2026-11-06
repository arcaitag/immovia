import "server-only";

import { createAdminClient, isServiceRoleConfigured, type AdminSupabaseClient } from "@/lib/supabase/admin";
import { estimateCostUsd, parsePricingOverrides, type TokenUsage } from "@/lib/ai/cost";
import type { AiFeature, ModelPricing } from "@/lib/ai/config";
import { quotaPeriod, QUOTA_RULES, type QuotaFeature } from "@/lib/ai/settings";

/**
 * Verbrauchsprotokoll (ai_usage_events) und Zählung für Kontingente.
 * Schreiben ausschliesslich mit dem Service-Role-Client.
 */

let pricingCache: { at: number; value: Record<string, ModelPricing> } | null = null;

async function pricingOverrides(admin: AdminSupabaseClient): Promise<Record<string, ModelPricing>> {
  if (pricingCache && Date.now() - pricingCache.at < 5 * 60_000) return pricingCache.value;
  const { data } = await admin.from("feature_settings").select("value").eq("key", "ai_pricing").maybeSingle();
  const value = parsePricingOverrides(data?.value);
  pricingCache = { at: Date.now(), value };
  return value;
}

export interface UsageEventInput {
  userId: string | null;
  jobId?: string | null;
  feature: AiFeature;
  provider: string;
  model?: string | null;
  usage?: TokenUsage;
  imageCount?: number;
  success: boolean;
}

export async function logAiUsage(input: UsageEventInput): Promise<void> {
  if (!isServiceRoleConfigured()) return;
  try {
    const admin = createAdminClient();
    const usage = input.usage ?? { inputTokens: 0, outputTokens: 0 };
    const cost = input.model && input.usage ? estimateCostUsd(input.model, usage, await pricingOverrides(admin)) : 0;
    const { error } = await admin.from("ai_usage_events").insert({
      user_id: input.userId,
      job_id: input.jobId ?? null,
      feature: input.feature,
      provider: input.provider,
      model: input.model ?? null,
      input_tokens: usage.inputTokens + (usage.cacheReadInputTokens ?? 0) + (usage.cacheCreationInputTokens ?? 0),
      output_tokens: usage.outputTokens,
      image_count: input.imageCount ?? 0,
      cost_usd: cost,
      success: input.success,
    });
    if (error) console.error("[ai] Verbrauch konnte nicht protokolliert werden", error.message);
  } catch (error) {
    console.error("[ai] Verbrauch konnte nicht protokolliert werden", error);
  }
}

/**
 * Verbrauch im aktuellen Zeitraum: erfolgreiche Aufrufe plus noch laufende Aufträge
 * (damit mehrfaches Klicken das Kontingent nicht umgeht).
 */
export async function countQuotaUsage(admin: AdminSupabaseClient, userId: string, feature: QuotaFeature, now: Date = new Date()): Promise<number> {
  const { start } = quotaPeriod(QUOTA_RULES[feature].period, now);
  const since = start.toISOString();

  if (feature === "valuation") {
    const { count } = await admin
      .from("ai_generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("job_type", "valuation")
      .in("status", ["queued", "running", "succeeded"])
      .gte("created_at", since);
    return count ?? 0;
  }

  const { count: used } = await admin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("success", true)
    .gte("created_at", since);

  if (feature === "description" || feature === "virtual_staging") {
    const { count: pending } = await admin
      .from("ai_generation_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("job_type", feature)
      .in("status", ["queued", "running"])
      .gte("created_at", since);
    return (used ?? 0) + (pending ?? 0);
  }
  return used ?? 0;
}
