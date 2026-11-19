import { useQueries } from "@tanstack/react-query";

import { listingGalleries, type GalleryImage, type SearchRow } from "@/lib/api";

/**
 * Fotos der Inseratkarten (zum Wischen und für die Kennzeichnung eines KI-bearbeiteten Titelbilds):
 * eine Abfrage pro Gruppe von Inseraten, z. B. pro geladener Seite der Suchergebnisse.
 */
export function useListingGalleries(groups: SearchRow[][]): Record<string, GalleryImage[]> {
  return useQueries({
    queries: groups.map((rows) => {
      const ids = rows.filter((row) => row.image_count > 0).map((row) => row.id);
      return { queryKey: ["galerie", ids], queryFn: () => listingGalleries(ids), enabled: ids.length > 0, staleTime: 5 * 60_000 };
    }),
    combine: (results) => Object.assign({}, ...results.map((result) => result.data ?? {})) as Record<string, GalleryImage[]>,
  });
}
