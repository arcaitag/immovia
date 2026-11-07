# Umsetzungsstand

Stand: 7. November 2026, Branch `develop`. Dieses Dokument sagt ehrlich, was fertig und geprüft ist, was online noch fehlt und was nur mit externen Diensten funktioniert.

## Kurzfassung

| Bereich | Stand |
|---|---|
| Code | Alle Bereiche der Spezifikation umgesetzt und mit dem Backend verbunden (siehe unten). Lokal vollständig geprüft. |
| Tests | 302 Unit-Tests, 44 Datenbanktests (RLS, Rechte, Abläufe), 22 E2E-Tests (Szenarien A–D, Mobile, öffentliche Seiten) – alle grün, lokal gegen einen Produktions-Build. |
| Supabase (gehostet) | Projekt `immovia` in Zürich. Alle Migrationen eingespielt und per Schema-Prüfsumme mit der getesteten Datenbank verglichen. **Offen:** Entfernen von zwei leeren Spalten (siehe `docs/DEPLOYMENT.md`, Abschnitt 0). Keine Demo-Daten. |
| Vercel | Projekt verbunden, Builds von `develop` sind grün. **Die App läuft online noch nicht**: Die Umgebungsvariablen fehlen, die Suche meldet deshalb «Datenbank ist nicht erreichbar». Die Produktion (`main`) steht noch auf einem frühen Stand und ist durch Vercel Authentication geschützt. |
| Livegang | Noch nicht erfolgt. Voraussetzungen siehe «Offene Schritte». |

## Umgesetzt

| Bereich | Inhalt |
|---|---|
| Öffentliche Website | Startseite, Suche (Liste, Karte, Kombination; Filter, Umkreis, Kartenausschnitt, Sortierung, Paginierung), Kaufen/Mieten, Inseratseite (Galerie, Lage gemäss gewählter Genauigkeit, Kontakt, Anfrage, Besichtigung, Merkliste, Dossier), Verkaufen, Bewerten, Ratgeber, FAQ, Firmenprofile, Kontakt, Rechtstexte (als Entwurf gekennzeichnet) |
| Konto | Registrierung (privat oder Firma), E-Mail-Bestätigung geräteübergreifend, Login, Passwort vergessen/zurücksetzen, Profil, Einstellungen, Benachrichtigungen, Datenexport, Kontolöschung |
| Immobilien | Erfassungsassistent mit Zwischenspeichern, Bilder (Upload, Varianten mit sharp, EXIF/GPS entfernt, Bilderstudio mit Grundkorrekturen), Dokumente mit widerrufbaren Einzelfreigaben, Inserat-Editor mit Vorschau, Veröffentlichung mit Pflichtangaben und optionaler Prüfpflicht, Verwaltung (reserviert, verkauft, archiviert), Statistik |
| Bewertung | Datenbasiert aus echten, veröffentlichten Immovia-Inseraten: Preisspanne, Einflussfaktoren, Datenquellen, Unsicherheit. Reichen die Daten nicht, wird keine Zahl gezeigt. PDF-Bericht. |
| KI (Anthropic) | Beschreibungstexte als Entwürfe, Erklärung der Bewertung, Assistent; nur mit Einwilligung, Kontingente pro Benutzer, Verbrauch im Admin-Bereich |
| Dossier | PDF in drei Vorlagen, Versionen, öffentliche Freigabe pro Inserat |
| Kommunikation | Anfragen, Nachrichten mit Realtime und Anhängen, Leads mit internen Notizen, Besichtigungen (Zeitfenster, Buchung ohne Doppelbuchung, Kalenderdatei), Benachrichtigungen, E-Mails über Outbox und Resend, Suchaufträge mit Benachrichtigung |
| Firmen | Organisation, Einladungen, Rollen, Übertragung der Inhaberschaft |
| Administration | Übersicht, Benutzer, Firmen, Inserate (Moderation, Verifizierung), Meldungen, Kontaktanfragen, KI-Nutzung, Statistiken aus echten Daten, Einstellungen (Funktionen, Wartungsmodus, Registrierung), Protokoll |
| Sicherheit und Datenschutz | RLS auf allen Tabellen, Spalten- und Funktionsrechte (gegen die Supabase-Standardrechte gehärtet), Rate Limiting, private Buckets mit signierten Links, Aufräumjobs (E-Mail-Ausgang, verwaiste Dateien, gelöschte Immobilien), private Kontaktangaben getrennt vom öffentlichen Inserat |
| Betrieb | Cron-Endpoint für Jobs, E-Mails, Erinnerungen, Zusammenfassungen und Aufräumen; PWA (installierbar, Offline-Seite); SEO (Sitemap, robots.txt, Metadaten, strukturierte Daten); Schweizer Schreibweise und Formate (CHF, ohne ß) |

## Nur mit externem Dienst oder noch nicht angebunden

| Funktion | Voraussetzung |
|---|---|
| KI-Texte, Bewertungserklärung, Assistent | `ANTHROPIC_API_KEY`. Ohne Schlüssel sind die Funktionen sichtbar als nicht verfügbar markiert. |
| E-Mails an Benutzer | `RESEND_API_KEY`, verifizierte Absenderdomain. Ohne Schlüssel bleiben E-Mails in der Outbox. |
| Auth-E-Mails (Bestätigung, Passwort) | Eigenes SMTP in Supabase (Resend), sonst nur an Team-Mitglieder und mit tiefem Limit |
| Perspektivkorrektur, virtuelle Möblierung | Bild-KI-Anbieter (`IMAGE_AI_PROVIDER`), noch nicht angebunden – im Bilderstudio als nicht verfügbar markiert |
| Bewertung mit Transaktionsdaten | Lizenzierter Anbieter (`VALUATION_AVM_PROVIDER`), noch nicht angebunden |
| Zahlungen | Datenstruktur vorbereitet, kein Bezahlprozess |

## Offene Schritte (brauchen dich)

1. **Vercel-Umgebungsvariablen setzen** (Project → Settings → Environment Variables, Production und Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `ANALYTICS_SALT`, `NEXT_PUBLIC_SITE_URL` (nur Production) sowie optional `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`. Danach neu deployen. Claude hat keine Berechtigung, Umgebungsvariablen zu lesen oder zu setzen.
2. **Spalten entfernen** im Supabase SQL Editor (`docs/DEPLOYMENT.md`, Abschnitt 0).
3. **Supabase Auth**: Site URL und Redirect URLs, E-Mail-Vorlagen aus `supabase/templates/`, SMTP (Resend), «Confirm email» aktiv, Passwortlänge 10.
4. **Ersten Administrator** anlegen (SQL in `docs/DEPLOYMENT.md`, Abschnitt 1.8).
5. **Rechtstexte** prüfen lassen und ergänzen, danach `LEGAL_PAGES_ARE_DRAFTS` auf `false` setzen.
6. **swisstopo**: Bewilligung für die kommerzielle Nutzung des Kartenstils klären.
7. **Livegang**: eigene Domain oder Deployment-Schutz nur für Previews, `develop` nach `main` mergen, Supabase-Cron (5-Minuten-Takt) einrichten (`docs/DEPLOYMENT.md`, Abschnitte 6 und 7).
8. **Zweite Supabase-Datenbank für Previews** (empfohlen): Previews nutzen derzeit dieselbe Datenbank wie die Produktion. Für Tests mit Demo-Daten ein eigenes Entwicklungsprojekt anlegen und dessen Schlüssel nur für «Preview» setzen.

## Bekannte Grenzen

- Realtime (Chat, Benachrichtigungen) wurde lokal ohne Realtime-Server getestet; die Seiten funktionieren dann mit Neuladen. Online mit Supabase Realtime noch nicht geprüft, weil die App dort noch nicht läuft.
- Die Cron-Takte (alle 5 Minuten, stündlich) setzen Vercel Pro voraus. Bei einem Wechsel auf Hobby `vercel.json` anpassen (`docs/DEPLOYMENT.md`, Abschnitt 3.3).
- Die Migrationshistorie der gehosteten Datenbank weicht von den Dateinamen ab (Migrationen teils in mehreren Teilen eingespielt). Vor der ersten Arbeit mit der Supabase CLI einmalig angleichen (`docs/DEPLOYMENT.md`, Abschnitt 0).

## Verlauf

| Datum | Schritt |
|---|---|
| 6.11.2026 | Fundament (Next.js, Designsystem, Schema mit RLS, Auth), DB-Tests, Demo-Seed, PWA |
| 6.11.2026 | Fachbereiche: Immobilien, Inserate, Suche, Bewertung, KI, Bilder, Dossiers, Kommunikation, Besichtigungen, Firmen, Admin, E-Mails |
| 6.11.2026 | Review: Datenschutz-Korrekturen (Kontaktangaben, Prüfvermerke, KI-Einwilligung), Rechte-Härtung, Aufräumjobs, Schema in Supabase eingespielt und geprüft |
| 7.11.2026 | E2E-Szenarien A–D und Mobile; dabei gefundene Fehler behoben (Service Worker, Filter-Sheet, Aufrufstatistik, Admin-Text, Layout auf schmalen Bildschirmen, Barrierefreiheit) |
