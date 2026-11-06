/**
 * Schnittstelle für externe Bild-KI-Anbieter (Perspektivkorrektur, virtuelle Möblierung).
 * Grundkorrekturen (Helligkeit, Kontrast, Weissabgleich …) laufen ohne KI mit sharp
 * (src/lib/images/processing.ts) und brauchen keinen Anbieter.
 */

export type ImageAiCapability = "perspective" | "virtual_staging";

export const IMAGE_AI_CAPABILITIES: Record<ImageAiCapability, { label: string; description: string; marksAsVisualization: boolean }> = {
  perspective: {
    label: "Perspektive korrigieren",
    description: "Stürzende Linien begradigen. Das Ergebnis wird als neues Bild gespeichert, das Original bleibt erhalten.",
    marksAsVisualization: false,
  },
  virtual_staging: {
    label: "Virtuelle Möblierung",
    description: "Leere Räume mit KI möblieren. Das Ergebnis wird als neues Bild gespeichert und sichtbar als «KI-Visualisierung» gekennzeichnet.",
    marksAsVisualization: true,
  },
};

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
}

export interface ImageAiProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: ImageAiCapability[];
  isConfigured(): boolean;
  run(capability: ImageAiCapability, input: ImageAiInput): Promise<ImageAiOutput>;
}
