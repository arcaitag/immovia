import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

/**
 * Mobile Darstellung (Projekt «mobile», Pixel 7). Zusätzlich wird die in docs/CONVENTIONS.md
 * geforderte Mindestbreite von 375 px geprüft.
 */
test.describe("Mobile Ansicht @mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "Nur im Projekt «mobile» (Touch-Gerät, schmaler Viewport)");

  const WIDTHS = [null, 375] as const;
  /** «Filter» bzw. «Filter 2 aktiv» – nicht die Chips «Filter entfernen: …» */
  const FILTER_BUTTON = /^Filter( \d+ aktiv)?$/;

  async function useWidth(page: Page, width: number | null) {
    if (width) await page.setViewportSize({ width, height: 800 });
  }

  for (const width of WIDTHS) {
    const label = width ? `${width} px` : "Pixel 7";

    /*
     * Regression: Ein einspaltiges Grid ohne minmax(0, 1fr) übernahm die Mindestbreite einer Karte
     * mit einzeiliger Vorschau (truncate) – die Startseite wurde 462 px breit. Abhilfe: globale
     * Regel :where(.grid) { grid-template-columns: minmax(0, 1fr) } in src/app/globals.css.
     */
    test(`Startseite ohne horizontales Scrollen (${label}) @mobile`, async ({ page }) => {
      await useWidth(page, width);
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
      await expectNoHorizontalScroll(page);
    });

    test(`Hero-Suche: Standort und Suchbutton sofort sichtbar, Filter ausklappbar (${label}) @mobile`, async ({ page }) => {
      await useWidth(page, width);
      await page.goto("/");
      await expect(page.getByRole("tab", { name: "Mieten" })).toBeInViewport();
      await expect(page.getByLabel("Ort, PLZ oder Region")).toBeInViewport();
      await expect(page.getByRole("button", { name: "Immobilien suchen", exact: true })).toBeInViewport();
      // Objektart, Preis und Zimmer erst nach «Weitere Filter»
      const toggle = page.getByRole("button", { name: "Weitere Filter" });
      await expect(page.getByLabel("Zimmer ab")).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await page.getByLabel("Zimmer ab").selectOption("2.5");
      await page.getByRole("button", { name: "Immobilien suchen", exact: true }).click();
      await expect(page).toHaveURL(/\/kaufen\?zimmer_von=2\.5/);
    });

    test(`Suche mit Filter-Sheet ohne horizontales Scrollen (${label}) @mobile`, async ({ page }) => {
      await useWidth(page, width);
      await page.goto("/mieten");
      await expect(page.getByRole("heading", { level: 1, name: "Immobilien mieten" })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: "gefunden" })).toBeVisible();
      await expectNoHorizontalScroll(page);

      // Auf Mobilgeräten liegen die Filter in einem Sheet (Seitenleiste nur ab lg)
      await expect(page.getByRole("complementary", { name: "Filter" })).toBeHidden();
      await page.getByRole("button", { name: FILTER_BUTTON }).click();
      const sheet = page.getByRole("dialog", { name: "Filter" });
      await expect(sheet).toBeVisible();
      await sheet.getByRole("group", { name: "Immobilientyp", exact: true }).getByLabel("Wohnung", { exact: true }).check();
      await expect(page).toHaveURL(/\/mieten\?typ=apartment$/);
      await expect(sheet).toBeVisible();
      await sheet.getByRole("group", { name: "Zimmer", exact: true }).getByLabel("von").selectOption("2");
      await expect(page).toHaveURL(/zimmer_von=2/);
      await expectNoHorizontalScroll(page);
      await sheet.getByRole("button", { name: /Immobilien? anzeigen$/ }).click();
      await expect(sheet).toBeHidden();

      await expect(page.getByRole("button", { name: FILTER_BUTTON })).toHaveAccessibleName("Filter 2 aktiv");
      const chips = page.getByRole("group", { name: "Aktive Filter", exact: true });
      await expect(chips.getByRole("button", { name: "Filter entfernen: Wohnung" })).toBeVisible();
      await expect(chips.getByRole("button", { name: "Filter entfernen: ab 2 Zimmer" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
      await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
      await expectNoHorizontalScroll(page);
    });
  }

  /*
   * Kaufen/Mieten/Alle wechseln die Route (/immobilien, /kaufen, /mieten) und bauen die Werkzeugleiste
   * neu auf. Der Anker «#filter» öffnet das Sheet danach wieder (search-toolbar.tsx, filter-panel.tsx).
   */
  test("Angebotsart im Filter-Sheet wählen lässt das Sheet offen @mobile", async ({ page }) => {
    await page.goto("/immobilien");
    await page.getByRole("button", { name: FILTER_BUTTON }).click();
    const sheet = page.getByRole("dialog", { name: "Filter" });
    await sheet.getByRole("group", { name: "Angebotsart", exact: true }).getByRole("button", { name: "Mieten" }).click();
    await expect(page).toHaveURL(/\/mieten$/);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("group", { name: "Angebotsart", exact: true }).getByRole("button", { name: "Mieten" })).toHaveAttribute("aria-pressed", "true");
  });

  test("mobiles Menü öffnen, navigieren und schliessen @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toBeHidden();
    await page.getByRole("button", { name: "Menü öffnen" }).click();
    const menu = page.getByRole("dialog", { name: "Menü" });
    await expect(menu).toBeVisible();
    const nav = menu.getByRole("navigation", { name: "Mobile Navigation" });
    for (const name of ["Immobilien suchen", "Kaufen", "Mieten", "Immobilie verkaufen", "Immobilie bewerten", "Ratgeber"]) {
      await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: "Anmelden" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Kostenlos inserieren" })).toBeVisible();

    await nav.getByRole("link", { name: "Mieten", exact: true }).click();
    await expect(page).toHaveURL(/\/mieten$/);
    await expect(menu).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Immobilien mieten" })).toBeVisible();

    // Schliessen über den Button (auf einer Seite ohne Überbreite vollständig sichtbar)
    await page.getByRole("button", { name: "Menü öffnen" }).click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("button", { name: "Schliessen" })).toBeInViewport();
    await menu.getByRole("button", { name: "Schliessen" }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeFocused();
  });
});
