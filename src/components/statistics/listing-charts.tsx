"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { formatDate, formatNumber } from "@/lib/format";

export interface StatisticsPoint {
  date: string;
  views: number;
  inquiries: number;
}

function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}.${month}.`;
}

function longDate(date: string): string {
  return formatDate(`${date}T12:00:00Z`, { weekday: "short" });
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: TooltipContentProps & { unit: { one: string; many: string } }) {
  const entry = payload?.[0];
  if (!active || !entry || typeof label !== "string") return null;
  const value = Number(entry.value ?? 0);
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-float">
      <p className="font-display text-lg font-extrabold leading-tight tabular">
        {formatNumber(value)} <span className="text-sm font-semibold">{value === 1 ? unit.one : unit.many}</span>
      </p>
      <p className="text-xs text-muted-foreground">{longDate(label)}</p>
    </div>
  );
}

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

/**
 * Aufrufe und Anfragen pro Tag aus get_listing_statistics. Zwei getrennte Diagramme
 * (eine Achse je Kennzahl), Werte zusätzlich als Tabelle verfügbar.
 */
export function ListingCharts({ series }: { series: StatisticsPoint[] }) {
  const interval = series.length > 45 ? 13 : 6;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <figcaption className="mb-4">
          <span className="block font-display font-bold">Aufrufe pro Tag</span>
          <span className="block text-xs text-muted-foreground">Pro Besucher und Tag einmal gezählt</span>
        </figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={interval} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                content={(props) => <ChartTooltip {...props} unit={{ one: "Aufruf", many: "Aufrufe" }} />}
              />
              <Area
                type="monotone"
                dataKey="views"
                name="Aufrufe"
                stroke="var(--brand)"
                strokeWidth={2}
                fill="var(--brand)"
                fillOpacity={0.1}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: "var(--brand)" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <figure className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <figcaption className="mb-4">
          <span className="block font-display font-bold">Anfragen pro Tag</span>
          <span className="block text-xs text-muted-foreground">Kontaktanfragen über das Inserat</span>
        </figcaption>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={interval} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                cursor={{ fill: "var(--mint-50)" }}
                content={(props) => <ChartTooltip {...props} unit={{ one: "Anfrage", many: "Anfragen" }} />}
              />
              <Bar dataKey="inquiries" name="Anfragen" fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <details className="rounded-2xl border border-border bg-card p-5 shadow-card lg:col-span-2">
        <summary className="cursor-pointer font-semibold">Werte als Tabelle anzeigen</summary>
        <div className="mt-4 max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Datum</th>
                <th className="py-2 pr-4 text-right font-semibold">Aufrufe</th>
                <th className="py-2 text-right font-semibold">Anfragen</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[...series].reverse().map((point) => (
                <tr key={point.date} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4">{longDate(point.date)}</td>
                  <td className="py-1.5 pr-4 text-right">{formatNumber(point.views)}</td>
                  <td className="py-1.5 text-right">{formatNumber(point.inquiries)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
