import type { LocationPrecision } from "@/lib/constants";

/** Kartenausschnitt [Süd, West, Nord, Ost] in WGS84. */
export type MapBounds = [number, number, number, number];

export interface SwissMapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Kurzer Text im Marker, z. B. der Preis. Ohne Text wird ein Punkt gezeigt. */
  label?: string;
  /** Beschreibung für Screenreader, z. B. «4.5-Zimmer-Wohnung in Bern, CHF 765’000» */
  ariaLabel: string;
  /** Ungefährer Standort: Kreis statt Pin. */
  approximate?: boolean;
  /** Radius des Kreises in Metern (nur bei ungefährem Standort). */
  radiusMeters?: number;
}

/**
 * Darstellungsradius für ungefähre Standorte. Die Datenbank rundet die Koordinaten
 * bei «street» auf 3 und bei «area» auf 2 Nachkommastellen (max. Abweichung ca. 70 m bzw. 700 m);
 * der Kreis schliesst den tatsächlichen Standort sicher ein.
 */
export function approximateRadiusMeters(precision: LocationPrecision | null | undefined): number | null {
  if (precision === "street") return 120;
  if (precision === "area") return 1000;
  return null;
}

/** Grenzen der Schweiz (inkl. Liechtenstein) für die Startansicht. */
export const SWITZERLAND_BOUNDS: MapBounds = [45.818, 5.956, 47.808, 10.492];
