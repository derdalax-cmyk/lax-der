// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { CACHE_VERSION, IMAGE_CACHE_LIMIT, IMAGE_CACHE_SECONDS, cachePublicStorageImage, cachePublicNavigation, cacheHashedAsset } from "./src/lib/offlineCachePolicy";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  plugins: VitePWA({
    strategies: "generateSW",
    filename: "sw.js",
    outDir: "dist/client",
    manifest: false,
    injectRegister: null,
    registerType: "autoUpdate",
    devOptions: { enabled: false },
    workbox: {
      globPatterns: ["assets/**/*.{js,css,woff2}"],
      globIgnores: ["**/sw.js", "**/*server*"],
      navigateFallback: null,
      navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
      cleanupOutdatedCaches: true,
      skipWaiting: true,
      clientsClaim: true,
      importScripts: ["/push-events.js", "/offline-maintenance.js"],
      runtimeCaching: [
        { urlPattern: cachePublicStorageImage, handler: "StaleWhileRevalidate", options: { cacheName: `derdalax-product-images-${CACHE_VERSION}`, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: IMAGE_CACHE_LIMIT, maxAgeSeconds: IMAGE_CACHE_SECONDS, purgeOnQuotaError: true } } },
        { urlPattern: cachePublicNavigation, handler: "NetworkFirst", options: {
          cacheName: `derdalax-shell-${CACHE_VERSION}`, networkTimeoutSeconds: 3,
          fetchOptions: { credentials: "omit" },
          plugins: [{
            requestWillFetch: async ({ request }) => new Request(request, { credentials: "omit" }),
            cacheWillUpdate: async ({ response }) => response.status === 200 && !response.headers.has("set-cookie") && !/private|no-store/i.test(response.headers.get("cache-control") ?? "") ? response : null,
          }],
          expiration: { maxEntries: 30, maxAgeSeconds: 24 * 60 * 60, purgeOnQuotaError: true },
        } },
        { urlPattern: cacheHashedAsset, handler: "CacheFirst", options: { cacheName: `derdalax-assets-${CACHE_VERSION}`, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true } } },
      ],
    },
  }).map(plugin => ({ ...plugin, applyToEnvironment: (environment) => environment.name === "client" })),
  tanstackStart: {
    server: { entry: "server" },
  },
});
