/* Service Worker simples (PWA)
 * - Faz o app ser instalável (Android/Chrome exige SW + manifest).
 * - Não cacheia agressivamente para não atrapalhar atualizações.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Sem cache customizado: deixa o browser cuidar, evita bugs durante dev/updates.
self.addEventListener("fetch", () => {});


