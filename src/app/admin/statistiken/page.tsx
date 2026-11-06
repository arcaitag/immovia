import type { Metadata } from "next";
import { FileText, Gauge, House, MessageSquare, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DailyChart } from "@/components/admin/charts";
import { PeriodNav, ValuesTable } from "@/components/admin/admin-ui";
import { formatDelta } from "@/components/admin/admin-format";
import { requireModerator } from "@/lib/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import { parseDaysParam, type SearchParamValue } from "@/lib/validation/admin";
import { TIMESERIES_METRICS, getTimeseries, type TimeseriesMetric } from "@/services/admin";

export const metadata: Metadata = { title: "Statistiken" };

const METRICS: Record<TimeseriesMetric, { title: string; description: string; icon: typeof UserPlus; unit: string }> = {
  registrations: { title: "Registrierungen", description: "Neue Benutzerkonten pro Tag", icon: UserPlus, unit: "Registrierungen" },
  listings_published: {
    title: "Veröffentlichte Inserate",
    description: "Erstmals veröffentlichte Inserate pro Tag (ohne Demo)",
    icon: House,
    unit: "Inserate",
  },
  inquiries: { title: "Anfragen", description: "Kontaktanfragen zu Inseraten pro Tag", icon: MessageSquare, unit: "Anfragen" },
  valuations: { title: "Bewertungen", description: "Durchgeführte Bewertungen pro Tag", icon: Gauge, unit: "Bewertungen" },
  dossiers: { title: "Verkaufsdossiers", description: "Erfolgreich erstellte Dossiers pro Tag", icon: FileText, unit: "Dossiers" },
};

export default async function AdminStatisticsPage({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  await requireModerator();
  const params = await searchParams;
  const days = parseDaysParam(params.tage);
  const ts = await getTimeseries(days);
  const totals = Object.fromEntries(
    TIMESERIES_METRICS.map((metric) => [metric, ts.series.reduce((sum, point) => sum + point[metric], 0)]),
  ) as Record<TimeseriesMetric, number>;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Statistiken"
        description={`Entwicklung der Plattform pro Tag (Zeitzone Zürich), ${ts.from ? formatDate(ts.from) : "–"} bis ${ts.to ? formatDate(ts.to) : "–"}.`}
        actions={<PeriodNav basePath="/admin/statistiken" days={days} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {TIMESERIES_METRICS.map((metric) => {
          const config = METRICS[metric];
          const Icon = config.icon;
          const delta = formatDelta(totals[metric], ts.previous[metric]);
          return (
            <Card key={metric} className={metric === "registrations" ? "lg:col-span-2" : undefined}>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div className="grid gap-1">
                  <CardTitle>{config.title}</CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="flex items-center justify-end gap-2 font-display text-[1.75rem] font-extrabold leading-none tracking-tight">
                    <Icon className="size-5 text-brand" aria-hidden />
                    {formatNumber(totals[metric])}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{delta ?? "im Zeitraum"}</p>
                </div>
              </CardHeader>
              <CardContent>
                <DailyChart
                  data={ts.series.map((point) => ({ date: point.date, value: point[metric] }))}
                  valueLabel={config.unit}
                  height={metric === "registrations" ? 240 : 180}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ValuesTable
        caption="Plattformstatistik pro Tag"
        columns={["Datum", "Registrierungen", "Inserate", "Anfragen", "Bewertungen", "Dossiers"]}
        rows={[...ts.series].reverse().map((point) => [
          formatDate(point.date),
          formatNumber(point.registrations),
          formatNumber(point.listings_published),
          formatNumber(point.inquiries),
          formatNumber(point.valuations),
          formatNumber(point.dossiers),
        ])}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Alle Werte werden live aus der Datenbank gezählt. Die Veränderung bezieht sich auf den gleich langen Zeitraum davor.
      </p>
    </div>
  );
}
