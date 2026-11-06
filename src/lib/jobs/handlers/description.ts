import "server-only";

import { z } from "zod";
import type { Json } from "@/types/database";
import { aiGenerateStructured } from "@/lib/ai/service";
import {
  DESCRIPTION_SECTION_KEYS,
  DESCRIPTION_SYSTEM_PROMPT,
  buildDescriptionPrompt,
  buildRephrasePrompt,
  descriptionOutputSchema,
  parseStoredDescription,
  rephraseHighlightsSchema,
  rephraseTextSchema,
} from "@/lib/ai/prompts/description";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { loadAiSettings } from "@/services/ai/settings";
import { loadPropertyContext } from "@/services/ai/property-data";

/**
 * Job «description»: KI-Inseratetexte erstellen (mode full) oder einen Abschnitt neu
 * formulieren (mode rephrase). Ergebnis als neue Version in generated_descriptions.
 */

export const descriptionJobInputSchema = z.object({
  mode: z.enum(["full", "rephrase"]),
  style: z.enum(["factual", "modern", "elegant", "emotional", "premium"]),
  section: z.enum(DESCRIPTION_SECTION_KEYS).optional(),
  currentText: z.string().max(12000).optional(),
  currentItems: z.array(z.string().max(200)).max(12).optional(),
  baseVersionId: z.guid().optional(),
});
export type DescriptionJobInput = z.infer<typeof descriptionJobInputSchema>;

export const descriptionJobHandler: JobHandler = async ({ job, admin }) => {
  const parsed = descriptionJobInputSchema.safeParse(job.input);
  if (!parsed.success || !job.property_id) throw new PermanentJobError("Ungültiger Auftrag für die Texterstellung.");
  const input = parsed.data;

  // Admin-Schalter auch zur Laufzeit beachten (Einwilligung prüft aiGenerateStructured vor dem Aufruf)
  const settings = await loadAiSettings();
  if (!settings.features.ai_descriptions) throw new PermanentJobError("Die KI-Texterstellung ist derzeit deaktiviert.");

  const context = await loadPropertyContext(admin, job.property_id);
  if (!context) throw new PermanentJobError("Die Immobilie wurde nicht gefunden.");
  const factsInput = { property: context.property, featureKeys: context.featureKeys, renovations: context.renovations };

  const { data: listing } = await admin
    .from("listings")
    .select("id")
    .eq("property_id", job.property_id)
    .is("deleted_at", null)
    .neq("status", "archived")
    .maybeSingle();

  const meta = { feature: "description" as const, userId: job.user_id, jobId: job.id };
  let content: Record<string, unknown>;
  let model: string;
  let resultValue: string | string[] | null = null;

  if (input.mode === "full") {
    const result = await aiGenerateStructured(meta, {
      system: DESCRIPTION_SYSTEM_PROMPT,
      prompt: buildDescriptionPrompt(factsInput, input.style),
      schema: descriptionOutputSchema,
      maxTokens: 8000,
      effort: "medium",
    });
    content = { ...result.data };
    model = result.model;
  } else {
    const section = input.section;
    if (!section) throw new PermanentJobError("Kein Abschnitt zum Neuformulieren angegeben.");
    let base: Record<string, unknown> = {};
    if (input.baseVersionId) {
      const { data: baseRow } = await admin
        .from("generated_descriptions")
        .select("content, property_id")
        .eq("id", input.baseVersionId)
        .maybeSingle();
      if (baseRow && baseRow.property_id === job.property_id) {
        const { applied: _applied, ...rest } = parseStoredDescription(baseRow.content);
        base = rest;
      }
    }
    const currentText = section === "highlights" ? (input.currentItems ?? []).join("\n") : (input.currentText ?? "");
    const prompt = buildRephrasePrompt(factsInput, input.style, section, currentText);
    if (section === "highlights") {
      const result = await aiGenerateStructured(meta, {
        system: DESCRIPTION_SYSTEM_PROMPT,
        prompt,
        schema: rephraseHighlightsSchema,
        maxTokens: 3000,
        effort: "low",
      });
      resultValue = result.data.items;
      model = result.model;
    } else {
      const result = await aiGenerateStructured(meta, {
        system: DESCRIPTION_SYSTEM_PROMPT,
        prompt,
        schema: rephraseTextSchema,
        maxTokens: 5000,
        effort: "low",
      });
      const limit = section === "title" ? 140 : section === "searchSummary" ? 300 : section === "shortDescription" ? 400 : 6000;
      resultValue = result.data.text.slice(0, limit);
      model = result.model;
    }
    content = { ...base, [section]: resultValue, rephrasedSection: section, ...(input.baseVersionId ? { baseVersionId: input.baseVersionId } : {}) };
  }

  const { data: row, error } = await admin
    .from("generated_descriptions")
    .insert({
      property_id: job.property_id,
      listing_id: listing?.id ?? null,
      user_id: job.user_id,
      style: input.style,
      content: content as Json,
      model,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(`Texte konnten nicht gespeichert werden: ${error?.message ?? "unbekannt"}`);

  return { descriptionId: row.id, mode: input.mode, section: input.section ?? null, value: resultValue } as Json;
};
