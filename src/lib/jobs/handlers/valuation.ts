import "server-only";

import { z } from "zod";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { runValuation } from "@/services/ai/valuation-run";

/** Job «valuation»: Vergleichsbewertung berechnen und speichern. */
export const valuationJobInputSchema = z.object({ withExplanation: z.boolean().default(false) });

export const valuationJobHandler: JobHandler = async ({ job, admin }) => {
  const parsed = valuationJobInputSchema.safeParse(job.input ?? {});
  if (!parsed.success || !job.property_id) throw new PermanentJobError("Ungültiger Bewertungsauftrag.");
  const result = await runValuation({
    admin,
    propertyId: job.property_id,
    userId: job.user_id,
    jobId: job.id,
    withExplanation: parsed.data.withExplanation,
  });
  return result;
};
