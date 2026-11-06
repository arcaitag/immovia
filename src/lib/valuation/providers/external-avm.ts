import "server-only";

import type { ValuationProvider, ValuationProviderContext, ValuationProviderResult } from "@/lib/valuation/providers/types";
import type { ValuationSubject } from "@/lib/valuation/types";

/**
 * Provider «external_avm»: Schnittstelle für lizenzierte Schweizer Bewertungsanbieter
 * (z. B. IAZI/CIFI, Wüest Partner, PriceHubble, Fahrländer Partner) mit Transaktionsdaten
 * bzw. hedonischen Modellen.
 *
 * Es ist bewusst KEIN Anbieter angebunden: ohne Vertrag, Zugangsdaten und API-Dokumentation
 * wäre jede Integration geraten. Ohne Konfiguration ist dieser Provider nicht verfügbar
 * und liefert keine Werte.
 *
 * Anbinden eines Anbieters:
 *  1. Adapter implementieren (ExternalAvmAdapter) und in ADAPTERS eintragen.
 *  2. VALUATION_AVM_PROVIDER=<adapter-id> sowie die Zugangsdaten des Anbieters setzen.
 *  3. Der Adapter liefert source_type «transaction_data» bzw. «external_model» und
 *     price_basis «transaction_prices» bzw. «model» – der Vertrauensgrad darf dann «hoch» sein.
 */

export interface ExternalAvmAdapter {
  id: string;
  label: string;
  isConfigured(): boolean;
  estimate(subject: ValuationSubject, context: ValuationProviderContext): Promise<ValuationProviderResult>;
}

/** Registrierte Adapter. Aktuell leer – siehe Kommentar oben. */
const ADAPTERS: Record<string, ExternalAvmAdapter> = {};

function configuredAdapter(): ExternalAvmAdapter | null {
  const id = process.env.VALUATION_AVM_PROVIDER?.trim();
  if (!id) return null;
  const adapter = ADAPTERS[id];
  return adapter && adapter.isConfigured() ? adapter : null;
}

export function externalAvmStatus(): { configured: boolean; requested: string | null } {
  const requested = process.env.VALUATION_AVM_PROVIDER?.trim() || null;
  return { configured: configuredAdapter() !== null, requested };
}

export const externalAvmProvider: ValuationProvider = {
  id: "external_avm",
  label: "Lizenzierter Bewertungsanbieter",
  isAvailable: () => configuredAdapter() !== null,
  async estimate(subject, context) {
    const adapter = configuredAdapter();
    if (!adapter) throw new Error("Kein lizenzierter Bewertungsanbieter konfiguriert.");
    return adapter.estimate(subject, context);
  },
};
