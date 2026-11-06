import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as React from "react";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DossierDocument } from "@/lib/pdf/dossier/document";
import { DOSSIER_SECTION_KEYS, type DossierTemplateId } from "@/lib/pdf/dossier/options";
import type { DossierContent, PdfImage } from "@/lib/pdf/dossier/types";
import { DEFAULT_TEMPLATE_THEMES } from "@/lib/pdf/theme";
import { countPdfPages, pdfFileName, renderPdf } from "@/lib/pdf/render";
import { ValuationReportDocument, type ValuationReportContent } from "@/lib/pdf/valuation/document";

/** Optional: PDF_TEST_OUT=/pfad schreibt die PDFs zur Sichtkontrolle. */
function maybeWrite(name: string, buffer: Buffer) {
  const dir = process.env.PDF_TEST_OUT;
  if (dir) writeFileSync(path.join(dir, name), buffer);
}

function baseContent(templateId: DossierTemplateId, images: { cover: PdfImage | null; gallery: PdfImage[] } = { cover: null, gallery: [] }): DossierContent {
  return {
    templateId,
    theme: DEFAULT_TEMPLATE_THEMES[templateId],
    isPreview: false,
    generatedAt: "2026-11-06T10:00:00.000Z",
    title: "Helle 4.5-Zimmer-Wohnung mit Balkon",
    subtitle: "Wohnung · 4.5 Zimmer · 112 m²",
    locationLabel: "8004 Zürich",
    offerType: "sale",
    priceLabel: "Kaufpreis",
    priceValue: "CHF 1’250’000",
    priceNote: null,
    intro: "Gepflegte Wohnung im 3. Obergeschoss mit Lift und Balkon. Grösse und Strasse «Äussere» – ÄÖÜ äöü.",
    highlights: ["Balkon", "Lift", "Tiefgaragenplatz", "Renovation 2021 (Küche)"],
    keyFacts: [
      { label: "Zimmer", value: "4.5" },
      { label: "Wohnfläche", value: "112 m²" },
      { label: "Baujahr", value: "1998" },
      { label: "Stockwerk", value: "3. OG" },
      { label: "Heizung", value: "Wärmepumpe" },
      { label: "Parkplätze", value: "1 Tiefgaragenplatz" },
    ],
    description: "Erster Absatz der Beschreibung.\n\nZweiter Absatz mit weiteren Angaben.",
    locationText: null,
    locationFeatures: ["Nähe ÖV"],
    viewDescription: null,
    equipmentText: "Moderne Küche mit Geschirrspüler.",
    equipmentItems: ["Balkon", "Lift", "Keller"],
    renovations: [{ year: 2021, category: "Küche", description: "Neue Küche mit Steamer" }],
    cover: images.cover,
    gallery: images.gallery,
    floorPlans: [],
    documents: [{ title: "Grundbuchauszug", category: "land_register" }],
    contact: { name: "Anna Muster", company: null, phone: "+41 79 123 45 67", email: "anna@example.ch" },
    listingUrl: null,
    qrCode: null,
    sections: Object.fromEntries(DOSSIER_SECTION_KEYS.map((k) => [k, true])) as DossierContent["sections"],
  };
}

async function sampleImage(color: { r: number; g: number; b: number }, isAiVisualization = false): Promise<PdfImage> {
  const data = await sharp({ create: { width: 800, height: 600, channels: 3, background: color } }).jpeg({ quality: 80 }).toBuffer();
  return { data, format: "jpg", width: 800, height: 600, caption: isAiVisualization ? "Wohnzimmer" : null, isAiVisualization };
}

describe("PDF-Erzeugung (ohne Netzwerkbilder)", () => {
  for (const template of ["modern", "premium", "classic"] as const) {
    it(`erzeugt ein Dossier mit Vorlage «${template}»`, async () => {
      const { buffer, pageCount } = await renderPdf(<DossierDocument content={baseContent(template)} />);
      expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
      expect(pageCount).toBeGreaterThanOrEqual(2);
      maybeWrite(`dossier-${template}.pdf`, buffer);
    }, 30_000);
  }

  it("bettet lokal erzeugte JPEG-Bilder ein (inkl. KI-Kennzeichnung)", async () => {
    const cover = await sampleImage({ r: 90, g: 138, b: 48 });
    const gallery = [await sampleImage({ r: 216, g: 235, b: 198 }), await sampleImage({ r: 39, g: 75, b: 50 }, true), await sampleImage({ r: 200, g: 200, b: 190 })];
    for (const template of ["modern", "premium", "classic"] as const) {
      const { buffer, pageCount } = await renderPdf(<DossierDocument content={baseContent(template, { cover, gallery })} />);
      expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
      expect(pageCount).toBeGreaterThanOrEqual(3);
      maybeWrite(`dossier-${template}-bilder.pdf`, buffer);
    }
  }, 60_000);

  it("erzeugt einen Bewertungsbericht mit und ohne Zahlen", async () => {
    const base: ValuationReportContent = {
      propertyTitle: "Wohnung · 4.5 Zimmer",
      locationLabel: "8004 Zürich",
      rent: false,
      createdAt: "2026-11-06T10:00:00.000Z",
      statusLabel: "Schätzung vorhanden",
      hasNumbers: true,
      estimatedValue: 1_180_000,
      valueLow: 1_090_000,
      valueHigh: 1_260_000,
      suggestedListPrice: 1_180_000,
      listPriceExplanation: "Gerundet.",
      confidenceLabel: "Tief",
      confidenceExplanation: "Grundlage sind 6 Angebotspreise.",
      summary: "Median der Angebotspreise.",
      explanation: null,
      quality: [{ label: "Vergleichsgebiet", value: "Umkreis 15 km" }],
      notes: [],
      missing: [],
      suggestions: [],
      sources: [{ name: "Angebotspreise auf Immovia", typeLabel: "Angebotspreise", description: "Keine Transaktionspreise.", dataAsOf: "2026-11-06", recordCount: 6, licenseNote: null }],
      comparables: [
        { location: "8003 Zürich", typeLabel: "Wohnung", rooms: 4.5, area: 108, price: 1_150_000, pricePerSqm: 10648, observedAt: "2026-10-01", distanceKm: 1.2 },
      ],
      areaLabel: "Wohnfläche",
      positive: [{ key: "elevator", label: "Lift", detail: "Ein Lift ist vorhanden.", direction: "positive" }],
      negative: [],
      disclaimer: "Ohne Gewähr.",
    };
    const withNumbers = await renderPdf(<ValuationReportDocument content={base} />);
    expect(withNumbers.buffer.subarray(0, 4).toString()).toBe("%PDF");
    maybeWrite("bewertung.pdf", withNumbers.buffer);

    const noNumbers = await renderPdf(
      <ValuationReportDocument
        content={{
          ...base,
          hasNumbers: false,
          estimatedValue: null,
          valueLow: null,
          valueHigh: null,
          suggestedListPrice: null,
          comparables: [],
          missing: ["Nur 2 vergleichbare Angebote gefunden."],
          suggestions: ["Später erneut versuchen."],
        }}
      />,
    );
    expect(noNumbers.buffer.subarray(0, 4).toString()).toBe("%PDF");
    maybeWrite("bewertung-ohne-daten.pdf", noNumbers.buffer);
  }, 30_000);

  it("verwendet Schriften ohne zusammengesetzte Glyphen und ohne GSUB (korrekte Textebene)", () => {
    // fontkit legt Komponenten-Glyphen (z. B. «:» aus zwei «.») beim Einbetten ohne Unicode an
    // und cacht sie prozessweit – in späteren PDFs fehlten dann «4» und «.» beim Kopieren/Suchen.
    for (const file of ["Inter-Regular", "Inter-SemiBold", "Inter-Bold", "Manrope-Bold", "Manrope-ExtraBold"]) {
      const font = readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts", `${file}.ttf`));
      const numTables = font.readUInt16BE(4);
      const tables = new Map<string, number>();
      for (let i = 0; i < numTables; i++) {
        const entry = 12 + i * 16;
        tables.set(font.toString("latin1", entry, entry + 4), font.readUInt32BE(entry + 8));
      }
      expect(tables.has("GSUB"), `${file}: GSUB vorhanden`).toBe(false);
      const head = tables.get("head")!;
      const loca = tables.get("loca")!;
      const glyf = tables.get("glyf")!;
      const numGlyphs = font.readUInt16BE(tables.get("maxp")! + 4);
      const longOffsets = font.readInt16BE(head + 50) === 1;
      const offset = (i: number) => (longOffsets ? font.readUInt32BE(loca + i * 4) : font.readUInt16BE(loca + i * 2) * 2);
      let composites = 0;
      for (let i = 0; i < numGlyphs; i++) {
        if (offset(i + 1) > offset(i) && font.readInt16BE(glyf + offset(i)) < 0) composites++;
      }
      expect(composites, `${file}: zusammengesetzte Glyphen`).toBe(0);
    }
  });

  it("zählt Seiten und bildet Dateinamen", () => {
    expect(countPdfPages(Buffer.from("/Type /Pages /Type /Page /Type /Page"))).toBe(2);
    expect(pdfFileName("Schöne Wohnung in Zürich!", "v2")).toBe("schoene-wohnung-in-zuerich-v2.pdf");
  });
});
