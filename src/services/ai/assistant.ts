import "server-only";

import { DOCUMENT_CATEGORIES, LISTING_STATUS, PROPERTY_TYPES, type DocumentCategory } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth/session";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { priceDisplay } from "@/lib/listings/price";
import { buildPropertyFacts } from "@/lib/ai/property-facts";
import { computeMissingItems, type AssistantPropertyContext } from "@/lib/ai/prompts/assistant";
import { VALUATION_STATUS_LABELS } from "@/lib/valuation/labels";
import { canManageProperty, managedPropertiesFilter } from "@/services/ai/access";
import { loadPropertyContext } from "@/services/ai/property-data";

/**
 * Datenzugriff des Assistenten – ausschliesslich mit dem Benutzer-Client (RLS) und nur
 * für Objekte, die der Benutzer verwalten darf.
 */

export interface AssistantPropertyOption {
  id: string;
  label: string;
}

export async function listAssistantProperties(supabase: ServerSupabaseClient, user: SessionUser): Promise<AssistantPropertyOption[]> {
  const { data } = await supabase
    .from("properties")
    .select("id, internal_name, property_type, municipality, updated_at")
    .is("deleted_at", null)
    .or(managedPropertiesFilter(user))
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((p) => ({
    id: p.id,
    label: p.internal_name?.trim() || [PROPERTY_TYPES[p.property_type].label, p.municipality].filter(Boolean).join(" in "),
  }));
}

export async function loadAssistantContext(
  supabase: ServerSupabaseClient,
  user: SessionUser,
  propertyId: string,
): Promise<AssistantPropertyContext | null> {
  const context = await loadPropertyContext(supabase, propertyId);
  if (!context || !canManageProperty(user, context.property)) return null;
  const p = context.property;

  const [listingRes, imagesRes, documentsRes, valuationRes, dossiersRes] = await Promise.all([
    supabase
      .from("listings")
      .select("status, title, description, location_description, price, price_on_request, additional_costs, texts_confirmed_at, contact_name, contact_email, contact_phone, published_at")
      .eq("property_id", propertyId)
      .is("deleted_at", null)
      .neq("status", "archived")
      .maybeSingle(),
    supabase.from("property_images").select("is_floor_plan").eq("property_id", propertyId).eq("status", "ready"),
    supabase.from("property_documents").select("category").eq("property_id", propertyId).is("deleted_at", null),
    supabase.from("property_valuations").select("status, created_at").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("generated_dossiers").select("id", { count: "exact", head: true }).eq("property_id", propertyId).eq("status", "ready"),
  ]);

  const listing = listingRes.data;
  const images = imagesRes.data ?? [];
  const floorPlanCount = images.filter((i) => i.is_floor_plan).length;
  const hasContact = Boolean(listing && (listing.contact_name || listing.contact_email || listing.contact_phone));
  const price = listing
    ? priceDisplay({
        offerType: p.offer_type,
        price: listing.price !== null ? Number(listing.price) : null,
        priceOnRequest: listing.price_on_request,
        additionalCosts: listing.additional_costs !== null ? Number(listing.additional_costs) : null,
      })
    : null;

  return {
    label: [PROPERTY_TYPES[p.property_type].label, p.municipality].filter(Boolean).join(" in "),
    facts: buildPropertyFacts({ property: p, featureKeys: context.featureKeys, renovations: context.renovations }),
    listing: listing
      ? {
          statusLabel: LISTING_STATUS[listing.status].label,
          title: listing.title,
          description: listing.description,
          hasLocationText: Boolean(listing.location_description?.trim()),
          priceLabel: listing.price !== null || listing.price_on_request ? `${price?.label}: ${price?.value}` : null,
          textsConfirmed: Boolean(listing.texts_confirmed_at),
          hasContact,
          publishedAt: listing.published_at,
        }
      : null,
    imageCount: images.length,
    floorPlanCount,
    documentCategories: [...new Set((documentsRes.data ?? []).map((d) => DOCUMENT_CATEGORIES[d.category as DocumentCategory] ?? d.category))],
    latestValuation: valuationRes.data
      ? { statusLabel: VALUATION_STATUS_LABELS[valuationRes.data.status].label, date: valuationRes.data.created_at }
      : null,
    dossierVersions: dossiersRes.count ?? 0,
    missing: computeMissingItems({
      property: p,
      listing: listing
        ? {
            title: listing.title,
            description: listing.description,
            price: listing.price !== null ? Number(listing.price) : null,
            priceOnRequest: listing.price_on_request,
            textsConfirmed: Boolean(listing.texts_confirmed_at),
            hasContact,
          }
        : null,
      imageCount: images.length,
      floorPlanCount,
    }),
  };
}
