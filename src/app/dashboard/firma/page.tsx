import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Building2, ExternalLink, Globe, House, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import { OrganizationProfileForm } from "@/components/organization/organization-profile-form";
import { OrganizationProfileView } from "@/components/organization/organization-profile-view";
import { LogoUpload, OrganizationLogo } from "@/components/organization/logo-upload";
import { MembersList } from "@/components/organization/members-list";
import { InvitationsList, InviteMemberForm } from "@/components/organization/invitations";
import { LeaveOrganizationButton } from "@/components/organization/leave-organization-button";
import { requireUser } from "@/lib/auth/session";
import { getServiceStatus } from "@/lib/env";
import { getPlatformSettings } from "@/lib/settings";
import { publicStorageUrl } from "@/lib/storage";
import { formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { firstParam } from "@/lib/validation/admin";
import { ORG_ROLES, type OrganizationProfileInput } from "@/lib/validation/organization";
import { getMyMemberships, getOrganizationDetail } from "@/services/organizations";

export const metadata: Metadata = { title: "Firmenkonto" };

const BENEFITS = [
  { icon: Building2, text: "Firmenprofil mit Logo, Adresse und Kontaktangaben" },
  { icon: Globe, text: "Öffentliche Firmenseite mit Ihren aktiven Inseraten" },
  { icon: Users, text: "Mitarbeitende einladen und Rollen vergeben" },
  { icon: House, text: "Immobilien der Firma gemeinsam bearbeiten" },
];

export default async function OrganizationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/dashboard/firma");
  const [memberships, settings, params] = await Promise.all([getMyMemberships(user.id), getPlatformSettings(), searchParams]);
  const visible = memberships.filter((m) => m.organization !== null);
  const blocked = memberships.filter((m) => m.organization === null);
  const requested = firstParam(params.firma);
  const selected = visible.find((m) => m.organizationId === requested) ?? visible[0];

  if (!selected) {
    return (
      <div className="grid gap-8">
        <PageHeader
          title="Firmenkonto"
          description="Für Immobilienfirmen, Makler und Verwaltungen: gemeinsam Immobilien verwalten und im Team arbeiten."
        />
        {blocked.length > 0 ? (
          <Alert tone="error" title="Ihr Firmenkonto ist derzeit gesperrt">
            Sie sind Mitglied eines Firmenkontos, das gesperrt wurde. Bitte kontaktieren Sie den Support.
          </Alert>
        ) : null}
        {settings.features.business_accounts ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card>
              <CardHeader>
                <CardTitle>Firmenkonto erstellen</CardTitle>
                <CardDescription>Firmenkonten sind derzeit kostenlos.</CardDescription>
              </CardHeader>
              <CardContent>
                <CreateOrganizationForm defaultEmail={user.email} />
              </CardContent>
            </Card>
            <Card className="bg-mint-50">
              <CardHeader>
                <CardTitle>Das erhalten Sie</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-4">
                  {BENEFITS.map((benefit) => (
                    <li key={benefit.text} className="flex items-start gap-3 text-sm">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-forest shadow-card">
                        <benefit.icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="pt-2 leading-snug">{benefit.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                  Wurden Sie von einer Firma eingeladen? Öffnen Sie den Link aus der Einladungs-E-Mail, um beizutreten.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="Firmenkonten sind derzeit nicht verfügbar"
            description="Neue Firmenkonten können im Moment nicht erstellt werden. Einladungen bestehender Firmen funktionieren weiterhin."
          />
        )}
      </div>
    );
  }

  const detail = await getOrganizationDetail(selected.organizationId, user.id);
  if (!detail) notFound();
  const { organization, myRole } = detail;
  const canManage = myRole === "owner" || myRole === "admin";
  const logoUrl = publicStorageUrl("org-logos", organization.logo_path);
  const publicProfile = organization.is_public && organization.status === "active";
  const emailConfigured = getServiceStatus().find((s) => s.key === "email")?.configured ?? false;
  const verified = detail.verification?.status === "verified";

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Firmenkonto"
        title={organization.name}
        description={`Sie sind ${ORG_ROLES[myRole].label} dieses Firmenkontos.`}
        actions={
          publicProfile ? (
            <Button asChild variant="outline">
              <Link href={`/firmen/${organization.slug}`} target="_blank">
                <ExternalLink aria-hidden /> Öffentliche Firmenseite
              </Link>
            </Button>
          ) : null
        }
      />

      {visible.length > 1 ? (
        <nav aria-label="Firmenkonto wählen" className="-mt-2 flex flex-wrap gap-2">
          {visible.map((m) => (
            <Link
              key={m.organizationId}
              href={`/dashboard/firma?firma=${m.organizationId}`}
              aria-current={m.organizationId === selected.organizationId ? "page" : undefined}
              className={cn(
                "rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:border-mint-300 hover:bg-mint-50",
                m.organizationId === selected.organizationId && "border-brand bg-mint-100 text-forest",
              )}
            >
              {m.organization?.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {blocked.length > 0 ? (
        <Alert tone="warning">Ein weiteres Firmenkonto, in dem Sie Mitglied sind, ist derzeit gesperrt.</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Firmenprofil</CardTitle>
              <CardDescription>
                {canManage
                  ? "Diese Angaben erscheinen auf Ihrer Firmenseite und bei den Inseraten der Firma."
                  : "Angaben der Firma, wie sie öffentlich erscheinen."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canManage ? (
                <OrganizationProfileForm
                  defaultValues={{
                    organizationId: organization.id,
                    name: organization.name,
                    description: organization.description ?? "",
                    street: organization.street ?? "",
                    postalCode: organization.postal_code ?? "",
                    city: organization.city ?? "",
                    canton: (organization.canton ?? "") as OrganizationProfileInput["canton"],
                    phone: organization.phone ?? "",
                    email: organization.email ?? "",
                    website: organization.website ?? "",
                    uidNumber: organization.uid_number ?? "",
                    isPublic: organization.is_public,
                  }}
                />
              ) : (
                <OrganizationProfileView organization={organization} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mitglieder</CardTitle>
              <CardDescription>
                {pluralize(detail.members.length, "Mitglied", "Mitglieder")}. Alle Mitglieder können die Immobilien der Firma
                bearbeiten; Inhaber und Administratoren verwalten zusätzlich Profil und Team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MembersList
                organizationId={organization.id}
                myRole={myRole}
                members={detail.members.map((m) => ({
                  userId: m.userId,
                  role: m.role,
                  displayName: m.displayName,
                  avatarUrl: publicStorageUrl("avatars", m.avatarPath),
                  email: m.email,
                  joinedAt: m.joinedAt,
                  isMe: m.isMe,
                }))}
              />
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Mitarbeitende einladen</CardTitle>
                <CardDescription>Laden Sie Kolleginnen und Kollegen per E-Mail in Ihr Firmenkonto ein.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <InviteMemberForm organizationId={organization.id} emailConfigured={emailConfigured} />
                <div className="grid gap-3">
                  <h3 className="text-sm font-bold">Offene Einladungen</h3>
                  <InvitationsList invitations={detail.invitations} />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
            </CardHeader>
            <CardContent>
              {canManage ? (
                <LogoUpload organizationId={organization.id} name={organization.name} logoUrl={logoUrl} />
              ) : (
                <div className="flex justify-center">
                  <OrganizationLogo url={logoUrl} name={organization.name} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    verified ? "bg-mint-100 text-forest" : "bg-muted text-muted-foreground",
                  )}
                >
                  {verified ? <BadgeCheck className="size-[18px]" aria-hidden /> : <ShieldCheck className="size-[18px]" aria-hidden />}
                </span>
                <div>
                  <p className="font-semibold">{verified ? "Firma verifiziert" : "Firma nicht verifiziert"}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {verified && detail.verification?.verifiedAt
                      ? `Von Immovia geprüft am ${formatDate(detail.verification.verifiedAt)}.`
                      : "Die Prüfung erfolgt manuell durch Immovia, z. B. anhand des Handelsregisters."}
                  </p>
                </div>
              </div>
              <dl className="grid gap-2 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Firmenseite</dt>
                  <dd>
                    <StatusBadge label={publicProfile ? "Öffentlich" : "Nicht öffentlich"} tone={publicProfile ? "green" : "neutral"} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Aktive Inserate</dt>
                  <dd className="font-semibold tabular">{detail.activeListings}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Erstellt am</dt>
                  <dd className="font-medium">{formatDate(organization.created_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {myRole !== "owner" ? (
            <Card>
              <CardHeader>
                <CardTitle>Firmenkonto verlassen</CardTitle>
                <CardDescription>Ihre eigenen Daten bleiben erhalten.</CardDescription>
              </CardHeader>
              <CardContent>
                <LeaveOrganizationButton organizationId={organization.id} organizationName={organization.name} />
              </CardContent>
            </Card>
          ) : (
            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              Als Inhaber/in können Sie das Firmenkonto nicht verlassen. Übertragen Sie bei Bedarf zuerst die Inhaberschaft an
              ein anderes Mitglied.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
