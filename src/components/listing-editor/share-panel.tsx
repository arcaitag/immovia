"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Mail, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

/** Öffentliche Adresse des Inserats mit Kopieren und Teilen. */
export function SharePanel({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link kopiert.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Der Link konnte nicht kopiert werden. Bitte markieren und kopieren Sie ihn von Hand.");
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
  }

  const text = `${title} – ${url}`;
  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <Input value={url} readOnly aria-label="Öffentliche Adresse des Inserats" onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="outline" onClick={() => void copy()} aria-label="Link kopieren">
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          <span className="hidden sm:inline">{copied ? "Kopiert" : "Kopieren"}</span>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={url} target="_blank" rel="noopener">
            <ExternalLink aria-hidden /> Inserat öffnen
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void share()}>
          <Share2 aria-hidden /> Teilen
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`}>
            <Mail aria-hidden /> E-Mail
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
