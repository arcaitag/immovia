import "server-only";

import sharp from "sharp";
import type { ImageAiCapability, ImageAiInput, ImageAiOutput, ImageAiProvider } from "@/lib/images/ai-providers/types";

/**
 * NUR FÜR AUTOMATISIERTE TESTS (lokal): ersetzt den externen Bild-KI-Anbieter durch eine
 * erkennbar veränderte Kopie des Eingabebildes, damit der Ablauf (Auftrag, Prüfung, Freigabe)
 * ohne Internetzugang getestet werden kann.
 *
 * Aktiv nur mit IMAGE_AI_PROVIDER=e2e-mock UND E2E_IMAGE_AI_MOCK=1 und nie auf Vercel (dort ist
 * VERCEL=1 immer gesetzt). So kann er in keiner Bereitstellung Ergebnisse vortäuschen.
 */
export function isE2eMockAllowed(): boolean {
  return process.env.E2E_IMAGE_AI_MOCK === "1" && process.env.VERCEL !== "1";
}

export const e2eMockProvider: ImageAiProvider = {
  id: "e2e-mock",
  label: "Testanbieter (nur lokal)",
  capabilities: ["declutter", "virtual_staging"],
  isConfigured: isE2eMockAllowed,
  async run(_capability: ImageAiCapability, input: ImageAiInput): Promise<ImageAiOutput> {
    if (!isE2eMockAllowed()) throw new Error("Der Testanbieter ist hier nicht erlaubt.");
    // Sichtbar anders (heller, wärmer), Seitenverhältnis wie die Vorlage
    const image = await sharp(input.image).modulate({ brightness: 1.15, saturation: 0.85 }).tint({ r: 255, g: 240, b: 220 }).png().toBuffer();
    return { image, mimeType: "image/png", model: "e2e-mock", costUsd: 0 };
  },
};
