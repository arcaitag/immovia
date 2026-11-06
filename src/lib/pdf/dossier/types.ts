import type { OfferType } from "@/lib/constants";
import type { PdfTheme } from "@/lib/pdf/theme";
import type { DossierSectionKey, DossierTemplateId } from "@/lib/pdf/dossier/options";

/** Bild für das PDF: bereits als JPEG/PNG (react-pdf unterstützt kein WebP). */
export interface PdfImage {
  data: Buffer;
  format: "jpg" | "png";
  width: number;
  height: number;
  caption: string | null;
  isAiVisualization: boolean;
}

/** Vollständig aufbereiteter Inhalt eines Dossiers (nur vorhandene Angaben). */
export interface DossierContent {
  templateId: DossierTemplateId;
  theme: PdfTheme;
  isPreview: boolean;
  generatedAt: string;
  title: string;
  /** z. B. «Wohnung · 4.5 Zimmer · 112 m²» */
  subtitle: string;
  locationLabel: string;
  offerType: OfferType;
  priceLabel: string;
  priceValue: string;
  priceNote: string | null;
  intro: string | null;
  highlights: string[];
  keyFacts: Array<{ label: string; value: string }>;
  description: string | null;
  locationText: string | null;
  locationFeatures: string[];
  viewDescription: string | null;
  equipmentText: string | null;
  equipmentItems: string[];
  renovations: Array<{ year: number; category: string; description: string }>;
  cover: PdfImage | null;
  gallery: PdfImage[];
  floorPlans: PdfImage[];
  documents: Array<{ title: string; category: string }>;
  contact: { name: string | null; company: string | null; phone: string | null; email: string | null };
  listingUrl: string | null;
  qrCode: Buffer | null;
  sections: Record<DossierSectionKey, boolean>;
}
