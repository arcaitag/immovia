import { z } from "zod";
import { AppError } from "@/lib/errors";
import { deleteDossierVersion, setDossierPublic } from "@/services/ai/dossiers";
import { readJson, withSession } from "../../valuation/_lib";

export const runtime = "nodejs";

const bodySchema = z.object({ isPublic: z.boolean() });

/**
 * Mobile App: genau eine Version für das Inserat freigeben bzw. die Freigabe aufheben
 * (derselbe Dienst wie die Website – höchstens eine freigegebene Version).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params;
  return withSession(request, async ({ supabase, user }) => {
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError("validation", "Ungültige Anfrage.");
    await setDossierPublic(supabase, user, dossierId, parsed.data.isPublic);
    return { ok: true, message: parsed.data.isPublic ? "Diese Version ist für das Inserat freigegeben." : "Die Freigabe ist aufgehoben." };
  });
}

/** Mobile App: Version löschen (Datensatz und PDF-Datei; laufende Erstellungen nicht). */
export async function DELETE(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params;
  return withSession(request, async ({ supabase, user }) => {
    await deleteDossierVersion(supabase, user, dossierId);
    return { ok: true, message: "Die Version wurde gelöscht." };
  });
}
