import { createFileRoute } from "@tanstack/react-router";

// Campaign queue worker, woken by the database while a campaign has pending recipients.
// Caller must present the private worker key generated inside the database.
export const Route = createFileRoute("/api/public/campaigns/process")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: key } = await supabaseAdmin.from("admin_campaign_worker_key").select("token").eq("id", 1).maybeSingle();
        if (!key?.token || auth !== `Bearer ${key.token}`) return new Response("Unauthorized", { status: 401 });
        const { processCampaignBatch } = await import("@/lib/campaigns.server");
        let processed = 0;
        // Bounded work per wake-up: at most 3 batches (~240 recipients).
        for (let i = 0; i < 3; i++) {
          const r = await processCampaignBatch();
          processed += r.processed;
          if (r.processed === 0) break;
        }
        return Response.json({ processed });
      },
    },
  },
});
