/** Distanz zweier Koordinaten in Kilometern (Haversine). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Rechteck um einen Punkt (Vorfilter für die Datenbankabfrage). */
export function boundingBox(lat: number, lon: number, radiusKm: number): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - latDelta, maxLat: lat + latDelta, minLon: lon - lonDelta, maxLon: lon + lonDelta };
}
