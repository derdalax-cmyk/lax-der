import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const UUID = /^[0-9a-f-]{36}$/i;

/** Status used by the /admin guard. */
export const getAdminSecurityStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./admin-security.server");
    const isAdmin = await s.userIsAdmin(context.userId);
    if (!isAdmin) return { isAdmin: false as const };
    const session = await s.getVerifiedSession(context.userId);
    const state = await s.securityState(context.userId);
    return {
      isAdmin: true as const,
      verified: !!session,
      expiresAt: session?.expires_at ?? null,
      verifiedAt: session?.verified_at ?? null,
      isSuperAdmin: s.isSuperAdmin(context.userId),
      hasPasskey: state.passkeys > 0,
      hasRecoveryCodes: state.recoveryCodes > 0,
      canBootstrap: state.passkeys === 0 && state.recoveryCodes === 0,
      recentLogin: s.hasRecentPrimaryLogin(context.claims),
    };
  });

export const beginAdminPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./admin-security.server");
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    await s.requireAdminRole(uid);
    const state = await s.securityState(uid);
    if (state.passkeys === 0 && state.recoveryCodes === 0) {
      if (!s.hasRecentPrimaryLogin(context.claims)) throw new Error("RECENT_LOGIN_REQUIRED");
    } else {
      await s.requireRecentAdminVerification(uid);
    }
    const { rpID, origin } = s.resolveWebAuthnContext();
    const { data: existing } = await supabaseAdmin
      .from("admin_webauthn_credentials").select("credential_id, transports").eq("user_id", uid).is("revoked_at", null);
    const options = await generateRegistrationOptions({
      rpName: "DERDALAX Admin",
      rpID,
      userName: `admin-${uid.slice(0, 8)}`,
      userDisplayName: "Administrador DERDALAX",
      userID: new TextEncoder().encode(uid),
      attestationType: "none",
      excludeCredentials: (existing ?? []).map((c) => ({ id: c.credential_id, transports: (c.transports as never) ?? undefined })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    });
    await supabaseAdmin.from("admin_webauthn_challenges").insert({
      user_id: uid, challenge: options.challenge, purpose: "register", rp_id: rpID, origin,
    });
    return options as unknown as Json;
  });

export const finishAdminPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { response: unknown; deviceName?: string }) => {
    if (!isObj(d?.response)) throw new Error("Resposta inválida.");
    const deviceName = String(d.deviceName ?? "").trim().slice(0, 60) || "Dispositivo";
    return { response: d.response, deviceName };
  })
  .handler(async ({ data, context }) => {
    const s = await import("./admin-security.server");
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const { isoBase64URL } = await import("@simplewebauthn/server/helpers");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    await s.requireAdminRole(uid);
    const { rpID, origin } = s.resolveWebAuthnContext();
    const ch = await consumeChallenge(uid, "register", rpID, origin);
    if (!ch) {
      await s.audit(uid, "admin_step_up_failure", { stage: "register", reason: "challenge" });
      throw new Error("Pedido expirado ou já utilizado. Tente novamente.");
    }
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: data.response as never,
        expectedChallenge: ch,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch {
      await s.audit(uid, "admin_step_up_failure", { stage: "register", reason: "verify" });
      throw new Error("Não foi possível validar a passkey.");
    }
    if (!verification.verified || !verification.registrationInfo) throw new Error("Passkey não verificada.");
    const cred = verification.registrationInfo.credential;
    const { data: row, error } = await supabaseAdmin.from("admin_webauthn_credentials").insert({
      user_id: uid,
      credential_id: cred.id,
      public_key: isoBase64URL.fromBuffer(cred.publicKey),
      counter: cred.counter,
      transports: (cred.transports ?? []) as never,
      device_name: data.deviceName,
    }).select("id").single();
    if (error) throw new Error("Esta passkey já está registada.");
    await s.audit(uid, "passkey_registered", { device: data.deviceName, rp: rpID }, row.id);
    // First passkey also opens a verified session.
    const existing = await s.getVerifiedSession(uid);
    const expiresAt = existing ? existing.expires_at : await s.createVerifiedSession(uid, "passkey");
    return { ok: true, expiresAt };
  });

async function consumeChallenge(uid: string, purpose: "register" | "authenticate", rpID: string, origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: latest } = await supabaseAdmin
    .from("admin_webauthn_challenges")
    .select("id")
    .eq("user_id", uid).eq("purpose", purpose).eq("rp_id", rpID).eq("origin", origin)
    .is("consumed_at", null).gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!latest) return null;
  const { data } = await supabaseAdmin
    .from("admin_webauthn_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", latest.id).is("consumed_at", null)
    .select("challenge").maybeSingle();
  return data?.challenge ?? null;
}

export const beginAdminPasskeyAuthentication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./admin-security.server");
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    await s.requireAdminRole(uid);
    if ((await s.recentFailures(uid)) >= 5) throw new Error("Demasiadas tentativas. Aguarde 15 minutos.");
    const { rpID, origin } = s.resolveWebAuthnContext();
    const { data: creds } = await supabaseAdmin
      .from("admin_webauthn_credentials").select("credential_id, transports").eq("user_id", uid).is("revoked_at", null);
    if (!creds?.length) throw new Error("Nenhuma passkey registada.");
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: creds.map((c) => ({ id: c.credential_id, transports: (c.transports as never) ?? undefined })),
    });
    await supabaseAdmin.from("admin_webauthn_challenges").insert({
      user_id: uid, challenge: options.challenge, purpose: "authenticate", rp_id: rpID, origin,
    });
    return options as unknown as Json;
  });

export const finishAdminPasskeyAuthentication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { response: unknown }) => {
    if (!isObj(d?.response) || typeof d.response.id !== "string") throw new Error("Resposta inválida.");
    return { response: d.response };
  })
  .handler(async ({ data, context }) => {
    const s = await import("./admin-security.server");
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { isoBase64URL } = await import("@simplewebauthn/server/helpers");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    await s.requireAdminRole(uid);
    if ((await s.recentFailures(uid)) >= 5) throw new Error("Demasiadas tentativas. Aguarde 15 minutos.");
    const { rpID, origin } = s.resolveWebAuthnContext();
    const fail = async (reason: string) => {
      await s.audit(uid, "admin_step_up_failure", { stage: "authenticate", reason });
      return new Error("Verificação falhou.");
    };
    const ch = await consumeChallenge(uid, "authenticate", rpID, origin);
    if (!ch) throw await fail("challenge");
    const { data: cred } = await supabaseAdmin
      .from("admin_webauthn_credentials")
      .select("id, credential_id, public_key, counter, transports")
      .eq("credential_id", data.response.id as string).eq("user_id", uid).is("revoked_at", null)
      .maybeSingle();
    if (!cred) throw await fail("credential");
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response: data.response as never,
        expectedChallenge: ch,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: cred.credential_id,
          publicKey: isoBase64URL.toBuffer(cred.public_key),
          counter: Number(cred.counter),
          transports: (cred.transports as never) ?? undefined,
        },
      });
    } catch {
      throw await fail("verify");
    }
    if (!result.verified) throw await fail("not_verified");
    await supabaseAdmin.from("admin_webauthn_credentials")
      .update({ counter: result.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", cred.id);
    const expiresAt = await s.createVerifiedSession(uid, "passkey");
    await s.audit(uid, "admin_step_up_success", { method: "passkey" }, cred.id);
    return { ok: true, expiresAt };
  });

export const verifyAdminRecoveryCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => ({ code: String(d?.code ?? "").slice(0, 40) }))
  .handler(async ({ data, context }) => {
    const s = await import("./admin-security.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    await s.requireAdminRole(uid);
    if ((await s.recentFailures(uid)) >= 5) throw new Error("Demasiadas tentativas. Aguarde 15 minutos.");
    const norm = s.normalizeRecoveryCode(data.code);
    const hash = norm ? await s.sha256Hex(`${uid}:${norm}`) : "";
    const { data: row } = norm
      ? await supabaseAdmin.from("admin_recovery_codes")
          .update({ used_at: new Date().toISOString() })
          .eq("user_id", uid).eq("code_hash", hash).is("used_at", null).is("revoked_at", null)
          .select("id").maybeSingle()
      : { data: null };
    if (!row) {
      await s.audit(uid, "admin_step_up_failure", { stage: "recovery_code" });
      throw new Error("Código inválido ou já utilizado.");
    }
    const expiresAt = await s.createVerifiedSession(uid, "recovery_code");
    await s.audit(uid, "recovery_code_used", {}, row.id);
    await s.audit(uid, "admin_step_up_success", { method: "recovery_code" });
    return { ok: true, expiresAt };
  });

export const regenerateAdminRecoveryCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./admin-security.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    await s.requireRecentAdminVerification(uid);
    await supabaseAdmin.from("admin_recovery_codes").update({ revoked_at: new Date().toISOString() })
      .eq("user_id", uid).is("used_at", null).is("revoked_at", null);
    const codes = Array.from({ length: 10 }, () => s.generateRecoveryCode());
    const rows = await Promise.all(codes.map(async (c) => ({ user_id: uid, code_hash: await s.sha256Hex(`${uid}:${c}`) })));
    const { error } = await supabaseAdmin.from("admin_recovery_codes").insert(rows);
    if (error) throw new Error("Não foi possível gerar os códigos.");
    await s.audit(uid, "recovery_codes_regenerated", { count: codes.length });
    return { codes };
  });

export const listMyAdminPasskeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./admin-security.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await s.requireAdminStepUp(context.userId);
    const { data } = await supabaseAdmin.from("admin_webauthn_credentials")
      .select("id, device_name, created_at, last_used_at")
      .eq("user_id", context.userId).is("revoked_at", null).order("created_at");
    const state = await s.securityState(context.userId);
    return { passkeys: data ?? [], recoveryCodesLeft: state.recoveryCodes };
  });

export const removeAdminPasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!UUID.test(String(d?.id))) throw new Error("ID inválido.");
    return { id: d.id };
  })
  .handler(async ({ data, context }) => {
    const s = await import("./admin-security.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    await s.requireRecentAdminVerification(uid);
    const state = await s.securityState(uid);
    if (state.passkeys <= 1 && state.recoveryCodes === 0) throw new Error("Gere códigos de recuperação antes de remover a última passkey.");
    const { data: row } = await supabaseAdmin.from("admin_webauthn_credentials")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id).eq("user_id", uid).is("revoked_at", null).select("id").maybeSingle();
    if (!row) throw new Error("Passkey não encontrada.");
    await s.audit(uid, "passkey_removed", {}, row.id);
    return { ok: true };
  });

export const revokeAllMyAdminSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./admin-security.server");
    await s.requireAdminStepUp(context.userId);
    await s.revokeAllSessions(context.userId);
    await s.revokeCurrentSession(context.userId);
    await s.audit(context.userId, "admin_session_revoked", { scope: "all" });
    return { ok: true };
  });

/** Called on logout: revokes the current admin step-up session (no-op for non-admins). */
export const endAdminSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./admin-security.server");
    if (!(await s.userIsAdmin(context.userId))) {
      await s.revokeCurrentSession(context.userId);
      return { ok: true };
    }
    await s.revokeCurrentSession(context.userId);
    await s.audit(context.userId, "admin_session_revoked", { scope: "current" });
    return { ok: true };
  });

// ---------- Super Admin: administrator management ----------

export const listAdministrators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = await import("./admin-security.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!s.isSuperAdmin(context.userId)) throw new Error("FORBIDDEN");
    await s.requireAdminStepUp(context.userId);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, created_at").eq("role", "admin");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return { admins: [] };
    const [{ data: profiles }, { data: creds }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, name, email").in("id", ids),
      supabaseAdmin.from("admin_webauthn_credentials").select("user_id").in("user_id", ids).is("revoked_at", null),
    ]);
    const withKey = new Set((creds ?? []).map((c) => c.user_id));
    return {
      admins: (roles ?? []).map((r) => {
        const p = profiles?.find((x) => x.id === r.user_id);
        return {
          id: r.user_id,
          maskedId: s.maskId(r.user_id),
          name: p?.name || "Sem nome",
          maskedEmail: s.maskEmail(p?.email),
          createdAt: r.created_at,
          hasPasskey: withKey.has(r.user_id),
          isSuperAdmin: s.isSuperAdmin(r.user_id),
          isSelf: r.user_id === context.userId,
        };
      }),
    };
  });

export const grantAdministrator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => {
    const email = String(d?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Email inválido");
    return { email };
  })
  .handler(async ({ data, context }) => {
    const s = await import("./admin-security.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!s.isSuperAdmin(context.userId)) {
      await s.audit(context.userId, "admin_grant_denied", {});
      throw new Error("FORBIDDEN");
    }
    await s.requireRecentAdminVerification(context.userId);
    const { data: p } = await supabaseAdmin.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (!p) throw new Error("Esse utilizador ainda não tem conta. Peça-lhe para se registar primeiro.");
    const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: p.id, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) throw new Error("Não foi possível conceder acesso.");
    await s.audit(context.userId, "admin_grant", { target: s.maskId(p.id) }, p.id);
    return { ok: true };
  });

export const revokeAdministrator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => {
    if (!UUID.test(String(d?.userId))) throw new Error("ID inválido.");
    return { userId: d.userId };
  })
  .handler(async ({ data, context }) => {
    const s = await import("./admin-security.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!s.isSuperAdmin(context.userId)) {
      await s.audit(context.userId, "admin_revoke_denied", {});
      throw new Error("FORBIDDEN");
    }
    await s.requireRecentAdminVerification(context.userId);
    if (s.isSuperAdmin(data.userId)) throw new Error("Um Super Admin só pode ser removido na configuração do servidor.");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    await s.revokeAllSessions(data.userId);
    await s.audit(context.userId, "admin_revoke", { target: s.maskId(data.userId) }, data.userId);
    return { ok: true };
  });
