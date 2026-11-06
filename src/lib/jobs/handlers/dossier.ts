import "server-only";

import { createElement } from "react";
import { z } from "zod";
import type { Json } from "@/types/database";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { DossierDocument } from "@/lib/pdf/dossier/document";
import { dossierOptionsSchema } from "@/lib/pdf/dossier/options";
import { renderPdf } from "@/lib/pdf/render";
import { buildDossierContent } from "@/services/ai/dossier-data";
import { loadAiSettings } from "@/services/ai/settings";

/**
 * Job «dossier_pdf»: Verkaufsdossier erzeugen, in Storage speichern
 * (dossiers/{propertyId}/{dossierId}.pdf) und als neue Version erfassen.
 * Bei einer Wiederholung desselben Jobs wird dieselbe Version weiterverwendet.
 */

export const dossierJobInputSchema = z.object({ options: dossierOptionsSchema });

export const dossierJobHandler: JobHandler = async ({ job, admin }) => {
  const parsed = dossierJobInputSchema.safeParse(job.input);
  if (!parsed.success || !job.property_id) throw new PermanentJobError("Ungültiger Auftrag für das Verkaufsdossier.");
  const propertyId = job.property_id;
  const options = parsed.data.options;

  const settings = await loadAiSettings(admin);
  if (!settings.features.dossiers) throw new PermanentJobError("Die Dossier-Funktion ist derzeit deaktiviert.");

  const built = await buildDossierContent({ client: admin, propertyId, options, isPreview: false });

  // Version: bestehende Zeile dieses Jobs weiterverwenden, sonst nächste Versionsnummer
  const { data: existing } = await admin
    .from("generated_dossiers")
    .select("id, version")
    .eq("property_id", propertyId)
    .eq("options->>jobId", job.id)
    .maybeSingle();

  let dossier = existing;
  for (let attempt = 0; !dossier && attempt < 3; attempt++) {
    const { data: latest } = await admin
      .from("generated_dossiers")
      .select("version")
      .eq("property_id", propertyId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await admin
      .from("generated_dossiers")
      .insert({
        property_id: propertyId,
        listing_id: built.listingId,
        created_by: job.user_id,
        template_id: options.templateId,
        version: (latest?.version ?? 0) + 1,
        status: "generating",
        options: { ...options, jobId: job.id } as unknown as Json,
      })
      .select("id, version")
      .single();
    if (data) dossier = data;
    else if (error?.code !== "23505") throw new Error(`Dossier-Version konnte nicht angelegt werden: ${error?.message ?? "unbekannt"}`);
  }
  if (!dossier) throw new Error("Dossier-Version konnte nicht angelegt werden.");

  try {
    const { buffer, pageCount } = await renderPdf(createElement(DossierDocument, { content: built.content }));
    const storagePath = `${propertyId}/${dossier.id}.pdf`;
    const { error: uploadError } = await admin.storage
      .from("dossiers")
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true, cacheControl: "3600" });
    if (uploadError) throw new Error(`PDF konnte nicht gespeichert werden: ${uploadError.message}`);
    const { error: updateError } = await admin
      .from("generated_dossiers")
      .update({ status: "ready", storage_path: storagePath, file_size: buffer.length, page_count: pageCount, error_message: null })
      .eq("id", dossier.id);
    if (updateError) throw new Error(updateError.message);
    return { dossierId: dossier.id, version: dossier.version, pageCount, fileSize: buffer.length, skippedImages: built.skippedImages };
  } catch (error) {
    await admin
      .from("generated_dossiers")
      .update({ status: "failed", error_message: (error instanceof Error ? error.message : "Unbekannter Fehler").slice(0, 500) })
      .eq("id", dossier.id);
    throw error;
  }
};
