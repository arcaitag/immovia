import Image from "next/image";
import { Check, ImageOff, MapPin, MessageSquare, Phone, User, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AMENITY_FLAGS,
  CONDITIONS,
  FEATURE_CATALOG,
  HEATING_TYPES,
  OFFER_TYPES,
  PROPERTY_TYPES,
  RENOVATION_CATEGORIES,
  type FeatureKey,
  type RenovationCategory,
} from "@/lib/constants";
import { formatArea, formatChf, formatDate, formatFloor, formatPhone, formatRooms } from "@/lib/format";
import { priceDisplay } from "@/lib/listings/price";
import { propertyImageUrl } from "@/lib/storage";
import type { Tables } from "@/types/database";

export interface PreviewImage {
  id: string;
  display_path: string | null;
  external_url: string | null;
  caption: string | null;
  is_floor_plan: boolean;
  is_ai_visualization: boolean;
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-surface p-3.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <section className="grid gap-2">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="whitespace-pre-line leading-relaxed text-foreground/85">{text}</p>
    </section>
  );
}

function GalleryImage({ image, priority, sizes, className }: { image: PreviewImage; priority?: boolean; sizes: string; className?: string }) {
  const src = propertyImageUrl(image, "lg");
  return (
    <figure className={`relative overflow-hidden rounded-xl bg-muted ${className ?? ""}`}>
      {src ? <Image src={src} alt={image.caption ?? "Bild der Immobilie"} fill priority={priority} sizes={sizes} className="object-cover" /> : null}
      {image.is_ai_visualization ? (
        <Badge tone="amber" className="absolute left-2 top-2 shadow-sm">
          <WandSparkles aria-hidden /> KI-Visualisierung
        </Badge>
      ) : null}
    </figure>
  );
}

/**
 * Vereinfachte Vorschau des Inserats (eigene Darstellung, nicht die öffentliche Seite).
 * Zeigt den gespeicherten Stand – inklusive der öffentlichen Adresse gemäss Genauigkeit.
 */
export function ListingPreview({
  listing,
  images,
  features,
  renovations,
  contactPhone,
}: {
  listing: Tables<"listings">;
  /** Telefon aus listing_contacts; angezeigt nur bei show_contact_phone */
  contactPhone: string | null;
  images: PreviewImage[];
  features: string[];
  renovations: { id: string; year: number; category: string; description: string }[];
}) {
  const photos = images.filter((image) => !image.is_floor_plan);
  const floorPlans = images.filter((image) => image.is_floor_plan);
  const [hero, ...rest] = photos;
  const price = priceDisplay({
    offerType: listing.offer_type,
    price: listing.price,
    priceOnRequest: listing.price_on_request,
    additionalCosts: listing.additional_costs,
  });
  const location = listing.public_address ?? [listing.postal_code, listing.municipality].filter(Boolean).join(" ");
  const amenities = AMENITY_FLAGS.filter((flag) => listing[flag.key]).map((flag) => flag.label);
  const featureLabels = features.filter((key): key is FeatureKey => key in FEATURE_CATALOG).map((key) => FEATURE_CATALOG[key].label);
  const availability = listing.available_by_arrangement
    ? "Nach Vereinbarung"
    : listing.available_from
      ? `Ab ${formatDate(listing.available_from)}`
      : null;
  const isPlot = listing.property_type === "plot";

  return (
    <article className="grid gap-8">
      {hero ? (
        <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
          <GalleryImage image={hero} priority sizes="(min-width: 768px) 60vw, 100vw" className="aspect-[16/10]" />
          {rest.length ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1 md:grid-rows-2">
              {rest.slice(0, 2).map((image) => (
                <GalleryImage key={image.id} image={image} sizes="(min-width: 768px) 30vw, 50vw" className="aspect-[16/10] md:aspect-auto" />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex aspect-[16/7] items-center justify-center rounded-2xl border border-dashed border-border bg-surface text-muted-foreground">
          <span className="inline-flex items-center gap-2 text-sm">
            <ImageOff className="size-5" aria-hidden /> Noch keine Bilder
          </span>
        </div>
      )}
      {photos.length > 3 ? <p className="-mt-6 text-sm text-muted-foreground">Insgesamt {photos.length} Bilder in der Galerie.</p> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-8">
          <header className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="solid">{OFFER_TYPES[listing.offer_type].label}</Badge>
              <Badge tone="outline">{PROPERTY_TYPES[listing.property_type].label}</Badge>
              {listing.status === "reserved" ? <Badge tone="amber">Reserviert</Badge> : null}
            </div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              {listing.title?.trim() || <span className="text-muted-foreground">Noch kein Titel</span>}
            </h2>
            <p className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {location || "Ort noch nicht erfasst"}
            </p>
          </header>

          {listing.short_description ? <p className="text-lg leading-relaxed">{listing.short_description}</p> : null}

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {!isPlot ? <Fact label="Zimmer" value={listing.rooms !== null ? formatRooms(listing.rooms, false) : null} /> : null}
            {!isPlot ? <Fact label="Wohnfläche" value={listing.living_area !== null ? formatArea(listing.living_area) : null} /> : null}
            <Fact label="Nutzfläche" value={listing.usable_area !== null ? formatArea(listing.usable_area) : null} />
            <Fact label="Grundstück" value={listing.plot_area !== null ? formatArea(listing.plot_area) : null} />
            <Fact label="Etage" value={listing.floor !== null ? formatFloor(listing.floor) : null} />
            <Fact label="Baujahr" value={listing.year_built !== null ? String(listing.year_built) : null} />
            <Fact label="Renoviert" value={listing.year_renovated !== null ? String(listing.year_renovated) : null} />
            <Fact label="Badezimmer" value={listing.bathrooms !== null ? String(listing.bathrooms) : null} />
            <Fact label="Zustand" value={listing.condition ? CONDITIONS[listing.condition] : null} />
            <Fact label="Heizung" value={listing.heating_type ? HEATING_TYPES[listing.heating_type] : null} />
            <Fact label="GEAK" value={listing.energy_label ? `Klasse ${listing.energy_label}` : null} />
            <Fact label="Parkplätze" value={listing.parking_spaces > 0 ? String(listing.parking_spaces) : null} />
            <Fact label="Verfügbar" value={availability} />
          </dl>

          {listing.highlights.length ? (
            <section className="grid gap-3">
              <h3 className="font-display text-lg font-bold">Highlights</h3>
              <ul className="flex flex-wrap gap-2">
                {listing.highlights.map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5 rounded-full bg-mint-100 px-3.5 py-1.5 text-sm font-medium text-forest">
                    <Check className="size-4" aria-hidden /> {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <TextBlock title="Beschreibung" text={listing.description} />
          <TextBlock title="Lage und Umgebung" text={listing.location_description} />
          <TextBlock title="Ausstattung" text={listing.equipment_description} />

          {amenities.length || featureLabels.length ? (
            <section className="grid gap-3">
              <h3 className="font-display text-lg font-bold">Merkmale</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[...amenities, ...featureLabels].map((label) => (
                  <li key={label} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-brand" aria-hidden /> {label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {renovations.length ? (
            <section className="grid gap-3">
              <h3 className="font-display text-lg font-bold">Renovationen</h3>
              <ul className="grid gap-2">
                {renovations.map((item) => (
                  <li key={item.id} className="text-sm">
                    <strong>{item.year}</strong> · {RENOVATION_CATEGORIES[item.category as RenovationCategory] ?? item.category}:{" "}
                    {item.description}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {floorPlans.length ? (
            <section className="grid gap-3">
              <h3 className="font-display text-lg font-bold">Grundrisse</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {floorPlans.map((image) => (
                  <GalleryImage key={image.id} image={image} sizes="(min-width: 640px) 40vw, 100vw" className="aspect-[4/3] bg-white" />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">{price.label}</p>
            <p className="font-display text-2xl font-extrabold tracking-tight text-forest">{price.value}</p>
            {listing.offer_type === "rent" && listing.additional_costs && listing.price !== null && !listing.price_on_request ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Netto {formatChf(listing.price)} + Nebenkosten {formatChf(listing.additional_costs)}
              </p>
            ) : null}
            {listing.parking_price ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Parkplatz: {formatChf(listing.parking_price)}
                {listing.offer_type === "rent" ? " / Monat" : ""}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="font-display font-bold">Kontakt</p>
            {listing.contact_name ? (
              <p className="flex items-center gap-2 text-sm">
                <User className="size-4 text-muted-foreground" aria-hidden /> {listing.contact_name}
              </p>
            ) : null}
            {listing.show_contact_phone && contactPhone ? (
              <p className="flex items-center gap-2 text-sm">
                <Phone className="size-4 text-muted-foreground" aria-hidden /> {formatPhone(contactPhone)}
              </p>
            ) : null}
            <Button type="button" disabled>
              <MessageSquare aria-hidden /> Nachricht senden
            </Button>
            <p className="text-xs text-muted-foreground">In der Vorschau deaktiviert.</p>
          </div>
        </aside>
      </div>
    </article>
  );
}
