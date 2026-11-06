import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

export const E2E_DOMAIN = "e2e.immovia.test";
export const E2E_PASSWORD = "E2e-Test-Passwort-2026";

/** Demo-Konten (nur lokal bzw. in Vorschau-Umgebungen mit Demodaten). */
export const DEMO_PASSWORD = "ImmoviaDemo2026!";
export const DEMO_ACCOUNTS = {
  seller: "demo-verkauf@immovia.test",
  buyer: "demo-kauf@immovia.test",
  broker: "demo-makler@immovia.test",
  team: "demo-team@immovia.test",
  admin: "demo-admin@immovia.test",
} as const;

export function adminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SECRET_KEY sind für E2E-Tests nötig.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

export type Credentials = Pick<TestUser, "email" | "password">;

/** Kurze, eindeutige Kennung für Testdaten (Titel, Namen, E-Mail-Adressen). */
export function uniqueId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Legt ein bestätigtes Testkonto an (Service Role). */
export async function createTestUser(prefix: string, meta: { first: string; last: string }): Promise<TestUser> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@${E2E_DOMAIN}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: meta.first, last_name: meta.last },
  });
  if (error || !data.user) throw error ?? new Error("Benutzer konnte nicht erstellt werden");
  return { id: data.user.id, email, password: E2E_PASSWORD };
}

export async function deleteTestUsers(users: Array<Pick<TestUser, "id"> | undefined>): Promise<void> {
  const admin = adminClient();
  for (const user of users) {
    if (!user?.id) continue;
    await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
  }
}

/** Benutzer-ID zu einer E-Mail-Adresse (über profiles, Service Role). */
export async function userIdByEmail(email: string): Promise<string | null> {
  const { data } = await adminClient().from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  return data?.id ?? null;
}

export function demoAccount(email: string): Credentials {
  return { email, password: DEMO_PASSWORD };
}

export async function login(page: Page, user: Credentials, next = "/dashboard"): Promise<void> {
  await page.goto(`/login?weiter=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail-Adresse").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[/?]/g, "\\$&")}`));
}

/** Neuer, unabhängiger Browser-Kontext (z. B. anonymer Besucher) mit denselben Projekt-Einstellungen. */
export async function newVisitor(browser: Browser, baseURL: string | undefined): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL, locale: "de-CH", timezoneId: "Europe/Zurich" });
  const page = await context.newPage();
  return { context, page };
}

/** Erzeugt ein echtes JPG (mit sharp aus node_modules) für Upload-Tests. */
export async function createTestJpeg(path: string, label = "Immovia E2E"): Promise<string> {
  const { default: sharp } = await import("sharp");
  await mkdir(dirname(path), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1067">
    <rect width="100%" height="100%" fill="#dfeee3"/>
    <rect x="200" y="420" width="1200" height="520" fill="#4f7a2c"/>
    <polygon points="140,440 800,120 1460,440" fill="#2f4a1c"/>
    <text x="800" y="740" font-family="sans-serif" font-size="72" fill="#ffffff" text-anchor="middle">${label}</text>
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(path);
  return path;
}

/** Prüft, dass die Seite in der aktuellen Breite nicht horizontal scrollt. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });
  expect(overflow.scrollWidth, `Seite ist ${overflow.scrollWidth}px breit, Viewport ${overflow.clientWidth}px`).toBeLessThanOrEqual(
    overflow.clientWidth,
  );
}

const PROPERTY_BUCKETS = ["property-originals", "property-images", "documents", "dossiers"] as const;

/** Alle Dateipfade unter einem Ordner eines Buckets (rekursiv). */
async function listFolder(bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  const { data, error } = await adminClient().storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const paths: string[] = [];
  for (const entry of data) {
    const path = `${prefix}/${entry.name}`;
    // Ordner haben keine id (Supabase Storage liefert sie als Platzhalter ohne Metadaten)
    if (entry.id === null) paths.push(...(await listFolder(bucket, path, depth + 1)));
    else paths.push(path);
  }
  return paths;
}

/** Entfernt die Storage-Dateien von Immobilien (Bilder, Originale, Dokumente, Dossiers). */
export async function removePropertyFiles(propertyIds: string[]): Promise<void> {
  const admin = adminClient();
  for (const propertyId of propertyIds) {
    for (const bucket of PROPERTY_BUCKETS) {
      const paths = await listFolder(bucket, propertyId);
      if (paths.length) await admin.storage.from(bucket).remove(paths);
    }
  }
}

/** Löscht ein Konto inklusive der Storage-Dateien seiner Immobilien. */
export async function deleteUserWithFiles(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  const admin = adminClient();
  const { data: properties } = await admin.from("properties").select("id").eq("owner_id", userId);
  await removePropertyFiles((properties ?? []).map((p) => p.id));
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}

/**
 * Entfernt, was ein Interessent bei einem fremden (z. B. Demo-)Inserat hinterlassen hat. Beim Löschen
 * des Kontos bleiben Konversationen, Leads, Anfragen und Termine sonst beim Inserenten erhalten
 * (ON DELETE SET NULL), ebenso Benachrichtigungen und E-Mails an den Inserenten.
 */
export async function removeInterestedFootprint(interestedId: string, ownerId: string | null): Promise<void> {
  const admin = adminClient();
  const [{ data: conversations }, { data: appointments }] = await Promise.all([
    admin.from("conversations").select("id").eq("interested_id", interestedId),
    admin.from("viewing_appointments").select("id").eq("guest_id", interestedId),
  ]);
  const conversationIds = (conversations ?? []).map((c) => c.id);
  const appointmentIds = (appointments ?? []).map((a) => a.id);

  if (ownerId) {
    for (const [key, ids] of [
      ["conversation_id", conversationIds],
      ["appointment_id", appointmentIds],
    ] as const) {
      if (!ids.length) continue;
      await admin.from("notifications").delete().eq("user_id", ownerId).in(`data->>${key}`, ids);
      await admin.from("email_outbox").delete().eq("user_id", ownerId).in(`payload->>${key}`, ids);
    }
  }
  if (appointmentIds.length) await admin.from("viewing_appointments").delete().in("id", appointmentIds);
  await admin.from("leads").delete().eq("interested_id", interestedId);
  await admin.from("listing_inquiries").delete().eq("sender_id", interestedId);
  if (conversationIds.length) await admin.from("conversations").delete().in("id", conversationIds);
  await admin.from("rate_limit_buckets").delete().like("key", `%:${interestedId}`);
}

/**
 * Setzt die Aufrufstatistik eines Inserats auf den Stand vor dem Test zurück
 * (Aufrufe seit `since` werden entfernt, view_count entsprechend reduziert).
 */
export async function revertListingViews(listingId: string, since: string): Promise<void> {
  const admin = adminClient();
  const { data: removed } = await admin
    .from("listing_views")
    .delete()
    .eq("listing_id", listingId)
    .gte("created_at", since)
    .select("id");
  const count = removed?.length ?? 0;
  if (!count) return;
  const { data: listing } = await admin.from("listings").select("view_count").eq("id", listingId).single();
  if (listing) await admin.from("listings").update({ view_count: Math.max(0, listing.view_count - count) }).eq("id", listingId);
}
