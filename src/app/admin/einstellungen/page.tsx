import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { SettingsSectionForm, type SettingField } from "@/components/admin/settings-forms";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import {
  AI_QUOTA_FIELDS,
  FEATURE_FLAGS,
  SETTING_SECTIONS,
  VALUATION_FIELDS,
  parseSettingSection,
  type SettingKey,
} from "@/lib/validation/admin";
import { getSettingRows } from "@/services/admin";

export const metadata: Metadata = { title: "Einstellungen" };

const FIELDS: Record<SettingKey, SettingField[]> = {
  platform: [
    { kind: "text", name: "name", label: "Plattformname", required: true },
    { kind: "text", name: "contact_email", label: "Kontakt-E-Mail", type: "email", hint: "Wird als Kontaktadresse angezeigt." },
    { kind: "text", name: "contact_phone", label: "Kontakttelefon", type: "tel" },
    { kind: "textarea", name: "address", label: "Postadresse", rows: 3, hint: "Für Impressum und E-Mails." },
  ],
  maintenance: [
    { kind: "switch", name: "enabled", label: "Wartungsmodus aktiv", description: "Zeigt den Hinweis auf allen Seiten an. Funktionen werden dadurch nicht gesperrt." },
    { kind: "textarea", name: "message", label: "Hinweistext", rows: 3, required: true },
  ],
  publishing: [
    {
      kind: "switch",
      name: "require_review",
      label: "Prüfung vor Veröffentlichung",
      description: "Inserate müssen zur Prüfung eingereicht und von der Moderation freigegeben werden.",
    },
    { kind: "number", name: "min_images", label: "Mindestanzahl Bilder", hint: "0 bis 20. Wird beim Veröffentlichen geprüft.", min: 0, max: 20 },
    { kind: "number", name: "max_images", label: "Höchstzahl Bilder pro Objekt", hint: "1 bis 100. Gilt für den Bild-Upload.", min: 1, max: 100 },
  ],
  ai_quotas: (Object.keys(AI_QUOTA_FIELDS) as Array<keyof typeof AI_QUOTA_FIELDS>).map((name) => ({
    kind: "number" as const,
    name,
    label: AI_QUOTA_FIELDS[name],
    hint: "0 bis 10’000",
    min: 0,
    max: 10_000,
  })),
  features: (Object.keys(FEATURE_FLAGS) as Array<keyof typeof FEATURE_FLAGS>).map((name) => ({
    kind: "switch" as const,
    name,
    label: FEATURE_FLAGS[name].label,
    description: FEATURE_FLAGS[name].description,
  })),
  valuation: (Object.keys(VALUATION_FIELDS) as Array<keyof typeof VALUATION_FIELDS>).map((name) => ({
    kind: "number" as const,
    name,
    label: VALUATION_FIELDS[name].label,
    hint: VALUATION_FIELDS[name].hint,
    step: VALUATION_FIELDS[name].step,
  })),
};

const ORDER: SettingKey[] = ["maintenance", "publishing", "features", "ai_quotas", "valuation", "platform"];
const ANCHORS: Record<SettingKey, string> = {
  platform: "plattform",
  maintenance: "wartungsmodus",
  publishing: "veroeffentlichung",
  ai_quotas: "ki-kontingente",
  features: "funktionen",
  valuation: "bewertung",
};

export default async function AdminSettingsPage() {
  await requireAdmin();
  const rows = await getSettingRows();
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Einstellungen"
        description="Zentrale Vorgaben der Plattform. Jede Änderung wird mit Ihrem Namen im Protokoll gespeichert und wirkt sofort."
      />
      <nav aria-label="Abschnitte" className="flex flex-wrap gap-2">
        {ORDER.map((key) => (
          <a
            key={key}
            href={`#${ANCHORS[key]}`}
            className="rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:border-mint-300 hover:bg-mint-50"
          >
            {SETTING_SECTIONS[key].title}
          </a>
        ))}
      </nav>

      {ORDER.map((key) => {
        const row = byKey.get(key);
        const values = parseSettingSection(key, row?.value) as Record<string, unknown>;
        return (
          <Card key={key} id={ANCHORS[key]} className="scroll-mt-24">
            <CardHeader>
              <CardTitle>{SETTING_SECTIONS[key].title}</CardTitle>
              <CardDescription>
                {SETTING_SECTIONS[key].description}
                {row ? (
                  <span className="mt-1 block text-xs">
                    Zuletzt geändert {formatDateTime(row.updatedAt)}
                    {row.updatedBy ? ` von ${row.updatedBy}` : ""}
                  </span>
                ) : (
                  <span className="mt-1 block text-xs">Noch nicht gespeichert, Standardwerte aktiv.</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsSectionForm
                settingKey={key}
                initialValues={values}
                fields={FIELDS[key]}
                columns={key === "ai_quotas" || key === "valuation" || key === "publishing" ? 2 : 1}
                notice={
                  key === "valuation" ? (
                    <Alert tone="info">
                      Die Bewertung nutzt ausschliesslich Angebotspreise echter, veröffentlichter Inserate. Unterhalb der
                      Mindestanzahl Vergleichsobjekte wird keine Zahl angezeigt.
                    </Alert>
                  ) : key === "ai_quotas" ? (
                    <Alert tone="info">Die Kontingente gelten pro Benutzer und werden von den KI-Funktionen vor jedem Aufruf geprüft.</Alert>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
