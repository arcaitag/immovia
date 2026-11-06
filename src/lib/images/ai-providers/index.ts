import "server-only";

import { serverEnv } from "@/lib/env";
import type { ImageAiCapability, ImageAiProvider } from "@/lib/images/ai-providers/types";

/**
 * Registrierte Bild-KI-Anbieter. Aktuell ist BEWUSST keiner angebunden: Ohne Vertrag,
 * Zugangsdaten und geprüfte API wäre jede Integration geraten. Ein Anbieter wird angebunden,
 * indem er ImageAiProvider implementiert, hier eingetragen und über IMAGE_AI_PROVIDER=<id>
 * (plus eigene Zugangsdaten) aktiviert wird.
 */
const PROVIDERS: Record<string, ImageAiProvider> = {};

export interface ImageAiStatus {
  configured: boolean;
  provider: ImageAiProvider | null;
  requested: string | null;
  message: string;
}

export function getImageAiStatus(): ImageAiStatus {
  const requested = serverEnv.imageAiProvider?.trim() || null;
  if (!requested) {
    return {
      configured: false,
      provider: null,
      requested: null,
      message: "Für diese Funktionen ist noch kein Bild-KI-Anbieter eingerichtet (IMAGE_AI_PROVIDER). Grundkorrekturen funktionieren trotzdem.",
    };
  }
  const provider = PROVIDERS[requested];
  if (!provider) {
    return {
      configured: false,
      provider: null,
      requested,
      message: `Der Bild-KI-Anbieter «${requested}» wird von dieser Version nicht unterstützt.`,
    };
  }
  if (!provider.isConfigured()) {
    return { configured: false, provider: null, requested, message: `Der Bild-KI-Anbieter «${provider.label}» ist unvollständig konfiguriert.` };
  }
  return { configured: true, provider, requested, message: `Anbieter: ${provider.label}` };
}

export function getImageAiProvider(capability: ImageAiCapability): ImageAiProvider | null {
  const status = getImageAiStatus();
  if (!status.provider || !status.provider.capabilities.includes(capability)) return null;
  return status.provider;
}
