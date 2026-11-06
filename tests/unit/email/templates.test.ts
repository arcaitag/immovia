import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATE_KEYS, EMAIL_TEMPLATES, EmailTemplateError, renderEmail, type EmailTemplateKey } from "@/lib/email/templates";
import { escapeHtml, sanitizeSubject } from "@/lib/email/escape";

const SITE_URL = "https://www.immovia.ch";
const ID = "3f0c2f9e-8b0a-4c51-9f3e-2a4b5c6d7e8f";
const SLUG = "wohnung-4-5-zimmer-ostermundigen-3f0c2f";
const LISTING_TITLE = "Helle 4.5-Zimmer-Wohnung mit Balkon";
const WHEN = "Sa, 14.11.2026, 10:00–10:30";

const listing = {
  title: LISTING_TITLE,
  path: `/immobilien/${SLUG}`,
  location: "3072 Ostermundigen",
  price: "CHF 865’000",
  priceLabel: "Kaufpreis",
  facts: ["Wohnung", "4.5 Zimmer", "112 m²"],
  imageUrl: "https://abc.supabase.co/storage/v1/object/public/property-images/p/i/base-md.webp",
};

const calendar = {
  uid: `${ID}@immovia.ch`,
  start: "2026-11-14T09:00:00.000Z",
  end: "2026-11-14T09:30:00.000Z",
  summary: `Besichtigung: ${LISTING_TITLE}`,
  location: "Bernstrasse 12, 3072 Ostermundigen",
  path: `/immobilien/${SLUG}`,
  status: "CONFIRMED",
  stamp: "2026-11-06T12:00:00.000Z",
};

const viewing = { appointment_id: ID, listing_id: ID, listing_title: LISTING_TITLE, when: WHEN, address: "3072 Ostermundigen", slug: SLUG };

const SAMPLES: Record<EmailTemplateKey, Record<string, unknown>> = {
  welcome: {},
  account_change: { change: "password" },
  org_invitation: { organization_name: "Muster Immobilien AG", token: "a1".repeat(32), role: "admin" },
  listing_published: { listing_id: ID, title: LISTING_TITLE, slug: SLUG },
  listing_moderated: { listing_title: LISTING_TITLE, action: "reject", reason: "Bitte ergänzen Sie den Grundriss." },
  dossier_ready: { property_id: ID, dossier_id: ID, title: LISTING_TITLE, version: 2 },
  search_alert: { saved_search_id: ID, search_name: "Wohnung Bern", listing_ids: [ID], listings: [listing] },
  search_alert_digest: {
    saved_search_id: ID,
    search_name: "Wohnung Bern",
    frequency: "weekly",
    listings: [listing, { ...listing, imageUrl: null }],
    total: 4,
    search_path: "/kaufen?ort=Bern&zimmer_von=4",
  },
  new_inquiry: {
    conversation_id: ID,
    listing_id: ID,
    listing_title: LISTING_TITLE,
    sender_name: "Martin Schmidt",
    preview: "Wäre eine Besichtigung am Samstag möglich?",
    wants_viewing: true,
    wants_dossier: false,
  },
  new_message: { conversation_id: ID, message_id: ID, sender_name: "Martin Schmidt", listing_title: LISTING_TITLE, preview: "Gerne am Samstag.", unread_count: 2 },
  document_shared: { document_title: "Grundriss Erdgeschoss" },
  viewing_requested: { ...viewing, guest_name: "Martin Schmidt", guest_message: "Ich bringe meine Partnerin mit." },
  viewing_confirmed: { ...viewing, calendar },
  viewing_cancelled: { ...viewing, reason: "Leider kurzfristig verhindert.", recipient_role: "guest" },
  viewing_reschedule: { ...viewing, reason: "Ginge es eine Stunde später?", guest_name: "Martin Schmidt" },
  viewing_rescheduled: { ...viewing, calendar },
  viewing_reminder: { ...viewing, role: "guest", calendar },
};

function render(key: EmailTemplateKey, payload: Record<string, unknown> = SAMPLES[key], recipientName: string | null = "Anna Muster") {
  return renderEmail(key, payload, { siteUrl: SITE_URL, recipientName, supportEmail: "support@immovia.ch" });
}

/** Liest die Vorlagenschlüssel, welche die Migrationen in die Outbox schreiben. */
function templateKeysFromMigrations(): Set<string> {
  const dir = join(process.cwd(), "supabase", "migrations");
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");

  function splitArgs(text: string): string[] {
    const args: string[] = [];
    let depth = 0;
    let inString = false;
    let current = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      if (inString) {
        current += ch;
        if (ch === "'") {
          if (text[i + 1] === "'") {
            current += "'";
            i++;
          } else inString = false;
        }
        continue;
      }
      if (ch === "'") inString = true;
      else if (ch === "(") depth++;
      else if (ch === ")") {
        if (depth === 0) break;
        depth--;
      } else if (ch === "," && depth === 0) {
        args.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    args.push(current);
    return args;
  }

  function keysOf(expression: string): string[] {
    const plain = expression.trim().match(/^'([a-z_]+)'$/);
    if (plain) return [plain[1]!];
    return [...expression.matchAll(/(?:then|else)\s+'([a-z_]+)'/g)].map((m) => m[1]!);
  }

  const keys = new Set<string>();
  for (const match of sql.matchAll(/perform\s+public\.queue_email\(/g)) {
    const args = splitArgs(sql.slice((match.index ?? 0) + match[0].length));
    for (const key of keysOf(args[1] ?? "")) keys.add(key);
  }
  for (const match of sql.matchAll(/insert\s+into\s+public\.email_outbox\s*\(([^)]*)\)\s*values\s*\(/g)) {
    const columns = match[1]!.split(",").map((c) => c.trim());
    const values = splitArgs(sql.slice((match.index ?? 0) + match[0].length));
    const value = values[columns.indexOf("template")];
    if (value) for (const key of keysOf(value)) keys.add(key);
  }
  return keys;
}

describe("E-Mail-Vorlagen", () => {
  it("decken alle Vorlagen ab, welche die Datenbank in die Outbox schreibt", () => {
    const fromDb = templateKeysFromMigrations();
    for (const key of [
      "welcome",
      "listing_published",
      "new_inquiry",
      "new_message",
      "viewing_requested",
      "viewing_confirmed",
      "viewing_cancelled",
      "viewing_reschedule",
      "viewing_rescheduled",
      "search_alert",
      "document_shared",
      "account_change",
      "org_invitation",
      "listing_moderated",
    ]) {
      expect(fromDb.has(key), `Parser findet ${key}`).toBe(true);
    }
    for (const key of fromDb) {
      expect(EMAIL_TEMPLATE_KEYS, `Vorlage für «${key}» fehlt`).toContain(key);
    }
    for (const own of ["viewing_reminder", "search_alert_digest", "dossier_ready"]) {
      expect(EMAIL_TEMPLATE_KEYS).toContain(own);
    }
  });

  it.each(EMAIL_TEMPLATE_KEYS)("rendert «%s» als HTML und Text im Immovia-Layout", (key) => {
    const email = render(key);
    expect(email.subject.length).toBeGreaterThan(5);
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html.startsWith("<!doctype html>")).toBe(true);
    expect(email.html).toContain('lang="de-CH"');
    expect(email.html).toContain("#5A8A30");
    expect(email.html).toContain("#274B32");
    expect(email.html).toContain("Guten Tag Anna Muster");
    expect(email.html).toContain("Freundliche Grüsse");
    // Button mit absoluter URL
    expect(email.html).toMatch(/<a href="https:\/\/www\.immovia\.ch\/[^"]*"[^>]*>[^<]+<\/a>\s*<\/td>/);
    expect(email.text).toContain("https://www.immovia.ch/");
    expect(email.text).not.toMatch(/<[a-z][^>]*>/i);
    if (key !== "org_invitation") {
      expect(email.html).toContain("https://www.immovia.ch/dashboard/einstellungen");
      expect(email.text).toContain("https://www.immovia.ch/dashboard/einstellungen");
    }
  });

  it.each(EMAIL_TEMPLATE_KEYS)("verwendet in «%s» kein «ß»", (key) => {
    const email = render(key);
    expect(`${email.subject}\n${email.html}\n${email.text}`).not.toContain("ß");
    expect(EMAIL_TEMPLATES[key].description).not.toContain("ß");
  });

  it("escaped Benutzerinhalte im HTML", () => {
    const evil = '<script>alert("x")</script>';
    const email = render("new_message", {
      ...SAMPLES.new_message,
      sender_name: '<img src=x onerror="alert(1)">',
      preview: `${evil} & "Anführungszeichen" 'einfach'`,
      listing_title: "<b>Fett</b>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).not.toContain("<b>Fett</b>");
    expect(email.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;Anführungszeichen&quot; &#39;einfach&#39;");
    expect(email.html).toContain("&lt;b&gt;Fett&lt;/b&gt;");
    expect(email.text).toContain(evil);
  });

  it("escaped den Empfängernamen und entfernt Steuerzeichen aus dem Betreff", () => {
    const email = renderEmail("new_message", { ...SAMPLES.new_message, sender_name: "Eve\r\nBcc: angriff@example.com" }, {
      siteUrl: SITE_URL,
      recipientName: '"><script>x</script>',
    });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).not.toContain("<script>x</script>");
    expect(sanitizeSubject("a\nb\tc")).toBe("a b c");
    expect(escapeHtml(`<>&"'\``)).toBe("&lt;&gt;&amp;&quot;&#39;&#96;");
  });

  it("verlangt Pflichtfelder", () => {
    const cases: Array<[EmailTemplateKey, Record<string, unknown>, string]> = [
      ["new_message", { ...SAMPLES.new_message, conversation_id: undefined }, "conversation_id"],
      ["new_inquiry", { ...SAMPLES.new_inquiry, conversation_id: "keine-uuid" }, "conversation_id"],
      ["org_invitation", { organization_name: "Firma" }, "token"],
      ["listing_published", { title: "Ohne Slug" }, "slug"],
      ["viewing_confirmed", { listing_title: LISTING_TITLE }, "when"],
      ["search_alert", { search_name: "Bern", listings: [] }, "listings"],
      ["account_change", { change: "telefon" }, "change"],
      ["document_shared", {}, "document_title"],
      ["dossier_ready", { title: "Dossier" }, "property_id"],
      ["viewing_reminder", { ...viewing }, "role"],
    ];
    for (const [key, payload, field] of cases) {
      let error: unknown;
      try {
        render(key, payload);
      } catch (e) {
        error = e;
      }
      expect(error, `${key} ohne ${field}`).toBeInstanceOf(EmailTemplateError);
      expect((error as EmailTemplateError).fields.some((f) => f.startsWith(field)), `${key}: ${field}`).toBe(true);
    }
  });

  it("weist unbekannte Vorlagen ab", () => {
    expect(() => render("gibt_es_nicht" as EmailTemplateKey, {})).toThrow(EmailTemplateError);
  });

  it("lässt unsichere Links nicht durch", () => {
    expect(() =>
      render("search_alert", { search_name: "Bern", listings: [{ ...listing, path: "javascript:alert(1)" }] }),
    ).toThrow(EmailTemplateError);
    const email = render("search_alert", { search_name: "Bern", listings: [{ ...listing, imageUrl: null }] });
    expect(email.html).not.toContain("javascript:");
  });

  it("baut Links zu Chat, Einladung und Besichtigungen", () => {
    expect(render("new_message").html).toContain(`https://www.immovia.ch/dashboard/nachrichten/${ID}`);
    expect(render("org_invitation").html).toContain(`https://www.immovia.ch/einladung/${"a1".repeat(32)}`);
    expect(render("viewing_requested").html).toContain(`https://www.immovia.ch/dashboard/besichtigungen?inserat=${ID}`);
    expect(render("search_alert_digest").html).toContain("https://www.immovia.ch/kaufen?ort=Bern&amp;zimmer_von=4");
  });

  it("hängt bei bestätigten Terminen eine ICS-Datei an", () => {
    const email = render("viewing_confirmed");
    expect(email.attachments).toHaveLength(1);
    const attachment = email.attachments![0]!;
    expect(attachment.filename).toMatch(/\.ics$/);
    const ics = Buffer.from(attachment.content, "base64").toString("utf8");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261114T090000Z");
    expect(ics).toContain(`UID:${ID}@immovia.ch`);
    expect(render("viewing_requested").attachments).toBeUndefined();
  });

  it("verwendet eine neutrale Anrede ohne Namen", () => {
    expect(render("welcome", {}, null).html).toContain(">Guten Tag</p>");
  });

  it("zeigt bei Zusammenfassungen die Anzahl weiterer Treffer", () => {
    const email = render("search_alert_digest");
    expect(email.subject).toBe("4 neue Inserate für «Wohnung Bern»");
    expect(email.text).toContain("2 weitere Treffer");
    const single = render("search_alert_digest", { ...SAMPLES.search_alert_digest, listings: [listing], total: 1 });
    expect(single.subject).toBe("Neues Inserat für «Wohnung Bern»");
  });
});
