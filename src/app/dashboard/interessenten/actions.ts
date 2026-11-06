"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { createLeadNote, deleteLeadNote, updateLead, updateLeadNote, type LeadNote } from "@/services/leads";
import type { LeadUpdateInput } from "@/lib/validation/lead";

function revalidateLead(leadId: string, conversationId?: string | null) {
  revalidatePath("/dashboard/interessenten");
  revalidatePath(`/dashboard/interessenten/${leadId}`);
  if (conversationId) revalidatePath(`/dashboard/nachrichten/${conversationId}`);
}

/** Status und/oder Bewertung eines Interessenten ändern (auch aus dem Chat). */
export async function updateLeadAction(input: LeadUpdateInput): Promise<ActionResult<null>> {
  return runAction(
    async () => {
      await assertUser();
      const lead = await updateLead(input);
      revalidateLead(lead.id, lead.conversationId);
      return null;
    },
    input.status !== undefined ? "Status gespeichert." : "Bewertung gespeichert.",
  );
}

export async function createLeadNoteAction(input: { leadId: string; body: string }): Promise<ActionResult<LeadNote>> {
  return runAction(async () => {
    await assertUser();
    const note = await createLeadNote(input);
    revalidateLead(input.leadId);
    return note;
  }, "Notiz gespeichert.");
}

export async function updateLeadNoteAction(input: { noteId: string; body: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const leadId = await updateLeadNote(input);
    revalidateLead(leadId);
    return null;
  }, "Notiz aktualisiert.");
}

export async function deleteLeadNoteAction(input: { noteId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const leadId = await deleteLeadNote(input);
    revalidateLead(leadId);
    return null;
  }, "Notiz gelöscht.");
}
