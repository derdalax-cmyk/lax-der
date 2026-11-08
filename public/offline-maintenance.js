// Remove only this app's superseded app-shell caches, never messaging caches.
self.addEventListener("activate", event => event.waitUntil((async () => {
  const version = "catalog-v2";
  const names = await caches.keys();
  await Promise.allSettled(names.filter(name =>
    /^derdalax-(shell|assets|product-images)-/.test(name) && !name.endsWith(version)
  ).map(name => caches.delete(name)));
})()));