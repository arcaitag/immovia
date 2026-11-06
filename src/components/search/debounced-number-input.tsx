"use client";

import * as React from "react";
import { InputGroup } from "@/components/ui/input";

const grouped = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 1 });

function toText(value: number | undefined, grouping: boolean): string {
  if (value === undefined) return "";
  return grouping ? grouped.format(value) : String(value);
}

/** Akzeptiert Schweizer Schreibweisen wie «800’000» oder «80.5». */
function toNumber(text: string): number | undefined {
  const clean = text.replace(/['’\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(clean)) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Zahlenfeld für Filter: übernimmt den Wert verzögert (Debouncing), bei Enter oder beim Verlassen sofort.
 * Externe Änderungen (z. B. «Filter zurücksetzen») werden übernommen, solange das Feld nicht bearbeitet wird.
 */
export function DebouncedNumberInput({
  id,
  value,
  onCommit,
  prefix,
  suffix,
  placeholder,
  grouping = true,
  maxDigits = 9,
  delay = 650,
  ...aria
}: {
  id: string;
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  grouping?: boolean;
  maxDigits?: number;
  delay?: number;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [text, setText] = React.useState(() => toText(value, grouping));
  const [syncedValue, setSyncedValue] = React.useState(value);
  const [focused, setFocused] = React.useState(false);

  if (value !== syncedValue) {
    setSyncedValue(value);
    if (!focused) setText(toText(value, grouping));
  }

  const commitIfChanged = React.useEffectEvent((raw: string) => {
    const next = toNumber(raw);
    if (next !== value) onCommit(next);
  });

  React.useEffect(() => {
    const timer = window.setTimeout(() => commitIfChanged(text), delay);
    return () => window.clearTimeout(timer);
  }, [text, delay]);

  function commitNow() {
    const next = toNumber(text);
    if (next !== value) onCommit(next);
  }

  return (
    <InputGroup
      id={id}
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="search"
      placeholder={placeholder}
      prefix={prefix}
      suffix={suffix}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commitNow();
        setText(toText(toNumber(text), grouping));
      }}
      onChange={(event) => setText(event.target.value.replace(/[^\d'’\s.]/g, "").slice(0, maxDigits + 5))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitNow();
        }
      }}
      className="w-full"
      {...aria}
    />
  );
}
