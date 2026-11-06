# Immovia

Schweizer Immobilienplattform für Privatpersonen und Immobilienfirmen: Immobilien kostenlos inserieren und suchen, ehrlich bewerten, Bilder optimieren, professionelle Verkaufsdossiers erstellen und Interessenten, Nachrichten und Besichtigungen an einem Ort verwalten.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage, Realtime) · Vercel · Anthropic · Resend · swisstopo

## Schnellstart (lokal)

```bash
npm install
cp .env.example .env.local   # Supabase-URL und Schlüssel eintragen
npm run dev                  # http://localhost:3000
```

Ohne Supabase-Konfiguration startet die App mit Beispielinhalten auf der Startseite; Anmeldung und Datenfunktionen benötigen ein Supabase-Projekt (siehe `docs/DEPLOYMENT.md`).

## Tests

```bash
npm run typecheck            # TypeScript
npm run lint                 # ESLint
npm test                     # Unit-Tests (Vitest)
npm run db:local -- start    # lokale PostgreSQL (ohne Docker) für DB-Tests
npm run test:db              # RLS- und Ablauftests gegen echte PostgreSQL inkl. aller Migrationen
npm run test:e2e             # End-to-End (Playwright) gegen eine laufende Instanz, siehe docs/TESTS.md
```

## Struktur

```
src/app            Routen: öffentlich (site), Auth, Dashboard, Admin, API
src/components     ui/ = Designsystem; Fachkomponenten je Bereich
src/lib            Supabase, Auth, KI, Bewertung, Bilder, PDF, E-Mail, Jobs, Geodaten, Validierung
src/services       Geschäftslogik (nur Server)
supabase/          Migrationen, Demo-Seed, E-Mail-Vorlagen
tests/             unit, db (RLS/Abläufe), e2e
docs/              Architektur, Regeln, Deployment, Fortschritt
```

## Dokumentation

- `docs/ARCHITEKTUR.md` – Architekturentscheide, Datenmodell, Sicherheitskonzept
- `docs/CONVENTIONS.md` – verbindliche Entwicklungsregeln
- `docs/DEPLOYMENT.md` – Supabase, GitHub, Vercel, Domain, Kosten
- `docs/EMAIL.md` – E-Mail-Versand und Auth-Vorlagen
- `docs/FORTSCHRITT.md` – Umsetzungsstand und offene Punkte
