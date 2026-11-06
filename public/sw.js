/* Immovia Service Worker
 * Ermöglicht die Installation als App und zeigt bei fehlender Verbindung eine Offline-Seite.
 * Inhalte werden bewusst nicht zwischengespeichert, damit Inserate und Nachrichten immer aktuell sind.
 */
const CACHE = "immovia-offline-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  // Seiten immer vom Server laden, nie aus dem HTTP-Cache: Sonst liefert der Browser bei
  // «stale-while-revalidate» eine veraltete Fassung (z. B. ein inzwischen gesperrtes Inserat).
  event.respondWith(
    fetch(request, { cache: "no-store" }).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) ?? Response.error();
    }),
  );
});
