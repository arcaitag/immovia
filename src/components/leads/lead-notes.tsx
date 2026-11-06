"use client";

import * as React from "react";
import { Lock, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { formatDateTime, formatRelative } from "@/lib/format";
import { createLeadNoteAction, deleteLeadNoteAction, updateLeadNoteAction } from "@/app/dashboard/interessenten/actions";
import type { LeadNote } from "@/services/leads";

/** Private Notizen zu einem Interessenten (Tabelle lead_notes, für Interessenten nie lesbar). */
export function LeadNotes({ leadId, initialNotes, teamVisible }: { leadId: string; initialNotes: LeadNote[]; teamVisible: boolean }) {
  const [notes, setNotes] = React.useState(initialNotes);
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: string; body: string } | null>(null);
  const [pending, startTransition] = React.useTransition();

  function add(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await createLeadNoteAction({ leadId, body });
      if (res.ok) {
        setNotes((prev) => [res.data, ...prev]);
        setDraft("");
        toast.success(res.message ?? "Notiz gespeichert.");
      } else toast.error(res.error);
    });
  }

  function saveEdit() {
    if (!editing) return;
    const body = editing.body.trim();
    if (!body) return;
    const id = editing.id;
    startTransition(async () => {
      const res = await updateLeadNoteAction({ noteId: id, body });
      if (res.ok) {
        setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, body, updatedAt: new Date().toISOString() } : n)));
        setEditing(null);
        toast.success(res.message ?? "Notiz aktualisiert.");
      } else toast.error(res.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteLeadNoteAction({ noteId: id });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        toast.success(res.message ?? "Notiz gelöscht.");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="grid gap-4">
      <p className="inline-flex items-center gap-2 self-start rounded-full bg-mint-100 px-3 py-1 text-xs font-semibold text-forest">
        <Lock className="size-3.5" aria-hidden />
        {teamVisible ? "Nur für Sie und Ihr Team sichtbar" : "Nur für Sie sichtbar"}
      </p>
      <form onSubmit={add} className="grid gap-2">
        <label htmlFor="lead-note" className="sr-only">
          Neue Notiz
        </label>
        <Textarea
          id="lead-note"
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="z. B. Finanzierung über Hausbank, möchte Nebenkosten prüfen …"
          className="min-h-24"
        />
        <Button type="submit" size="sm" className="justify-self-end" loading={pending && !editing} disabled={!draft.trim()}>
          Notiz speichern
        </Button>
      </form>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Notizen.</p>
      ) : (
        <ul className="grid gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-border bg-surface p-3.5">
              {editing?.id === note.id ? (
                <div className="grid gap-2">
                  <label htmlFor={`note-${note.id}`} className="sr-only">
                    Notiz bearbeiten
                  </label>
                  <Textarea
                    id={`note-${note.id}`}
                    value={editing.body}
                    maxLength={4000}
                    onChange={(e) => setEditing({ id: note.id, body: e.target.value })}
                    className="min-h-24"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Abbrechen
                    </Button>
                    <Button type="button" size="sm" onClick={saveEdit} loading={pending} disabled={!editing.body.trim()}>
                      Speichern
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{note.body}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span title={formatDateTime(note.createdAt)} suppressHydrationWarning>
                      {note.authorName} · {formatRelative(note.createdAt)}
                      {note.updatedAt !== note.createdAt ? " · bearbeitet" : ""}
                    </span>
                    {note.isMine ? (
                      <span className="ml-auto flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing({ id: note.id, body: note.body })}
                          aria-label="Notiz bearbeiten"
                        >
                          <Pencil />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(note.id)} disabled={pending} aria-label="Notiz löschen">
                          <Trash2 />
                        </Button>
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
