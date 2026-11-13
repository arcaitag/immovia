"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Building2, FileText, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { grantAiConsentAction } from "@/components/ai/consent-actions";
import type { ImageConsentInfo } from "@/lib/images/ai-providers/types";

const TEXT_POINTS = [
  {
    icon: FileText,
    title: "Welche Daten",
    text: "Nur, was die Funktion braucht: Angaben zum Objekt (z. B. Objektart, Zimmer, Fläche, Ausstattung, Ort ohne Strasse und Hausnummer), Ihre Inseratstexte bzw. Ihre Eingaben im Assistenten. Kontaktdaten wie E-Mail-Adresse oder Telefonnummer senden wir nicht mit.",
  },
  { icon: Building2, title: "An wen", text: "An unseren KI-Anbieter Anthropic (USA), der das Sprachmodell Claude betreibt." },
  {
    icon: Ban,
    title: "Kein Training",
    text: "Gemäss den kommerziellen Nutzungsbedingungen von Anthropic werden die Daten nicht zum Training von KI-Modellen verwendet.",
  },
  { icon: Trash2, title: "Löschung", text: "Anthropic löscht die übermittelten Daten standardmässig innert 30 Tagen." },
] as const;

function imagePoints(info: ImageConsentInfo) {
  return [
    {
      icon: FileText,
      title: "Welche Daten",
      text: "Nur das ausgewählte Foto der Immobilie, ohne Standortdaten (GPS) und ohne Ihre Kontaktdaten.",
    },
    {
      icon: Building2,
      title: "An wen",
      text: `Über das AI Gateway von Vercel (USA) an den Anbieter des Bildmodells: ${info.recipient}.`,
    },
    { icon: Ban, title: "Kein Training", text: "Wir verlangen bei jeder Anfrage, dass das Foto nicht zum Training von KI-Modellen verwendet wird." },
    {
      icon: Trash2,
      title: "Löschung",
      text: info.noRetention
        ? "Wir verlangen zudem, dass der Anbieter das Foto nach der Bearbeitung nicht speichert. Das Ergebnis speichern nur wir, als neues Bild in Ihrem Konto."
        : "Die Aufbewahrung beim Anbieter richtet sich nach dessen Bedingungen. Das Ergebnis speichern wir als neues Bild in Ihrem Konto.",
    },
  ];
}

/**
 * Einwilligungsdialog vor der ersten KI-Nutzung. «Zustimmen und fortfahren» speichert die
 * Einwilligung per Server Action und löst danach die ursprüngliche Aktion erneut aus.
 * kind = "image": eigene Einwilligung für die Bild-KI (Fotos gehen an einen anderen Anbieter).
 */
export function AiConsentDialog({
  open,
  onOpenChange,
  onConsented,
  kind = "text",
  imageInfo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsented: () => void;
  kind?: "text" | "image";
  imageInfo?: ImageConsentInfo;
}) {
  const [pending, startTransition] = React.useTransition();
  const isImage = kind === "image";
  const points = isImage ? imagePoints(imageInfo ?? { recipient: "den Bild-KI-Anbieter", noRetention: false }) : TEXT_POINTS;

  function agree() {
    startTransition(async () => {
      const res = await grantAiConsentAction(kind);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Schliesst den Dialog und löst die ursprüngliche Aktion erneut aus
      onConsented();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-mint-100 text-forest">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <DialogTitle>{isImage ? "Foto an die Bild-KI senden?" : "KI-Verarbeitung erlauben?"}</DialogTitle>
          <DialogDescription>
            {isImage
              ? "Für einen Designvorschlag senden wir das Foto an einen Bild-KI-Dienst. Ohne Ihre Einwilligung geschieht das nicht – alle anderen Funktionen bleiben nutzbar."
              : "Für diese Funktion senden wir Angaben an einen KI-Dienst. Ohne Ihre Einwilligung geschieht das nicht – alle anderen Funktionen bleiben nutzbar."}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3">
          {points.map((point) => (
            <div key={point.title} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
              <point.icon className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />
              <div className="grid gap-0.5 text-sm">
                <dt className="font-semibold">{point.title}</dt>
                <dd className="leading-relaxed text-muted-foreground">{point.text}</dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Sie können die Einwilligung jederzeit in den{" "}
          <Link href="/dashboard/einstellungen" className="font-semibold text-primary underline-offset-2 hover:underline">
            Einstellungen
          </Link>{" "}
          widerrufen. Details in der{" "}
          <Link href="/datenschutz" className="font-semibold text-primary underline-offset-2 hover:underline">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Abbrechen
          </Button>
          <Button onClick={agree} loading={pending}>
            Zustimmen und fortfahren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hilfs-Hook: führt eine KI-Aktion aus oder fragt vorher nach der Einwilligung.
 * - guard(action): ohne Einwilligung erst den Dialog zeigen, danach action ausführen
 * - requestConsent(retry): wenn der Server «Einwilligung fehlt» meldet (z. B. widerrufen)
 */
export function useAiConsent(initiallyRequired: boolean) {
  const requiredRef = React.useRef(initiallyRequired);
  const pendingRef = React.useRef<(() => void) | null>(null);
  const [open, setOpen] = React.useState(false);
  const [required, setRequired] = React.useState(initiallyRequired);

  const requestConsent = React.useCallback((retry: () => void) => {
    requiredRef.current = true;
    setRequired(true);
    pendingRef.current = retry;
    setOpen(true);
  }, []);

  const guard = React.useCallback(
    (action: () => void) => {
      if (requiredRef.current) {
        requestConsent(action);
        return;
      }
      action();
    },
    [requestConsent],
  );

  const onConsented = React.useCallback(() => {
    requiredRef.current = false;
    setRequired(false);
    setOpen(false);
    toast.success("Einwilligung gespeichert.");
    const retry = pendingRef.current;
    pendingRef.current = null;
    retry?.();
  }, []);

  const onOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) pendingRef.current = null;
  }, []);

  return { guard, requestConsent, required, dialogProps: { open, onOpenChange, onConsented } };
}
