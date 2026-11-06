import { readFileSync } from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Schriften für PDFs.
 * @react-pdf/renderer (fontkit) kann die variablen WOFF2-Dateien von Fontsource nicht
 * einbetten (Fehler beim Subsetting). Deshalb liegen in ./fonts statische TTF-Instanzen
 * von Inter (400/600/700) und Manrope (700/800), erzeugt aus @fontsource-variable mit
 * fontTools (varLib.instancer, Latin + Latin Extended). Lizenz: SIL OFL 1.1 (siehe OFL-*.txt).
 * Fehlen die Dateien (z. B. nicht im Deployment enthalten), wird Helvetica verwendet.
 */

export interface PdfFontStyle {
  fontFamily: string;
  fontWeight?: number;
}

export interface PdfFonts {
  custom: boolean;
  body(weight?: 400 | 600 | 700): PdfFontStyle;
  display(weight?: 700 | 800): PdfFontStyle;
}

function readFont(read: () => Buffer): string | null {
  try {
    return `data:font/ttf;base64,${read().toString("base64")}`;
  } catch {
    return null;
  }
}

let cached: PdfFonts | null = null;

const HELVETICA: PdfFonts = {
  custom: false,
  body: (weight = 400) => ({ fontFamily: weight >= 600 ? "Helvetica-Bold" : "Helvetica" }),
  display: () => ({ fontFamily: "Helvetica-Bold" }),
};

export function ensurePdfFonts(): PdfFonts {
  if (cached) return cached;
  // Silbentrennung aus: Die Standardtrennung ist englisch und trennt deutsche Wörter falsch.
  Font.registerHyphenationCallback((word) => [word]);

  // Literale Pfade, damit die Dateien beim Build erkannt und mitgeliefert werden
  const interRegular = readFont(() => readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Inter-Regular.ttf")));
  const interSemiBold = readFont(() => readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Inter-SemiBold.ttf")));
  const interBold = readFont(() => readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Inter-Bold.ttf")));
  const manropeBold = readFont(() => readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Manrope-Bold.ttf")));
  const manropeExtraBold = readFont(() => readFileSync(path.join(process.cwd(), "src/lib/pdf/fonts/Manrope-ExtraBold.ttf")));

  if (!interRegular || !interSemiBold || !interBold || !manropeBold || !manropeExtraBold) {
    console.warn("[pdf] Schriftdateien nicht gefunden, verwende Helvetica");
    cached = HELVETICA;
    return cached;
  }

  Font.register({
    family: "Inter",
    fonts: [
      { src: interRegular, fontWeight: 400 },
      { src: interSemiBold, fontWeight: 600 },
      { src: interBold, fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Manrope",
    fonts: [
      { src: manropeBold, fontWeight: 700 },
      { src: manropeExtraBold, fontWeight: 800 },
    ],
  });
  cached = {
    custom: true,
    body: (weight = 400) => ({ fontFamily: "Inter", fontWeight: weight }),
    display: (weight = 800) => ({ fontFamily: "Manrope", fontWeight: weight }),
  };
  return cached;
}
