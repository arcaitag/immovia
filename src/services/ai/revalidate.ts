import "server-only";

import { revalidatePath } from "next/cache";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/** Revalidiert Dashboard-Seiten eines Objekts und – falls veröffentlicht – die öffentliche Inseratseite. */
export async function revalidateProperty(supabase: ServerSupabaseClient, propertyId: string, extra: string[] = []): Promise<void> {
  revalidatePath(`/dashboard/immobilien/${propertyId}`, "layout");
  for (const path of extra) revalidatePath(path);
  const { data } = await supabase
    .from("listings")
    .select("slug, status")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .maybeSingle();
  if (data?.slug) revalidatePath(`/immobilien/${data.slug}`);
}
