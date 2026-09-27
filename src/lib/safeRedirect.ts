/** Accept only internal paths ("/x"), never "//host" or absolute URLs. */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login")) return null;
  return value;
}

export const PUBLIC_PATH_PREFIXES = ["/login", "/inicial", "/explorar", "/produto/", "/politica-privacidade", "/politicas/", "/api/", "/lovable/"];

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
