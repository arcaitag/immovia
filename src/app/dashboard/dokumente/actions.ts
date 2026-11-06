"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { flushEmailOutbox } from "@/lib/email/outbox";
import {
  createDocument,
  deleteDocument,
  grantDocumentAccess,
  revokeDocumentAccess,
  updateDocument,
} from "@/services/documents";
import type { DocumentCreateInput, DocumentGrantInput, DocumentUpdateInput } from "@/lib/validation/document";

function revalidateDocuments(paths: string[] = []) {
  revalidatePath("/dashboard/dokumente");
  revalidatePath("/dashboard/interessenten", "layout");
  for (const path of paths) revalidatePath(path);
}

/** Nach dem Browser-Upload nach documents/{propertyId}/{documentId}.{ext}: Datensatz anlegen. */
export async function createDocumentAction(input: DocumentCreateInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const created = await createDocument(input, user);
    revalidateDocuments(created.paths);
    return { id: created.id };
  }, "Dokument hochgeladen.");
}

export async function updateDocumentAction(input: DocumentUpdateInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const { paths } = await updateDocument(input);
    revalidateDocuments(paths);
    return null;
  }, "Dokument gespeichert.");
}

export async function deleteDocumentAction(input: { documentId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const { paths } = await deleteDocument(input);
    revalidateDocuments(paths);
    return null;
  }, "Dokument gelöscht.");
}

export async function grantDocumentAction(input: DocumentGrantInput): Promise<ActionResult<{ grantId: string }>> {
  return runAction(async () => {
    await assertUser();
    const grantId = await grantDocumentAccess(input);
    revalidateDocuments();
    after(() => flushEmailOutbox());
    return { grantId };
  }, "Dokument freigegeben. Die Person wird benachrichtigt.");
}

export async function revokeDocumentAction(input: { grantId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    await revokeDocumentAccess(input);
    revalidateDocuments();
    return null;
  }, "Freigabe widerrufen.");
}
