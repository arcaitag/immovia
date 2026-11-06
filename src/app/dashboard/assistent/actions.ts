"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth/session";
import { AppError, fromDbError, runAction, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

/** Löscht eine eigene Unterhaltung samt Nachrichten (RLS: nur eigene Unterhaltungen). */
export async function deleteThreadAction(threadId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (!z.guid().safeParse(threadId).success) throw new AppError("not_found");
    await assertUser();
    const supabase = await createClient();
    const { data, error } = await supabase.from("assistant_threads").delete().eq("id", threadId).select("id");
    if (error) throw fromDbError(error);
    if (!data?.length) throw new AppError("not_found", "Die Unterhaltung wurde nicht gefunden.");
    revalidatePath("/dashboard/assistent", "layout");
    return null;
  }, "Die Unterhaltung wurde gelöscht.");
}
