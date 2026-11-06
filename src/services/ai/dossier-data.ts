import "server-only";

import {
  CONDITIONS,
  HEATING_TYPES,
  OWNERSHIP_TYPES,
  PROPERTY_TYPES,
  RENOVATION_CATEGORIES,
  cantonName,
} from "@/lib/constants";
import { publicEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { formatArea, formatChf, formatDate, formatFloor, formatRooms } from "@/lib/format";
import { priceDisplay } from "@/lib/listings/price";
import { equipmentLabels, locationLabels, parkingSummary } from "@/lib/ai/property-facts";
import { DOSSIER_SECTION_KEYS, isSectionEnabled, type DossierOptions } from "@/lib/pdf/dossier/options";
import type { DossierContent, PdfImage } from "@/lib/pdf/dossier/types";
import { fetchBinary, mapSettledLimited, qrCodePng, toPdfImage } from "@/lib/pdf/images";
import { themeFromConfig } from "@/lib/pdf/theme";
import type { Tables } from "@/types/database";
import type { DbClient } from "@/services/ai/db";
import { loadPropertyContext } from "@/services/ai/property-data";

/**
 * Baut den Inhalt eines Verkaufsdossiers aus den gespeicherten Daten.
 * Nur vorhandene Angaben werden übernommen – es wird nichts ergänzt oder erfunden.
 * Öffentliche Adresse gemäss gewählter Standortgenauigkeit des Inserats.
 */

export const LISTING_DOSSIER_COLUMNS =
  "id, slug, status, title, short_description, description, location_description, equipment_description, highlights, price, price_on_request, additional_costs, public_address, contact_name, show_contact_phone, dossier_public, moderation_status";

type ListingForDossier = Pick<
  Tables<"listings">,
  | "id"
  | "slug"
  | "status"
  | "title"
  | "short_description"
  | "description"
  | "location_description"
  | "equipment_description"
  | "highlights"
  | "price"
  | "price_on_request"
  | "additional_costs"
  | "public_address"
  | "contact_name"
  | "show_contact_phone"
  | "dossier_public"
  | "moderation_status"
>;

export interface DossierImageRow {
  id: string;
  display_path: string | null;
  base_path: string | null;
  external_url: string | null;
  is_cover: boolean;
  caption: string | null;
  is_floor_plan: boolean;
  is_ai_visualization: boolean;
  sort_order: number;
}

export async function loadOpenListing(client: DbClient, propertyId: string): Promise<ListingForDossier | null> {
  const { data } = await client
    .from("listings")
    .select(LISTING_DOSSIER_COLUMNS)
    .eq("property_id", propertyId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .maybeSingle();
  return data ?? null;
}

/**
 * Private Kontaktangaben (listing_contacts): lesbar für Verwaltende (RLS) und per Service Role.
 * Fehlt die Zeile oder ist sie nicht lesbar, enthält das Dossier nur den Namen.
 */
export async function loadDossierContact(
  client: DbClient,
  listingId: string,
): Promise<{ contact_email: string | null; contact_phone: string | null }> {
  const { data, error } = await client.from("listing_contacts").select("contact_email, contact_phone").eq("listing_id", listingId).maybeSingle();
  if (error) console.warn("[dossier] Kontaktangaben nicht lesbar", error.message);
  return { contact_email: data?.contact_email ?? null, contact_phone: data?.contact_phone ?? null };
}

export async function loadDossierImages(client: DbClient, propertyId: string): Promise<DossierImageRow[]> {
  const { data } = await client
    .from("property_images")
    .select("id, display_path, base_path, external_url, is_cover, caption, is_floor_plan, is_ai_visualization, sort_order")
    .eq("property_id", propertyId)
    .eq("status", "ready")
    .order("sort_order", { ascending: true });
  return data ?? [];
}

/** Bildreihenfolge gemäss Optionen; ausgeschlossene Bilder entfallen. */
export function orderDossierImages(images: DossierImageRow[], options: Pick<DossierOptions, "imageOrder" | "excludedImageIds">): DossierImageRow[] {
  const excluded = new Set(options.excludedImageIds);
  const position = new Map(options.imageOrder.map((id, index) => [id, index]));
  return images
    .filter((img) => !excluded.has(img.id))
    .sort((a, b) => {
      const pa = position.get(a.id);
      const pb = position.get(b.id);
      if (pa !== undefined && pb !== undefined) return pa - pb;
      if (pa !== undefined) return -1;
      if (pb !== undefined) return 1;
      return a.sort_order - b.sort_order;
    });
}

async function loadImageBuffer(client: DbClient, image: DossierImageRow, size: "md" | "lg"): Promise<Buffer> {
  if (image.external_url) {
    const width = size === "lg" ? 1800 : 1200;
    return fetchBinary(`${image.external_url.split("?")[0]}?w=${width}&q=80&fm=jpg&fit=max`);
  }
  const prefix = image.display_path ?? image.base_path;
  if (!prefix) throw new Error("Kein Bildpfad");
  const { data, error } = await client.storage.from("property-images").download(`${prefix}-${size}.webp`);
  if (error || !data) throw new Error(`Bild nicht lesbar (${error?.message ?? "leer"})`);
  return Buffer.from(await data.arrayBuffer());
}

function keyFacts(property: Tables<"properties">): DossierContent["keyFacts"] {
  const facts: DossierContent["keyFacts"] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && value !== "–") facts.push({ label, value });
  };
  const isPlot = property.property_type === "plot";
  add("Objektart", PROPERTY_TYPES[property.property_type].label);
  if (!isPlot) add("Zimmer", property.rooms !== null ? formatRooms(property.rooms, false) : null);
  add("Wohnfläche", property.living_area !== null ? formatArea(property.living_area) : null);
  add("Nutzfläche", property.usable_area !== null ? formatArea(property.usable_area) : null);
  add("Grundstücksfläche", property.plot_area !== null ? formatArea(property.plot_area) : null);
  add("Baujahr", property.year_built !== null ? String(property.year_built) : null);
  add("Renovation", property.year_renovated !== null ? String(property.year_renovated) : null);
  if (property.property_type === "apartment") add("Stockwerk", property.floor !== null ? formatFloor(property.floor) : null);
  add("Badezimmer", property.bathrooms !== null ? String(property.bathrooms) : null);
  add("Zustand", property.condition ? CONDITIONS[property.condition] : null);
  add("Heizung", property.heating_type ? HEATING_TYPES[property.heating_type] : null);
  add("Energieetikette", property.energy_label);
  add("Parkplätze", parkingSummary(property));
  add("Eigentumsform", property.ownership_type ? OWNERSHIP_TYPES[property.ownership_type] : null);
  add("Nebenkosten", property.service_charges !== null ? `${formatChf(property.service_charges)} / Monat` : null);
  add(
    "Verfügbar",
    property.available_by_arrangement ? "nach Vereinbarung" : property.available_from ? `ab ${formatDate(property.available_from)}` : null,
  );
  return facts;
}

export interface BuildDossierInput {
  client: DbClient;
  propertyId: string;
  options: DossierOptions;
  isPreview: boolean;
  now?: Date;
}

export interface BuiltDossier {
  content: DossierContent;
  listingId: string | null;
  property: Tables<"properties">;
  skippedImages: number;
}

export async function buildDossierContent(input: BuildDossierInput): Promise<BuiltDossier> {
  const { client, propertyId, options, isPreview } = input;
  const context = await loadPropertyContext(client, propertyId);
  if (!context) throw new AppError("not_found", "Die Immobilie wurde nicht gefunden.");
  const property = context.property;

  const [listing, images, documentsRes, templateRes] = await Promise.all([
    loadOpenListing(client, propertyId),
    loadDossierImages(client, propertyId),
    client
      .from("property_documents")
      .select("title, category")
      .eq("property_id", propertyId)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    client.from("dossier_templates").select("config").eq("id", options.templateId).maybeSingle(),
  ]);

  const ordered = orderDossierImages(images, options);
  const plans = ordered.filter((img) => img.is_floor_plan).slice(0, 6);
  const photos = ordered.filter((img) => !img.is_floor_plan);
  const coverRow = photos.find((img) => img.is_cover) ?? photos[0] ?? null;
  const galleryLimit = isPreview ? 6 : 12;
  const galleryRows = isSectionEnabled(options, "gallery") ? photos.filter((img) => img !== coverRow).slice(0, galleryLimit) : [];
  const planRows = isSectionEnabled(options, "floorPlans") ? plans : [];

  const quality = isPreview ? 70 : 82;
  type Job = { row: DossierImageRow; kind: "cover" | "gallery" | "plan" };
  const jobs: Job[] = [
    ...(coverRow ? [{ row: coverRow, kind: "cover" as const }] : []),
    ...galleryRows.map((row) => ({ row, kind: "gallery" as const })),
    ...planRows.map((row) => ({ row, kind: "plan" as const })),
  ];
  const loaded = await mapSettledLimited(jobs, 4, async (job) => {
    const size = job.kind === "gallery" && isPreview ? "md" : "lg";
    const buffer = await loadImageBuffer(client, job.row, size);
    const maxWidth = job.kind === "cover" ? (isPreview ? 1400 : 2000) : job.kind === "plan" ? 1800 : isPreview ? 900 : 1400;
    return toPdfImage(buffer, {
      maxWidth,
      quality: job.kind === "plan" ? Math.max(quality, 85) : quality,
      caption: job.row.caption,
      isAiVisualization: job.row.is_ai_visualization,
    });
  });
  let cover: PdfImage | null = null;
  const gallery: PdfImage[] = [];
  const floorPlans: PdfImage[] = [];
  jobs.forEach((job, index) => {
    const image = loaded[index];
    if (!image) return;
    if (job.kind === "cover") cover = image;
    else if (job.kind === "gallery") gallery.push(image);
    else floorPlans.push(image);
  });
  const skippedImages = loaded.filter((img) => img === null).length;

  const typeLabel = PROPERTY_TYPES[property.property_type].label;
  const subtitle = [
    typeLabel,
    property.rooms !== null && property.property_type !== "plot" ? formatRooms(property.rooms) : null,
    property.living_area !== null ? formatArea(property.living_area) : property.plot_area !== null ? `${formatArea(property.plot_area)} Grundstück` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const fallbackTitle = [typeLabel, property.rooms !== null && property.property_type !== "plot" ? formatRooms(property.rooms) : null, property.municipality ? `in ${property.municipality}` : null]
    .filter(Boolean)
    .join(" ");
  const locationLabel =
    listing?.public_address ??
    ([property.postal_code, property.municipality].filter(Boolean).join(" ") + (property.canton ? ` (${cantonName(property.canton)})` : "")).trim();

  const price = priceDisplay({
    offerType: property.offer_type,
    price: listing?.price !== null && listing?.price !== undefined ? Number(listing.price) : null,
    priceOnRequest: listing?.price_on_request ?? listing?.price === null,
    additionalCosts: listing?.additional_costs !== null && listing?.additional_costs !== undefined ? Number(listing.additional_costs) : null,
  });

  const overrideContact = options.contact && Object.values(options.contact).some((v) => typeof v === "string" && v.trim());
  let contact: DossierContent["contact"];
  if (overrideContact) {
    contact = {
      name: options.contact?.name?.trim() || null,
      company: options.contact?.company?.trim() || null,
      phone: options.contact?.phone?.trim() || null,
      email: options.contact?.email?.trim() || null,
    };
  } else {
    const privateContact = listing ? await loadDossierContact(client, listing.id) : null;
    contact = {
      name: listing?.contact_name?.trim() || null,
      company: null,
      // Telefon nur, wenn es auch im Inserat angezeigt werden darf; E-Mail nur, wenn vorhanden
      phone: listing?.show_contact_phone ? privateContact?.contact_phone?.trim() || null : null,
      email: privateContact?.contact_email?.trim() || null,
    };
  }

  const isPublished = listing && (listing.status === "published" || listing.status === "reserved") && listing.moderation_status !== "blocked";
  const listingUrl = isPublished && listing?.slug ? `${publicEnv.siteUrl}/immobilien/${listing.slug}` : null;
  let qrCode: Buffer | null = null;
  if (listingUrl && isSectionEnabled(options, "qrCode")) {
    try {
      qrCode = await qrCodePng(listingUrl);
    } catch (error) {
      console.warn("[pdf] QR-Code konnte nicht erzeugt werden", error);
    }
  }

  const sections = Object.fromEntries(DOSSIER_SECTION_KEYS.map((key) => [key, isSectionEnabled(options, key)])) as DossierContent["sections"];

  const content: DossierContent = {
    templateId: options.templateId,
    theme: themeFromConfig(options.templateId, templateRes.data?.config),
    isPreview,
    generatedAt: (input.now ?? new Date()).toISOString(),
    title: (options.title?.trim() || listing?.title?.trim() || fallbackTitle).slice(0, 140),
    subtitle,
    locationLabel: locationLabel || "Schweiz",
    offerType: property.offer_type,
    priceLabel: price.label,
    priceValue: price.value,
    priceNote: null,
    intro: options.intro?.trim() || listing?.short_description?.trim() || null,
    highlights: (listing?.highlights ?? []).filter((h) => h.trim()).slice(0, 12),
    keyFacts: keyFacts(property),
    description: listing?.description?.trim() || null,
    locationText: listing?.location_description?.trim() || null,
    locationFeatures: locationLabels(context.featureKeys),
    viewDescription: property.view_description?.trim() || null,
    equipmentText: listing?.equipment_description?.trim() || null,
    equipmentItems: equipmentLabels({ property, featureKeys: context.featureKeys, renovations: context.renovations }),
    renovations: context.renovations.map((r) => ({
      year: r.year,
      category: RENOVATION_CATEGORIES[r.category as keyof typeof RENOVATION_CATEGORIES] ?? "Weiteres",
      description: r.description,
    })),
    cover,
    gallery,
    floorPlans,
    documents: (documentsRes.data ?? []).map((d) => ({ title: d.title, category: d.category })),
    contact,
    listingUrl,
    qrCode,
    sections,
  };
  return { content, listingId: listing?.id ?? null, property, skippedImages };
}
