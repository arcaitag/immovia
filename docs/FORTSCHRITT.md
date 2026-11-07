# Umsetzungsstand

Stand: 7. November 2026, Branch `develop`. Dieses Dokument sagt ehrlich, was fertig und geprüft ist, was online noch fehlt und was nur mit externen Diensten funktioniert.

## Kurzfassung

| Bereich | Stand |
|---|---|
| Code | Alle Bereiche der Spezifikation umgesetzt und mit dem Backend verbunden (siehe unten). Lokal vollständig geprüft. |
| Tests | 327 Unit-Tests, 48 Datenbanktests (RLS, Rechte, Abläufe), 22 E2E-Tests (Szenarien A–D, Mobile, öffentliche Seiten) – alle grün, lokal gegen einen Produktions-Build. Unabhängige Sicherheitsprüfung der Server-Grenze durchgeführt, Befunde behoben. |
| Supabase (gehostet) | Projekt `immovia` in Zürich. Alle Migrationen eingespielt und per Schema-Prüfsumme mit der getesteten Datenbank verglichen. Keine Demo-Daten. |
| Vercel | Produktion (`main`) läuft auf dem aktuellen Stand mit Datenbankanbindung, geschützt durch Vercel Authentication (nur Team-Mitglieder). Umgebungsvariablen sind nur für «Production» gesetzt; Previews von `develop` laufen deshalb ohne Datenbank. Cron alle 5 Minuten bzw. stündlich (Vercel Pro). |
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

1. **Supabase Auth**: Site URL `https://immovia-olive.vercel.app` (später die eigene Domain) und Redirect URLs (`docs/DEPLOYMENT.md`, Abschnitt 1.3), E-Mail-Vorlagen aus `supabase/templates/`, SMTP (Resend), «Confirm email» aktiv, Passwortlänge 10. Ohne eigenes SMTP verschickt Supabase nur an Mitglieder des Supabase-Teams und mit tiefem Limit.
2. **Ersten Administrator** anlegen: normal registrieren, dann SQL aus `docs/DEPLOYMENT.md`, Abschnitt 1.8.
3. **Optionale Dienste**: `ANTHROPIC_API_KEY` (KI-Funktionen), `RESEND_API_KEY` und `EMAIL_FROM` (E-Mails an Benutzer) in Vercel für «Production» setzen und neu deployen.
4. **Previews**: Für Previews mit Datenbank eine zweite Supabase-Datenbank (Entwicklung, mit Demo-Daten) anlegen und deren Schlüssel nur für «Preview» setzen. Die Produktionsschlüssel nicht für Previews verwenden.
5. **Rechtstexte** prüfen lassen und ergänzen, danach `LEGAL_PAGES_ARE_DRAFTS` auf `false` setzen.
6. **swisstopo**: Bewilligung für die kommerzielle Nutzung des Kartenstils klären.
7. **Livegang**: eigene Domain verbinden oder den Deployment-Schutz auf Previews beschränken (`docs/DEPLOYMENT.md`, Abschnitt 6).

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
| 7.11.2026 | Umgebungsvariablen für Produktion gesetzt, `develop` nach `main` übernommen: Produktion läuft mit Datenbank (geschützt); Cron für Vercel Pro |
| 7.11.2026 | Unabhängige Sicherheitsprüfung (Service Role, API-Routen, Server Actions): Open Redirect nach dem Login, Assistent-Kontingent bei Abbruch, Dossier-Pfade, Bildpfade, private E-Mail im Dossier, Rechteprüfung bei Hintergrundjobs, Aufrufzähler, PDF-Rate-Limit und Demo-Seed-Schutz behoben |
