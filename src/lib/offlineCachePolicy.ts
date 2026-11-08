export const CACHE_VERSION = "catalog-v2";
export const IMAGE_CACHE_LIMIT = 300;
export const IMAGE_CACHE_SECONDS = 7 * 24 * 60 * 60;

/** Self-contained functions: Workbox serializes them into the generated worker. */
export function cachePublicStorageImage({ url, request }: { url: URL; request: Request }): boolean {
  return request.method === "GET" && request.destination === "image" && url.protocol === "https:" &&
    /\.supabase\.(co|in)$/.test(url.hostname) &&
    /^\/storage\/v1\/(object|render\/image)\/public\/products\//.test(url.pathname) &&
    !request.headers.has("authorization") &&
    ![...url.searchParams.keys()].some(k => /token|sign|credential|authorization|secret|expires/i.test(k));
}

export function cachePublicNavigation({ url, request, sameOrigin }: { url: URL; request: Request; sameOrigin: boolean }): boolean {
  // Do not store SSR HTML that might carry a user's cookie-derived state.
  return sameOrigin && request.mode === "navigate" &&
    /^(\/$|\/explorar$|\/categorias$|\/produtos$|\/produto\/[^/]+$|\/loja\/[^/]+$)/.test(url.pathname) &&
    !request.headers.has("authorization") && !request.headers.has("cookie") &&
    ![...url.searchParams.keys()].some(k => /token|sign|code|session/i.test(k));
}

export function cacheHashedAsset({ url, request, sameOrigin }: { url: URL; request: Request; sameOrigin: boolean }): boolean {
  return sameOrigin && request.method === "GET" && !request.headers.has("authorization") &&
    /^\/(assets|_build)\/[^?]+[-.][A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpe?g|webp|svg)$/.test(url.pathname) &&
    url.search === "";
}

export function refuseOfflineRegistration(hostname: string, production: boolean, framed: boolean, off: boolean): boolean {
  const host = hostname.toLowerCase();
  return !production || framed || off || host === "localhost" || host === "127.0.0.1" ||
    /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host) ||
    /^project--.+-dev\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host) ||
    /(^|\.)(lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(host);
}