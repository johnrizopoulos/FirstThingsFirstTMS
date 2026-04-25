const CACHE_VERSION = "ftf-shell-v3";
const OFFLINE_URL = "/offline.html";
const INDEX_URL = "/";
const APP_SHELL = [
  INDEX_URL,
  "/favicon.svg",
  "/favicon-light.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/site.webmanifest",
  OFFLINE_URL,
];

const RUNTIME_ASSET_PREFIXES = ["/assets/"];

function isRuntimeAsset(url) {
  return RUNTIME_ASSET_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        Promise.all(
          APP_SHELL.map((url) =>
            cache
              .add(new Request(url, { cache: "reload" }))
              .catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        try {
          const response = await fetch(request);
          if (response && response.status === 200) {
            cache.put(INDEX_URL, response.clone()).catch(() => undefined);
          }
          return response;
        } catch (err) {
          const cachedIndex = await cache.match(INDEX_URL);
          if (cachedIndex) return cachedIndex;
          const offline = await cache.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response(
            "NO_NETWORK — RECONNECT TO LOAD TASKS",
            {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }
          );
        }
      })()
    );
    return;
  }

  if (!APP_SHELL.includes(url.pathname) && !isRuntimeAsset(url)) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkPromise;
    })
  );
});
