"use client";

import * as React from "react";
import { Hammer, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { RENOVATION_CATEGORIES, type RenovationCategory } from "@/lib/constants";
import { addRenovationAction, deleteRenovationAction, updateRenovationAction } from "@/lib/properties/actions";
import { renovationSchema } from "@/lib/validation/property";

export interface RenovationItem {
  id: string;
  year: number;
  category: string;
  description: string;
}

interface Draft {
  year: string;
  category: string;
  description: string;
}

const EMPTY: Draft = { year: "", category: "kitchen", description: "" };

function categoryLabel(category: string): string {
  return RENOVATION_CATEGORIES[category as RenovationCategory] ?? category;
}

/** Liste der Renovationen mit Erfassen, Bearbeiten und Entfernen (eigene Server Actions). */
export function RenovationsEditor({ propertyId, initial }: { propertyId: string; initial: RenovationItem[] }) {
  const [items, setItems] = React.useState(initial);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [errors, setErrors] = React.useState<Partial<Record<keyof Draft, string>>>({});
  const [toDelete, setToDelete] = React.useState<RenovationItem | null>(null);
  const [pending, startTransition] = React.useTransition();

  function start(item?: RenovationItem) {
    setEditing(item?.id ?? "neu");
    setDraft(item ? { year: String(item.year), category: item.category, description: item.description } : EMPTY);
    setErrors({});
  }

  function save() {
    const parsed = renovationSchema.safeParse(draft);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        year: fieldErrors.year?.[0],
        category: fieldErrors.category?.[0],
        description: fieldErrors.description?.[0],
      });
      return;
    }
    startTransition(async () => {
      const result =
        editing && editing !== "neu" ? await updateRenovationAction(editing, draft) : await addRenovationAction(propertyId, draft);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems(result.data.map((row) => ({ id: row.id, year: row.year, category: row.category, description: row.description })));
      setEditing(null);
      setDraft(EMPTY);
      toast.success(result.message ?? "Gespeichert.");
    });
  }

  function remove(item: RenovationItem) {
    startTransition(async () => {
      const result = await deleteRenovationAction(item.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems(result.data.map((row) => ({ id: row.id, year: row.year, category: row.category, description: row.description })));
      toast.success(result.message ?? "Entfernt.");
    });
  }

  const form = editing ? (
    <div className="grid gap-4 rounded-xl border border-mint-200 bg-mint-50/60 p-4">
      <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field label="Jahr" htmlFor="renovation-jahr" error={errors.year} required>
          <Input
            value={draft.year}
            onChange={(e) => setDraft({ ...draft, year: e.target.value })}
            inputMode="numeric"
            maxLength={4}
            placeholder="2019"
          />
        </Field>
        <Field label="Bereich" htmlFor="renovation-bereich" error={errors.category} required>
          <NativeSelect value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {Object.entries(RENOVATION_CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Was wurde gemacht?" htmlFor="renovation-text" error={errors.description} required>
        <Textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          maxLength={500}
          placeholder="z. B. Küche komplett erneuert mit Induktionsherd und Steamer"
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={pending}>
          Abbrechen
        </Button>
        <Button type="button" onClick={save} loading={pending}>
          Renovation speichern
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="grid gap-4">
      {items.length === 0 && !editing ? (
        <EmptyState
          icon={Hammer}
          title="Noch keine Renovationen erfasst"
          description="Erneuerungen wie Küche, Bad, Fenster oder Heizung steigern den Wert und schaffen Vertrauen."
          action={
            <Button type="button" variant="outline" onClick={() => start()}>
              <Plus aria-hidden /> Renovation hinzufügen
            </Button>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {items.map((item) =>
            editing === item.id ? (
              <li key={item.id} className="p-3">
                {form}
              </li>
            ) : (
              <li key={item.id} className="flex items-start gap-3 p-4">
                <span className="rounded-lg bg-mint-100 px-2.5 py-1 text-sm font-bold tabular text-forest">{item.year}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{categoryLabel(item.category)}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label="Renovation bearbeiten" onClick={() => start(item)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Renovation entfernen" onClick={() => setToDelete(item)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {editing === "neu" ? form : null}

      {items.length > 0 && !editing ? (
        <div>
          <Button type="button" variant="outline" onClick={() => start()}>
            <Plus aria-hidden /> Weitere Renovation
          </Button>
        </div>
      ) : null}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => (open ? null : setToDelete(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renovation entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `${toDelete.year} · ${categoryLabel(toDelete.category)}: ${toDelete.description}` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              destructive
              onClick={() => {
                if (toDelete) remove(toDelete);
                setToDelete(null);
              }}
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
