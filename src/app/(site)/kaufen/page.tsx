import type { Metadata } from "next";
import { SearchPage, searchPageMetadata, type RawSearchParams } from "@/components/search/search-page";

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return searchPageMetadata(await searchParams, "sale");
}

export default async function KaufenPage({ searchParams }: Props) {
  return <SearchPage params={await searchParams} routeOffer="sale" />;
}
