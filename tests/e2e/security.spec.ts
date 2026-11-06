import { expect, test, type Page, type Response } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, login, removePropertyFiles, type TestUser } from "./helpers";

/**
 * Szenario D über die laufende Anwendung: fremde IDs, private Dokumente,
 * Admin-Bereich und fremde Konversationen. Zu jeder Sperre gibt es eine Positiv-Kontrolle
 * mit der Eigentümerin, damit ein «kein Zugriff» nicht nur an fehlenden Testdaten liegt.
 */

const SECRET_STREET = "Geheimweg";
const SECRET_NAME = "Objekt Tresor";
const SECRET_MESSAGE = "Vertraulich: Der Mindestpreis liegt bei 1,2 Millionen.";
const SECRET_DOCUMENT = "Grundbuchauszug Tresor";

/** Minimales gültiges PDF für den Storage-Upload. */
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

/**
 * Fremde bzw. nicht vorhandene Datensätze zeigen die 404-Seite. Weil das Dashboard eine
 * loading.tsx hat, wird die Antwort gestreamt: Next.js kann den Status dann nicht mehr auf 404
 * setzen (HTTP 200) und markiert die Seite stattdessen mit «noindex» (siehe
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md, «Status codes»).
 */
async function expectNotFoundPage(page: Page, response: Response | null, heading: RegExp | string = "Diese Seite gibt es nicht (mehr)") {
  const status = response?.status();
  expect([200, 404]).toContain(status);
  if (status === 200) await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}

test.describe("Szenario D: Sicherheit", () => {
  let owner: TestUser;
  let intruder: TestUser;
  let propertyId: string;
  let documentId: string;
  let conversationId: string;

  test.beforeAll(async () => {
    owner = await createTestUser("owner", { first: "Olga", last: "Owner" });
    intruder = await createTestUser("intruder", { first: "Ivan", last: "Intruder" });
    const admin = adminClient();
    const { data: property, error } = await admin
      .from("properties")
      .insert({
        owner_id: owner.id,
        property_type: "apartment",
        offer_type: "sale",
        street: SECRET_STREET,
        house_number: "7",
        postal_code: "3000",
        municipality: "Bern",
        canton: "BE",
        internal_name: SECRET_NAME,
      })
      .select("id")
      .single();
    if (error || !property) throw error ?? new Error("Immobilie konnte nicht angelegt werden");
    propertyId = property.id;

    const { data: doc, error: docError } = await admin
      .from("property_documents")
      .insert({
        property_id: propertyId,
        uploaded_by: owner.id,
        title: SECRET_DOCUMENT,
        storage_path: `${propertyId}/e2e-grundbuch.pdf`,
        mime_type: "application/pdf",
        size_bytes: PDF.length,
        visibility: "owner",
      })
      .select("id, storage_path")
      .single();
    if (docError || !doc) throw docError ?? new Error("Dokument konnte nicht angelegt werden");
    documentId = doc.id;
    const { error: uploadError } = await admin.storage.from("documents").upload(doc.storage_path, PDF, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const { data: conv, error: convError } = await admin.from("conversations").insert({ seller_id: owner.id, subject: "E2E" }).select("id").single();
    if (convError || !conv) throw convError ?? new Error("Konversation konnte nicht angelegt werden");
    conversationId = conv.id;
    await admin.from("conversation_participants").insert({ conversation_id: conversationId, user_id: owner.id, role: "seller" });
    const { error: messageError } = await admin
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: owner.id, kind: "text", body: SECRET_MESSAGE });
    if (messageError) throw messageError;
  });

  test.afterAll(async () => {
    if (conversationId) await adminClient().from("conversations").delete().eq("id", conversationId);
    if (propertyId) await removePropertyFiles([propertyId]);
    await deleteTestUsers([owner, intruder]);
  });

  test("Positiv-Kontrolle: Eigentümerin sieht Immobilie, Dokument und Konversation", async ({ page }) => {
    await login(page, owner);

    const edit = await page.goto(`/dashboard/immobilien/${propertyId}/bearbeiten`);
    expect(edit?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 2, name: "Immobilie erfassen" })).toBeVisible();

    const download = await page.request.get(`/api/documents/${documentId}/download`, { maxRedirects: 0 });
    expect(download.status()).toBe(302);
    expect(download.headers()["location"]).toContain("/object/sign/documents/");

    await page.goto(`/dashboard/nachrichten/${conversationId}`);
    await expect(page.getByRole("region", { name: "Unterhaltung" }).getByText(SECRET_MESSAGE)).toBeVisible();
  });

  test("fremde Immobilie per ID ergibt 404 – ohne Daten preiszugeben", async ({ page }) => {
    await login(page, intruder);
    for (const path of ["", "/bearbeiten", "/bilder", "/inserat", "/veroeffentlichen", "/verwaltung"]) {
      await test.step(`/dashboard/immobilien/<fremde ID>${path}`, async () => {
        const response = await page.goto(`/dashboard/immobilien/${propertyId}${path}`);
        await expectNotFoundPage(page, response);
        await expect(page.getByText(SECRET_STREET)).toHaveCount(0);
        await expect(page.getByText(SECRET_NAME)).toHaveCount(0);
      });
    }
    // Auch über die Dokumentenverwaltung lässt sich die fremde Immobilie nicht auswählen
    await page.goto(`/dashboard/dokumente?immobilie=${propertyId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Dokumente" })).toBeVisible();
    await expect(page.getByText(SECRET_DOCUMENT)).toHaveCount(0);
    await expect(page.getByText(SECRET_NAME)).toHaveCount(0);
  });

  test("fremde Dokumente und Nachrichten sind nicht abrufbar", async ({ page, request }) => {
    await login(page, intruder);

    const doc = await page.request.get(`/api/documents/${documentId}/download`, { maxRedirects: 0 });
    expect(doc.status()).toBe(404);
    const anonymousDoc = await request.get(`/api/documents/${documentId}/download`, { maxRedirects: 0 });
    expect(anonymousDoc.status()).toBe(404);

    const conv = await page.goto(`/dashboard/nachrichten/${conversationId}`);
    await expectNotFoundPage(page, conv, "Konversation nicht gefunden");
    await expect(page.getByText(SECRET_MESSAGE)).toHaveCount(0);

    await page.goto("/dashboard/nachrichten");
    await expect(page.getByText("Noch keine Nachrichten", { exact: true })).toBeVisible();
    await expect(page.getByText(SECRET_MESSAGE)).toHaveCount(0);
  });

  test("normaler Benutzer wird aus dem Admin-Bereich umgeleitet", async ({ page }) => {
    await login(page, intruder);
    for (const path of ["/admin", "/admin/benutzer", "/admin/immobilien", "/admin/einstellungen"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard$/);
    }
    await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);
  });

  test("ohne Anmeldung führen Dashboard und Admin zum Login", async ({ page }) => {
    for (const path of ["/dashboard", "/dashboard/nachrichten", `/dashboard/immobilien/${propertyId}/bearbeiten`]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?weiter=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      await expect(page.getByRole("button", { name: "Anmelden" })).toBeVisible();
    }
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
