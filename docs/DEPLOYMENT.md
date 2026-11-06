# Deployment: GitHub, Supabase, Vercel

Diese Anleitung beschreibt die Einrichtung von Immovia in einer neuen Umgebung. Für die Produktion gilt: Demo-Daten nie einspielen, alle Schlüssel nur als Umgebungsvariablen.

## 1. Supabase

1. **Projekt anlegen**: Region **Zürich (eu-central-2)**, starkes Datenbankpasswort.
2. **Migrationen einspielen** (Reihenfolge = Dateiname):
   - mit der Supabase CLI: `supabase link --project-ref <ref>` und `supabase db push`
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

1. Projekt aus dem GitHub-Repository erstellen (Framework: Next.js, Node 22).
2. **Umgebungsvariablen** (Production und Preview, siehe `.env.example`):

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

3. **Cron**: `vercel.json` ruft `/api/cron/process` täglich auf (Hobby-Plan erlaubt nur tägliche Crons). E-Mails und Jobs werden zusätzlich direkt nach der auslösenden Aktion verarbeitet. Auf dem Pro-Plan das Intervall auf z. B. `*/10 * * * *` verkürzen.
4. **Region**: Functions in `fra1` (nächstgelegen zu Supabase Zürich).
5. **Deployment prüfen**: Registrierung inkl. Bestätigungs-E-Mail, Login, Immobilie erfassen, Bild hochladen, Inserat veröffentlichen, Suche, Anfrage, Chat, Besichtigung, Dossier-PDF, Admin-Bereich.

## 4. Eigene Domain (später)

1. Domain in Vercel hinzufügen (Project → Settings → Domains), DNS gemäss Anleitung setzen.
2. `NEXT_PUBLIC_SITE_URL` anpassen und neu deployen.
3. In Supabase Site URL und Redirect URLs auf die Domain umstellen.
4. In Resend die Domain verifizieren (SPF, DKIM) und `EMAIL_FROM` anpassen.

## 5. Demo-Daten (nur Entwicklung / Preview-Datenbank)

`supabase/seed.sql` im SQL Editor einer **Entwicklungsdatenbank** ausführen. Das Skript bricht ab, sobald echte Inserate existieren. Entfernen mit `supabase/demo-cleanup.sql`. Demo-Konten und Passwort stehen im Kopf von `seed.sql`.

## 6. Kosten (Stand Planung, bitte selbst prüfen)

| Dienst | Kosten |
|---|---|
| Supabase | Free (max. 2 aktive Projekte, pausiert nach Inaktivität) oder Pro ab ca. 25 USD/Monat |
| Vercel | Hobby gratis (nicht für kommerzielle Nutzung), Pro ab ca. 20 USD/Monat und Mitglied |
| Anthropic | nutzungsabhängig; Kontingente pro Benutzer in den Admin-Einstellungen |
| Resend | Free bis 3000 E-Mails/Monat |
| swisstopo/geo.admin.ch | gratis mit Quellenangabe |
