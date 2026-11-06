import "server-only";

import { z } from "zod";
import type { SessionUser } from "@/lib/auth/session";
import { AppError, fromDbError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Json, TablesUpdate } from "@/types/database";
import { normalizeForCompare } from "@/lib/ai/swiss";
import {
  DESCRIPTION_SECTIONS,
  DESCRIPTION_SECTION_KEYS,
  parseStoredDescription,
  type DescriptionSectionKey,
} from "@/lib/ai/prompts/description";
import { assertAvailable, enforceRateLimit, enqueueAndRun, getFeatureAvailability, requireManagedProperty } from "@/services/ai/access";
import { revalidateProperty } from "@/services/ai/revalidate";

/**
 * KI-Inseratetexte: Aufträge einreihen und Abschnitte ins Inserat übernehmen.
 */

const styleSchema = z.enum(["factual", "modern", "elegant", "emotional", "premium"]);

export const requestDescriptionSchema = z.object({
  propertyId: z.guid(),
  style: styleSchema,
  mode: z.enum(["full", "rephrase"]),
  section: z.enum(DESCRIPTION_SECTION_KEYS).optional(),
  currentText: z.string().max(12000).optional(),
  currentItems: z.array(z.string().max(200)).max(12).optional(),
  baseVersionId: z.guid().optional(),
});

export async function requestDescriptionJob(supabase: ServerSupabaseClient, user: SessionUser, raw: unknown): Promise<{ jobId: string }> {
  const parsed = requestDescriptionSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("validation");
  const input = parsed.data;
  if (input.mode === "rephrase" && !input.section) throw new AppError("validation", "Bitte wählen Sie einen Abschnitt.");
  await requireManagedProperty(supabase, user, input.propertyId);
  assertAvailable(
    await getFeatureAvailability({
      supabase,
      userId: user.id,
      flag: "ai_descriptions",
      quotaFeature: "description",
      requiresAi: true,
      requiresConsent: true,
    }),
  );
  await enforceRateLimit(`ai-description:${user.id}`, 6, 60);
  const { propertyId, ...jobInput } = input;
  const job = await enqueueAndRun({ userId: user.id, type: "description", propertyId, input: jobInput as Json, maxAttempts: 2 });
  return { jobId: job.id };
}

/** Validierung je Abschnitt gemäss Spaltenlimits in listings. */
function sectionValueSchema(section: DescriptionSectionKey) {
  if (section === "highlights") {
    return z.array(z.string().trim().max(120, "Ein Highlight darf höchstens 120 Zeichen lang sein.")).max(12, "Höchstens 12 Highlights.");
  }
  return z.string().trim().max(DESCRIPTION_SECTIONS[section].max, `Höchstens ${DESCRIPTION_SECTIONS[section].max} Zeichen.`);
}

export const applySectionSchema = z.object({
  propertyId: z.guid(),
  descriptionId: z.guid(),
  section: z.enum(DESCRIPTION_SECTION_KEYS),
  value: z.union([z.string(), z.array(z.string())]),
  confirmOverwrite: z.boolean().default(false),
});

function valueKey(value: string | string[]): string {
  return Array.isArray(value) ? value.map((v) => normalizeForCompare(v)).filter(Boolean).join("\n") : normalizeForCompare(value);
}

/** Lädt bzw. erstellt das offene Inserat eines Objekts (Benutzer-Client, RLS). */
async function ensureListing(supabase: ServerSupabaseClient, propertyId: string) {
  const select = "id, slug, title, short_description, description, location_description, equipment_description, highlights, search_summary, texts_confirmed_at";
  const find = () =>
    supabase.from("listings").select(select).eq("property_id", propertyId).is("deleted_at", null).neq("status", "archived").maybeSingle();
  const { data: existing } = await find();
  if (existing) return existing;
  const { data: created, error } = await supabase.from("listings").insert({ property_id: propertyId }).select(select).single();
  if (created) return created;
  if (error?.code === "23505") {
    const { data: again } = await find();
    if (again) return again;
  }
  throw fromDbError(error);
}

export interface ApplyResult {
  applied: boolean;
  needsConfirmation: boolean;
  currentValue?: string | string[];
}

/**
 * Übernimmt einen Abschnitt ins Inserat. Schutz vor Überschreiben: Ist das Inseratfeld
 * nicht leer und entspricht weder einem KI-Text noch dem zuletzt übernommenen Text
 * (= manuell bearbeitet), wird ohne Bestätigung nichts geschrieben.
 * Jede Änderung setzt texts_confirmed_at zurück – die Texte müssen neu bestätigt werden.
 */
export async function applyDescriptionSection(supabase: ServerSupabaseClient, user: SessionUser, raw: unknown): Promise<ApplyResult> {
  const parsed = applySectionSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("validation");
  const { propertyId, descriptionId, section, confirmOverwrite } = parsed.data;
  const valueParsed = sectionValueSchema(section).safeParse(parsed.data.value);
  if (!valueParsed.success) throw new AppError("validation", valueParsed.error.issues[0]?.message);
  const value = valueParsed.data;

  await requireManagedProperty(supabase, user, propertyId);
  const { data: version } = await supabase
    .from("generated_descriptions")
    .select("id, property_id, content")
    .eq("id", descriptionId)
    .maybeSingle();
  if (!version || version.property_id !== propertyId) throw new AppError("not_found", "Die Textversion wurde nicht gefunden.");

  const listing = await ensureListing(supabase, propertyId);
  const column = DESCRIPTION_SECTIONS[section].listingColumn;
  const current = listing[column] as string | string[] | null;
  const currentKey = current === null ? "" : valueKey(current);
  const newKey = valueKey(value);

  if (currentKey && currentKey !== newKey && !confirmOverwrite) {
    // Bekannte KI-Texte und zuletzt übernommene Texte dieses Abschnitts
    const { data: versions } = await supabase
      .from("generated_descriptions")
      .select("content")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(50);
    const known = new Set<string>();
    for (const row of versions ?? []) {
      const content = parseStoredDescription(row.content);
      const raw = content[section];
      if (raw && (Array.isArray(raw) ? raw.length : raw.trim())) known.add(valueKey(raw));
      const applied = content.applied?.[section];
      if (applied) known.add(valueKey(applied.text));
    }
    if (!known.has(currentKey)) {
      return { applied: false, needsConfirmation: true, currentValue: current ?? undefined };
    }
  }

  if (currentKey === newKey) {
    // Unverändert: nichts schreiben, Bestätigung bleibt bestehen
    return { applied: true, needsConfirmation: false };
  }

  const update: TablesUpdate<"listings"> = { texts_confirmed_at: null };
  if (section === "highlights") {
    update.highlights = (value as string[]).map((h) => h.trim()).filter(Boolean).slice(0, 12);
  } else {
    const text = (value as string).trim();
    (update as Record<string, unknown>)[column] = text ? text : null;
  }
  const { error } = await supabase.from("listings").update(update).eq("id", listing.id);
  if (error) throw fromDbError(error);

  const now = new Date().toISOString();
  await supabase.from("generated_descriptions").update({ applied_at: now }).eq("id", descriptionId);
  // Übernommenen Text vermerken (Grundlage für den Überschreibschutz); Berechtigung oben geprüft
  try {
    const admin = createAdminClient();
    const stored = parseStoredDescription(version.content);
    const content = {
      ...(version.content && typeof version.content === "object" && !Array.isArray(version.content) ? version.content : {}),
      applied: { ...(stored.applied ?? {}), [section]: { text: value, at: now } },
    };
    await admin.from("generated_descriptions").update({ content: content as Json }).eq("id", descriptionId);
  } catch (error) {
    console.warn("[ai] Übernahme konnte nicht vermerkt werden", error);
  }

  await revalidateProperty(supabase, propertyId, [`/dashboard/immobilien/${propertyId}/beschreibung`]);
  return { applied: true, needsConfirmation: false };
}

/** Bestätigt die Inseratetexte (Pflicht vor der Veröffentlichung). */
export async function confirmListingTexts(supabase: ServerSupabaseClient, user: SessionUser, propertyId: string): Promise<void> {
  await requireManagedProperty(supabase, user, propertyId);
  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, description")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .maybeSingle();
  if (!listing) throw new AppError("invalid_state", "Es gibt noch kein Inserat. Übernehmen Sie zuerst Titel und Beschreibung.");
  if (!listing.title?.trim() || !listing.description?.trim()) {
    throw new AppError("validation", "Titel und Beschreibung müssen vorhanden sein, bevor Sie die Texte bestätigen.");
  }
  const { error } = await supabase.from("listings").update({ texts_confirmed_at: new Date().toISOString() }).eq("id", listing.id);
  if (error) throw fromDbError(error);
  await revalidateProperty(supabase, propertyId, [`/dashboard/immobilien/${propertyId}/beschreibung`]);
}
