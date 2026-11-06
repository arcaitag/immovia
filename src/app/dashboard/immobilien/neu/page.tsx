import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { NewPropertyForm } from "@/components/property-wizard/new-property-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Neue Immobilie" };

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser("/dashboard/immobilien/neu");
  const goal = params.ziel === "bewertung" ? "bewertung" : "";
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8">
      <PageHeader
        eyebrow="Verkaufsassistent · Schritt 1 von 8"
        title={goal === "bewertung" ? "Welche Immobilie möchten Sie bewerten?" : "Neue Immobilie erfassen"}
        description="Beginnen Sie mit den Grundangaben. Alles Weitere fragt der Assistent danach Schritt für Schritt ab – Sie können jederzeit unterbrechen."
      />
      <NewPropertyForm organizations={user.organizations.map((o) => ({ id: o.id, name: o.name }))} goal={goal} />
    </div>
  );
}
