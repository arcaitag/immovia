import { CircleCheck, CircleX } from "lucide-react";
import type { ServiceStatus } from "@/lib/env";
import { cn } from "@/lib/utils";

/** Zeigt, welche externen Dienste konfiguriert sind und was fehlt (ohne Werte offenzulegen). */
export function SystemStatusList({ services }: { services: ServiceStatus[] }) {
  return (
    <ul className="grid gap-3">
      {services.map((service) => (
        <li key={service.key} className="flex items-start gap-3">
          {service.configured ? (
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          ) : (
            <CircleX className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {service.label}
              <span className={cn("ml-2 text-xs font-medium", service.configured ? "text-success" : "text-warning")}>
                {service.configured ? "konfiguriert" : "nicht konfiguriert"}
              </span>
            </p>
            {!service.configured ? <p className="text-xs leading-relaxed text-muted-foreground">{service.hint}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
