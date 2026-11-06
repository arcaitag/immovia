import type { Database, Tables } from "@/types/database";
import type { OfferType, PropertyType } from "@/lib/constants";

export type SearchListingRow = Database["public"]["Functions"]["search_listings"]["Returns"][number];

/** Daten für eine Inseratekarte (Suche, Startseite, Merkliste). */
export interface ListingCardData {
  id: string;
  slug: string | null;
  title: string;
  offerType: OfferType;
  propertyType: PropertyType;
  status: "published" | "reserved" | string;
  price: number | null;
  priceOnRequest: boolean;
  additionalCosts: number | null;
  rooms: number | null;
  livingArea: number | null;
  plotArea: number | null;
  floor: number | null;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  hasBalcony: boolean;
  hasTerrace: boolean;
  hasGarden: boolean;
  hasElevator: boolean;
  parkingSpaces: number;
  publishedAt: string | null;
  imageUrl: string | null;
  imageCount: number;
  isDemo: boolean;
  /** Statisches Beispiel ohne Datenbankeintrag (nur Startseite bei leerer Datenbank) */
  isExample?: boolean;
}

export function mapSearchRow(row: SearchListingRow, imageUrl: string | null): ListingCardData {
  return {
    id: row.id ?? "",
    slug: row.slug,
    title: row.title ?? "Inserat",
    offerType: (row.offer_type ?? "sale") as OfferType,
    propertyType: (row.property_type ?? "apartment") as PropertyType,
    status: row.status ?? "published",
    price: row.price !== null ? Number(row.price) : null,
    priceOnRequest: Boolean(row.price_on_request),
    additionalCosts: row.additional_costs !== null ? Number(row.additional_costs) : null,
    rooms: row.rooms !== null ? Number(row.rooms) : null,
    livingArea: row.living_area !== null ? Number(row.living_area) : null,
    plotArea: row.plot_area !== null ? Number(row.plot_area) : null,
    floor: row.floor,
    locationLabel: row.public_address ?? [row.postal_code, row.municipality].filter(Boolean).join(" "),
    latitude: row.public_latitude,
    longitude: row.public_longitude,
    hasBalcony: Boolean(row.has_balcony),
    hasTerrace: Boolean(row.has_terrace),
    hasGarden: Boolean(row.has_garden),
    hasElevator: Boolean(row.has_elevator),
    parkingSpaces: Number(row.parking_spaces ?? 0),
    publishedAt: row.published_at,
    imageUrl,
    imageCount: Number(row.image_count ?? 0),
    isDemo: Boolean(row.is_demo),
  };
}

export type Listing = Tables<"listings">;
export type Property = Tables<"properties">;
export type PropertyImage = Tables<"property_images">;
