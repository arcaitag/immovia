"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/session";
import { AppError, fromDbError, runAction, validationError, type ActionResult } from "@/lib/errors";
import type { Json, TablesUpdate } from "@/types/database";
import { criteriaForStorage } from "@/components/saved-searches/criteria-json";
import {
  deleteSavedSearchSchema,
  saveSearchSchema,
  updateSavedSearchSchema,
  type SaveSearchInput,
  type UpdateSavedSearchInput,
} from "@/components/saved-searches/schemas";

const MAX_SAVED_SEARCHES = 25;
const DASHBOARD_PATH = "/dashboard/suchauftraege";

/** Speichert die aktuelle Suche als Suchauftrag des angemeldeten Benutzers. */
export async function saveSearchAction(input: SaveSearchInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await assertUser();
    const parsed = saveSearchSchema.safeParse(input);
    if (!parsed.success) throw validationError(z.flattenError(parsed.error).fieldErrors);
    const criteria = criteriaForStorage(parsed.data.criteria) as Json;

    const supabase = await createClient();
    const { count, error: countError } = await supabase.from("saved_searches").select("id", { count: "exact", head: true });
    if (countError) throw fromDbError(countError);
    if ((count ?? 0) >= MAX_SAVED_SEARCHES) {
      throw new AppError(
        "validation",
        `Sie können höchstens ${MAX_SAVED_SEARCHES} Suchaufträge speichern. Löschen Sie zuerst einen bestehenden Suchauftrag.`,
      );
    }

    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        name: parsed.data.name,
        criteria,
        alert_enabled: parsed.data.alertEnabled,
        alert_frequency: parsed.data.frequency,
      })
      .select("id")
      .single();
    if (error) throw fromDbError(error);
    revalidatePath(DASHBOARD_PATH);
    return { id: data.id };
  }, "Suchauftrag gespeichert.");
}

/** Benennt einen Suchauftrag um oder ändert die Benachrichtigung. RLS stellt sicher, dass nur eigene Einträge betroffen sind. */
export async function updateSavedSearchAction(input: UpdateSavedSearchInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await assertUser();
    const parsed = updateSavedSearchSchema.safeParse(input);
    if (!parsed.success) throw validationError(z.flattenError(parsed.error).fieldErrors);
    const patch: TablesUpdate<"saved_searches"> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.alertEnabled !== undefined) patch.alert_enabled = parsed.data.alertEnabled;
    if (parsed.data.frequency !== undefined) patch.alert_frequency = parsed.data.frequency;
    if (!Object.keys(patch).length) throw new AppError("validation", "Es wurde nichts geändert.");

    const supabase = await createClient();
    const { data, error } = await supabase.from("saved_searches").update(patch).eq("id", parsed.data.id).select("id").maybeSingle();
    if (error) throw fromDbError(error);
    if (!data) throw new AppError("not_found", "Dieser Suchauftrag wurde nicht gefunden.");
    revalidatePath(DASHBOARD_PATH);
    return { id: data.id };
  }, "Änderung gespeichert.");
}

export async function deleteSavedSearchAction(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await assertUser();
    const parsed = deleteSavedSearchSchema.safeParse(input);
    if (!parsed.success) throw validationError(z.flattenError(parsed.error).fieldErrors);
    const supabase = await createClient();
    const { data, error } = await supabase.from("saved_searches").delete().eq("id", parsed.data.id).select("id").maybeSingle();
    if (error) throw fromDbError(error);
    if (!data) throw new AppError("not_found", "Dieser Suchauftrag wurde nicht gefunden.");
    revalidatePath(DASHBOARD_PATH);
    return { id: data.id };
  }, "Suchauftrag gelöscht.");
}
