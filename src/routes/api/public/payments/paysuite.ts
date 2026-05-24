import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PaysuiteEvent = {
  event?: string;
  data?: {
    id?: string;
    reference?: string;
    status?: string;
    transaction?: { id?: string; method?: string; msisdn?: string } | null;
  };
};

export const Route = createFileRoute("/api/public/payments/paysuite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const headersObj: Record<string, string> = {};
        request.headers.forEach((v, k) => { headersObj[k] = v; });
        const queryObj: Record<string, string> = {};
        url.searchParams.forEach((v, k) => { queryObj[k] = v; });

        const rawBody = await request.text();

        console.log("📥 Webhook Paysuite recebido:", {
          headers: headersObj,
          body: rawBody,
          query: queryObj,
        });

        // Shared-secret verification: accept ?s=..., X-Webhook-Secret, or X-Paysuite-Signature
        const expected = process.env.PAYSUITE_WEBHOOK_SECRET;
        if (expected) {
          const provided =
            request.headers.get("x-paysuite-signature") ??
            request.headers.get("x-webhook-signature") ??
            request.headers.get("signature") ??
            request.headers.get("x-webhook-secret") ??
            url.searchParams.get("s");
          if (provided !== expected) {
            console.warn("❌ Paysuite webhook: assinatura inválida", { provided });
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let payload: PaysuiteEvent;
        try {
          payload = JSON.parse(rawBody) as PaysuiteEvent;
        } catch {
          console.error("❌ Paysuite webhook: JSON inválido");
          return new Response("Invalid JSON", { status: 400 });
        }

        const ref = payload?.data?.reference;
        const providerId = payload?.data?.id;
        const event = payload?.event ?? "";
        console.log("🔎 Paysuite payload parsed:", { event, ref, providerId, status: payload?.data?.status });

        if (!ref && !providerId) return new Response("Missing identifier", { status: 400 });

        // Locate the order
        let query = supabaseAdmin.from("orders").select("id,status,payment_status").limit(1);
        query = ref ? query.eq("payment_reference", ref) : query.eq("payment_provider_id", providerId!);
        const { data: orders, error } = await query;
        if (error || !orders || orders.length === 0) {
          console.warn("⚠️ Paysuite webhook: pedido não encontrado", { ref, providerId, error: error?.message });
          return new Response("Order not found", { status: 404 });
        }
        const order = orders[0];

        const isSuccess = event.includes("success") || payload?.data?.status === "success" || payload?.data?.status === "completed" || payload?.data?.status === "paid";
        const isFailure = event.includes("failed") || payload?.data?.status === "failed" || payload?.data?.status === "cancelled";

        if (isSuccess && order.payment_status !== "paid") {
          await supabaseAdmin.from("orders").update({
            payment_status: "paid",
            status: "processing",
            payment_provider_id: providerId ?? null,
            updated_at: new Date().toISOString(),
          }).eq("id", order.id);
          console.log("✅ Pedido marcado como pago:", order.id);
        } else if (isFailure) {
          await supabaseAdmin.from("orders").update({
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          }).eq("id", order.id);
          console.log("❌ Pedido marcado como falhado:", order.id);
        } else {
          console.log("ℹ️ Paysuite webhook ignorado (sem mudança de estado):", { orderId: order.id, current: order.payment_status });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
