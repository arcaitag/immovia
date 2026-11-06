import { SITE } from "@/lib/constants";
import { absoluteUrl, cleanText, escapeHtml, htmlText, isSafeHttpUrl, sanitizeSubject } from "@/lib/email/escape";

/**
 * Einheitliches Immovia-Layout für alle E-Mails. Inhalte werden als Blöcke
 * beschrieben; daraus entstehen die HTML- und die Textversion. Alle Texte aus
 * Blöcken werden escaped – Vorlagen übergeben nie HTML.
 *
 * Farben (Gestaltungsvorgabe): Markengrün #5A8A30, Dunkelgrün #274B32, Text #192820,
 * Sekundärtext #69736D, Rahmen #E4EAE1, Hellgrün #EAF3DF, Fläche #F8FAF6.
 * Buttons nutzen #4F7A2A (= --primary): Markengrün minimal abgedunkelt, damit weisse
 * Schrift den WCAG-AA-Kontrast erfüllt.
 */

export const EMAIL_COLORS = {
  brand: "#5A8A30",
  forest: "#274B32",
  button: "#4F7A2A",
  text: "#192820",
  muted: "#69736D",
  border: "#E4EAE1",
  mint: "#EAF3DF",
  surface: "#F8FAF6",
  warningBg: "#FEF6E7",
  warningText: "#9A4B06",
} as const;

const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const DISPLAY_FONT = "Manrope, Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export interface EmailListingItem {
  title: string;
  url: string;
  location?: string | null;
  price?: string | null;
  priceLabel?: string | null;
  facts?: string[];
  imageUrl?: string | null;
}

export type EmailBlock =
  | { type: "paragraph"; text: string; muted?: boolean }
  | { type: "quote"; text: string; label?: string }
  | { type: "facts"; items: Array<{ label: string; value: string }> }
  | { type: "notice"; text: string; tone?: "info" | "warning" }
  | { type: "button"; label: string; url: string }
  | { type: "link"; label: string; url: string }
  | { type: "listings"; items: EmailListingItem[] };

export interface EmailContent {
  subject: string;
  /** Vorschautext im Posteingang */
  preheader: string;
  heading: string;
  blocks: EmailBlock[];
  /** Grund, weshalb die Person diese E-Mail erhält (Fusszeile) */
  footerReason: string;
  /** Link zu den Benachrichtigungseinstellungen in der Fusszeile anzeigen */
  showSettingsLink?: boolean;
}

export interface EmailRenderContext {
  siteUrl: string;
  /** Anrede, z. B. «Martin Schmidt». Leer = neutrale Anrede. */
  recipientName?: string | null;
  supportEmail?: string;
}

export interface EmailAttachment {
  filename: string;
  /** Base64-kodierter Inhalt */
  content: string;
  contentType?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export const SETTINGS_PATH = "/dashboard/einstellungen";

function safeUrl(url: string, siteUrl: string): string {
  return isSafeHttpUrl(url) ? url : siteUrl;
}

export function greetingText(name: string | null | undefined): string {
  const clean = cleanText(name ?? "").replace(/\s+/g, " ");
  return clean ? `Guten Tag ${clean}` : "Guten Tag";
}

function renderBlockHtml(block: EmailBlock, ctx: EmailRenderContext): string {
  const c = EMAIL_COLORS;
  switch (block.type) {
    case "paragraph":
      return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${block.muted ? c.muted : c.text};">${htmlText(block.text)}</p>`;
    case "quote":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:separate;">
<tr><td style="background:${c.surface};border-left:3px solid ${c.brand};border-radius:12px;padding:14px 16px;">
${block.label ? `<p style="margin:0 0 6px;font-size:13px;line-height:1.4;font-weight:600;color:${c.muted};">${escapeHtml(cleanText(block.label))}</p>` : ""}
<p style="margin:0;font-size:15px;line-height:1.6;color:${c.text};">${htmlText(block.text)}</p>
</td></tr></table>`;
    case "facts": {
      const rows = block.items
        .filter((item) => cleanText(item.value))
        .map(
          (item) => `<tr>
<td style="padding:8px 12px 8px 0;font-size:14px;line-height:1.5;color:${c.muted};vertical-align:top;width:38%;">${escapeHtml(cleanText(item.label))}</td>
<td style="padding:8px 0;font-size:15px;line-height:1.5;font-weight:600;color:${c.text};vertical-align:top;">${htmlText(item.value)}</td>
</tr>`,
        )
        .join("\n");
      if (!rows) return "";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-top:1px solid ${c.border};border-bottom:1px solid ${c.border};">
${rows}
</table>`;
    }
    case "notice": {
      const warning = block.tone === "warning";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-collapse:separate;">
<tr><td style="background:${warning ? c.warningBg : c.mint};border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.55;color:${warning ? c.warningText : c.forest};">${htmlText(block.text)}</td></tr></table>`;
    }
    case "button": {
      const url = escapeHtml(safeUrl(block.url, ctx.siteUrl));
      const label = escapeHtml(cleanText(block.label));
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px;border-collapse:separate;">
<tr><td align="center" bgcolor="${c.button}" style="border-radius:12px;background:${c.button};">
<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;line-height:1.2;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:12px;">${label}</a>
</td></tr></table>
<p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:${c.muted};">Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br><a href="${url}" style="color:${c.forest};word-break:break-all;">${url}</a></p>`;
    }
    case "link": {
      const url = escapeHtml(safeUrl(block.url, ctx.siteUrl));
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;"><a href="${url}" target="_blank" rel="noopener" style="color:${c.forest};font-weight:600;text-decoration:underline;">${escapeHtml(cleanText(block.label))}</a></p>`;
    }
    case "listings":
      return block.items.map((item) => renderListingHtml(item, ctx)).join("\n");
  }
}

function renderListingHtml(item: EmailListingItem, ctx: EmailRenderContext): string {
  const c = EMAIL_COLORS;
  const url = escapeHtml(safeUrl(item.url, ctx.siteUrl));
  const image =
    item.imageUrl && isSafeHttpUrl(item.imageUrl)
      ? `<tr><td style="padding:0 0 12px;"><a href="${url}" target="_blank" rel="noopener"><img src="${escapeHtml(item.imageUrl)}" width="536" alt="" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:12px;"></a></td></tr>`
      : "";
  const price = item.price
    ? `<p style="margin:8px 0 0;font-size:17px;line-height:1.4;font-weight:800;color:${c.forest};">${escapeHtml(cleanText(item.price))}${
        item.priceLabel ? ` <span style="font-size:13px;font-weight:500;color:${c.muted};">${escapeHtml(cleanText(item.priceLabel))}</span>` : ""
      }</p>`
    : "";
  const facts = item.facts?.length
    ? `<p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${c.muted};">${item.facts.map((f) => escapeHtml(cleanText(f))).join(" &middot; ")}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid ${c.border};border-radius:16px;border-collapse:separate;">
<tr><td style="padding:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${image}
<tr><td>
<a href="${url}" target="_blank" rel="noopener" style="font-family:${DISPLAY_FONT};font-size:17px;line-height:1.35;font-weight:700;color:${c.text};text-decoration:none;">${escapeHtml(cleanText(item.title))}</a>
${item.location ? `<p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:${c.muted};">${escapeHtml(cleanText(item.location))}</p>` : ""}
${price}
${facts}
</td></tr>
</table>
</td></tr></table>`;
}

function renderBlockText(block: EmailBlock, ctx: EmailRenderContext): string {
  switch (block.type) {
    case "paragraph":
      return cleanText(block.text);
    case "quote": {
      const quoted = cleanText(block.text)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return block.label ? `${cleanText(block.label)}\n${quoted}` : quoted;
    }
    case "facts":
      return block.items
        .filter((item) => cleanText(item.value))
        .map((item) => `${cleanText(item.label)}: ${cleanText(item.value)}`)
        .join("\n");
    case "notice":
      return cleanText(block.text);
    case "button":
    case "link":
      return `${cleanText(block.label)}:\n${safeUrl(block.url, ctx.siteUrl)}`;
    case "listings":
      return block.items
        .map((item) =>
          [
            `- ${cleanText(item.title)}`,
            item.location ? `  ${cleanText(item.location)}` : null,
            item.price ? `  ${cleanText(item.price)}${item.priceLabel ? ` (${cleanText(item.priceLabel)})` : ""}` : null,
            item.facts?.length ? `  ${item.facts.map(cleanText).join(" · ")}` : null,
            `  ${safeUrl(item.url, ctx.siteUrl)}`,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n");
  }
}

export function renderEmailContent(content: EmailContent, ctx: EmailRenderContext): RenderedEmail {
  const c = EMAIL_COLORS;
  const siteUrl = ctx.siteUrl.replace(/\/+$/, "");
  const context: EmailRenderContext = { ...ctx, siteUrl };
  const subject = sanitizeSubject(content.subject);
  const support = ctx.supportEmail ?? SITE.supportEmail;
  const settingsUrl = absoluteUrl(siteUrl, SETTINGS_PATH);
  const greeting = greetingText(ctx.recipientName);

  const blocksHtml = content.blocks.map((block) => renderBlockHtml(block, context)).filter(Boolean).join("\n");
  const footerSettings = content.showSettingsLink === false
    ? ""
    : `<br><a href="${escapeHtml(settingsUrl)}" style="color:${c.forest};text-decoration:underline;">Benachrichtigungen verwalten</a>`;

  const html = `<!doctype html>
<html lang="de-CH">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta http-equiv="x-ua-compatible" content="ie=edge">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#FFFFFF;">${escapeHtml(cleanText(content.preheader))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;">
<tr><td align="center" style="padding:24px 12px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${FONT};">
<tr><td style="padding:4px 4px 20px;">
<a href="${escapeHtml(siteUrl)}" target="_blank" rel="noopener" style="text-decoration:none;font-family:${DISPLAY_FONT};font-size:26px;line-height:1;font-weight:800;letter-spacing:-0.02em;color:${c.forest};">Immo<span style="color:${c.brand};">via</span></a>
</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid ${c.border};border-top:4px solid ${c.brand};border-radius:16px;padding:32px 28px 20px;">
<h1 style="margin:0 0 16px;font-family:${DISPLAY_FONT};font-size:22px;line-height:1.3;font-weight:800;letter-spacing:-0.01em;color:${c.text};">${escapeHtml(cleanText(content.heading))}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${c.text};">${escapeHtml(greeting)}</p>
${blocksHtml}
<p style="margin:8px 0 12px;font-size:16px;line-height:1.6;color:${c.text};">Freundliche Grüsse<br>Ihr Immovia-Team</p>
</td></tr>
<tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:${c.muted};">
${escapeHtml(cleanText(content.footerReason))}${footerSettings}<br>
Immovia &middot; Schweizer Immobilienplattform &middot; <a href="mailto:${escapeHtml(support)}" style="color:${c.muted};">${escapeHtml(support)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const textParts = [
    cleanText(content.heading),
    "",
    `${greeting}`,
    "",
    ...content.blocks.map((block) => renderBlockText(block, context)).filter(Boolean).flatMap((part) => [part, ""]),
    "Freundliche Grüsse",
    "Ihr Immovia-Team",
    "",
    "--",
    cleanText(content.footerReason),
    content.showSettingsLink === false ? null : `Benachrichtigungen verwalten: ${settingsUrl}`,
    `Immovia · Schweizer Immobilienplattform · ${support}`,
  ].filter((line): line is string => line !== null);

  return { subject, html, text: textParts.join("\n") };
}
