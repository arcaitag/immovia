import { formatChf } from "@/lib/format";

/** Spanne P25–P75 mit Markierung der Schätzung (rein visuell, Werte zusätzlich als Text). */
export function ValuationRangeBar({ low, estimate, high, suffix = "" }: { low: number; estimate: number; high: number; suffix?: string }) {
  const span = Math.max(1, high - low);
  const min = low - span * 0.35;
  const max = high + span * 0.35;
  const pos = (value: number) => `${((value - min) / (max - min)) * 100}%`;
  return (
    <figure className="grid gap-2">
      <div className="relative h-3 rounded-full bg-mint-100" aria-hidden>
        <div className="absolute inset-y-0 rounded-full bg-mint-300" style={{ left: pos(low), right: `calc(100% - ${pos(high)})` }} />
        <div
          className="absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded-full bg-forest shadow-sm ring-2 ring-white"
          style={{ left: pos(estimate) }}
        />
      </div>
      <figcaption className="flex items-start justify-between gap-2 text-xs text-muted-foreground tabular">
        <span>
          <span className="block font-semibold text-foreground">{formatChf(low)}{suffix}</span>
          unterer Wert
        </span>
        <span className="text-center">Spanne der mittleren 50 % der Vergleichsangebote</span>
        <span className="text-right">
          <span className="block font-semibold text-foreground">{formatChf(high)}{suffix}</span>
          oberer Wert
        </span>
      </figcaption>
    </figure>
  );
}
