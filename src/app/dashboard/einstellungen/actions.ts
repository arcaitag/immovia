"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { AppError, runAction, validationError, type ActionResult } from "@/lib/errors";
import { deleteAccountSchema, notificationSettingsSchema, preferencesSchema } from "@/lib/validation/account";
import { deleteAccount, updateNotificationSettings, updatePreferences } from "@/services/account";

/**
 * Einstellungen, Einwilligungen und Kontolöschung sind bewusst auch für gesperrte
 * Konten möglich (Abmelden von E-Mails, Widerruf von Einwilligungen, Recht auf Löschung).
 */
async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError("not_authenticated");
  return user;
}

export async function updateNotificationSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireSession();
    const parsed = notificationSettingsSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await updateNotificationSettings(user.id, parsed.data);
    revalidatePath("/dashboard/einstellungen");
    return null;
  }, "Ihre Benachrichtigungen wurden gespeichert.");
}

export async function updatePreferencesAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireSession();
    const parsed = preferencesSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await updatePreferences(user.id, parsed.data);
    revalidatePath("/dashboard/einstellungen");
    return null;
  }, "Ihre Datenschutzeinstellungen wurden gespeichert.");
}

export async function deleteAccountAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await requireSession();
    const parsed = deleteAccountSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await deleteAccount(user.id);
    // Kein revalidatePath: Die aktuelle Dashboard-Seite würde sonst ohne Sitzung neu gerendert
    // und zum Login umleiten. Der Client navigiert selbst zur Startseite.
    return null;
  }, "Ihr Konto wurde gelöscht.");
}
