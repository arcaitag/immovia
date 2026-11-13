import "server-only";

import { serverEnv } from "@/lib/env";
import { e2eMockProvider, isE2eMockAllowed } from "@/lib/images/ai-providers/e2e-mock";
import { imageModelRecipient, type ImageAiCapability, type ImageAiProvider, type ImageConsentInfo } from "@/lib/images/ai-providers/types";
import { imageModel, vercelGatewayProvider } from "@/lib/images/ai-providers/vercel-gateway";

/**
 * Registrierte Bild-KI-Anbieter. Aktiviert über IMAGE_AI_PROVIDER=<id>:
 * - vercel-ai-gateway: Bildmodelle über das Vercel AI Gateway (Modell: IMAGE_AI_MODEL)
 * - e2e-mock: nur für lokale Tests (siehe e2e-mock.ts), auf Vercel nie verfügbar
 */
function providers(): Record<string, ImageAiProvider> {
  return {
    [vercelGatewayProvider.id]: vercelGatewayProvider,
    ...(isE2eMockAllowed() ? { [e2eMockProvider.id]: e2eMockProvider } : {}),
  };
}

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
      message: "Die Bild-KI ist auf Immovia noch nicht eingerichtet. Grundkorrekturen funktionieren trotzdem.",
    };
  }
  const provider = providers()[requested];
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

/** Empfänger der Fotos und Zusage «keine Speicherung» für den Einwilligungsdialog. */
export function getImageConsentInfo(): ImageConsentInfo {
  const status = getImageAiStatus();
  if (status.provider?.id === e2eMockProvider.id) return { recipient: "Testanbieter (lokal)", noRetention: true };
  return { recipient: imageModelRecipient(imageModel()), noRetention: serverEnv.imageAiZeroDataRetention };
}

export function getImageAiProvider(capability: ImageAiCapability): ImageAiProvider | null {
  const status = getImageAiStatus();
  if (!status.provider || !status.provider.capabilities.includes(capability)) return null;
  return status.provider;
}
