import { applyDescriptionSection } from "@/services/ai/descriptions";
import { readJson, withSession } from "../../valuation/_lib";

export const runtime = "nodejs";

/**
 * Mobile App: einen Abschnitt ins Inserat übernehmen – derselbe Dienst wie die Server Action der
 * Website (Schutz vor dem Überschreiben eigener Texte, texts_confirmed_at wird zurückgesetzt).
 * Body: applySectionSchema ({ propertyId, descriptionId, section, value, confirmOverwrite? }).
 * Antwort: { applied, needsConfirmation, currentValue? }.
 */
export async function POST(request: Request) {
  return withSession(request, async ({ supabase, user }) => applyDescriptionSection(supabase, user, await readJson(request)));
}
