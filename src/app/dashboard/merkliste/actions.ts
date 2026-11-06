"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/session";
import { fromDbError, runAction, validationError, type ActionResult } from "@/lib/errors";

const removeSchema = z.object({ listingIds: z.array(z.uuid("Ungültiges Inserat.")).min(1).max(200) });

/** Entfernt Inserate von der eigenen Merkliste (auch nicht mehr verfügbare). */
export async function removeFavoritesAction(input: { listingIds: string[] }): Promise<ActionResult<{ removed: number }>> {
  return runAction(async () => {
    await assertUser();
    const parsed = removeSchema.safeParse(input);
    if (!parsed.success) throw validationError(z.flattenError(parsed.error).fieldErrors);
    const supabase = await createClient();
    const { data, error } = await supabase.from("favorites").delete().in("listing_id", parsed.data.listingIds).select("listing_id");
    if (error) throw fromDbError(error);
    revalidatePath("/dashboard/merkliste");
    return { removed: data?.length ?? 0 };
  }, "Von der Merkliste entfernt.");
}
