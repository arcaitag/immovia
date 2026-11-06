import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export type AiUnavailableReason = "not_configured" | "service_role_missing" | "feature_disabled" | "no_consent" | "quota_exceeded";

export interface AvailabilityView {
  available: boolean;
  reason?: AiUnavailableReason;
  message?: string;
  quota?: { used: number; limit: number; remaining: number; period: "day" | "month"; resetsAt: string; unit: string };
}

const TITLES: Record<AiUnavailableReason, string> = {
  not_configured: "KI nicht konfiguriert",
  service_role_missing: "Hintergrundaufträge nicht eingerichtet",
  feature_disabled: "Funktion vorübergehend deaktiviert",
  no_consent: "Keine Einwilligung zur KI-Verarbeitung",
  quota_exceeded: "Kontingent ausgeschöpft",
};

/** Klarer Zustand «nicht verfügbar» mit Erklärung (statt Platzhalter-Ergebnissen). */
export function AiUnavailableNotice({ availability, className }: { availability: AvailabilityView; className?: string }) {
  if (availability.available || !availability.reason) return null;
  return (
    <Alert
      tone={availability.reason === "quota_exceeded" || availability.reason === "no_consent" ? "warning" : "neutral"}
      title={TITLES[availability.reason]}
      className={className}
      action={
        availability.reason === "no_consent" ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/einstellungen">Einstellungen</Link>
          </Button>
        ) : undefined
      }
    >
      {availability.message}
    </Alert>
  );
}

/** Kurzer Hinweis zum verbleibenden Kontingent. */
export function QuotaHint({ quota, className }: { quota?: AvailabilityView["quota"]; className?: string }) {
  if (!quota) return null;
  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      Noch {quota.remaining} von {quota.limit} {quota.unit} {quota.period === "day" ? "heute" : "in diesem Monat"} · Zurücksetzung am{" "}
      {formatDate(quota.resetsAt)}
    </p>
  );
}
