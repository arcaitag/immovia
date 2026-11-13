import { expect, test, type Page } from "@playwright/test";
import type { Json } from "../../src/types/database";
import { adminClient, createTestUser, deleteUserWithFiles, login, newVisitor, uniqueId, type TestUser } from "./helpers";

/**
 * Bild-KI im Bilderstudio: Designvorschlag erstellen (mit Einwilligung), prüfen, freigeben bzw.
 * verwerfen. Öffentlich erscheint ein Vorschlag erst nach der Freigabe.
 *
 * Läuft nur gegen eine lokale Instanz mit dem Testanbieter (kein Internet, keine Kosten):
 *   IMAGE_AI_PROVIDER=e2e-mock E2E_IMAGE_AI_MOCK=1 (Server) und E2E_IMAGE_AI=1 (Tests).
 * Der Testanbieter ist auf Vercel gesperrt (src/lib/images/ai-providers/e2e-mock.ts).
 * Das Kontingent für KI-Visualisierungen muss > 0 sein (feature_settings.ai_quotas); der Test
 * setzt es, der Server liest Einstellungen aber bis zu 60 s aus dem Cache.
 */

interface Fixture {
  owner: TestUser;
  propertyId: string;
  imageId: string;
  slug: string;
}

async function webpVariant(width: number): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const height = Math.round((width * 3) / 4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#e9e4da"/>
    <rect x="${width * 0.1}" y="${height * 0.55}" width="${width * 0.5}" height="${height * 0.25}" fill="#8c7b65"/>
    <rect x="${width * 0.65}" y="${height * 0.15}" width="${width * 0.25}" height="${height * 0.4}" fill="#bcd3e6"/>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

async function createFixture(): Promise<Fixture> {
  const owner = await createTestUser("e2e-bildki", { first: "Bea", last: "Bild" });
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
      rooms: 3.5,
      living_area: 82,
    })
    .select("id")
    .single();
  if (propertyError || !property) throw propertyError ?? new Error("Immobilie konnte nicht angelegt werden");

  const imageId = crypto.randomUUID();
  const prefix = `${property.id}/${imageId}/base`;
  for (const [variant, width] of [["sm", 640], ["md", 1280], ["lg", 1600]] as const) {
    const { error } = await admin.storage
      .from("property-images")
      .upload(`${prefix}-${variant}.webp`, await webpVariant(width), { contentType: "image/webp", upsert: true });
    if (error) throw error;
  }
  const { error: imageError } = await admin.from("property_images").insert({
    id: imageId,
    property_id: property.id,
    uploaded_by: owner.id,
    base_path: prefix,
    display_path: prefix,
    width: 1600,
    height: 1200,
    status: "ready",
    is_cover: true,
    caption: "Wohnzimmer",
  });
  if (imageError) throw imageError;

  const { data: listing, error: listingError } = await admin
    .from("listings")
    .insert({
      property_id: property.id,
      owner_id: owner.id,
      offer_type: "rent",
      title: `Bild-KI-Test ${uniqueId()}: 3.5-Zimmer-Wohnung`,
      short_description: "Testinserat für die Bild-KI.",
      description: "Dieses Inserat wird nur für einen automatisierten Test angelegt und danach wieder gelöscht.",
      price: 1900,
      additional_costs: 200,
      texts_confirmed_at: new Date().toISOString(),
      status: "published",
    })
    .select("slug")
    .single();
  if (listingError || !listing?.slug) throw listingError ?? new Error("Inserat konnte nicht veröffentlicht werden");
  return { owner, propertyId: property.id, imageId, slug: listing.slug };
}

/** Enthält die öffentliche Inseratsseite (neuer Besucher, ohne Cache) ein Bild? */
async function publicListingShowsImage(page: Page, fixture: Fixture, imageId: string): Promise<boolean> {
  const visitor = await newVisitor(page.context().browser()!, test.info().project.use.baseURL);
  try {
    const response = await visitor.page.goto(`/immobilien/${fixture.slug}`);
    expect(response?.status()).toBe(200);
    return (await visitor.page.content()).includes(imageId);
  } finally {
    await visitor.context.close();
  }
}

test.describe("Bild-KI: Designvorschläge", () => {
  test.skip(process.env.E2E_IMAGE_AI !== "1", "Nur mit lokalem Testanbieter (E2E_IMAGE_AI=1)");
  test.skip(({ isMobile }) => isMobile, "Ablauf am Desktop");

  let fixture: Fixture | undefined;
  let previousQuotas: Json | undefined;

  test.beforeAll(async () => {
    const admin = adminClient();
    const { data } = await admin.from("feature_settings").select("value").eq("key", "ai_quotas").maybeSingle();
    previousQuotas = data?.value ?? null;
    const quotas = { ...((previousQuotas as Record<string, Json> | null) ?? {}), virtual_staging_per_month: 20 };
    await admin.from("feature_settings").upsert({ key: "ai_quotas", value: quotas as Json });
    fixture = await createFixture();
  });

  test.afterAll(async () => {
    const admin = adminClient();
    if (previousQuotas !== undefined) {
      if (previousQuotas === null) await admin.from("feature_settings").delete().eq("key", "ai_quotas");
      else await admin.from("feature_settings").upsert({ key: "ai_quotas", value: previousQuotas });
    }
    await deleteUserWithFiles(fixture?.owner.id);
  });

  test("Aufräumen: Einwilligung, Prüfung und Freigabe; erst danach öffentlich", async ({ page }) => {
    const f = fixture!;
    await login(page, f.owner, `/dashboard/bilderstudio/${f.imageId}`);
    const panel = page.getByRole("region", { name: "Designvorschlag mit KI" });
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: "Aufräumen", exact: true }).click();
    const consent = page.getByRole("dialog", { name: "Foto an die Bild-KI senden?" });
    await expect(consent).toBeVisible();
    await expect(consent).toContainText("ohne Standortdaten");
    await expect(consent).toContainText("Testanbieter (lokal)");
    await consent.getByRole("button", { name: "Zustimmen und fortfahren" }).click();

    // Nach dem Auftrag öffnet sich der Vorschlag zur Prüfung
    await expect(page.getByRole("heading", { level: 1, name: "KI-Vorschlag prüfen" })).toBeVisible({ timeout: 60_000 });
    const proposalId = page.url().split("/").pop()!;
    expect(proposalId).not.toBe(f.imageId);
    const { data: proposal } = await adminClient()
      .from("property_images")
      .select("status, is_ai_visualization, source_image_id, caption")
      .eq("id", proposalId)
      .single();
    expect(proposal).toMatchObject({ status: "review", is_ai_visualization: true, source_image_id: f.imageId, caption: "KI-Visualisierung: aufgeräumt" });
    const { data: prefs } = await adminClient().from("user_preferences").select("ai_image_consent, ai_processing_consent").eq("user_id", f.owner.id).single();
    expect(prefs).toEqual({ ai_image_consent: true, ai_processing_consent: false });

    expect(await publicListingShowsImage(page, f, proposalId)).toBe(false);

    const review = page.getByRole("region", { name: "Vorschlag prüfen" });
    await expect(review.getByRole("slider", { name: "Vergleich vorher und nachher" })).toBeVisible();
    const release = review.getByRole("button", { name: "Freigeben" });
    await expect(release).toBeDisabled();
    await review.getByRole("checkbox", { name: /Raum und feste Ausstattung entsprechen dem Originalfoto/ }).check();
    await release.click();
    await expect(page.getByText("Der Vorschlag ist freigegeben")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Bild bearbeiten" })).toBeVisible();
    await expect(page.getByText("Dies ist eine KI-Visualisierung.")).toBeVisible();

    expect(await publicListingShowsImage(page, f, proposalId)).toBe(true);
    const { data: transformation } = await adminClient()
      .from("image_transformations")
      .select("kind, status, accepted_at, provider")
      .eq("image_id", f.imageId)
      .eq("kind", "declutter")
      .single();
    expect(transformation).toMatchObject({ kind: "declutter", status: "accepted", provider: "e2e-mock" });
    expect(transformation?.accepted_at).toBeTruthy();
  });

  test("Neu einrichten: Vorschlag verwerfen löscht das Bild, das Original bleibt", async ({ page }) => {
    const f = fixture!;
    await login(page, f.owner, `/dashboard/bilderstudio/${f.imageId}`);
    const panel = page.getByRole("region", { name: "Designvorschlag mit KI" });
    await panel.getByLabel("Raum").selectOption({ label: "Schlafzimmer" });
    await panel.getByLabel("Stil").selectOption({ label: "Skandinavisch" });
    await panel.getByRole("button", { name: "Neu einrichten", exact: true }).click();

    await expect(page.getByRole("heading", { level: 1, name: "KI-Vorschlag prüfen" })).toBeVisible({ timeout: 60_000 });
    const proposalId = page.url().split("/").pop()!;
    const { data: proposal } = await adminClient().from("property_images").select("caption, status").eq("id", proposalId).single();
    expect(proposal).toEqual({ caption: "KI-Visualisierung: neu eingerichtet (Skandinavisch)", status: "review" });

    // Im Schritt «Bilder» ist der Vorschlag als offen markiert
    await page.goto(`/dashboard/immobilien/${f.propertyId}/bilder`);
    await expect(page.getByRole("link", { name: "Prüfen und freigeben" })).toBeVisible();
    await page.getByRole("link", { name: "Prüfen und freigeben" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/bilderstudio/${proposalId}$`));

    await page.getByRole("region", { name: "Vorschlag prüfen" }).getByRole("button", { name: "Verwerfen" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Vorschlag verwerfen?" });
    await confirm.getByRole("button", { name: "Verwerfen" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/bilderstudio/${f.imageId}$`));
    await expect(page.getByText("Der Vorschlag wurde verworfen.")).toBeVisible();

    const { data: gone } = await adminClient().from("property_images").select("id").eq("id", proposalId).maybeSingle();
    expect(gone).toBeNull();
    const { data: files } = await adminClient().storage.from("property-images").list(`${f.propertyId}/${proposalId}`);
    expect(files ?? []).toHaveLength(0);
    const { data: original } = await adminClient().from("property_images").select("status").eq("id", f.imageId).single();
    expect(original?.status).toBe("ready");
  });
});
