"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/select";
import { LISTING_STATUS, type ListingStatus } from "@/lib/constants";

/** Inserat wählen (URL-Parameter ?inserat=…). */
export function ListingPicker({
  listings,
  value,
  basePath,
  param = "inserat",
  label = "Inserat",
  extraParams,
}: {
  listings: Array<{ id: string; title: string; status?: ListingStatus; hint?: string }>;
  value: string;
  basePath: string;
  param?: string;
  label?: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();
  return (
    <div className="grid gap-2" aria-busy={pending}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <NativeSelect
        id={id}
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams({ ...extraParams, [param]: e.target.value });
          startTransition(() => router.push(`${basePath}?${params.toString()}`));
        }}
      >
        {listings.map((l) => (
          <option key={l.id} value={l.id}>
            {l.title}
            {l.status ? ` · ${LISTING_STATUS[l.status].label}` : ""}
            {l.hint ? ` · ${l.hint}` : ""}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
