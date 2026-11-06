import { PROPERTY_TYPES } from "@/lib/constants";
import { AREA_LABELS, VALUATION_GROUPS, valuationGroupFor } from "@/lib/valuation/config";
import { areaOf } from "@/lib/valuation/comparables";
import type { ValuationSubject } from "@/lib/valuation/types";

export interface PrerequisiteItem {
  key: "type" | "area" | "location";
  label: string;
  ok: boolean;
  /** Ohne diese Angabe kann keine Bewertung gestartet werden */
  blocking: boolean;
  hint: string;
}

/** Voraussetzungen für eine Vergleichsbewertung (Objektart, Fläche, Standort). */
export function checkValuationPrerequisites(subject: ValuationSubject): { ready: boolean; items: PrerequisiteItem[] } {
  const group = valuationGroupFor(subject.propertyType);
  const basis = group ? VALUATION_GROUPS[group].area : "living";
  const hasCoords = subject.latitude !== null && subject.longitude !== null;
  const items: PrerequisiteItem[] = [
    {
      key: "type",
      label: `Objektart: ${PROPERTY_TYPES[subject.propertyType].label}`,
      ok: group !== null,
      blocking: true,
      hint: group ? `Verglichen wird mit: ${VALUATION_GROUPS[group].label}.` : "Für diese Objektart ist kein Vergleich pro m² möglich.",
    },
    {
      key: "area",
      label: AREA_LABELS[basis],
      ok: areaOf(subject, basis) !== null,
      blocking: true,
      hint: areaOf(subject, basis) !== null ? "Erfasst." : `Bitte erfassen Sie die ${AREA_LABELS[basis]}.`,
    },
    {
      key: "location",
      label: "Standort (Koordinaten)",
      ok: hasCoords,
      blocking: !hasCoords && !subject.canton,
      hint: hasCoords
        ? "Vergleich im Umkreis möglich."
        : subject.canton
          ? "Ohne Koordinaten wird nur mit dem ganzen Kanton verglichen (eingeschränkte Aussagekraft)."
          : "Bitte erfassen Sie die Adresse der Immobilie.",
    },
  ];
  return { ready: items.every((item) => item.ok || !item.blocking), items };
}
