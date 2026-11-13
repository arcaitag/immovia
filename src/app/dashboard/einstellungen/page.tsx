import type { Metadata } from "next";
import Link from "next/link";
import { Download, User } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NotificationSettingsForm } from "@/components/account/notification-settings-form";
import { PreferencesForm } from "@/components/account/preferences-form";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { requireUser } from "@/lib/auth/session";
import { getServiceStatus } from "@/lib/env";
import { getImageAiStatus, getImageConsentInfo } from "@/lib/images/ai-providers";
import { getAccountSettings } from "@/services/account";
import { getOwnedOrganizationsWithMembers } from "@/services/organizations";

export const metadata: Metadata = { title: "Einstellungen" };
// Kontolöschung entfernt ggf. viele Dateien im Storage
export const maxDuration = 60;

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/einstellungen");
  const [{ notifications, preferences }, blockers] = await Promise.all([
    getAccountSettings(user.id),
    getOwnedOrganizationsWithMembers(user.id),
  ]);
  const aiConfigured = getServiceStatus().find((s) => s.key === "ai_text")?.configured ?? false;
  const imageAiConfigured = getImageAiStatus().configured;

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Einstellungen"
        description="Benachrichtigungen, Datenschutz und Ihr Konto."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/profil">
              <User aria-hidden /> Profil
            </Link>
          </Button>
        }
      />

      <Card id="benachrichtigungen">
        <CardHeader>
          <CardTitle>E-Mail-Benachrichtigungen</CardTitle>
          <CardDescription>Wählen Sie, worüber wir Sie per E-Mail informieren.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications ? (
            <NotificationSettingsForm
              defaultValues={{
                email_new_message: notifications.email_new_message,
                email_new_inquiry: notifications.email_new_inquiry,
                email_viewings: notifications.email_viewings,
                email_search_alerts: notifications.email_search_alerts,
                email_listing_updates: notifications.email_listing_updates,
                email_documents: notifications.email_documents,
                email_product_news: notifications.email_product_news,
              }}
            />
          ) : (
            <Alert tone="warning">Ihre Benachrichtigungseinstellungen konnten nicht geladen werden.</Alert>
          )}
        </CardContent>
      </Card>

      <Card id="datenschutz">
        <CardHeader>
          <CardTitle>Datenschutz und Präferenzen</CardTitle>
          <CardDescription>Ihre Einwilligungen können Sie jederzeit ändern.</CardDescription>
        </CardHeader>
        <CardContent>
          {preferences ? (
            <PreferencesForm
              aiConfigured={aiConfigured}
              imageAi={{ configured: imageAiConfigured, ...getImageConsentInfo() }}
              defaultValues={{
                ai_processing_consent: preferences.ai_processing_consent,
                ai_image_consent: preferences.ai_image_consent,
                analytics_consent: preferences.analytics_consent,
                marketing_consent: preferences.marketing_consent,
                default_offer_type: preferences.default_offer_type ?? "none",
              }}
            />
          ) : (
            <Alert tone="warning">Ihre Präferenzen konnten nicht geladen werden.</Alert>
          )}
        </CardContent>
      </Card>

      <Card id="datenexport">
        <CardHeader>
          <CardTitle>Ihre Daten herunterladen</CardTitle>
          <CardDescription>
            Alle Daten, die wir zu Ihrem Konto speichern, als JSON-Datei: Profil, Einstellungen, Immobilien, Inserate,
            Nachrichten, Anfragen, Besichtigungen, Bewertungen, Firmenmitgliedschaften und KI-Nutzung.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Bilder und Dokumente laden Sie bei den jeweiligen Objekten herunter.
          </p>
          <Button asChild variant="outline">
            <a href="/api/account/export" download>
              <Download aria-hidden /> Daten herunterladen
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card id="konto-loeschen" className="border-destructive/25">
        <CardHeader>
          <CardTitle>Konto löschen</CardTitle>
          <CardDescription>
            Wir löschen Ihr Konto und alle zugehörigen Daten: Profil, Immobilien, Inserate, Bilder, Dokumente, Dossiers,
            Merkliste und Suchaufträge. Nachrichten, die Sie anderen gesendet haben, bleiben für die Empfänger ohne Ihren
            Namen sichtbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {blockers.length > 0 ? (
            <Alert tone="warning" title="Zuerst Inhaberschaft übertragen">
              Sie sind Inhaber/in von {blockers.map((b) => `«${b.name}»`).join(", ")} mit weiteren Mitgliedern. Übertragen Sie
              die Inhaberschaft oder entfernen Sie die übrigen Mitglieder, bevor Sie Ihr Konto löschen.{" "}
              <Link href="/dashboard/firma" className="font-semibold underline underline-offset-2">
                Zum Firmenkonto
              </Link>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tipp: Laden Sie Ihre Daten vorher herunter. Die Löschung kann nicht rückgängig gemacht werden.
            </p>
            <DeleteAccountDialog disabled={blockers.length > 0} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
