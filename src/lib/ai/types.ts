import type { ZodType } from "zod";
import type { AiEffort } from "@/lib/ai/config";
import type { TokenUsage } from "@/lib/ai/cost";

/**
 * Austauschbare KI-Provider-Schnittstelle. Aktuell implementiert: Anthropic (src/lib/ai/anthropic.ts).
 * Ein weiterer Anbieter muss nur dieses Interface erfüllen.
 */

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

interface BaseOptions {
  system: string;
  /** Einzelne Benutzeranfrage oder ein Verlauf (muss mit einer Benutzernachricht enden) */
  prompt: string | AiMessage[];
  maxTokens: number;
  effort?: AiEffort;
  signal?: AbortSignal;
}

export type GenerateTextOptions = BaseOptions;

export interface GenerateStructuredOptions<T> extends BaseOptions {
  /** Zod-Schema der Ausgabe; wird als JSON-Schema übergeben und die Antwort damit validiert */
  schema: ZodType<T>;
}

export type StreamTextOptions = BaseOptions;

export interface AiCallResult {
  model: string;
  usage: TokenUsage;
  /** Anzahl Versuche (inkl. Wiederholungen) */
  attempts: number;
}

export interface AiTextResult extends AiCallResult {
  text: string;
}

export interface AiStructuredResult<T> extends AiCallResult {
  data: T;
}

/** Ergebnis eines gestreamten Aufrufs: Text-Deltas und abschliessend die Verbrauchsdaten. */
export interface AiTextStream {
  /** Liefert Text-Abschnitte (bereits in Schweizer Rechtschreibung) */
  textStream: AsyncIterable<string>;
  /** Wird nach dem Ende des Streams aufgelöst */
  final: Promise<AiTextResult>;
  abort(): void;
}

export interface AiProvider {
  readonly id: string;
  readonly model: string;
  generateText(options: GenerateTextOptions): Promise<AiTextResult>;
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<AiStructuredResult<T>>;
  streamText(options: StreamTextOptions): Promise<AiTextStream>;
}

/** Fehler in der KI-Ausgabe (ungültiges JSON, Schema verletzt, Ablehnung). */
export class AiOutputError extends Error {
  readonly retryable: boolean;
  /** Bereits verbrauchte Tokens (für die Protokollierung) */
  usage?: TokenUsage;
  model?: string;
  constructor(message: string, retryable = false) {
    super(message);
    this.name = "AiOutputError";
    this.retryable = retryable;
  }
}
