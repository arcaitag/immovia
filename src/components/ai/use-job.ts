"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { isJobFinished, type JobStatusDto } from "@/lib/ai/job-status";

async function fetchJob(jobId: string): Promise<JobStatusDto> {
  const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Der Status konnte nicht abgefragt werden.");
  }
  return (await response.json()) as JobStatusDto;
}

/**
 * Fragt den Status eines Hintergrundauftrags ab (alle 1.5 s), bis er abgeschlossen ist.
 * onSuccess/onError werden genau einmal pro Job aufgerufen.
 */
export function useJob(
  jobId: string | null,
  handlers: { onSuccess?: (job: JobStatusDto) => void; onError?: (job: JobStatusDto) => void } = {},
) {
  const handlersRef = React.useRef(handlers);
  React.useEffect(() => {
    handlersRef.current = handlers;
  });
  const handled = React.useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["ai-job", jobId],
    enabled: Boolean(jobId),
    queryFn: () => fetchJob(jobId!),
    refetchInterval: (q) => (isJobFinished(q.state.data?.status) ? false : 1500),
    staleTime: 0,
    gcTime: 60_000,
    retry: 3,
  });

  const job = query.data;
  React.useEffect(() => {
    if (!job || !isJobFinished(job.status) || handled.current === job.id) return;
    handled.current = job.id;
    if (job.status === "succeeded") handlersRef.current.onSuccess?.(job);
    else handlersRef.current.onError?.(job);
  }, [job]);

  const running = Boolean(jobId) && !isJobFinished(job?.status) && !query.isError;
  return { job, running, error: query.error as Error | null };
}
