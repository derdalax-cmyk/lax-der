// DERDALAX Web Push service worker
// Handles `push` events and notification clicks. Intentionally minimal: no
// app-shell caching (see PWA rules — installability only, no offline).

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
