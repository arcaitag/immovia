"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, Flag, Link2, MessageSquare, Phone, Share2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { FavoriteButton } from "@/components/property/favorite-button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InquiryDialog, type InquiryTarget } from "@/components/listing-detail/inquiry-dialog";
import { ViewingDialog } from "@/components/listing-detail/viewing-dialog";
import { ReportDialog } from "@/components/listing-detail/report-dialog";
import { clearLocationHash, useLocationHash } from "@/components/search/use-location-hash";

export interface ListingActionsInfo extends InquiryTarget {
  priceValue: string;
  priceLabel: string;
  priceDetail: string | null;
  /** Nur gesetzt, wenn die Inserentin bzw. der Inserent die Telefonnummer freigegeben hat. */
  phone: string | null;
  isReserved: boolean;
}

type ActiveDialog = { kind: "anfrage"; wantsViewing?: boolean } | { kind: "besichtigung" } | { kind: "melden" };

interface ListingActionsContextValue {
  info: ListingActionsInfo;
  openInquiry: (options?: { wantsViewing?: boolean }) => void;
  openViewing: () => void;
  openReport: () => void;
}

const ListingActionsContext = React.createContext<ListingActionsContextValue | null>(null);

function useListingActions(): ListingActionsContextValue {
  const context = React.useContext(ListingActionsContext);
  if (!context) throw new Error("ListingActionsProvider fehlt.");
  return context;
}

function dialogFromHash(hash: string): ActiveDialog | null {
  if (hash === "#anfrage") return { kind: "anfrage" };
  if (hash === "#besichtigung") return { kind: "besichtigung" };
  if (hash === "#melden") return { kind: "melden" };
  return null;
}

/**
 * Stellt Kontakt-, Besichtigungs- und Meldedialog für die Inseratseite bereit.
 * Nach einem Login mit Rücksprung (z. B. «#anfrage») öffnet sich der passende Dialog automatisch.
 */
export function ListingActionsProvider({ info, children }: { info: ListingActionsInfo; children: React.ReactNode }) {
  const hash = useLocationHash();
  const [dialog, setDialog] = React.useState<ActiveDialog | null>(null);
  const [hashDismissed, setHashDismissed] = React.useState(false);
  const active = dialog ?? (hashDismissed ? null : dialogFromHash(hash));

  const close = React.useCallback(() => {
    setDialog(null);
    setHashDismissed(true);
    clearLocationHash();
  }, []);

  const value = React.useMemo<ListingActionsContextValue>(
    () => ({
      info,
      openInquiry: (options) => setDialog({ kind: "anfrage", wantsViewing: options?.wantsViewing }),
      openViewing: () => setDialog({ kind: "besichtigung" }),
      openReport: () => setDialog({ kind: "melden" }),
    }),
    [info],
  );

  return (
    <ListingActionsContext.Provider value={value}>
      {children}
      <InquiryDialog
        open={active?.kind === "anfrage"}
        wantsViewing={active?.kind === "anfrage" ? active.wantsViewing : undefined}
        onOpenChange={(open) => (open ? undefined : close())}
        target={info}
      />
      <ViewingDialog
        open={active?.kind === "besichtigung"}
        onOpenChange={(open) => (open ? undefined : close())}
        target={info}
        onRequestByMessage={() => setDialog({ kind: "anfrage", wantsViewing: true })}
      />
      <ReportDialog open={active?.kind === "melden"} onOpenChange={(open) => (open ? undefined : close())} target={info} />
    </ListingActionsContext.Provider>
  );
}

/** Teilen über das Teilen-Menü des Geräts oder Link kopieren. */
export function ShareButton({ title, path, className }: { title: string; path: string; className?: string }) {
  async function share() {
    const url = `${window.location.origin}${path}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link kopiert");
    } catch {
      toast.error("Der Link konnte nicht kopiert werden.");
    }
  }
  return (
    <button
      type="button"
      onClick={() => void share()}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold transition hover:bg-mint-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Share2 className="size-5" aria-hidden />
      Teilen
    </button>
  );
}

function OwnerHint() {
  return (
    <div className="grid gap-3 rounded-xl bg-mint-50 p-4 text-sm text-forest">
      <p className="font-semibold">Das ist Ihr Inserat.</p>
      <p className="text-forest/80">Anfragen, Besichtigungen und Statistiken finden Sie im Dashboard.</p>
      <Button asChild size="sm" variant="dark">
        <Link href="/dashboard/immobilien">Im Dashboard verwalten</Link>
      </Button>
    </div>
  );
}

/** Seitliche Kontaktkarte (Desktop sticky, auf Mobilgeräten im Inhalt). */
export function ContactCard({ className }: { className?: string }) {
  const { info, openInquiry, openViewing, openReport } = useListingActions();
  const { data: user } = useAuthUser();
  const isOwner = Boolean(user && user.id === info.ownerId);

  return (
    <section aria-label="Kontakt" className={cn("rounded-2xl border border-border bg-card p-6 shadow-card", className)}>
      <p className="text-sm text-muted-foreground">{info.priceLabel}</p>
      <p className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-brand tabular">{info.priceValue}</p>
      {info.priceDetail ? <p className="mt-1 text-sm text-muted-foreground">{info.priceDetail}</p> : null}
      {info.isReserved ? (
        <p className="mt-3 rounded-xl bg-warning-bg px-3 py-2 text-sm font-medium text-warning">
          Reserviert – Anfragen sind weiterhin möglich.
        </p>
      ) : null}

      <div className="mt-5 grid gap-2.5">
        {isOwner ? (
          <OwnerHint />
        ) : (
          <>
            <Button size="lg" onClick={() => openInquiry()}>
              <MessageSquare aria-hidden /> Kontakt aufnehmen
            </Button>
            <Button size="lg" variant="outline" onClick={() => openViewing()}>
              <CalendarCheck aria-hidden /> Besichtigung anfragen
            </Button>
          </>
        )}
        {info.phone ? (
          <Button asChild size="lg" variant="ghost" className="justify-start">
            <a href={`tel:${info.phone.replace(/[^\d+]/g, "")}`}>
              <Phone aria-hidden /> {formatPhone(info.phone)}
            </a>
          </Button>
        ) : null}
      </div>

      {info.contactName ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Ansprechperson: <span className="font-semibold text-foreground">{info.contactName}</span>
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
        <FavoriteButton listingId={info.listingId} variant="inline" className="flex-1" />
        <ShareButton title={info.title} path={`/immobilien/${info.slug}`} className="flex-1" />
      </div>
      <button
        type="button"
        onClick={() => openReport()}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Flag className="size-3.5" aria-hidden /> Inserat melden
      </button>
    </section>
  );
}

/** Fixierte Kontaktleiste am unteren Bildschirmrand (nur Mobilgeräte). */
export function MobileContactBar() {
  const { info, openInquiry, openViewing } = useListingActions();
  const { data: user } = useAuthUser();
  if (user && user.id === info.ownerId) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-extrabold leading-tight text-brand tabular">{info.priceValue}</p>
          <p className="truncate text-xs text-muted-foreground">{info.priceLabel}</p>
        </div>
        <Button variant="outline" size="icon" className="size-11" aria-label="Besichtigung anfragen" onClick={() => openViewing()}>
          <CalendarCheck className="size-5" aria-hidden />
        </Button>
        <Button className="h-11" onClick={() => openInquiry()}>
          <MessageSquare aria-hidden /> Kontakt
        </Button>
      </div>
    </div>
  );
}

/** Kleine Aktionen unter dem Inseratstext (Melden, Link kopieren). */
export function ListingFooterActions() {
  const { info, openReport } = useListingActions();
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/immobilien/${info.slug}`);
      toast.success("Link kopiert");
    } catch {
      toast.error("Der Link konnte nicht kopiert werden.");
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" size="sm" onClick={() => void copy()}>
        <Link2 aria-hidden /> Link kopieren
      </Button>
      <Button variant="ghost" size="sm" onClick={() => openReport()}>
        <ShieldAlert aria-hidden /> Inserat melden
      </Button>
    </div>
  );
}
