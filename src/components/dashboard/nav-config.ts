import {
  Bot,
  Building2,
  CalendarCheck,
  ChartColumn,
  FileText,
  FolderLock,
  Gauge,
  Heart,
  House,
  HousePlus,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "messages" | "notifications";
  exact?: boolean;
}

export const DASHBOARD_NAV: { title?: string; items: DashboardNavItem[] }[] = [
  { items: [{ href: "/dashboard", label: "Übersicht", icon: LayoutDashboard, exact: true }] },
  {
    title: "Verkaufen",
    items: [
      { href: "/dashboard/immobilien", label: "Meine Immobilien", icon: House },
      { href: "/dashboard/immobilien/neu", label: "Neue Immobilie", icon: HousePlus, exact: true },
      { href: "/dashboard/bewertungen", label: "KI-Bewertung", icon: Gauge },
      { href: "/dashboard/dossiers", label: "Verkaufsdossiers", icon: FileText },
      { href: "/dashboard/bilderstudio", label: "Bilderstudio", icon: ImageIcon },
    ],
  },
  {
    title: "Kontakte",
    items: [
      { href: "/dashboard/nachrichten", label: "Nachrichten", icon: MessageSquare, badge: "messages" },
      { href: "/dashboard/interessenten", label: "Interessenten", icon: Users },
      { href: "/dashboard/besichtigungen", label: "Besichtigungen", icon: CalendarCheck },
      { href: "/dashboard/dokumente", label: "Dokumente", icon: FolderLock },
      { href: "/dashboard/statistiken", label: "Statistiken", icon: ChartColumn },
    ],
  },
  {
    title: "Suchen",
    items: [
      { href: "/dashboard/merkliste", label: "Merkliste", icon: Heart },
      { href: "/dashboard/suchauftraege", label: "Suchaufträge", icon: Search },
    ],
  },
  {
    title: "Konto",
    items: [
      { href: "/dashboard/assistent", label: "KI-Assistent", icon: Bot },
      { href: "/dashboard/profil", label: "Profil", icon: User },
      { href: "/dashboard/firma", label: "Firmenkonto", icon: Building2 },
      { href: "/dashboard/einstellungen", label: "Einstellungen", icon: Settings },
    ],
  },
];

/** Untere Tab-Leiste auf Smartphones */
export const MOBILE_TABS: DashboardNavItem[] = [
  { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/immobilien", label: "Immobilien", icon: House },
  { href: "/dashboard/nachrichten", label: "Nachrichten", icon: MessageSquare, badge: "messages" },
  { href: "/dashboard/besichtigungen", label: "Termine", icon: CalendarCheck },
];

export function isNavActive(pathname: string, item: Pick<DashboardNavItem, "href" | "exact">): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/dashboard/immobilien" && pathname === "/dashboard/immobilien/neu") return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
