import { Database, Scale, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Transparente Erklärung der Methode und der angebundenen Datenquellen. */
export function ValuationMethod({ params, avmConfigured }: { params: { min_comparables: number; radius_km: number; area_tolerance: number; max_age_days: number }; avmConfigured: boolean }) {
  const steps = [
    {
      icon: Database,
      title: "Vergleichsangebote finden",
      text: `Echte, veröffentlichte Inserate auf Immovia (ohne Demo-Inserate) mit gleicher Objektart, ähnlicher Fläche (±${Math.round(params.area_tolerance * 100)} %) im Umkreis von ${params.radius_km} km, höchstens ${params.max_age_days} Tage alt.`,
    },
    {
      icon: Scale,
      title: "Robust rechnen",
      text: `Median der Preise pro m² multipliziert mit Ihrer Fläche; die Spanne entspricht dem 25. bis 75. Perzentil. Unter ${params.min_comparables} Vergleichsangeboten wird keine Zahl angezeigt.`,
    },
    {
      icon: ShieldCheck,
      title: "Ehrlich kennzeichnen",
      text: "Angebotspreise sind keine bezahlten Preise. Der Vertrauensgrad ist deshalb höchstens «mittel». Zahlen berechnet nie die KI.",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>So entsteht die Schätzung</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="grid content-start gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex size-8 items-center justify-center rounded-xl bg-mint-100 text-forest">
                  <step.icon className="size-4" aria-hidden />
                </span>
                {index + 1}. {step.title}
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="font-semibold">Lizenzierte Marktdaten (Transaktionspreise)</span>
            <span className="block text-muted-foreground">
              Schnittstelle für Anbieter wie IAZI/CIFI, Wüest Partner, PriceHubble oder Fahrländer Partner vorbereitet.
            </span>
          </span>
          <Badge tone={avmConfigured ? "green" : "neutral"}>{avmConfigured ? "Angebunden" : "Nicht angebunden"}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
