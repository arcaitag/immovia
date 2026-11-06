import type { LocationPrecision, OfferType, PropertyType } from "@/lib/constants";

export interface ListingJsonLdInput {
  url: string;
  name: string;
  description?: string | null;
  images: string[];
  datePosted?: string | null;
  dateModified?: string | null;
  offerType: OfferType;
  propertyType: PropertyType;
  status: string;
  price: number | null;
  priceOnRequest: boolean;
  additionalCosts: number | null;
  rooms: number | null;
  livingArea: number | null;
  precision: LocationPrecision;
  publicAddress: string | null;
  postalCode: string | null;
  municipality: string | null;
  canton: string | null;
  latitude: number | null;
  longitude: number | null;
}

const ACCOMMODATION_TYPES: Partial<Record<PropertyType, string>> = {
  apartment: "Apartment",
  single_family_house: "SingleFamilyResidence",
  semi_detached_house: "SingleFamilyResidence",
  terraced_house: "SingleFamilyResidence",
  multi_family_house: "House",
};

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Partial<T>;
}

/**
 * schema.org RealEstateListing für eine Inseratseite.
 * Adresse und Koordinaten nur so genau, wie die Inserentin bzw. der Inserent sie freigegeben hat.
 */
export function buildListingJsonLd(input: ListingJsonLdInput): Record<string, unknown> {
  const streetPart =
    input.precision !== "area" && input.publicAddress && input.publicAddress.includes(",")
      ? input.publicAddress.split(",")[0]?.trim()
      : undefined;

  const address = compact({
    "@type": "PostalAddress",
    streetAddress: streetPart,
    postalCode: input.postalCode ?? undefined,
    addressLocality: input.municipality ?? undefined,
    addressRegion: input.canton ?? undefined,
    addressCountry: "CH",
  });

  const geo =
    input.precision === "exact" && input.latitude !== null && input.longitude !== null
      ? { "@type": "GeoCoordinates", latitude: input.latitude, longitude: input.longitude }
      : undefined;

  const grossPrice =
    input.price === null || input.priceOnRequest
      ? null
      : input.offerType === "rent"
        ? input.price + (input.additionalCosts ?? 0)
        : input.price;

  const offers = compact({
    "@type": "Offer",
    url: input.url,
    priceCurrency: "CHF",
    price: grossPrice ?? undefined,
    availability: input.status === "reserved" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
    businessFunction: input.offerType === "rent" ? "http://purl.org/goodrelations/v1#LeaseOut" : "http://purl.org/goodrelations/v1#Sell",
    priceSpecification:
      grossPrice !== null && input.offerType === "rent"
        ? { "@type": "UnitPriceSpecification", price: grossPrice, priceCurrency: "CHF", unitCode: "MON", unitText: "Monat" }
        : undefined,
  });

  const about = compact({
    "@type": ACCOMMODATION_TYPES[input.propertyType] ?? "Place",
    numberOfRooms: input.rooms ?? undefined,
    floorSize: input.livingArea ? { "@type": "QuantitativeValue", value: input.livingArea, unitCode: "MTK" } : undefined,
    address,
    geo,
  });

  return compact({
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: input.name,
    description: input.description ?? undefined,
    url: input.url,
    image: input.images.length ? input.images : undefined,
    datePosted: input.datePosted ?? undefined,
    dateModified: input.dateModified ?? undefined,
    offers,
    about,
  });
}

/** schema.org BreadcrumbList */
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}
