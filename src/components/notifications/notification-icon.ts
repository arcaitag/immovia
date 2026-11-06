import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  FileText,
  FolderLock,
  House,
  Inbox,
  MessageSquare,
  Search,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  new_message: MessageSquare,
  new_inquiry: Inbox,
  viewing_requested: CalendarClock,
  viewing_confirmed: CalendarCheck,
  viewing_cancelled: CalendarX,
  viewing_reschedule: CalendarClock,
  viewing_rescheduled: CalendarCheck,
  viewing_reminder: CalendarClock,
  document_shared: FolderLock,
  search_alert: Search,
  listing_published: House,
  listing_blocked: ShieldAlert,
  listing_rejected: ShieldAlert,
  dossier_ready: FileText,
};

/** Symbol je Benachrichtigungstyp (notifications.type). */
export function notificationIcon(type: string): LucideIcon {
  return ICONS[type] ?? Bell;
}
