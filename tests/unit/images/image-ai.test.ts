import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

vi.mock("server-only", () => ({}));

const { buildImageAiPrompt } = await import("@/lib/images/ai-providers/prompts");
const {
  buildEditRequest,
  estimateImageCostUsd,
  gatewayErrorDetail,
  mapGatewayError,
  parseEditResponse,
  resolveGatewayToken,
  vercelGatewayProvider,
  DEFAULT_IMAGE_MODEL,
} = await import("@/lib/images/ai-providers/vercel-gateway");
const { ImageAiProviderError, imageAiJobType, imageModelRecipient } = await import("@/lib/images/ai-providers/types");
const { isE2eMockAllowed } = await import("@/lib/images/ai-providers/e2e-mock");
const { getImageAiStatus, getImageConsentInfo } = await import("@/lib/images/ai-providers");
const { aspectFitSize, matchAspectRatio, prepareForImageAi } = await import("@/lib/images/processing");
const { aiConsentRequiredError, readAiConsent } = await import("@/lib/ai/consent");
const { AI_IMAGE_CONSENT_REQUIRED_MESSAGE, isConsentRequiredMessage, AI_CONSENT_REQUIRED_MESSAGE } = await import("@/lib/ai/job-status");

const ENV_KEYS = ["AI_GATEWAY_API_KEY", "VERCEL", "VERCEL_OIDC_TOKEN", "IMAGE_AI_MODEL", "IMAGE_AI_SIZE", "IMAGE_AI_ZDR", "IMAGE_AI_PROVIDER", "E2E_IMAGE_AI_MOCK"];
const CONTEXT = Symbol.for("@vercel/request-context");
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  delete (globalThis as Record<symbol, unknown>)[CONTEXT];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 180, g: 170, b: 150 } } }).jpeg().toBuffer();
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Anweisungen an das Bildmodell", () => {
  it("lassen beim Aufräumen Raum, Ausstattung und Mängel unverändert und fügen nichts hinzu", () => {
    const prompt = buildImageAiPrompt("declutter");
    expect(prompt).toContain("Keep exactly the same room");
    expect(prompt).toMatch(/windows and window frames, doors/);
    expect(prompt).toMatch(/view through the windows/);
    expect(prompt).toMatch(/damage or wear .* exactly as it is/);
    expect(prompt).toContain("Do not add any new furniture or decoration.");
    expect(prompt).toContain("no people");
  });

  it("richten im gewählten Raum und Stil ein, mit Standardwerten", () => {
    const prompt = buildImageAiPrompt("virtual_staging", { roomType: "bedroom", style: "scandinavian" });
    expect(prompt).toContain("photo of a bedroom");
    expect(prompt).toContain("Scandinavian: light oak");
    expect(prompt).toContain("Replace only movable furniture");
    expect(prompt).toContain("Keep exactly the same room");
    expect(buildImageAiPrompt("virtual_staging")).toContain("photo of a living room into an interior design proposal in a modern");
  });
});

describe("Anfrage an das Vercel AI Gateway", () => {
  const input = { image: Buffer.from("bild"), mimeType: "image/jpeg", roomType: "kitchen" as const, style: "minimal" as const };

  it("sendet das Foto als Data-URL und verlangt kein Training, standardmässig auch keine Speicherung", () => {
    const body = buildEditRequest("virtual_staging", input, { model: "google/gemini-3.1-flash-image", zeroDataRetention: true });
    expect(body).toMatchObject({
      model: "google/gemini-3.1-flash-image",
      n: 1,
      images: [{ image_url: `data:image/jpeg;base64,${Buffer.from("bild").toString("base64")}` }],
      providerOptions: { gateway: { disallowPromptTraining: true, zeroDataRetention: true } },
    });
    expect(body.prompt).toContain("photo of a kitchen");
    expect("size" in body).toBe(false);

    const withoutZdr = buildEditRequest("declutter", input, { model: "bfl/flux-3-image", size: "1536x1536", zeroDataRetention: false });
    expect(withoutZdr.providerOptions.gateway).toEqual({ disallowPromptTraining: true });
    expect(withoutZdr.size).toBe("1536x1536");
  });

  it("übersetzt Fehler in verständliche Meldungen und unterscheidet endgültige von vorübergehenden", () => {
    expect(mapGatewayError(402)).toMatchObject({ permanent: true, status: 402 });
    expect(mapGatewayError(402).message).toContain("Guthaben bzw. Monatsbudget");
    for (const status of [401, 403, 400, 404]) expect(mapGatewayError(status).permanent).toBe(true);
    for (const status of [429, 500, 503]) expect(mapGatewayError(status).permanent).toBe(false);
    for (const status of [400, 402, 429]) expect(mapGatewayError(status).message).toMatch(/Es wurde nichts verändert\.$/);
    expect(gatewayErrorDetail({ error: { type: "quota_for_entity_exceeded", message: "Project budget exceeded" } })).toBe(
      "quota_for_entity_exceeded: Project budget exceeded",
    );
    expect(gatewayErrorDetail({ error: "No providers that disallow prompt training" })).toBe("No providers that disallow prompt training");
    expect(gatewayErrorDetail(null)).toBe("");
  });

  it("liest das Bild aus b64_json oder einer Data-URL und lehnt leere Antworten ab", () => {
    const png = Buffer.alloc(200, 7);
    expect(parseEditResponse({ data: [{ b64_json: png.toString("base64") }] })).toEqual(png);
    expect(parseEditResponse({ data: [{ url: `data:image/png;base64,${png.toString("base64")}` }] })).toEqual(png);
    for (const body of [{ data: [] }, { data: [{ url: "https://example.com/bild.png" }] }, null, { data: [{ b64_json: "" }] }]) {
      expect(() => parseEditResponse(body)).toThrow(ImageAiProviderError);
    }
  });

  it("meldet sich mit API-Schlüssel, sonst mit dem OIDC-Token der Funktion an", () => {
    expect(resolveGatewayToken()).toBeNull();
    process.env.VERCEL_OIDC_TOKEN = "build-token";
    expect(resolveGatewayToken()).toBe("build-token");
    (globalThis as Record<symbol, unknown>)[CONTEXT] = { get: () => ({ headers: { "x-vercel-oidc-token": "header-token" } }) };
    expect(resolveGatewayToken()).toBe("header-token");
    process.env.AI_GATEWAY_API_KEY = " key-123 ";
    expect(resolveGatewayToken()).toBe("key-123");
  });

  it("schätzt die Kosten nach Modell und Grösse", () => {
    expect(estimateImageCostUsd("google/gemini-3.1-flash-image")).toBe(0.067);
    expect(estimateImageCostUsd("google/gemini-3.1-flash-image", "2K")).toBe(0.101);
    expect(estimateImageCostUsd("bfl/flux-3-image", "unbekannt")).toBe(0.048);
    expect(estimateImageCostUsd("openai/gpt-image-2")).toBeUndefined();
  });
});

describe("Anbieter vercel-ai-gateway", () => {
  const input = { image: Buffer.from("bild"), mimeType: "image/jpeg" };
  const png = Buffer.alloc(300, 9);

  it("ist auf Vercel (OIDC) oder mit API-Schlüssel eingerichtet", () => {
    expect(vercelGatewayProvider.isConfigured()).toBe(false);
    process.env.VERCEL = "1";
    expect(vercelGatewayProvider.isConfigured()).toBe(true);
    delete process.env.VERCEL;
    process.env.AI_GATEWAY_API_KEY = "key";
    expect(vercelGatewayProvider.isConfigured()).toBe(true);
    expect(vercelGatewayProvider.capabilities).toEqual(["declutter", "virtual_staging"]);
  });

  it("ruft /v1/images/edits mit dem Standardmodell auf und liefert Bild, Modell und Kostenschätzung", async () => {
    process.env.AI_GATEWAY_API_KEY = "key";
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: [{ b64_json: png.toString("base64") }] }));
    vi.stubGlobal("fetch", fetchMock);
    const output = await vercelGatewayProvider.run("declutter", input);
    expect(output).toMatchObject({ model: DEFAULT_IMAGE_MODEL, costUsd: 0.067 });
    expect(output.image).toEqual(png);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai-gateway.vercel.sh/v1/images/edits");
    expect(init.headers).toMatchObject({ Authorization: "Bearer key" });
    expect(JSON.parse(String(init.body))).toMatchObject({ model: DEFAULT_IMAGE_MODEL, providerOptions: { gateway: { zeroDataRetention: true } } });
  });

  it("verwendet IMAGE_AI_MODEL, IMAGE_AI_SIZE und IMAGE_AI_ZDR=0", async () => {
    process.env.AI_GATEWAY_API_KEY = "key";
    process.env.IMAGE_AI_MODEL = "bfl/flux-3-image";
    process.env.IMAGE_AI_SIZE = "1536x1536";
    process.env.IMAGE_AI_ZDR = "0";
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: [{ b64_json: png.toString("base64") }] }));
    vi.stubGlobal("fetch", fetchMock);
    const output = await vercelGatewayProvider.run("virtual_staging", input);
    expect(output).toMatchObject({ model: "bfl/flux-3-image", costUsd: 0.07 });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ model: "bfl/flux-3-image", size: "1536x1536", providerOptions: { gateway: { disallowPromptTraining: true } } });
    expect(body.providerOptions.gateway.zeroDataRetention).toBeUndefined();
  });

  it("wiederholt eine schnelle Überlastung einmal, ein aufgebrauchtes Budget nicht", async () => {
    process.env.AI_GATEWAY_API_KEY = "key";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const retrying = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: "überlastet" } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ b64_json: png.toString("base64") }] }));
    vi.stubGlobal("fetch", retrying);
    await expect(vercelGatewayProvider.run("declutter", input)).resolves.toMatchObject({ image: png });
    expect(retrying).toHaveBeenCalledTimes(2);

    const budget = vi.fn(async () => jsonResponse(402, { error: { type: "quota_for_entity_exceeded", message: "Project budget exceeded" } }));
    vi.stubGlobal("fetch", budget);
    await expect(vercelGatewayProvider.run("declutter", input)).rejects.toMatchObject({ permanent: true, status: 402 });
    expect(budget).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("lehnt ohne Anmeldung und für nicht unterstützte Funktionen ab, ohne das Gateway aufzurufen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(vercelGatewayProvider.run("declutter", input)).rejects.toMatchObject({ permanent: true, status: 401 });
    process.env.AI_GATEWAY_API_KEY = "key";
    await expect(vercelGatewayProvider.run("perspective", input)).rejects.toBeInstanceOf(ImageAiProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Auswahl des Anbieters", () => {
  it("kennt vercel-ai-gateway und lässt den Testanbieter nur lokal mit ausdrücklichem Schalter zu", () => {
    expect(getImageAiStatus()).toMatchObject({ configured: false, provider: null });
    process.env.IMAGE_AI_PROVIDER = "vercel-ai-gateway";
    process.env.VERCEL = "1";
    expect(getImageAiStatus()).toMatchObject({ configured: true, requested: "vercel-ai-gateway" });

    process.env.IMAGE_AI_PROVIDER = "e2e-mock";
    process.env.E2E_IMAGE_AI_MOCK = "1";
    // Auf Vercel nie verfügbar
    expect(isE2eMockAllowed()).toBe(false);
    expect(getImageAiStatus()).toMatchObject({ configured: false, provider: null });
    delete process.env.VERCEL;
    expect(isE2eMockAllowed()).toBe(true);
    expect(getImageAiStatus()).toMatchObject({ configured: true });
  });

  it("nennt im Einwilligungsdialog den Anbieter des Bildmodells", () => {
    expect(getImageConsentInfo()).toEqual({ recipient: "Google (USA)", noRetention: true });
    process.env.IMAGE_AI_MODEL = "bfl/flux-3-image";
    process.env.IMAGE_AI_ZDR = "0";
    expect(getImageConsentInfo()).toEqual({ recipient: "Black Forest Labs (Deutschland)", noRetention: false });
    expect(imageModelRecipient("openai/gpt-image-2")).toBe("OpenAI (USA)");
  });

  it("zählt Designvorschläge als KI-Visualisierungen", () => {
    expect(imageAiJobType("declutter")).toBe("virtual_staging");
    expect(imageAiJobType("virtual_staging")).toBe("virtual_staging");
    expect(imageAiJobType("perspective")).toBe("image_enhance");
  });
});

describe("Bildaufbereitung für die Bild-KI", () => {
  it("berechnet den mittigen Zuschnitt auf das Seitenverhältnis der Vorlage", () => {
    expect(aspectFitSize({ width: 1184, height: 864 }, 4 / 3)).toEqual({ width: 1152, height: 864 });
    expect(aspectFitSize({ width: 1024, height: 1024 }, 4 / 3)).toEqual({ width: 1024, height: 768 });
    expect(aspectFitSize({ width: 1024, height: 1024 }, 3 / 4)).toEqual({ width: 768, height: 1024 });
    expect(aspectFitSize({ width: 1536, height: 1024 }, 3 / 2)).toEqual({ width: 1536, height: 1024 });
  });

  it("verkleinert die Vorlage, entfernt Metadaten und gleicht das Ergebnis an", async () => {
    const withExif = await sharp(await jpeg(3000, 2250)).withMetadata({ exif: { IFD0: { Copyright: "Test" } } }).jpeg().toBuffer();
    const prepared = await prepareForImageAi(withExif);
    expect(prepared).toMatchObject({ width: 2048, height: 1536 });
    const meta = await sharp(prepared.buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();

    const square = await sharp(await jpeg(1024, 1024)).png().toBuffer();
    const matched = await sharp(await matchAspectRatio(square, prepared)).metadata();
    expect([matched.width, matched.height]).toEqual([1024, 768]);
    const same = await jpeg(1152, 864);
    expect(await matchAspectRatio(same, prepared)).toBe(same);
  });
});

describe("Einwilligung zur Bild-KI", () => {
  function fakeClient(row: Record<string, unknown> | null) {
    const selected: string[] = [];
    const chain = {
      select: (columns: string) => {
        selected.push(columns);
        return chain;
      },
      eq: () => chain,
      maybeSingle: async () => ({ data: row, error: null }),
    };
    return { client: { from: () => chain } as unknown as SupabaseClient<Database>, selected };
  }

  it("ist getrennt von der Einwilligung für KI-Texte", async () => {
    const both = fakeClient({ ai_processing_consent: true, ai_image_consent: false });
    expect(await readAiConsent(both.client, "u1", "text")).toBe(true);
    expect(await readAiConsent(both.client, "u1", "image")).toBe(false);
    expect(both.selected).toEqual(["ai_processing_consent", "ai_image_consent"]);
    expect(await readAiConsent(fakeClient({ ai_image_consent: true }).client, "u1", "image")).toBe(true);
  });

  it("meldet die fehlende Bild-Einwilligung erkennbar, auch als Fehlertext eines Auftrags", () => {
    expect(aiConsentRequiredError("image")).toMatchObject({
      message: AI_IMAGE_CONSENT_REQUIRED_MESSAGE,
      details: { consentRequired: true, consentKind: "image" },
    });
    expect(isConsentRequiredMessage(AI_IMAGE_CONSENT_REQUIRED_MESSAGE)).toBe(true);
    expect(isConsentRequiredMessage(AI_CONSENT_REQUIRED_MESSAGE)).toBe(true);
    expect(isConsentRequiredMessage("Etwas anderes")).toBe(false);
  });
});
