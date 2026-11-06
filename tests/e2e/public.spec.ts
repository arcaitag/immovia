import { expect, test } from "@playwright/test";

test.describe("Öffentliche Seiten", () => {
  test("Startseite zeigt Markenversprechen, Suche und Angebote @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Immobilie bewerten, professionell verkaufen.");
    await expect(page.getByRole("search", { name: "Immobilien suchen" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aktuelle Immobilienangebote" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Jetzt Immobilie verkaufen/ })).toBeVisible();
  });

  test("Suche aus dem Hero führt zur Trefferliste mit URL-Parametern", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Mieten" }).click();
    await page.getByLabel("Zimmer ab").selectOption("3");
    await page.getByRole("button", { name: "Suchen" }).click();
    await expect(page).toHaveURL(/\/mieten\?.*zimmer_von=3/);
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
