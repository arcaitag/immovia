"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/select";
import { LEAD_SORTS, type LeadSort } from "@/lib/validation/lead";

/** Inserat- und Sortierfilter (URL-Parameter ?inserat=…&status=…&sortierung=…). */
export function LeadFilters({
  listings,
  listingId,
  status,
  sort,
}: {
  listings: Array<{ id: string; title: string }>;
  listingId: string | null;
  status: string | null;
  sort: LeadSort;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function navigate(next: { inserat?: string | null; sortierung?: LeadSort }) {
    const params = new URLSearchParams();
    const inserat = next.inserat !== undefined ? next.inserat : listingId;
    const sortierung = next.sortierung ?? sort;
    if (inserat) params.set("inserat", inserat);
    if (status) params.set("status", status);
    if (sortierung !== "aktivitaet") params.set("sortierung", sortierung);
    startTransition(() => router.push(`/dashboard/interessenten${params.size ? `?${params.toString()}` : ""}`));
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]" aria-busy={pending}>
      <div>
        <label htmlFor="lead-listing" className="sr-only">
          Inserat
        </label>
        <NativeSelect id="lead-listing" value={listingId ?? ""} onChange={(e) => navigate({ inserat: e.target.value || null })}>
          <option value="">Alle Inserate</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor="lead-sort" className="sr-only">
          Sortierung
        </label>
        <NativeSelect id="lead-sort" value={sort} onChange={(e) => navigate({ sortierung: e.target.value as LeadSort })}>
          {Object.entries(LEAD_SORTS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
