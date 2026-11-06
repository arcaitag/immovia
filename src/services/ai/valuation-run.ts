import "server-only";

import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { aiGenerateText } from "@/lib/ai/service";
import { isAiConfigured } from "@/lib/ai/provider";
import {
  VALUATION_EXPLANATION_SYSTEM_PROMPT,
  buildValuationExplanationData,
  buildValuationExplanationPrompt,
  numbersAreGrounded,
} from "@/lib/ai/prompts/valuation";
import { NO_DATA_DISCLAIMER, VALUATION_DISCLAIMER, VALUATION_GROUPS, valuationGroupFor } from "@/lib/valuation/config";
import { areaOf } from "@/lib/valuation/comparables";
import { deriveValueFactors } from "@/lib/valuation/factors";
import { availableValuationProviders } from "@/lib/valuation/providers";
import type { ValuationProviderResult } from "@/lib/valuation/providers/types";
import { loadAiSettings } from "@/services/ai/settings";
import { loadPropertyContext, toValuationSubject } from "@/services/ai/property-data";
import { PermanentJobError } from "@/lib/jobs/types";

/**
 * Führt eine Bewertung aus und speichert sie (Service-Role-Client; Berechtigung wurde beim
 * Einreihen mit dem Benutzer-Client geprüft). Zahlen stammen ausschliesslich vom Provider.
 */
export async function runValuation(input: {
  admin: AdminSupabaseClient;
  propertyId: string;
  userId: string | null;
  jobId: string | null;
  withExplanation: boolean;
  now?: Date;
}): Promise<{ valuationId: string; status: string }> {
  const { admin, propertyId } = input;
  const now = input.now ?? new Date();
  const context = await loadPropertyContext(admin, propertyId);
  if (!context) throw new PermanentJobError("Die Immobilie wurde nicht gefunden.");
  const settings = await loadAiSettings(admin);
  if (!settings.features.valuation) throw new PermanentJobError("Die Bewertungsfunktion ist derzeit deaktiviert.");

  const subject = toValuationSubject(context.property);
  const providers = availableValuationProviders();
  if (providers.length === 0) throw new PermanentJobError("Kein Bewertungs-Provider verfügbar.");

  let result: ValuationProviderResult | null = null;
  for (const provider of providers) {
    try {
      const attempt = await provider.estimate(subject, { admin, params: settings.valuation, now });
      result = attempt;
      if (attempt.estimate.status !== "insufficient_data") break;
    } catch (error) {
      console.error(`[valuation] Provider ${provider.id} fehlgeschlagen`, error);
      if (provider === providers[providers.length - 1] && !result) throw error;
    }
  }
  if (!result) throw new Error("Die Bewertung konnte nicht berechnet werden.");

  const estimate = result.estimate;
  const factors = deriveValueFactors(
    { ...context.property, featureKeys: context.featureKeys, renovations: context.renovations },
    now,
  );

  // Optionale KI-Erklärung – nur auf Basis der berechneten Daten, Zahlen werden geprüft
  let explanation: string | null = null;
  let aiModel: string | null = null;
  const group = valuationGroupFor(subject.propertyType);
  const area = group ? areaOf(subject, VALUATION_GROUPS[group].area) : null;
  if (input.withExplanation && isAiConfigured() && area && (estimate.status === "completed" || estimate.status === "limited")) {
    const explanationInput = {
      estimate,
      offerType: subject.offerType,
      propertyType: subject.propertyType,
      area,
      canton: subject.canton,
      positive: factors.positive,
      negative: factors.negative,
    };
    try {
      const response = await aiGenerateText(
        { feature: "valuation_explanation", userId: input.userId, jobId: input.jobId },
        { system: VALUATION_EXPLANATION_SYSTEM_PROMPT, prompt: buildValuationExplanationPrompt(explanationInput), maxTokens: 3000, effort: "low" },
      );
      const source = JSON.stringify(buildValuationExplanationData(explanationInput));
      if (numbersAreGrounded(response.text, source)) {
        explanation = response.text.slice(0, 3000);
        aiModel = response.model;
      } else {
        console.warn("[valuation] KI-Erklärung verworfen: enthält Zahlen, die nicht in den Daten vorkommen");
      }
    } catch (error) {
      console.warn("[valuation] KI-Erklärung nicht möglich", error instanceof Error ? error.message : error);
    }
  }

  const hasNumbers = estimate.status === "completed" || estimate.status === "limited";
  const dataQuality = {
    ...estimate.dataQuality,
    summary: estimate.summary,
    listPriceExplanation: estimate.listPriceExplanation,
    missing: estimate.missing,
    suggestions: estimate.suggestions,
  };
  const { data: valuation, error } = await admin
    .from("property_valuations")
    .insert({
      property_id: propertyId,
      requested_by: input.userId,
      status: estimate.status,
      method: result.method.slice(0, 80),
      provider: result.provider,
      price_basis: estimate.priceBasis,
      estimated_value: hasNumbers ? estimate.estimatedValue : null,
      value_low: hasNumbers ? estimate.valueLow : null,
      value_high: hasNumbers ? estimate.valueHigh : null,
      suggested_list_price: hasNumbers ? estimate.suggestedListPrice : null,
      confidence: estimate.confidence,
      confidence_explanation: estimate.confidenceExplanation,
      data_quality: dataQuality as unknown as Json,
      positive_factors: factors.positive as unknown as Json,
      negative_factors: factors.negative as unknown as Json,
      explanation,
      ai_model: aiModel,
      input_snapshot: { subject, params: settings.valuation, evaluatedAt: now.toISOString() } as unknown as Json,
      disclaimer: hasNumbers ? VALUATION_DISCLAIMER : NO_DATA_DISCLAIMER,
    })
    .select("id")
    .single();
  if (error || !valuation) throw new Error(`Bewertung konnte nicht gespeichert werden: ${error?.message ?? "unbekannt"}`);

  try {
    if (result.sources.length) {
      const { error: sourcesError } = await admin.from("valuation_sources").insert(
        result.sources.map((s) => ({
          valuation_id: valuation.id,
          source_type: s.sourceType,
          name: s.name.slice(0, 160),
          description: s.description?.slice(0, 1000) ?? null,
          data_as_of: s.dataAsOf,
          record_count: s.recordCount,
          license_note: s.licenseNote?.slice(0, 500) ?? null,
          url: s.url,
        })),
      );
      if (sourcesError) throw new Error(sourcesError.message);
    }
    if (estimate.comparables.length) {
      const { error: comparablesError } = await admin.from("valuation_comparables").insert(
        estimate.comparables.map((c) => ({
          valuation_id: valuation.id,
          kind: "offer",
          listing_id: c.listingId,
          property_type: c.propertyType,
          municipality: c.municipality,
          postal_code: c.postalCode,
          rooms: c.rooms,
          living_area: Math.round(c.area * 10) / 10,
          price: c.price,
          price_per_sqm: Math.round(c.pricePerSqm * 100) / 100,
          observed_at: c.observedAt,
          distance_km: c.distanceKm,
          similarity: c.similarity,
        })),
      );
      if (comparablesError) throw new Error(comparablesError.message);
    }
  } catch (error) {
    await admin.from("property_valuations").delete().eq("id", valuation.id);
    throw new Error(`Bewertungsdetails konnten nicht gespeichert werden: ${error instanceof Error ? error.message : "unbekannt"}`);
  }

  return { valuationId: valuation.id, status: estimate.status };
}
