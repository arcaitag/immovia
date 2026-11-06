import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Check,
  Download,
  FileCheck2,
  FileText,
  Hammer,
  ImageIcon,
  KeyRound,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AMENITY_FLAGS,
  CONDITIONS,
  DOCUMENT_CATEGORIES,
  FEATURE_CATALOG,
  HEATING_TYPES,
  OFFER_TYPES,
  OWNERSHIP_TYPES,
  PROPERTY_TYPES,
  RENOVATION_CATEGORIES,
  type FeatureKey,
  type RenovationCategory,
} from "@/lib/constants";
import { formatArea, formatChf, formatDate, formatFileSize, formatFloor, formatRooms } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ListingAdvertiser, ListingDocument, PublicListing } from "@/components/listing-detail/data";

export function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display text-xl font-extrabold tracking-tight sm:text-[1.375rem]">
      {children}
    </h2>
  );
}

/** «Sofort», «Nach Vereinbarung» oder ein Datum. */
function availabilityLabel(listing: PublicListing): string | null {
  if (listing.available_by_arrangement) return "Nach Vereinbarung";
  if (!listing.available_from) return null;
  const today = new Date().toISOString().slice(0, 10);
  return listing.available_from <= today ? "Sofort" : `Ab ${formatDate(listing.available_from)}`;
}

export function keyFacts(listing: PublicListing): { label: string; value: string }[] {
  const facts: ({ label: string; value: string } | null)[] = [
    { label: "Objektart", value: PROPERTY_TYPES[listing.property_type].label },
    { label: "Angebot", value: OFFER_TYPES[listing.offer_type].verb },
    listing.rooms !== null ? { label: "Zimmer", value: formatRooms(listing.rooms, false) } : null,
    listing.living_area !== null ? { label: "Wohnfläche", value: formatArea(listing.living_area) } : null,
    listing.usable_area !== null ? { label: "Nutzfläche", value: formatArea(listing.usable_area) } : null,
    listing.plot_area !== null ? { label: "Grundstücksfläche", value: formatArea(listing.plot_area) } : null,
    listing.floor !== null ? { label: "Etage", value: formatFloor(listing.floor) } : null,
    listing.floors_total !== null ? { label: "Anzahl Etagen", value: String(listing.floors_total) } : null,
    listing.year_built !== null ? { label: "Baujahr", value: String(listing.year_built) } : null,
    listing.year_renovated !== null ? { label: "Letzte Renovation", value: String(listing.year_renovated) } : null,
    listing.condition ? { label: "Zustand", value: CONDITIONS[listing.condition] } : null,
    listing.heating_type ? { label: "Heizung", value: HEATING_TYPES[listing.heating_type] } : null,
    listing.energy_label ? { label: "Energieklasse", value: listing.energy_label } : null,
    listing.bathrooms !== null ? { label: "Badezimmer", value: String(listing.bathrooms) } : null,
    listing.parking_spaces > 0
      ? {
          label: "Parkplätze",
          value:
            listing.parking_price !== null
              ? `${listing.parking_spaces} · ${formatChf(listing.parking_price)}${listing.offer_type === "rent" ? " / Mt." : ""}`
              : String(listing.parking_spaces),
        }
      : null,
    (() => {
      const label = availabilityLabel(listing);
      return label ? { label: "Verfügbar", value: label } : null;
    })(),
    listing.offer_type === "sale" && listing.ownership_type ? { label: "Eigentumsform", value: OWNERSHIP_TYPES[listing.ownership_type] } : null,
  ];
  return facts.filter((f): f is { label: string; value: string } => f !== null);
}

export function KeyFactsGrid({ listing }: { listing: PublicListing }) {
  const facts = keyFacts(listing);
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="bg-card px-4 py-3.5">
          <dt className="text-xs font-medium text-muted-foreground">{fact.label}</dt>
          <dd className="mt-0.5 font-semibold tabular">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TextBlock({ text, lead = false }: { text: string; lead?: boolean }) {
  return (
    <p className={cn("whitespace-pre-line leading-relaxed text-foreground/85", lead && "text-lg font-medium text-foreground")}>{text}</p>
  );
}

function amenityFlags(listing: PublicListing): string[] {
  const flags: string[] = AMENITY_FLAGS.filter((flag) => listing[flag.key]).map((flag) => flag.label);
  if (listing.offer_type === "rent" && listing.pets_allowed === true) flags.push("Haustiere erlaubt");
  if (listing.offer_type === "rent" && listing.pets_allowed === false) flags.push("Keine Haustiere");
  return flags;
}

export function hasAmenities(listing: PublicListing, features: FeatureKey[]): boolean {
  return features.length > 0 || amenityFlags(listing).length > 0;
}

export function AmenityList({ listing, features }: { listing: PublicListing; features: FeatureKey[] }) {
  const flags = amenityFlags(listing);

  const groups = new Map<string, string[]>();
  for (const key of features) {
    const entry = FEATURE_CATALOG[key];
    groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry.label]);
  }
  if (!flags.length && !groups.size) return null;

  return (
    <div className="grid gap-5">
      {flags.length ? <ChipList items={flags} /> : null}
      {[...groups.entries()].map(([group, labels]) => (
        <div key={group}>
          <h3 className="mb-2 text-sm font-bold text-muted-foreground">{group}</h3>
          <ChipList items={labels} />
        </div>
      ))}
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <ul role="list" className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint-100 text-forest">
            <Check className="size-3.5" aria-hidden />
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function HighlightList({ items }: { items: string[] }) {
  return (
    <ul role="list" className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 rounded-2xl bg-mint-50 p-4 text-[0.9375rem] font-medium text-forest">
          <BadgeCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function RenovationList({ items }: { items: { id: string; year: number; category: RenovationCategory; description: string }[] }) {
  return (
    <ol className="relative grid gap-4 border-l-2 border-mint-200 pl-6">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[2.05rem] top-0.5 flex size-6 items-center justify-center rounded-full bg-mint-100 text-forest ring-4 ring-background">
            <Hammer className="size-3.5" aria-hidden />
          </span>
          <p className="text-sm font-bold tabular">
            {item.year} · {RENOVATION_CATEGORIES[item.category]}
          </p>
          <p className="mt-0.5 whitespace-pre-line text-[0.9375rem] text-foreground/85">{item.description}</p>
        </li>
      ))}
    </ol>
  );
}

export function DocumentList({
  documents,
  dossierHref,
}: {
  documents: ListingDocument[];
  dossierHref: string | null;
}) {
  return (
    <ul role="list" className="grid gap-2">
      {dossierHref ? (
        <li>
          <a
            href={dossierHref}
            rel="nofollow"
            className="flex items-center gap-4 rounded-2xl border border-mint-300 bg-mint-50 p-4 transition-colors hover:bg-mint-100 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-forest">
              <FileCheck2 className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-forest">Verkaufsdossier</span>
              <span className="block text-sm text-forest/75">PDF mit allen Angaben, Bildern und Grundrissen</span>
            </span>
            <Download className="size-5 shrink-0 text-forest" aria-hidden />
            <span className="sr-only">herunterladen</span>
          </a>
        </li>
      ) : null}
      {documents.map((doc) => (
        <li key={doc.id}>
          <a
            href={`/api/documents/${doc.id}/download`}
            rel="nofollow"
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-mint-300 hover:bg-mint-50 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              {doc.mimeType === "application/pdf" ? <FileText className="size-5" aria-hidden /> : <ImageIcon className="size-5" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{doc.title}</span>
              <span className="block text-sm text-muted-foreground">
                {DOCUMENT_CATEGORIES[doc.category]} · {doc.mimeType === "application/pdf" ? "PDF" : "Bild"} · {formatFileSize(doc.sizeBytes)}
              </span>
            </span>
            <Download className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">herunterladen</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function AdvertiserCard({
  advertiser,
  organization,
  verifications,
}: {
  advertiser: ListingAdvertiser | null;
  organization: { name: string; slug: string; logoUrl: string | null } | null;
  verifications: { ownership: boolean; documentationComplete: boolean; organization: boolean };
}) {
  const memberSince = advertiser ? formatDate(advertiser.memberSince, { day: undefined, month: "long", year: "numeric" }) : null;
  const badges = [
    advertiser?.emailVerified ? { icon: MailCheck, label: "E-Mail bestätigt" } : null,
    advertiser?.identityVerified ? { icon: BadgeCheck, label: "Identität verifiziert" } : null,
    verifications.ownership ? { icon: KeyRound, label: "Eigentümerberechtigung geprüft" } : null,
    verifications.documentationComplete ? { icon: ShieldCheck, label: "Objektdokumentation vollständig" } : null,
    organization && verifications.organization ? { icon: Building2, label: "Firma verifiziert" } : null,
  ].filter((b): b is { icon: typeof MailCheck; label: string } => b !== null);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <Avatar src={advertiser?.avatarUrl} name={advertiser?.displayName ?? "Inserent"} className="size-14 text-base" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{advertiser?.displayName ?? "Immovia-Mitglied"}</p>
          <p className="text-sm text-muted-foreground">
            {advertiser?.isBusiness ? "Immobilienfirma" : "Privatperson"}
            {memberSince ? ` · Mitglied seit ${memberSince}` : ""}
          </p>
        </div>
      </div>

      {badges.length ? (
        <ul role="list" className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <li key={badge.label}>
              <Badge tone="green" className="px-3 py-1 text-[0.8125rem]">
                <badge.icon aria-hidden /> {badge.label}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {advertiser?.emailVerified ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          «E-Mail bestätigt» heisst nur, dass die E-Mail-Adresse bestätigt wurde. Es ist kein Nachweis über das Eigentum
          an der Immobilie.
        </p>
      ) : null}

      {organization ? (
        <Link
          href={`/firmen/${organization.slug}`}
          className="mt-5 flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-mint-300 hover:bg-mint-50 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
            {organization.logoUrl ? (
              <Image src={organization.logoUrl} alt="" fill sizes="44px" className="object-contain p-1" />
            ) : (
              <Building2 className="size-5" aria-hidden />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{organization.name}</span>
            <span className="block text-sm text-primary">Firmenprofil ansehen</span>
          </span>
        </Link>
      ) : null}
    </div>
  );
}

/** Kurzinfo für die Kopfzeile: «4.5 Zimmer · 112 m² · 2. OG» */
export function quickFacts(listing: PublicListing): string[] {
  const isPlot = listing.property_type === "plot";
  return [
    !isPlot && listing.rooms !== null ? formatRooms(listing.rooms) : null,
    !isPlot && listing.living_area !== null ? `${formatArea(listing.living_area)} Wohnfläche` : null,
    listing.plot_area !== null && listing.property_type !== "apartment" ? `${formatArea(listing.plot_area)} Grundstück` : null,
    listing.floor !== null && listing.property_type === "apartment" ? formatFloor(listing.floor) : null,
  ].filter((v): v is string => Boolean(v));
}

/** Preis pro m² Wohnfläche bei Kaufobjekten (aus Preis und Fläche berechnet). */
export function pricePerSquareMeter(listing: PublicListing): string | null {
  if (listing.offer_type !== "sale" || listing.price_on_request || listing.price === null || !listing.living_area) return null;
  return `${formatChf(Math.round(listing.price / listing.living_area))} pro m² Wohnfläche`;
}

/** Aufschlüsselung der Miete: Netto + Nebenkosten. */
export function rentBreakdown(listing: PublicListing): string | null {
  if (listing.offer_type !== "rent" || listing.price_on_request || listing.price === null) return null;
  if (listing.additional_costs === null) return `Nettomiete ${formatChf(listing.price)}, Nebenkosten nicht angegeben`;
  return `Nettomiete ${formatChf(listing.price)} + Nebenkosten ${formatChf(listing.additional_costs)}`;
}

