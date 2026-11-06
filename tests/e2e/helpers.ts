import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

export const E2E_DOMAIN = "e2e.immovia.test";
export const E2E_PASSWORD = "E2e-Test-Passwort-2026";

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

export async function deleteTestUsers(users: TestUser[]): Promise<void> {
  const admin = adminClient();
  for (const user of users) {
    await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
  }
}

export async function login(page: Page, user: TestUser, next = "/dashboard"): Promise<void> {
  await page.goto(`/login?weiter=${encodeURIComponent(next)}`);
  await page.getByLabel("E-Mail-Adresse").fill(user.email);
  await page.getByLabel("Passwort", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[/?]/g, "\\$&")}`));
}
