import "server-only";

import sharp from "sharp";
import { headers } from "next/headers";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { inspectImage } from "@/lib/images/processing";
import { publicEnv } from "@/lib/env";
import { AppError, fromDbError, validationError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import type { Json, Tables } from "@/types/database";
import {
  IMAGE_ACTION_MAX_BYTES,
  type NotificationSettingsValues,
  type PreferencesValues,
  type ProfileValues,
} from "@/lib/validation/account";
import type { VerificationStatus } from "@/lib/validation/admin";

/**
 * Benutzerkonto: Profil, Profilbild, E-Mail und Passwort, Einstellungen,
 * Datenexport und Kontolöschung. Zugriffe über den Benutzer-Client (RLS);
 * der Service-Role-Client wird nur für die Kontolöschung verwendet.
 */

// -----------------------------------------------------------------------------
// Hilfen
// -----------------------------------------------------------------------------
type StorageCapable = Pick<ServerSupabaseClient, "storage">;

export async function getSiteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return publicEnv.siteUrl;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : publicEnv.siteUrl;
}

interface AuthLikeError {
  message?: string;
  code?: string;
  status?: number;
}

/** Übersetzt Fehler von Supabase Auth (E-Mail- und Passwortänderung). */
export function translateAuthError(error: AuthLikeError): AppError {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || message.includes("rate limit")) {
    return new AppError("rate_limited");
  }
  if (code === "email_exists" || code === "user_already_exists" || message.includes("already been registered")) {
    return validationError(
      { email: ["Diese E-Mail-Adresse ist bereits mit einem anderen Konto verbunden."] },
      "Diese E-Mail-Adresse ist bereits mit einem anderen Konto verbunden.",
    );
  }
  if (code === "email_address_invalid" || code === "email_address_not_authorized" || code === "validation_failed") {
    return validationError({ email: ["Diese E-Mail-Adresse kann nicht verwendet werden."] }, "Diese E-Mail-Adresse kann nicht verwendet werden.");
  }
  if (code === "weak_password" || message.includes("weak") || message.includes("pwned")) {
    return validationError(
      { newPassword: ["Dieses Passwort ist zu unsicher oder wurde in einem Datenleck gefunden. Bitte wählen Sie ein anderes."] },
      "Dieses Passwort ist zu unsicher. Bitte wählen Sie ein anderes.",
    );
  }
  if (code === "same_password" || message.includes("same password") || message.includes("different from the old")) {
    return validationError(
      { newPassword: ["Das neue Passwort muss sich vom bisherigen unterscheiden."] },
      "Das neue Passwort muss sich vom bisherigen unterscheiden.",
    );
  }
  if (code === "reauthentication_needed" || code === "reauth_nonce_missing") {
    return new AppError("invalid_state", "Bitte melden Sie sich erneut an und versuchen Sie es dann noch einmal.");
  }
  if (code === "session_not_found" || code === "session_expired" || code === "bad_jwt" || code === "user_not_found") {
    return new AppError("not_authenticated", "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.");
  }
  if (code === "email_provider_disabled") {
    return new AppError("service_unavailable", "E-Mail-Änderungen sind derzeit nicht möglich.");
  }
  return new AppError("unknown");
}

/** Löscht alle Dateien unterhalb eines Ordners (rekursiv, begrenzte Tiefe). Best effort. */
export async function removeStorageFolder(client: StorageCapable, bucket: string, prefix: string, depth = 0): Promise<number> {
  let removed = 0;
  for (let round = 0; round < 100; round++) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset: 0 });
    if (error || !data || data.length === 0) break;
    const files = data.filter((entry) => entry.id !== null).map((entry) => `${prefix}/${entry.name}`);
    const folders = data.filter((entry) => entry.id === null).map((entry) => `${prefix}/${entry.name}`);
    if (depth < 4) {
      for (const folder of folders) removed += await removeStorageFolder(client, bucket, folder, depth + 1);
    }
    if (files.length === 0) break;
    const { error: removeError } = await client.storage.from(bucket).remove(files);
    if (removeError) {
      console.error(`[account] Dateien in ${bucket}/${prefix} konnten nicht gelöscht werden`, removeError.message);
      break;
    }
    removed += files.length;
    if (data.length < 1000) break;
  }
  return removed;
}

// -----------------------------------------------------------------------------
// Profil
// -----------------------------------------------------------------------------
export interface AccountOverview {
  email: string | null;
  emailConfirmedAt: string | null;
  pendingEmail: string | null;
  emailChangeSentAt: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  profile: Tables<"profiles">;
  identity: { status: VerificationStatus; verifiedAt: string | null; method: string | null } | null;
}

export async function getAccountOverview(user: SessionUser): Promise<AccountOverview> {
  const supabase = await createClient();
  const [{ data: authData }, { data: identity }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("verifications")
      .select("status, verified_at, method, created_at")
      .eq("subject_type", "user")
      .eq("subject_id", user.id)
      .eq("kind", "identity")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const authUser = authData.user;
  return {
    email: authUser?.email ?? user.email,
    emailConfirmedAt: authUser?.email_confirmed_at ?? null,
    pendingEmail: authUser?.new_email ?? null,
    emailChangeSentAt: authUser?.email_change_sent_at ?? null,
    createdAt: authUser?.created_at ?? user.profile.created_at,
    lastSignInAt: authUser?.last_sign_in_at ?? null,
    profile: user.profile,
    identity: identity ? { status: identity.status, verifiedAt: identity.verified_at, method: identity.method } : null,
  };
}

export async function updateProfile(userId: string, values: ProfileValues): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: values.firstName,
      last_name: values.lastName,
      display_name: values.displayName,
      phone: values.phone,
    })
    .eq("id", userId)
    .select("id")
    .single();
  if (error) throw fromDbError(error);
}

// -----------------------------------------------------------------------------
// Bilder (Profilbild, auch für Firmenlogos genutzt)
// -----------------------------------------------------------------------------
const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp"]);

/** Liest eine hochgeladene Bilddatei und prüft Grösse und echtes Format (nicht nur den MIME-Typ). */
export async function readUploadedImage(file: unknown): Promise<Buffer> {
  if (!(file instanceof Blob) || file.size === 0) {
    throw new AppError("validation", "Bitte wählen Sie ein Bild aus.");
  }
  if (file.size > IMAGE_ACTION_MAX_BYTES) {
    throw new AppError("validation", "Das Bild ist zu gross. Bitte wählen Sie ein kleineres Bild.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await inspectImage(buffer);
    if (!ALLOWED_IMAGE_FORMATS.has(meta.format)) throw new Error("format");
    if (meta.width < 64 || meta.height < 64) {
      throw new AppError("validation", "Das Bild ist zu klein. Bitte verwenden Sie mindestens 64 × 64 Pixel.");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("validation", "Die Datei konnte nicht als Bild gelesen werden. Bitte verwenden Sie JPG, PNG oder WebP.");
  }
  return buffer;
}

/** Quadratisches Profilbild 256 × 256 px als WebP, ohne Metadaten. */
export async function renderAvatar(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize(256, 256, { fit: "cover", position: "attention" })
    .webp({ quality: 84 })
    .toBuffer();
}

export async function uploadAvatar(userId: string, file: unknown): Promise<string> {
  const input = await readUploadedImage(file);
  const output = await renderAvatar(input);
  const supabase = await createClient();
  const path = `${userId}/avatar-${Date.now()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (uploadError) {
    console.error("[account] Profilbild-Upload fehlgeschlagen", uploadError.message);
    throw new AppError("unknown", "Das Profilbild konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.");
  }
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId).select("id").single();
  if (error) {
    await supabase.storage.from("avatars").remove([path]);
    throw fromDbError(error);
  }
  await removeOtherAvatars(supabase, userId, path);
  return path;
}

export async function removeAvatar(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId).select("id").single();
  if (error) throw fromDbError(error);
  await removeOtherAvatars(supabase, userId, null);
}

/** Entfernt alle älteren Profilbilder im eigenen Ordner (auch verwaiste Dateien). */
async function removeOtherAvatars(supabase: ServerSupabaseClient, userId: string, keepPath: string | null): Promise<void> {
  const { data } = await supabase.storage.from("avatars").list(userId, { limit: 100 });
  const stale = (data ?? [])
    .filter((entry) => entry.id !== null)
    .map((entry) => `${userId}/${entry.name}`)
    .filter((path) => path !== keepPath);
  if (stale.length) {
    const { error } = await supabase.storage.from("avatars").remove(stale);
    if (error) console.error("[account] Alte Profilbilder konnten nicht gelöscht werden", error.message);
  }
}

// -----------------------------------------------------------------------------
// E-Mail und Passwort
// -----------------------------------------------------------------------------
export async function requestEmailChange(user: SessionUser, newEmail: string): Promise<void> {
  if (newEmail.toLowerCase() === (user.email ?? "").toLowerCase()) {
    throw validationError({ email: ["Das ist bereits Ihre aktuelle E-Mail-Adresse."] }, "Das ist bereits Ihre aktuelle E-Mail-Adresse.");
  }
  const supabase = await createClient();
  const origin = await getSiteOrigin();
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/dashboard/profil?email=bestaetigt")}` },
  );
  if (error) throw translateAuthError(error);
}

/**
 * Passwort ändern: Das aktuelle Passwort wird per Anmeldung geprüft (erneuert die
 * Sitzung), danach wird das neue Passwort gesetzt.
 */
export async function changePassword(user: SessionUser, currentPassword: string, newPassword: string): Promise<void> {
  if (!user.email) throw new AppError("invalid_state", "Für Ihr Konto ist keine E-Mail-Adresse hinterlegt.");
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (signInError) {
    const code = signInError.code ?? "";
    if (code === "over_request_rate_limit" || signInError.status === 429) throw new AppError("rate_limited");
    if (code === "email_not_confirmed") {
      throw new AppError("invalid_state", "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.");
    }
    const message = "Das aktuelle Passwort ist nicht korrekt.";
    throw validationError({ currentPassword: [message] }, message);
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw translateAuthError(error);
}

// -----------------------------------------------------------------------------
// Einstellungen
// -----------------------------------------------------------------------------
export async function getAccountSettings(userId: string): Promise<{
  notifications: Tables<"user_notification_settings"> | null;
  preferences: Tables<"user_preferences"> | null;
}> {
  const supabase = await createClient();
  const [notifications, preferences] = await Promise.all([
    supabase.from("user_notification_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  return { notifications: notifications.data, preferences: preferences.data };
}

export async function updateNotificationSettings(userId: string, values: NotificationSettingsValues): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_notification_settings")
    .update(values)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new AppError("not_found", "Ihre Benachrichtigungseinstellungen wurden nicht gefunden.");
}

export async function updatePreferences(userId: string, values: PreferencesValues): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .update(values)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new AppError("not_found", "Ihre Präferenzen wurden nicht gefunden.");
}

// -----------------------------------------------------------------------------
// Datenexport
// -----------------------------------------------------------------------------
export interface AccountExport {
  userId: string;
  data: Record<string, Json | undefined>;
}

/** Alle persönlichen Daten des angemeldeten Benutzers (export_my_data + weitere eigene Daten). */
export async function buildAccountExport(): Promise<AccountExport | null> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser) return null;

  const [core, memberships, verifications, reports, threads, notifications] = await Promise.all([
    supabase.rpc("export_my_data"),
    supabase.from("organization_members").select("organization_id, role, created_at, organizations(name, slug)").eq("user_id", authUser.id),
    supabase
      .from("verifications")
      .select("kind, status, verified_at, created_at")
      .eq("subject_type", "user")
      .eq("subject_id", authUser.id),
    supabase.from("user_reports").select("target_type, target_id, reason, details, status, created_at").eq("reporter_id", authUser.id),
    supabase
      .from("assistant_threads")
      .select("id, title, property_id, created_at, assistant_messages(role, content, created_at)")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("notifications")
      .select("type, title, body, link, read_at, created_at")
      .eq("user_id", authUser.id)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  if (core.error) throw fromDbError(core.error);

  const coreData = core.data && typeof core.data === "object" && !Array.isArray(core.data) ? core.data : {};
  return {
    userId: authUser.id,
    data: {
      format: "immovia-datenexport",
      version: 1,
      generated_at: new Date().toISOString(),
      account: {
        id: authUser.id,
        email: authUser.email ?? null,
        email_confirmed_at: authUser.email_confirmed_at ?? null,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at ?? null,
      },
      ...coreData,
      organization_memberships: (memberships.data ?? []) as unknown as Json,
      verifications: (verifications.data ?? []) as unknown as Json,
      reports_submitted: (reports.data ?? []) as unknown as Json,
      assistant_conversations: (threads.data ?? []) as unknown as Json,
      notifications: (notifications.data ?? []) as unknown as Json,
    },
  };
}

// -----------------------------------------------------------------------------
// Kontolöschung
// -----------------------------------------------------------------------------
const PROPERTY_BUCKETS = ["property-originals", "property-images", "documents", "dossiers"] as const;

export const TRANSFER_OWNERSHIP_MESSAGE =
  "Sie sind Inhaber/in eines Firmenkontos mit weiteren Mitgliedern. Bitte übertragen Sie zuerst die Inhaberschaft oder entfernen Sie die übrigen Mitglieder unter «Firmenkonto».";

/**
 * Löscht das Konto des angemeldeten Benutzers inkl. Dateien im Storage.
 * Mit Server-Schlüssel: zuerst Datenbank (delete_my_account), danach Dateien mit dem
 * Service-Role-Client (auch Dateien gelöschter Objekte). Ohne Server-Schlüssel:
 * zuerst die Dateien mit dem Benutzer-Client (soweit berechtigt), dann die Datenbank.
 */
export async function deleteAccount(userId: string): Promise<{ filesRemoved: number }> {
  const supabase = await createClient();

  // 1. Vorprüfung: Inhaberschaft von Firmen mit weiteren Mitgliedern
  const { data: ownerships, error: ownershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "owner");
  if (ownershipError) throw fromDbError(ownershipError);
  const ownedOrgIds = (ownerships ?? []).map((o) => o.organization_id);
  const orgsToDelete: string[] = [];
  for (const orgId of ownedOrgIds) {
    const { count, error } = await supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .neq("user_id", userId);
    if (error) throw fromDbError(error);
    if ((count ?? 0) > 0) throw new AppError("invalid_state", TRANSFER_OWNERSHIP_MESSAGE);
    orgsToDelete.push(orgId);
  }

  // 2. Betroffene Storage-Ordner bestimmen
  const useServiceRole = isServiceRoleConfigured();
  const admin = useServiceRole ? createAdminClient() : null;
  const propertyQuery = admin
    ? admin.from("properties").select("id").eq("owner_id", userId)
    : supabase.from("properties").select("id").eq("owner_id", userId);
  const { data: properties, error: propertyError } = await propertyQuery;
  if (propertyError) throw fromDbError(propertyError);
  const propertyIds = (properties ?? []).map((p) => p.id);

  const cleanup = async (client: StorageCapable): Promise<number> => {
    let removed = 0;
    for (const propertyId of propertyIds) {
      const counts = await Promise.all(PROPERTY_BUCKETS.map((bucket) => removeStorageFolder(client, bucket, propertyId)));
      removed += counts.reduce((a, b) => a + b, 0);
    }
    removed += await removeStorageFolder(client, "avatars", userId);
    for (const orgId of orgsToDelete) removed += await removeStorageFolder(client, "org-logos", orgId);
    return removed;
  };

  // 3. Löschen
  let filesRemoved = 0;
  if (admin) {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      if ((error.message ?? "").trim() === "transfer_ownership_first") throw new AppError("invalid_state", TRANSFER_OWNERSHIP_MESSAGE);
      throw fromDbError(error);
    }
    try {
      filesRemoved = await cleanup(admin);
    } catch (cleanupError) {
      console.error("[account] Storage-Bereinigung nach Kontolöschung unvollständig", cleanupError);
    }
  } else {
    try {
      filesRemoved = await cleanup(supabase);
    } catch (cleanupError) {
      console.error("[account] Storage-Bereinigung vor Kontolöschung unvollständig", cleanupError);
    }
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      if ((error.message ?? "").trim() === "transfer_ownership_first") throw new AppError("invalid_state", TRANSFER_OWNERSHIP_MESSAGE);
      throw fromDbError(error);
    }
  }

  // 4. Sitzung beenden (Cookies entfernen; der Benutzer existiert nicht mehr)
  await supabase.auth.signOut();
  return { filesRemoved };
}
