/**
 * Schnittstelle für externe Bild-KI-Anbieter (Designvorschläge, Perspektivkorrektur).
 * Grundkorrekturen (Helligkeit, Kontrast, Weissabgleich …) laufen ohne KI mit sharp
 * (src/lib/images/processing.ts) und brauchen keinen Anbieter.
 */

export type ImageAiCapability = "perspective" | "virtual_staging" | "declutter";

export const IMAGE_AI_CAPABILITIES: Record<
  ImageAiCapability,
  { label: string; description: string; marksAsVisualization: boolean; caption: string }
> = {
  perspective: {
    label: "Perspektive korrigieren",
    description: "Stürzende Linien begradigen. Das Ergebnis wird als neues Bild gespeichert, das Original bleibt erhalten.",
    marksAsVisualization: false,
    caption: "Perspektive mit Bild-KI korrigiert",
  },
  declutter: {
    label: "Aufräumen",
    description: "Kleinkram, Kabel und Persönliches entfernen, Licht ausgleichen. Möbel, Raum und Ausstattung bleiben.",
    marksAsVisualization: true,
    caption: "KI-Visualisierung: aufgeräumt",
  },
  virtual_staging: {
    label: "Neu einrichten",
    description: "Möbel und Dekoration im gewählten Stil, auch für leere Räume. Raum und feste Ausstattung bleiben.",
    marksAsVisualization: true,
    caption: "KI-Visualisierung: neu eingerichtet",
  },
};

/** Designvorschläge: Ergebnis ist eine gekennzeichnete KI-Visualisierung, die vor der Veröffentlichung geprüft wird. */
export const DESIGN_CAPABILITIES = ["declutter", "virtual_staging"] as const satisfies readonly ImageAiCapability[];

/** Auftragstyp der Warteschlange (job_type) und Kontingent: Designvorschläge zählen als KI-Visualisierungen. */
export function imageAiJobType(capability: ImageAiCapability): "image_enhance" | "virtual_staging" {
  return capability === "perspective" ? "image_enhance" : "virtual_staging";
}

export const STAGING_ROOM_TYPES = {
  living_room: "Wohnzimmer",
  bedroom: "Schlafzimmer",
  dining_room: "Esszimmer",
  kitchen: "Küche",
  office: "Arbeitszimmer",
  children_room: "Kinderzimmer",
} as const;
export type StagingRoomType = keyof typeof STAGING_ROOM_TYPES;

export const STAGING_STYLES = {
  modern: "Modern",
  scandinavian: "Skandinavisch",
  classic: "Klassisch",
  minimal: "Minimalistisch",
} as const;
export type StagingStyle = keyof typeof STAGING_STYLES;

export interface ImageAiInput {
  image: Buffer;
  mimeType: string;
  roomType?: StagingRoomType;
  style?: StagingStyle;
}

export interface ImageAiOutput {
  image: Buffer;
  mimeType: string;
  model?: string;
  /** Geschätzte Kosten in USD (Listenpreis des Modells), falls bekannt */
  costUsd?: number;
}

/** Angaben für Einwilligungsdialog und Datenschutz, aus der Konfiguration abgeleitet. */
export interface ImageConsentInfo {
  /** Anbieter des Bildmodells, z. B. «Google (USA)» */
  recipient: string;
  /** Wird bei jeder Anfrage verlangt, dass der Anbieter das Foto nicht speichert? */
  noRetention: boolean;
}

/** Anbieter eines Bildmodells im AI Gateway (Präfix der Modell-ID). */
export function imageModelRecipient(model: string): string {
  const creator = model.split("/")[0];
  switch (creator) {
    case "google":
      return "Google (USA)";
    case "bfl":
      return "Black Forest Labs (Deutschland)";
    case "openai":
      return "OpenAI (USA)";
    case "bytedance":
      return "ByteDance";
    default:
      return creator || "den Bild-KI-Anbieter";
  }
}

export interface ImageAiProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: ImageAiCapability[];
  isConfigured(): boolean;
  run(capability: ImageAiCapability, input: ImageAiInput): Promise<ImageAiOutput>;
}

/**
 * Fehler eines Anbieters mit Meldung für die Oberfläche. permanent = Wiederholen bringt nichts
 * (z. B. Guthaben aufgebraucht, Anmeldung fehlt, Anfrage abgelehnt).
 */
export class ImageAiProviderError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ImageAiProviderError";
  }
}
