import { formatChf } from "@/lib/format";
import type { OfferType } from "@/lib/constants";

/** Preisangabe für Karten und Detailseiten. Miete: Bruttomiete (Netto + Nebenkosten). */
export function priceDisplay(input: {
  offerType: OfferType;
  price: number | null;
  priceOnRequest: boolean;
  additionalCosts?: number | null;
}): { value: string; label: string } {
  if (input.priceOnRequest || input.price === null) {
    return { value: "Preis auf Anfrage", label: input.offerType === "rent" ? "Miete" : "Kaufpreis" };
  }
  if (input.offerType === "rent") {
    const gross = input.price + (input.additionalCosts ?? 0);
    return { value: formatChf(gross), label: input.additionalCosts ? "Miete brutto / Mt." : "Miete / Mt." };
  }
  return { value: formatChf(input.price), label: "Kaufpreis" };
}
