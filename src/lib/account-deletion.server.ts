import * as React from "react";
import { render } from "@react-email/render";
import { sendLovableEmail } from "@lovable.dev/email-js";
import { AccountDeletionEmail } from "./email-templates/account-deletion";

const CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;

export type DeletionBlocker = { kind: "order" | "seller_order"; reference: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Section 20 of the site policies: accounts are not erased while an open
 * financial dispute (money in transit / order in progress) exists.
 */
export async function findOpenDisputes(userId: string): Promise<DeletionBlocker[]> {
  const db = await admin();
  const blockers: DeletionBlocker[] = [];

  const { data: orders } = await db
    .from("orders")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["paid", "processing", "sent"]);

  for (const o of orders ?? []) {
    blockers.push({ kind: "order", reference: String(o.id).slice(0, 8).toUpperCase() });
  }

  const { data: sellers } = await db.from("sellers").select("id").eq("user_id", userId);
  const sellerIds = (sellers ?? []).map((s) => s.id);
  if (sellerIds.length > 0) {
    const { data: parts } = await db
      .from("order_sellers")
      .select("order_id, status")
      .in("seller_id", sellerIds)
      .not("status", "in", '("delivered","cancelled")');
    for (const p of parts ?? []) {
      blockers.push({ kind: "seller_order", reference: String(p.order_id).slice(0, 8).toUpperCase() });
    }
  }

  return blockers;
}

export async function createAndSendDeletionCode(userId: string, email: string) {
  const db = await admin();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  const { error } = await db
    .from("account_deletion_codes")
    .upsert(
      { user_id: userId, code, attempts: 0, expires_at: expiresAt, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error("Não foi possível gerar o código. Tente novamente.");

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Serviço de email indisponível. Tente mais tarde.");

  const html = await render(React.createElement(AccountDeletionEmail, { token: code }));
  const text = `O seu código para apagar a conta DERDALAX é ${code}. Expira em ${CODE_TTL_MINUTES} minutos.`;
  const messageId = crypto.randomUUID();

  await db.from("email_send_log").insert({
    message_id: messageId,
    template_name: "account_deletion_code",
    recipient_email: email,
    status: "pending",
  });

  // The email provider requires an unsubscribe token on transactional sends.
  const unsubscribeToken = crypto.randomUUID().replace(/-/g, "");
  await db.from("email_unsubscribe_tokens").insert({ token: unsubscribeToken, email });



  try {
    await sendLovableEmail(
      {
        to: email,
        from: "DERDALAX <noreply@derdalax.co.mz>",
        reply_to: "suporte@derdalax.co.mz",
        sender_domain: "notify.derdalax.co.mz",
        subject: "Código para apagar a sua conta DERDALAX",
        html,
        text,
        purpose: "transactional",
        label: "account_deletion_code",
        message_id: messageId,
        idempotency_key: messageId,
      } as Parameters<typeof sendLovableEmail>[0],
      { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("email_send_log").insert({
      message_id: messageId,
      template_name: "account_deletion_code",
      recipient_email: email,
      status: "failed",
      error_message: message.slice(0, 1000),
    });
    throw new Error("Não conseguimos enviar o email com o código. Tente novamente.");
  }

  await db.from("email_send_log").insert({
    message_id: messageId,
    template_name: "account_deletion_code",
    recipient_email: email,
    status: "sent",
  });

  return { expiresAt };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many" | "wrong"; attemptsLeft?: number };

export async function verifyDeletionCode(userId: string, code: string): Promise<VerifyResult> {
  const db = await admin();
  const { data: row } = await db
    .from("account_deletion_codes")
    .select("code, attempts, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) return { ok: false, reason: "no_code" };
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: "too_many" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.from("account_deletion_codes").delete().eq("user_id", userId);
    return { ok: false, reason: "expired" };
  }
  if (row.code !== code) {
    const attempts = row.attempts + 1;
    await db.from("account_deletion_codes").update({ attempts }).eq("user_id", userId);
    if (attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: "too_many" };
    return { ok: false, reason: "wrong", attemptsLeft: MAX_CODE_ATTEMPTS - attempts };
  }
  return { ok: true };
}

/**
 * Full erasure of personal data. Transaction records (orders / order_items /
 * order_sellers) are kept for tax and anti-fraud obligations, but stripped of
 * every personal identifier.
 */
export async function purgeAccount(userId: string) {
  const db = await admin();

  // 1. Personal, non-fiscal data — removed entirely.
  await db.from("cart_items").delete().eq("user_id", userId);
  await db.from("favorites").delete().eq("user_id", userId);
  await db.from("addresses").delete().eq("user_id", userId);
  await db.from("waiting_list").delete().eq("user_id", userId);
  await db.from("push_subscriptions").delete().eq("user_id", userId);
  await db.from("notifications").delete().eq("user_id", userId);
  await db.from("seller_reviews").delete().eq("user_id", userId);
  await db.from("reports").delete().eq("reporter_id", userId);

  // 2. Seller store: published products removed, store row anonymized so past
  //    order splits keep their integrity.
  const { data: sellers } = await db.from("sellers").select("id").eq("user_id", userId);
  for (const s of sellers ?? []) {
    await db.from("featured_collection_products").delete().eq("seller_id", s.id);
    await db.from("products").delete().eq("seller_id", s.id);
    await db
      .from("sellers")
      .update({
        full_name: "Conta apagada",
        store_name: "Loja removida",
        email: null,
        phone: "—",
        description: null,
        logo_url: null,
        document_type: null,
        document_number: null,
        document_front_url: null,
        document_back_url: null,
        document_selfie_url: null,
        face_photo_url: null,
        emola_number: null,
        mpesa_number: null,
        bank_account: null,
        bank_name: null,
        is_blocked: true,
        admin_notes: "Loja anonimizada por eliminação de conta pelo utilizador.",
      })
      .eq("id", s.id);
  }

  // 3. Orders: kept for fiscal/anti-fraud purposes, anonymized.
  await db
    .from("orders")
    .update({
      customer_name: "Conta apagada",
      customer_phone: null,
      payment_phone: null,
      shipping_address: null,
      notes: null,
    })
    .eq("user_id", userId);

  // 4. Best-effort removal of private uploads.
  try {
    const { data: files } = await db.storage.from("user-private").list(`${userId}`, { limit: 1000 });
    const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length > 0) await db.storage.from("user-private").remove(paths);
  } catch {
    // ignore storage cleanup failures
  }

  // 5. Consume the code and delete the auth identity (cascades profile, roles,
  //    conversations, messages and support threads).
  await db.from("account_deletion_codes").delete().eq("user_id", userId);
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) throw new Error("Não foi possível concluir a eliminação. Contacte o suporte.");
}
