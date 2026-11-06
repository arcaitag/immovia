import { z } from "zod";
import { defineTemplate, nameOr, optionalText, quoted, uuidSchema } from "@/lib/email/templates/shared";
import { shorten } from "@/lib/email/escape";

/** Anfragen, Nachrichten und Dokumentfreigaben. */

export const newInquiryTemplate = defineTemplate({
  description: "Neue Kontaktanfrage zu einem Inserat (an Verkäufer)",
  schema: z.object({
    conversation_id: uuidSchema,
    listing_id: uuidSchema.nullish(),
    listing_title: optionalText,
    sender_name: optionalText,
    preview: optionalText,
    wants_viewing: z.boolean().nullish(),
    wants_dossier: z.boolean().nullish(),
  }),
  build: (data, ctx) => {
    const sender = nameOr(data.sender_name, "Ein Mitglied");
    const wishes = [data.wants_viewing ? "Besichtigung" : null, data.wants_dossier ? "Verkaufsdossier" : null].filter(
      (v): v is string => v !== null,
    );
    return {
      subject: `Neue Anfrage zu ${quoted(data.listing_title)}`,
      preheader: `${sender} interessiert sich für Ihr Inserat.`,
      heading: "Neue Anfrage zu Ihrem Inserat",
      footerReason: "Sie erhalten diese E-Mail, weil Sie ein Inserat auf Immovia veröffentlicht haben.",
      blocks: [
        { type: "paragraph", text: `${sender} interessiert sich für ${quoted(data.listing_title)}.` },
        ...(data.preview?.trim() ? [{ type: "quote" as const, label: "Nachricht", text: shorten(data.preview, 600) }] : []),
        ...(wishes.length ? [{ type: "facts" as const, items: [{ label: "Wünscht", value: wishes.join(", ") }] }] : []),
        { type: "button", label: "Anfrage beantworten", url: ctx.url(`/dashboard/nachrichten/${data.conversation_id}`) },
        { type: "paragraph", muted: true, text: "Antworten Sie direkt über Immovia. Ihre E-Mail-Adresse bleibt privat." },
      ],
    };
  },
});

export const newMessageTemplate = defineTemplate({
  description: "Neue Nachricht in einer Konversation (gebündelt, höchstens alle 15 Minuten)",
  schema: z.object({
    conversation_id: uuidSchema,
    message_id: uuidSchema.nullish(),
    sender_name: optionalText,
    listing_title: optionalText,
    preview: optionalText,
    unread_count: z.number().int().nonnegative().nullish(),
  }),
  build: (data, ctx) => {
    const sender = nameOr(data.sender_name, "Ein Mitglied");
    const unread = data.unread_count ?? 1;
    return {
      subject: `Neue Nachricht von ${sender}`,
      preheader: data.preview?.trim() ? shorten(data.preview, 120) : `${sender} hat Ihnen geschrieben.`,
      heading: "Neue Nachricht",
      footerReason:
        "Sie erhalten diese E-Mail, weil Sie auf Immovia eine Nachricht erhalten haben. Pro Konversation senden wir höchstens eine E-Mail alle 15 Minuten.",
      blocks: [
        {
          type: "paragraph",
          text: data.listing_title?.trim()
            ? `${sender} hat Ihnen zu ${quoted(data.listing_title)} geschrieben:`
            : `${sender} hat Ihnen geschrieben:`,
        },
        ...(data.preview?.trim() ? [{ type: "quote" as const, text: shorten(data.preview, 600) }] : []),
        ...(unread > 1
          ? [{ type: "paragraph" as const, muted: true, text: `In dieser Konversation warten ${unread} ungelesene Nachrichten auf Sie.` }]
          : []),
        { type: "button", label: "Nachricht lesen", url: ctx.url(`/dashboard/nachrichten/${data.conversation_id}`) },
      ],
    };
  },
});

export const documentSharedTemplate = defineTemplate({
  description: "Ein Dokument wurde für die Person freigegeben",
  schema: z.object({ document_title: z.string().min(1).max(200) }),
  build: (data, ctx) => ({
    subject: `Neues Dokument für Sie: ${data.document_title.trim()}`,
    preheader: "Ein Dokument wurde für Sie freigegeben.",
    heading: "Ein Dokument wurde für Sie freigegeben",
    footerReason: "Sie erhalten diese E-Mail, weil eine Verkäuferin oder ein Verkäufer auf Immovia ein Dokument für Sie freigegeben hat.",
    blocks: [
      {
        type: "paragraph",
        text: `Für Sie wurde das Dokument ${quoted(data.document_title, "")} freigegeben. Sie finden es im Dokumentencenter unter «Mit mir geteilt».`,
      },
      { type: "notice", text: "Aus Sicherheitsgründen ist das Dokument nur nach der Anmeldung abrufbar. Die Freigabe kann befristet sein." },
      { type: "button", label: "Dokument ansehen", url: ctx.url("/dashboard/dokumente?ansicht=geteilt") },
    ],
  }),
});
