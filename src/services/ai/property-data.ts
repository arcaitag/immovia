import "server-only";

import type { RenovationFact } from "@/lib/ai/property-facts";
import type { ValuationSubject } from "@/lib/valuation/types";
import type { Tables } from "@/types/database";
import type { DbClient } from "@/services/ai/db";

export interface PropertyContext {
  property: Tables<"properties">;
  featureKeys: string[];
  renovations: RenovationFact[];
}

/**
 * Lädt eine Immobilie mit Merkmalen und Renovationen.
 * Mit dem Benutzer-Client greift RLS; mit dem Service-Role-Client nur nach vorheriger Berechtigungsprüfung.
 */
export async function loadPropertyContext(client: DbClient, propertyId: string): Promise<PropertyContext | null> {
  const { data: property, error } = await client
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Immobilie konnte nicht geladen werden: ${error.message}`);
  if (!property) return null;
  const [featuresRes, renovationsRes] = await Promise.all([
    client.from("property_features").select("feature_key").eq("property_id", propertyId),
    client.from("property_renovations").select("year, category, description").eq("property_id", propertyId).order("year", { ascending: false }),
  ]);
  return {
    property,
    featureKeys: (featuresRes.data ?? []).map((f) => f.feature_key),
    renovations: (renovationsRes.data ?? []).map((r) => ({ year: r.year, category: r.category, description: r.description })),
  };
}

export function toValuationSubject(property: Tables<"properties">): ValuationSubject {
  const num = (value: number | null) => (value === null ? null : Number(value));
  return {
    propertyId: property.id,
    propertyType: property.property_type,
    offerType: property.offer_type,
    livingArea: num(property.living_area),
    usableArea: num(property.usable_area),
    plotArea: num(property.plot_area),
    rooms: num(property.rooms),
    latitude: property.latitude,
    longitude: property.longitude,
    canton: property.canton,
    municipality: property.municipality,
    postalCode: property.postal_code,
  };
}
