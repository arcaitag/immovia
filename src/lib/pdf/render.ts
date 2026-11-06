import type { ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

/** Zählt die Seiten eines von pdfkit erzeugten PDFs (Seitenobjekte sind unkomprimiert). */
export function countPdfPages(buffer: Buffer): number {
  const matches = buffer.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g);
  return matches ? matches.length : 0;
}

export async function renderPdf(document: ReactElement<DocumentProps>): Promise<{ buffer: Buffer; pageCount: number }> {
  const buffer = await renderToBuffer(document);
  return { buffer, pageCount: countPdfPages(buffer) };
}

/** Dateiname ohne Sonderzeichen (für Content-Disposition). */
export function pdfFileName(base: string, suffix?: string): string {
  const clean = base
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${clean || "immovia"}${suffix ? `-${suffix}` : ""}.pdf`;
}
