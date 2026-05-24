import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAYSUITE_URL = "https://paysuite.tech/api/v1/payments";

const InitSchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(["mpesa", "emola"]),
  msisdn: z.string().min(9).max(15),
  returnUrl: z.string().url(),
});

export const initPaysuitePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const token = process.env.PAYSUITE_TOKEN;
    if (!token) throw new Error("PAYSUITE_TOKEN não configurado");

    const { supabase, userId } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select("id,user_id,total,payment_reference,payment_status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Pedido não encontrado");
    if (order.user_id !== userId) throw new Error("Sem permissão");
    if (order.payment_status === "paid") {
      return { ok: true, alreadyPaid: true, checkoutUrl: null, providerId: null };
    }

    const reference = order.payment_reference ?? `DER-${order.id.slice(0, 8).toUpperCase()}`;
    const callbackUrl = `${new URL(data.returnUrl).origin}/api/public/payments/paysuite`;

    const body = {
      amount: Number(order.total).toFixed(2),
      reference,
      description: `Pedido DERDALAX ${reference}`,
      method: data.method,
      msisdn: data.msisdn.replace(/\D/g, ""),
      return_url: data.returnUrl,
      callback_url: callbackUrl,
    };

    const res = await fetch(PAYSUITE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => null)) as
      | { status?: string; message?: string; data?: { id?: string; checkout_url?: string } }
      | null;

    if (!res.ok || json?.status !== "success") {
      const msg = json?.message ?? `Paysuite error ${res.status}`;
      throw new Error(msg);
    }

    const providerId = json.data?.id ?? null;
    const checkoutUrl = json.data?.checkout_url ?? null;

    await supabase
      .from("orders")
      .update({
        payment_provider_id: providerId,
        payment_status: "processing",
      })
      .eq("id", order.id);

    return { ok: true, alreadyPaid: false, checkoutUrl, providerId };
  });
