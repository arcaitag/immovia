import {
  Building2,
  ChartLine,
  Flag,
  House,
  Inbox,
  LayoutDashboard,
  ScrollText,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Nur für Administratoren (nicht für Moderatoren) */
  adminOnly?: boolean;
  badge?: "reports" | "review";
}

export const ADMIN_NAV: { title?: string; items: AdminNavItem[] }[] = [
  { items: [{ href: "/admin", label: "Übersicht", icon: LayoutDashboard, exact: true }] },
  {
    title: "Verwaltung",
    items: [
      { href: "/admin/benutzer", label: "Benutzer", icon: Users },
      { href: "/admin/immobilien", label: "Inserate", icon: House, badge: "review" },
      { href: "/admin/firmen", label: "Firmen", icon: Building2 },
    ],
  },
  {
    title: "Moderation",
    items: [
      { href: "/admin/meldungen", label: "Meldungen", icon: Flag, badge: "reports" },
      { href: "/admin/kontakt", label: "Kontaktanfragen", icon: Inbox },
    ],
  },
  {
    title: "Auswertung",
    items: [
      { href: "/admin/ki-nutzung", label: "KI-Nutzung", icon: Sparkles, adminOnly: true },
      { href: "/admin/statistiken", label: "Statistiken", icon: ChartLine },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/einstellungen", label: "Einstellungen", icon: Settings, adminOnly: true },
      { href: "/admin/protokoll", label: "Protokoll", icon: ScrollText, adminOnly: true },
    ],
  },
];

export function isAdminNavActive(pathname: string, item: Pick<AdminNavItem, "href" | "exact">): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
