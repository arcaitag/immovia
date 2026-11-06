import { Lightbulb } from "lucide-react";
import { StepFooterNav, StepHeader } from "@/components/property-wizard/step-header";
import { ImageManager } from "@/components/property-images/image-manager";
import { createClient } from "@/lib/supabase/server";
import { MAX_UPLOAD_BYTES } from "@/lib/images/processing";
import { getPropertyWorkspace, propertyStepTitle } from "@/services/properties";
import { listPropertyImages } from "@/services/property-images";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: await propertyStepTitle(id, "Bilder") };
}

const TIPS = [
  "Fotografieren Sie bei Tageslicht, Lampen eingeschaltet, Fenster geöffnet.",
  "Räume aufräumen, persönliche Gegenstände entfernen.",
  "Querformat aus Augenhöhe, Kamera gerade halten.",
  "Aussenansicht als Titelbild wirkt in der Suche am besten.",
];

export default async function ImagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getPropertyWorkspace(id);
  const supabase = await createClient();
  const images = await listPropertyImages(supabase, ws.property.id);

  return (
    <div className="grid gap-6">
      <StepHeader
        step={3}
        title="Bilder hochladen"
        description="Laden Sie Ihre Fotos hoch, legen Sie die Reihenfolge und das Titelbild fest. Die Originale bleiben privat gespeichert; öffentlich erscheinen verkleinerte Versionen ohne Standortdaten."
      />
      <ImageManager
        propertyId={ws.property.id}
        images={images.map((image) => ({
          id: image.id,
          display_path: image.display_path,
          base_path: image.base_path,
          external_url: image.external_url,
          width: image.width,
          height: image.height,
          sort_order: image.sort_order,
          is_cover: image.is_cover,
          caption: image.caption,
          is_floor_plan: image.is_floor_plan,
          is_enhanced: image.is_enhanced,
          is_ai_visualization: image.is_ai_visualization,
          status: image.status,
        }))}
        maxImages={ws.publishing.maxImages}
        minImages={ws.publishing.minImages}
        maxBytes={MAX_UPLOAD_BYTES}
      />
      <aside className="rounded-2xl border border-border bg-surface p-5">
        <p className="mb-3 flex items-center gap-2 font-display font-bold">
          <Lightbulb className="size-5 text-brand" aria-hidden /> Tipps für gute Fotos
        </p>
        <ul className="grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          {TIPS.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden /> {tip}
            </li>
          ))}
        </ul>
      </aside>
      <StepFooterNav propertyId={ws.property.id} current="bilder" />
    </div>
  );
}
