import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-End-Tests gegen eine laufende Instanz (lokal oder Vercel-Preview).
 * Voraussetzungen siehe docs/TESTS.md: E2E_BASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY.
 * In Umgebungen ohne Playwright-Browser kann Google Chrome verwendet werden (PLAYWRIGHT_CHROME=1).
 */
const useSystemChrome = process.env.PLAYWRIGHT_CHROME === "1";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], ...(useSystemChrome ? { channel: "chrome" } : {}) },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], ...(useSystemChrome ? { channel: "chrome" } : {}) },
      grep: /@mobile/,
    },
  ],
});
