import { z } from "zod";
import { SITE } from "@/lib/constants";
import {
  defineTemplate,
  emailListingSchema,
  optionalText,
  quoted,
  slugSchema,
  toListingItems,
  uuidSchema,
} from "@/lib/email/templates/shared";

/** Inserate, Dossiers und Suchabos. */

export const listingPublishedTemplate = defineTemplate({
  description: "Inserat wurde erstmals veröffentlicht",
  schema: z.object({ listing_id: uuidSchema.nullish(), title: optionalText, slug: slugSchema }),
  build: (data, ctx) => ({
    subject: `Ihr Inserat ist online: ${data.title?.trim() || "Immovia"}`,
    preheader: "Ihr Inserat ist jetzt in der Immobiliensuche sichtbar.",
    heading: "Ihr Inserat ist online",
    footerReason: "Sie erhalten diese E-Mail, weil Sie ein Inserat auf Immovia veröffentlicht haben.",
    blocks: [
      { type: "paragraph", text: `${quoted(data.title)} ist jetzt in der Immobiliensuche sichtbar.` },
      {
        type: "paragraph",
        text: "Anfragen, Nachrichten und Besichtigungen verwalten Sie im Dashboard. Wir informieren Sie, sobald sich jemand meldet.",
      },
      { type: "button", label: "Inserat ansehen", url: ctx.url(`/immobilien/${data.slug}`) },
      { type: "link", label: "Zu meinen Immobilien", url: ctx.url("/dashboard/immobilien") },
    ],
  }),
});

export const listingModeratedTemplate = defineTemplate({
  description: "Inserat wurde von der Moderation deaktiviert oder nicht freigegeben",
  schema: z.object({ listing_title: optionalText, action: z.enum(["block", "reject"]), reason: optionalText }),
  build: (data, ctx) => {
    const blocked = data.action === "block";
    const reason = data.reason?.trim();
    return {
      subject: blocked ? "Ihr Inserat wurde deaktiviert" : "Ihr Inserat wurde nicht freigegeben",
      preheader: blocked ? "Ihr Inserat ist nicht mehr öffentlich sichtbar." : "Bitte überarbeiten Sie Ihr Inserat.",
      heading: blocked ? "Ihr Inserat wurde deaktiviert" : "Ihr Inserat wurde nicht freigegeben",
      footerReason: "Sie erhalten diese E-Mail, weil Sie ein Inserat auf Immovia verwalten.",
      blocks: [
        {
          type: "paragraph",
          text: blocked
            ? `Unser Moderationsteam hat ${quoted(data.listing_title)} deaktiviert. Das Inserat ist nicht mehr öffentlich sichtbar.`
            : `Wir haben ${quoted(data.listing_title)} geprüft und noch nicht freigegeben. Bitte überarbeiten Sie das Inserat und reichen Sie es erneut ein.`,
        },
        ...(reason ? [{ type: "quote" as const, label: "Begründung", text: reason }] : []),
        { type: "button", label: "Zu meinen Immobilien", url: ctx.url("/dashboard/immobilien") },
        { type: "paragraph", muted: true, text: `Bei Fragen erreichen Sie uns unter ${ctx.supportEmail ?? SITE.supportEmail}.` },
      ],
    };
  },
});

export const dossierReadyTemplate = defineTemplate({
  description: "Verkaufsdossier (PDF) wurde erstellt",
  schema: z.object({
    property_id: uuidSchema,
    dossier_id: uuidSchema.nullish(),
    title: optionalText,
    version: z.number().int().positive().nullish(),
  }),
  build: (data, ctx) => ({
    subject: "Ihr Verkaufsdossier ist bereit",
    preheader: "Das PDF-Dossier kann jetzt heruntergeladen werden.",
    heading: "Ihr Verkaufsdossier ist bereit",
    footerReason: "Sie erhalten diese E-Mail, weil Sie auf Immovia ein Verkaufsdossier erstellt haben.",
    blocks: [
      {
        type: "paragraph",
        text: `Das Verkaufsdossier${data.title?.trim() ? ` für ${quoted(data.title)}` : ""} wurde erstellt${
          data.version ? ` (Version ${data.version})` : ""
        }. Sie können es jetzt prüfen, herunterladen und mit Interessenten teilen.`,
      },
      { type: "button", label: "Dossier öffnen", url: ctx.url(`/dashboard/immobilien/${data.property_id}/dossier`) },
    ],
  }),
});

const SEARCH_FOOTER = "Sie erhalten diese E-Mail, weil Sie ein Suchabo mit E-Mail-Benachrichtigung eingerichtet haben.";

export const searchAlertTemplate = defineTemplate({
  description: "Sofort-Benachrichtigung: neues passendes Inserat für ein Suchabo",
  schema: z.object({
    saved_search_id: uuidSchema.nullish(),
    search_name: z.string().min(1).max(200),
    listings: z.array(emailListingSchema).min(1).max(10),
  }),
  build: (data, ctx) => {
    const first = data.listings[0];
    return {
      subject: `Neues Inserat für Ihr Suchabo «${data.search_name.trim()}»`,
      preheader: first ? first.title : "Ein neues Inserat passt zu Ihrer Suche.",
      heading: "Neues passendes Inserat",
      footerReason: SEARCH_FOOTER,
      blocks: [
        { type: "paragraph", text: `Für Ihr Suchabo ${quoted(data.search_name, "")} gibt es ein neues Inserat.` },
        { type: "listings", items: toListingItems(data.listings, ctx) },
        ...(first ? [{ type: "button" as const, label: "Inserat ansehen", url: ctx.url(first.path) }] : []),
        { type: "link", label: "Suchaufträge verwalten", url: ctx.url("/dashboard/suchauftraege") },
      ],
    };
  },
});

export const searchAlertDigestTemplate = defineTemplate({
  description: "Tägliche oder wöchentliche Zusammenfassung neuer Treffer eines Suchabos",
  schema: z
    .object({
      saved_search_id: uuidSchema.nullish(),
      search_name: z.string().min(1).max(200),
      frequency: z.enum(["daily", "weekly"]),
      listings: z.array(emailListingSchema).min(1).max(10),
      total: z.number().int().positive().nullish(),
      search_path: z.string().regex(/^\/(immobilien|kaufen|mieten)(\?[^\s]*)?$/).nullish(),
    })
    .refine((v) => !v.total || v.total >= v.listings.length, { path: ["total"], message: "total < listings" }),
  build: (data, ctx) => {
    const total = data.total ?? data.listings.length;
    const shown = data.listings.length;
    const name = data.search_name.trim();
    const period = data.frequency === "daily" ? "tägliche" : "wöchentliche";
    return {
      subject: total === 1 ? `Neues Inserat für «${name}»` : `${total} neue Inserate für «${name}»`,
      preheader: `Ihre ${period} Zusammenfassung für «${name}».`,
      heading: total === 1 ? "Ein neues Inserat für Ihr Suchabo" : `${total} neue Inserate für Ihr Suchabo`,
      footerReason: SEARCH_FOOTER,
      blocks: [
        { type: "paragraph", text: `Ihre ${period} Zusammenfassung für ${quoted(name, "")}:` },
        { type: "listings", items: toListingItems(data.listings, ctx) },
        ...(total > shown
          ? [
              {
                type: "paragraph" as const,
                muted: true,
                text: total - shown === 1 ? "Einen weiteren Treffer finden Sie in der Suche." : `${total - shown} weitere Treffer finden Sie in der Suche.`,
              },
            ]
          : []),
        { type: "button", label: "Alle Treffer ansehen", url: ctx.url(data.search_path ?? "/dashboard/suchauftraege") },
        { type: "link", label: "Suchaufträge verwalten", url: ctx.url("/dashboard/suchauftraege") },
      ],
    };
  },
});
