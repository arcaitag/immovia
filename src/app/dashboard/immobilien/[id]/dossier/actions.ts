"use server";

import { assertUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { deleteDossierVersion, requestDossierJob, setDossierPublic, setListingDossierPublic } from "@/services/ai/dossiers";

/** «Dossier erstellen»: PDF als Hintergrundauftrag (neue Version). */
export async function createDossierAction(propertyId: string, options: unknown): Promise<ActionResult<{ jobId: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    return requestDossierJob(supabase, user, propertyId, options);
  });
}

/** Genau eine Version für das Inserat freigeben bzw. die Freigabe aufheben. */
export async function setDossierPublicAction(dossierId: string, isPublic: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    await setDossierPublic(supabase, user, dossierId, isPublic);
    return null;
  }, isPublic ? "Diese Version ist für das Inserat freigegeben." : "Die Freigabe ist aufgehoben.");
}

/** Schalter im Inserat: Dossier auf der Inseratseite zum Download anbieten. */
export async function setListingDossierPublicAction(propertyId: string, value: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    await setListingDossierPublic(supabase, user, propertyId, value);
    return null;
  }, value ? "Das Dossier wird im Inserat angeboten." : "Das Dossier wird im Inserat nicht mehr angeboten.");
}

export async function deleteDossierVersionAction(dossierId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const supabase = await createClient();
    await deleteDossierVersion(supabase, user, dossierId);
    return null;
  }, "Die Version wurde gelöscht.");
}
