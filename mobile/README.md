# Immovia App (Expo)

Native App für iPhone und Android. Sie nutzt dasselbe Backend wie die Website (Supabase mit Row
Level Security) und dieselben Konten.

## Umfang

- Suchen mit Filtern, Suche speichern (Suchaufträge), Inserat ansehen, teilen, melden
- Merkliste, Anfragen und Nachrichten, Besichtigungstermin buchen
- Konto: anmelden, registrieren, Profil, Passwort, Einwilligungen, Benachrichtigungen
- Eigene Immobilien: erfassen, alle wichtigen Objekt- und Inseratsangaben, Fotos (Titelbild,
  Reihenfolge, Grundriss, Bildunterschrift), Status (veröffentlichen, pausieren, reservieren,
  verkauft/vermietet, archivieren), löschen
- Werkzeuge pro Immobilie: Statistik, Interessenten, Besichtigungen, Dokumente, Bewertung,
  KI-Texte, Verkaufsdossier, Bilderstudio (Optimierung, KI-Designvorschläge mit Prüfung)
- KI-Assistent

Auf der Website bleiben: Firmenkonto, Administration, Dokument-Upload, Serien-Zeitfenster,
einzelne Regler im Bilderstudio, Konto löschen und Datenexport.

## Schnittstellen der Website für die App

Wo die Website den Server braucht (Hintergrundaufträge, Bildverarbeitung, KI, PDF), ruft die App
`/api/mobile/*` auf (`images`, `valuation`, `description`, `dossier`, `studio/*`) sowie
`/api/jobs/{id}` und `/api/assistant`. Anmeldung mit `Authorization: Bearer <Supabase-Token>`;
die Routen rufen dieselben Dienste auf wie die Website.

## Auf dem iPhone testen (Expo Go)

Voraussetzungen: Node.js 20 oder neuer auf dem Rechner, die App «Expo Go» aus dem App Store, iPhone
und Rechner im selben WLAN.

```bash
git clone https://github.com/arcaitag/immovia.git
cd immovia/mobile
npm install
npx expo start
```

Den QR-Code im Terminal mit der iPhone-Kamera scannen; die App öffnet sich in Expo Go. Klappt die
Verbindung nicht (z. B. Firmen-WLAN), stattdessen `npx expo start --tunnel` verwenden.

## Konfiguration

Ohne weitere Einstellung spricht die App mit dem produktiven Immovia (`src/lib/config.ts`). URL und
Publishable Key von Supabase sind öffentlich; private Schlüssel gehören nie in die App. Für eine
andere Umgebung eine Datei `.env` anlegen:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_SITE_URL=...
```

## Fotos

Die App lädt das Original in den privaten Speicher und ruft danach `POST /api/mobile/images` der
Website auf (Anmeldung mit dem Supabase-Token). Der Server erzeugt die öffentlichen Varianten ohne
Standortdaten – dieselbe Verarbeitung wie beim Upload im Browser.

## Prüfen

```bash
npx tsc --noEmit
npx expo lint
npx expo export --platform ios   # baut das Bundle wie für ein Gerät
```

## Später: TestFlight und App Store

Braucht ein Apple-Developer-Konto und ein Expo-Konto: `npx eas-cli@latest init`, danach
`eas build --platform ios` und `eas submit`. Bundle-ID in `app.json`: `ch.immovia.app`.
