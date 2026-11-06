"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HIGHLIGHT_MAX_LENGTH, MAX_HIGHLIGHTS } from "@/lib/validation/listing";

/** Highlights als Chips (max. 12). Eingabe mit Enter oder «Hinzufügen». */
export function HighlightsInput({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  describedBy?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const full = value.length >= MAX_HIGHLIGHTS;

  function add() {
    const text = draft.trim();
    if (text.length < 2) {
      setMessage("Bitte mindestens 2 Zeichen eingeben.");
      return;
    }
    if (value.some((item) => item.toLowerCase() === text.toLowerCase())) {
      setMessage("Dieses Highlight ist bereits erfasst.");
      return;
    }
    if (full) {
      setMessage(`Maximal ${MAX_HIGHLIGHTS} Highlights.`);
      return;
    }
    onChange([...value, text.slice(0, HIGHLIGHT_MAX_LENGTH)]);
    setDraft("");
    setMessage(null);
  }

  return (
    <div className="grid gap-3">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Erfasste Highlights">
          {value.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-mint-200 bg-mint-50 py-1 pl-3.5 pr-1 text-sm font-medium text-forest"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="inline-flex size-7 items-center justify-center rounded-full hover:bg-mint-200"
                aria-label={`Highlight «${item}» entfernen`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setMessage(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          maxLength={HIGHLIGHT_MAX_LENGTH}
          placeholder={full ? "Maximum erreicht" : "z. B. Balkon mit Abendsonne"}
          disabled={full}
          aria-describedby={describedBy}
        />
        <Button type="button" variant="outline" onClick={add} disabled={full || draft.trim().length === 0}>
          <Plus aria-hidden /> Hinzufügen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {message ?? `${value.length} von ${MAX_HIGHLIGHTS} Highlights`}
      </p>
    </div>
  );
}
