import "server-only";

import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { imageVariantUrl, propertyImageUrl, publicStorageUrl } from "@/lib/storage";
import { searchPublicListings } from "@/lib/listings/queries";
import type { DocumentCategory, FeatureKey, RenovationCategory } from "@/lib/constants";
import { FEATURE_CATALOG, RENOVATION_CATEGORIES } from "@/lib/constants";
import type { ListingCardData } from "@/types/domain";

/** Nur öffentlich bestimmte Spalten des Inserats (keine Moderations- oder Verwaltungsdaten). */
const LISTING_COLUMNS =
  "id, property_id, owner_id, organization_id, slug, offer_type, status, title, short_description, description, location_description, equipment_description, highlights, search_summary, price, price_on_request, additional_costs, parking_price, location_precision, public_address, public_latitude, public_longitude, contact_name, contact_phone, show_contact_phone, dossier_public, property_type, postal_code, municipality, canton, rooms, living_area, usable_area, plot_area, year_built, year_renovated, floor, floors_total, bathrooms, condition, heating_type, energy_label, has_balcony, has_terrace, has_garden, has_garage, has_elevator, has_cellar, has_attic, is_wheelchair_accessible, is_minergie, pets_allowed, parking_spaces, available_from, available_by_arrangement, ownership_type, published_at, first_published_at, updated_at, is_demo";

export interface GalleryImage {
  id: string;
  src: string;
  thumb: string;
  /** Unveränderte Version bei optimierten Bildern */
  original: string | null;
  /** Ausgangsfoto einer KI-Visualisierung (falls öffentlich) */
  sourceImageId: string | null;
  alt: string;
  caption: string | null;
  aiVisualization: boolean;
  enhanced: boolean;
  width: number | null;
  height: number | null;
}

export interface ListingDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  mimeType: string;
  sizeBytes: number;
}

export interface ListingAdvertiser {
  displayName: string;
  avatarUrl: string | null;
  memberSince: string;
  isBusiness: boolean;
  emailVerified: boolean;
  identityVerified: boolean;
}

async function loadListing(slug: string) {
  const supabase = createPublicClient();
  if (!supabase) return { kind: "error" as const };
  const { data: listing, error } = await supabase.from("listings").select(LISTING_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) {
    console.error("[inserat] Laden fehlgeschlagen", error.message);
    return { kind: "error" as const };
  }
  if (!listing) {
    const { data: availability } = await supabase.rpc("get_listing_availability", { p_slug: slug });
    if (availability === "sold" || availability === "rented" || availability === "unavailable") {
      return { kind: "unavailable" as const, status: availability };
    }
    return { kind: "not_found" as const };
  }

  const pid = listing.property_id;
  const [imagesRes, featuresRes, renovationsRes, profileRes, orgRes, documentsRes, verificationsRes, dossierRes] = await Promise.all([
    supabase
      .from("property_images")
      .select("id, display_path, base_path, external_url, caption, is_floor_plan, is_enhanced, is_ai_visualization, source_image_id, width, height")
      .eq("property_id", pid)
      .eq("status", "ready")
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("property_features").select("feature_key").eq("property_id", pid),
    supabase.from("property_renovations").select("id, year, category, description").eq("property_id", pid).order("year", { ascending: false }),
    supabase
      .from("public_profiles")
      .select("display_name, avatar_path, account_type, member_since, email_verified, identity_verified")
      .eq("id", listing.owner_id)
      .maybeSingle(),
    listing.organization_id
      ? supabase.from("organizations").select("name, slug, logo_path").eq("id", listing.organization_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("property_documents")
      .select("id, title, category, mime_type, size_bytes")
      .eq("property_id", pid)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("verifications").select("kind").eq("subject_type", "property").eq("subject_id", pid).eq("status", "verified"),
    listing.dossier_public
      ? supabase.from("generated_dossiers").select("id").eq("property_id", pid).eq("is_public", true).eq("status", "ready").limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const title = listing.title ?? "Inserat";
  const rows = imagesRes.data ?? [];
  const toGallery = (img: (typeof rows)[number], index: number): GalleryImage | null => {
    const src = propertyImageUrl(img, "lg");
    if (!src) return null;
    const original =
      img.is_enhanced && img.base_path && img.base_path !== img.display_path ? imageVariantUrl(img.base_path, "lg") : null;
    return {
      id: img.id,
      src,
      thumb: propertyImageUrl(img, "md") ?? src,
      original,
      sourceImageId: img.is_ai_visualization ? img.source_image_id : null,
      alt: img.caption?.trim() || `${title} – Bild ${index + 1}`,
      caption: img.caption?.trim() || null,
      aiVisualization: img.is_ai_visualization,
      enhanced: img.is_enhanced,
      width: img.width,
      height: img.height,
    };
  };
  const photos = rows.filter((r) => !r.is_floor_plan).map(toGallery).filter((i): i is GalleryImage => i !== null);
  const floorPlans = rows
    .filter((r) => r.is_floor_plan)
    .map((r, i) => {
      const image = toGallery(r, i);
      return image ? { ...image, alt: r.caption?.trim() || `Grundriss ${i + 1}` } : null;
    })
    .filter((i): i is GalleryImage => i !== null);

  const features = (featuresRes.data ?? [])
    .map((f) => f.feature_key)
    .filter((key): key is FeatureKey => key in FEATURE_CATALOG);
  const renovations = (renovationsRes.data ?? []).map((r) => ({
    id: r.id,
    year: r.year,
    category: (r.category in RENOVATION_CATEGORIES ? r.category : "other") as RenovationCategory,
    description: r.description,
  }));
  const profile = profileRes.data;
  const advertiser: ListingAdvertiser | null = profile
    ? {
        displayName: profile.display_name,
        avatarUrl: publicStorageUrl("avatars", profile.avatar_path),
        memberSince: profile.member_since,
        isBusiness: profile.account_type === "business",
        emailVerified: profile.email_verified,
        identityVerified: profile.identity_verified,
      }
    : null;
  const org = orgRes.data;
  const organization = org ? { name: org.name, slug: org.slug, logoUrl: publicStorageUrl("org-logos", org.logo_path) } : null;
  const documents: ListingDocument[] = (documentsRes.data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    mimeType: d.mime_type,
    sizeBytes: d.size_bytes,
  }));
  const verifiedKinds = new Set((verificationsRes.data ?? []).map((v) => v.kind));

  return {
    kind: "listing" as const,
    listing,
    photos,
    floorPlans,
    features,
    renovations,
    advertiser,
    organization,
    documents,
    verifications: {
      ownership: verifiedKinds.has("ownership"),
      documentationComplete: verifiedKinds.has("documentation_complete"),
    },
    hasPublicDossier: Boolean(dossierRes.data),
  };
}

/** Inserat inkl. Bildern, Merkmalen, Inserent und Dokumenten. Pro Request nur einmal geladen (Metadaten + Seite). */
export const getListingPage = cache(loadListing);

export type ListingPageData = Extract<Awaited<ReturnType<typeof loadListing>>, { kind: "listing" }>;
export type PublicListing = ListingPageData["listing"];

/** Drei ähnliche Inserate: gleicher Typ und gleiche Angebotsart, bevorzugt im selben Kanton. */
export async function getSimilarListings(listing: PublicListing, count = 3): Promise<ListingCardData[]> {
  const base = { offer: listing.offer_type, types: [listing.property_type] };
  const nearby = listing.canton
    ? await searchPublicListings({ ...base, canton: listing.canton }, { limit: count + 1, sort: "newest" })
    : { items: [] as ListingCardData[] };
  let items = nearby.items.filter((item) => item.id !== listing.id);
  if (items.length < count) {
    const wider = await searchPublicListings(base, { limit: count + 4, sort: "newest" });
    const seen = new Set(items.map((i) => i.id));
    items = items.concat(wider.items.filter((item) => item.id !== listing.id && !seen.has(item.id)));
  }
  return items.slice(0, count);
}
