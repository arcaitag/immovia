"use server";

import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fromDbError, runAction, validationError, type ActionResult } from "@/lib/errors";
import {
  notificationDeleteSchema,
  notificationReadSchema,
  type NotificationDeleteInput,
  type NotificationReadInput,
} from "@/lib/validation/message";

/** Gelesen/ungelesen markieren (einzeln oder alle). RLS: nur eigene Benachrichtigungen. */
export async function markNotificationsAction(input: NotificationReadInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const parsed = notificationReadSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const supabase = await createClient();
    let query = supabase.from("notifications").update({ read_at: parsed.data.read ? new Date().toISOString() : null });
    if (parsed.data.all) {
      query = parsed.data.read ? query.is("read_at", null) : query.not("read_at", "is", null);
    } else {
      query = query.in("id", parsed.data.ids ?? []);
    }
    const { error } = await query;
    if (error) throw fromDbError(error);
    revalidatePath("/dashboard/benachrichtigungen");
    return null;
  });
}

export async function deleteNotificationsAction(input: NotificationDeleteInput): Promise<ActionResult<null>> {
  return runAction(
    async () => {
      await assertUser();
      const parsed = notificationDeleteSchema.safeParse(input);
      if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
      const supabase = await createClient();
      const query = parsed.data.allRead
        ? supabase.from("notifications").delete().not("read_at", "is", null)
        : supabase.from("notifications").delete().in("id", parsed.data.ids ?? []);
      const { error } = await query;
      if (error) throw fromDbError(error);
      revalidatePath("/dashboard/benachrichtigungen");
      return null;
    },
    input.allRead ? "Gelesene Benachrichtigungen gelöscht." : "Benachrichtigung gelöscht.",
  );
}
