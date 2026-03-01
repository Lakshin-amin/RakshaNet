// service-worker.js — RakshaNet PWA
const CACHE_NAME = "rakshanet-v1";

const SHELL = [
  "/",
  "/index.html",
  "/pages/safety-tips.html",
  "/pages/emergency-contacts.html",
  "/pages/dashboard.html",
  "/pages/journey.html",
  "/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // ✅ Ignore chrome-extension:// and any non-http requests
  if (!e.request.url.startsWith("http")) return;

  const url = new URL(e.request.url);

  // Network-only for API/backend/auth calls
  if (
    url.hostname.includes("onrender.com")    ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("googleapis.com")  ||
    url.hostname.includes("openai.com")      ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((response) => {
          if (e.request.method === "GET" && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (e.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});