import { expect, test, type Page } from "@playwright/test";
import {
  DEMO_ACCOUNTS,
  adminClient,
  createTestUser,
  deleteTestUsers,
  demoAccount,
  login,
  removeInterestedFootprint,
  revertListingViews,
  uniqueId,
  userIdByEmail,
  type TestUser,
} from "./helpers";

/**
 * Szenario B: Ein Interessent sucht mit Filtern, speichert einen Suchauftrag, merkt sich ein
 * Demo-Inserat, sendet eine Anfrage und bucht (falls vorhanden) eine Besichtigung. Danach sieht
 * die Verkäuferin (demo-verkauf) den Interessenten als Lead.
 *
 * Alles, was der Test beim Demo-Inserat hinterlässt (Konversation, Lead, Termin, Benachrichtigungen,
 * Aufrufe), wird am Ende wieder entfernt.
 */
test.describe("Szenario B: Interessent", () => {
  test.describe.configure({ mode: "serial" });

  const id = uniqueId();
  const inquiryText = `Guten Tag, ist die Wohnung noch frei? Ich hätte gern Unterlagen zum Erneuerungsfonds. (Test ${id})`;
  const searchName = `Wohnungen Kanton Bern ab 4 Zimmer (Test ${id})`;
  // Puffer gegen Uhrenabweichung zwischen Testrechner und Datenbank (für das Zurücksetzen der Aufrufe)
  const startedAt = new Date(Date.now() - 60_000).toISOString();

  let buyer: TestUser;
  let buyerName = "";
  let sellerId: string | null = null;
  let listing: { id: string; slug: string; title: string };
  let viewingBooked = false;

  test.beforeAll(async () => {
    buyer = await createTestUser("interessent", { first: "Bea", last: "Bucher" });
    const admin = adminClient();
    sellerId = await userIdByEmail(DEMO_ACCOUNTS.seller);
    expect(sellerId, "Demo-Konto demo-verkauf fehlt").not.toBeNull();
    // Demo-Inserat der Verkäuferin, das die Suchfilter unten trifft (Kauf, Wohnung, BE, ab 4 Zimmer)
    const { data, error } = await admin
      .from("listings")
      .select("id, slug, title")
      .eq("owner_id", sellerId!)
      .eq("status", "published")
      .eq("moderation_status", "ok")
      .eq("offer_type", "sale")
      .eq("property_type", "apartment")
      .eq("canton", "BE")
      .gte("rooms", 4)
      .order("created_at")
      .limit(1)
      .single();
    if (error || !data?.slug || !data.title) throw error ?? new Error("Kein passendes Demo-Inserat gefunden");
    listing = { id: data.id, slug: data.slug, title: data.title };
    const { data: profile } = await admin.from("profiles").select("display_name").eq("id", buyer.id).single();
    buyerName = profile?.display_name ?? "Bea B.";
  });

  test.afterAll(async () => {
    if (buyer) {
      await removeInterestedFootprint(buyer.id, sellerId);
      await deleteTestUsers([buyer]);
    }
    if (listing) await revertListingViews(listing.id, startedAt);
  });

  async function openListingFromSearch(page: Page) {
    await page.getByRole("link", { name: new RegExp(listing.title) }).first().click();
    await expect(page).toHaveURL(new RegExp(`/immobilien/${listing.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: listing.title })).toBeVisible();
  }

  test("Suchen, Suchauftrag, Merkliste, Anfrage und Besichtigung", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page, buyer);

    await test.step("Suche mit Filtern (URL-Parameter)", async () => {
      await page.goto("/immobilien");
      const filters = page.getByRole("complementary", { name: "Filter" });
      await filters.getByRole("group", { name: "Angebotsart", exact: true }).getByRole("button", { name: "Kaufen" }).click();
      await expect(page).toHaveURL(/\/kaufen$/);
      await filters.getByRole("group", { name: "Immobilientyp", exact: true }).getByLabel("Wohnung", { exact: true }).check();
      await expect(page).toHaveURL(/typ=apartment/);
      await filters.getByRole("group", { name: "Zimmer", exact: true }).getByLabel("von").selectOption("4");
      await expect(page).toHaveURL(/zimmer_von=4/);
      await filters.getByRole("group", { name: "Region", exact: true }).getByLabel("Kanton").selectOption("BE");
      await expect(page).toHaveURL(/kanton=BE/);

      const url = new URL(page.url());
      expect(url.pathname).toBe("/kaufen");
      expect(Object.fromEntries(url.searchParams)).toEqual({ typ: "apartment", zimmer_von: "4", kanton: "BE" });

      const chips = page.getByRole("group", { name: "Aktive Filter", exact: true });
      await expect(chips.getByRole("button", { name: "Filter entfernen: Wohnung" })).toBeVisible();
      await expect(chips.getByRole("button", { name: /Filter entfernen: ab 4 Zimmer/ })).toBeVisible();
      await expect(chips.getByRole("button", { name: "Filter entfernen: Kanton Bern" })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "gefunden" })).toHaveText(/^\d+ Immobilien? gefunden$/);
      await expect(page.getByRole("heading", { level: 3, name: listing.title })).toBeVisible();

      // Die Filter bleiben beim Neuladen über die URL erhalten
      await page.reload();
      await expect(filters.getByRole("group", { name: "Immobilientyp", exact: true }).getByLabel("Wohnung", { exact: true })).toBeChecked();
      await expect(filters.getByRole("group", { name: "Zimmer", exact: true }).getByLabel("von")).toHaveValue("4");
    });

    await test.step("Suchauftrag speichern", async () => {
      await page.getByRole("button", { name: "Suchauftrag speichern" }).click();
      const dialog = page.getByRole("dialog", { name: "Suchauftrag speichern" });
      await expect(dialog.getByText(/Wohnung/).first()).toBeVisible();
      await dialog.getByLabel("Name des Suchauftrags").fill(searchName);
      await expect(dialog.getByRole("switch", { name: /Benachrichtigungen erhalten/ })).toBeChecked();
      await dialog.getByRole("button", { name: "Speichern" }).click();
      await expect(page.getByRole("dialog", { name: "Suchauftrag gespeichert" })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Weiter suchen" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    await test.step("Inserat öffnen und merken", async () => {
      await openListingFromSearch(page);
      const contact = page.getByRole("region", { name: "Kontakt" });
      await contact.getByRole("button", { name: "Auf die Merkliste setzen" }).click();
      await expect(page.getByText("Auf der Merkliste gespeichert")).toBeVisible();
      await expect(contact.getByRole("button", { name: "Von der Merkliste entfernen" })).toHaveAttribute("aria-pressed", "true");
    });

    await test.step("Anfrage senden", async () => {
      await page.getByRole("region", { name: "Kontakt" }).getByRole("button", { name: "Kontakt aufnehmen" }).click();
      const dialog = page.getByRole("dialog", { name: "Kontakt aufnehmen" });
      const message = dialog.getByLabel("Ihre Nachricht");
      await expect(message).toHaveValue(new RegExp(`Ich interessiere mich für Ihr Inserat «${listing.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}»`));
      await message.fill(inquiryText);
      await dialog.getByLabel("Telefonnummer").fill("+41 79 123 45 67");
      await dialog.getByRole("checkbox", { name: /Verkaufsdokumentation/ }).check();
      await dialog.getByRole("button", { name: "Anfrage senden" }).click();
      await expect(dialog.getByRole("status").filter({ hasText: "Anfrage gesendet" })).toBeVisible();
      await dialog.getByRole("link", { name: "Zur Konversation" }).click();
      await expect(page).toHaveURL(/\/dashboard\/nachrichten\/[0-9a-f-]{36}$/);
      await expect(page.getByRole("region", { name: "Unterhaltung" }).getByText(inquiryText)).toBeVisible();
    });

    await test.step("Besichtigung buchen (falls Zeitfenster vorhanden)", async () => {
      await page.goto(`/immobilien/${listing.slug}`);
      await page.getByRole("region", { name: "Kontakt" }).getByRole("button", { name: "Besichtigung anfragen" }).click();
      const dialog = page.getByRole("dialog", { name: "Besichtigung anfragen" });
      const slots = dialog.getByRole("radiogroup", { name: "Zeitfenster" });
      const none = dialog.getByText("Zurzeit sind keine Zeitfenster frei.");
      await expect(slots.or(none)).toBeVisible();
      if (await none.isVisible()) {
        test.info().annotations.push({ type: "Hinweis", description: "Das Demo-Inserat hat keine freien Zeitfenster – Buchung übersprungen." });
        await dialog.getByRole("button", { name: "Schliessen" }).first().click();
        return;
      }
      const free = slots.getByRole("radio", { disabled: false });
      await expect(free.first()).toBeVisible();
      await free.first().click();
      await dialog.getByLabel("Nachricht an die Verkäuferseite").fill("Wir kommen zu zweit.");
      await dialog.getByRole("button", { name: "Termin anfragen" }).click();
      await expect(page.getByText(/^Besichtigung angefragt\./)).toBeVisible();
      viewingBooked = true;

      await page.goto("/dashboard/besichtigungen");
      const upcoming = page.getByRole("region", { name: "Anstehend" });
      await expect(upcoming.getByRole("link", { name: listing.title })).toBeVisible();
      await expect(upcoming.getByText("Angefragt").first()).toBeVisible();
    });

    await test.step("Merkliste, Nachrichten und Suchaufträge im Dashboard", async () => {
      await page.goto("/dashboard/merkliste");
      await expect(page.getByRole("heading", { level: 1, name: "Merkliste" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3, name: listing.title })).toBeVisible();

      await page.goto("/dashboard/nachrichten");
      const conversation = page.getByRole("link").filter({ hasText: listing.title }).first();
      await expect(conversation).toBeVisible();
      await conversation.click();
      await expect(page.getByRole("region", { name: "Unterhaltung" }).getByText(inquiryText)).toBeVisible();

      await page.goto("/dashboard/suchauftraege");
      await expect(page.getByRole("heading", { level: 1, name: "Suchaufträge" })).toBeVisible();
      await expect(page.getByText(searchName)).toBeVisible();
    });
  });

  test("Verkäuferin sieht die Anfrage als Lead", async ({ page }) => {
    await login(page, demoAccount(DEMO_ACCOUNTS.seller), "/dashboard/interessenten");
    await expect(page.getByRole("heading", { level: 1, name: "Interessenten" })).toBeVisible();
    const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: buyerName, exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(listing.title);
    await expect(row).toContainText(viewingBooked ? "Besichtigung angefragt" : "Neue Anfrage");

    await row.getByRole("link", { name: buyerName, exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/interessenten\/[0-9a-f-]{36}$/);
    await expect(page.getByText(inquiryText).first()).toBeVisible();
    await expect(page.getByText("Wünscht Dossier")).toBeVisible();
  });
});
