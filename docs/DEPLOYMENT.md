# Deployment: GitHub, Supabase, Vercel

Diese Anleitung beschreibt die Einrichtung von Immovia in einer neuen Umgebung. Für die Produktion gilt: Demo-Daten nie einspielen, alle Schlüssel nur als Umgebungsvariablen.

## 0. Aktueller Stand der Immovia-Umgebung (7. November 2026)

| Teil | Stand |
|---|---|
| GitHub | `arcaitag/immovia`; Entwicklung auf `develop` (Preview-Deployments), Produktion = `main` |
| Supabase | Projekt `immovia` (Ref `wlvhzhphpyvlqkafskwf`, Zürich, PostgreSQL 17). Alle Migrationen bis `20261107100000` eingespielt und per `scripts/schema-fingerprint.sql` gegen die lokal getestete Datenbank geprüft. **Offen:** das Entfernen der zwei leeren Spalten `listings.contact_email`/`contact_phone` (siehe unten, braucht eine Bestätigung im Dashboard). Keine Demo-Daten. |
| Vercel | Projekt `immovia` (Team arcaitag), mit dem Repository verbunden. Produktionsdomain `immovia-olive.vercel.app`, derzeit durch **Vercel Authentication** geschützt (nur Team-Mitglieder). Die Produktion steht noch auf einem frühen Stand von `main`; der aktuelle Code liegt auf `develop`. Umgebungsvariablen fehlen noch und müssen im Dashboard gesetzt werden (siehe 3.2). |

### Noch auszuführen (Supabase SQL Editor)

```sql
-- Teil von Migration 20261106250000: private Kontaktfelder liegen in listing_contacts
alter table public.listings drop column contact_email, drop column contact_phone;
```

### Migrationshistorie und Supabase CLI

Die Migrationen wurden über die Supabase-Verbindung von Claude eingespielt (teilweise in mehreren Teilen). Die Versionen in `supabase_migrations.schema_migrations` entsprechen deshalb nicht den Dateinamen. Wer später mit der CLI arbeitet, gleicht die Historie einmalig an:

```bash
supabase link --project-ref wlvhzhphpyvlqkafskwf
supabase migration list                     # zeigt die abweichenden Remote-Versionen
supabase migration repair --status reverted <alle Remote-Versionen aus der Liste>
supabase migration repair --status applied 20261106100000 20261106100100 20261106100200 20261106100300 \
  20261106100400 20261106100500 20261106100600 20261106100700 20261106100800 20261106100900 \
  20261106220000 20261106240000 20261106250000 20261106260000 20261106900000 20261107100000
```

## 1. Supabase

1. **Projekt anlegen**: Region **Zürich (eu-central-2)**, starkes Datenbankpasswort.
2. **Migrationen einspielen** (Reihenfolge = Dateiname):
   - mit der Supabase CLI: `supabase link --project-ref <ref>` und `supabase db push` (Konfiguration in `supabase/config.toml`; `supabase start` startet dieselbe Umgebung lokal inkl. Demo-Daten)
   - oder im SQL Editor jede Datei aus `supabase/migrations/` nacheinander ausführen.
   Die Migrationen legen Tabellen, RLS, Funktionen, Storage-Buckets inkl. Policies und die Realtime-Publikation an.
3. **Auth → URL Configuration**
   - Site URL: `https://<deine-domain>` (vorläufig die Vercel-Produktions-URL)
   - Redirect URLs: `https://<deine-domain>/auth/callback`, `https://<deine-domain>/auth/confirm`, für Previews `https://*-arcaitag.vercel.app/**`, lokal `http://localhost:3000/**`
4. **Auth → Providers → Email**: «Confirm email» aktiv, minimale Passwortlänge 10. Auf dem Pro-Plan zusätzlich «Leaked password protection» aktivieren.
5. **Auth → Email Templates**: Inhalte aus `supabase/templates/*.html` übernehmen (Links auf `/auth/confirm?token_hash=…` funktionieren geräteübergreifend). Details: `docs/EMAIL.md`.
6. **Auth → SMTP**: Ohne eigenes SMTP sendet Supabase nur an Team-Mitglieder und mit tiefem Limit. Für echte Registrierungen Resend als SMTP eintragen (`docs/EMAIL.md`).
7. **API-Schlüssel** (Project Settings → API Keys): Publishable Key (öffentlich) und Secret Key (nur Server) für Vercel notieren.
8. **Erster Administrator**: normal registrieren, dann im SQL Editor
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'deine@adresse.ch';
   ```
9. **Advisors prüfen** (Database → Advisors → Security/Performance) nach dem Einspielen.

## 2. GitHub

Leeres privates Repository anlegen und den Code pushen (`main`). Vercel deployt danach automatisch: jeder Branch/PR als Preview, `main` als Produktion.

## 3. Vercel

1. Projekt aus dem GitHub-Repository erstellen (Framework: Next.js, Node 22 oder neuer).
2. **Umgebungsvariablen** (Project → Settings → Environment Variables; Production und Preview, siehe `.env.example`).
   Zufallswerte z. B. mit `openssl rand -base64 32` erzeugen. Nach dem Setzen neu deployen, weil `NEXT_PUBLIC_*` beim Build eingesetzt wird.

| Variable | Pflicht | Hinweis |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ja | z. B. `https://www.immovia.ch` (Preview: leer lassen, dann wird `VERCEL_URL` verwendet) |
| `NEXT_PUBLIC_SUPABASE_URL` | ja | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ja | Publishable Key |
| `SUPABASE_SECRET_KEY` | ja | Secret Key – als «Sensitive» markieren |
| `CRON_SECRET` | ja | Zufallswert, schützt `/api/cron/process` |
| `ANALYTICS_SALT` | ja | Zufallswert (≥ 32 Zeichen) für die Aufrufstatistik |
| `ANTHROPIC_API_KEY` | für KI | KI-Texte, Bewertungserklärung, Assistent |
| `ANTHROPIC_MODEL` | nein | Standard siehe `src/lib/ai` |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | für E-Mails | Absenderdomain bei Resend verifizieren |
| `IMAGE_AI_PROVIDER` | nein | Noch kein Anbieter angebunden |
| `VALUATION_AVM_PROVIDER` | nein | Lizenzierter Bewertungsanbieter, noch nicht angebunden |

3. **Cron** (`vercel.json`, nur Produktion): alle 5 Minuten `/api/cron/process` (Jobs nachholen, E-Mails versenden, auch gebündelte Nachrichten-E-Mails) und stündlich `/api/cron/process?scheduled=1` (Termin-Erinnerungen, Suchauftrag-Zusammenfassungen ab 07:00, Aufräumen). Vercel sendet `CRON_SECRET` automatisch mit. Diese Takte setzen **Vercel Pro** voraus. Auf Hobby schlägt das Deployment mit diesen Ausdrücken fehl: dann nur den Eintrag mit `?scheduled=1` und täglichem Ausdruck behalten (z. B. `0 6 * * *`) und den 5-Minuten-Takt über Supabase einrichten (Abschnitt 7).
4. **Region**: Functions in `fra1` (nächstgelegen zu Supabase Zürich).
5. **Deployment prüfen**: Registrierung inkl. Bestätigungs-E-Mail, Login, Immobilie erfassen, Bild hochladen, Inserat veröffentlichen, Suche, Anfrage, Chat, Besichtigung, Dossier-PDF, Admin-Bereich.

## 4. Eigene Domain (später)

1. Domain in Vercel hinzufügen (Project → Settings → Domains), DNS gemäss Anleitung setzen.
2. `NEXT_PUBLIC_SITE_URL` anpassen und neu deployen.
3. In Supabase Site URL und Redirect URLs auf die Domain umstellen.
4. In Resend die Domain verifizieren (SPF, DKIM) und `EMAIL_FROM` anpassen.

## 5. Demo-Daten (nur Entwicklung / Preview-Datenbank)

`supabase/seed.sql` im SQL Editor einer **Entwicklungsdatenbank** ausführen. Das Skript bricht ab, sobald echte Inserate existieren. Entfernen mit `supabase/demo-cleanup.sql`. Demo-Konten und Passwort stehen im Kopf von `seed.sql`.

## 6. Deployment-Schutz und Livegang

Das Vercel-Projekt ist mit «Vercel Authentication» (Standard des Teams) geschützt: Alle `*.vercel.app`-Adressen verlangen ein Vercel-Login, nur eigene Domains sind öffentlich. Für Tests ist das ideal. Für den Livegang:

1. Eigene Domain verbinden (Abschnitt 4) **oder** unter Project → Settings → Deployment Protection den Schutz auf «Preview Deployments» einschränken.
2. Supabase Auth: Site URL und Redirect URLs auf die öffentliche Adresse setzen, SMTP (Resend) und E-Mail-Vorlagen einrichten.
3. `LEGAL_PAGES_ARE_DRAFTS` in `src/lib/content/legal.ts` erst auf `false` setzen, wenn Impressum, Datenschutz und AGB rechtlich geprüft und ergänzt sind.
4. Kartenstil: Bewilligung von swisstopo für die kommerzielle Nutzung klären (siehe `docs/ARCHITEKTUR.md`).
5. `develop` nach `main` mergen → Produktions-Deployment.

## 7. Hintergrundverarbeitung alle 5 Minuten über Supabase (nur Vercel Hobby)

Auf Vercel Pro übernimmt `vercel.json` den 5-Minuten-Takt; dieser Abschnitt entfällt dann. Auf Hobby erst einrichten, wenn die Produktionsadresse öffentlich erreichbar ist (eigene Domain oder Schutz nur für Previews), sonst blockiert der Deployment-Schutz die Aufrufe. Im SQL Editor (Erweiterungen `pg_cron` und `pg_net` unter Database → Extensions aktivieren):

```sql
-- gleicher Wert wie CRON_SECRET in Vercel
select vault.create_secret('<CRON_SECRET>', 'immovia_cron_secret');

-- alle 5 Minuten: Jobs nachholen und E-Mails versenden
select cron.schedule('immovia-process', '*/5 * * * *', $$
  select net.http_get(
    url := 'https://<domain>/api/cron/process',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'immovia_cron_secret'))
  );
$$);

-- stündlich: Erinnerungen, Zusammenfassungen, Aufräumen
select cron.schedule('immovia-scheduled', '17 * * * *', $$
  select net.http_get(
    url := 'https://<domain>/api/cron/process?scheduled=1',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'immovia_cron_secret'))
  );
$$);
```

## 8. Kosten (Stand Planung, bitte selbst prüfen)

| Dienst | Kosten |
|---|---|
| Supabase | Free (max. 2 aktive Projekte, pausiert nach Inaktivität) oder Pro ab ca. 25 USD/Monat |
| Vercel | Hobby gratis (nicht für kommerzielle Nutzung, Cron nur täglich), Pro ab ca. 20 USD/Monat und Mitglied (Cron im Minutentakt; Immovia nutzt Pro) |
| Anthropic | nutzungsabhängig; Kontingente pro Benutzer in den Admin-Einstellungen |
| Resend | Free bis 3000 E-Mails/Monat |
| swisstopo/geo.admin.ch | gratis mit Quellenangabe; für kommerzielle Nutzung des Kartenstils Bewilligung von swisstopo einholen |
