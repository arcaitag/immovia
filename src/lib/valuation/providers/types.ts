import type { AdminSupabaseClient } from "@/lib/supabase/admin";
import type { ValuationParams } from "@/lib/valuation/config";
import type { ValuationEstimate, ValuationSubject } from "@/lib/valuation/types";

export type ValuationSourceType = "platform_offers" | "transaction_data" | "statistical_index" | "external_model" | "owner_input";

export interface ValuationSourceRecord {
  sourceType: ValuationSourceType;
  name: string;
  description: string | null;
  /** YYYY-MM-DD */
  dataAsOf: string | null;
  recordCount: number | null;
  licenseNote: string | null;
  url: string | null;
}

export interface ValuationProviderContext {
  admin: AdminSupabaseClient;
  params: ValuationParams;
  now: Date;
}

export interface ValuationProviderResult {
  provider: string;
  method: string;
  estimate: ValuationEstimate;
  sources: ValuationSourceRecord[];
}

/**
 * Bewertungs-Provider. Zahlen liefert ausschliesslich ein Provider – nie das Sprachmodell.
 */
export interface ValuationProvider {
  readonly id: string;
  readonly label: string;
  isAvailable(): boolean;
  estimate(subject: ValuationSubject, context: ValuationProviderContext): Promise<ValuationProviderResult>;
}
