import "server-only";

import { serverEnv } from "@/lib/env";
import { buildImageAiPrompt } from "@/lib/images/ai-providers/prompts";
import {
  ImageAiProviderError,
  type ImageAiCapability,
  type ImageAiInput,
  type ImageAiOutput,
  type ImageAiProvider,
} from "@/lib/images/ai-providers/types";

/**
 * Bild-KI über das Vercel AI Gateway (Endpunkt /v1/images/edits, OpenAI-kompatibel).
 *
 * Anmeldung: AI_GATEWAY_API_KEY (lokal) oder das OIDC-Token, das Vercel jeder Funktion im Header
 * x-vercel-oidc-token mitgibt (Produktion, kein gespeicherter Schlüssel). Abgerechnet wird über das
 * Guthaben des Vercel-Teams; Budgets setzt man im Dashboard unter AI Gateway → Budgets.
 *
 * Datenschutz je Anfrage: disallowPromptTraining (nur Anbieter ohne Training mit den Daten) und,
 * sofern nicht mit IMAGE_AI_ZDR=0 abgeschaltet, zeroDataRetention (keine Speicherung beim Anbieter).
 * Gibt es für das Modell keinen passenden Anbieter, lehnt das Gateway die Anfrage ab – es wird nie
 * stillschweigend auf einen Anbieter ohne diese Zusagen ausgewichen.
 */

export const GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image";
const REQUEST_TIMEOUT_MS = 150_000;
/** Ein schneller Fehler (Überlastung, Netzwerk) wird einmal sofort wiederholt, ein langsamer nicht. */
const RETRY_IF_FAILED_WITHIN_MS = 30_000;

/**
 * Geschätzte Kosten pro Bild in USD (Listenpreise laut Modellkatalog des AI Gateway, Stand November
 * 2026). Massgebend ist die Abrechnung von Vercel.
 */
const IMAGE_PRICES_USD: Record<string, Record<string, number>> = {
  "google/gemini-3.1-flash-image": { default: 0.067, "512": 0.045, "1K": 0.067, "2K": 0.101, "4K": 0.151 },
  "google/gemini-3-pro-image": { default: 0.1344, "1K": 0.1344, "2K": 0.1344, "4K": 0.24 },
  "google/gemini-2.5-flash-image": { default: 0.039 },
  "bfl/flux-3-image": { default: 0.048, "1024x1024": 0.048, "1536x1536": 0.07, "2048x2048": 0.1 },
  "bfl/flux-kontext-pro": { default: 0.04 },
  "bfl/flux-kontext-max": { default: 0.08 },
};

export function estimateImageCostUsd(model: string, size?: string): number | undefined {
  const prices = IMAGE_PRICES_USD[model];
  if (!prices) return undefined;
  return (size ? prices[size] : undefined) ?? prices.default;
}

export function imageModel(): string {
  return serverEnv.imageAiModel ?? DEFAULT_IMAGE_MODEL;
}

/** Kontext der laufenden Vercel-Funktion (wie @vercel/functions bzw. @vercel/oidc ihn lesen). */
function requestContextHeaders(): Record<string, string | undefined> | undefined {
  const store = (globalThis as Record<symbol, unknown>)[Symbol.for("@vercel/request-context")] as
    | { get?: () => { headers?: Record<string, string | undefined> } | undefined }
    | undefined;
  return store?.get?.()?.headers;
}

/** API-Schlüssel hat Vorrang, sonst OIDC-Token der Funktion (Header), sonst VERCEL_OIDC_TOKEN (Build, lokal). */
export function resolveGatewayToken(): string | null {
  const explicit = serverEnv.aiGatewayApiKey;
  if (explicit) return explicit;
  const header = requestContextHeaders()?.["x-vercel-oidc-token"];
  if (header) return header;
  return process.env.VERCEL_OIDC_TOKEN?.trim() || null;
}

export interface EditRequestBody {
  model: string;
  prompt: string;
  images: Array<{ image_url: string }>;
  n: 1;
  size?: string;
  providerOptions: { gateway: { disallowPromptTraining: true; zeroDataRetention?: true } };
}

export function buildEditRequest(capability: ImageAiCapability, input: ImageAiInput, options: { model: string; size?: string; zeroDataRetention: boolean }): EditRequestBody {
  return {
    model: options.model,
    prompt: buildImageAiPrompt(capability, { roomType: input.roomType, style: input.style }),
    images: [{ image_url: `data:${input.mimeType};base64,${input.image.toString("base64")}` }],
    n: 1,
    ...(options.size ? { size: options.size } : {}),
    providerOptions: { gateway: { disallowPromptTraining: true, ...(options.zeroDataRetention ? { zeroDataRetention: true as const } : {}) } },
  };
}

/** Text der Fehlermeldung des Gateways (für das Protokoll, nicht für die Oberfläche). */
export function gatewayErrorDetail(body: unknown): string {
  if (!body || typeof body !== "object") return typeof body === "string" ? body.slice(0, 500) : "";
  const error = (body as { error?: unknown }).error;
  if (typeof error === "string") return error.slice(0, 500);
  if (error && typeof error === "object") {
    const { message, type } = error as { message?: unknown; type?: unknown };
    return [typeof type === "string" ? type : null, typeof message === "string" ? message : null].filter(Boolean).join(": ").slice(0, 500);
  }
  return "";
}

/** Übersetzt einen HTTP-Fehler des Gateways in eine verständliche Meldung (Meldungen enden mit «Es wurde nichts verändert.»). */
export function mapGatewayError(status: number): ImageAiProviderError {
  const unchanged = "Es wurde nichts verändert.";
  if (status === 402) {
    return new ImageAiProviderError(`Das Guthaben bzw. Monatsbudget für die Bild-KI ist aufgebraucht. ${unchanged}`, true, status);
  }
  if (status === 401 || status === 403) {
    return new ImageAiProviderError(`Die Bild-KI ist auf Immovia derzeit nicht freigeschaltet (Anmeldung beim Anbieter fehlgeschlagen). ${unchanged}`, true, status);
  }
  if (status === 404) {
    return new ImageAiProviderError(`Das eingestellte Bildmodell ist beim Anbieter nicht verfügbar. ${unchanged}`, true, status);
  }
  if (status === 429 || status >= 500) {
    return new ImageAiProviderError(`Die Bild-KI ist gerade ausgelastet. Bitte versuchen Sie es in ein paar Minuten erneut. ${unchanged}`, false, status);
  }
  return new ImageAiProviderError(`Die Bild-KI hat den Auftrag abgelehnt. ${unchanged}`, true, status);
}

function decodeDataUrl(url: string): Buffer | null {
  const payload = /^data:image\/[a-z0-9.+-]+;base64,(.+)$/i.exec(url)?.[1];
  return payload ? Buffer.from(payload, "base64") : null;
}

/** Liest das erste Bild aus der Antwort (b64_json oder Data-URL). */
export function parseEditResponse(body: unknown): Buffer {
  const data = (body as { data?: Array<{ b64_json?: unknown; url?: unknown }> } | null)?.data;
  const first = Array.isArray(data) ? data[0] : undefined;
  let buffer: Buffer | null = null;
  if (first && typeof first.b64_json === "string" && first.b64_json.length > 0) buffer = Buffer.from(first.b64_json, "base64");
  else if (first && typeof first.url === "string") buffer = decodeDataUrl(first.url);
  if (!buffer || buffer.length < 100) {
    throw new ImageAiProviderError("Die Bild-KI hat kein Bild geliefert. Es wurde nichts verändert.", true);
  }
  return buffer;
}

async function callGateway(body: EditRequestBody, token: string): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(`${GATEWAY_BASE_URL}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    console.error("[bild-ki] Gateway nicht erreichbar", error instanceof Error ? error.message : error);
    throw new ImageAiProviderError(
      timedOut
        ? "Die Bild-KI hat zu lange gebraucht. Bitte versuchen Sie es erneut. Es wurde nichts verändert."
        : "Die Bild-KI ist gerade nicht erreichbar. Bitte versuchen Sie es in ein paar Minuten erneut. Es wurde nichts verändert.",
      timedOut,
    );
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`[bild-ki] Gateway-Fehler ${response.status} (${body.model}): ${gatewayErrorDetail(json)}`);
    throw mapGatewayError(response.status);
  }
  return parseEditResponse(json);
}

export const vercelGatewayProvider: ImageAiProvider = {
  id: "vercel-ai-gateway",
  label: "Vercel AI Gateway",
  capabilities: ["declutter", "virtual_staging"],
  isConfigured() {
    // Auf Vercel steht das OIDC-Token zur Laufzeit bereit; ausserhalb braucht es einen API-Schlüssel.
    return Boolean(serverEnv.aiGatewayApiKey) || process.env.VERCEL === "1";
  },
  async run(capability: ImageAiCapability, input: ImageAiInput): Promise<ImageAiOutput> {
    if (!this.capabilities.includes(capability)) {
      throw new ImageAiProviderError("Diese Funktion wird vom Bild-KI-Anbieter nicht unterstützt. Es wurde nichts verändert.", true);
    }
    const token = resolveGatewayToken();
    if (!token) {
      console.error("[bild-ki] Kein Token: AI_GATEWAY_API_KEY fehlt und kein OIDC-Token verfügbar (Vercel → Settings → Security)");
      throw mapGatewayError(401);
    }
    const model = imageModel();
    const size = serverEnv.imageAiSize;
    const body = buildEditRequest(capability, input, { model, size, zeroDataRetention: serverEnv.imageAiZeroDataRetention });

    const started = Date.now();
    let image: Buffer;
    try {
      image = await callGateway(body, token);
    } catch (error) {
      const retry = error instanceof ImageAiProviderError && !error.permanent && Date.now() - started < RETRY_IF_FAILED_WITHIN_MS;
      if (!retry) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      image = await callGateway(body, token);
    }
    return { image, mimeType: "image/png", model, costUsd: estimateImageCostUsd(model, size) };
  },
};
