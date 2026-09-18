const CACHE_NAME = "lotto-iq-shell-v1";
const SHELL_ASSETS = ["/", "/account", "/faq", "/privacy", "/support"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("supabase") ||
    url.pathname === "/dashboard" ||
    url.pathname.startsWith("/premium")
  )
    return;
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
  );
});
