import { expect, test } from "@playwright/test";

test.describe("Öffentliche Seiten", () => {
  test("Startseite zeigt Suche zuerst, Angebote direkt darunter @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Immobilien. Einfach. Digital.");
    await expect(page.getByText("Entdecke, bewerte und vermarkte Immobilien.")).toBeVisible();
    await expect(page.getByText("Alles auf einer Plattform.")).toBeVisible();
    await expect(page.getByRole("search", { name: "Immobilien suchen" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Kaufen" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Immobilien suchen", exact: true })).toBeInViewport();
    await expect(page.getByRole("heading", { name: "Aktuelle Immobilienangebote" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Alle Angebote" })).toHaveAttribute("href", "/immobilien");
    await expect(page.getByRole("link", { name: "Immobilie verkaufen" }).first()).toHaveAttribute("href", "/verkaufen");
    await expect(page.getByRole("link", { name: "Kostenlos bewerten" }).first()).toHaveAttribute("href", "/bewerten");
    // Reihenfolge der Bereiche gemäss Vorgabe
    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings.slice(0, 7)).toEqual([
      "Aktuelle Immobilienangebote",
      "Immobilien kostenlos verkaufen",
      "So funktioniert Immovia",
      "Kostenlose Immobilienbewertung",
      "Verkaufsdossier und Bildoptimierung",
      "Kommunikation und Interessentenverwaltung",
      "Angebote für Immobilienfirmen",
    ]);
  });

  test("Suche aus dem Hero führt zur Trefferliste mit URL-Parametern", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Mieten" }).click();
    await page.getByLabel("Immobilientyp").selectOption({ label: "Wohnung" });
    await page.getByLabel("Zimmer ab").selectOption("3");
    await page.getByRole("button", { name: "Immobilien suchen", exact: true }).click();
    await expect(page).toHaveURL(/\/mieten\?.*typ=apartment.*zimmer_von=3/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("Preisoptionen passen sich Kaufen und Mieten an", async ({ page }) => {
    await page.goto("/");
    const price = page.getByLabel("Kaufpreis bis");
    // Tausendertrennzeichen je nach ICU-Version ' oder ’
    await expect(price.locator("option", { hasText: /^bis CHF 1.000.000$/ })).toHaveCount(1);
    await price.selectOption("1000000");
    await page.getByRole("tab", { name: "Mieten" }).click();
    const rent = page.getByLabel("Miete pro Monat bis");
    // Wechsel setzt den Preis zurück und zeigt Monatsmieten
    await expect(rent).toHaveValue("");
    await expect(rent.locator("option", { hasText: /^bis CHF 2.000 \/ Monat$/ })).toHaveCount(1);
    await expect(rent.locator("option", { hasText: /1.000.000/ })).toHaveCount(0);
    // Tastatur: Pfeiltaste wechselt zurück zu Kaufen
    await page.getByRole("tab", { name: "Mieten" }).press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Kaufen" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Kaufen" })).toBeFocused();
  });

  test("Weitere Filter öffnet die Suche mit dem Filter-Panel", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Zimmer ab").selectOption("4");
    await page.getByRole("button", { name: "Weitere Filter" }).click();
    await expect(page).toHaveURL(/\/kaufen\?zimmer_von=4/);
    await expect(page.getByRole("dialog", { name: /Filter/ })).toBeVisible();
  });

  test("Rechtstexte sind als Entwurf gekennzeichnet", async ({ page }) => {
    for (const path of ["/impressum", "/datenschutz", "/agb"]) {
      await page.goto(path);
      await expect(page.getByText(/Entwurf/).first()).toBeVisible();
    }
  });

  test("Geschützte Bereiche leiten auf das Login um", async ({ page }) => {
    await page.goto("/dashboard/immobilien");
    await expect(page).toHaveURL(/\/login\?weiter=%2Fdashboard%2Fimmobilien/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Unbekannte Seiten liefern 404", async ({ page }) => {
    const response = await page.goto("/diese-seite-gibt-es-nicht");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /gibt es nicht/ })).toBeVisible();
  });
});
