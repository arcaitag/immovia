import { PROPERTY_TYPES, type PropertyType } from "@/lib/constants";
import { formatRooms } from "@/lib/format";

/** Anzeigename einer Immobilie im Dashboard (nie öffentlich). */
export function propertyDisplayName(
  property: {
    internal_name: string | null;
    property_type: PropertyType;
    rooms: number | null;
    municipality: string | null;
  },
  listingTitle?: string | null,
): string {
  if (property.internal_name?.trim()) return property.internal_name.trim();
  if (listingTitle?.trim()) return listingTitle.trim();
  const type = PROPERTY_TYPES[property.property_type].label;
  const base =
    property.rooms !== null && property.property_type !== "plot"
      ? `${formatRooms(property.rooms, false)}-Zimmer-${type}`
      : type;
  return property.municipality ? `${base} in ${property.municipality}` : base;
}

export function formatStreetLine(property: { street: string | null; house_number: string | null }): string {
  return [property.street?.trim(), property.house_number?.trim()].filter(Boolean).join(" ");
}

/** «Musterstrasse 12, 3072 Ostermundigen BE» – nur für den Eigentümer. */
export function formatPropertyAddress(property: {
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  municipality: string | null;
  canton: string | null;
}): string {
  const street = formatStreetLine(property);
  const place = [property.postal_code, property.municipality].filter(Boolean).join(" ");
  const placeWithCanton = [place, property.canton].filter(Boolean).join(" ");
  return [street, placeWithCanton].filter(Boolean).join(", ") || "Adresse noch nicht erfasst";
}

/** Öffentliche Adresse gemäss gewählter Genauigkeit (gleiche Regel wie der Datenbank-Trigger). */
export function publicAddressPreview(
  property: { street: string | null; house_number: string | null; postal_code: string | null; municipality: string | null },
  precision: "exact" | "street" | "area",
): string {
  const place = [property.postal_code, property.municipality].filter(Boolean).join(" ");
  if (precision === "exact") return [formatStreetLine(property), place].filter(Boolean).join(", ");
  if (precision === "street") return [property.street?.trim(), place].filter(Boolean).join(", ");
  return place;
}
