import "server-only";

import type { AiFeature } from "@/lib/ai/config";
import type { TokenUsage } from "@/lib/ai/cost";
import { assertAiConsent } from "@/lib/ai/consent";
import { requireAiProvider } from "@/lib/ai/provider";
import { completeAiUsage, logAiUsage, reserveAiUsage } from "@/lib/ai/usage";
import {
  AiOutputError,
  type AiStructuredResult,
  type AiTextResult,
  type AiTextStream,
  type GenerateStructuredOptions,
  type GenerateTextOptions,
  type StreamTextOptions,
} from "@/lib/ai/types";

/**
 * Einstiegspunkt für alle KI-Aufrufe: Provider auflösen, Einwilligung prüfen, aufrufen,
 * Verbrauch protokollieren. Ohne ANTHROPIC_API_KEY wird ein AppError «service_unavailable»
 * geworfen, ohne Einwilligung ein AppError mit details.consentRequired – es werden niemals
 * Platzhaltertexte erzeugt.
 */

export interface AiCallMeta {
  feature: AiFeature;
  userId: string | null;
  jobId?: string | null;
}

/** Gemeinsame Vorprüfung: erst Konfiguration (klare Meldung), dann die Einwilligung des Benutzers. */
async function prepare(meta: AiCallMeta) {
  const provider = requireAiProvider();
  await assertAiConsent(meta.userId);
  return provider;
}

function failureDetails(error: unknown, fallbackModel: string) {
  if (error instanceof AiOutputError) return { usage: error.usage, model: error.model ?? fallbackModel };
  // Abgebrochene Streams tragen den bis dahin angefallenen Verbrauch (siehe AnthropicProvider.streamText)
  const partial = error as { usage?: TokenUsage; model?: string } | null;
  if (partial && typeof partial === "object" && partial.usage) return { usage: partial.usage, model: partial.model ?? fallbackModel };
  return { usage: undefined, model: fallbackModel };
}

export async function aiGenerateStructured<T>(meta: AiCallMeta, options: GenerateStructuredOptions<T>): Promise<AiStructuredResult<T>> {
  const provider = await prepare(meta);
  try {
    const result = await provider.generateStructured(options);
    await logAiUsage({ ...meta, provider: provider.id, model: result.model, usage: result.usage, success: true });
    return result;
  } catch (error) {
    await logAiUsage({ ...meta, provider: provider.id, ...failureDetails(error, provider.model), success: false });
    throw error;
  }
}

export async function aiGenerateText(meta: AiCallMeta, options: GenerateTextOptions): Promise<AiTextResult> {
  const provider = await prepare(meta);
  try {
    const result = await provider.generateText(options);
    await logAiUsage({ ...meta, provider: provider.id, model: result.model, usage: result.usage, success: true });
    return result;
  } catch (error) {
    await logAiUsage({ ...meta, provider: provider.id, ...failureDetails(error, provider.model), success: false });
    throw error;
  }
}

/**
 * Streaming (Assistent). Der Verbrauchseintrag wird beim Start reserviert (zählt sofort fürs
 * Kontingent) und beim Ende des Streams mit Tokens und Ergebnis ergänzt – auch bei Abbruch.
 */
export async function aiStreamText(meta: AiCallMeta, options: StreamTextOptions): Promise<AiTextStream> {
  const provider = await prepare(meta);
  const reservation = await reserveAiUsage({ ...meta, provider: provider.id, model: provider.model });
  let stream: AiTextStream;
  try {
    stream = await provider.streamText(options);
  } catch (error) {
    await completeAiUsage(reservation, { ...meta, provider: provider.id, ...failureDetails(error, provider.model), success: false });
    throw error;
  }
  const final = stream.final.then(
    async (result) => {
      await completeAiUsage(reservation, { ...meta, provider: provider.id, model: result.model, usage: result.usage, success: true });
      return result;
    },
    async (error: unknown) => {
      await completeAiUsage(reservation, { ...meta, provider: provider.id, ...failureDetails(error, provider.model), success: false });
      throw error;
    },
  );
  final.catch(() => undefined);
  return { ...stream, final };
}
