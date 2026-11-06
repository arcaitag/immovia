import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { IdentityVerificationAction, UserRoleActions, UserStatusAction } from "@/components/admin/user-actions";
import { requireModerator } from "@/lib/auth/session";
import { LISTING_STATUS, REPORT_REASONS } from "@/lib/constants";
import { formatDate, formatDateTime, formatPhone } from "@/lib/format";
import { isUuid } from "@/lib/utils";
import { APP_ROLES, MODERATION_STATUS, REPORT_STATUS, USER_STATUS, VERIFICATION_STATUS } from "@/lib/validation/admin";
import { ORG_ROLES } from "@/lib/validation/organization";
import { getUserDetail } from "@/services/admin";

export const metadata: Metadata = { title: "Benutzer" };

const MODERATION_ACTION_LABELS: Record<string, string> = {
  user_active: "Sperre aufgehoben",
  user_suspended: "Gesperrt",
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireModerator();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const detail = await getUserDetail(id);
  if (!detail) notFound();
  const { user } = detail;
  const isSelf = viewer.id === user.id;
  const currentIdentity = detail.verifications[0];
  const identityVerified = currentIdentity?.status === "verified";

  return (
    <div className="grid gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/admin/benutzer">
          <ArrowLeft aria-hidden /> Alle Benutzer
        </Link>
      </Button>
      <PageHeader
        title={user.displayName}
        description={user.email ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={USER_STATUS[user.status].label} tone={USER_STATUS[user.status].tone} />
            {identityVerified ? (
              <Badge tone="green">
                <BadgeCheck aria-hidden /> Identität verifiziert
              </Badge>
            ) : null}
            {(user.roles ?? []).map((role) => (
              <Badge key={role} tone="dark">
                {APP_ROLES[role].label}
              </Badge>
            ))}
          </div>
        }
      />

      {user.status === "suspended" ? (
        <Alert tone="error" title={`Gesperrt seit ${formatDateTime(user.statusChangedAt)}`}>
          {user.statusReason ? `Begründung: ${user.statusReason}` : "Keine Begründung erfasst."}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Konto</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Info label="Name" value={[user.firstName, user.lastName].filter(Boolean).join(" ") || "–"} />
                <Info label="Kontotyp" value={user.accountType === "business" ? "Geschäftskunde" : "Privatperson"} />
                <Info label="E-Mail" value={user.email ?? "–"} />
                <Info label="E-Mail bestätigt" value={user.emailConfirmed ? "Ja" : "Nein"} />
                <Info label="Telefon" value={user.phone ? formatPhone(user.phone) : "–"} />
                <Info label="Registriert" value={formatDateTime(user.createdAt)} />
                <Info label="Letzte Anmeldung" value={user.lastSignInAt ? formatDateTime(user.lastSignInAt) : "Noch nie"} />
                <Info label="Immobilien" value={String(detail.propertyCount)} />
                <Info label="Benutzer-ID" value={<span className="break-all font-mono text-xs">{user.id}</span>} />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inserate</CardTitle>
              <CardDescription>Neueste 50 Inserate dieses Kontos.</CardDescription>
            </CardHeader>
            <CardContent>
              {detail.listings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Inserate.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {detail.listings.map((listing) => (
                    <li key={listing.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{listing.title ?? "Ohne Titel"}</p>
                        <p className="text-xs text-muted-foreground">Aktualisiert {formatDate(listing.updatedAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge label={LISTING_STATUS[listing.status].label} tone={LISTING_STATUS[listing.status].tone} />
                        {listing.moderationStatus !== "ok" ? (
                          <StatusBadge
                            label={MODERATION_STATUS[listing.moderationStatus].label}
                            tone={MODERATION_STATUS[listing.moderationStatus].tone}
                          />
                        ) : null}
                        {listing.slug && (listing.status === "published" || listing.status === "reserved") ? (
                          <Button asChild variant="ghost" size="icon-sm">
                            <Link href={`/immobilien/${listing.slug}`} target="_blank" aria-label="Öffentliche Seite öffnen">
                              <ExternalLink aria-hidden />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="link" className="mt-2 h-auto px-0">
                <Link href={`/admin/immobilien?inhaber=${user.id}`}>In der Inserateverwaltung öffnen</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meldungen zu diesem Benutzer</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.reports.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Meldungen.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {detail.reports.map((report) => (
                    <li key={report.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span>
                        {(REPORT_REASONS as Record<string, string>)[report.reason] ?? report.reason}
                        <span className="ml-2 text-xs text-muted-foreground">{formatDate(report.createdAt)}</span>
                      </span>
                      <StatusBadge label={REPORT_STATUS[report.status].label} tone={REPORT_STATUS[report.status].tone} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verlauf</CardTitle>
              <CardDescription>Moderationsentscheide und Identitätsprüfungen.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {detail.moderation.length === 0 && detail.verifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>
              ) : null}
              {detail.moderation.length > 0 ? (
                <ul className="grid gap-2">
                  {detail.moderation.map((entry) => (
                    <li key={entry.id} className="rounded-xl bg-muted px-3.5 py-2.5 text-sm">
                      <p className="font-semibold">
                        {MODERATION_ACTION_LABELS[entry.action] ?? entry.action}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                          {entry.actor ? ` · ${entry.actor}` : ""}
                        </span>
                      </p>
                      {entry.reason ? <p className="mt-0.5 text-xs text-muted-foreground">{entry.reason}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {detail.verifications.length > 0 ? (
                <ul className="grid gap-2">
                  {detail.verifications.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3.5 py-2.5 text-sm">
                      <span>
                        Identität: {v.method ?? "ohne Angabe"}
                        <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(v.createdAt)}</span>
                      </span>
                      <StatusBadge label={VERIFICATION_STATUS[v.status].label} tone={VERIFICATION_STATUS[v.status].tone} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Aktionen</CardTitle>
              {!viewer.isAdmin ? <CardDescription>Nur Administratoren können Konten sperren, Rollen vergeben und Identitäten verifizieren.</CardDescription> : null}
            </CardHeader>
            {viewer.isAdmin ? (
              <CardContent className="grid gap-4">
                {isSelf ? (
                  <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Ihr eigenes Konto können Sie nicht sperren.</p>
                ) : (
                  <UserStatusAction userId={user.id} displayName={user.displayName} status={user.status} />
                )}
                <IdentityVerificationAction userId={user.id} displayName={user.displayName} verified={identityVerified} />
                <div className="grid gap-2 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rollen</p>
                  <UserRoleActions userId={user.id} displayName={user.displayName} roles={user.roles ?? []} isSelf={isSelf} />
                </div>
              </CardContent>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Firmen</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">Kein Firmenkonto.</p>
              ) : (
                <ul className="grid gap-3">
                  {detail.memberships.map((m, index) => (
                    <li key={m.organization?.id ?? index} className="text-sm">
                      <p className="font-semibold">{m.organization?.name ?? "Unbekannte Firma"}</p>
                      <p className="text-xs text-muted-foreground">
                        {ORG_ROLES[m.role].label}
                        {m.organization?.status === "suspended" ? " · Firma gesperrt" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="link" className="mt-2 h-auto px-0">
                <Link href="/admin/firmen">Zur Firmenverwaltung</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm">{value}</dd>
    </div>
  );
}
