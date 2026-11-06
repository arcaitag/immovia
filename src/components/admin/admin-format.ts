import { formatNumber } from "@/lib/format";

/** Geschätzte Kosten in USD (Werte aus ai_usage_events.cost_usd). */
export function formatUsdEstimate(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "USD 0";
  if (value < 0.01) return "< USD 0.01";
  return `USD ${formatNumber(value, 2)}`;
}

/** Kompakte Darstellung grosser Zahlen (z. B. Tokens): 12’400 → «12.4 Tsd.», 3’100’000 → «3.1 Mio.». */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${formatNumber(value / 1_000_000, 1)} Mio.`;
  if (Math.abs(value) >= 10_000) return `${formatNumber(value / 1000, 1)} Tsd.`;
  return formatNumber(value);
}

/** Veränderung gegenüber der Vorperiode als Text, z. B. «+12 % ggü. Vorperiode». */
export function formatDelta(current: number, previous: number): string | null {
  if (previous === 0) return current === 0 ? null : "neu in diesem Zeitraum";
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  if (rounded === 0) return "unverändert ggü. Vorperiode";
  return `${rounded > 0 ? "+" : "−"}${formatNumber(Math.abs(rounded))} % ggü. Vorperiode`;
}
