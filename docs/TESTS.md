# Tests

## Übersicht

| Ebene | Werkzeug | Befehl | Umfang |
|---|---|---|---|
| Typen | TypeScript strict | `npm run typecheck` | gesamter Code |
| Statische Analyse | ESLint (next/core-web-vitals, typescript) | `npm run lint` | gesamter Code |
| Unit | Vitest | `npm test` | Formatierung, Suchkriterien, Validierung, Bewertungslogik, Vorlagen, ICS, PDF-Erzeugung |
| Datenbank | Vitest + echte PostgreSQL | `npm run test:db` | RLS, Spalten- und Funktionsrechte, Trigger, RPCs, Abläufe |
| End-to-End | Playwright | `npm run test:e2e` | Szenarien A–D, Mobile, öffentliche Seiten gegen eine laufende Instanz |

Letzter vollständiger Lauf (7. November 2026, lokal): 302 Unit-Tests, 44 Datenbanktests, 15 E2E-Tests Desktop und 7 E2E-Tests Mobile – alle grün.

## Datenbanktests

Die Tests spielen alle Migrationen in eine frische lokale PostgreSQL-Datenbank ein und führen jede Abfrage mit der Rolle (`anon`, `authenticated`, `service_role`) und den JWT-Claims des jeweiligen Benutzers aus – genau wie die Supabase-API. `tests/db/supabase-bootstrap.sql` bildet die relevanten Teile von Supabase nach (Rollen, `auth.uid()`, `auth.users`, `storage.objects`, `storage.foldername`) – inklusive der **Default-Privileges von Supabase**, die neuen Tabellen und Funktionen zunächst alle Rechte für `anon` und `authenticated` geben. Die Tests prüfen damit, dass die Migrationen diese Rechte ausdrücklich einschränken.

```bash
npm run db:local -- start   # PostgreSQL 16 ohne Docker auf Port 54329
npm run test:db
```

Abgedeckt (Auszug):
- Fremde Immobilien-IDs: kein Lesen, Ändern, Löschen, keine Inserate für fremde Objekte
- Öffentliche Sicht: keine Objekttabelle, Adresse und Koordinaten gemäss gewählter Genauigkeit, keine privaten Kontaktangaben und keine internen Prüfvermerke
- Private Dokumente: weder Datensatz noch Datei abrufbar; Freigabe nur an Kontakte, widerrufbar; Personendaten nie öffentlich
- Admin-Funktionen für normale Benutzer gesperrt; keine Selbstvergabe von Rollen/Status; Audit-Log unveränderlich
- Konversationen und Leads: Fremde lesen/schreiben nicht; Interessenten sehen keine Leads/Notizen; Blockieren wirkt
- Besichtigungen: Kapazität, parallele Buchungen (zwei Verbindungen gleichzeitig), keine überlappenden Zeitfenster
- Inserate: Pflichtfelder, erlaubte Statusübergänge, Prüfpflicht, gesperrte Inserate; Aufrufe ändern `updated_at` nicht
- Suche inkl. Umkreis; Suchabos benachrichtigen pro Inserat genau einmal
- Rate Limiting bei Nachrichten; Bewertungen ohne Datengrundlage enthalten keine Zahl
- Rechte-Invarianten (`tests/db/privileges.test.ts`): `anon` darf genau die freigegebenen Funktionen ausführen und Tabellen nur lesen; `authenticated` erhält keine internen Funktionen und Trigger-Funktionen; jede `SECURITY DEFINER`-Funktion hat einen festen `search_path`; RLS ist auf allen Tabellen aktiv

### Gehostete Datenbank mit dem Repository vergleichen

`scripts/schema-fingerprint.sql` berechnet Prüfsummen über Spalten, Constraints, Indizes, Funktionen, Policies, Trigger, Rechte und Referenzdaten. Im SQL Editor der gehosteten Datenbank und lokal (nach `npm run test:db` in `immovia_test`) ausführen: gleiche Werte bedeuten gleiches Schema.

## End-to-End-Tests

| Datei | Inhalt |
|---|---|
| `scenario-a.spec.ts` | Verkäuferin: Registrierung, Immobilie erfassen, Foto hochladen, Preis und Texte, veröffentlichen, verwalten, Statistik |
| `scenario-b.spec.ts` | Interessent: Suche mit Filtern, Suchauftrag, Merkliste, Anfrage, Besichtigung; Verkäuferin sieht den Lead |
| `scenario-c.spec.ts` | Administration: Übersicht, Benutzer, Inserat sperren und entsperren, Statistiken; gesperrtes Inserat für wiederkehrende Besucher nicht mehr sichtbar (Service Worker) |
| `security.spec.ts` | Szenario D: fremde Immobilien, Dokumente und Nachrichten nicht abrufbar, Admin-Bereich geschützt |
| `mobile.spec.ts` | Startseite und Suche ohne horizontales Scrollen (Pixel 7 und 375 px), Filter-Sheet, mobiles Menü |
| `public.spec.ts` | Startseite, Suche aus dem Hero, Rechtstexte, Login-Umleitung, 404 |

### Voraussetzungen

- Eine laufende App (Produktions-Build) mit einer **Entwicklungsdatenbank**. Nie gegen die Produktion: Die Tests legen Konten an, und die Szenarien B und C verwenden die Demo-Konten aus `supabase/seed.sql` (`demo-verkauf@immovia.test`, `demo-admin@immovia.test`).
- Service-Schlüssel der Entwicklungsdatenbank (`SUPABASE_SECRET_KEY`) zum Anlegen bestätigter Testkonten und zum Aufräumen.

### Lokal mit der Supabase CLI

```bash
supabase start                 # lokale Supabase (Docker), Konfiguration: supabase/config.toml
supabase db reset              # alle Migrationen und Demo-Daten (seed.sql) einspielen
supabase status                # URL, Publishable/Anon Key und Secret/Service Key anzeigen

# .env.local mit den lokalen Werten (NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 usw.)
npm run build && npm start     # Produktions-Build auf http://localhost:3000

E2E_BASE_URL=http://localhost:3000 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SECRET_KEY=<lokaler Service Key> \
npx playwright test --project=desktop
npx playwright test --project=mobile   # gleiche Variablen
```

### Gegen eine Preview-Umgebung

Derzeit verwenden Previews und Produktion dieselbe Supabase-Datenbank. E2E-Tests deshalb **nur lokal** ausführen. Für Tests gegen Previews braucht es zuerst ein zweites Supabase-Projekt (Entwicklung, mit Demo-Daten), dessen Schlüssel in Vercel nur für die Umgebung «Preview» gesetzt sind. Ausserdem sind Previews durch Vercel Authentication geschützt; der Schutz muss für die Tests erreichbar gemacht werden (Deployment Protection).

```bash
E2E_BASE_URL=https://<preview>.vercel.app \
NEXT_PUBLIC_SUPABASE_URL=https://<ref-der-entwicklungsdatenbank>.supabase.co \
SUPABASE_SECRET_KEY=… \
npm run test:e2e
```

Ohne heruntergeladene Playwright-Browser kann ein installiertes Google Chrome verwendet werden: `PLAYWRIGHT_CHROME=1`.
Die Tests legen eigene Konten mit der Domain `e2e.immovia.test` an und räumen sie samt Dateien, Konversationen und Aufrufstatistik am Ende wieder auf.
