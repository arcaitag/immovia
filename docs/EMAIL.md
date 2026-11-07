# E-Mail-Versand und Vorlagen

Immovia versendet zwei Arten von E-Mails:

1. **Konto-E-Mails von Supabase Auth** (Bestätigung, Passwort, Anmeldelink, E-Mail-Änderung, Einladung). Supabase verschickt sie über SMTP. Die Vorlagen liegen in `supabase/templates/*.html`.
2. **Transaktions-E-Mails der Plattform** (Anfragen, Nachrichten, Besichtigungen, Suchabos …). Sie laufen über die Outbox-Tabelle `email_outbox` und werden mit der Resend-REST-API versendet. Die Vorlagen liegen in `src/lib/email/templates/*`.

Beide nutzen dasselbe Layout (`src/lib/email/layout.ts`): weisser Hintergrund, Logo in #274B32/#5A8A30, grüner Akzentstreifen, Button in #4F7A2A (Markengrün minimal abgedunkelt, damit weisse Schrift den WCAG-AA-Kontrast erfüllt), Fusszeile mit Link zu `/dashboard/einstellungen`.

## 1. Resend einrichten

1. Konto bei [resend.com](https://resend.com) eröffnen.
2. **Domain verifizieren:** Resend → Domains → Add Domain (z. B. `immovia.ch`). Die angezeigten DNS-Einträge (SPF als TXT, DKIM als TXT, Return-Path/MX) beim DNS-Anbieter eintragen und warten, bis der Status «Verified» ist. Zusätzlich einen DMARC-Eintrag setzen, z. B. `_dmarc.immovia.ch TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@immovia.ch"`.
3. **API-Schlüssel:** Resend → API Keys → «Sending access», auf die Domain beschränkt. Für Supabase SMTP einen zweiten, separaten Schlüssel anlegen (lässt sich unabhängig widerrufen).
4. **Umgebungsvariablen** (Vercel → Project → Settings → Environment Variables, lokal `.env.local`):

| Variable | Beispiel | Zweck |
|---|---|---|
| `RESEND_API_KEY` | `re_…` | Versand der Outbox. Ohne Schlüssel bleiben Einträge `pending` (nichts geht verloren). |
| `EMAIL_FROM` | `Immovia <noreply@immovia.ch>` | Absender, Domain muss verifiziert sein |
| `EMAIL_REPLY_TO` | `support@immovia.ch` | Antwortadresse |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | Outbox und Cron laufen mit dem Service-Role-Schlüssel |
| `CRON_SECRET` | zufällig, ≥ 32 Zeichen | Schützt `/api/cron/process` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.immovia.ch` | Basis für alle Links in E-Mails |

Kosten (Stand Planung, bitte prüfen): Resend Free bis 3000 E-Mails pro Monat und 100 pro Tag, danach kostenpflichtig.

## 2. Supabase Auth: Resend als SMTP

Supabase Dashboard → **Authentication → Emails → SMTP Settings** → «Enable Custom SMTP»:

| Feld | Wert |
|---|---|
| Sender email | `noreply@immovia.ch` (verifizierte Domain) |
| Sender name | `Immovia` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend-API-Schlüssel (der separate SMTP-Schlüssel) |

Danach unter **Authentication → Rate Limits** das Limit für E-Mails an das erwartete Volumen anpassen (der eingebaute Supabase-Versand ist stark begrenzt und nur für Tests gedacht).

## 3. Auth-Vorlagen einfügen

Supabase Dashboard → **Authentication → Emails → Templates**. Für jede Vorlage Betreff setzen und den gesamten Inhalt der HTML-Datei in «Message body» einfügen:

| Supabase-Vorlage | Datei | Betreff | Link |
|---|---|---|---|
| Confirm signup | `supabase/templates/confirmation.html` | Bitte bestätigen Sie Ihre E-Mail-Adresse | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` |
| Reset password | `supabase/templates/recovery.html` | Passwort zurücksetzen | `…&type=recovery` (leitet auf `/passwort-zuruecksetzen`) |
| Magic link | `supabase/templates/magic_link.html` | Ihr Anmeldelink für Immovia | `…&type=magiclink` |
| Change email address | `supabase/templates/email_change.html` | Neue E-Mail-Adresse bestätigen | `…&type=email_change` |
| Invite user | `supabase/templates/invite.html` | Sie wurden zu Immovia eingeladen | `…&type=invite&next=/passwort-zuruecksetzen` |

Die Links verwenden `token_hash` statt `{{ .ConfirmationURL }}`. Damit funktioniert die Bestätigung auch, wenn der Link auf einem anderen Gerät geöffnet wird (Route `src/app/auth/confirm/route.ts`). «Secure email change» kann aktiviert bleiben: Supabase sendet die Vorlage dann an alte und neue Adresse, jeweils mit eigenem Token.

Lokale Entwicklung mit der Supabase CLI (`supabase/config.toml`):

```toml
[auth.email.template.confirmation]
subject = "Bitte bestätigen Sie Ihre E-Mail-Adresse"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Passwort zurücksetzen"
content_path = "./supabase/templates/recovery.html"

[auth.email.template.magic_link]
subject = "Ihr Anmeldelink für Immovia"
content_path = "./supabase/templates/magic_link.html"

[auth.email.template.email_change]
subject = "Neue E-Mail-Adresse bestätigen"
content_path = "./supabase/templates/email_change.html"

[auth.email.template.invite]
subject = "Sie wurden zu Immovia eingeladen"
content_path = "./supabase/templates/invite.html"
```

## 4. Redirect-URLs

Supabase Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://www.immovia.ch` (wird in den Vorlagen als `{{ .SiteURL }}` verwendet).
- **Redirect URLs:** `https://www.immovia.ch/**`, `http://localhost:3000/**` und für Vercel-Previews `https://*-<team-slug>.vercel.app/**`.

Hinweis: Die Auth-Vorlagen verlinken immer auf die Site URL. Wer Previews mit echten Bestätigungs-E-Mails testen will, verwendet ein separates Supabase-Projekt mit der Preview-URL als Site URL.

## 5. Transaktions-E-Mails (Outbox)

### Ablauf

1. Datenbankfunktionen und Trigger schreiben Einträge mit `queue_email()` in `email_outbox` (respektiert `user_notification_settings`, `dedupe_key` verhindert Doppelversand). Eigene Einträge aus dem Code: `queueEmail()` in `src/lib/email/queue.ts`.
2. Server Actions rufen danach `after(() => flushEmailOutbox())` auf (sofortiger Versand fälliger E-Mails, blockiert die Antwort nicht).
3. Der Cron-Endpoint `/api/cron/process` ruft `runScheduledTasks()` und `processEmailOutbox(50)` auf.
4. `processEmailOutbox()` reserviert Einträge mit `claim_emails` (`FOR UPDATE SKIP LOCKED`), ermittelt die Adresse (`to_email` oder `profiles.email`), reichert die Daten an, rendert die Vorlage und sendet mit `Idempotency-Key = email_outbox.id`.

### Status

| Status | Bedeutung |
|---|---|
| `pending` | wartet auf Versand (auch nach vorübergehendem Fehler, mit `scheduled_at` in der Zukunft) |
| `sending` | reserviert; hängt ein Eintrag länger als 10 Minuten, wird er erneut verarbeitet |
| `sent` | von Resend angenommen (`provider_message_id`) |
| `skipped` | bewusst nicht gesendet, Grund in `last_error` (z. B. Nachricht inzwischen gelesen, Inserat nicht mehr öffentlich, Konto gelöscht) |
| `failed` | endgültig fehlgeschlagen (ungültige Daten oder 5 Versuche ausgeschöpft), Grund in `last_error` |

Wiederholung: höchstens 5 Versuche mit Wartezeit 1, 5, 15 und 60 Minuten. Bei 401/403 (Schlüssel, Domain), 429 (Rate Limit, Kontingent) oder Netzwerkfehlern bricht der Durchlauf ab und gibt die übrigen Einträge ohne verbrauchten Versuch frei.

### Vorlagen

| Schlüssel | Auslöser | Empfänger | Einstellung |
|---|---|---|---|
| `welcome` | E-Mail-Adresse bestätigt | Neues Konto | – |
| `account_change` | E-Mail-Adresse oder Passwort geändert | Konto (bei E-Mail-Wechsel an die alte Adresse) | – (Sicherheitsmitteilung) |
| `org_invitation` | `invite_organization_member` | Eingeladene Adresse | – |
| `listing_published` | Inserat erstmals veröffentlicht | Eigentümer | `email_listing_updates` |
| `listing_moderated` | Moderation sperrt oder lehnt ab | Eigentümer | – |
| `dossier_ready` | Verkaufsdossier erstellt (über `queueEmail()`) | Ersteller | `email_listing_updates` |
| `new_inquiry` | `create_inquiry` | Verkäufer | `email_new_inquiry` |
| `new_message` | neue Nachricht (3 Minuten verzögert, höchstens eine pro 15 Minuten und Konversation; entfällt, wenn inzwischen gelesen) | andere Teilnehmende | `email_new_message` |
| `document_shared` | `grant_document_access` | Person mit Freigabe | `email_documents` |
| `viewing_requested` | `book_viewing` | Verkäufer | `email_viewings` |
| `viewing_confirmed` | Termin bestätigt (mit ICS-Anhang) | Interessent | `email_viewings` |
| `viewing_cancelled` | Termin abgesagt | jeweils andere Seite | `email_viewings` |
| `viewing_reschedule` | Interessent bittet um Änderung | Verkäufer | `email_viewings` |
| `viewing_rescheduled` | Verkäufer verschiebt (mit ICS-Anhang) | Interessent | `email_viewings` |
| `viewing_reminder` | Cron: bestätigter Termin in den nächsten 24 h | Interessent (mit ICS) und Verkäufer | `email_viewings` |
| `search_alert` | neues passendes Inserat (Suchabo «sofort») | Suchabo-Inhaber | `email_search_alerts` |
| `search_alert_digest` | Cron: tägliche bzw. wöchentliche Zusammenfassung | Suchabo-Inhaber | `email_search_alerts` |

Neue Vorlage hinzufügen: Datei in `src/lib/email/templates/` mit Zod-Schema und `build()`, in `templates/index.ts` registrieren, Beispiel in `tests/unit/email/templates.test.ts` ergänzen. Der Test liest die Migrationen und schlägt fehl, wenn die Datenbank einen Schlüssel ohne Vorlage einreiht.

Beispiel aus einem anderen Bereich (Dossier fertig):

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email/queue";
import { flushEmailOutbox } from "@/lib/email/outbox";

await queueEmail(createAdminClient(), {
  userId,
  template: "dossier_ready",
  setting: "email_listing_updates",
  payload: { property_id: propertyId, dossier_id: dossierId, title, version },
  dedupeKey: `dossier_ready:${dossierId}`,
});
after(() => flushEmailOutbox());
```

## 6. Zeitplan (Cron)

`vercel.json` (Vercel Pro) ruft `/api/cron/process` alle 5 Minuten auf: Verzögerte E-Mails (z. B. `new_message`, 3 Minuten) gehen spätestens 5 Minuten nach Fälligkeit hinaus. Stündlich läuft `/api/cron/process?scheduled=1` für Termin-Erinnerungen (24 Stunden vorher), Suchauftrag-Zusammenfassungen (täglich bzw. wöchentlich, jeweils ab 07:00 Zürcher Zeit) und Aufräumarbeiten.

Auf Vercel Hobby sind nur tägliche Crons erlaubt; dann den 5-Minuten-Takt über Supabase (`docs/DEPLOYMENT.md`, Abschnitt 7) oder einen externen Dienst mit `Authorization: Bearer <CRON_SECRET>` einrichten.

Manuell auslösen: `curl -H "Authorization: Bearer $CRON_SECRET" https://www.immovia.ch/api/cron/process`

## 7. Testen

- Resend-Testadressen: `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`.
- Outbox prüfen (SQL-Editor): `select template, status, attempts, last_error, scheduled_at from email_outbox order by created_at desc limit 50;`
- Vorlagen ohne Versand prüfen: `npx vitest run --project unit tests/unit/email`.

## 8. Fehlerbehebung

| Meldung in `last_error` | Ursache und Lösung |
|---|---|
| `Resend 401 …` | API-Schlüssel ungültig oder widerrufen |
| `Resend 403 … domain is not verified` | Absenderdomain in Resend verifizieren bzw. `EMAIL_FROM` anpassen |
| `Resend 429 rate_limit_exceeded` / `daily_quota_exceeded` | zu viele E-Mails; Versand wird automatisch später fortgesetzt, ggf. Plan erhöhen |
| `Resend 422 …` | ungültige Daten (z. B. Adresse); Eintrag bleibt `failed` |
| `Ungültige oder fehlende Daten für «…»` | Nutzdaten passen nicht zur Vorlage (Programmfehler); Vorlage oder auslösende Funktion prüfen |

## 9. Datenschutz

E-Mails enthalten Auszüge aus Nachrichten und Namen. Resend ist ein Auftragsbearbeiter; in der Datenschutzerklärung aufführen und die Datenregion bei Resend prüfen. Die Outbox speichert die Nutzdaten dauerhaft; versendete Einträge sollten regelmässig gelöscht werden (siehe offener Punkt im Abschlussbericht).
