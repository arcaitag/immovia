import { expect, test } from "@playwright/test";
import {
  E2E_DOMAIN,
  E2E_PASSWORD,
  adminClient,
  createTestJpeg,
  deleteUserWithFiles,
  login,
  newVisitor,
  uniqueId,
  userIdByEmail,
} from "./helpers";

/**
 * Szenario A: Eine Privatperson registriert sich, erfasst eine Wohnung mit manueller Adresse,
 * lädt ein Foto hoch, setzt Preis und Texte, bestätigt sie, veröffentlicht und prüft das
 * öffentliche Inserat sowie Verwaltung und Statistik.
 */
test.describe("Szenario A: Verkäuferin inseriert eine Immobilie", () => {
  const id = uniqueId();
  const email = `verkauf-${id}@${E2E_DOMAIN}`;
  const title = `Sonnige Testwohnung ${id} beim Bundeshaus`;
  const shortDescription = "Ruhige 3.5-Zimmer-Wohnung mit Balkon, wenige Gehminuten vom Bahnhof Bern.";
  const description =
    "Die Wohnung liegt im 2. Obergeschoss eines gepflegten Mehrfamilienhauses. Wohnzimmer und Küche sind offen gestaltet, " +
    "beide Zimmer gehen auf den ruhigen Innenhof. Keller und Veloraum gehören dazu.";

  test.afterAll(async () => {
    await deleteUserWithFiles(await userIdByEmail(email));
  });

  test("Registrierung, Erfassung, Foto, Texte, Veröffentlichung, Verwaltung und Statistik", async ({ page, browser, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    let propertyId = "";
    let slug = "";

    await test.step("Konto registrieren", async () => {
      await page.goto("/registrieren");
      await expect(page.getByRole("heading", { level: 1, name: "Kostenlos starten" })).toBeVisible();
      await expect(page.getByRole("radio", { name: "Privatperson" })).toBeChecked();
      await page.getByLabel("Vorname").fill("Vera");
      await page.getByLabel("Nachname").fill("Verkauf");
      await page.getByLabel("E-Mail-Adresse").fill(email);
      await page.getByLabel("Passwort", { exact: true }).fill(E2E_PASSWORD);
      await page.getByRole("checkbox", { name: /AGB/ }).check();
      await page.getByRole("button", { name: "Kostenloses Konto erstellen" }).click();
      // Lokal bestätigt GoTrue automatisch (direkt im Dashboard). Mit E-Mail-Bestätigung (z. B. Preview)
      // wird das Konto über die Service Role bestätigt und danach regulär angemeldet.
      const confirmHint = page.getByRole("heading", { name: "Bitte bestätigen Sie Ihre E-Mail-Adresse" });
      await expect(page.getByRole("link", { name: /Erste Immobilie erfassen/ }).or(confirmHint)).toBeVisible();
      if (await confirmHint.isVisible()) {
        const userId = await userIdByEmail(email);
        expect(userId).not.toBeNull();
        await adminClient().auth.admin.updateUserById(userId!, { email_confirm: true });
        await login(page, { email, password: E2E_PASSWORD });
      }
      await expect(page).toHaveURL(/\/dashboard$/);
    });

    await test.step("«Immobilie erfassen» mit manueller Adresse", async () => {
      await page.getByRole("link", { name: /Erste Immobilie erfassen/ }).click();
      await expect(page).toHaveURL(/\/dashboard\/immobilien\/neu$/);
      await expect(page.getByRole("heading", { level: 1, name: "Neue Immobilie erfassen" })).toBeVisible();

      await expect(page.getByRole("radio", { name: /^Verkaufen/ })).toBeChecked();
      await page.getByRole("radio", { name: /^Wohnung/ }).click();
      await page.getByLabel("Strasse").fill("Bundesgasse");
      await page.getByLabel("Nr.").fill("8");
      await page.getByLabel("PLZ").fill("3011");
      await page.getByLabel("Gemeinde / Ort").fill("Bern");
      await page.getByLabel("Kanton").selectOption("BE");
      await expect(page.getByText(/Ohne Adressvorschlag wird kein Kartenstandort gespeichert/)).toBeVisible();
      await page.getByRole("button", { name: /Anlegen und weiter/ }).click();

      await expect(page).toHaveURL(/\/dashboard\/immobilien\/[0-9a-f-]{36}\/bearbeiten/);
      propertyId = /immobilien\/([0-9a-f-]{36})\//.exec(page.url())?.[1] ?? "";
      expect(propertyId).not.toBe("");
      await expect(page.getByRole("heading", { level: 2, name: "Immobilie erfassen" })).toBeVisible();
    });

    await test.step("Objektdaten: Zimmer und Wohnfläche (automatisch gespeichert)", async () => {
      await page
        .getByRole("navigation", { name: "Abschnitte der Erfassung" })
        .getByRole("button", { name: /Flächen & Zimmer/ })
        .click();
      await expect(page.getByRole("heading", { level: 3, name: "Flächen & Zimmer" })).toBeVisible();
      await page.getByRole("textbox", { name: /^Zimmer/ }).fill("3.5");
      await page.getByRole("textbox", { name: /^Nettowohnfläche/ }).fill("82");
      await page.getByRole("textbox", { name: /^Badezimmer/ }).fill("1");
      await expect(page.getByRole("status").filter({ hasText: /Gespeichert um \d{2}:\d{2}/ }).first()).toBeVisible();

      const { data } = await adminClient().from("properties").select("rooms, living_area, postal_code, municipality, canton").eq("id", propertyId).single();
      expect(data).toMatchObject({ rooms: 3.5, living_area: 82, postal_code: "3011", municipality: "Bern", canton: "BE" });
    });

    await test.step("Foto hochladen (JPG über das Dateifeld)", async () => {
      const photo = await createTestJpeg(testInfo.outputPath("wohnzimmer.jpg"), `Testwohnung ${id}`);
      await page.getByRole("navigation", { name: "Schritte des Verkaufsassistenten" }).getByRole("link", { name: /^Bilder/ }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Bilder hochladen" })).toBeVisible();

      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Bilder auswählen" }).click();
      await (await chooser).setFiles(photo);

      await expect(page.getByText("Bild hochgeladen.")).toBeVisible({ timeout: 30_000 });
      const gallery = page.getByRole("region", { name: "Ihre Bilder" });
      await expect(gallery.getByRole("listitem")).toHaveCount(1);
      await expect(gallery.getByText("Titelbild").first()).toBeVisible();
      await expect(page.getByText(/1 von maximal \d+ Bildern/)).toBeVisible();
    });

    await test.step("Preis und Texte setzen, Texte bestätigen", async () => {
      await page.getByRole("navigation", { name: "Schritte des Verkaufsassistenten" }).getByRole("link", { name: /^Inserat/ }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Preis, Texte und Kontakt" })).toBeVisible();

      await page.getByLabel("Verkaufspreis").fill("890'000");
      await page.getByLabel("Titel", { exact: true }).fill(title);
      await page.getByLabel("Kurzbeschreibung").fill(shortDescription);
      await page.getByLabel("Beschreibung", { exact: true }).fill(description);
      await page.getByRole("radio", { name: /^Nur Ort/ }).click();
      await page.getByRole("checkbox", { name: /Ich habe die Texte geprüft/ }).check();
      await expect(page.getByText("Sie haben ungespeicherte Änderungen.")).toBeVisible();
      await page.getByRole("button", { name: "Speichern", exact: true }).click();
      await expect(page.getByText("Alle Änderungen sind gespeichert.")).toBeVisible();
      await expect(page.getByText(/^Bestätigt am/)).toBeVisible();
    });

    await test.step("Veröffentlichen", async () => {
      await page.getByRole("link", { name: /Zur Veröffentlichung/ }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Inserat veröffentlichen" })).toBeVisible();
      for (const item of await page.getByRole("listitem").filter({ hasText: /\((erfüllt|fehlt)\)/ }).all()) {
        await expect(item).toContainText("(erfüllt)");
      }
      await page.getByRole("button", { name: "Jetzt veröffentlichen" }).click();
      const dialog = page.getByRole("alertdialog", { name: "Inserat jetzt veröffentlichen?" });
      await dialog.getByRole("button", { name: "Veröffentlichen" }).click();
      await expect(page.getByText("Ihr Inserat ist jetzt online.")).toBeVisible();
      await expect(page.getByText("Ihr Inserat ist online", { exact: true })).toBeVisible();

      const { data } = await adminClient().from("listings").select("slug, status").eq("property_id", propertyId).single();
      expect(data?.status).toBe("published");
      slug = data?.slug ?? "";
      expect(slug).toMatch(/^wohnung-3-5-zimmer-bern-/);
    });

    await test.step("Inserat ist öffentlich unter /immobilien/<slug> und in der Suche", async () => {
      const visitor = await newVisitor(browser, baseURL);
      try {
        const response = await visitor.page.goto(`/immobilien/${slug}`);
        expect(response?.status()).toBe(200);
        await expect(visitor.page.getByRole("heading", { level: 1, name: title })).toBeVisible();
        await expect(visitor.page.getByText(shortDescription)).toBeVisible();
        await expect(visitor.page.getByRole("region", { name: "Kontakt" }).getByText(/CHF 890.000/)).toBeVisible();
        // Standort nur mit PLZ und Ort, ohne Strasse
        await expect(visitor.page.getByText("3011 Bern").first()).toBeVisible();
        await expect(visitor.page.getByText("Bundesgasse")).toHaveCount(0);
        // Das hochgeladene Foto wird als verkleinerte WebP-Variante aus dem öffentlichen Storage geladen
        const cover = visitor.page.locator('img[src*="/storage/v1/object/public/property-images/"]').filter({ visible: true }).first();
        await expect(cover).toBeVisible();
        await expect(cover).toHaveAttribute("src", /-(sm|md|lg)\.webp$/);
        await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

        await visitor.page.goto(`/immobilien?q=${encodeURIComponent(id)}`);
        await expect(visitor.page.getByRole("status").filter({ hasText: "gefunden" })).toHaveText("1 Immobilie gefunden");
        await visitor.page.getByRole("link", { name: new RegExp(title) }).first().click();
        await expect(visitor.page).toHaveURL(new RegExp(`/immobilien/${slug}$`));
      } finally {
        await visitor.context.close();
      }
    });

    await test.step("Verkaufsverwaltung und Statistik öffnen", async () => {
      await page.getByRole("navigation", { name: "Schritte des Verkaufsassistenten" }).getByRole("link", { name: /^Verwaltung/ }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Verkaufsverwaltung" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Kennzahlen" })).toBeVisible();
      await expect(page.getByText("Noch keine Interessenten.")).toBeVisible();

      await page.goto("/dashboard/statistiken");
      await expect(page.getByRole("heading", { level: 1, name: "Statistiken" })).toBeVisible();
      await expect(page.getByLabel("Inserat")).toContainText(title);
      await expect(page.getByRole("list", { name: "Summen seit der Veröffentlichung" })).toBeVisible();
      await expect(page.getByText("Veröffentlicht seit")).toBeVisible();
    });
  });
});
