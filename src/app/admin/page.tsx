import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  Building2,
  ClipboardCheck,
  Coins,
  FileText,
  Flag,
  Gauge,
  HardDrive,
  House,
  Image as ImageIcon,
  MessageSquare,
  UserX,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { SystemStatusList } from "@/components/admin/system-status";
import { formatUsdEstimate } from "@/components/admin/admin-format";
import { requireModerator } from "@/lib/auth/session";
import { getServiceStatus } from "@/lib/env";
import { formatFileSize, formatNumber, formatRelative } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/constants";
import { REPORT_STATUS, REPORT_TARGET_TYPES } from "@/lib/validation/admin";
import { getOpenReports, getPlatformStats, getReviewQueue } from "@/services/admin";

export const metadata: Metadata = { title: "Übersicht" };

export default async function AdminOverviewPage() {
  await requireModerator();
  const [stats, queue, reports] = await Promise.all([getPlatformStats(), getReviewQueue(5), getOpenReports(5)]);
  const services = getServiceStatus();

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Übersicht"
        description="Die Plattform auf einen Blick. Alle Zahlen stammen direkt aus der Datenbank; Demo-Inserate sind bei Inseraten und Immobilien nicht mitgezählt."
      />

      <section aria-label="Kennzahlen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Registrierte Benutzer"
          value={formatNumber(stats.users_total)}
          icon={Users}
          hint={`${formatNumber(stats.users_new_7d)} neu in 7 Tagen · ${formatNumber(stats.users_active_30d)} aktiv in 30 Tagen`}
        />
        <StatCard
          label="Aktive Inserate"
          value={formatNumber(stats.listings_active)}
          icon={House}
          hint={`${formatNumber(stats.listings_new_7d)} neu veröffentlicht in 7 Tagen`}
        />
        <StatCard
          label="Anfragen (7 Tage)"
          value={formatNumber(stats.inquiries_7d)}
          icon={MessageSquare}
          hint={`${formatNumber(stats.inquiries_total)} insgesamt`}
        />
        <StatCard label="Immobilien" value={formatNumber(stats.properties)} icon={Building2} hint={`${formatNumber(stats.organizations)} Firmenkonten`} />
        <StatCard label="Bewertungen" value={formatNumber(stats.valuations_total)} icon={Gauge} hint="Durchgeführt, insgesamt" />
        <StatCard label="Verkaufsdossiers" value={formatNumber(stats.dossiers_total)} icon={FileText} hint="Erstellt, insgesamt" />
        <StatCard label="KI-Bildbearbeitungen" value={formatNumber(stats.image_ai_total)} icon={ImageIcon} hint="Erfolgreich, insgesamt" />
        <StatCard
          label="KI-Kosten (30 Tage)"
          value={formatUsdEstimate(stats.ai_cost_usd_30d)}
          icon={Coins}
          hint="Schätzung aus erfassten Aufrufen"
        />
      </section>

      <section aria-label="Handlungsbedarf" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AttentionTile href="/admin/immobilien?status=pending_review" icon={ClipboardCheck} label="Zur Prüfung eingereicht" value={stats.listings_pending_review} />
        <AttentionTile href="/admin/meldungen" icon={Flag} label="Offene Meldungen" value={stats.reports_open} />
        <AttentionTile href="/admin/benutzer?status=suspended" icon={UserX} label="Gesperrte Benutzer" value={stats.users_suspended} neutral />
        <AttentionTile href="/admin/immobilien?moderation=blocked" icon={Ban} label="Gesperrte Inserate" value={stats.listings_blocked} neutral />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Prüfwarteschlange</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/immobilien?status=pending_review">
                Alle <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Keine Inserate warten auf eine Prüfung.</p>
            ) : (
              <ul className="divide-y divide-border">
                {queue.map((listing) => (
                  <li key={listing.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{listing.title ?? "Ohne Titel"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {listing.owner.displayName} · {listing.location || "Ort fehlt"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(listing.statusChangedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Offene Meldungen</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/meldungen">
                Alle <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">Keine offenen Meldungen.</p>
            ) : (
              <ul className="divide-y divide-border">
                {reports.map((report) => (
                  <li key={report.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {(REPORT_REASONS as Record<string, string>)[report.reason] ?? report.reason}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {REPORT_TARGET_TYPES[report.targetType] ?? report.targetType} · {formatRelative(report.createdAt)}
                      </p>
                    </div>
                    <StatusBadge label={REPORT_STATUS[report.status].label} tone={REPORT_STATUS[report.status].tone} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Systemstatus</CardTitle>
          </CardHeader>
          <CardContent>
            <SystemStatusList services={services} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Betrieb</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <OpsRow label="Hintergrundaufträge in Arbeit" value={stats.jobs_pending} />
              <OpsRow label="Fehlgeschlagene Aufträge (7 Tage)" value={stats.jobs_failed_7d} warn />
              <OpsRow label="E-Mails in der Warteschlange" value={stats.emails_pending} />
              <OpsRow label="Fehlgeschlagene E-Mails (7 Tage)" value={stats.emails_failed_7d} warn />
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <HardDrive className="size-4" aria-hidden /> Speicherverbrauch (Dateien)
                </dt>
                <dd className="font-semibold tabular">{formatFileSize(stats.storage_bytes)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AttentionTile({
  href,
  icon: Icon,
  label,
  value,
  neutral,
}: {
  href: string;
  icon: typeof Flag;
  label: string;
  value: number;
  neutral?: boolean;
}) {
  const active = value > 0 && !neutral;
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <span
        className={
          active
            ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-bg text-warning"
            : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
        }
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="block font-display text-xl font-extrabold">{formatNumber(value)}</span>
      </span>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function OpsRow({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 font-semibold tabular">
        {warn && value > 0 ? <Badge tone="amber">Prüfen</Badge> : null}
        {formatNumber(value)}
      </dd>
    </div>
  );
}
