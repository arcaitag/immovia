"use client";

import * as React from "react";
import Link from "next/link";
import { BellOff, BellRing, Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { formatDate, formatRelative, pluralize } from "@/lib/format";
import { deleteSavedSearchAction, updateSavedSearchAction } from "@/components/saved-searches/actions";
import { ALERT_FREQUENCIES, isAlertFrequency, type AlertFrequency } from "@/components/saved-searches/criteria-json";
import { savedSearchNameSchema } from "@/components/saved-searches/schemas";

export interface SavedSearchItem {
  id: string;
  name: string;
  summary: string;
  href: string;
  alertEnabled: boolean;
  frequency: AlertFrequency;
  matches: number;
  createdAt: string;
  lastNotifiedAt: string | null;
}

function RenameDialog({ item, open, onOpenChange }: { item: SavedSearchItem; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>{open ? <RenameForm item={item} onDone={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  );
}

function RenameForm({ item, onDone }: { item: SavedSearchItem; onDone: () => void }) {
  const [name, setName] = React.useState(item.name);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = savedSearchNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ungültiger Name.");
      return;
    }
    startTransition(async () => {
      const result = await updateSavedSearchAction({ id: item.id, name: parsed.data });
      if (!result.ok) {
        setError(result.fieldErrors?.name?.[0] ?? result.error);
        return;
      }
      toast.success("Suchauftrag umbenannt.");
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>Suchauftrag umbenennen</DialogTitle>
        <DialogDescription>{item.summary}</DialogDescription>
      </DialogHeader>
      <Field label="Name" htmlFor={`name-${item.id}`} error={error}>
        <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit" loading={pending}>
          Speichern
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Ein Suchauftrag mit Benachrichtigung, Häufigkeit, Umbenennen und Löschen. */
export function SavedSearchCard({ item }: { item: SavedSearchItem }) {
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useOptimistic({ alertEnabled: item.alertEnabled, frequency: item.frequency });

  function update(patch: { alertEnabled?: boolean; frequency?: AlertFrequency }) {
    startTransition(async () => {
      setOptimistic({ ...optimistic, ...patch });
      const result = await updateSavedSearchAction({ id: item.id, ...patch });
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteSavedSearchAction({ id: item.id });
      if (!result.ok) toast.error(result.error);
      else toast.success("Suchauftrag gelöscht.");
    });
  }

  const switchId = `benachrichtigung-${item.id}`;
  const frequencyId = `haeufigkeit-${item.id}`;

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
            <span className="break-words">{item.name}</span>
            {optimistic.alertEnabled ? (
              <Badge tone="green">
                <BellRing aria-hidden /> {ALERT_FREQUENCIES[optimistic.frequency].label}
              </Badge>
            ) : (
              <Badge tone="neutral">
                <BellOff aria-hidden /> Ohne Benachrichtigung
              </Badge>
            )}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {pluralize(item.matches, "passendes neues Inserat", "passende neue Inserate")} seit {formatDate(item.createdAt)}
            {item.lastNotifiedAt ? ` · zuletzt benachrichtigt ${formatRelative(item.lastNotifiedAt)}` : ""}
          </p>
        </div>
        <Button asChild>
          <Link href={item.href}>
            <Search aria-hidden /> Ergebnisse anzeigen
          </Link>
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <Switch
              id={switchId}
              checked={optimistic.alertEnabled}
              onCheckedChange={(checked) => update({ alertEnabled: checked })}
              disabled={pending}
            />
            <label htmlFor={switchId} className="cursor-pointer text-sm font-semibold">
              Benachrichtigung
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={frequencyId} className="text-sm text-muted-foreground">
              Häufigkeit
            </label>
            <NativeSelect
              id={frequencyId}
              value={optimistic.frequency}
              disabled={!optimistic.alertEnabled || pending}
              onChange={(e) => {
                if (isAlertFrequency(e.target.value)) update({ frequency: e.target.value });
              }}
              className="h-10 min-w-36"
            >
              {(Object.entries(ALERT_FREQUENCIES) as [AlertFrequency, { label: string }][]).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setRenameOpen(true)}>
            <Pencil aria-hidden /> Umbenennen
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive-bg">
                <Trash2 aria-hidden /> Löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Suchauftrag löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  «{item.name}» wird gelöscht. Sie erhalten danach keine Benachrichtigungen mehr zu dieser Suche.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction destructive onClick={remove}>
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <RenameDialog item={item} open={renameOpen} onOpenChange={setRenameOpen} />
    </article>
  );
}
