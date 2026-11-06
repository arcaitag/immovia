# Tests

## Übersicht

| Ebene | Werkzeug | Befehl | Umfang |
|---|---|---|---|
| Typen | TypeScript strict | `npm run typecheck` | gesamter Code |
| Statische Analyse | ESLint (next/core-web-vitals, typescript) | `npm run lint` | gesamter Code |
| Unit | Vitest | `npm test` | Formatierung, Suchkriterien, Validierung, Bewertungslogik, Vorlagen, ICS, PDF-Erzeugung |
| Datenbank | Vitest + echte PostgreSQL | `npm run test:db` | RLS, Spaltenrechte, Trigger, RPCs, Szenario D |
| End-to-End | Playwright | `npm run test:e2e` | Szenarien A–D gegen eine laufende Instanz |

## Datenbanktests

Die Tests spielen alle Migrationen in eine frische lokale PostgreSQL-Datenbank ein und führen jede Abfrage mit der Rolle (`anon`, `authenticated`, `service_role`) und den JWT-Claims des jeweiligen Benutzers aus – genau wie die Supabase-API. `tests/db/supabase-bootstrap.sql` bildet die relevanten Teile von Supabase nach (Rollen, `auth.uid()`, `auth.users`, `storage.objects`, `storage.foldername`) und vergibt bewusst **keine** Default-Privileges, damit fehlende Grants auffallen.

```bash
npm run db:local -- start   # PostgreSQL 16 ohne Docker auf Port 54329
npm run test:db
```

Abgedeckt (Auszug):
- Fremde Immobilien-IDs: kein Lesen, Ändern, Löschen, keine Inserate für fremde Objekte
- Öffentliche Sicht: keine Objekttabelle, Adresse und Koordinaten gemäss gewählter Genauigkeit
- Private Dokumente: weder Datensatz noch Datei abrufbar; Freigabe nur an Kontakte, widerrufbar; Personendaten nie öffentlich
- Admin-Funktionen für normale Benutzer gesperrt; keine Selbstvergabe von Rollen/Status; Audit-Log unveränderlich
- Konversationen und Leads: Fremde lesen/schreiben nicht; Interessenten sehen keine Leads/Notizen; Blockieren wirkt
- Besichtigungen: Kapazität, parallele Buchungen (zwei Verbindungen gleichzeitig), keine überlappenden Zeitfenster
- Inserate: Pflichtfelder, erlaubte Statusübergänge, Prüfpflicht, gesperrte Inserate
- Suche inkl. Umkreis; Suchabos benachrichtigen pro Inserat genau einmal
- Rate Limiting bei Nachrichten; Bewertungen ohne Datengrundlage enthalten keine Zahl

## End-to-End-Tests

Benötigen eine laufende App mit Supabase-Projekt und Service-Schlüssel (für das Anlegen bestätigter Testkonten):

```bash
E2E_BASE_URL=https://<preview>.vercel.app \
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SECRET_KEY=… \
npm run test:e2e
```

Ohne heruntergeladene Playwright-Browser kann ein installiertes Google Chrome verwendet werden: `PLAYWRIGHT_CHROME=1`.
Die Tests legen eigene Konten mit der Domain `e2e.immovia.test` an und räumen sie am Ende wieder auf.
