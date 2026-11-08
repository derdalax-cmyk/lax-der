// Dedicated messaging worker imported by the generated offline worker in production.
// Push behaviour and brand assets are unchanged; this file never caches app data.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: "DERDALAX", body: event.data ? event.data.text() : "" }; }
  const options = {
    body: data.body || "",
    icon: "/__l5e/assets-v1/d21e5da0-e5af-47b1-a541-797df4740df1/derdalax-icon-192.png",
    badge: "/__l5e/assets-v1/d21e5da0-e5af-47b1-a541-797df4740df1/derdalax-icon-192.png",
    tag: data.tag || "derdalax", renotify: true, data: { url: data.url || "/" },
  };
  if (typeof data.image === "string" && data.image.startsWith("https://")) options.image = data.image;
  event.waitUntil(self.registration.showNotification(data.title || "DERDALAX", options));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      try {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) { try { await client.navigate(targetUrl); } catch { /* unchanged */ } }
          return;
        }
      } catch { /* ignore */ }
    }
    await self.clients.openWindow(targetUrl);
  })());
});