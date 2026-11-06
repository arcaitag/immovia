import type { Metadata } from "next";
import Link from "next/link";
import { FileLock2, FolderLock, House, Link2, ShieldCheck, Timer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentUploadDialog } from "@/components/documents/document-upload-dialog";
import { DocumentList } from "@/components/documents/document-list";
import { SharedDocuments } from "@/components/documents/shared-documents";
import { ListingPicker } from "@/components/viewings/listing-picker";
import { requireUser } from "@/lib/auth/session";
import { cn, isUuid } from "@/lib/utils";
import { getManagedProperties, getPropertyDocuments, getShareCandidates, getSharedWithMe } from "@/services/documents";

export const metadata: Metadata = { title: "Dokumente" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const SECURITY_POINTS = [
  { icon: FileLock2, text: "Dateien liegen in einem geschützten Speicher und sind nie über eine öffentliche Adresse erreichbar." },
  { icon: Timer, text: "Downloads laufen über Links, die nach 60 Sekunden ablaufen und nur nach erneuter Prüfung entstehen." },
  { icon: Link2, text: "Freigaben gelten für einzelne Personen, auf Wunsch befristet, und lassen sich jederzeit widerrufen." },
  { icon: ShieldCheck, text: "Dokumente mit Personendaten können nicht öffentlich gemacht werden." },
];

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser("/dashboard/dokumente");
  const sp = await searchParams;
  const [properties, shared] = await Promise.all([getManagedProperties(user), getSharedWithMe(user.id)]);
  const view = first(sp.ansicht) === "geteilt" || properties.length === 0 ? "geteilt" : "eigene";
  const requested = first(sp.immobilie);
  const property = (requested && isUuid(requested) ? properties.find((p) => p.id === requested) : undefined) ?? properties[0] ?? null;

  const [documents, candidates] =
    view === "eigene" && property ? await Promise.all([getPropertyDocuments(property, user), getShareCandidates(property.id)]) : [[], []];

  const tabs = (
    <nav aria-label="Ansicht" className="inline-flex h-11 items-center gap-1 self-start rounded-xl bg-muted p-1">
      {properties.length ? (
        <Link
          href={property ? `/dashboard/dokumente?immobilie=${property.id}` : "/dashboard/dokumente"}
          aria-current={view === "eigene" ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold transition-colors",
            view === "eigene" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Meine Dokumente
        </Link>
      ) : null}
      <Link
        href="/dashboard/dokumente?ansicht=geteilt"
        aria-current={view === "geteilt" ? "page" : undefined}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors",
          view === "geteilt" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        )}
      >
        Mit mir geteilt
        {shared.length ? <span className="rounded-full bg-brand px-2 text-[11px] font-bold leading-5 text-white">{shared.length}</span> : null}
      </Link>
    </nav>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dokumente"
        description="Unterlagen zentral ablegen und gezielt freigeben. Private Dateien sind nur über zeitlich begrenzte Links abrufbar."
        actions={
          view === "eigene" && property ? (
            <DocumentUploadDialog propertyId={property.id} propertyLabel={property.label} hasOrganization={Boolean(property.organizationId)} />
          ) : undefined
        }
      />
      {tabs}

      {view === "geteilt" ? (
        <div className="flex flex-col gap-6">
          <SharedDocuments items={shared} />
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Möchten Sie eigene Unterlagen ablegen?{" "}
              <Link href="/dashboard/immobilien" className="font-semibold text-primary hover:underline">
                Erfassen Sie zuerst eine Immobilie.
              </Link>
            </p>
          ) : null}
        </div>
      ) : property ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="sm:max-w-xl">
              <ListingPicker
                basePath="/dashboard/dokumente"
                param="immobilie"
                label="Immobilie"
                value={property.id}
                listings={properties.map((p) => ({ id: p.id, title: p.address ? `${p.label} (${p.address})` : p.label }))}
              />
            </div>
            {documents.length === 0 ? (
              <EmptyState
                icon={FolderLock}
                title="Noch keine Dokumente"
                description="Laden Sie Grundrisse, Grundbuchauszüge, Reglemente oder Energieausweise hoch. Sie entscheiden, wer sie sehen darf."
                action={<DocumentUploadDialog propertyId={property.id} propertyLabel={property.label} hasOrganization={Boolean(property.organizationId)} />}
              />
            ) : (
              <DocumentList documents={documents} candidates={candidates} hasOrganization={Boolean(property.organizationId)} />
            )}
          </div>
          <aside className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-forest" aria-hidden /> So schützen wir Ihre Unterlagen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-4">
                  {SECURITY_POINTS.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                      <Icon className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />
                      {text}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Interessenten</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground">
                <p>
                  {candidates.length
                    ? `${candidates.length} ${candidates.length === 1 ? "Person hat" : "Personen haben"} Kontakt zu Inseraten dieser Immobilie. Nur sie können Freigaben erhalten.`
                    : "Noch niemand hat Kontakt zu Inseraten dieser Immobilie aufgenommen. Freigaben sind erst danach möglich."}
                </p>
                <Button asChild variant="outline" size="sm" className="justify-self-start">
                  <Link href="/dashboard/interessenten">
                    <House aria-hidden /> Interessenten ansehen
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
