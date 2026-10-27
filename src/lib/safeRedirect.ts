/** Accept only internal paths ("/x"), never "//host" or absolute URLs. */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login")) return null;
  return value;
}

export const PUBLIC_PATH_PREFIXES = ["/login", "/inicial", "/explorar", "/produto/", "/produtos", "/categorias", "/suporte", "/politica-privacidade", "/politicas/", "/api/", "/lovable/"];

/** Path of the current page, safe to use as a post-login destination. */
export function currentPath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return safeRedirect(window.location.pathname + window.location.search) ?? undefined;
}

export function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

const KEY = "derdalax_post_login_redirect";
export function storePendingRedirect(path: string | null) {
  try { if (path) sessionStorage.setItem(KEY, path); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
export function takePendingRedirect(): string | null {
  try { const v = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); return safeRedirect(v); } catch { return null; }
}

/** A normal login always goes home, irrespective of account roles. */
export function loginDestination(pending: unknown, requested: unknown): string {
  return safeRedirect(pending) ?? safeRedirect(requested) ?? "/";
}
