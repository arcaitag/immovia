import { CircleSlash, Download, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ComparablesTable } from "@/components/valuation/comparables-table";
import { FactorLists } from "@/components/valuation/factor-lists";
import { ValuationRangeBar } from "@/components/valuation/range-bar";
import { formatChf, formatDate, formatDateLong } from "@/lib/format";
import { CONFIDENCE_LABELS, SOURCE_TYPE_LABELS, VALUATION_STATUS_LABELS } from "@/lib/valuation/labels";
import { areaLabelFor, parseDataQuality, parseFactors, qualityRows, type ValuationDetail } from "@/lib/valuation/view";

/** Ergebnis einer gespeicherten Bewertung – ehrlich gekennzeichnet (Angebots- ≠ Transaktionspreise). */
export function ValuationResult({ detail, rent, publicSlugs }: { detail: ValuationDetail; rent: boolean; publicSlugs: Record<string, string> }) {
  const v = detail.valuation;
  const quality = parseDataQuality(v.data_quality);
  const status = VALUATION_STATUS_LABELS[v.status];
  const confidence = CONFIDENCE_LABELS[v.confidence];
  const hasNumbers = (v.status === "completed" || v.status === "limited") && v.estimated_value !== null;
  const suffix = rent ? " / Mt." : "";
  const positive = parseFactors(v.positive_factors);
  const negative = parseFactors(v.negative_factors);

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={status.label} tone={status.tone} />
            <span className="text-sm text-muted-foreground">Bewertung vom {formatDateLong(v.created_at)}</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/valuations/${v.id}/pdf`}>
              <Download aria-hidden /> Bericht als PDF
            </a>
          </Button>
        </div>
        <CardContent className="pt-5 sm:pt-6">
          {hasNumbers ? (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="grid gap-5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {rent ? "Geschätzte Nettomiete pro Monat" : "Geschätzter Marktwert"} – auf Basis von Angebotspreisen
                  </p>
                  <p className="mt-1 font-display text-4xl font-extrabold tracking-tight text-forest tabular sm:text-5xl">
                    {formatChf(v.estimated_value)}
                    {suffix ? <span className="text-xl font-bold text-muted-foreground">{suffix}</span> : null}
                  </p>
                </div>
                <ValuationRangeBar low={Number(v.value_low)} estimate={Number(v.estimated_value)} high={Number(v.value_high)} suffix={suffix} />
                {quality.summary ? <p className="text-sm leading-relaxed text-muted-foreground">{quality.summary}</p> : null}
              </div>
              <div className="grid content-start gap-4">
                <div className="rounded-xl bg-mint-50 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Möglicher Inseratepreis</p>
                  <p className="font-display text-2xl font-extrabold tabular text-foreground">
                    {formatChf(v.suggested_list_price)}
                    {suffix}
                  </p>
                  {quality.listPriceExplanation ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{quality.listPriceExplanation}</p> : null}
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-muted-foreground">Vertrauensgrad</p>
                    <StatusBadge label={confidence.label} tone={confidence.tone} />
                  </div>
                  {v.confidence_explanation ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{v.confidence_explanation}</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <CircleSlash className="size-5" aria-hidden />
              </span>
              <div className="grid gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold">Noch keine belastbare Bewertung möglich</h3>
                  <p className="text-sm text-muted-foreground">
                    Immovia zeigt bewusst keine Zahl, wenn zu wenige vergleichbare Daten vorliegen. Eine geschätzte Zahl ohne Grundlage wäre irreführend.
                  </p>
                </div>
                {quality.missing.length ? (
                  <div>
                    <p className="text-sm font-semibold">Was fehlt</p>
                    <ul className="mt-1 grid gap-1 text-sm text-muted-foreground">
                      {quality.missing.map((m) => (
                        <li key={m}>– {m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {quality.suggestions.length ? (
                  <div>
                    <p className="text-sm font-semibold">Was helfen würde</p>
                    <ul className="mt-1 grid gap-1 text-sm text-muted-foreground">
                      {quality.suggestions.map((m) => (
                        <li key={m}>– {m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          {quality.notes.length ? (
            <ul className="mt-5 grid gap-1.5 rounded-xl bg-warning-bg p-4 text-sm text-warning">
              {quality.notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {note}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {v.explanation ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-brand" aria-hidden /> Erklärung
            </CardTitle>
            <CardDescription>KI-generiert, ausschliesslich auf Basis der oben berechneten Daten. Zahlen stammen nie von der KI.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed">{v.explanation}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datenquellen</CardTitle>
            <CardDescription>Woher die Zahlen stammen.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {detail.sources.length === 0 ? <p className="text-sm text-muted-foreground">Keine Datenquelle verwendet.</p> : null}
            {detail.sources.map((source) => (
              <div key={source.id} className="grid gap-1">
                <p className="font-semibold">
                  {source.name} <span className="text-xs font-normal text-muted-foreground">({SOURCE_TYPE_LABELS[source.source_type] ?? source.source_type})</span>
                </p>
                {source.description ? <p className="text-sm text-muted-foreground">{source.description}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {[
                    source.data_as_of ? `Stand ${formatDate(source.data_as_of)}` : null,
                    source.record_count !== null ? `${source.record_count} Datensätze` : null,
                    source.license_note,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Qualität und Aktualität der Daten</CardTitle>
            <CardDescription>Grundlage dieser Bewertung.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {qualityRows(quality).map((row) => (
                <div key={row.label} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      {detail.comparables.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Vergleichsobjekte</CardTitle>
            <CardDescription>
              Die {detail.comparables.length} ähnlichsten von {quality.sampleSize} ausgewerteten Angeboten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ComparablesTable comparables={detail.comparables} areaLabel={areaLabelFor(quality.areaBasis)} publicSlugs={publicSlugs} rent={rent} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Wertfaktoren</CardTitle>
        </CardHeader>
        <CardContent>
          <FactorLists positive={positive} negative={negative} />
        </CardContent>
      </Card>

      <p className="rounded-xl border border-border bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">{v.disclaimer}</p>
    </div>
  );
}
