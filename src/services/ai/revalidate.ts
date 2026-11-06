import "server-only";

import { revalidatePath } from "next/cache";
import { revalidatePropertyViews } from "@/lib/properties/revalidate";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Aktualisiert nach Änderungen die Ansichten des Verkäuferbereichs (revalidatePropertyViews:
 * Dashboard, alle Schritte über das [id]-Layout, öffentliche Inseratseite) sowie zusätzliche
 * Pfade aus dem KI-Bereich (z. B. Bilderstudio, Dossier-Übersicht).
 */
export async function revalidateProperty(supabase: ServerSupabaseClient, propertyId: string, extra: string[] = []): Promise<void> {
  for (const path of extra) revalidatePath(path);
  const { data } = await supabase
    .from("listings")
    .select("slug")
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .maybeSingle();
  revalidatePropertyViews({ publicSlugs: [data?.slug] });
}
