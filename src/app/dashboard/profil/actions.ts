"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { flushEmailOutbox } from "@/lib/email/outbox";
import { runAction, validationError, type ActionResult } from "@/lib/errors";
import { publicStorageUrl } from "@/lib/storage";
import { emailChangeSchema, passwordChangeSchema, profileSchema } from "@/lib/validation/account";
import { changePassword, removeAvatar, requestEmailChange, updateProfile, uploadAvatar } from "@/services/account";

export async function updateProfileAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await updateProfile(user.id, parsed.data);
    revalidatePath("/dashboard", "layout");
    return null;
  }, "Ihr Profil wurde gespeichert.");
}

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult<{ avatarUrl: string | null }>> {
  return runAction(async () => {
    const user = await assertUser();
    const path = await uploadAvatar(user.id, formData.get("file"));
    revalidatePath("/dashboard", "layout");
    return { avatarUrl: publicStorageUrl("avatars", path) };
  }, "Ihr Profilbild wurde aktualisiert.");
}

export async function removeAvatarAction(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    await removeAvatar(user.id);
    revalidatePath("/dashboard", "layout");
    return null;
  }, "Ihr Profilbild wurde entfernt.");
}

export async function requestEmailChangeAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = emailChangeSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await requestEmailChange(user, parsed.data.email);
    revalidatePath("/dashboard/profil");
    return { email: parsed.data.email };
  }, "Bitte bestätigen Sie die Änderung über die Links in Ihren E-Mails.");
}

export async function changePasswordAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = passwordChangeSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await changePassword(user, parsed.data.currentPassword, parsed.data.newPassword);
    // Bestätigungs-E-Mail «Passwort geändert» (Trigger auf auth.users) versenden
    after(() => flushEmailOutbox());
    return null;
  }, "Ihr Passwort wurde geändert.");
}
