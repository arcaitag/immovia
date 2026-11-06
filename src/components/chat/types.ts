import type { LeadStatus, ListingStatus } from "@/lib/constants";
import { propertyImageUrl, publicStorageUrl } from "@/lib/storage";
import type { Database, Tables } from "@/types/database";
import { normalizeTimestamp } from "@/components/chat/utils";

/**
 * Gemeinsame Typen und Abbildungen für Nachrichten (Server und Browser).
 * Keine Server-Abhängigkeiten: wird auch von Client Components verwendet.
 */

export type ConversationRole = "seller" | "interested" | "team";

export interface ConversationListItem {
  id: string;
  listingId: string | null;
  listingTitle: string;
  listingSlug: string | null;
  listingStatus: ListingStatus | null;
  imageUrl: string | null;
  otherUserId: string | null;
  otherName: string;
  otherAvatarUrl: string | null;
  myRole: ConversationRole;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  isArchived: boolean;
  leadStatus: LeadStatus | null;
}

export type ConversationRpcRow = Database["public"]["Functions"]["get_my_conversations"]["Returns"][number];

export function toRole(value: string | null | undefined): ConversationRole {
  return value === "seller" || value === "interested" ? value : "team";
}

export function mapConversationRow(row: ConversationRpcRow): ConversationListItem | null {
  if (!row.conversation_id) return null;
  return {
    id: row.conversation_id,
    listingId: row.listing_id,
    listingTitle: row.listing_title?.trim() || "Konversation",
    listingSlug: row.listing_slug,
    listingStatus: row.listing_status,
    imageUrl: propertyImageUrl({ display_path: row.cover_path, external_url: row.cover_external_url }, "sm"),
    otherUserId: row.other_user_id,
    otherName: row.other_display_name?.trim() || "Immovia-Mitglied",
    otherAvatarUrl: publicStorageUrl("avatars", row.other_avatar_path),
    myRole: toRole(row.my_role),
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    unreadCount: Number(row.unread_count ?? 0),
    isArchived: Boolean(row.is_archived),
    leadStatus: row.lead_status,
  };
}

export function mapConversationRows(rows: ConversationRpcRow[] | null | undefined): ConversationListItem[] {
  return (rows ?? []).map(mapConversationRow).filter((item): item is ConversationListItem => item !== null);
}

/** Rolle der anderen Person aus Sicht des Benutzers. */
export function otherRoleLabel(myRole: ConversationRole): string {
  return myRole === "interested" ? "Verkäufer" : "Interessent";
}

export const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, kind, body, attachment_path, attachment_name, attachment_mime, attachment_size, created_at" as const;

type MessageRow = Pick<
  Tables<"messages">,
  | "id"
  | "conversation_id"
  | "sender_id"
  | "kind"
  | "body"
  | "attachment_path"
  | "attachment_name"
  | "attachment_mime"
  | "attachment_size"
  | "created_at"
>;

export interface ChatAttachment {
  name: string;
  mime: string;
  size: number | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  kind: "text" | "system";
  body: string;
  attachment: ChatAttachment | null;
  /** Einheitliches ISO-Format (Sortierung, Anzeige) */
  createdAt: string;
  /** Originalwert der Datenbank (Mikrosekunden) für Lesestatus und Nachladen */
  rawCreatedAt: string;
  /** Nur im Browser: optimistische Nachricht */
  pending?: "sending" | "failed";
  /** Nur im Browser: fehlgeschlagene Nachricht kann erneut gesendet werden */
  retryable?: boolean;
}

export function mapMessageRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    kind: row.kind === "system" ? "system" : "text",
    body: row.body,
    attachment: row.attachment_path
      ? { name: row.attachment_name ?? "Anhang", mime: row.attachment_mime ?? "application/octet-stream", size: row.attachment_size }
      : null,
    createdAt: normalizeTimestamp(row.created_at),
    rawCreatedAt: row.created_at,
  };
}

/** Sortiert chronologisch und entfernt Duplikate (Realtime, optimistisches UI, Nachladen). */
export function mergeMessages(...lists: ChatMessage[][]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const list of lists) {
    for (const message of list) {
      const existing = byId.get(message.id);
      // Bestätigte Nachricht ersetzt die optimistische
      if (!existing || (existing.pending && !message.pending) || (!existing.pending && !message.pending)) byId.set(message.id, message);
    }
  }
  return [...byId.values()].sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
}

export interface ChatPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ConversationView {
  id: string;
  title: string;
  listing: {
    id: string;
    title: string;
    slug: string | null;
    isPublic: boolean;
    imageUrl: string | null;
    publicAddress: string | null;
  } | null;
  myRole: ConversationRole;
  isSellerSide: boolean;
  other: ChatPerson | null;
  people: Record<string, ChatPerson>;
  lead: { id: string; status: LeadStatus; rating: number | null } | null;
  isArchived: boolean;
  isParticipant: boolean;
  myLastReadAt: string | null;
  otherLastReadAt: string | null;
  blockedByMe: boolean;
  canPost: boolean;
  messages: ChatMessage[];
  hasMore: boolean;
}

export const MESSAGE_PAGE_SIZE = 40;
