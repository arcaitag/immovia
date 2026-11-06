import { z } from "zod";
import type { EmailBlock } from "@/lib/email/layout";
import {
  calendarAttachment,
  calendarSchema,
  defineTemplate,
  nameOr,
  optionalText,
  quoted,
  slugSchema,
  uuidSchema,
  type TemplateContext,
} from "@/lib/email/templates/shared";

/**
 * Besichtigungen. Die Datenbank liefert appointment_id, listing_title, when (Zürcher Zeit)
 * und ggf. reason. Beim Versand werden Adresse, Slug, Empfängerrolle und Kalenderdaten ergänzt.
 */

const viewingBase = {
  appointment_id: uuidSchema.nullish(),
  listing_id: uuidSchema.nullish(),
  listing_title: optionalText,
  when: z.string().min(1).max(120),
  reason: optionalText,
  address: optionalText,
  slug: slugSchema.nullish(),
  guest_name: optionalText,
  guest_message: optionalText,
  recipient_role: z.enum(["guest", "seller"]).nullish(),
  calendar: calendarSchema.nullish(),
};

const FOOTER = "Sie erhalten diese E-Mail zu Besichtigungsterminen auf Immovia.";

function sellerLink(ctx: TemplateContext, listingId: string | null | undefined): string {
  return ctx.url(listingId ? `/dashboard/besichtigungen?inserat=${listingId}` : "/dashboard/besichtigungen");
}

function guestLink(ctx: TemplateContext): string {
  return ctx.url("/dashboard/besichtigungen?ansicht=termine");
}

function whenFacts(when: string, address: string | null | undefined, label = "Termin"): EmailBlock {
  return {
    type: "facts",
    items: [
      { label, value: when },
      { label: "Adresse", value: address?.trim() ?? "" },
    ],
  };
}

export const viewingRequestedTemplate = defineTemplate({
  description: "Neue Besichtigungsanfrage (an Verkäufer)",
  schema: z.object(viewingBase),
  build: (data, ctx) => ({
    subject: `Neue Besichtigungsanfrage: ${data.when}`,
    preheader: `Besichtigung für ${quoted(data.listing_title)} angefragt.`,
    heading: "Neue Besichtigungsanfrage",
    footerReason: FOOTER,
    blocks: [
      { type: "paragraph", text: `Für ${quoted(data.listing_title)} wurde eine Besichtigung angefragt.` },
      {
        type: "facts",
        items: [
          { label: "Termin", value: data.when },
          { label: "Interessent", value: data.guest_name?.trim() ?? "" },
        ],
      },
      ...(data.guest_message?.trim() ? [{ type: "quote" as const, label: "Nachricht", text: data.guest_message }] : []),
      { type: "paragraph", text: "Bestätigen Sie den Termin, schlagen Sie ein anderes Zeitfenster vor oder sagen Sie ab." },
      { type: "button", label: "Anfrage bearbeiten", url: sellerLink(ctx, data.listing_id) },
    ],
  }),
});

export const viewingConfirmedTemplate = defineTemplate({
  description: "Besichtigung wurde bestätigt (an Interessent)",
  schema: z.object(viewingBase),
  build: (data, ctx) => ({
    subject: `Besichtigung bestätigt: ${data.when}`,
    preheader: `Ihr Termin für ${quoted(data.listing_title)} ist bestätigt.`,
    heading: "Ihre Besichtigung ist bestätigt",
    footerReason: FOOTER,
    blocks: [
      { type: "paragraph", text: `Der Termin für ${quoted(data.listing_title)} ist bestätigt.` },
      whenFacts(data.when, data.address),
      ...(data.calendar ? [{ type: "notice" as const, text: "Den Kalendereintrag finden Sie im Anhang dieser E-Mail." }] : []),
      { type: "button", label: "Termin ansehen", url: guestLink(ctx) },
      ...(data.slug ? [{ type: "link" as const, label: "Inserat ansehen", url: ctx.url(`/immobilien/${data.slug}`) }] : []),
    ],
    attachments: calendarAttachment(data.calendar, ctx),
  }),
});

export const viewingCancelledTemplate = defineTemplate({
  description: "Besichtigung wurde abgesagt (an die andere Seite)",
  schema: z.object(viewingBase),
  build: (data, ctx) => {
    const forGuest = data.recipient_role !== "seller";
    return {
      subject: `Besichtigung abgesagt: ${data.when}`,
      preheader: `Der Termin für ${quoted(data.listing_title)} wurde abgesagt.`,
      heading: "Besichtigung abgesagt",
      footerReason: FOOTER,
      blocks: [
        { type: "paragraph", text: `Der Termin für ${quoted(data.listing_title)} am ${data.when} wurde abgesagt.` },
        ...(data.reason?.trim() ? [{ type: "quote" as const, label: "Begründung", text: data.reason }] : []),
        ...(forGuest && data.slug
          ? [
              { type: "paragraph" as const, text: "Weitere freie Termine finden Sie auf der Inseratseite." },
              { type: "button" as const, label: "Freie Termine ansehen", url: ctx.url(`/immobilien/${data.slug}`) },
            ]
          : [{ type: "button" as const, label: "Zu den Besichtigungen", url: forGuest ? guestLink(ctx) : sellerLink(ctx, data.listing_id) }]),
        ...(forGuest
          ? [{ type: "paragraph" as const, muted: true, text: "Falls Sie den Termin im Kalender gespeichert haben, löschen Sie ihn bitte dort." }]
          : []),
      ],
    };
  },
});

export const viewingRescheduleTemplate = defineTemplate({
  description: "Interessent bittet um einen anderen Termin (an Verkäufer)",
  schema: z.object(viewingBase),
  build: (data, ctx) => ({
    subject: `Terminänderung angefragt: ${data.when}`,
    preheader: `Für ${quoted(data.listing_title)} wird ein anderer Termin gewünscht.`,
    heading: "Terminänderung angefragt",
    footerReason: FOOTER,
    blocks: [
      {
        type: "paragraph",
        text: `${nameOr(data.guest_name, "Ein Interessent")} bittet für die Besichtigung von ${quoted(data.listing_title)} am ${data.when} um einen anderen Termin.`,
      },
      ...(data.reason?.trim() ? [{ type: "quote" as const, label: "Nachricht", text: data.reason }] : []),
      { type: "paragraph", text: "Verschieben Sie den Termin in ein anderes Zeitfenster oder antworten Sie im Chat." },
      { type: "button", label: "Termin verschieben", url: sellerLink(ctx, data.listing_id) },
    ],
  }),
});

export const viewingRescheduledTemplate = defineTemplate({
  description: "Verkäufer hat den Termin verschoben (an Interessent)",
  schema: z.object(viewingBase),
  build: (data, ctx) => ({
    subject: `Besichtigung verschoben auf ${data.when}`,
    preheader: `Neuer Termin für ${quoted(data.listing_title)}.`,
    heading: "Ihre Besichtigung wurde verschoben",
    footerReason: FOOTER,
    blocks: [
      { type: "paragraph", text: `Der Termin für ${quoted(data.listing_title)} wurde verschoben und ist bestätigt.` },
      whenFacts(data.when, data.address, "Neuer Termin"),
      ...(data.calendar ? [{ type: "notice" as const, text: "Den aktualisierten Kalendereintrag finden Sie im Anhang." }] : []),
      { type: "button", label: "Termin ansehen", url: guestLink(ctx) },
    ],
    attachments: calendarAttachment(data.calendar, ctx),
  }),
});

export const viewingReminderTemplate = defineTemplate({
  description: "Erinnerung an einen bestätigten Termin in den nächsten 24 Stunden",
  schema: z.object({ ...viewingBase, role: z.enum(["guest", "seller"]) }),
  build: (data, ctx) => {
    const forGuest = data.role === "guest";
    return {
      subject: `Erinnerung: Besichtigung ${data.when}`,
      preheader: `Besichtigung von ${quoted(data.listing_title)}.`,
      heading: forGuest ? "Erinnerung an Ihre Besichtigung" : "Erinnerung an eine Besichtigung",
      footerReason: FOOTER,
      blocks: forGuest
        ? [
            { type: "paragraph", text: `Ihre Besichtigung von ${quoted(data.listing_title)} findet bald statt.` },
            whenFacts(data.when, data.address),
            { type: "notice", text: "Können Sie den Termin nicht wahrnehmen? Bitte sagen Sie ihn rechtzeitig ab." },
            { type: "button", label: "Termin ansehen", url: guestLink(ctx) },
          ]
        : [
            { type: "paragraph", text: `Für ${quoted(data.listing_title)} steht eine bestätigte Besichtigung an.` },
            {
              type: "facts",
              items: [
                { label: "Termin", value: data.when },
                { label: "Interessent", value: data.guest_name?.trim() ?? "" },
              ],
            },
            { type: "button", label: "Besichtigungen öffnen", url: sellerLink(ctx, data.listing_id) },
          ],
      attachments: forGuest ? calendarAttachment(data.calendar, ctx) : undefined,
    };
  },
});
