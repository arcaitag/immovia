import Link from "next/link";
import { CalendarClock, CircleX, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/status-badge";
import { OrganizationLogo } from "@/components/organization/logo-upload";
import { AcceptInvitationButton, SwitchAccountButton } from "@/components/organization/accept-invitation";
import { getSessionUser } from "@/lib/auth/session";
import { publicStorageUrl } from "@/lib/storage";
import { formatDateTime } from "@/lib/format";
import { ORG_ROLES, invitationTokenSchema, parseInvitationPreview, type InvitationPreview } from "@/lib/validation/organization";
import { getInvitationPreview } from "@/services/organizations";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">{children}</div>;
}

function Problem({ icon: Icon, title, text }: { icon: typeof CircleX; title: string; text: string }) {
  return (
    <Shell>
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted-foreground">{text}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">Zum Dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Zur Startseite</Link>
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const parsed = invitationTokenSchema.safeParse(rawToken);
  const token = parsed.success ? parsed.data : null;
  const [preview, user]: [InvitationPreview, Awaited<ReturnType<typeof getSessionUser>>] = await Promise.all([
    token ? getInvitationPreview(token) : Promise.resolve(parseInvitationPreview(null)),
    getSessionUser(),
  ]);

  if (!token || preview.status === "invalid") {
    return (
      <Problem
        icon={CircleX}
        title="Einladung nicht gefunden"
        text="Der Link ist ungültig oder die Firma ist nicht mehr verfügbar. Bitte prüfen Sie, ob Sie den vollständigen Link aus der E-Mail geöffnet haben."
      />
    );
  }
  if (preview.status === "revoked") {
    return (
      <Problem
        icon={CircleX}
        title="Einladung widerrufen"
        text={`Diese Einladung von «${preview.organizationName}» wurde widerrufen. Bitte wenden Sie sich an die Firma, falls Sie eine neue Einladung benötigen.`}
      />
    );
  }
  if (preview.status === "expired") {
    return (
      <Problem
        icon={CalendarClock}
        title="Einladung abgelaufen"
        text={`Diese Einladung von «${preview.organizationName}» ist abgelaufen. Bitten Sie die Firma, Ihnen eine neue Einladung zu senden.`}
      />
    );
  }
  if (preview.status === "accepted" && !preview.alreadyMember) {
    return (
      <Problem
        icon={CircleX}
        title="Einladung bereits verwendet"
        text="Diese Einladung wurde bereits angenommen. Jede Einladung kann nur einmal verwendet werden."
      />
    );
  }

  const back = encodeURIComponent(`/einladung/${token}`);
  const role = preview.role ? ORG_ROLES[preview.role] : null;

  return (
    <Shell>
      <div className="flex flex-col items-center text-center">
        <OrganizationLogo url={publicStorageUrl("org-logos", preview.logoPath)} name={preview.organizationName ?? "Firma"} className="size-24" />
        <p className="mt-5 text-sm font-semibold text-primary">Einladung zum Firmenkonto</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-balance sm:text-[1.75rem]">
          {preview.organizationName}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">
          {preview.invitedBy ? `${preview.invitedBy} lädt Sie ein,` : "Sie wurden eingeladen,"} dem Firmenkonto auf Immovia
          beizutreten.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {role ? <StatusBadge label={`Rolle: ${role.label}`} tone={role.tone} /> : null}
          {preview.expiresAt ? (
            <span className="text-xs text-muted-foreground">Gültig bis {formatDateTime(preview.expiresAt)}</span>
          ) : null}
        </div>
        {role ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{role.description}</p> : null}
      </div>

      <div className="mt-8 grid gap-3 border-t border-border pt-6">
        {preview.alreadyMember ? (
          <>
            <Alert tone="success">Sie sind bereits Mitglied dieses Firmenkontos.</Alert>
            <Button asChild size="lg">
              <Link href="/dashboard/firma">Zum Firmenkonto</Link>
            </Button>
          </>
        ) : !user ? (
          <>
            <p className="text-center text-sm text-muted-foreground">
              Melden Sie sich mit der eingeladenen E-Mail-Adresse <strong className="text-foreground">{preview.emailHint}</strong>{" "}
              an oder erstellen Sie ein kostenloses Konto.
            </p>
            <Button asChild size="lg">
              <Link href={`/login?weiter=${back}`}>
                <UserRound aria-hidden /> Anmelden
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/registrieren?weiter=${back}`}>Konto erstellen</Link>
            </Button>
          </>
        ) : preview.emailMatches ? (
          <AcceptInvitationButton token={token} />
        ) : (
          <>
            <Alert tone="warning" title="Andere E-Mail-Adresse">
              Diese Einladung gilt für {preview.emailHint}. Sie sind als {user.email ?? "anderer Benutzer"} angemeldet. Melden
              Sie sich mit der eingeladenen Adresse an, um die Einladung anzunehmen.
            </Alert>
            <SwitchAccountButton token={token} />
          </>
        )}
      </div>
    </Shell>
  );
}
