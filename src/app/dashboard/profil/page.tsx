import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/account/profile-form";
import { AvatarUpload } from "@/components/account/avatar-upload";
import { EmailChangeForm } from "@/components/account/email-change-form";
import { PasswordChangeForm } from "@/components/account/password-change-form";
import { VerificationOverview } from "@/components/account/verification-overview";
import { requireUser } from "@/lib/auth/session";
import { getAccountOverview } from "@/services/account";
import { publicStorageUrl } from "@/lib/storage";
import { formatDate, formatDateTime } from "@/lib/format";
import { firstParam } from "@/lib/validation/admin";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/dashboard/profil");
  const [overview, params] = await Promise.all([getAccountOverview(user), searchParams]);
  const profile = overview.profile;
  const emailNotice = firstParam(params.email) === "bestaetigt";

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Profil"
        description="Ihre persönlichen Angaben, Ihr Profilbild und Ihre Anmeldedaten."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/einstellungen">
              <Settings aria-hidden /> Einstellungen
            </Link>
          </Button>
        }
      />

      {user.profile.status !== "active" ? (
        <Alert tone="error" title="Ihr Konto ist derzeit gesperrt">
          Sie können Ihre Angaben im Moment nicht ändern. Bitte kontaktieren Sie den Support.
          {profile.status_reason ? <span className="mt-1 block">Begründung: {profile.status_reason}</span> : null}
        </Alert>
      ) : null}
      {emailNotice ? (
        <Alert tone={overview.pendingEmail ? "info" : "success"}>
          {overview.pendingEmail
            ? "Bestätigung erhalten. Bitte öffnen Sie auch den Link in der zweiten E-Mail, damit die Änderung wirksam wird."
            : "Ihre E-Mail-Adresse ist bestätigt."}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Persönliche Angaben</CardTitle>
              <CardDescription>So erscheinen Sie bei Interessenten und Verkäufern.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                email={overview.email}
                defaultValues={{
                  firstName: profile.first_name ?? "",
                  lastName: profile.last_name ?? "",
                  displayName: profile.display_name,
                  phone: profile.phone ?? "",
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>E-Mail-Adresse</CardTitle>
              <CardDescription>Mit dieser Adresse melden Sie sich an und erhalten Benachrichtigungen.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmailChangeForm currentEmail={overview.email} pendingEmail={overview.pendingEmail} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Passwort</CardTitle>
              <CardDescription>Zur Sicherheit bestätigen Sie die Änderung mit Ihrem aktuellen Passwort.</CardDescription>
            </CardHeader>
            <CardContent>
              <PasswordChangeForm />
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profilbild</CardTitle>
            </CardHeader>
            <CardContent>
              <AvatarUpload avatarUrl={publicStorageUrl("avatars", profile.avatar_path)} displayName={profile.display_name} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verifizierung</CardTitle>
            </CardHeader>
            <CardContent>
              <VerificationOverview
                emailConfirmedAt={overview.emailConfirmedAt}
                identityVerifiedAt={overview.identity?.status === "verified" ? overview.identity.verifiedAt : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Konto</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Kontotyp</dt>
                  <dd>
                    <Badge tone={profile.account_type === "business" ? "green" : "neutral"}>
                      {profile.account_type === "business" ? "Geschäftskunde" : "Privatperson"}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Mitglied seit</dt>
                  <dd className="font-medium">{formatDate(overview.createdAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Letzte Anmeldung</dt>
                  <dd className="text-right font-medium">{formatDateTime(overview.lastSignInAt)}</dd>
                </div>
              </dl>
              {profile.account_type === "business" || user.organizations.length > 0 ? (
                <Button asChild variant="link" className="mt-4 h-auto">
                  <Link href="/dashboard/firma">Zum Firmenkonto</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
