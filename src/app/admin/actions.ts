"use server";

import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { assertAdmin, assertModerator } from "@/lib/auth/session";
import { flushEmailOutbox } from "@/lib/email/outbox";
import { AppError, runAction, validationError, type ActionResult } from "@/lib/errors";
import { PLATFORM_SETTINGS_TAG } from "@/lib/settings";
import { isUuid } from "@/lib/utils";
import type { Json } from "@/types/database";
import {
  contactStatusInputSchema,
  moderateListingInputSchema,
  orgStatusInputSchema,
  reportUpdateInputSchema,
  roleInputSchema,
  settingInputSchemas,
  settingKeySchema,
  userStatusInputSchema,
  verificationInputSchema,
} from "@/lib/validation/admin";
import {
  getReportTarget,
  moderateListing,
  setOrganizationStatus,
  setUserRole,
  setUserStatus,
  setVerification,
  updateContactRequest,
  updateReport,
  updateSetting,
  type ReportTarget,
} from "@/services/admin";

/**
 * Admin-Aktionen. Jede Aktion prüft die Rolle serverseitig (assertAdmin bzw.
 * assertModerator); die admin_*-Funktionen prüfen erneut und schreiben das Audit-Log.
 */

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

function revalidatePublicListings(slug?: string | null) {
  revalidatePath("/immobilien", "layout");
  revalidatePath("/");
  if (slug) revalidatePath(`/immobilien/${slug}`);
}

export async function setUserStatusAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertAdmin();
    const parsed = userStatusInputSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await setUserStatus(parsed.data);
    revalidateAdmin();
    // Beim Sperren werden veröffentlichte Inserate pausiert
    if (parsed.data.status === "suspended") revalidatePublicListings();
    return null;
  }, "Der Benutzerstatus wurde geändert.");
}

export async function setUserRoleAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertAdmin();
    const parsed = roleInputSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await setUserRole(parsed.data);
    revalidateAdmin();
    return null;
  }, "Die Rolle wurde geändert.");
}

export async function setVerificationAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertAdmin();
    const parsed = verificationInputSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await setVerification(parsed.data);
    revalidateAdmin();
    if (parsed.data.subjectType === "property") revalidatePublicListings();
    return null;
  }, "Die Verifizierung wurde gespeichert.");
}

export async function moderateListingAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertModerator();
    const parsed = moderateListingInputSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const { slug } = await moderateListing(parsed.data);
    // Benachrichtigungs-E-Mails an die Eigentümer (Sperre, Zurückweisung)
    after(() => flushEmailOutbox());
    revalidateAdmin();
    revalidatePublicListings(slug);
    return null;
  }, "Das Inserat wurde aktualisiert.");
}

export async function setOrganizationStatusAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertAdmin();
    const parsed = orgStatusInputSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const { slug } = await setOrganizationStatus(parsed.data);
    revalidateAdmin();
    if (slug) revalidatePath(`/firmen/${slug}`);
    return null;
  }, "Der Firmenstatus wurde geändert.");
}

export async function getReportTargetAction(reportId: unknown): Promise<ActionResult<ReportTarget>> {
  return runAction(async () => {
    await assertModerator();
    if (!isUuid(reportId)) throw new AppError("validation");
    return getReportTarget(reportId);
  });
}

export async function updateReportAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertModerator();
    const parsed = reportUpdateInputSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await updateReport(parsed.data);
    revalidateAdmin();
    return null;
  }, "Die Meldung wurde aktualisiert.");
}

export async function updateContactRequestAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertModerator();
    const parsed = contactStatusInputSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await updateContactRequest(parsed.data);
    revalidateAdmin();
    return null;
  }, "Der Status wurde geändert.");
}

export async function updateSettingAction(input: { key: unknown; value: unknown }): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertAdmin();
    const key = settingKeySchema.safeParse(input?.key);
    if (!key.success) throw new AppError("validation", "Unbekannte Einstellung.");
    const parsed = settingInputSchemas[key.data].safeParse(input?.value);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await updateSetting(key.data, parsed.data as unknown as Json);
    updateTag(PLATFORM_SETTINGS_TAG);
    // Wartungshinweis und Vorgaben wirken auf allen Seiten
    revalidatePath("/", "layout");
    return null;
  }, "Die Einstellung wurde gespeichert.");
}
