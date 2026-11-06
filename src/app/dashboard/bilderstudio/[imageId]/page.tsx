import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ImageEditor } from "@/components/image-studio/image-editor";
import { ImageAiPanel } from "@/components/image-studio/image-ai-panel";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { imageVariantUrl, propertyImageUrl } from "@/lib/storage";
import { stepHref } from "@/lib/properties/steps";
import { isUuid } from "@/lib/utils";
import { getImageAiStatus } from "@/lib/images/ai-providers";
import { STAGING_ROOM_TYPES, STAGING_STYLES } from "@/lib/images/ai-providers/types";
import { getPropertyWorkspace } from "@/services/properties";
import { getFeatureAvailability } from "@/services/ai/access";
import { loadAiSettings } from "@/services/ai/settings";

// Vorschau und Übernehmen laufen als Server Actions dieser Seite (Bildverarbeitung mit sharp)
export const maxDuration = 60;

export const metadata: Metadata = { title: "Bild bearbeiten" };

const KIND_LABELS: Record<string, string> = {
  enhance: "Optimierung",
  perspective: "Perspektive (Bild-KI)",
  virtual_staging: "Virtuelle Möblierung (Bild-KI)",
};

const STATUS_LABELS: Record<string, string> = {
  accepted: "übernommen",
  discarded: "verworfen",
  ready: "erstellt",
  failed: "fehlgeschlagen",
  pending: "in Arbeit",
};

export default async function ImageStudioPage({ params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  if (!isUuid(imageId)) notFound();
  await requireUser(`/dashboard/bilderstudio/${imageId}`);
  const supabase = await createClient();
  const { data: image } = await supabase
    .from("property_images")
    .select("id, property_id, display_path, base_path, external_url, is_enhanced, is_ai_visualization, is_floor_plan, caption, source_image_id, status")
    .eq("id", imageId)
    .maybeSingle();
  if (!image) notFound();
  // Zugriff nur für Verwaltende des Objekts (404 sonst), zugleich Name des Objekts
  const ws = await getPropertyWorkspace(image.property_id);

  const settings = await loadAiSettings();
  const aiStatus = getImageAiStatus();
  const [availability, aiAvailability, historyRes] = await Promise.all([
    // Grundkorrekturen sind keine KI: Schalter image_ai gilt nicht, das Kontingent schon
    getFeatureAvailability({
      supabase,
      userId: ws.user.id,
      flag: "image_ai",
      quotaFeature: "image_enhance",
      requiresAi: false,
      requiresConsent: false,
      settings: { ...settings, features: { ...settings.features, image_ai: true } },
    }),
    getFeatureAvailability({ supabase, userId: ws.user.id, flag: "image_ai", requiresAi: false, requiresConsent: true, settings }),
    supabase
      .from("image_transformations")
      .select("id, kind, provider, status, created_at")
      .eq("image_id", image.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const alt = image.caption?.trim() || "Bild der Immobilie";
  const currentUrl = propertyImageUrl(image, "md");
  const beforeUrl = image.external_url ? currentUrl : (imageVariantUrl(image.base_path, "md") ?? currentUrl);
  const notEditable = image.external_url
    ? "Demo-Bilder können nicht bearbeitet werden."
    : image.is_ai_visualization
      ? "Dies ist eine KI-Visualisierung. Sie wird nicht weiter bearbeitet; bearbeiten Sie stattdessen das Originalbild."
      : !image.base_path || image.status !== "ready"
        ? "Dieses Bild ist noch nicht vollständig verarbeitet."
        : null;
  const history = historyRes.data ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={
          <Link href={`/dashboard/bilderstudio?immobilie=${ws.property.id}`} className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Bilderstudio · {ws.displayName}
          </Link>
        }
        title="Bild bearbeiten"
        description="Vergleichen Sie Original und Vorschau mit dem Regler. Übernommen wird erst, wenn Sie auf «Übernehmen» klicken."
      />

      {notEditable || !currentUrl || !beforeUrl ? (
        <Alert tone="neutral" title="Nicht bearbeitbar">
          {notEditable ?? "Für dieses Bild ist keine Vorschau verfügbar."}{" "}
          {image.source_image_id ? (
            <Link href={`/dashboard/bilderstudio/${image.source_image_id}`} className="font-semibold underline">
              Zum Originalbild
            </Link>
          ) : null}
        </Alert>
      ) : (
        <ImageEditor imageId={image.id} alt={alt} beforeUrl={beforeUrl} currentUrl={currentUrl} isEnhanced={image.is_enhanced} availability={availability} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ImageAiPanel
          imageId={image.id}
          status={{ configured: aiStatus.configured, message: aiStatus.message }}
          capabilities={aiStatus.provider?.capabilities ?? []}
          availability={aiAvailability}
          roomTypes={STAGING_ROOM_TYPES}
          styles={STAGING_STYLES}
          editable={!notEditable}
        />
        <section aria-labelledby="image-history-title" className="grid content-start gap-3 rounded-2xl border border-border bg-card p-5">
          <h2 id="image-history-title" className="font-display text-base font-bold">
            Verlauf
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Bearbeitung.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {history.map((entry) => (
                <li key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-2">
                  <span>
                    {KIND_LABELS[entry.kind] ?? entry.kind} · {STATUS_LABELS[entry.status] ?? entry.status}
                  </span>
                  <span className="tabular text-muted-foreground">{formatDateTime(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={stepHref(ws.property.id, "bilder")} className="text-sm font-semibold text-primary hover:underline">
            Reihenfolge, Titelbild und Grundrisse verwalten
          </Link>
        </section>
      </div>
    </div>
  );
}
