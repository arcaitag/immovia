"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { flushEmailOutbox } from "@/lib/email/outbox";
import { AppError, runAction, validationError, type ActionResult } from "@/lib/errors";
import { getPlatformSettings } from "@/lib/settings";
import { publicStorageUrl } from "@/lib/storage";
import {
  createOrganizationSchema,
  invitationRefSchema,
  inviteMemberSchema,
  memberRefSchema,
  memberRoleSchema,
  organizationProfileSchema,
  organizationRefSchema,
} from "@/lib/validation/organization";
import {
  changeMemberRole,
  createOrganization,
  inviteMember,
  leaveOrganization,
  removeMember,
  removeOrganizationLogo,
  resendInvitation,
  revokeInvitation,
  transferOwnership,
  updateOrganizationProfile,
  uploadOrganizationLogo,
} from "@/services/organizations";

function revalidateOrganization(slug?: string | null) {
  revalidatePath("/dashboard", "layout");
  if (slug) revalidatePath(`/firmen/${slug}`);
}

export async function createOrganizationAction(input: unknown): Promise<ActionResult<{ organizationId: string }>> {
  return runAction(async () => {
    await assertUser();
    const settings = await getPlatformSettings();
    if (!settings.features.business_accounts) {
      throw new AppError("service_unavailable", "Neue Firmenkonten können derzeit nicht erstellt werden.");
    }
    const parsed = createOrganizationSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const organizationId = await createOrganization(parsed.data);
    revalidatePath("/dashboard", "layout");
    return { organizationId };
  }, "Ihr Firmenkonto wurde erstellt.");
}

export async function updateOrganizationAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const parsed = organizationProfileSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const organization = await updateOrganizationProfile(parsed.data);
    revalidateOrganization(organization.slug);
    return null;
  }, "Das Firmenprofil wurde gespeichert.");
}

export async function uploadOrganizationLogoAction(formData: FormData): Promise<ActionResult<{ logoUrl: string | null }>> {
  return runAction(async () => {
    await assertUser();
    const parsed = organizationRefSchema.safeParse({ organizationId: formData.get("organizationId") });
    if (!parsed.success) throw new AppError("validation");
    const { slug, path } = await uploadOrganizationLogo(parsed.data.organizationId, formData.get("file"));
    revalidateOrganization(slug);
    return { logoUrl: publicStorageUrl("org-logos", path) };
  }, "Das Logo wurde aktualisiert.");
}

export async function removeOrganizationLogoAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const parsed = organizationRefSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation");
    const { slug } = await removeOrganizationLogo(parsed.data.organizationId);
    revalidateOrganization(slug);
    return null;
  }, "Das Logo wurde entfernt.");
}

export async function inviteMemberAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  return runAction(async () => {
    await assertUser();
    const parsed = inviteMemberSchema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    await inviteMember(parsed.data);
    after(() => flushEmailOutbox());
    revalidatePath("/dashboard/firma");
    return { email: parsed.data.email };
  });
}

export async function revokeInvitationAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const parsed = invitationRefSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation");
    await revokeInvitation(parsed.data.invitationId);
    revalidatePath("/dashboard/firma");
    return null;
  }, "Die Einladung wurde widerrufen.");
}

export async function resendInvitationAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const parsed = invitationRefSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation");
    await resendInvitation(parsed.data.invitationId);
    after(() => flushEmailOutbox());
    revalidatePath("/dashboard/firma");
    return null;
  }, "Die Einladung wurde mit einem neuen Link erneut gesendet.");
}

export async function changeMemberRoleAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = memberRoleSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation");
    await changeMemberRole({ ...parsed.data, actorId: user.id });
    revalidatePath("/dashboard/firma");
    return null;
  }, "Die Rolle wurde geändert.");
}

export async function removeMemberAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = memberRefSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation");
    await removeMember({ ...parsed.data, actorId: user.id });
    revalidatePath("/dashboard/firma");
    return null;
  }, "Das Mitglied wurde entfernt.");
}

export async function leaveOrganizationAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = organizationRefSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation");
    await leaveOrganization({ organizationId: parsed.data.organizationId, userId: user.id });
    revalidatePath("/dashboard", "layout");
    return null;
  }, "Sie haben das Firmenkonto verlassen.");
}

export async function transferOwnershipAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await assertUser();
    const parsed = memberRefSchema.safeParse(input);
    if (!parsed.success) throw new AppError("validation");
    await transferOwnership({ organizationId: parsed.data.organizationId, newOwnerId: parsed.data.userId });
    revalidatePath("/dashboard", "layout");
    return null;
  }, "Die Inhaberschaft wurde übertragen. Sie sind jetzt Administrator/in.");
}
