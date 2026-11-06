"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertUser } from "@/lib/auth/session";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { invitationTokenSchema } from "@/lib/validation/organization";
import { acceptInvitation } from "@/services/organizations";

export async function acceptInvitationAction(token: unknown): Promise<ActionResult<{ organizationId: string }>> {
  return runAction(async () => {
    await assertUser();
    const parsed = invitationTokenSchema.safeParse(token);
    if (!parsed.success) throw new AppError("not_found", "Diese Einladung ist ungültig oder abgelaufen.");
    const organizationId = await acceptInvitation(parsed.data);
    revalidatePath("/dashboard", "layout");
    return { organizationId };
  }, "Willkommen im Firmenkonto!");
}

/** Abmelden und mit einem anderen Konto anmelden; danach zurück zur Einladung. */
export async function switchAccountAction(token: unknown): Promise<void> {
  const parsed = invitationTokenSchema.safeParse(token);
  const supabase = await createClient();
  await supabase.auth.signOut();
  const back = parsed.success ? `/einladung/${parsed.data}` : "/dashboard/firma";
  redirect(`/login?weiter=${encodeURIComponent(back)}`);
}
