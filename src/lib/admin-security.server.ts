// Server-only helpers for the admin step-up (passkey / recovery code) layer.
import { getCookie, setCookie, deleteCookie, getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;
export const RECENT_VERIFICATION_MS = 5 * 60 * 1000;
const COOKIE = "__Host-dx_admin_step";
const PROD_HOSTS = ["derdalax.co.mz", "www.derdalax.co.mz"];
// Preview/dev origins allowed only for their own RP ID (credentials never cross to production).
const PREVIEW_ORIGINS = [
  "https://id-preview--67df5107-8177-480b-a27d-14dfb37e79d3.lovable.app",
  "http://localhost:8080",
];

export function isSuperAdmin(userId: string): boolean {
  const raw = process.env["SUPER_ADMIN_USER_IDS"] ?? "";
  const ids = raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => /^[0-9a-f-]{36}$/.test(s));
  return ids.includes(userId.toLowerCase());
}

export function maskId(id: string) {
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
export function maskEmail(email: string | null | undefined) {
  if (!email) return null;
  const [u, d] = email.split("@");
  if (!d) return "***";
  const dp = d.split(".");
  return `${u.slice(0, 1)}***@${dp[0].slice(0, 1)}***.${dp.slice(1).join(".") || "*"}`;
}

export async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Resolve WebAuthn RP ID + origin from the real request origin. */
export function resolveWebAuthnContext(): { rpID: string; origin: string } {
  const req = getRequest();
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const host = new URL(origin).hostname;
  const prodOrigin = process.env["WEBAUTHN_ORIGIN"] ?? "https://derdalax.co.mz";
  const prodRp = process.env["WEBAUTHN_RP_ID"] ?? "derdalax.co.mz";
  if (PROD_HOSTS.includes(host)) {
    const allowed = [prodOrigin, `https://www.${prodRp}`];
    if (!allowed.includes(origin)) throw new Error("Origem não autorizada.");
    return { rpID: prodRp, origin };
  }
  if (PREVIEW_ORIGINS.includes(origin)) return { rpID: host, origin };
  throw new Error("Origem não autorizada para verificação administrativa.");
}

function isProdHost() {
  try {
    return PROD_HOSTS.includes(new URL(getRequest().url).hostname);
  } catch {
    return false;
  }
}

export async function audit(actorId: string, action: string, changes: Record<string, unknown> = {}, entityId: string | null = null) {
  await supabaseAdmin.from("activity_logs").insert({
    actor_id: actorId,
    actor_email: null,
    seller_id: null,
    entity_type: "admin_security",
    entity_id: entityId,
    action,
    changes: changes as never,
  });
}

export async function userIsAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

export async function requireAdminRole(userId: string) {
  if (!(await userIsAdmin(userId))) throw new Error("Acesso restrito a administradores.");
}

export async function recentFailures(userId: string) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", userId)
    .eq("action", "admin_step_up_failure")
    .gte("created_at", since);
  return count ?? 0;
}

export async function createVerifiedSession(userId: string, method: "passkey" | "recovery_code") {
  const token = randomToken(32);
  const hash = await sha256Hex(token);
  const expires = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  const { error } = await supabaseAdmin.from("admin_verified_sessions").insert({
    user_id: userId,
    auth_method: method,
    session_nonce_hash: hash,
    expires_at: expires.toISOString(),
  });
  if (error) throw new Error("Não foi possível criar a sessão administrativa.");
  const prod = isProdHost();
  setCookie(COOKIE, token, {
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: prod ? "strict" : "none",
    partitioned: prod ? undefined : true,
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
  return expires.toISOString();
}

export async function getVerifiedSession(userId: string) {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const hash = await sha256Hex(token);
  const { data } = await supabaseAdmin
    .from("admin_verified_sessions")
    .select("id, user_id, verified_at, expires_at, revoked_at, auth_method")
    .eq("session_nonce_hash", hash)
    .maybeSingle();
  if (!data || data.user_id !== userId || data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

/** Supabase session + admin role + strong admin session. */
export async function requireAdminStepUp(userId: string) {
  await requireAdminRole(userId);
  const s = await getVerifiedSession(userId);
  if (!s) {
    await audit(userId, "critical_action_step_up_required", { reason: "no_session" });
    throw new Error("STEP_UP_REQUIRED");
  }
  await supabaseAdmin.from("admin_verified_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", s.id);
  return s;
}

export async function requireRecentAdminVerification(userId: string, maxAgeMs = RECENT_VERIFICATION_MS) {
  const s = await requireAdminStepUp(userId);
  if (Date.now() - new Date(s.verified_at).getTime() > maxAgeMs) {
    await audit(userId, "critical_action_step_up_required", { reason: "stale" });
    throw new Error("RECENT_STEP_UP_REQUIRED");
  }
  return s;
}

export async function revokeCurrentSession(userId: string) {
  const token = getCookie(COOKIE);
  if (token) {
    const hash = await sha256Hex(token);
    await supabaseAdmin
      .from("admin_verified_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("session_nonce_hash", hash)
      .eq("user_id", userId)
      .is("revoked_at", null);
  }
  deleteCookie(COOKIE, { path: "/", secure: true, httpOnly: true });
}

export async function revokeAllSessions(userId: string) {
  await supabaseAdmin
    .from("admin_verified_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
}

/** Recent primary login (within 15 min) — needed to bootstrap the first passkey. */
export function hasRecentPrimaryLogin(claims: unknown) {
  const amr = (claims as { amr?: { timestamp?: number }[] })?.amr ?? [];
  const latest = Math.max(0, ...amr.map((a) => Number(a.timestamp) || 0));
  return latest > 0 && Date.now() / 1000 - latest < 15 * 60;
}

export async function securityState(userId: string) {
  const [{ count: creds }, { count: codes }] = await Promise.all([
    supabaseAdmin.from("admin_webauthn_credentials").select("id", { count: "exact", head: true }).eq("user_id", userId).is("revoked_at", null),
    supabaseAdmin.from("admin_recovery_codes").select("id", { count: "exact", head: true }).eq("user_id", userId).is("used_at", null).is("revoked_at", null),
  ]);
  return { passkeys: creds ?? 0, recoveryCodes: codes ?? 0 };
}

export function generateRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5, 10)}-${chars.slice(10, 15)}`;
}
export function normalizeRecoveryCode(c: string) {
  const s = c.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 15 ? `${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10)}` : null;
}
