import { useEffect, useState } from "react";
import { resolveStoredUrl } from "@/lib/privateStorage";

/** Resolves a stored image reference (public URL or private "up://" ref) into a usable src. */
export function usePrivateUrl(value: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(value && !value.startsWith("up://") ? value : null);

  useEffect(() => {
    let cancelled = false;
    if (!value) { setUrl(null); return; }
    if (!value.startsWith("up://")) { setUrl(value); return; }
    setUrl(null);
    resolveStoredUrl(value).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [value]);

  return url;
}
