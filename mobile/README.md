# Immovia App (Expo)

Native App für iPhone und Android. Sie nutzt dasselbe Backend wie die Website (Supabase mit Row
Level Security) und dieselben Konten.

## Umfang der ersten Version

- Suchen mit Filtern, Inserat ansehen, teilen
- Merkliste
- Anmelden, Konto erstellen
- Anbieter kontaktieren, Nachrichten
- Eigene Immobilien: erfassen, Fotos aufnehmen oder wählen, Preis und Texte, veröffentlichen, pausieren

Bewertung, Verkaufsdossier, KI-Texte, Bilderstudio, Besichtigungen und Firmenkonto bleiben vorerst
auf der Website.

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
