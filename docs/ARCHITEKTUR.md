# Immovia – Technische Umsetzungsplanung

Stand: 6. November 2026. Dieses Dokument hält die Architekturentscheide fest. Der Umsetzungsstand steht in `docs/FORTSCHRITT.md`.

## 1. Technologie-Stack

| Bereich | Entscheid | Begründung |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 | Server Components, Server Actions, `after()` für Hintergrundarbeit, stabil auf Vercel |
| Sprache | TypeScript 5.9, Strict Mode | TS 7 (native) wird von Next/ESLint-Tooling noch nicht durchgehend unterstützt |
| Styling | Tailwind CSS 4, eigene Design Tokens, Komponenten im shadcn/ui-Stil auf Radix | Volle Kontrolle über das Design, keine Template-Optik |
| Formulare | React Hook Form + Zod 4 | Dieselben Zod-Schemas validieren Client **und** Server |
| Daten | Supabase (PostgreSQL 17, Auth, Storage, Realtime) mit `@supabase/ssr` | RLS als zweite Sicherheitslinie unter der Server-Logik |
| Karten & Orte | MapLibre GL + swisstopo-Vektorkarte (`vectortiles.geo.admin.ch`), Ortssuche über `api3.geo.admin.ch` SearchServer | Offizielle Schweizer Geodaten (OGD, frei nutzbar mit Quellenangabe «© swisstopo»), kein API-Key |
| PDF | `@react-pdf/renderer` serverseitig | Läuft in Vercel Functions ohne Chromium, echte Vektor-PDFs |
| Bilder | `sharp` serverseitig, austauschbare Provider-Schnittstelle für Bild-KI | Grundkorrekturen funktionieren ohne externe KI |
| KI-Text | Anthropic Claude über `@anthropic-ai/sdk`, austauschbare Provider-Schicht | Strukturierte, mit Zod validierte Ausgaben |
| E-Mail | Resend (REST) mit Outbox-Tabelle | Zuverlässiger Versand mit Wiederholung und Deduplizierung |
| Schriften | Manrope (Titel) und Inter (Text), selbst gehostet via Fontsource | Kein Google-Fonts-Request (Datenschutz) |
| Tests | Vitest (Unit + DB/RLS gegen echte PostgreSQL), Playwright (E2E) | RLS-Regeln werden gegen eine echte Datenbank geprüft |

## 2. Schichten

```
src/app          Routen (öffentlich, Auth, Dashboard, Admin, API)
src/components   UI (ui/ = Designsystem, Fachkomponenten pro Bereich)
src/services     Geschäftslogik pro Fachbereich (nur Server)
src/lib          Infrastruktur: supabase, ai, valuation, images, pdf, email, jobs, geo, validation
supabase/        SQL-Migrationen, Seed, E-Mail-Vorlagen für Supabase Auth
tests/           unit, db (RLS-Szenarien), e2e
```

Regeln: Seiten und Server Actions sind dünn und rufen Services auf. Services validieren mit Zod, prüfen Berechtigungen und greifen über den Supabase-Client **des eingeloggten Benutzers** zu, damit RLS immer mitgreift. Der Service-Role-Client wird nur für klar begrenzte Systemaufgaben verwendet (Aufrufstatistik, Cron-Jobs, E-Mail-Outbox, Kontolöschung).

## 3. Datenmodell (Kurzfassung)

- **Benutzer:** `profiles` (privat), `public_profiles` (nur Anzeigename, Avatar, Kontotyp, Verifizierungen), `user_roles` (admin, moderator), `user_preferences`, `user_notification_settings`.
- **Organisationen:** `organizations`, `organization_members` (owner, admin, member), `organization_invitations`.
- **Immobilien:** `properties` (vollständige, private Objektdaten inkl. exakter Adresse), `property_features`, `property_renovations`, `property_images`, `property_documents`.
- **Inserate:** `listings` enthält einen **öffentlichen Ausschnitt** der Objektdaten. Ein Trigger hält ihn mit `properties` synchron und berechnet die öffentliche Adresse und Koordinaten gemäss der vom Eigentümer gewählten Genauigkeit (exakt, Strasse, nur Ort). So kann die öffentliche Suche nie die exakte Adresse auslesen. `listing_status_history` protokolliert jeden Statuswechsel.
- **Bewertung & KI:** `property_valuations`, `valuation_sources`, `valuation_comparables`, `ai_generation_jobs` (Job-Queue), `ai_usage_events` (Kosten/Kontingente), `generated_descriptions`, `image_transformations`.
- **Dossiers & Dokumente:** `dossier_templates`, `generated_dossiers` (versioniert), `document_access_grants` (widerrufbare Einzelfreigaben).
- **Suche & Interaktion:** `favorites`, `saved_searches`, `saved_search_matches` (verhindert doppelte Benachrichtigungen), `listing_views` (pro Besucher und Tag nur einmal, gehashte Kennung ohne IP), `listing_inquiries`.
- **Kommunikation:** `conversations` (eine pro Inserat und Interessent), `conversation_participants`, `messages`, `user_blocks`, `leads` und `lead_notes` (nur Verkäuferseite), `viewing_slots`, `viewing_appointments`, `viewing_appointment_notes`.
- **Betrieb:** `notifications`, `email_outbox`, `user_reports`, `moderation_actions`, `admin_audit_logs` (nur anhängen), `feature_settings`, `verifications`, `contact_requests`, `rate_limit_buckets`, `assistant_threads`, `assistant_messages`.
- **Später:** `plans`, `subscriptions`, `payment_transactions` (Struktur vorbereitet, kein Bezahlprozess).

Alle Tabellen: UUID-Primärschlüssel, `created_at`/`updated_at`, Foreign Keys mit bewusstem `on delete`, Indizes auf allen Fremdschlüsseln und Filterfeldern, Soft Delete (`deleted_at`) bei Immobilien, Inseraten und Dokumenten.

## 4. Sicherheitskonzept

1. **RLS auf jeder Tabelle.** Hilfsfunktionen (`is_admin`, `can_manage_property`, `is_conversation_participant`, `can_read_document` …) sind `SECURITY DEFINER` mit leerem `search_path`.
2. **Spaltenrechte:** Benutzer können sensible Spalten (Status, Rolle, Moderation, Demo-Kennzeichen) nicht schreiben. Statusübergänge von Inseraten prüft ein Trigger (z. B. keine Veröffentlichung eines gesperrten Inserats, Prüfpflicht wenn aktiviert).
3. **Kritische Abläufe als Datenbankfunktionen** in einer Transaktion: Anfrage senden, Besichtigung buchen (Zeilensperre, keine Doppelbuchung), Statuswechsel von Terminen, Admin-Aktionen (immer mit Audit-Log).
4. **Storage:** private Buckets für Originalbilder, Dokumente, Dossiers und Nachrichtenanhänge mit Pfad-basierten Policies; öffentliche Bilder werden serverseitig neu kodiert (EXIF/GPS entfernt). Downloads privater Dateien nur über kurzlebige signierte Links.
5. **Rate Limiting** in PostgreSQL (`check_rate_limit`) für Anfragen, Nachrichten, Meldungen, KI-Aufrufe und Kontaktformular.
6. **Keine Geheimnisse im Client.** Nur `NEXT_PUBLIC_SUPABASE_URL` und der Publishable Key sind öffentlich.
7. Interne Notizen (Leads, Termine) liegen in eigenen Tabellen, die Interessenten nie lesen können.

## 5. KI und Ehrlichkeit

- **Bewertung:** Zahlen liefert ausschliesslich ein deterministischer Bewertungs-Provider, nie das Sprachmodell. Ohne lizenzierte Transaktionsdaten nutzt Immovia nur **Angebotspreise echter, veröffentlichter Immovia-Inserate** (Demo-Inserate ausgeschlossen) und kennzeichnet sie als solche. Bei zu wenigen Vergleichsobjekten wird **keine Zahl** angezeigt, sondern «noch keine belastbare Bewertung möglich». Eine Schnittstelle für lizenzierte Anbieter ist vorbereitet. Das Sprachmodell erklärt nur Faktoren auf Basis der erfassten Daten.
- **Texte:** Prompts enthalten nur geprüfte Objektdaten; die Ausgabe wird mit Zod validiert. Generierte Texte landen als Entwurf und werden erst durch den Benutzer übernommen; manuell bearbeitete Felder werden nie still überschrieben.
- **Bilder:** Grundkorrekturen mit `sharp`. Perspektivkorrektur und virtuelle Möblierung brauchen einen externen Bild-KI-Anbieter; ohne Konfiguration sind diese Funktionen sichtbar als nicht verfügbar markiert. Veränderte Bilder behalten das Original, KI-Visualisierungen tragen ein sichtbares Label.

## 6. Hintergrundjobs (Vercel-tauglich)

`ai_generation_jobs` und `email_outbox` sind Warteschlangen in PostgreSQL. Eine Server Action legt den Job an und verarbeitet ihn direkt danach mit `after()` (Antwort kommt sofort zurück, der Client pollt den Status). Ein Cron-Endpoint (`/api/cron/process`) holt hängengebliebene oder fehlgeschlagene Jobs mit `FOR UPDATE SKIP LOCKED` nach (max. Versuche, Backoff). Lange Aufgaben bleiben unter der Function-Laufzeitgrenze, weil jeder Job einzeln läuft.

## 7. Umgebungen

- **Entwicklung:** lokal, `.env.local`, Demo-Seed (`supabase/seed.sql`, nur Entwicklung, alle Datensätze `is_demo = true`).
- **Preview:** Vercel-Preview pro Branch.
- **Produktion:** Vercel-Produktion + Supabase-Projekt in Zürich (eu-central-2). Demo-Daten werden nie automatisch eingespielt; die App funktioniert mit leerer Datenbank.

## 8. Externe Abhängigkeiten und Kosten

| Dienst | Zweck | Kosten (Stand Planung, bitte selbst prüfen) |
|---|---|---|
| Supabase | DB, Auth, Storage, Realtime | Free (2 Projekte, pausiert bei Inaktivität) oder Pro ab ca. 25 USD/Monat |
| Vercel | Hosting | Hobby gratis (nicht für kommerzielle Nutzung), Pro ab ca. 20 USD/Monat |
| Anthropic | KI-Texte, Erklärungen, Assistent | nutzungsabhängig pro Token, Kontingente in `feature_settings` |
| Resend | Transaktions-E-Mails, SMTP für Supabase Auth | Free bis 3000 Mails/Monat, danach kostenpflichtig |
| swisstopo / geo.admin.ch | Karten, Ortssuche | gratis (OGD), Quellenangabe Pflicht, Fair-Use |
| Bild-KI (optional) | Perspektive, virtuelle Möblierung | anbieterabhängig, noch nicht angebunden |
| Lizenzierte Marktdaten (optional) | belastbare Bewertungen | kostenpflichtig, Anbieter noch offen |
