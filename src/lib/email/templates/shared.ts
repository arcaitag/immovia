import { z } from "zod";
import type { EmailAttachment, EmailContent, EmailListingItem, EmailRenderContext } from "@/lib/email/layout";
import { absoluteUrl, cleanText, shorten } from "@/lib/email/escape";
import { buildIcsEvent, type IcsStatus } from "@/lib/ics";

/** Kontext für Vorlagen: Basis-URL und Helfer für absolute Links. */
export interface TemplateContext extends EmailRenderContext {
  url(path: string): string;
}

export interface TemplateOutput extends EmailContent {
  attachments?: EmailAttachment[];
}

/**
 * Eine Vorlage validiert ihre Nutzdaten (payload aus email_outbox, ggf. angereichert)
 * und beschreibt den Inhalt als Blöcke. build ist als Methode deklariert (bivariant),
 * damit Vorlagen mit unterschiedlichen Schemas in einer Tabelle stehen können.
 */
export interface EmailTemplateDefinition<S extends z.ZodType = z.ZodType> {
  /** Kurzbeschreibung für Dokumentation und Administration */
  description: string;
  schema: S;
  build(data: z.output<S>, ctx: TemplateContext): TemplateOutput;
}

export function defineTemplate<S extends z.ZodType>(definition: EmailTemplateDefinition<S>): EmailTemplateDefinition<S> {
  return definition;
}

export function createTemplateContext(ctx: EmailRenderContext): TemplateContext {
  const siteUrl = ctx.siteUrl.replace(/\/+$/, "");
  return { ...ctx, siteUrl, url: (path: string) => absoluteUrl(siteUrl, path) };
}

export const uuidSchema = z.guid();
export const optionalText = z.string().nullish();
export const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Ungültiger Slug");

/** «Titel» mit Schweizer Guillemets oder neutraler Ersatz. */
export function quoted(title: string | null | undefined, fallback = "Ihr Inserat"): string {
  const clean = cleanText(title ?? "").replace(/\s+/g, " ");
  return clean ? `«${shorten(clean, 120)}»` : fallback;
}

export function nameOr(name: string | null | undefined, fallback: string): string {
  const clean = cleanText(name ?? "").replace(/\s+/g, " ");
  return clean ? shorten(clean, 80) : fallback;
}

/** Inserat in E-Mails (Suchabos). Wird beim Versand aus der Datenbank angereichert. */
export const emailListingSchema = z.object({
  title: z.string().min(1),
  path: z.string().regex(/^\/[^\s]*$/, "Pfad muss mit / beginnen"),
  location: optionalText,
  price: optionalText,
  priceLabel: optionalText,
  facts: z.array(z.string()).max(4).optional(),
  imageUrl: z.string().url().nullish(),
});
export type EmailListingInput = z.infer<typeof emailListingSchema>;

export function toListingItems(listings: EmailListingInput[], ctx: TemplateContext): EmailListingItem[] {
  return listings.map((listing) => ({
    title: listing.title,
    url: ctx.url(listing.path),
    location: listing.location ?? null,
    price: listing.price ?? null,
    priceLabel: listing.priceLabel ?? null,
    facts: listing.facts,
    imageUrl: listing.imageUrl ?? null,
  }));
}

/** Kalenderdaten für den ICS-Anhang (beim Versand aus dem Termin angereichert). */
export const calendarSchema = z.object({
  uid: z.string().min(3).max(200),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  summary: z.string().min(1).max(300),
  location: optionalText,
  path: z.string().regex(/^\//).nullish(),
  status: z.enum(["CONFIRMED", "TENTATIVE", "CANCELLED"]).default("CONFIRMED"),
  stamp: z.iso.datetime({ offset: true }).nullish(),
});
export type CalendarInput = z.infer<typeof calendarSchema>;

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function calendarAttachment(calendar: CalendarInput | null | undefined, ctx: TemplateContext, fileName = "besichtigung.ics"): EmailAttachment[] | undefined {
  if (!calendar) return undefined;
  const ics = buildIcsEvent({
    uid: calendar.uid,
    start: new Date(calendar.start),
    end: new Date(calendar.end),
    summary: calendar.summary,
    location: calendar.location ?? null,
    url: calendar.path ? ctx.url(calendar.path) : null,
    status: calendar.status as IcsStatus,
    stamp: calendar.stamp ? new Date(calendar.stamp) : new Date(calendar.start),
    alarmMinutesBefore: calendar.status === "CANCELLED" ? null : 60,
  });
  return [{ filename: fileName, content: toBase64(ics), contentType: "text/calendar; charset=utf-8; method=PUBLISH" }];
}
