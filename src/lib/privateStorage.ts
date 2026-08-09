import { supabase } from "@/integrations/supabase/client";

export const PRIVATE_BUCKET = "user-private";
const PREFIX = "up://";
const TTL_SECONDS = 60 * 60;

/** Marks a storage path inside the private bucket, e.g. "up://avatars/<uid>/x.jpg". */
export function privateRef(path: string) {
  return `${PREFIX}${path}`;
}

export function isPrivateRef(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}

export function privatePath(value: string): string {
  return value.slice(PREFIX.length);
}

const cache = new Map<string, { url: string; expires: number }>();

/** Resolves a stored value to a displayable URL (signed for the private bucket). */
export async function resolveStoredUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!isPrivateRef(value)) return value;
  const path = privatePath(value);
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(path, TTL_SECONDS);
  if (!data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, expires: Date.now() + (TTL_SECONDS - 60) * 1000 });
  return data.signedUrl;
}

export async function removeStoredFile(value: string | null | undefined) {
  if (!value) return;
  if (isPrivateRef(value)) {
    await supabase.storage.from(PRIVATE_BUCKET).remove([privatePath(value)]);
  }
}
