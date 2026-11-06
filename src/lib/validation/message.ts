import { z } from "zod";
import { REPORT_REASONS, type ReportReason } from "@/lib/constants";
import { FILE_EXTENSION, FILE_MIME_TYPES, type FileMime } from "@/lib/validation/document";

/** Validierung für Nachrichten, Anhänge und Meldungen. */

export const MESSAGE_MAX_LENGTH = 5000;
/** 10 MB – entspricht dem Bucket «message-attachments» und der Tabelle messages. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MIME_TYPES = FILE_MIME_TYPES;
export type AttachmentMime = FileMime;

/** Speicherpfad gemäss Konvention: message-attachments/{conversationId}/{uuid}.{ext} (ohne Bucket). */
export function attachmentStoragePath(conversationId: string, fileId: string, mime: AttachmentMime): string {
  return `${conversationId}/${fileId}.${FILE_EXTENSION[mime]}`;
}

/** Nachrichtentext für reine Anhänge (die Datenbank verlangt einen Text). */
export function attachmentOnlyBody(fileName: string): string {
  return `Anhang: ${fileName}`.slice(0, MESSAGE_MAX_LENGTH);
}

export const attachmentSchema = z.object({
  path: z.string().min(1).max(300),
  name: z.string().trim().min(1).max(200),
  mime: z.enum(ATTACHMENT_MIME_TYPES, { error: "Erlaubt sind PDF, JPG, PNG und WEBP." }),
  size: z
    .number()
    .int()
    .min(1, "Die Datei ist leer.")
    .max(ATTACHMENT_MAX_BYTES, "Anhänge dürfen höchstens 10 MB gross sein."),
});
export type AttachmentInput = z.infer<typeof attachmentSchema>;

const UUID_PART = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

export const sendMessageSchema = z
  .object({
    id: z.guid(),
    conversationId: z.guid(),
    body: z.string().max(MESSAGE_MAX_LENGTH, `Nachrichten dürfen höchstens ${MESSAGE_MAX_LENGTH} Zeichen lang sein.`),
    attachment: attachmentSchema.nullish(),
  })
  .superRefine((value, ctx) => {
    if (!value.body.trim() && !value.attachment) {
      ctx.addIssue({ code: "custom", path: ["body"], message: "Bitte schreiben Sie eine Nachricht." });
    }
    if (value.attachment) {
      const ext = FILE_EXTENSION[value.attachment.mime];
      const pattern = new RegExp(`^${value.conversationId}/${UUID_PART}\\.${ext}$`, "i");
      if (!pattern.test(value.attachment.path)) {
        ctx.addIssue({ code: "custom", path: ["attachment"], message: "Ungültiger Anhang." });
      }
    }
  });
export type SendMessageInput = z.input<typeof sendMessageSchema>;

export const conversationIdSchema = z.object({ conversationId: z.guid() });

export const archiveConversationSchema = z.object({ conversationId: z.guid(), archived: z.boolean() });

export const blockUserSchema = z.object({ userId: z.guid(), blocked: z.boolean() });

const REPORT_REASON_KEYS = Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]];

/** Für Nachrichten passende Meldegründe («Doppeltes Inserat» passt hier nicht). */
export const MESSAGE_REPORT_REASONS = REPORT_REASON_KEYS.filter((reason) => reason !== "duplicate" && reason !== "wrong_information");

export const reportSchema = z.object({
  targetType: z.enum(["message", "conversation"]),
  targetId: z.guid(),
  reason: z.enum(REPORT_REASON_KEYS, { error: "Bitte wählen Sie einen Grund." }),
  details: z.string().trim().max(2000, "Höchstens 2000 Zeichen.").optional(),
});
export type ReportInput = z.input<typeof reportSchema>;
