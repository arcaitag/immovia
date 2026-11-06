import { describe, expect, it } from "vitest";
import {
  DOCUMENT_MAX_BYTES,
  detectFileMime,
  documentCreateSchema,
  documentGrantSchema,
  documentStoragePath,
  documentUpdateSchema,
  sanitizeFileName,
  titleFromFileName,
} from "@/lib/validation/document";
import { ATTACHMENT_MAX_BYTES, attachmentOnlyBody, attachmentStoragePath, reportSchema, sendMessageSchema } from "@/lib/validation/message";

const PROPERTY = "3f0c2f9e-8b0a-4c51-9f3e-2a4b5c6d7e8f";
const DOCUMENT = "0b5e2f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const CONVERSATION = "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const validDocument = {
  id: DOCUMENT,
  propertyId: PROPERTY,
  fileName: "Grundbuchauszug 2026.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1_200_000,
  title: "Grundbuchauszug",
  category: "land_register",
  visibility: "owner",
  containsPersonalData: true,
};

describe("Dateien im Dokumentencenter", () => {
  it("erkennt erlaubte Dateitypen auch ohne Browserangabe", () => {
    expect(detectFileMime({ type: "application/pdf", name: "a.pdf" })).toBe("application/pdf");
    expect(detectFileMime({ type: "", name: "Foto.JPEG" })).toBe("image/jpeg");
    expect(detectFileMime({ type: "image/jpg", name: "x" })).toBe("image/jpeg");
    expect(detectFileMime({ type: "", name: "plan.webp" })).toBe("image/webp");
    expect(detectFileMime({ type: "application/zip", name: "a.zip" })).toBeNull();
    expect(detectFileMime({ type: "image/svg+xml", name: "logo.svg" })).toBeNull();
  });

  it("baut Speicherpfade nach Konvention documents/{propertyId}/{documentId}.{ext}", () => {
    expect(documentStoragePath(PROPERTY, DOCUMENT, "application/pdf")).toBe(`${PROPERTY}/${DOCUMENT}.pdf`);
    expect(documentStoragePath(PROPERTY, DOCUMENT, "image/jpeg")).toBe(`${PROPERTY}/${DOCUMENT}.jpg`);
  });

  it("bereinigt Dateinamen und schlägt Titel vor", () => {
    expect(sanitizeFileName("../../etc/passwd\u0000.pdf")).toBe("....etcpasswd.pdf");
    expect(sanitizeFileName("   ")).toBe("Datei");
    expect(titleFromFileName("grundriss_eg_2024.pdf")).toBe("grundriss eg 2024");
  });

  it("akzeptiert gültige Dokumente bis 25 MB", () => {
    expect(documentCreateSchema.safeParse(validDocument).success).toBe(true);
    expect(documentCreateSchema.safeParse({ ...validDocument, sizeBytes: DOCUMENT_MAX_BYTES }).success).toBe(true);
    expect(documentCreateSchema.safeParse({ ...validDocument, sizeBytes: DOCUMENT_MAX_BYTES + 1 }).success).toBe(false);
    expect(documentCreateSchema.safeParse({ ...validDocument, mimeType: "text/html" }).success).toBe(false);
  });

  it("verhindert, dass Dokumente mit Personendaten öffentlich werden", () => {
    const result = documentCreateSchema.safeParse({ ...validDocument, visibility: "public" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["visibility"]);
    expect(documentUpdateSchema.safeParse({ documentId: DOCUMENT, title: "x", category: "other", visibility: "public", containsPersonalData: true }).success).toBe(false);
    expect(documentUpdateSchema.safeParse({ documentId: DOCUMENT, title: "x", category: "other", visibility: "public", containsPersonalData: false }).success).toBe(true);
  });

  it("prüft Freigaben mit optionalem Ablaufdatum", () => {
    expect(documentGrantSchema.safeParse({ documentId: DOCUMENT, granteeId: PROPERTY, expiresOn: "" }).success).toBe(true);
    expect(documentGrantSchema.safeParse({ documentId: DOCUMENT, granteeId: PROPERTY, expiresOn: "2026-12-31" }).success).toBe(true);
    expect(documentGrantSchema.safeParse({ documentId: DOCUMENT, granteeId: PROPERTY, expiresOn: "31.12.2026" }).success).toBe(false);
  });
});

describe("Nachrichten und Anhänge", () => {
  const attachment = {
    path: attachmentStoragePath(CONVERSATION, DOCUMENT, "application/pdf"),
    name: "Finanzierungsbestätigung.pdf",
    mime: "application/pdf",
    size: 250_000,
  };

  it("akzeptiert Text, Anhang oder beides", () => {
    expect(sendMessageSchema.safeParse({ id: DOCUMENT, conversationId: CONVERSATION, body: "Hallo" }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ id: DOCUMENT, conversationId: CONVERSATION, body: "", attachment }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ id: DOCUMENT, conversationId: CONVERSATION, body: "   " }).success).toBe(false);
    expect(attachmentOnlyBody("Plan.pdf")).toBe("Anhang: Plan.pdf");
  });

  it("lässt nur Anhänge im Ordner der eigenen Konversation zu", () => {
    const foreign = { ...attachment, path: `${PROPERTY}/${DOCUMENT}.pdf` };
    expect(sendMessageSchema.safeParse({ id: DOCUMENT, conversationId: CONVERSATION, body: "x", attachment: foreign }).success).toBe(false);
    const traversal = { ...attachment, path: `${CONVERSATION}/../${PROPERTY}/${DOCUMENT}.pdf` };
    expect(sendMessageSchema.safeParse({ id: DOCUMENT, conversationId: CONVERSATION, body: "x", attachment: traversal }).success).toBe(false);
    const wrongExt = { ...attachment, path: `${CONVERSATION}/${DOCUMENT}.png` };
    expect(sendMessageSchema.safeParse({ id: DOCUMENT, conversationId: CONVERSATION, body: "x", attachment: wrongExt }).success).toBe(false);
  });

  it("begrenzt Anhänge auf 10 MB und erlaubte Typen", () => {
    expect(sendMessageSchema.safeParse({ id: DOCUMENT, conversationId: CONVERSATION, body: "x", attachment: { ...attachment, size: ATTACHMENT_MAX_BYTES + 1 } }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ id: DOCUMENT, conversationId: CONVERSATION, body: "x", attachment: { ...attachment, mime: "image/gif" } }).success).toBe(false);
  });

  it("prüft Meldungen", () => {
    expect(reportSchema.safeParse({ targetType: "message", targetId: DOCUMENT, reason: "spam" }).success).toBe(true);
    expect(reportSchema.safeParse({ targetType: "listing", targetId: DOCUMENT, reason: "spam" }).success).toBe(false);
    expect(reportSchema.safeParse({ targetType: "conversation", targetId: DOCUMENT, reason: "nicht_vorhanden" }).success).toBe(false);
  });
});
