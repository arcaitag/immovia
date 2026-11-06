"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot, CircleStop, SendHorizontal, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { AiUnavailableNotice, QuotaHint, type AvailabilityView } from "@/components/ai/ai-notice";
import { AiConsentDialog, useAiConsent } from "@/components/ai/consent-dialog";
import { ChatMarkdown } from "@/components/assistant/chat-markdown";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  error?: boolean;
}

type StreamEvent =
  | { type: "meta"; threadId: string; propertyId: string | null }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string | null }
  | { type: "error"; message: string; consentRequired?: boolean };

/**
 * Chat mit dem KI-Assistenten. Antworten werden gestreamt (NDJSON von POST /api/assistant)
 * und als Markdown dargestellt. Optional mit dem Kontext eines eigenen Objekts.
 */
export function AssistantChat({
  threadId: initialThreadId,
  initialMessages,
  properties,
  initialPropertyId,
  availability,
  examples,
}: {
  threadId: string | null;
  initialMessages: ChatMessage[];
  properties: { id: string; label: string }[];
  initialPropertyId: string | null;
  availability: AvailabilityView;
  examples: readonly string[];
}) {
  const router = useRouter();
  const consent = useAiConsent(Boolean(availability.consentRequired));
  const [threadId, setThreadId] = React.useState(initialThreadId);
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [propertyId, setPropertyId] = React.useState(initialPropertyId ?? "");
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const blocked = !availability.available;

  function updateAnswer(id: string, update: (message: ChatMessage) => ChatMessage) {
    setMessages((current) => current.map((m) => (m.id === id ? update(m) : m)));
  }

  async function stream(message: string) {
    const stamp = Date.now();
    const userId = `local-user-${stamp}`;
    const answerId = `local-answer-${stamp}`;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: message },
      { id: answerId, role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: threadId ?? undefined, propertyId: propertyId || null, message }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string; consentRequired?: boolean } | null;
        setMessages((current) => current.filter((m) => m.id !== userId && m.id !== answerId));
        setInput(message);
        if (body?.consentRequired) consent.requestConsent(() => void stream(message));
        else toast.error(body?.error ?? "Der Assistent ist im Moment nicht verfügbar.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handle = (event: StreamEvent) => {
        if (event.type === "meta") {
          if (!threadId && event.threadId) {
            setThreadId(event.threadId);
            // URL ohne Neuladen anpassen (Next.js übernimmt replaceState in den Router)
            window.history.replaceState(null, "", `/dashboard/assistent/${event.threadId}`);
          }
        } else if (event.type === "delta") {
          updateAnswer(answerId, (m) => ({ ...m, content: m.content + event.text }));
        } else if (event.type === "done") {
          updateAnswer(answerId, (m) => ({ ...m, pending: false }));
        } else if (event.type === "error") {
          updateAnswer(answerId, (m) => ({ ...m, pending: false, error: true, content: m.content ? `${m.content}\n\n_${event.message}_` : event.message }));
        }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line) {
            try {
              handle(JSON.parse(line) as StreamEvent);
            } catch {
              // unvollständige oder fremde Zeile ignorieren
            }
          }
          newline = buffer.indexOf("\n");
        }
      }
      updateAnswer(answerId, (m) => (m.pending ? { ...m, pending: false } : m));
    } catch {
      if (controller.signal.aborted) {
        updateAnswer(answerId, (m) => ({ ...m, pending: false, content: m.content ? `${m.content}\n\n_(abgebrochen)_` : "_(abgebrochen)_" }));
      } else {
        updateAnswer(answerId, (m) => ({ ...m, pending: false, error: true, content: m.content || "Die Verbindung wurde unterbrochen. Bitte versuchen Sie es erneut." }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Verlauf in der Seitenleiste und verbleibendes Kontingent aktualisieren
      router.refresh();
    }
  }

  function send(text: string) {
    const message = text.trim();
    if (!message || streaming || blocked) return;
    if (message.length > 4000) {
      toast.error("Die Nachricht ist zu lang (max. 4000 Zeichen).");
      return;
    }
    consent.guard(() => void stream(message));
  }

  const selectedLabel = properties.find((p) => p.id === propertyId)?.label;

  return (
    <div className="grid min-h-[60dvh] grid-rows-[auto_1fr_auto] gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="assistant-property">Bezug zu einer Immobilie (optional)</Label>
          <NativeSelect id="assistant-property" value={propertyId} onChange={(event) => setPropertyId(event.target.value)} disabled={streaming}>
            <option value="">Ohne Immobilie</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <p className="text-xs text-muted-foreground sm:max-w-xs">
          {selectedLabel
            ? "Der Assistent kennt die erfassten Angaben, den Inseratsstatus und was noch fehlt – ohne Adresse und Kontaktdaten."
            : "Wählen Sie eine Immobilie, damit der Assistent Ihre Angaben berücksichtigen kann."}
        </p>
      </div>

      <div className="grid content-start gap-4" aria-live="polite" aria-busy={streaming}>
        {messages.length === 0 ? (
          <div className="grid gap-4 rounded-2xl border border-dashed border-border bg-surface p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-mint-100 text-forest">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold">Wie kann ich helfen?</p>
                <p className="text-sm text-muted-foreground">Fragen Sie zu Präsentation, Unterlagen, Texten oder Besichtigungen.</p>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => send(example)}
                    disabled={streaming || blocked}
                    className="min-h-11 rounded-full border border-border bg-card px-4 py-2 text-left text-sm font-medium transition-colors hover:border-mint-300 hover:bg-mint-50 disabled:opacity-55"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={cn("flex gap-3", message.role === "user" && "flex-row-reverse")}>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  message.role === "user" ? "bg-forest text-white" : "bg-mint-100 text-forest",
                )}
                aria-hidden
              >
                {message.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
              </span>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  message.role === "user" ? "bg-forest text-white" : "border border-border bg-card",
                  message.error && "border-destructive/30 bg-destructive-bg",
                )}
              >
                <span className="sr-only">{message.role === "user" ? "Sie:" : "Assistent:"}</span>
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed">{message.content}</p>
                ) : message.pending && !message.content ? (
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span className="size-1.5 animate-bounce rounded-full bg-current" />
                    <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
                    <span className="sr-only">Antwort wird geschrieben</span>
                  </p>
                ) : (
                  <ChatMarkdown content={message.content} />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 grid gap-2 rounded-2xl border border-border bg-card p-3 shadow-card"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <AiUnavailableNotice availability={availability} />
        <Label htmlFor="assistant-input" className="sr-only">
          Ihre Frage
        </Label>
        <Textarea
          id="assistant-input"
          value={input}
          rows={2}
          maxLength={4000}
          placeholder="Ihre Frage an den Assistenten …"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send(input);
            }
          }}
          disabled={blocked}
          className="min-h-16 resize-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Der Assistent kann sich irren und ersetzt keine Rechts-, Steuer- oder Finanzberatung.
          </p>
          {streaming ? (
            <Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>
              <CircleStop aria-hidden /> Stoppen
            </Button>
          ) : (
            <Button type="submit" size="sm" disabled={!input.trim() || blocked}>
              <SendHorizontal aria-hidden /> Senden
            </Button>
          )}
        </div>
        {availability.available ? <QuotaHint quota={availability.quota} /> : null}
      </form>
      <AiConsentDialog {...consent.dialogProps} />
    </div>
  );
}
