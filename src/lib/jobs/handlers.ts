import type { JobHandler, JobType } from "@/lib/jobs/types";

/**
 * Registrierte Job-Handler. Jeder Fachbereich trägt hier seinen Handler ein
 * (KI-Texte, Bewertung, Bildoptimierung, Dossier-PDF).
 */
export const JOB_HANDLERS: Partial<Record<JobType, JobHandler>> = {};
