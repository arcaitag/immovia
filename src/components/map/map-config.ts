/**
 * Kartenkonfiguration: offizielle swisstopo-Vektorkarte «Light Base Map» (geo.admin.ch).
 *
 * - Stil-URL gemäss https://docs.geo.admin.ch/visualize-data/vector-tiles.html.
 *   Der früher verwendete Stil «ch.swisstopo.leichte-basiskarte.vt» wurde von geo.admin.ch
 *   im Januar 2025 abgeschaltet; Nachfolger ist «ch.swisstopo.lightbasemap.vt».
 * - Kein API-Schlüssel nötig. Nutzung gemäss den Allgemeinen Nutzungsbedingungen der BGDI
 *   (Fair Use) und den OGD-Bedingungen von swisstopo; Quellenangabe ist Pflicht.
 *   Die im Stil hinterlegten Quellenangaben der Datenquellen zeigt MapLibre zusätzlich an.
 */
export const SWISS_MAP_STYLE_URL = "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json";

export const SWISSTOPO_ATTRIBUTION =
  '<a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener noreferrer">© swisstopo</a>';

/** Deutsche Texte für die MapLibre-Bedienelemente. */
export const MAP_LOCALE_DE: Record<string, string> = {
  "AttributionControl.ToggleAttribution": "Quellenangaben ein- oder ausblenden",
  "AttributionControl.MapFeedback": "Rückmeldung zur Karte",
  "FullscreenControl.Enter": "Vollbild",
  "FullscreenControl.Exit": "Vollbild beenden",
  "GeolocateControl.FindMyLocation": "Meinen Standort anzeigen",
  "GeolocateControl.LocationNotAvailable": "Standort nicht verfügbar",
  "LogoControl.Title": "MapLibre",
  "Map.Title": "Karte",
  "Marker.Title": "Kartenmarkierung",
  "NavigationControl.ResetBearing": "Nach Norden ausrichten",
  "NavigationControl.ZoomIn": "Vergrössern",
  "NavigationControl.ZoomOut": "Verkleinern",
  "Popup.Close": "Schliessen",
  "ScaleControl.Feet": "ft",
  "ScaleControl.Meters": "m",
  "ScaleControl.Kilometers": "km",
  "ScaleControl.Miles": "mi",
  "ScaleControl.NauticalMiles": "sm",
  "GlobeControl.Enable": "Globus einschalten",
  "GlobeControl.Disable": "Globus ausschalten",
  "TerrainControl.Enable": "Gelände einschalten",
  "TerrainControl.Disable": "Gelände ausschalten",
  "CooperativeGesturesHandler.WindowsHelpText": "Halten Sie Ctrl gedrückt und scrollen Sie, um die Karte zu zoomen.",
  "CooperativeGesturesHandler.MacHelpText": "Halten Sie ⌘ gedrückt und scrollen Sie, um die Karte zu zoomen.",
  "CooperativeGesturesHandler.MobileHelpText": "Verschieben Sie die Karte mit zwei Fingern.",
};

/** Maximaler Kartenbereich (Schweiz mit Grenzgebiet). */
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [4.8, 45.2],
  [11.6, 48.4],
];
