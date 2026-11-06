import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Info, MapPin } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ListingCard } from "@/components/property/listing-card";
import { FavoriteButton } from "@/components/property/favorite-button";
import { SwissMap } from "@/components/map/swiss-map";
import { approximateRadiusMeters } from "@/components/map/types";
import { getListingPage, getSimilarListings } from "@/components/listing-detail/data";
import { FloorPlanGallery, ListingGallery } from "@/components/listing-detail/listing-gallery";
import {
  ContactCard,
  ListingActionsProvider,
  ListingFooterActions,
  MobileContactBar,
  ShareButton,
  type ListingActionsInfo,
} from "@/components/listing-detail/listing-actions";
import {
  AdvertiserCard,
  AmenityList,
  DocumentList,
  HighlightList,
  KeyFactsGrid,
  RenovationList,
  SectionTitle,
  TextBlock,
  hasAmenities,
  pricePerSquareMeter,
  quickFacts,
  rentBreakdown,
} from "@/components/listing-detail/listing-sections";
import { ListingUnavailable } from "@/components/listing-detail/listing-unavailable";
import { ListingViewTracker } from "@/components/listing-detail/view-tracker";
import { LOCATION_PRECISION, OFFER_TYPES, PROPERTY_TYPES } from "@/lib/constants";
import { formatDateLong } from "@/lib/format";
import { priceDisplay } from "@/lib/listings/price";
import { JsonLd } from "@/lib/seo/json-ld";
import { buildBreadcrumbJsonLd, buildListingJsonLd } from "@/lib/seo/listing-jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { searchPathForOffer } from "@/lib/seo/search-metadata";
import { absoluteUrl, metaDescription } from "@/lib/seo/site";

/** ISR: Inseratseiten werden beim ersten Aufruf erzeugt und alle 2 Minuten aktualisiert. */
export const revalidate = 120;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getListingPage(slug);
  if (data.kind === "unavailable") {
    return { title: "Inserat nicht mehr verfügbar", robots: { index: false, follow: true } };
  }
  if (data.kind !== "listing") return { title: "Inserat nicht gefunden", robots: { index: false, follow: false } };

  const l = data.listing;
  const title = l.title ?? PROPERTY_TYPES[l.property_type].label;
  const where = l.municipality ? ` in ${l.municipality}` : "";
  const cover = data.photos[0];
  const description =
    metaDescription(l.short_description) ??
    metaDescription(l.search_summary) ??
    metaDescription(l.description) ??
    `${PROPERTY_TYPES[l.property_type].label} ${l.offer_type === "sale" ? "zu verkaufen" : "zu vermieten"}${where}.`;
  return pageMetadata({
    title: `${title} – ${OFFER_TYPES[l.offer_type].label}${where}`,
    description,
    path: `/immobilien/${l.slug ?? slug}`,
    noindex: l.is_demo,
    images: cover ? [{ url: cover.src, alt: cover.alt, width: cover.width ?? undefined, height: cover.height ?? undefined }] : undefined,
  });
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const data = await getListingPage(slug);
  if (data.kind === "unavailable") return <ListingUnavailable status={data.status} />;
  if (data.kind === "not_found") notFound();
  if (data.kind === "error") throw new Error("Das Inserat konnte nicht geladen werden.");

  const { listing: l, photos, floorPlans, features, renovations, advertiser, organization, documents, verifications } = data;
  const similar = await getSimilarListings(l);

  const path = `/immobilien/${l.slug ?? slug}`;
  const title = l.title ?? PROPERTY_TYPES[l.property_type].label;
  const price = priceDisplay({ offerType: l.offer_type, price: l.price, priceOnRequest: l.price_on_request, additionalCosts: l.additional_costs });
  const priceDetail = rentBreakdown(l) ?? pricePerSquareMeter(l);
  const address = l.public_address ?? [l.postal_code, l.municipality].filter(Boolean).join(" ");
  const approximate = l.location_precision !== "exact";
  const radius = approximateRadiusMeters(l.location_precision);
  const hasCoordinates = l.public_latitude !== null && l.public_longitude !== null;
  const facts = quickFacts(l);
  const offerPath = searchPathForOffer(l.offer_type);
  const municipalityPath = l.municipality ? `${offerPath}?gemeinde=${encodeURIComponent(l.municipality)}` : null;
  const dossierHref = l.dossier_public && data.hasPublicDossier ? `/api/listings/${l.id}/dossier` : null;

  const info: ListingActionsInfo = {
    listingId: l.id,
    slug: l.slug ?? slug,
    title,
    ownerId: l.owner_id,
    offerType: l.offer_type,
    contactName: l.contact_name,
    priceValue: price.value,
    priceLabel: price.label,
    priceDetail,
    phone: l.show_contact_phone ? l.contact_phone : null,
    isReserved: l.status === "reserved",
  };

  const jsonLd = buildListingJsonLd({
    url: absoluteUrl(path),
    name: title,
    description: l.short_description ?? l.description,
    images: photos.slice(0, 8).map((p) => p.src),
    datePosted: l.first_published_at ?? l.published_at,
    dateModified: l.updated_at,
    offerType: l.offer_type,
    propertyType: l.property_type,
    status: l.status,
    price: l.price,
    priceOnRequest: l.price_on_request,
    additionalCosts: l.additional_costs,
    rooms: l.rooms,
    livingArea: l.living_area,
    precision: l.location_precision,
    publicAddress: l.public_address,
    postalCode: l.postal_code,
    municipality: l.municipality,
    canton: l.canton,
    latitude: l.public_latitude,
    longitude: l.public_longitude,
  });
  const breadcrumbs = [
    { name: "Immobilien", url: absoluteUrl("/immobilien") },
    { name: OFFER_TYPES[l.offer_type].label, url: absoluteUrl(offerPath) },
    ...(municipalityPath && l.municipality ? [{ name: l.municipality, url: absoluteUrl(municipalityPath) }] : []),
    { name: title, url: absoluteUrl(path) },
  ];

  const galleryBadges = (
    <div className="flex flex-wrap gap-1.5">
      <Badge tone="solid" className="shadow-sm">
        {OFFER_TYPES[l.offer_type].label}
      </Badge>
      {l.status === "reserved" ? (
        <Badge tone="amber" className="shadow-sm">
          Reserviert
        </Badge>
      ) : null}
      {l.is_demo ? (
        <Badge tone="dark" className="shadow-sm">
          Demo
        </Badge>
      ) : null}
    </div>
  );

  return (
    <ListingActionsProvider info={info}>
      <JsonLd data={jsonLd} />
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumbs)} />
      <ListingViewTracker listingId={l.id} />

      <article className="pb-28 lg:pb-0">
        <div className="container-page pt-4 sm:pt-6">
          <nav aria-label="Brotkrümelnavigation" className="mb-4 text-sm text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link href="/immobilien" className="hover:text-forest hover:underline">
                  Immobilien
                </Link>
              </li>
              <li className="flex items-center gap-1">
                <ChevronRight className="size-3.5" aria-hidden />
                <Link href={offerPath} className="hover:text-forest hover:underline">
                  {OFFER_TYPES[l.offer_type].label}
                </Link>
              </li>
              {municipalityPath ? (
                <li className="flex items-center gap-1">
                  <ChevronRight className="size-3.5" aria-hidden />
                  <Link href={municipalityPath} className="hover:text-forest hover:underline">
                    {l.municipality}
                  </Link>
                </li>
              ) : null}
            </ol>
          </nav>

          {l.is_demo ? (
            <Alert tone="warning" title="Demo-Inserat – fiktives Angebot" className="mb-4">
              Dieses Inserat dient nur zur Veranschaulichung von Immovia. Die Immobilie wird nicht wirklich angeboten.
            </Alert>
          ) : null}

          <ListingGallery images={photos} title={title} badges={galleryBadges} />

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid min-w-0 content-start gap-12">
              <header>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="green">{OFFER_TYPES[l.offer_type].verb}</Badge>
                  <Badge tone="outline">{PROPERTY_TYPES[l.property_type].label}</Badge>
                  {l.status === "reserved" ? <Badge tone="amber">Reserviert</Badge> : null}
                </div>
                <h1 className="mt-3 font-display text-[1.875rem] font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h1>
                {address ? (
                  <p className="mt-3 flex items-start gap-2 text-[0.9375rem] text-muted-foreground">
                    <MapPin className="mt-0.5 size-[18px] shrink-0" aria-hidden />
                    <span>
                      {address}
                      {approximate ? <span className="text-muted-foreground/80"> · {LOCATION_PRECISION[l.location_precision].label}</span> : null}
                    </span>
                  </p>
                ) : null}
                {facts.length ? (
                  <ul role="list" className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-semibold">
                    {facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                ) : null}

                {/* Preis und Schnellaktionen auf Mobilgeräten */}
                <div className="mt-6 rounded-2xl bg-surface p-5 lg:hidden">
                  <p className="text-sm text-muted-foreground">{price.label}</p>
                  <p className="font-display text-[1.75rem] font-extrabold tracking-tight text-brand tabular">{price.value}</p>
                  {priceDetail ? <p className="text-sm text-muted-foreground">{priceDetail}</p> : null}
                  <div className="mt-4 flex gap-2">
                    <FavoriteButton listingId={l.id} variant="inline" className="flex-1" />
                    <ShareButton title={title} path={path} className="flex-1" />
                  </div>
                </div>
              </header>

              <section aria-labelledby="eckdaten" className="grid gap-5">
                <SectionTitle id="eckdaten">Eckdaten</SectionTitle>
                <KeyFactsGrid listing={l} />
              </section>

              {l.highlights.length ? (
                <section aria-labelledby="highlights" className="grid gap-5">
                  <SectionTitle id="highlights">Das Besondere</SectionTitle>
                  <HighlightList items={l.highlights} />
                </section>
              ) : null}

              {l.short_description || l.description ? (
                <section aria-labelledby="beschreibung" className="grid gap-4">
                  <SectionTitle id="beschreibung">Beschreibung</SectionTitle>
                  {l.short_description ? <TextBlock text={l.short_description} lead /> : null}
                  {l.description ? <TextBlock text={l.description} /> : null}
                </section>
              ) : null}

              <section aria-labelledby="lage" className="grid gap-4">
                <SectionTitle id="lage">Lage</SectionTitle>
                {l.location_description ? <TextBlock text={l.location_description} /> : null}
                {hasCoordinates ? (
                  <SwissMap
                    className="aspect-[4/3] sm:aspect-[16/9]"
                    ariaLabel={`Karte: ${approximate ? "ungefährer Standort" : "Standort"} ${address}`}
                    markers={[
                      {
                        id: l.id,
                        lat: Number(l.public_latitude),
                        lng: Number(l.public_longitude),
                        ariaLabel: `${approximate ? "Ungefährer Standort" : "Standort"}: ${address}`,
                        approximate,
                        radiusMeters: radius ?? undefined,
                      },
                    ]}
                    cooperativeGestures
                    circleOnlyForApproximate
                    maxFitZoom={approximate && (radius ?? 0) >= 500 ? 13 : 15}
                  />
                ) : null}
                {approximate ? (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <strong className="font-semibold text-foreground">Ungefährer Standort.</strong>{" "}
                      {LOCATION_PRECISION[l.location_precision].description} Die genaue Adresse erhalten Sie von der Inserentin
                      bzw. dem Inserenten.
                    </span>
                  </p>
                ) : null}
                {!hasCoordinates && !l.location_description ? (
                  <p className="text-sm text-muted-foreground">Für dieses Inserat ist kein Kartenstandort hinterlegt.</p>
                ) : null}
              </section>

              {l.equipment_description || hasAmenities(l, features) ? (
                <section aria-labelledby="ausstattung" className="grid gap-5">
                  <SectionTitle id="ausstattung">Ausstattung</SectionTitle>
                  {l.equipment_description ? <TextBlock text={l.equipment_description} /> : null}
                  <AmenityList listing={l} features={features} />
                </section>
              ) : null}

              {renovations.length ? (
                <section aria-labelledby="renovationen" className="grid gap-5">
                  <SectionTitle id="renovationen">Renovationen</SectionTitle>
                  <RenovationList items={renovations} />
                </section>
              ) : null}

              {floorPlans.length ? (
                <section aria-labelledby="grundrisse" className="grid gap-5">
                  <SectionTitle id="grundrisse">Grundrisse</SectionTitle>
                  <FloorPlanGallery plans={floorPlans} title={title} />
                </section>
              ) : null}

              {documents.length || dossierHref ? (
                <section aria-labelledby="unterlagen" className="grid gap-5">
                  <div>
                    <SectionTitle id="unterlagen">Unterlagen</SectionTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Von der Inserentin bzw. dem Inserenten öffentlich freigegeben.</p>
                  </div>
                  <DocumentList documents={documents} dossierHref={dossierHref} />
                </section>
              ) : null}

              <section aria-labelledby="inserent" className="grid gap-5">
                <SectionTitle id="inserent">{organization ? "Anbieter" : "Inserent"}</SectionTitle>
                <AdvertiserCard advertiser={advertiser} organization={organization} verifications={verifications} />
              </section>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
                <p>
                  Zuletzt aktualisiert am <time dateTime={l.updated_at}>{formatDateLong(l.updated_at)}</time>
                  {l.first_published_at ? (
                    <>
                      {" "}
                      · Online seit <time dateTime={l.first_published_at}>{formatDateLong(l.first_published_at)}</time>
                    </>
                  ) : null}
                </p>
                <ListingFooterActions />
              </footer>
            </div>

            <aside aria-label="Kontakt und Aktionen">
              <div className="grid gap-4 lg:sticky lg:top-24">
                <ContactCard />
              </div>
            </aside>
          </div>
        </div>

        {similar.length ? (
          <section aria-labelledby="aehnliche" className="container-page mt-20">
            <h2 id="aehnliche" className="font-display text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
              Ähnliche Immobilien
            </h2>
            <ul role="list" className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((item) => (
                <li key={item.id}>
                  <ListingCard listing={item} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      <MobileContactBar />
    </ListingActionsProvider>
  );
}
