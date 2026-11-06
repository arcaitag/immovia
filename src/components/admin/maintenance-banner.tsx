import { Construction } from "lucide-react";
import { getMaintenanceState } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * Hinweis auf Wartungsarbeiten (Server Component).
 * Wird angezeigt, solange in /admin/einstellungen der Wartungsmodus aktiv ist.
 * Einbinden ganz oben in den Layouts (öffentliche Seiten, Login, Dashboard).
 */
export async function MaintenanceBanner({ className }: { className?: string }) {
  const maintenance = await getMaintenanceState();
  if (!maintenance.enabled) return null;
  return (
    <div role="status" className={cn("border-b border-warning/20 bg-warning-bg text-warning", className)}>
      <div className="container-page flex items-start gap-3 py-3 text-sm font-medium sm:items-center">
        <Construction className="mt-0.5 size-[18px] shrink-0 sm:mt-0" aria-hidden />
        <p className="leading-relaxed">{maintenance.message}</p>
      </div>
    </div>
  );
}
