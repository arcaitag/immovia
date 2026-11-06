import "server-only";

import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { resolveModel } from "@/lib/ai/config";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import type { AiProvider } from "@/lib/ai/types";

export const AI_NOT_CONFIGURED_MESSAGE =
  "Die KI-Funktionen sind noch nicht eingerichtet. Sobald der Zugang zum KI-Dienst (ANTHROPIC_API_KEY) hinterlegt ist, steht diese Funktion zur Verfügung.";

let cached: { key: string; provider: AiProvider } | null = null;

export function isAiConfigured(): boolean {
  return Boolean(serverEnv.anthropicApiKey);
}

export function configuredAiModel(): string {
  return resolveModel(serverEnv.anthropicModel);
}

/** Liefert den konfigurierten KI-Provider oder null («KI nicht konfiguriert»). */
export function getAiProvider(): AiProvider | null {
  const apiKey = serverEnv.anthropicApiKey;
  if (!apiKey) return null;
  const model = configuredAiModel();
  const key = `${model}:${apiKey.slice(-6)}`;
  if (!cached || cached.key !== key) {
    cached = { key, provider: new AnthropicProvider(apiKey, model) };
  }
  return cached.provider;
}

export function requireAiProvider(): AiProvider {
  const provider = getAiProvider();
  if (!provider) throw new AppError("service_unavailable", AI_NOT_CONFIGURED_MESSAGE);
  return provider;
}
