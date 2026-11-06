"use client";

import * as React from "react";
import { FileText, Paperclip, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { inputBase } from "@/components/ui/input";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ATTACHMENT_MAX_BYTES, MESSAGE_MAX_LENGTH } from "@/lib/validation/message";
import { detectFileMime, FILE_ACCEPT } from "@/lib/validation/document";

const MAX_TEXTAREA_PX = 168;

export function ChatComposer({ onSend, disabled }: { onSend: (text: string, file: File | null) => void; disabled?: boolean }) {
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const canSend = !disabled && (text.trim().length > 0 || file !== null) && text.length <= MESSAGE_MAX_LENGTH;

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selected) return;
    if (!detectFileMime(selected)) {
      toast.error("Erlaubt sind PDF-Dateien und Bilder (JPG, PNG, WEBP).");
      return;
    }
    if (selected.size > ATTACHMENT_MAX_BYTES) {
      toast.error("Anhänge dürfen höchstens 10 MB gross sein.");
      return;
    }
    if (selected.size === 0) {
      toast.error("Die Datei ist leer.");
      return;
    }
    setFile(selected);
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSend(text, file);
    setText("");
    setFile(null);
    requestAnimationFrame(() => {
      resize();
      textareaRef.current?.focus();
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-border bg-card px-3 pb-3 pt-2.5 sm:px-4">
      {file ? (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-mint-100 text-forest">
            <FileText className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{file.name}</span>
            <span className="block text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
          </span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFile(null)} aria-label="Anhang entfernen">
            <X />
          </Button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" accept={FILE_ACCEPT} className="sr-only" tabIndex={-1} onChange={pickFile} aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          aria-label="Datei anhängen (PDF oder Bild, max. 10 MB)"
        >
          <Paperclip className="size-5" />
        </Button>
        <label htmlFor="chat-message" className="sr-only">
          Nachricht
        </label>
        <textarea
          id="chat-message"
          ref={textareaRef}
          value={text}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={disabled}
          placeholder="Nachricht schreiben …"
          onChange={(e) => {
            setText(e.target.value);
            resize();
          }}
          onKeyDown={onKeyDown}
          className={cn(inputBase, "max-h-42 min-h-11 flex-1 resize-none py-2.5 leading-normal")}
        />
        <Button type="submit" size="icon" className="size-11 shrink-0" disabled={!canSend} aria-label="Nachricht senden">
          <SendHorizontal className="size-5" />
        </Button>
      </div>
      <p className="mt-1.5 hidden text-[11px] text-muted-foreground sm:block">Enter sendet, Shift + Enter fügt eine neue Zeile ein.</p>
    </form>
  );
}
