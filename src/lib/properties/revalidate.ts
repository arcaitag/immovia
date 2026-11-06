import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Invalidiert die vom Verkäuferbereich betroffenen Seiten.
 * - Dashboard-Seiten (alle Schritte einer Immobilie über das [id]-Layout)
 * - die öffentliche Inseratseite, solange das Inserat öffentlich ist bzw. war
 * - Startseite und Suche, wenn sich die öffentliche Sichtbarkeit geändert hat
 */
export function revalidatePropertyViews(options: { publicSlugs?: (string | null | undefined)[]; visibilityChanged?: boolean } = {}): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/immobilien");
  revalidatePath("/dashboard/immobilien/[id]", "layout");
  revalidatePath("/dashboard/statistiken");
  for (const slug of options.publicSlugs ?? []) {
    if (slug) revalidatePath(`/immobilien/${slug}`);
  }
  if (options.visibilityChanged) {
    revalidatePath("/");
    revalidatePath("/immobilien");
    revalidatePath("/kaufen");
    revalidatePath("/mieten");
  }
}
