import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  DEMO_ACCOUNTS,
  adminClient,
  createTestUser,
  deleteTestUsers,
  demoAccount,
  login,
  newVisitor,
  uniqueId,
  type TestUser,
} from "./helpers";

/**
 * Szenario C: Die Administratorin sieht Übersicht, Benutzer, Inserate-Moderation und Statistiken,
 * sperrt ein Inserat (danach öffentlich nicht mehr erreichbar) und hebt die Sperre wieder auf.
 *
 * Gesperrt wird ein eigenes, über die Service Role veröffentlichtes Testinserat, damit Demo-Daten
 * unverändert bleiben (Benachrichtigungen und E-Mails an die Eigentümer entstehen nur beim Testkonto).
 */

interface Fixture {
  owner: TestUser;
  listingId: string;
  slug: string;
  title: string;
  marker: string;
}

/** Veröffentlichtes Testinserat (Service Role) mit einem «fertigen» Bild als Pflichtangabe. */
async function createPublishedListing(prefix: string): Promise<Fixture> {
  const marker = uniqueId();
  const title = `Moderationstest ${marker}: 2.5-Zimmer-Wohnung im Lorrainequartier`;
  const owner = await createTestUser(prefix, { first: "Ida", last: "Inhaber" });
  const admin = adminClient();
  const { data: property, error: propertyError } = await admin
    .from("properties")
    .insert({
      owner_id: owner.id,
      property_type: "apartment",
      offer_type: "rent",
      postal_code: "3013",
      municipality: "Bern",
      canton: "BE",
      rooms: 2.5,
      living_area: 58,
    })
    .select("id")
    .single();
  if (propertyError || !property) throw propertyError ?? new Error("Immobilie konnte nicht angelegt werden");
  // Wie bei den Demo-Inseraten extern verlinkt (lokal ohne Internet nicht ladbar, für den Test unerheblich)
  const { error: imageError } = await admin.from("property_images").insert({
    property_id: property.id,
    uploaded_by: owner.id,
    external_url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688",
    status: "ready",
    is_cover: true,
    width: 1600,
    height: 1067,
  });
  if (imageError) throw imageError;
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .insert({
      property_id: property.id,
      // owner_id/offer_type übernimmt der Trigger listings_before_write ohnehin aus der Immobilie
      owner_id: owner.id,
      offer_type: "rent",
      title,
      short_description: "Testinserat für die Moderation.",
      description: "Dieses Inserat wird nur für einen automatisierten Test angelegt und danach wieder gelöscht.",
      price: 1650,
      additional_costs: 180,
      texts_confirmed_at: new Date().toISOString(),
      status: "published",
    })
    .select("id, slug")
    .single();
  if (listingError || !listing?.slug) throw listingError ?? new Error("Inserat konnte nicht veröffentlicht werden");
  return { owner, listingId: listing.id, slug: listing.slug, title, marker };
}

async function removeFixture(fixture: Fixture | undefined): Promise<void> {
  if (!fixture) return;
  const admin = adminClient();
  // Sicherheitsnetz: eine Sperre nie stehen lassen, auch wenn ein Test abbricht
  await admin.from("listings").update({ moderation_status: "ok", moderation_reason: null }).eq("id", fixture.listingId);
  // Moderationsverlauf hat keinen Fremdschlüssel aufs Inserat und würde sonst verwaist zurückbleiben.
  // (admin_audit_logs ist absichtlich unveränderlich und bleibt bestehen.)
  await admin.from("moderation_actions").delete().eq("target_type", "listing").eq("target_id", fixture.listingId);
  await deleteTestUsers([fixture.owner]);
}

/**
 * Öffnet eine Seite als neuer, anonymer Besucher (eigener Kontext ohne Browser-Cache und
 * Service Worker), damit der Serverzustand geprüft wird.
 */
async function asNewVisitor(browser: Browser, baseURL: string | undefined, check: (page: Page) => Promise<void>): Promise<void> {
  const visitor = await newVisitor(browser, baseURL);
  try {
    await check(visitor.page);
  } finally {
    await visitor.context.close();
  }
}

async function expectListingUnavailable(page: Page, fixture: Fixture): Promise<void> {
  const response = await page.goto(`/immobilien/${fixture.slug}`);
  expect([200, 404]).toContain(response?.status());
  await expect(
    page.getByRole("heading", { level: 1, name: /Dieses Inserat ist nicht mehr verfügbar|Diese Seite gibt es nicht/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: fixture.title })).toHaveCount(0);
}

async function expectListingPublic(page: Page, fixture: Fixture): Promise<void> {
  const response = await page.goto(`/immobilien/${fixture.slug}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: fixture.title })).toBeVisible();
}

async function moderate(page: Page, fixture: Fixture, action: "Sperren" | "Sperre aufheben", reason?: string): Promise<void> {
  const row = page.getByRole("list", { name: "Inserate" }).getByRole("listitem").filter({ hasText: fixture.title });
  await row.getByRole("button", { name: `Aktionen für «${fixture.title}»` }).click();
  await page.getByRole("menuitem", { name: action }).click();
  if (action === "Sperren") {
    const dialog = page.getByRole("alertdialog", { name: "Inserat sperren?" });
    const confirm = dialog.getByRole("button", { name: "Sperren" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Begründung für die Eigentümer").fill(reason ?? "Irreführende Angaben (automatischer Test)");
    await confirm.click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText("Gesperrt");
  } else {
    const dialog = page.getByRole("alertdialog", { name: "Sperre aufheben?" });
    // Das Testinserat ist veröffentlicht: Aufheben macht es sofort wieder sichtbar
    await expect(dialog).toContainText("sofort wieder öffentlich sichtbar");
    await dialog.getByRole("button", { name: "Aufheben" }).click();
    await expect(dialog).toBeHidden();
    await expect(row).not.toContainText("Gesperrt");
  }
}

async function openListingInModeration(page: Page, fixture: Fixture) {
  await page.getByLabel("Suche").fill(fixture.marker);
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]q=${fixture.marker}`));
  const row = page.getByRole("list", { name: "Inserate" }).getByRole("listitem").filter({ hasText: fixture.title });
  await expect(row).toHaveCount(1);
  return row;
}

test.describe("Szenario C: Administration", () => {
  let fixture: Fixture | undefined;

  test.beforeAll(async () => {
    fixture = await createPublishedListing("inhaber");
  });

  test.afterAll(async () => {
    await removeFixture(fixture);
  });

  test("Übersicht, Benutzer, Moderation (sperren und entsperren) und Statistiken", async ({ page, browser, baseURL }) => {
    test.setTimeout(180_000);
    const listing = fixture!;

    await test.step("Testinserat ist vor der Sperre öffentlich", async () => {
      await asNewVisitor(browser, baseURL, (visitor) => expectListingPublic(visitor, listing));
    });

    await test.step("Admin-Übersicht", async () => {
      await login(page, demoAccount(DEMO_ACCOUNTS.admin), "/admin");
      await expect(page.getByRole("heading", { level: 1, name: "Übersicht" })).toBeVisible();
      const kpis = page.getByRole("region", { name: "Kennzahlen" });
      await expect(kpis.getByText("Registrierte Benutzer")).toBeVisible();
      await expect(kpis.getByText("Aktive Inserate")).toBeVisible();
    });

    await test.step("Benutzerliste", async () => {
      await page.getByRole("link", { name: "Benutzer", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/benutzer$/);
      await expect(page.getByRole("heading", { level: 1, name: "Benutzer" })).toBeVisible();
      const users = page.getByRole("list", { name: "Benutzer" });
      await expect(users.getByText(DEMO_ACCOUNTS.seller)).toBeVisible();

      await page.getByLabel("Suche").fill(listing.owner.email);
      await page.getByRole("button", { name: "Filtern" }).click();
      await expect(users.getByRole("listitem")).toHaveCount(1);
      await expect(users.getByRole("link", { name: "Ida I." })).toBeVisible();
    });

    await test.step("Inserat sperren", async () => {
      await page.getByRole("link", { name: /^Inserate/ }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Inserate" })).toBeVisible();
      const row = await openListingInModeration(page, listing);
      await expect(row).toContainText("Veröffentlicht");
      await moderate(page, listing, "Sperren", "Irreführende Preisangabe (automatischer Test)");
      await expect(page.getByText("Das Inserat wurde aktualisiert.").first()).toBeVisible();
      await expect(row).toContainText("Grund: Irreführende Preisangabe");
    });

    await test.step("Gesperrtes Inserat ist öffentlich nicht mehr erreichbar", async () => {
      await asNewVisitor(browser, baseURL, async (visitor) => {
        await expectListingUnavailable(visitor, listing);
        await visitor.goto(`/immobilien?q=${encodeURIComponent(listing.marker)}`);
        await expect(visitor.getByRole("status").filter({ hasText: "gefunden" })).toHaveText("0 Immobilien gefunden");
      });
      const { data } = await adminClient().from("listings").select("status, moderation_status").eq("id", listing.listingId).single();
      expect(data).toEqual({ status: "published", moderation_status: "blocked" });
    });

    await test.step("Sperre wieder aufheben", async () => {
      await moderate(page, listing, "Sperre aufheben");
      const { data } = await adminClient().from("listings").select("status, moderation_status").eq("id", listing.listingId).single();
      expect(data).toEqual({ status: "published", moderation_status: "ok" });
      await asNewVisitor(browser, baseURL, (visitor) => expectListingPublic(visitor, listing));
    });

    await test.step("Statistiken", async () => {
      await page.getByRole("link", { name: "Statistiken", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/statistiken$/);
      await expect(page.getByRole("heading", { level: 1, name: "Statistiken" })).toBeVisible();
    });
  });

  /*
   * Regression: public/sw.js lud Seiten mit fetch(event.request) über den HTTP-Cache. Bei
   * «Cache-Control: s-maxage=60, stale-while-revalidate=…» (ISR, next start) lieferte Chrome einem
   * wiederkehrenden Besucher die zuletzt gesehene Fassung, z. B. ein inzwischen gesperrtes Inserat.
   * Seitenaufrufe laufen jetzt mit cache: "no-store".
   */
  test("wiederkehrender Besucher sieht ein gesperrtes Inserat nicht mehr (Service Worker)", async ({
    page,
    browser,
    baseURL,
  }) => {
    const listing = fixture!;
    const visitor = await newVisitor(browser, baseURL);
    try {
      await expectListingPublic(visitor.page, listing);
      await login(page, demoAccount(DEMO_ACCOUNTS.admin), "/admin/immobilien");
      await openListingInModeration(page, listing);
      await moderate(page, listing, "Sperren");
      await expectListingUnavailable(visitor.page, listing);
    } finally {
      await visitor.context.close();
      await adminClient().from("listings").update({ moderation_status: "ok", moderation_reason: null }).eq("id", listing.listingId);
    }
  });
});
