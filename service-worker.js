// service-worker.js — RakshaNet PWA
const CACHE_NAME = "rakshanet-v1";

// App shell — files to cache immediately on install
const SHELL = [
  "/",
  "/index.html",
  "/pages/safety-tips.html",
  "/pages/emergency-contacts.html",
  "/pages/dashboard.html",
  "/pages/journey.html",
  "/src/script.js",
  "/src/fake-call.js",
  "/src/location-share.js",
  "/src/map.js",
  "/src/ai.js",
  "/src/firebase-init.js",
  "/manifest.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
];

// ── Install: cache the app shell ──
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ──
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for API, cache-first for assets ──
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Always go network for backend API calls
  if (
    url.hostname.includes("onrender.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("googleapis.com") ||
    url.pathname.startsWith("/api/")
  ) {
    return; // let browser handle — no caching
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;

      return fetch(e.request)
        .then((response) => {
          // Cache successful GET responses
          if (
            e.request.method === "GET" &&
            response.status === 200 &&
            !url.hostname.includes("openai")
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback for HTML pages
          if (e.request.destination === "document") {
            return caches.match("/index.html");
          }
        });
    })
  );
});