import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BadgeCheck, Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ListingCard } from "@/components/property/listing-card";
import { createPublicClient } from "@/lib/supabase/public";
import { propertyImageUrl, publicStorageUrl } from "@/lib/storage";
import { cantonName } from "@/lib/constants";
import { formatDateLong, formatPhone, pluralize } from "@/lib/format";
import { mapSearchRow, type ListingCardData } from "@/types/domain";
import { JsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, metaDescription } from "@/lib/seo/site";

export const revalidate = 300;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

/** Öffentliches Firmenprofil (RLS: nur öffentliche, aktive Organisationen) inkl. veröffentlichter Inserate. */
const getCompany = cache(async (slug: string) => {
  const supabase = createPublicClient();
  if (!supabase) return { kind: "error" as const };
  const { data: org, error } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_path, description, street, postal_code, city, canton, phone, email, website, uid_number, created_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return { kind: "error" as const };
  if (!org) return { kind: "not_found" as const };

  const [{ data: listingRows }, verificationsRes] = await Promise.all([
    supabase.from("listings").select("id").eq("organization_id", org.id).order("published_at", { ascending: false }).limit(100),
    // Nur Art und Datum (keine Notizen, Methode oder prüfende Person)
    supabase.rpc("get_public_verifications", { p_subject_type: "organization", p_subject_id: org.id }),
  ]);
  if (verificationsRes.error) console.error("[firma] Prüfvermerke nicht geladen", verificationsRes.error.message);
  const orgVerification = (verificationsRes.data ?? []).find((v) => v.kind === "organization");
  const verification = orgVerification ? { verifiedAt: orgVerification.verified_at } : null;
  const ids = (listingRows ?? []).map((l) => l.id);
  let listings: ListingCardData[] = [];
  if (ids.length) {
    const { data } = await supabase.rpc("search_listings", { p_listing_ids: ids, p_limit: 100, p_sort: "newest" });
    listings = (data ?? []).map((row) =>
      mapSearchRow(row, propertyImageUrl({ display_path: row.cover_path, external_url: row.cover_external_url }, "md")),
    );
  }
  return { kind: "company" as const, org, listings, verification };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCompany(slug);
  if (data.kind !== "company") return { title: "Firma nicht gefunden", robots: { index: false } };
  const { org } = data;
  const logo = publicStorageUrl("org-logos", org.logo_path);
  return pageMetadata({
    title: `${org.name} – Immobilien und Kontakt`,
    description:
      metaDescription(org.description) ??
      `Aktuelle Immobilienangebote von ${org.name}${org.city ? ` in ${org.city}` : ""} auf Immovia.`,
    path: `/firmen/${org.slug}`,
    images: logo ? [{ url: logo, alt: `Logo ${org.name}` }] : undefined,
  });
}

export default async function FirmenProfilPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCompany(slug);
  if (data.kind === "not_found") notFound();
  if (data.kind === "error") throw new Error("Das Firmenprofil konnte nicht geladen werden.");
  const { org, listings, verification } = data;
  const logo = publicStorageUrl("org-logos", org.logo_path);
  const address = [org.street, [org.postal_code, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const websiteLabel = org.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          name: org.name,
          url: absoluteUrl(`/firmen/${org.slug}`),
          ...(logo ? { logo } : {}),
          ...(org.description ? { description: org.description } : {}),
          ...(org.phone ? { telephone: org.phone } : {}),
          ...(org.email ? { email: org.email } : {}),
          ...(org.website ? { sameAs: [org.website] } : {}),
          ...(address
            ? {
                address: {
                  "@type": "PostalAddress",
                  ...(org.street ? { streetAddress: org.street } : {}),
                  ...(org.postal_code ? { postalCode: org.postal_code } : {}),
                  ...(org.city ? { addressLocality: org.city } : {}),
                  ...(org.canton ? { addressRegion: org.canton } : {}),
                  addressCountry: "CH",
                },
              }
            : {}),
        }}
      />

      <section className="bg-surface">
        <div className="container-page grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white text-muted-foreground shadow-card">
              {logo ? (
                <Image src={logo} alt={`Logo ${org.name}`} fill sizes="96px" className="object-contain p-2" priority />
              ) : (
                <Building2 className="size-10" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Immobilienfirma</p>
              <h1 className="mt-2 font-display text-[2rem] font-extrabold leading-tight tracking-tight text-forest sm:text-4xl">{org.name}</h1>
              {org.city ? (
                <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-4" aria-hidden />
                  {org.city}
                  {org.canton ? `, ${cantonName(org.canton)}` : ""}
                </p>
              ) : null}
              {verification ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Badge tone="green" className="px-3 py-1 text-[0.8125rem]">
                    <BadgeCheck aria-hidden /> Firma verifiziert
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Von Immovia manuell geprüft, z. B. anhand des Handelsregisters
                    {verification.verifiedAt ? ` (${formatDateLong(verification.verifiedAt)})` : ""}.
                  </span>
                </div>
              ) : null}
              {org.description ? <p className="mt-5 max-w-2xl whitespace-pre-line leading-relaxed text-foreground/80">{org.description}</p> : null}
            </div>
          </div>

          <aside aria-label="Kontakt" className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-lg font-bold">Kontakt</h2>
            <ul className="mt-4 grid gap-3 text-sm">
              {address ? (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>{address}</span>
                </li>
              ) : null}
              {org.phone ? (
                <li className="flex items-center gap-3">
                  <Phone className="size-4 shrink-0 text-brand" aria-hidden />
                  <a href={`tel:${org.phone.replace(/[^\d+]/g, "")}`} className="font-medium hover:text-forest hover:underline">
                    {formatPhone(org.phone)}
                  </a>
                </li>
              ) : null}
              {org.email ? (
                <li className="flex items-center gap-3">
                  <Mail className="size-4 shrink-0 text-brand" aria-hidden />
                  <a href={`mailto:${org.email}`} className="break-all font-medium hover:text-forest hover:underline">
                    {org.email}
                  </a>
                </li>
              ) : null}
              {org.website ? (
                <li className="flex items-center gap-3">
                  <Globe className="size-4 shrink-0 text-brand" aria-hidden />
                  <a href={org.website} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium hover:text-forest hover:underline">
                    {websiteLabel}
                  </a>
                </li>
              ) : null}
            </ul>
            {org.uid_number ? <p className="mt-4 text-xs text-muted-foreground">UID: {org.uid_number}</p> : null}
            {!address && !org.phone && !org.email && !org.website ? (
              <p className="mt-2 text-sm text-muted-foreground">Kontaktieren Sie die Firma direkt über ein Inserat.</p>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="container-page mt-12" aria-labelledby="inserate">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="inserate" className="font-display text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
            Aktuelle Inserate
          </h2>
          <p className="text-sm text-muted-foreground">{pluralize(listings.length, "Inserat", "Inserate")}</p>
        </div>
        {listings.length ? (
          <ul role="list" className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard listing={listing} priority={index < 3} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="mt-6"
            icon={Building2}
            title="Derzeit keine öffentlichen Inserate"
            description="Diese Firma hat im Moment keine veröffentlichten Inserate auf Immovia."
            action={
              <Button asChild variant="outline">
                <Link href="/immobilien">Alle Immobilien ansehen</Link>
              </Button>
            }
          />
        )}
      </section>
    </>
  );
}
