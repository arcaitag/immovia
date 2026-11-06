# Immovia – Entwicklungsregeln (verbindlich)

Diese Regeln gelten für alle, die am Code arbeiten. Architektur: `docs/ARCHITEKTUR.md`.
Datenbankschema: `supabase/migrations/*.sql` (Quelle der Wahrheit), TypeScript-Typen: `src/types/database.ts`.

## 1. Harte Regeln

1. **Sprache:** UI-Texte auf Deutsch, Schweizer Rechtschreibung. **Nie «ß»** (immer «ss»: «gross», «Strasse», «schliessen»). Anrede «Sie». Kurze, klare Sätze, keine Marketing-Floskeln.
2. **Keine Fake-Funktionen.** Keine erfundenen Zahlen, Statistiken, KI-Ergebnisse oder Downloads. Jeder Button ist mit echter Logik verbunden. Ist ein Dienst nicht konfiguriert (z. B. kein `ANTHROPIC_API_KEY`), zeigt die UI einen klaren Zustand «Nicht verfügbar» mit Erklärung.
3. **Nicht ausführen:** `npm install`, `next build`, `next dev`, `git …`, `scripts/apply-migrations-local.ts` ohne eigene DB (siehe 8). Erlaubt: `npx tsc --noEmit`, `npx eslint <dateien>`, `npx vitest run --project unit <pfad>`.
4. **Geteilte Dateien nicht ändern** (Liste in Abschnitt 9). Braucht ihr dort etwas, beschreibt es im Abschlussbericht.
5. **Formatierung** nur über `src/lib/format.ts` (CHF `formatChf`, `formatArea`, `formatRooms`, Datum/Zeit immer Europe/Zurich, `zurichLocalToUtc` für Formulareingaben).
6. **Labels für Enums** nur aus `src/lib/constants.ts` (z. B. `LISTING_STATUS`, `LEAD_STATUS`, `PROPERTY_TYPES`, `CONDITIONS`).
7. **TypeScript strict**, kein `any`, keine `@ts-ignore`. Supabase-Abfragen sind über `Database` typisiert.

## 2. Server und Client

- Server Components lesen Daten. Client Components (`"use client"`) nur für Interaktivität.
- Client Components dürfen nichts importieren, das `import "server-only"` enthält (z. B. `lib/supabase/server`, `lib/supabase/admin`, `lib/auth/session`, `lib/images/processing`, `lib/jobs/queue`).
- Seiten mit Benutzerdaten liegen unter `/dashboard` bzw. `/admin`; das Layout prüft die Anmeldung. **Jede Seite, Action und Route prüft trotzdem selbst** (Besitz über RLS-Abfrage, `notFound()` wenn kein Treffer).

## 3. Datenzugriff

```ts
import { createClient } from "@/lib/supabase/server";      // Benutzer-Session, RLS greift (Standard!)
import { createPublicClient } from "@/lib/supabase/public"; // anonym, ohne Cookies (öffentliche/ISR-Seiten)
import { createAdminClient } from "@/lib/supabase/admin";   // Service Role, umgeht RLS – nur wo erlaubt
import { createClient } from "@/lib/supabase/client";      // Browser (Client Components)
```

- **Service Role nur für:** Bewertungen, KI-Jobs und -Verbrauch, Aufrufstatistik, E-Mail-Outbox, Cron, Kontolöschung, virtuelle Möblierung (`is_ai_visualization`). Vorher immer mit dem Benutzer-Client prüfen, dass der Benutzer berechtigt ist.
- Embedded Selects über Fremdschlüssel: `supabase.from("listings").select("id, title, property_images:properties(property_images(*))")` – im Zweifel zwei einfache Abfragen statt komplizierter Embeds.
- Kritische Abläufe immer über die vorhandenen Datenbankfunktionen (RPC), nie selbst nachbauen:
  `search_listings`, `create_inquiry`, `get_viewing_slots`, `book_viewing`, `update_viewing_status`, `move_viewing`, `cancel_viewing_slot`, `get_my_conversations`, `get_unread_counts`, `get_listing_statistics`, `get_owner_overview`, `grant_document_access`, `revoke_document_access`, `create_organization`, `invite_organization_member`, `accept_organization_invitation`, `submit_contact_request`, `export_my_data`, `delete_my_account`, `get_listing_availability`, `admin_*`.
- Inserate: Statuswechsel prüft der Trigger `listings_before_write` (erlaubte Übergänge, Pflichtfelder, Prüfpflicht, Sperre). Fehlercodes kommen als Meldung zurück und werden mit `fromDbError()` übersetzt. Die Spalten mit Objektdaten in `listings` (rooms, living_area, …) werden automatisch aus `properties` synchronisiert – **nie direkt schreiben**, sondern `properties` ändern.
- Öffentliche Standortdaten: nur `listings.public_address`, `public_latitude`, `public_longitude` verwenden, **nie** `properties.street/latitude` auf öffentlichen Seiten.

## 4. Server Actions

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertUser } from "@/lib/auth/session";
import { fromDbError, runAction, validationError, type ActionResult } from "@/lib/errors";

export async function saveSomething(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await assertUser();
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
    const supabase = await createClient();
    const { data, error } = await supabase.from("…").update(…).eq("id", parsed.data.id).select("id").single();
    if (error) throw fromDbError(error);
    revalidatePath("/dashboard/…");
    return { id: data.id };
  }, "Gespeichert.");
}
```

- Jede Eingabe mit Zod validieren (Schemas in `src/lib/validation/*.ts`, auch im Client für React Hook Form wiederverwenden).
- Actions werfen nie zum Client: `runAction`/`fail` liefern `ActionResult`. Im Client: `if (!res.ok) toast.error(res.error)`.
- Nach Änderungen `revalidatePath(...)` für betroffene Seiten (auch öffentliche Inseratseite `/immobilien/${slug}`).
- Hintergrundarbeit: `import { after } from "next/server"` – z. B. `after(() => runJobNow(job.id))`, `after(() => flushEmailOutbox())`.

## 5. Design

- **Nur vorhandene Tokens/Komponenten** (`src/components/ui/*`): Button, Input/Textarea/InputGroup, Field/ChoiceRow, Select/NativeSelect, Checkbox, Switch, RadioGroup/RadioCard, Dialog, Sheet, AlertDialog, DropdownMenu, Popover, Tooltip, Tabs, Accordion, Badge, StatusBadge, Card, Table, Alert, Progress, Slider, Avatar, Skeleton, Spinner, EmptyState, PageHeader, StatCard, toast (sonner).
- Farben nur über Klassen der Tokens: `bg-primary`, `text-forest`, `bg-mint-50/100/200`, `text-brand`, `bg-surface`, `border-border`, `text-muted-foreground` usw. Keine neuen Hex-Farben, keine Verläufe ausser vorhandenen.
- Karten: `rounded-2xl border border-border bg-card shadow-card`. Abstände grosszügig (`gap-6`, `p-6`). Titel `font-display font-extrabold tracking-tight`.
- Dashboard-Seiten beginnen mit `<PageHeader title=… description=… actions=… />`, leere Zustände mit `<EmptyState …/>`, Ladezustände mit `loading.tsx` + `Skeleton`.
- Mobile first: alles muss bei 375 px funktionieren; Touch-Ziele mind. 44 px; Tabellen auf Mobile als Karten.
- Barrierefreiheit: jedes Feld mit Label (`Field`), Icons dekorativ `aria-hidden`, Icon-Buttons mit `aria-label`, Fokus sichtbar, Dialoge mit Titel.
- Bilder: `next/image` (globaler Loader ist konfiguriert). URLs über `propertyImageUrl(image, "sm"|"md"|"lg")` bzw. `publicStorageUrl`.
- Animationen dezent (`animate-fade-up`, `motion/react` sparsam).

## 6. URL-Verträge zwischen den Bereichen

| URL | Zweck | Verantwortlich |
|---|---|---|
| `/immobilien`, `/kaufen`, `/mieten` | Suche (Query-Parameter siehe `src/lib/search/criteria.ts`) | Öffentlich |
| `/immobilien/[slug]` | Inseratseite | Öffentlich |
| `/firmen/[slug]` | Öffentliches Firmenprofil | Öffentlich |
| `/dashboard/immobilien/[id]` | Objekt-Übersicht mit Schritten | Verkäufer |
| `/dashboard/immobilien/[id]/bearbeiten` | Schritt 1: Erfassen | Verkäufer |
| `/dashboard/immobilien/[id]/bewertung` | Schritt 2: Bewertung | KI |
| `/dashboard/immobilien/[id]/bilder` | Schritt 3: Bilder | Verkäufer |
| `/dashboard/immobilien/[id]/beschreibung` | Schritt 4: KI-Texte | KI |
| `/dashboard/immobilien/[id]/dossier` | Schritt 5: Dossier | KI |
| `/dashboard/immobilien/[id]/inserat` | Schritt 6: Preis, Texte, Kontakt, Vorschau | Verkäufer |
| `/dashboard/immobilien/[id]/veroeffentlichen` | Schritt 7: Prüfen & veröffentlichen | Verkäufer |
| `/dashboard/immobilien/[id]/verwaltung` | Schritt 8: Verkaufsverwaltung | Verkäufer |
| `/dashboard/bilderstudio/[imageId]` | Bild optimieren (Vorher/Nachher) | KI |
| `/dashboard/nachrichten/[conversationId]` | Chat | Kommunikation |
| `/dashboard/interessenten?inserat=[listingId]` | Interessenten eines Inserats | Kommunikation |
| `/dashboard/besichtigungen?inserat=[listingId]` | Zeitfenster/Termine eines Inserats | Kommunikation |
| `/dashboard/dokumente?immobilie=[propertyId]` | Dokumente eines Objekts | Kommunikation |
| `/dashboard/statistiken?inserat=[listingId]` | Statistik | Verkäufer |
| `/api/listings/[listingId]/dossier` | Öffentliches Dossier herunterladen (302 auf signierte URL oder 404) | KI |
| `/api/listings/[listingId]/view` (POST) | Aufruf zählen | Öffentlich |
| `/api/documents/[documentId]/download` | Dokument herunterladen (signierte URL) | Kommunikation |
| `/api/viewings/[appointmentId]/ics` | Kalenderdatei | Kommunikation |
| `/api/jobs/[jobId]` | Job-Status (eigene Jobs) | KI |
| `/api/orte?q=&art=ort|adresse` | Orts-/Adresssuche (vorhanden) | – |
| `/einladung/[token]` | Firmeneinladung annehmen | Konto/Admin |

## 7. Storage

Buckets und Pfade (erster Ordner bestimmt die Berechtigung, siehe Migration 8):
- `property-originals/{propertyId}/{imageId}.{ext}` (privat, Original-Upload)
- `property-images/{propertyId}/{imageId}/{version}-{sm|md|lg}.webp` (öffentlich per URL). In der Tabelle steht der Präfix ohne Grösse in `base_path`/`display_path`, z. B. `{propertyId}/{imageId}/base`.
- `documents/{propertyId}/{documentId}.{ext}`, `dossiers/{propertyId}/{dossierId}.pdf`, `avatars/{userId}/…`, `org-logos/{orgId}/…`, `message-attachments/{conversationId}/…`
- Uploads > 4 MB nie durch eine Server Action schicken: Browser lädt direkt in Storage (Policies erlauben das), danach verarbeitet eine Action die Datei.
- Bildverarbeitung: `src/lib/images/processing.ts` (`processImage`, `cropImage`, `suggestAdjustments`, `variantPaths`).

## 8. Datenbankänderungen

- Bestehende Migrationen **nie** ändern. Neue Migration mit eurem Präfix anlegen (Agent A `20261106200000_a_…`, B `…210000_b_…`, C `…220000_c_…`, D `…230000_d_…`, E `…240000_e_…`). Nur wenn wirklich nötig.
- Prüfen mit eigener Datenbank: `TEST_DATABASE_NAME=immovia_x npx tsx scripts/apply-migrations-local.ts && TEST_DATABASE_NAME=immovia_x npx tsx scripts/generate-db-types.ts` (x = euer Buchstabe). Die lokale PostgreSQL läuft auf Port 54329 (`npm run db:local -- start`).

## 9. Geteilte Dateien (nur lesen)

`supabase/migrations/2026110610*`, `src/types/database.ts` (ausser Regenerierung gemäss 8), `src/lib/{env,errors,format,constants,utils,storage,marketing-images}.ts`, `src/lib/supabase/*`, `src/lib/auth/*`, `src/lib/search/criteria.ts`, `src/lib/images/{processing,loader}.ts`, `src/lib/jobs/{queue,types}.ts`, `src/lib/geo/*`, `src/lib/listings/*`, `src/components/ui/*`, `src/components/layout/*`, `src/components/dashboard/{nav-config.ts,dashboard-shell.tsx}`, `src/components/property/*`, `src/components/search/location-autocomplete.tsx`, `src/components/home/*`, `src/hooks/*`, `src/app/layout.tsx`, `src/app/(site)/{layout,page}.tsx`, `src/app/(auth)/**`, `src/app/auth/**`, `src/app/dashboard/layout.tsx`, `src/app/globals.css`, `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`.

Ausnahmen mit klarer Zuständigkeit: `src/lib/jobs/handlers.ts` (KI-Agent trägt Handler ein), `src/lib/email/outbox.ts` und `src/lib/jobs/scheduled.ts` (Kommunikations-Agent ersetzt die Platzhalter, Exporte bleiben gleich), `src/components/notifications/notification-bell.tsx` (Kommunikations-Agent darf verbessern, Props bleiben gleich).

## 10. Tests

- Reine Logik (Validierung, Berechnungen, Parser, Vorlagen) mit Vitest unter `tests/unit/<bereich>/*.test.ts`.
- Datenbank-/RLS-Tests (`tests/db`) schreibt die Integration zentral.

## 11. Abschlussbericht (am Ende jeder Aufgabe)

Kurz und konkret: erstellte Routen und Dateien, was vollständig funktioniert, was bewusst nicht (und warum), benötigte Änderungen an geteilten Dateien, offene Punkte, Ergebnis von `npx tsc --noEmit` (für eure Dateien fehlerfrei).
