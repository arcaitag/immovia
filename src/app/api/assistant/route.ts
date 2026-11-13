import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBearerSession } from "@/lib/auth/bearer";
import { getSessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAiConsentRequiredError } from "@/lib/ai/consent";
import { aiStreamText } from "@/lib/ai/service";
import { buildAssistantSystemPrompt } from "@/lib/ai/prompts/assistant";
import type { AiMessage } from "@/lib/ai/types";
import { truncate } from "@/lib/utils";
import { assertAvailable, enforceRateLimit, getFeatureAvailability, requireManagedProperty } from "@/services/ai/access";
import { loadAssistantContext } from "@/services/ai/assistant";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * KI-Assistent: nimmt eine Nachricht entgegen und streamt die Antwort als NDJSON
 * ({"type":"meta"|"delta"|"done"|"error", …} pro Zeile).
 * Anmeldung per Cookie (Website) oder «Authorization: Bearer» (mobile App).
 * Mit ?stream=0 kommt die ganze Antwort als JSON { threadId, propertyId, text, messageId } bzw.
 * { error, consentRequired? } – für Clients ohne lesbaren Antwortstrom (React Native). Ablauf,
 * Kontingent und Speicherung sind identisch.
 * Lesen mit dem Benutzer-Client (RLS), Schreiben der Nachrichten mit dem Service-Role-Client
 * erst nach der Besitzprüfung des Gesprächs.
 */

const bodySchema = z.object({
  threadId: z.guid().optional(),
  propertyId: z.guid().nullable().optional(),
  message: z.string().trim().min(1, "Bitte geben Sie eine Nachricht ein.").max(4000, "Die Nachricht ist zu lang (max. 4000 Zeichen)."),
});

const HISTORY_LIMIT = 20;

function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Fehlerantwort; fehlende KI-Einwilligung ist für die Oberfläche erkennbar (Einwilligungsdialog). */
function errorResponse(error: AppError) {
  if (isAiConsentRequiredError(error)) return jsonError(error.message, 403, { consentRequired: true });
  return jsonError(error.message, statusFor(error));
}

function statusFor(error: AppError): number {
  switch (error.code) {
    case "not_authenticated":
      return 401;
    case "forbidden":
    case "account_inactive":
      return 403;
    case "not_found":
      return 404;
    case "validation":
      return 400;
    case "rate_limited":
    case "quota_exceeded":
      return 429;
    default:
      return 503;
  }
}

export async function POST(request: NextRequest) {
  // Mobile App: Bearer-Token statt Cookie-Sitzung
  const bearer = request.headers.has("authorization") ? await getBearerSession(request) : null;
  const user = bearer?.user ?? (await getSessionUser());
  if (!user) return jsonError("Bitte melden Sie sich an.", 401);
  if (user.profile.status !== "active") return jsonError("Ihr Konto ist derzeit gesperrt.", 403);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage.", 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Ungültige Anfrage.", 400);
  const input = parsed.data;

  const supabase = bearer?.supabase ?? (await createClient());
  const wantsJson = request.nextUrl.searchParams.get("stream") === "0";
  let threadId: string;
  let propertyId: string | null;
  let history: AiMessage[] = [];
  try {
    assertAvailable(
      await getFeatureAvailability({
        supabase,
        userId: user.id,
        flag: "assistant",
        quotaFeature: "assistant",
        requiresAi: true,
        requiresConsent: true,
      }),
    );
    await enforceRateLimit(`assistant:${user.id}`, 12, 60);

    if (input.threadId) {
      const { data: thread } = await supabase
        .from("assistant_threads")
        .select("id, user_id, property_id, title")
        .eq("id", input.threadId)
        .maybeSingle();
      if (!thread || thread.user_id !== user.id) throw new AppError("not_found", "Das Gespräch wurde nicht gefunden.");
      threadId = thread.id;
      propertyId = thread.property_id;
      if (input.propertyId !== undefined && input.propertyId !== thread.property_id) {
        if (input.propertyId) await requireManagedProperty(supabase, user, input.propertyId);
        const { error } = await supabase.from("assistant_threads").update({ property_id: input.propertyId }).eq("id", thread.id);
        if (error) throw new AppError("forbidden");
        propertyId = input.propertyId;
      }
      const { data: messages } = await supabase
        .from("assistant_messages")
        .select("role, content")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      history = (messages ?? [])
        .reverse()
        .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content.slice(0, 8000) }));
      while (history[0]?.role === "assistant") history.shift();
    } else {
      propertyId = input.propertyId ?? null;
      if (propertyId) await requireManagedProperty(supabase, user, propertyId);
      // ID im Code erzeugen und ohne RETURNING einfügen (robust gegenüber RLS beim Zurücklesen)
      const newThreadId = randomUUID();
      const { error } = await supabase
        .from("assistant_threads")
        .insert({ id: newThreadId, title: truncate(input.message.replace(/\s+/g, " "), 80), property_id: propertyId });
      if (error) throw new AppError("unknown", "Das Gespräch konnte nicht angelegt werden.");
      threadId = newThreadId;
    }
  } catch (error) {
    if (error instanceof AppError) return errorResponse(error);
    console.error("[assistant] Vorbereitung fehlgeschlagen", error);
    return jsonError("Der Assistent ist im Moment nicht verfügbar.", 500);
  }

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("assistant_messages").insert({ thread_id: threadId, role: "user", content: input.message });
  if (insertError) return jsonError("Die Nachricht konnte nicht gespeichert werden.", 500);

  const context = propertyId ? await loadAssistantContext(supabase, user, propertyId) : null;
  const system = buildAssistantSystemPrompt(context);
  const messages: AiMessage[] = [...history, { role: "user", content: input.message }];

  type Outcome = { ok: true; messageId: string | null; text: string } | { ok: false; message: string; consentRequired: boolean } | null;

  /** Erzeugt die Antwort, meldet den Verlauf als Ereignisse (meta, delta, done | error) und gibt das Ergebnis zurück. */
  const run = async (send: (event: Record<string, unknown>) => void): Promise<Outcome> => {
    send({ type: "meta", threadId, propertyId });
    let text = "";
    try {
      const ai = await aiStreamText(
        { feature: "assistant", userId: user.id },
        { system, prompt: messages, maxTokens: 4000, effort: "medium", signal: request.signal },
      );
      for await (const delta of ai.textStream) {
        text += delta;
        send({ type: "delta", text: delta });
      }
      const final = await ai.final;
      const content = (final.text || text).trim().slice(0, 20000);
      if (!content) throw new Error("Leere Antwort");
      const { data: saved } = await admin
        .from("assistant_messages")
        .insert({ thread_id: threadId, role: "assistant", content })
        .select("id")
        .single();
      await supabase.from("assistant_threads").update({ property_id: propertyId }).eq("id", threadId);
      send({ type: "done", messageId: saved?.id ?? null });
      return { ok: true, messageId: saved?.id ?? null, text: content };
    } catch (error) {
      // Verbindung vom Benutzer beendet: nichts mehr melden
      if (request.signal.aborted) return null;
      const message =
        error instanceof AppError || (error instanceof Error && /KI|Dienst/.test(error.message))
          ? error.message
          : "Die Antwort konnte nicht erstellt werden. Bitte versuchen Sie es erneut.";
      if (isAiConsentRequiredError(error)) {
        send({ type: "error", message, consentRequired: true });
        return { ok: false, message, consentRequired: true };
      }
      console.error("[assistant] Antwort fehlgeschlagen", error);
      send({ type: "error", message });
      return { ok: false, message, consentRequired: false };
    }
  };

  if (wantsJson) {
    const outcome = await run(() => undefined);
    if (outcome?.ok) {
      return NextResponse.json(
        { threadId, propertyId, text: outcome.text, messageId: outcome.messageId },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (outcome?.consentRequired) return jsonError(outcome.message, 403, { consentRequired: true, threadId });
    return jsonError(outcome?.message ?? "Die Antwort konnte nicht erstellt werden. Bitte versuchen Sie es erneut.", 502, { threadId });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await run((event) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Verbindung bereits geschlossen (Benutzer hat die Seite verlassen)
        }
      });
      try {
        controller.close();
      } catch {
        // bereits geschlossen
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
