import { publicEnv } from "@/lib/env";

/**
 * Lädt eine Datei per XMLHttpRequest auf eine signierte Supabase-Upload-URL
 * (fetch kennt keinen Upload-Fortschritt). Die Berechtigung steckt im Token der URL.
 */
export function uploadWithProgress(
  signedUrl: string,
  blob: Blob,
  contentType: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "true");
    const apiKey = publicEnv.supabasePublishableKey;
    if (apiKey) xhr.setRequestHeader("apikey", apiKey);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(1, event.loaded / event.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      const message =
        xhr.status === 413
          ? "Die Datei ist zu gross."
          : xhr.status === 400 || xhr.status === 415
            ? "Dieses Dateiformat wird nicht akzeptiert."
            : xhr.status === 401 || xhr.status === 403
              ? "Der Upload wurde abgelehnt. Bitte laden Sie die Seite neu und versuchen Sie es erneut."
              : `Der Upload ist fehlgeschlagen (Fehler ${xhr.status}).`;
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Hochladen. Bitte prüfen Sie Ihre Verbindung."));
    xhr.onabort = () => reject(new Error("Der Upload wurde abgebrochen."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

/** Führt Aufgaben mit begrenzter Parallelität aus. */
export async function runWithConcurrency(tasks: (() => Promise<void>)[], limit: number): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const task = tasks[next];
      next += 1;
      if (task) await task();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
}
