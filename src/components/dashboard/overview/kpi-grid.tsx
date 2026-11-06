import Link from "next/link";
import { CalendarCheck, Eye, Heart, House, Inbox, type LucideIcon } from "lucide-react";
import type { OwnerOverview } from "@/services/listings";
import { formatNumber } from "@/lib/format";

interface Kpi {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  href: string;
}

/** Kennzahlen aus get_owner_overview (nur echte Ereignisse). */
export function KpiGrid({ overview }: { overview: OwnerOverview }) {
  const kpis: Kpi[] = [
    {
      label: "Aktive Inserate",
      value: overview.active_listings,
      hint: overview.draft_listings ? `${formatNumber(overview.draft_listings)} in Vorbereitung` : "Veröffentlicht oder reserviert",
      icon: House,
      href: "/dashboard/immobilien?status=online",
    },
    {
      label: "Aufrufe gesamt",
      value: overview.total_views,
      hint: `${formatNumber(overview.views_last_7_days)} in den letzten 7 Tagen`,
      icon: Eye,
      href: "/dashboard/statistiken",
    },
    {
      label: "Neue Anfragen",
      value: overview.new_leads,
      hint: "Noch nicht bearbeitet",
      icon: Inbox,
      href: "/dashboard/interessenten",
    },
    {
      label: "Offene Besichtigungen",
      value: overview.open_viewings,
      hint: overview.pending_viewing_requests
        ? `${formatNumber(overview.pending_viewing_requests)} warten auf Bestätigung`
        : "Bevorstehende Termine",
      icon: CalendarCheck,
      href: "/dashboard/besichtigungen",
    },
    {
      label: "Gespeicherte Immobilien",
      value: overview.my_favorites,
      hint: "Auf Ihrer Merkliste",
      icon: Heart,
      href: "/dashboard/merkliste",
    },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {kpis.map((kpi, index) => (
        <li key={kpi.label} className={index === kpis.length - 1 ? "col-span-2 lg:col-span-1" : undefined}>
          <Link
            href={kpi.href}
            className="group flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-5"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">{kpi.label}</span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-forest">
                <kpi.icon className="size-[18px]" aria-hidden />
              </span>
            </span>
            <span className="mt-2 font-display text-[1.75rem] font-extrabold leading-none tracking-tight">{formatNumber(kpi.value)}</span>
            <span className="mt-2 text-xs text-muted-foreground">{kpi.hint}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
