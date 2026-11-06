import { z, type ZodType } from "zod";
import { transformJSONSchema } from "@anthropic-ai/sdk/lib/transform-json-schema";
import { deepSwissSpelling } from "@/lib/ai/swiss";
import { AiOutputError } from "@/lib/ai/types";

/**
 * Wandelt ein Zod-Schema in ein JSON-Schema für strukturierte Ausgaben (output_config.format).
 * Nicht unterstützte Einschränkungen (z. B. maxLength) verschiebt das SDK in die Beschreibung;
 * eingehalten werden sie durch die anschliessende Zod-Validierung.
 */
export function toOutputJsonSchema(schema: ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }) as Record<string, unknown>;
  delete json.$schema;
  return transformJSONSchema(json) as Record<string, unknown>;
}

function stripCodeFence(text: string): string {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  return match?.[1] ?? text;
}

/**
 * Parst die Modellantwort, wendet die Schweizer Rechtschreibung an und validiert mit Zod.
 * Wirft AiOutputError (wiederholbar), wenn JSON oder Schema nicht passen.
 */
export function parseStructuredOutput<T>(text: string, schema: ZodType<T>): T {
  const cleaned = stripCodeFence(text.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiOutputError("Die KI-Antwort war kein gültiges JSON.", true);
  }
  const result = schema.safeParse(deepSwissSpelling(parsed));
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "Antwort"}: ${issue.message}`)
      .join("; ");
    throw new AiOutputError(`Die KI-Antwort entsprach nicht dem erwarteten Format (${issues}).`, true);
  }
  return result.data;
}
