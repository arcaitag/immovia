import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Coins, Image as ImageIcon, TriangleAlert, Type, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { DailyChart, RankedBars } from "@/components/admin/charts";
import { PeriodNav, ValuesTable } from "@/components/admin/admin-ui";
import { formatCompact, formatDelta, formatUsdEstimate } from "@/components/admin/admin-format";
import { requireAdmin } from "@/lib/auth/session";
import { getServiceStatus } from "@/lib/env";
import { formatDate, formatNumber } from "@/lib/format";
import { aiFeatureLabel, parseDaysParam, type SearchParamValue } from "@/lib/validation/admin";
import { getAiUsageSummary } from "@/services/admin";

export const metadata: Metadata = { title: "KI-Nutzung" };

export default async function AdminAiUsagePage({ searchParams }: { searchParams: Promise<Record<string, SearchParamValue>> }) {
  await requireAdmin();
  const params = await searchParams;
  const days = parseDaysParam(params.tage);
  const usage = await getAiUsageSummary(days);
  const aiConfigured = getServiceStatus().find((s) => s.key === "ai_text")?.configured ?? false;
  const { totals } = usage;
  const failureRate = totals.events > 0 ? Math.round((totals.failed / totals.events) * 100) : 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="KI-Nutzung"
        description="Aufrufe, Tokens und geschätzte Kosten der KI-Funktionen. Grundlage sind die bei jedem Aufruf erfassten Werte."
        actions={<PeriodNav basePath="/admin/ki-nutzung" days={days} />}
      />

      {!aiConfigured ? (
        <Alert tone="info" title="Kein KI-Anbieter konfiguriert">
          Ohne ANTHROPIC_API_KEY sind die KI-Texte nicht verfügbar. Bildkorrekturen ohne externe KI werden trotzdem erfasst.
        </Alert>
      ) : null}

      <section aria-label="Kennzahlen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Aufrufe"
          value={formatNumber(totals.events)}
          icon={Activity}
          hint={formatDelta(totals.events, usage.previous.events) ?? "Keine Aufrufe im Zeitraum"}
        />
        <StatCard
          label="Geschätzte Kosten"
          value={formatUsdEstimate(totals.costUsd)}
          icon={Coins}
          hint={formatDelta(totals.costUsd, usage.previous.costUsd) ?? "Schätzung, keine Abrechnung"}
        />
        <StatCard
          label="Tokens"
          value={formatCompact(totals.inputTokens + totals.outputTokens)}
          icon={Type}
          hint={`${formatCompact(totals.inputTokens)} Eingabe · ${formatCompact(totals.outputTokens)} Ausgabe`}
        />
        <StatCard label="Bilder" value={formatNumber(totals.images)} icon={ImageIcon} hint="Verarbeitete Bilder" />
        <StatCard label="Fehlerquote" value={`${formatNumber(failureRate)} %`} icon={TriangleAlert} hint={`${formatNumber(totals.failed)} fehlgeschlagene Aufrufe`} />
        <StatCard label="Benutzer" value={formatNumber(totals.users)} icon={Users} hint="Mit mindestens einem Aufruf" />
      </section>

      {totals.events === 0 ? (
        <EmptyState
          icon={Activity}
          title="Keine KI-Aufrufe im gewählten Zeitraum"
          description="Sobald KI-Funktionen genutzt werden, erscheinen hier Aufrufe, Tokens und Kostenschätzungen."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Aufrufe pro Tag</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <DailyChart data={usage.byDay.map((d) => ({ date: d.date, value: d.events }))} valueLabel="Aufrufe" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Geschätzte Kosten pro Tag</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <DailyChart data={usage.byDay.map((d) => ({ date: d.date, value: d.costUsd }))} valueLabel="Kosten (USD, geschätzt)" format="usd" />
              </CardContent>
            </Card>
          </div>
          <ValuesTable
            caption="KI-Nutzung pro Tag"
            columns={["Datum", "Aufrufe", "Kosten (USD, geschätzt)"]}
            rows={usage.byDay.map((d) => [formatDate(d.date), formatNumber(d.events), formatUsdEstimate(d.costUsd)])}
          />

          <Card>
            <CardHeader>
              <CardTitle>Nach Funktion</CardTitle>
              <CardDescription>Geschätzte Kosten je KI-Funktion im gewählten Zeitraum.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <RankedBars
                valueLabel="Geschätzte Kosten nach Funktion"
                format="usd"
                data={usage.byFeature.map((f) => ({
                  label: aiFeatureLabel(f.feature),
                  value: f.costUsd,
                  hint: `${formatNumber(f.events)} Aufrufe`,
                }))}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 text-left font-semibold">Funktion</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Aufrufe</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Fehler</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Tokens</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Bilder</th>
                      <th scope="col" className="py-2 pl-4 text-right font-semibold">Kosten (geschätzt)</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {usage.byFeature.map((f) => (
                      <tr key={f.feature} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-4 text-left font-medium">{aiFeatureLabel(f.feature)}</th>
                        <td className="px-4 py-2 text-right">{formatNumber(f.events)}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(f.failed)}</td>
                        <td className="px-4 py-2 text-right">{formatCompact(f.inputTokens + f.outputTokens)}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(f.images)}</td>
                        <td className="py-2 pl-4 text-right">{formatUsdEstimate(f.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Nach Modell</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 text-left font-semibold">Anbieter / Modell</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Aufrufe</th>
                      <th scope="col" className="py-2 pl-4 text-right font-semibold">Kosten</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {usage.byModel.map((m) => (
                      <tr key={`${m.provider}-${m.model}`} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-4 text-left font-medium">
                          {m.provider}
                          <span className="block break-all text-xs font-normal text-muted-foreground">{m.model || "ohne Modell"}</span>
                        </th>
                        <td className="px-4 py-2 text-right">{formatNumber(m.events)}</td>
                        <td className="py-2 pl-4 text-right">{formatUsdEstimate(m.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Benutzer mit den höchsten Kosten</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 text-left font-semibold">Benutzer</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Aufrufe</th>
                      <th scope="col" className="py-2 pl-4 text-right font-semibold">Kosten</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {usage.topUsers.map((u) => (
                      <tr key={u.userId} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-4 text-left font-medium">
                          <Link href={`/admin/benutzer/${u.userId}`} className="hover:text-forest">
                            {u.displayName ?? "Gelöschtes Konto"}
                          </Link>
                          <span className="block truncate text-xs font-normal text-muted-foreground">{u.email ?? ""}</span>
                        </th>
                        <td className="px-4 py-2 text-right">{formatNumber(u.events)}</td>
                        <td className="py-2 pl-4 text-right">{formatUsdEstimate(u.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Alle Kosten sind Schätzungen auf Basis der bei jedem Aufruf erfassten Tokens und hinterlegten Preise. Massgebend ist die
        Abrechnung des jeweiligen Anbieters. Zeitraum: {usage.from ? formatDate(usage.from) : "–"} bis {usage.to ? formatDate(usage.to) : "–"}.
      </p>
    </div>
  );
}
