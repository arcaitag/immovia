import "server-only";

import Anthropic, {
  APIConnectionError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import type { ParseableMessageCreateParams } from "@anthropic-ai/sdk";
import type { Message, MessageCreateParamsNonStreaming, MessageParam, OutputConfig } from "@anthropic-ai/sdk/resources/messages";
import { AI_LIMITS, supportsEffort } from "@/lib/ai/config";
import type { TokenUsage } from "@/lib/ai/cost";
import { withRetry } from "@/lib/ai/retry";
import { parseStructuredOutput, toOutputJsonSchema } from "@/lib/ai/schema";
import { toSwissSpelling } from "@/lib/ai/swiss";
import {
  AiOutputError,
  type AiMessage,
  type AiProvider,
  type AiStructuredResult,
  type AiTextResult,
  type AiTextStream,
  type GenerateStructuredOptions,
  type GenerateTextOptions,
  type StreamTextOptions,
} from "@/lib/ai/types";
import { AppError } from "@/lib/errors";

/**
 * Anthropic-Implementierung der KI-Schicht (@anthropic-ai/sdk 1.x).
 * - Strukturierte Ausgaben über output_config.format (JSON-Schema aus Zod) und
 *   anschliessende Zod-Validierung, bei Formatfehlern eine Korrekturrunde.
 * - Keine Sampling-Parameter und kein Prefill (von Claude Sonnet 5.5 nicht unterstützt).
 * - Wiederholungen mit Backoff zentral über withRetry (SDK: maxRetries 0).
 */

const MAX_STRUCTURED_TOKENS = 16_000;

function toMessages(prompt: string | AiMessage[]): MessageParam[] {
  if (typeof prompt === "string") return [{ role: "user", content: prompt }];
  return prompt.map((m) => ({ role: m.role, content: m.content }));
}

function extractText(message: Message): string {
  return message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

function toUsage(message: Message): TokenUsage {
  return {
    inputTokens: message.usage.input_tokens ?? 0,
    outputTokens: message.usage.output_tokens ?? 0,
    cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

function addUsage(total: TokenUsage, usage: TokenUsage): TokenUsage {
  return {
    inputTokens: total.inputTokens + usage.inputTokens,
    outputTokens: total.outputTokens + usage.outputTokens,
    cacheReadInputTokens: (total.cacheReadInputTokens ?? 0) + (usage.cacheReadInputTokens ?? 0),
    cacheCreationInputTokens: (total.cacheCreationInputTokens ?? 0) + (usage.cacheCreationInputTokens ?? 0),
  };
}

const EMPTY_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

/**
 * Übersetzt SDK-Fehler: Konfigurationsfehler werden zu AppError (nicht wiederholen),
 * vorübergehende Fehler bleiben normale Errors (die Job-Warteschlange wiederholt später).
 */
export function mapAnthropicError(error: unknown): unknown {
  if (error instanceof AiOutputError || error instanceof AppError || error instanceof APIUserAbortError) return error;
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return new AppError("service_unavailable", "Der KI-Dienst ist nicht korrekt eingerichtet (API-Schlüssel ungültig oder ohne Berechtigung).");
  }
  if (error instanceof NotFoundError) {
    return new AppError("service_unavailable", "Das konfigurierte KI-Modell ist nicht verfügbar. Bitte ANTHROPIC_MODEL prüfen.");
  }
  if (error instanceof BadRequestError) {
    console.error("[ai] Anfrage abgelehnt", error.message);
    return new AppError("service_unavailable", "Die Anfrage an den KI-Dienst wurde abgelehnt. Bitte versuchen Sie es später erneut.");
  }
  if (error instanceof RateLimitError || error instanceof InternalServerError) {
    return new Error("Der KI-Dienst ist im Moment ausgelastet. Bitte versuchen Sie es in einigen Minuten erneut.");
  }
  if (error instanceof APIConnectionError) {
    return new Error("Der KI-Dienst ist im Moment nicht erreichbar. Bitte versuchen Sie es erneut.");
  }
  return error;
}

export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";
  readonly model: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, model: string) {
    this.model = model;
    this.client = new Anthropic({ apiKey, maxRetries: 0, timeout: AI_LIMITS.requestTimeoutMs });
  }

  private buildParams(
    options: GenerateTextOptions,
    format?: OutputConfig["format"],
    messages?: MessageParam[],
  ): MessageCreateParamsNonStreaming {
    const params: MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: messages ?? toMessages(options.prompt),
    };
    const outputConfig: OutputConfig = {};
    if (options.effort && supportsEffort(this.model)) outputConfig.effort = options.effort;
    if (format) outputConfig.format = format;
    if (outputConfig.effort || outputConfig.format) params.output_config = outputConfig;
    return params;
  }

  private async create(params: MessageCreateParamsNonStreaming, signal?: AbortSignal): Promise<{ message: Message; attempts: number }> {
    let attempts = 0;
    try {
      const message = await withRetry(
        async (attempt) => {
          attempts = attempt;
          return this.client.messages.create(params, { signal, timeout: AI_LIMITS.requestTimeoutMs });
        },
        {
          maxAttempts: AI_LIMITS.maxAttempts,
          signal,
          onRetry: ({ attempt, delayMs }) =>
            console.warn(`[ai] Anthropic-Anfrage fehlgeschlagen (Versuch ${attempt}), neuer Versuch in ${delayMs} ms`),
        },
      );
      return { message, attempts };
    } catch (error) {
      throw mapAnthropicError(error);
    }
  }

  async generateText(options: GenerateTextOptions): Promise<AiTextResult> {
    const { message, attempts } = await this.create(this.buildParams(options), options.signal);
    const usage = toUsage(message);
    if (message.stop_reason === "refusal") {
      throw Object.assign(new AiOutputError("Die KI hat die Anfrage abgelehnt."), { usage, model: message.model });
    }
    const text = toSwissSpelling(extractText(message));
    if (!text) throw Object.assign(new AiOutputError("Die KI hat keinen Text geliefert.", true), { usage, model: message.model });
    return { text, model: message.model, usage, attempts };
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<AiStructuredResult<T>> {
    const format = { type: "json_schema" as const, schema: toOutputJsonSchema(options.schema) };
    const baseMessages = toMessages(options.prompt);
    let params = this.buildParams(options, format, baseMessages);
    let usage = EMPTY_USAGE;
    let attempts = 0;
    let lastError: AiOutputError | null = null;
    let model = this.model;

    for (let round = 1; round <= 2; round++) {
      const result = await this.create(params, options.signal);
      attempts += result.attempts;
      usage = addUsage(usage, toUsage(result.message));
      model = result.message.model;
      const message = result.message;

      if (message.stop_reason === "refusal") {
        throw Object.assign(new AiOutputError("Die KI hat die Anfrage abgelehnt."), { usage, model });
      }
      if (message.stop_reason === "max_tokens") {
        lastError = new AiOutputError("Die KI-Antwort wurde abgeschnitten.", true);
        params = { ...params, max_tokens: Math.min(params.max_tokens * 2, MAX_STRUCTURED_TOKENS) };
        continue;
      }
      const text = extractText(message);
      try {
        const data = parseStructuredOutput(text, options.schema);
        return { data, model, usage, attempts };
      } catch (error) {
        if (!(error instanceof AiOutputError) || !error.retryable) throw error;
        lastError = error;
        // Korrekturrunde: bisherige Antwort und konkreter Hinweis (Verlauf bleibt «append-only»)
        params = this.buildParams(options, format, [
          ...baseMessages,
          { role: "assistant", content: text || "{}" },
          {
            role: "user",
            content: `Ihre Antwort ist ungültig: ${error.message} Liefern Sie die vollständige Antwort erneut, korrigiert und exakt im verlangten JSON-Format. Halten Sie alle Längenvorgaben ein.`,
          },
        ]);
      }
    }
    throw Object.assign(lastError ?? new AiOutputError("Die KI-Antwort war ungültig."), { usage, model });
  }

  async streamText(options: StreamTextOptions): Promise<AiTextStream> {
    const base = this.buildParams(options);
    const params: ParseableMessageCreateParams = {
      model: base.model,
      max_tokens: base.max_tokens,
      system: base.system,
      messages: base.messages,
      ...(base.output_config?.effort ? { output_config: { effort: base.output_config.effort } } : {}),
    };
    let attempts = 0;
    let stream: MessageStream<unknown>;
    try {
      // Wiederholungen nur bis zur Verbindung (vor dem ersten Text), danach nicht mehr
      stream = await withRetry(
        async (attempt) => {
          attempts = attempt;
          const s = this.client.messages.stream(params, { signal: options.signal, timeout: AI_LIMITS.streamTimeoutMs });
          await s.withResponse();
          return s;
        },
        { maxAttempts: 2, signal: options.signal },
      );
    } catch (error) {
      throw mapAnthropicError(error);
    }
    const active = stream;

    const textStream = (async function* () {
      for await (const event of active) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield toSwissSpelling(event.delta.text);
        }
      }
    })();

    const final = active.finalMessage().then((message): AiTextResult => {
      if (message.stop_reason === "refusal") {
        throw Object.assign(new AiOutputError("Die KI hat die Anfrage abgelehnt."), { usage: toUsage(message), model: message.model });
      }
      return { text: toSwissSpelling(extractText(message)), model: message.model, usage: toUsage(message), attempts };
    });
    // Verhindert «unhandled rejection», falls der Aufrufer final nicht abwartet
    final.catch(() => undefined);

    return { textStream, final, abort: () => active.abort() };
  }
}
