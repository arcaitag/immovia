import Image from "next/image";
import Link from "next/link";
import { BedDouble, Building2, Car, ImageOff, MapPin, Square, Trees } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/property/favorite-button";
import { OFFER_TYPES, PROPERTY_TYPES } from "@/lib/constants";
import { formatArea, formatFloor, formatRooms } from "@/lib/format";
import { priceDisplay } from "@/lib/listings/price";
import type { ListingCardData } from "@/types/domain";
import { cn } from "@/lib/utils";

const NEW_DAYS = 7;

function isNew(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  return Date.now() - new Date(publishedAt).getTime() < NEW_DAYS * 86_400_000;
}

export function ListingCard({
  listing,
  priority = false,
  className,
  sizes = "(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw",
  variant = "default",
}: {
  listing: ListingCardData;
  priority?: boolean;
  className?: string;
  sizes?: string;
  /** compact: breiteres Bild, Preis und Eckdaten in einer Zeile (Startseite) */
  variant?: "default" | "compact";
}) {
  const compact = variant === "compact";
  const price = priceDisplay(listing);
  const href = listing.isExample || !listing.slug ? undefined : `/immobilien/${listing.slug}`;
  const isLand = listing.propertyType === "plot";
  const facts = [
    !isLand && listing.livingArea ? { icon: Square, text: formatArea(listing.livingArea) } : null,
    !isLand && listing.rooms ? { icon: BedDouble, text: formatRooms(listing.rooms) } : null,
    isLand || (listing.plotArea && listing.propertyType !== "apartment")
      ? listing.plotArea
        ? { icon: Trees, text: `${formatArea(listing.plotArea)} Grundstück` }
        : null
      : listing.floor !== null && listing.floor !== undefined
        ? { icon: Building2, text: formatFloor(listing.floor) }
        : listing.parkingSpaces > 0
          ? { icon: Car, text: `${listing.parkingSpaces} Parkplatz` }
          : null,
  ].filter((f): f is { icon: typeof Square; text: string } => f !== null);

  const content = (
    <>
      <div className={cn("relative overflow-hidden bg-muted", compact ? "aspect-[16/8.5]" : "aspect-[16/10]")}>
        {listing.imageUrl ? (
          <Image
            src={listing.imageUrl}
            alt={listing.title}
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-8" aria-hidden />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone={listing.offerType === "rent" ? "green" : "solid"} className="px-3 py-1 text-[0.8125rem] shadow-sm">
            {OFFER_TYPES[listing.offerType].label}
          </Badge>
          {isNew(listing.publishedAt) ? <Badge tone="outline" className="border-white/0 shadow-sm">Neu</Badge> : null}
          {listing.status === "reserved" ? <Badge tone="amber" className="shadow-sm">Reserviert</Badge> : null}
          {listing.isDemo ? <Badge tone="dark" className="shadow-sm">Demo</Badge> : null}
          {listing.isExample ? <Badge tone="dark" className="shadow-sm">Beispiel</Badge> : null}
        </div>
        {!listing.isExample && listing.id ? (
          <div className="absolute right-3 top-3">
            <FavoriteButton listingId={listing.id} />
          </div>
        ) : null}
      </div>
      {compact ? (
        <div className="flex flex-1 flex-col gap-1.5 px-5 pb-5 pt-4">
          <h3 className="line-clamp-1 font-display text-[1.0625rem] font-bold leading-snug text-foreground">{listing.title}</h3>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{listing.locationLabel || PROPERTY_TYPES[listing.propertyType].label}</span>
          </p>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5 pt-2">
            <p className="font-display text-xl font-extrabold tracking-tight text-primary tabular">
              {price.value}
              {listing.offerType === "rent" && listing.price !== null && !listing.priceOnRequest ? (
                <span className="ml-1 text-sm font-bold">/ Monat</span>
              ) : null}
              <span className="sr-only"> ({price.label})</span>
            </p>
            {facts.length ? (
              <ul className="flex items-center gap-4 text-sm text-foreground/80">
                {facts.slice(0, 2).map((fact) => (
                  <li key={fact.text} className="flex items-center gap-1.5 whitespace-nowrap">
                    <fact.icon className="size-4 text-muted-foreground" aria-hidden />
                    {fact.text}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2.5 p-5">
          <h3 className="line-clamp-1 font-display text-[1.0625rem] font-bold leading-snug text-foreground">{listing.title}</h3>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{listing.locationLabel || PROPERTY_TYPES[listing.propertyType].label}</span>
          </p>
          <p className="flex items-baseline gap-2">
            <span className="font-display text-xl font-extrabold tracking-tight text-brand tabular">{price.value}</span>
            <span className="text-xs text-muted-foreground">{price.label}</span>
          </p>
          {facts.length ? (
            <ul className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 text-sm text-foreground/80">
              {facts.map((fact) => (
                <li key={fact.text} className="flex items-center gap-1.5">
                  <fact.icon className="size-4 text-muted-foreground" aria-hidden />
                  {fact.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </>
  );

  const classes = cn(
    "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-[box-shadow,transform] duration-300",
    href && "hover:-translate-y-0.5 hover:shadow-card-hover",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <article className={classes} aria-label={`Beispielinserat: ${listing.title}`}>
      {content}
    </article>
  );
}
