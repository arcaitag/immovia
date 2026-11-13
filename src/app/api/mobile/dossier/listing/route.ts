import { z } from "zod";
import { AppError } from "@/lib/errors";
import { setListingDossierPublic } from "@/services/ai/dossiers";
import { readJson, withSession } from "../../valuation/_lib";

export const runtime = "nodejs";

const bodySchema = z.object({ propertyId: z.guid(), value: z.boolean() });

/** Mobile App: Schalter «Dossier im Inserat zum Download anbieten» (derselbe Dienst wie die Website). */
export async function POST(request: Request) {
  return withSession(request, async ({ supabase, user }) => {
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation", "Ungültige Anfrage.");
    await setListingDossierPublic(supabase, user, parsed.data.propertyId, parsed.data.value);
    return { ok: true, message: parsed.data.value ? "Das Dossier wird im Inserat angeboten." : "Das Dossier wird im Inserat nicht mehr angeboten." };
  });
}
