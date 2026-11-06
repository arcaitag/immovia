import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deepSwissSpelling, normalizeForCompare, toSwissSpelling } from "@/lib/ai/swiss";
import { parseStructuredOutput, toOutputJsonSchema } from "@/lib/ai/schema";
import { AiOutputError } from "@/lib/ai/types";
import { descriptionOutputSchema } from "@/lib/ai/prompts/description";

describe("Schweizer Rechtschreibung", () => {
  it("ersetzt ß durch ss und ẞ durch SS", () => {
    expect(toSwissSpelling("Die Straße ist groß, das Maß stimmt.")).toBe("Die Strasse ist gross, das Mass stimmt.");
    expect(toSwissSpelling("GROẞ")).toBe("GROSS");
    expect(toSwissSpelling("")).toBe("");
  });

  it("wirkt rekursiv auf Objekte und Arrays", () => {
    const result = deepSwissSpelling({ title: "Großzügig", highlights: ["Gemäß Plan", "Fußbodenheizung"], nested: { a: "weiß" }, n: 3 });
    expect(result).toEqual({ title: "Grosszügig", highlights: ["Gemäss Plan", "Fussbodenheizung"], nested: { a: "weiss" }, n: 3 });
  });

  it("normalisiert für Vergleiche", () => {
    expect(normalizeForCompare("  Groß  \r\n\r\n\r\nText ")).toBe("Gross \n\nText");
    expect(normalizeForCompare(null)).toBe("");
  });
});

describe("Strukturierte KI-Ausgaben", () => {
  const schema = z.object({ title: z.string().max(20), items: z.array(z.string()).max(2) });

  it("erzeugt ein JSON-Schema ohne $schema und mit additionalProperties: false", () => {
    const json = toOutputJsonSchema(descriptionOutputSchema);
    expect(json.$schema).toBeUndefined();
    expect(json.type).toBe("object");
    expect(json.additionalProperties).toBe(false);
    const props = json.properties as Record<string, Record<string, unknown>>;
    // Nicht unterstützte Längenangaben stehen in der Beschreibung
    expect(String(props.title?.description)).toContain("maxLength");
    expect(props.title?.maxLength).toBeUndefined();
  });

  it("parst, wendet ß→ss an und validiert", () => {
    expect(parseStructuredOutput('{"title":"Große Wohnung","items":["a"]}', schema)).toEqual({ title: "Grosse Wohnung", items: ["a"] });
    expect(parseStructuredOutput('```json\n{"title":"X","items":[]}\n```', schema)).toEqual({ title: "X", items: [] });
  });

  it("meldet ungültiges JSON und Schemaverletzungen als wiederholbaren Fehler", () => {
    expect(() => parseStructuredOutput("kein json", schema)).toThrow(AiOutputError);
    try {
      parseStructuredOutput('{"title":"Viel zu langer Titel für das Schema","items":["a","b","c"]}', schema);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AiOutputError);
      expect((error as AiOutputError).retryable).toBe(true);
      expect((error as AiOutputError).message).toContain("title");
    }
  });
});
