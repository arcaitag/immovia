import { fetch as expoFetch } from "expo/fetch";

import { CONFIG } from "@/lib/config";
import { ApiError, apiJson } from "@/lib/jobs";
import { supabase, type Tables } from "@/lib/supabase";

/**
 * Bilderstudio und KI-Assistent. Lesen läuft direkt gegen Supabase (RLS), Bildverarbeitung und
 * KI über den Server der Website (/api/mobile/studio/*, /api/assistant) mit Bearer-Anmeldung.
 */

// --- Bilderstudio: Daten -------------------------------------------------------

const IMAGE_COLUMNS =
  "id, property_id, display_path, base_path, external_url, is_enhanced, is_ai_visualization, is_floor_plan, is_cover, caption, source_image_id, status, sort_order, width, height" as const;

export type StudioImage = Pick<
  Tables<"property_images">,
  | "id"
  | "property_id"
  | "display_path"
  | "base_path"
  | "external_url"
  | "is_enhanced"
  | "is_ai_visualization"
  | "is_floor_plan"
  | "is_cover"
  | "caption"
  | "source_image_id"
  | "status"
  | "sort_order"
  | "width"
  | "height"
>;

/** Bilder eines Objekts fürs Bilderstudio, inkl. Designvorschlägen, die auf die Prüfung warten. */
export async function studioImages(propertyId: string): Promise<StudioImage[]> {
  const { data, error } = await supabase
    .from("property_images")
    .select(IMAGE_COLUMNS)
    .eq("property_id", propertyId)
    .in("status", ["ready", "review"])
    .order("sort_order", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export interface StudioImageDetail {
  image: StudioImage;
  /** Originalfoto eines Designvorschlags (für den Vorher-Nachher-Vergleich) */
  source: Pick<StudioImage, "id" | "display_path" | "external_url" | "width" | "height"> | null;
}

export async function studioImage(imageId: string): Promise<StudioImageDetail | null> {
  const { data: image, error } = await supabase.from("property_images").select(IMAGE_COLUMNS).eq("id", imageId).maybeSingle();
  if (error) throw error;
  if (!image) return null;
  if (!image.source_image_id) return { image, source: null };
  const { data: source } = await supabase
    .from("property_images")
    .select("id, display_path, external_url, width, height")
    .eq("id", image.source_image_id)
    .maybeSingle();
  return { image, source: source ?? null };
}

// --- Bilderstudio: Server ------------------------------------------------------

export interface Quota {
  used: number;
  limit: number;
  remaining: number;
  period: "day" | "month";
  resetsAt: string;
  unit: string;
}

export interface Availability {
  available: boolean;
  reason?: "not_configured" | "service_role_missing" | "feature_disabled" | "quota_exceeded";
  message?: string;
  quota?: Quota;
  consentRequired?: boolean;
}

export type DesignCapability = "declutter" | "virtual_staging";

export interface ImageConsentInfo {
  /** Anbieter des Bildmodells, z. B. «Google (USA)» */
  recipient: string;
  noRetention: boolean;
}

export interface StudioStatus {
  /** Ist ein Bild-KI-Anbieter eingerichtet? */
  configured: boolean;
  message: string;
  capabilities: string[];
  /** Automatische Optimierung (keine KI) */
  enhance: Availability;
  /** Designvorschläge der Bild-KI */
  design: Availability;
  consent: ImageConsentInfo;
  roomTypes: Record<string, string>;
  styles: Record<string, string>;
}

export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  warmth: number;
  sharpen: number;
  straighten: number;
  autoLevels: boolean;
  autoWhiteBalance: boolean;
}

export function studioStatus(): Promise<StudioStatus> {
  return apiJson<StudioStatus>("/api/mobile/studio/status");
}

/** «Automatisch optimieren»: Vorschlag aus der Bildstatistik (keine KI). */
export async function suggestAdjustments(imageId: string): Promise<Adjustments> {
  const res = await apiJson<{ adjustments: Adjustments }>("/api/mobile/studio/suggest", { body: { imageId } });
  return res.adjustments;
}

/** Vorschau der Optimierung als Data-URL (nicht gespeichert). */
export function previewAdjustments(imageId: string, adjustments: Adjustments): Promise<{ dataUrl: string; width: number; height: number }> {
  return apiJson("/api/mobile/studio/preview", { body: { imageId, adjustments } });
}

/** «Übernehmen»: optimierte Varianten speichern, das Original bleibt erhalten. */
export async function acceptEnhancement(imageId: string, adjustments: Adjustments): Promise<void> {
  await apiJson("/api/mobile/studio/accept", { body: { imageId, adjustments } });
}

export async function restoreOriginal(imageId: string): Promise<void> {
  await apiJson("/api/mobile/studio/restore", { body: { imageId } });
}

/** Auftrag an die Bild-KI; das Ergebnis des Auftrags enthält { imageId } des Vorschlags. */
export async function requestImageAi(input: { imageId: string; capability: DesignCapability; roomType?: string; style?: string }): Promise<string> {
  const res = await apiJson<{ jobId: string }>("/api/mobile/studio/ai", { body: input });
  return res.jobId;
}

/** «Freigeben»: geprüften Designvorschlag veröffentlichen. */
export async function confirmProposal(imageId: string): Promise<void> {
  await apiJson("/api/mobile/studio/confirm", { body: { imageId, confirmed: true } });
}

/** «Verwerfen»: Designvorschlag löschen; liefert die ID des Originalfotos. */
export async function discardProposal(imageId: string): Promise<string | null> {
  const res = await apiJson<{ sourceImageId: string | null }>("/api/mobile/studio/discard", { body: { imageId } });
  return res.sourceImageId;
}

// --- Einwilligungen ------------------------------------------------------------

/** Setzt die Einwilligung (nur nach ausdrücklicher Zustimmung im Einwilligungsdialog aufrufen). */
export async function grantAiConsent(kind: "text" | "image"): Promise<void> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) throw new ApiError("Bitte melden Sie sich an.", 401);
  const patch = kind === "image" ? { ai_image_consent: true } : { ai_processing_consent: true };
  const { data, error } = await supabase.from("user_preferences").update(patch).eq("user_id", userId).select("user_id").maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError("Ihre Einstellungen wurden nicht gefunden. Bitte melden Sie sich neu an.", 404);
}

// --- KI-Assistent --------------------------------------------------------------

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  error?: boolean;
}

export interface AssistantThread {
  threadId: string;
  propertyId: string | null;
  messages: AssistantMessage[];
}

/** Zuletzt geführtes Gespräch mit seinen Nachrichten (oder null). */
export async function latestAssistantThread(): Promise<AssistantThread | null> {
  const { data: thread, error } = await supabase
    .from("assistant_threads")
    .select("id, property_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!thread) return null;
  const { data: rows, error: messagesError } = await supabase
    .from("assistant_messages")
    .select("id, role, content")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (messagesError) throw messagesError;
  return {
    threadId: thread.id,
    propertyId: thread.property_id,
    messages: (rows ?? []).map((m) => ({ id: m.id, role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
  };
}

export interface AssistantReply {
  threadId: string | null;
  text: string;
}

/**
 * Fehler des Assistenten. accepted = der Server hat die Nachricht angenommen und im Gespräch
 * gespeichert (Fehler erst beim Erstellen der Antwort); threadId ist dann das Gespräch.
 */
export class AssistantError extends ApiError {
  readonly threadId: string | null;
  readonly accepted: boolean;
  constructor(message: string, status: number, consentRequired: boolean, threadId: string | null, accepted = false) {
    super(message, status, consentRequired);
    this.name = "AssistantError";
    this.threadId = threadId;
    this.accepted = accepted;
  }
}

type StreamEvent =
  | { type: "meta"; threadId: string; propertyId: string | null }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string | null }
  | { type: "error"; message: string; consentRequired?: boolean };

const ASSISTANT_FAILED = "Die Antwort konnte nicht erstellt werden. Bitte versuchen Sie es erneut.";

/**
 * Sendet eine Nachricht an den Assistenten (POST /api/assistant, NDJSON-Strom wie auf der Website).
 * expo/fetch liefert den Antwortstrom; onDelta erhält den bisherigen Antworttext. Steht kein
 * lesbarer Strom zur Verfügung, wird die ganze Antwort am Ende ausgewertet.
 */
export async function sendAssistantMessage(
  input: { threadId: string | null; propertyId?: string | null; message: string },
  options: { onDelta?: (text: string) => void; signal?: AbortSignal } = {},
): Promise<AssistantReply> {
  const { data: auth } = await supabase.auth.getSession();
  const token = auth.session?.access_token;
  if (!token) throw new AssistantError("Bitte melden Sie sich an.", 401, false, null);

  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(`${CONFIG.siteUrl}/api/assistant`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        ...(input.threadId ? { threadId: input.threadId } : {}),
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      }),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new AssistantError("Der Server ist nicht erreichbar. Bitte prüfen Sie Ihre Internetverbindung.", 0, false, input.threadId);
  }

  if (!response.ok) {
    const json = (await response.json().catch(() => null)) as { error?: string; consentRequired?: boolean } | null;
    throw new AssistantError(json?.error ?? ASSISTANT_FAILED, response.status, json?.consentRequired === true, input.threadId);
  }

  let threadId = input.threadId;
  let text = "";
  let finished = false;
  let failure: { message: string; consentRequired: boolean } | null = null;
  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let event: StreamEvent;
    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      return;
    }
    if (event.type === "meta") threadId = event.threadId;
    else if (event.type === "delta") {
      text += event.text;
      options.onDelta?.(text);
    } else if (event.type === "done") finished = true;
    else if (event.type === "error") failure = { message: event.message, consentRequired: event.consentRequired === true };
  };

  try {
    const reader = typeof TextDecoder !== "undefined" ? response.body?.getReader() : undefined;
    if (reader) {
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handleLine);
      }
      handleLine(buffer + decoder.decode());
    } else {
      (await response.text()).split("\n").forEach(handleLine);
    }
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new AssistantError("Die Verbindung wurde unterbrochen. Bitte versuchen Sie es erneut.", 0, false, threadId, true);
  }

  const failed = failure as { message: string; consentRequired: boolean } | null;
  if (failed) throw new AssistantError(failed.message, failed.consentRequired ? 403 : 502, failed.consentRequired, threadId, true);
  if (!finished || !text.trim()) throw new AssistantError(ASSISTANT_FAILED, 502, false, threadId, true);
  return { threadId, text };
}
