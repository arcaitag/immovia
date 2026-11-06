import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AppError, fromDbError, validationError } from "@/lib/errors";
import { propertyImageUrl, publicStorageUrl } from "@/lib/storage";
import {
  MESSAGE_COLUMNS,
  MESSAGE_PAGE_SIZE,
  mapConversationRows,
  mapMessageRow,
  toRole,
  type ChatMessage,
  type ChatPerson,
  type ConversationListItem,
  type ConversationView,
} from "@/components/chat/types";
import {
  archiveConversationSchema,
  attachmentOnlyBody,
  blockUserSchema,
  reportSchema,
  sendMessageSchema,
  type ReportInput,
  type SendMessageInput,
} from "@/lib/validation/message";
import { sanitizeFileName } from "@/lib/validation/document";

/**
 * Nachrichten: Konversationen, Chat, Anhänge, Archiv, Blockieren und Melden.
 * Alle Zugriffe mit dem Benutzer-Client (RLS: is_conversation_participant / can_post_in_conversation).
 */

const PUBLIC_STATUSES = new Set(["published", "reserved"]);

export async function listConversations(archived = false): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_conversations", { p_archived: archived });
  if (error) throw fromDbError(error);
  return mapConversationRows(data);
}

export async function getConversationView(conversationId: string, userId: string): Promise<ConversationView | null> {
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, listing_id, seller_id, interested_id, organization_id, subject")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return null;

  const [participantsRes, listingRes, messagesRes, leadRes, canPostRes, blocksRes] = await Promise.all([
    supabase.from("conversation_participants").select("user_id, role, last_read_at, archived_at").eq("conversation_id", conversationId),
    conversation.listing_id
      ? supabase
          .from("listings")
          .select("id, title, slug, status, property_id, public_address, moderation_status, deleted_at")
          .eq("id", conversation.listing_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE + 1),
    supabase.from("leads").select("id, status, rating").eq("conversation_id", conversationId).limit(1).maybeSingle(),
    supabase.rpc("can_post_in_conversation", { p_conversation: conversationId }),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId),
  ]);

  const participants = participantsRes.data ?? [];
  const me = participants.find((p) => p.user_id === userId) ?? null;
  const myRole = toRole(me?.role);
  const isSellerSide = myRole !== "interested";
  const otherParticipant =
    participants.find((p) => p.user_id !== userId && (isSellerSide ? p.role === "interested" : p.role === "seller")) ??
    participants.find((p) => p.user_id !== userId) ??
    null;

  const rows = messagesRes.data ?? [];
  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  const messages = rows.slice(0, MESSAGE_PAGE_SIZE).reverse().map(mapMessageRow);

  const personIds = [...new Set([...participants.map((p) => p.user_id), ...messages.map((m) => m.senderId)].filter((id): id is string => Boolean(id)))];
  const { data: profiles } = personIds.length
    ? await supabase.from("public_profiles").select("id, display_name, avatar_path").in("id", personIds)
    : { data: [] };
  const people: Record<string, ChatPerson> = {};
  for (const profile of profiles ?? []) {
    people[profile.id] = { id: profile.id, name: profile.display_name, avatarUrl: publicStorageUrl("avatars", profile.avatar_path) };
  }

  const listing = listingRes.data;
  let imageUrl: string | null = null;
  if (listing?.property_id) {
    const { data: cover } = await supabase
      .from("property_images")
      .select("display_path, external_url")
      .eq("property_id", listing.property_id)
      .eq("status", "ready")
      .eq("is_floor_plan", false)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    imageUrl = propertyImageUrl(cover, "sm");
  }
  const isPublic = Boolean(listing && PUBLIC_STATUSES.has(listing.status) && listing.moderation_status !== "blocked" && !listing.deleted_at);
  const title = listing?.title?.trim() || conversation.subject?.trim() || "Konversation";
  const blocked = new Set((blocksRes.data ?? []).map((b) => b.blocked_id));
  const otherId = otherParticipant?.user_id ?? null;

  return {
    id: conversation.id,
    title,
    listing: listing
      ? {
          id: listing.id,
          title,
          slug: listing.slug,
          isPublic,
          imageUrl,
          publicAddress: listing.public_address,
        }
      : null,
    myRole,
    isSellerSide,
    other: otherId ? (people[otherId] ?? { id: otherId, name: "Immovia-Mitglied", avatarUrl: null }) : null,
    people,
    lead: isSellerSide && leadRes.data ? { id: leadRes.data.id, status: leadRes.data.status, rating: leadRes.data.rating } : null,
    isArchived: Boolean(me?.archived_at),
    isParticipant: Boolean(me),
    myLastReadAt: me?.last_read_at ?? null,
    otherLastReadAt: otherParticipant?.last_read_at ?? null,
    blockedByMe: otherId ? blocked.has(otherId) : false,
    canPost: canPostRes.data === true,
    messages,
    hasMore,
  };
}

export async function sendMessage(input: SendMessageInput): Promise<ChatMessage> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const { id, conversationId, attachment } = parsed.data;
  const supabase = await createClient();

  let attachmentSize = attachment?.size ?? null;
  if (attachment) {
    const { data: info, error: infoError } = await supabase.storage.from("message-attachments").info(attachment.path);
    if (infoError || !info) {
      throw new AppError("validation", "Der Anhang wurde nicht gefunden. Bitte laden Sie ihn erneut hoch.");
    }
    if (typeof info.size === "number" && info.size > 0) attachmentSize = info.size;
  }

  const body = parsed.data.body.trim() || attachmentOnlyBody(attachment?.name ?? "Datei");
  const { data, error } = await supabase
    .from("messages")
    .insert({
      id,
      conversation_id: conversationId,
      body,
      attachment_path: attachment?.path ?? null,
      attachment_name: attachment ? sanitizeFileName(attachment.name) : null,
      attachment_mime: attachment?.mime ?? null,
      attachment_size: attachmentSize,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") {
      // Erneuter Versuch derselben Nachricht (z. B. nach Verbindungsabbruch): bestehende zurückgeben
      const { data: existing } = await supabase.from("messages").select(MESSAGE_COLUMNS).eq("id", id).maybeSingle();
      if (existing) return mapMessageRow(existing);
    }
    const appError = fromDbError(error);
    if (appError.code === "forbidden") {
      throw new AppError("forbidden", "Sie können in dieser Konversation keine Nachrichten senden. Möglicherweise wurde der Kontakt blockiert.");
    }
    throw appError;
  }
  return mapMessageRow(data);
}

export async function setConversationArchived(input: { conversationId: string; archived: boolean }, userId: string): Promise<void> {
  const parsed = archiveConversationSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversation_participants")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("conversation_id", parsed.data.conversationId)
    .eq("user_id", userId)
    .select("conversation_id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new AppError("invalid_state", "Nur direkt beteiligte Personen können eine Konversation archivieren.");
}

export async function setUserBlocked(input: { userId: string; blocked: boolean }, currentUserId: string): Promise<void> {
  const parsed = blockUserSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  if (parsed.data.userId === currentUserId) throw new AppError("validation", "Sie können sich nicht selbst blockieren.");
  const supabase = await createClient();
  if (parsed.data.blocked) {
    const { error } = await supabase.from("user_blocks").insert({ blocked_id: parsed.data.userId });
    if (error && error.code !== "23505") throw fromDbError(error);
  } else {
    const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", currentUserId).eq("blocked_id", parsed.data.userId);
    if (error) throw fromDbError(error);
  }
}

export async function reportContent(input: ReportInput): Promise<void> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.flatten().fieldErrors);
  const supabase = await createClient();
  // Nur Inhalte melden, die man selbst sehen kann
  const visible =
    parsed.data.targetType === "message"
      ? await supabase.from("messages").select("id").eq("id", parsed.data.targetId).maybeSingle()
      : await supabase.from("conversations").select("id").eq("id", parsed.data.targetId).maybeSingle();
  if (!visible.data) throw new AppError("not_found");
  const { error } = await supabase.from("user_reports").insert({
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details?.trim() || null,
  });
  if (error) {
    if (error.code === "23505") throw new AppError("conflict", "Sie haben diesen Inhalt bereits gemeldet. Unser Team prüft die Meldung.");
    throw fromDbError(error);
  }
}

/** Kurzlebiger Link (60 s) für einen Nachrichtenanhang. null, wenn kein Zugriff. */
export async function getAttachmentUrl(messageId: string, options: { inline: boolean }): Promise<string | null> {
  const supabase = await createClient();
  const { data: message } = await supabase
    .from("messages")
    .select("attachment_path, attachment_name")
    .eq("id", messageId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!message?.attachment_path) return null;
  const { data, error } = await supabase.storage
    .from("message-attachments")
    .createSignedUrl(message.attachment_path, 60, options.inline ? undefined : { download: sanitizeFileName(message.attachment_name ?? "Anhang") });
  if (error || !data) return null;
  return data.signedUrl;
}
