"use client";

import * as React from "react";
import type { Completeness } from "@/lib/properties/completeness";

/**
 * Teilt die live berechnete Vollständigkeit zwischen Erfassungsformular,
 * Kopfbereich und Schrittnavigation (alle im Layout der Immobilie).
 */
interface ProgressContextValue {
  completeness: Completeness;
  setCompleteness: (next: Completeness) => void;
}

const ProgressContext = React.createContext<ProgressContextValue | null>(null);

function same(a: Completeness, b: Completeness): boolean {
  return (
    a.percent === b.percent &&
    a.isComplete === b.isComplete &&
    a.missingRequired.join() === b.missingRequired.join() &&
    a.missingRecommended.join() === b.missingRecommended.join()
  );
}

export function PropertyProgressProvider({
  initialCompleteness,
  children,
}: {
  initialCompleteness: Completeness;
  children: React.ReactNode;
}) {
  const [completeness, setState] = React.useState(initialCompleteness);
  const setCompleteness = React.useCallback((next: Completeness) => {
    setState((previous) => (same(previous, next) ? previous : next));
  }, []);
  const value = React.useMemo(() => ({ completeness, setCompleteness }), [completeness, setCompleteness]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function usePropertyProgress(): ProgressContextValue | null {
  return React.useContext(ProgressContext);
}
