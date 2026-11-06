import {
  BriefcaseBusiness,
  Building,
  Building2,
  Construction,
  Hotel,
  House,
  Houses,
  LandPlot,
  MapPinHouse,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { PropertyType } from "@/lib/constants";

export const PROPERTY_TYPE_ICONS: Record<PropertyType, LucideIcon> = {
  apartment: Building2,
  single_family_house: House,
  semi_detached_house: Houses,
  terraced_house: Building,
  multi_family_house: Hotel,
  plot: LandPlot,
  commercial: Store,
  office: BriefcaseBusiness,
  new_build_project: Construction,
  other: MapPinHouse,
};

/** Kurze Erklärung je Objekttyp für die Auswahlkarten. */
export const PROPERTY_TYPE_HINTS: Record<PropertyType, string> = {
  apartment: "Eigentums- oder Mietwohnung",
  single_family_house: "Freistehendes Haus",
  semi_detached_house: "Haushälfte mit gemeinsamer Wand",
  terraced_house: "Haus in einer Häuserzeile",
  multi_family_house: "Renditeobjekt mit mehreren Wohnungen",
  plot: "Bauland oder Landparzelle",
  commercial: "Laden, Gewerbe, Gastronomie",
  office: "Büro- oder Praxisfläche",
  new_build_project: "Projekt vor oder im Bau",
  other: "Weitere Immobilienart",
};
