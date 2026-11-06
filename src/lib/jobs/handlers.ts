import type { JobHandler, JobType } from "@/lib/jobs/types";

/**
 * Registrierte Job-Handler. Jeder Fachbereich trägt hier seinen Handler ein
 * (KI-Texte, Bewertung, Bildoptimierung, Dossier-PDF).
 *
 * Die Handler werden erst bei Bedarf geladen (dynamischer Import), damit Routen, die nur
 * Jobs einreihen, nicht sharp, @react-pdf/renderer und das KI-SDK beim Start laden.
 */
export const JOB_HANDLERS: Partial<Record<JobType, JobHandler>> = {
  description: async (ctx) => (await import("@/lib/jobs/handlers/description")).descriptionJobHandler(ctx),
  valuation: async (ctx) => (await import("@/lib/jobs/handlers/valuation")).valuationJobHandler(ctx),
  dossier_pdf: async (ctx) => (await import("@/lib/jobs/handlers/dossier")).dossierJobHandler(ctx),
  virtual_staging: async (ctx) => (await import("@/lib/jobs/handlers/image-ai")).imageAiJobHandler(ctx),
  image_enhance: async (ctx) => (await import("@/lib/jobs/handlers/image-ai")).imageAiJobHandler(ctx),
};
