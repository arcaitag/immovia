import { TrendingDown, TrendingUp } from "lucide-react";
import type { ValuationFactor } from "@/lib/valuation/types";

/** Qualitative Wertfaktoren – ausdrücklich nicht rechnerisch eingerechnet. */
export function FactorLists({ positive, negative }: { positive: ValuationFactor[]; negative: ValuationFactor[] }) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Diese Faktoren werden aus Ihren erfassten Objektdaten abgeleitet. Sie sind <strong className="font-semibold text-foreground">qualitativ</strong>{" "}
        und fliessen nicht rechnerisch in die Schätzung ein. Sie helfen einzuordnen, ob Ihr Objekt eher im oberen oder unteren Bereich der Spanne liegen
        könnte.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <FactorColumn title="Können den Wert erhöhen" factors={positive} positive />
        <FactorColumn title="Können den Wert reduzieren" factors={negative} positive={false} />
      </div>
    </div>
  );
}

function FactorColumn({ title, factors, positive }: { title: string; factors: ValuationFactor[]; positive: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className={`mb-3 flex items-center gap-2 text-sm font-semibold ${positive ? "text-forest" : "text-warning"}`}>
        <Icon className="size-4" aria-hidden /> {title}
      </p>
      {factors.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine erkannt.</p>
      ) : (
        <ul className="grid gap-2.5">
          {factors.map((factor) => (
            <li key={factor.key} className="text-sm">
              <span className="font-semibold">{factor.label}</span>
              {factor.detail ? <span className="block text-muted-foreground">{factor.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
