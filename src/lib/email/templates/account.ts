import { z } from "zod";
import { SITE } from "@/lib/constants";
import { defineTemplate, nameOr } from "@/lib/email/templates/shared";

/** Konto: Willkommen, Sicherheitsmitteilungen, Firmeneinladung. */

export const welcomeTemplate = defineTemplate({
  description: "Nach der Bestätigung der E-Mail-Adresse",
  schema: z.object({}),
  build: (_data, ctx) => ({
    subject: "Willkommen bei Immovia",
    preheader: "Ihr Konto ist bereit. So geht es weiter.",
    heading: "Willkommen bei Immovia",
    footerReason: "Sie erhalten diese E-Mail, weil Sie ein Konto bei Immovia eröffnet haben.",
    blocks: [
      { type: "paragraph", text: "Ihr Konto ist bestätigt. Schön, dass Sie da sind." },
      {
        type: "paragraph",
        text: "Als Verkäuferin oder Verkäufer erfassen Sie Ihre Immobilie Schritt für Schritt, lassen sie bewerten, erstellen ein Verkaufsdossier und verwalten Anfragen und Besichtigungen an einem Ort. Wenn Sie suchen, speichern Sie Favoriten und lassen sich über neue Angebote informieren.",
      },
      { type: "button", label: "Zum Dashboard", url: ctx.url("/dashboard") },
      { type: "link", label: "Immobilien suchen", url: ctx.url("/immobilien") },
    ],
  }),
});

export const accountChangeTemplate = defineTemplate({
  description: "Sicherheitsmitteilung bei Änderung von E-Mail-Adresse oder Passwort",
  schema: z.object({ change: z.enum(["email", "password"]) }),
  build: (data, ctx) => {
    const isEmail = data.change === "email";
    return {
      subject: "Wichtige Änderung an Ihrem Immovia-Konto",
      preheader: isEmail ? "Die E-Mail-Adresse Ihres Kontos wurde geändert." : "Das Passwort Ihres Kontos wurde geändert.",
      heading: isEmail ? "Ihre E-Mail-Adresse wurde geändert" : "Ihr Passwort wurde geändert",
      footerReason: "Sicherheitsmitteilungen senden wir unabhängig von Ihren Benachrichtigungseinstellungen.",
      blocks: [
        {
          type: "paragraph",
          text: isEmail
            ? "Die E-Mail-Adresse Ihres Immovia-Kontos wurde soeben geändert. Diese Mitteilung geht an Ihre bisherige Adresse."
            : "Das Passwort Ihres Immovia-Kontos wurde soeben geändert.",
        },
        { type: "paragraph", text: "Wenn Sie die Änderung selbst vorgenommen haben, ist nichts weiter zu tun." },
        {
          type: "notice",
          tone: "warning",
          text: `Waren Sie das nicht? Setzen Sie Ihr Passwort sofort zurück und kontaktieren Sie uns unter ${ctx.supportEmail ?? SITE.supportEmail}.`,
        },
        { type: "button", label: "Passwort zurücksetzen", url: ctx.url("/passwort-vergessen") },
      ],
    };
  },
});

const ORG_ROLE_LABELS = { owner: "Inhaberin oder Inhaber", admin: "Administration", member: "Mitglied" } as const;

export const orgInvitationTemplate = defineTemplate({
  description: "Einladung in ein Firmenkonto (Empfänger braucht noch kein Konto)",
  schema: z.object({
    organization_name: z.string().min(1).max(200),
    token: z.string().regex(/^[A-Za-z0-9_-]{16,200}$/, "Ungültiges Token"),
    role: z.enum(["owner", "admin", "member"]).nullish(),
  }),
  build: (data, ctx) => {
    const org = nameOr(data.organization_name, "Ein Firmenkonto");
    return {
      subject: `Einladung zum Firmenkonto ${org} auf Immovia`,
      preheader: `${org} lädt Sie zur Zusammenarbeit auf Immovia ein.`,
      heading: "Sie wurden eingeladen",
      footerReason:
        "Sie erhalten diese E-Mail, weil Sie zu einem Firmenkonto auf Immovia eingeladen wurden. Falls Sie die Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.",
      showSettingsLink: false,
      blocks: [
        { type: "paragraph", text: `${org} lädt Sie ein, im Firmenkonto auf Immovia mitzuarbeiten.` },
        {
          type: "facts",
          items: [
            { label: "Firma", value: org },
            { label: "Rolle", value: ORG_ROLE_LABELS[data.role ?? "member"] },
          ],
        },
        {
          type: "paragraph",
          text: "Melden Sie sich mit dieser E-Mail-Adresse an oder eröffnen Sie ein kostenloses Konto. Die Einladung ist 7 Tage gültig.",
        },
        { type: "button", label: "Einladung ansehen", url: ctx.url(`/einladung/${encodeURIComponent(data.token)}`) },
      ],
    };
  },
});
