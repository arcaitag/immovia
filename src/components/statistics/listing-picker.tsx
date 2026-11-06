"use client";

import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/select";

/** Auswahl des Inserats für die Statistik (Navigation über Suchparameter). */
export function ListingPicker({
  options,
  value,
  days,
}: {
  options: { id: string; label: string }[];
  value: string;
  days: number;
}) {
  const router = useRouter();
  return (
    <Field label="Inserat" htmlFor="statistik-inserat" className="w-full sm:max-w-md">
      <NativeSelect
        value={value}
        onChange={(event) => router.push(`/dashboard/statistiken?inserat=${event.target.value}&tage=${days}`, { scroll: false })}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}
