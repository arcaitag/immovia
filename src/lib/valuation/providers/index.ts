import "server-only";

import { externalAvmProvider } from "@/lib/valuation/providers/external-avm";
import { platformOffersProvider } from "@/lib/valuation/providers/platform-offers";
import type { ValuationProvider } from "@/lib/valuation/providers/types";

/** Reihenfolge = Priorität: lizenzierte Daten zuerst, sonst Angebotspreise der Plattform. */
export const VALUATION_PROVIDERS: ValuationProvider[] = [externalAvmProvider, platformOffersProvider];

export function availableValuationProviders(): ValuationProvider[] {
  return VALUATION_PROVIDERS.filter((provider) => provider.isAvailable());
}
