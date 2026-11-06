"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { formatDate, formatNumber } from "@/lib/format";

/**
 * Diagramme der Administration (recharts). Eine Serie pro Diagramm in der
 * Markenfarbe, feine Gitterlinien, Tooltip beim Überfahren. Die Werte stehen
 * zusätzlich jeweils in einer Tabelle (siehe Seiten), Tooltips sind nie die einzige Quelle.
 */

export type ValueFormat = "count" | "usd";

function formatValue(value: number, format: ValueFormat): string {
  if (format === "usd") {
    if (value === 0) return "USD 0";
    if (value < 0.01) return "< USD 0.01";
    return `USD ${formatNumber(value, 2)}`;
  }
  return formatNumber(value);
}

function formatAxisValue(value: number, format: ValueFormat): string {
  if (format === "usd") return formatNumber(value, value < 1 ? 2 : 0);
  if (Math.abs(value) >= 10_000) return `${formatNumber(value / 1000, 0)} Tsd.`;
  return formatNumber(value);
}

const shortDate = (value: string) => formatDate(value, { year: undefined });
const longDate = (value: string) => formatDate(value, { weekday: "short" });

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

function DailyTooltip({ active, payload, label, valueLabel, format }: TooltipContentProps & { valueLabel: string; format: ValueFormat }) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-float">
      <p className="font-display text-base font-bold tabular">{formatValue(value, format)}</p>
      <p className="text-xs text-muted-foreground">
        {valueLabel} · {typeof label === "string" ? longDate(label) : ""}
      </p>
    </div>
  );
}

/** Tageswerte als Fläche (eine Serie). */
export function DailyChart({
  data,
  valueLabel,
  format = "count",
  height = 220,
}: {
  data: Array<{ date: string; value: number }>;
  valueLabel: string;
  format?: ValueFormat;
  height?: number;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);
  const first = data[0];
  const last = data[data.length - 1];
  const tickInterval = data.length > 60 ? Math.ceil(data.length / 8) : data.length > 14 ? Math.ceil(data.length / 7) : 0;
  return (
    <div
      role="img"
      aria-label={`${valueLabel}: ${formatValue(total, format)} im Zeitraum ${first ? shortDate(first.date) : ""} bis ${last ? shortDate(last.date) : ""}, Höchstwert ${formatValue(max, format)} pro Tag.`}
      className="w-full"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            interval={tickInterval}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "var(--input)" }}
            minTickGap={12}
          />
          <YAxis
            allowDecimals={format === "usd"}
            tickFormatter={(v: number) => formatAxisValue(v, format)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={format === "usd" ? 52 : 40}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
            content={(props) => <DailyTooltip {...props} valueLabel={valueLabel} format={format} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={valueLabel}
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
  );
}

function BarTooltip({ active, payload, format }: TooltipContentProps & { format: ValueFormat }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const row = entry?.payload as { label?: string; hint?: string } | undefined;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-float">
      <p className="font-display text-base font-bold tabular">{formatValue(Number(entry?.value ?? 0), format)}</p>
      <p className="text-xs text-muted-foreground">{row?.label}</p>
      {row?.hint ? <p className="text-xs text-muted-foreground">{row.hint}</p> : null}
    </div>
  );
}

/** Rangliste als horizontale Balken (eine Farbe, grösster Wert oben). */
export function RankedBars({
  data,
  valueLabel,
  format = "count",
}: {
  data: Array<{ label: string; value: number; hint?: string }>;
  valueLabel: string;
  format?: ValueFormat;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const height = sorted.length * 44 + 16;
  return (
    <div role="img" aria-label={`${valueLabel}: ${sorted.map((d) => `${d.label} ${formatValue(d.value, format)}`).join(", ")}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 88, bottom: 4, left: 0 }} barCategoryGap={12}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="label" width={150} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "var(--muted)" }} content={(props) => <BarTooltip {...props} format={format} />} />
          <Bar dataKey="value" name={valueLabel} fill="var(--brand)" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            <LabelList
              dataKey="value"
              position="right"
              offset={8}
              className="tabular"
              fill="var(--foreground)"
              fontSize={12}
              formatter={(v) => formatValue(Number(v ?? 0), format)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
