import { Construction } from "lucide-react";
import { getMaintenanceState } from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * Hinweis auf Wartungsarbeiten (Server Component).
 * Wird angezeigt, solange in /admin/einstellungen der Wartungsmodus aktiv ist.
 * - variant="bar": volle Breite, ganz oben in öffentlichen Layouts und Login
 * - variant="inline": abgerundete Box, z. B. als erstes Element im Dashboard-Inhalt
 */
export async function MaintenanceBanner({ variant = "bar", className }: { variant?: "bar" | "inline"; className?: string }) {
  const maintenance = await getMaintenanceState();
  if (!maintenance.enabled) return null;
  if (variant === "inline") {
    return (
      <div role="status" className={cn("mb-6 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-bg p-4 text-sm font-medium text-warning", className)}>
        <Construction className="mt-0.5 size-[18px] shrink-0" aria-hidden />
        <p className="leading-relaxed">{maintenance.message}</p>
      </div>
    );
  }
  return (
    <div role="status" className={cn("border-b border-warning/20 bg-warning-bg text-warning", className)}>
      <div className="container-page flex items-start gap-3 py-3 text-sm font-medium sm:items-center">
        <Construction className="mt-0.5 size-[18px] shrink-0 sm:mt-0" aria-hidden />
        <p className="leading-relaxed">{maintenance.message}</p>
      </div>
    </div>
  );
}
