import { expect, test } from "@playwright/test";
import { adminClient, createTestUser, deleteTestUsers, login, type TestUser } from "./helpers";

/**
 * Szenario D über die laufende Anwendung: fremde IDs, private Dokumente,
 * Admin-Bereich und fremde Konversationen.
 */
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
      .insert({ owner_id: owner.id, property_type: "apartment", offer_type: "sale", postal_code: "3000", municipality: "Bern", canton: "BE" })
      .select("id")
      .single();
    if (error || !property) throw error;
    propertyId = property.id;
    const { data: doc } = await admin
      .from("property_documents")
      .insert({
        property_id: propertyId,
        uploaded_by: owner.id,
        title: "Grundbuchauszug",
        storage_path: `${propertyId}/e2e.pdf`,
        mime_type: "application/pdf",
        size_bytes: 10,
        visibility: "owner",
      })
      .select("id")
      .single();
    documentId = doc!.id;
    const { data: conv } = await admin.from("conversations").insert({ seller_id: owner.id, subject: "E2E" }).select("id").single();
    conversationId = conv!.id;
    await admin.from("conversation_participants").insert({ conversation_id: conversationId, user_id: owner.id, role: "seller" });
  });

  test.afterAll(async () => {
    await adminClient().from("conversations").delete().eq("id", conversationId);
    await deleteTestUsers([owner, intruder]);
  });

  test("fremde Immobilie, Dokument, Konversation und Admin-Bereich sind gesperrt", async ({ page, request }) => {
    await login(page, intruder);

    const editPage = await page.goto(`/dashboard/immobilien/${propertyId}/bearbeiten`);
    expect(editPage?.status()).toBe(404);

    const doc = await page.request.get(`/api/documents/${documentId}/download`, { maxRedirects: 0 });
    expect([401, 403, 404]).toContain(doc.status());

    const conv = await page.goto(`/dashboard/nachrichten/${conversationId}`);
    expect(conv?.status()).toBe(404);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);

    const anonymousDoc = await request.get(`/api/documents/${documentId}/download`, { maxRedirects: 0 });
    expect([401, 403, 404]).toContain(anonymousDoc.status());
  });
});
