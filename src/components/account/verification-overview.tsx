import Link from "next/link";
import { BadgeCheck, CircleDashed, MailCheck, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Verifizierungsstatus des Benutzerkontos. Zeigt nur an, was tatsächlich geprüft wurde:
 * E-Mail-Bestätigung aus Supabase Auth, Identität nur bei einer gültigen Prüfung durch Immovia.
 */
export function VerificationOverview({
  emailConfirmedAt,
  identityVerifiedAt,
}: {
  emailConfirmedAt: string | null;
  identityVerifiedAt: string | null;
}) {
  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        <StatusRow
          icon={MailCheck}
          ok={Boolean(emailConfirmedAt)}
          title="E-Mail-Adresse bestätigt"
          detail={emailConfirmedAt ? `Bestätigt am ${formatDate(emailConfirmedAt)}` : "Noch nicht bestätigt"}
        />
        <StatusRow
          icon={ShieldCheck}
          ok={Boolean(identityVerifiedAt)}
          title={identityVerifiedAt ? "Identität verifiziert" : "Identität nicht verifiziert"}
          detail={
            identityVerifiedAt
              ? `Von Immovia geprüft am ${formatDate(identityVerifiedAt)}`
              : "Die Identität wird manuell durch Immovia geprüft, zum Beispiel für Firmenkonten."
          }
        />
      </ul>
      <p className="rounded-xl bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        Eine bestätigte E-Mail-Adresse ist kein Nachweis für Eigentum an einer Immobilie. Die Eigentümerberechtigung wird
        für jedes Objekt separat geprüft.{" "}
        {identityVerifiedAt ? null : (
          <>
            Fragen zur Identitätsprüfung?{" "}
            <Link href="/kontakt" className="font-semibold text-primary underline-offset-2 hover:underline">
              Kontakt aufnehmen
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function StatusRow({
  icon: Icon,
  ok,
  title,
  detail,
}: {
  icon: typeof BadgeCheck;
  ok: boolean;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          ok ? "bg-mint-100 text-forest" : "bg-muted text-muted-foreground",
        )}
      >
        {ok ? <Icon className="size-[18px]" aria-hidden /> : <CircleDashed className="size-[18px]" aria-hidden />}
      </span>
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", !ok && "text-muted-foreground")}>{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </li>
  );
}
