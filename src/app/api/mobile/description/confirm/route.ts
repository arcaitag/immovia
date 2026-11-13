import { z } from "zod";
import { AppError } from "@/lib/errors";
import { confirmListingTexts } from "@/services/ai/descriptions";
import { readJson, withSession } from "../../valuation/_lib";

export const runtime = "nodejs";

const bodySchema = z.object({ propertyId: z.guid() });

/** Mobile App: Inseratetexte bestätigen (Voraussetzung für die Veröffentlichung). */
export async function POST(request: Request) {
  return withSession(request, async ({ supabase, user }) => {
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation", "Ungültige Anfrage.");
    await confirmListingTexts(supabase, user, parsed.data.propertyId);
    return { ok: true, message: "Die Texte sind bestätigt." };
  });
}
