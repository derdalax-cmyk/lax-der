// DERDALAX service worker
// 1) Web Push (push / notificationclick) — unchanged behaviour.
// 2) Minimal app-shell offline cache (Cache API, no Workbox dependency).
//    Navigations: network-first with cache fallback + offline shell.
//    Static hashed assets/icons: stale-while-revalidate.
//    API calls (Supabase, /api/*) are NEVER cached.

const CACHE_VERSION = "v1";
const SHELL_CACHE = `derdalax-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `derdalax-assets-${CACHE_VERSION}`;
const OFFLINE_URL = "/";

const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon-32.png",
];

// Lovable preview / dev hosts must never serve cached HTML.
const HOST = self.location.hostname;
const CACHING_DISABLED =
  HOST === "localhost" ||
  HOST === "127.0.0.1" ||
  HOST.startsWith("id-preview--") ||
  HOST.startsWith("preview--") ||
  HOST === "lovableproject.com" ||
  HOST.endsWith(".lovableproject.com") ||
  HOST === "lovableproject-dev.com" ||
  HOST.endsWith(".lovableproject-dev.com") ||
  HOST === "beta.lovable.dev" ||
  HOST.endsWith(".beta.lovable.dev");

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (CACHING_DISABLED) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: "reload" }))));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.allSettled(
        names
          .filter((n) => n.startsWith("derdalax-") && n !== SHELL_CACHE && n !== ASSET_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

function isApiRequest(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn/") ||
    url.pathname.startsWith("/lovable/") ||
    url.hostname.endsWith(".supabase.co") ||
    url.hostname.endsWith(".supabase.in")
  );
}

// Rotas privadas/autenticadas: nunca cachear HTML nem servir do cache offline.
const PRIVATE_NAV_PREFIXES = [
  "/admin",
  "/perfil",
  "/vendedor",
  "/colaborador",
  "/pedido",
  "/mensagens",
  "/chat",
  "/checkout",
  "/carrinho",
  "/favoritos",
  "/login",
];
function isPrivateNav(url) {
  return PRIVATE_NAV_PREFIXES.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + "/")
  );
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_build/") || url.pathname.startsWith("/assets/")) return true;
  return /\.(js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|ico|webmanifest)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (CACHING_DISABLED) return;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isApiRequest(url)) return; // always live, never cached

  // HTML navigations: network-first, fall back to cache, then offline shell.
  if (request.mode === "navigate") {
    // Páginas privadas: network-only, sem gravar nem ler do cache.
    if (isPrivateNav(url)) {
      event.respondWith(fetch(request).catch(() => Response.error()));
      return;
    }
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        } catch (e) {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
            return response;
          })
          .catch(() => undefined);
        return cached || (await network) || Response.error();
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "DERDALAX", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "DERDALAX";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "derdalax",
    renotify: true,
    data: { url: data.url || "/" },
  };
  if (typeof data.image === "string" && data.image.startsWith("https://")) options.image = data.image;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ("navigate" in client) {
              try { await client.navigate(targetUrl); } catch (e) { /* ignore */ }
            }
            return;
          }
        } catch (e) { /* ignore */ }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
