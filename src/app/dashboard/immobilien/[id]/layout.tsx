import type { Metadata } from "next";
import { PropertyHeader } from "@/components/property-wizard/property-header";
import { PropertyProgressProvider } from "@/components/property-wizard/progress-context";
import { PropertyStepNav } from "@/components/property-wizard/step-nav";
import { getPropertyWorkspace } from "@/services/properties";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const workspace = await getPropertyWorkspace(id);
  return { title: workspace.displayName };
}

/**
 * Rahmen aller Schritte einer Immobilie: Kopf (Name, Adresse, Status, Vollständigkeit)
 * und die 8-Schritte-Navigation. Lädt die Immobilie mit dem Benutzer-Client;
 * nicht verwaltbare Objekte ergeben 404.
 */
export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getPropertyWorkspace(id);
  return (
    <PropertyProgressProvider key={workspace.property.id} initialCompleteness={workspace.completeness}>
      <div className="grid gap-6">
        <PropertyHeader workspace={workspace} />
        <PropertyStepNav propertyId={workspace.property.id} states={workspace.steps} />
        <div className="min-w-0">{children}</div>
      </div>
    </PropertyProgressProvider>
  );
}
