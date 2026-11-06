import { cantonName } from "@/lib/constants";
import { formatPhone } from "@/lib/format";
import type { Tables } from "@/types/database";

/** Lesende Ansicht des Firmenprofils für Mitarbeitende ohne Verwaltungsrechte. */
export function OrganizationProfileView({ organization }: { organization: Tables<"organizations"> }) {
  const address = [
    organization.street,
    [organization.postal_code, organization.city].filter(Boolean).join(" "),
    organization.canton ? cantonName(organization.canton) : null,
  ]
    .filter(Boolean)
    .join(", ");
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Firmenname", value: organization.name },
    { label: "Adresse", value: address || "–" },
    { label: "Telefon", value: organization.phone ? formatPhone(organization.phone) : "–" },
    { label: "E-Mail", value: organization.email ?? "–" },
    {
      label: "Website",
      value: organization.website ? (
        <a href={organization.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
          {organization.website.replace(/^https?:\/\//, "")}
        </a>
      ) : (
        "–"
      ),
    },
    { label: "UID", value: organization.uid_number ?? "–" },
    { label: "Öffentliche Firmenseite", value: organization.is_public ? "Ja" : "Nein" },
  ];
  return (
    <div className="grid gap-5">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="break-words text-[0.9375rem]">{row.value}</dd>
          </div>
        ))}
      </dl>
      {organization.description ? (
        <div className="grid gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beschreibung</p>
          <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed">{organization.description}</p>
        </div>
      ) : null}
      <p className="rounded-xl bg-muted px-3.5 py-3 text-xs text-muted-foreground">
        Nur Inhaber und Administratoren können das Firmenprofil bearbeiten.
      </p>
    </div>
  );
}
