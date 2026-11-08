import { productImageAspect } from "./productImageFrame";
import { safePublicImage } from "./publicCachePolicy";

export type ImageSize = { width: number; height: number; aspect: number; ts: number };
export const IMAGE_CACHE_LIMIT = 2000;
export const IMAGE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const KEY = "dx:image-dimensions:v1";
const cache = new Map<string, ImageSize>();
let hydrated = false;
let writeTimer: ReturnType<typeof setTimeout> | undefined;

/** Only full, uncropped public transformations share dimensions. Signed URLs never persist. */
export function imageDimensionKey(src: string): string | null {
  try {
    if (!safePublicImage(src)) return null;
    const url = new URL(src, "https://derdalax.co.mz");
    if (/\/sign\//.test(url.pathname) || url.searchParams.has("token")) return null;
    if (url.pathname.includes("/storage/v1/render/image/public/") && !url.searchParams.has("height") && url.searchParams.get("resize") !== "fill") {
      url.pathname = url.pathname.replace("/render/image/public/", "/object/public/");
      url.search = "";
    }
    url.hash = "";
    return url.href;
  } catch { return null; }
}

export function pruneImageDimensions(entries: [string, ImageSize][], now = Date.now()) {
  return entries.filter(([, s]) => s.width > 0 && s.height > 0 && Number.isFinite(s.width) && Number.isFinite(s.height) && now - s.ts < IMAGE_CACHE_TTL)
    .sort((a, b) => a[1].ts - b[1].ts).slice(-IMAGE_CACHE_LIMIT);
}

/** Called after hydration, before masonry reveals any cards (never reads storage during SSR/render). */
export function hydrateImageDimensions() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const entries = pruneImageDimensions(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    for (const [key, value] of entries) if (!cache.has(key)) cache.set(key, value);
  } catch { /* private mode/corrupt storage: memory cache still works */ }
}

export function getImageDimensions(src: string): ImageSize | undefined {
  const key = imageDimensionKey(src);
  const value = key ? cache.get(key) : undefined;
  return value && Date.now() - value.ts < IMAGE_CACHE_TTL ? value : undefined;
}

export function saveImageDimensions(src: string, width: number, height: number) {
  const key = imageDimensionKey(src);
  if (!key || width <= 0 || height <= 0 || !Number.isFinite(width + height)) return;
  cache.delete(key);
  cache.set(key, { width, height, aspect: productImageAspect(width, height), ts: Date.now() });
  while (cache.size > IMAGE_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
  if (typeof window === "undefined" || writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = undefined;
    try { localStorage.setItem(KEY, JSON.stringify([...cache])); } catch { /* quota */ }
  }, 250);
}

const pending = new Map<string, Promise<ImageSize | undefined>>();
const queue: (() => void)[] = [];
let active = 0;
export function imagePreloadLimit() {
  if (typeof navigator === "undefined") return 4;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return connection?.saveData || /(^|-)[23]g$/.test(connection?.effectiveType ?? "") ? 2 : 6;
}

export function productImageMetadata(images: unknown): { width?: number; height?: number } {
  const first = Array.isArray(images) ? images[0] : undefined;
  if (!first || typeof first !== "object") return {};
  const width = Number(first.width ?? first.naturalWidth);
  const height = Number(first.height ?? first.naturalHeight);
  return width > 0 && height > 0 ? { width, height } : {};
}
function drain() {
  while (active < imagePreloadLimit() && queue.length) queue.shift()?.();
}

/** Bounded thumbnail measurement; timeout/error locks the neutral frame rather than shifting later. */
export function measureProductImage(src: string): Promise<ImageSize | undefined> {
  hydrateImageDimensions();
  const known = getImageDimensions(src);
  if (known) return Promise.resolve(known);
  const existing = pending.get(src);
  if (existing) return existing;
  const promise = new Promise<ImageSize | undefined>(resolve => {
    queue.push(() => {
      active++;
      const image = new Image();
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (image.naturalWidth) saveImageDimensions(src, image.naturalWidth, image.naturalHeight);
        image.onload = null; image.onerror = null;
        active--; pending.delete(src);
        resolve(getImageDimensions(src)); drain();
      };
      const timer = setTimeout(finish, 8000);
      image.onload = finish; image.onerror = finish;
      image.src = src;
    });
  });
  pending.set(src, promise);
  drain();
  return promise;
}