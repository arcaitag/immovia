"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { runAction, type ActionResult } from "@/lib/errors";
import { flushEmailOutbox } from "@/lib/email/outbox";
import {
  addAppointmentNote,
  bookViewing,
  cancelSlot,
  createSlots,
  deleteAppointmentNote,
  deleteSlot,
  moveAppointment,
  updateAppointmentStatus,
  type AppointmentNote,
} from "@/services/viewings";
import type { AppointmentAction, SlotFormInput } from "@/lib/validation/viewing";
import type { AppointmentStatus } from "@/lib/constants";

function revalidateViewings() {
  revalidatePath("/dashboard/besichtigungen");
  revalidatePath("/dashboard/interessenten", "layout");
  revalidatePath("/dashboard/nachrichten", "layout");
}

export async function createSlotsAction(input: SlotFormInput): Promise<ActionResult<{ count: number }>> {
  const result = await runAction(async () => {
    await assertUser();
    const created = await createSlots(input);
    revalidatePath("/dashboard/besichtigungen");
    if (created.slug) revalidatePath(`/immobilien/${created.slug}`);
    return { count: created.count };
  });
  if (result.ok) {
    return { ...result, message: result.data.count === 1 ? "Zeitfenster angelegt." : `${result.data.count} Zeitfenster angelegt.` };
  }
  return result;
}

export async function cancelSlotAction(input: { slotId: string; reason?: string }): Promise<ActionResult<{ cancelled: number }>> {
  const result = await runAction(async () => {
    await assertUser();
    const cancelled = await cancelSlot(input);
    revalidateViewings();
    after(() => flushEmailOutbox());
    return { cancelled };
  });
  if (result.ok) {
    const n = result.data.cancelled;
    return { ...result, message: n ? `Zeitfenster abgesagt. ${n === 1 ? "Ein Termin wurde" : `${n} Termine wurden`} benachrichtigt.` : "Zeitfenster abgesagt." };
  }
  return result;
}

export async function deleteSlotAction(input: { slotId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    await deleteSlot(input);
    revalidatePath("/dashboard/besichtigungen");
    return null;
  }, "Zeitfenster gelöscht.");
}

const ACTION_MESSAGES: Record<AppointmentAction, string> = {
  confirm: "Termin bestätigt. Die Person wird benachrichtigt.",
  cancel: "Termin abgesagt. Die andere Seite wird benachrichtigt.",
  complete: "Als durchgeführt markiert.",
  no_show: "Als nicht erschienen markiert.",
  request_reschedule: "Änderung angefragt. Die Verkäuferseite wird benachrichtigt.",
};

export async function appointmentAction(input: {
  appointmentId: string;
  action: AppointmentAction;
  reason?: string;
}): Promise<ActionResult<{ status: AppointmentStatus }>> {
  const result = await runAction(async () => {
    await assertUser();
    const status = await updateAppointmentStatus(input);
    revalidateViewings();
    after(() => flushEmailOutbox());
    return { status };
  });
  return result.ok ? { ...result, message: ACTION_MESSAGES[input.action] } : result;
}

export async function moveAppointmentAction(input: { appointmentId: string; slotId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    await moveAppointment(input);
    revalidateViewings();
    after(() => flushEmailOutbox());
    return null;
  }, "Termin verschoben und bestätigt. Die Person wird benachrichtigt.");
}

export async function addAppointmentNoteAction(input: { appointmentId: string; body: string }): Promise<ActionResult<AppointmentNote>> {
  return runAction(async () => {
    await assertUser();
    const note = await addAppointmentNote(input);
    revalidatePath("/dashboard/besichtigungen");
    return note;
  }, "Notiz gespeichert.");
}

export async function deleteAppointmentNoteAction(input: { noteId: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    await deleteAppointmentNote(input);
    revalidatePath("/dashboard/besichtigungen");
    return null;
  }, "Notiz gelöscht.");
}

/** Besichtigung anfragen (Interessent). Auch für die Inseratseite verwendbar. */
export async function bookViewingAction(input: { slotId: string; message?: string }): Promise<ActionResult<{ appointmentId: string }>> {
  return runAction(async () => {
    await assertUser();
    const appointmentId = await bookViewing(input);
    revalidateViewings();
    after(() => flushEmailOutbox());
    return { appointmentId };
  }, "Besichtigung angefragt. Sie werden benachrichtigt, sobald der Termin bestätigt ist.");
}
