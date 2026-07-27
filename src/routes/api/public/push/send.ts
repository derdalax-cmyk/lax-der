import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/push/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const expected = `Bearer ${process.env.PUSH_DISPATCH_SECRET ?? ""}`;
        if (!process.env.PUSH_DISPATCH_SECRET || auth !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: { user_id?: string; title?: string; body?: string; url?: string; tag?: string };
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const { user_id, title, body, url, tag } = payload ?? {};
        if (!user_id || !title) return new Response("Missing fields", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: subs, error } = await supabaseAdmin
          .from("push_subscriptions")
          .select("id, endpoint, keys")
          .eq("user_id", user_id);
        if (error) return new Response(error.message, { status: 500 });
        if (!subs || subs.length === 0) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

        const webpushMod = (await import("web-push")) as unknown as {
          default?: typeof import("web-push");
        } & typeof import("web-push");
        const webpush = webpushMod.default ?? webpushMod;
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || "mailto:suporte@derdalax.co.mz",
          process.env.VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!,
        );

        const notifPayload = JSON.stringify({ title, body: body ?? "", url: url ?? "/", tag: tag ?? "derdalax" });

        let sent = 0;
        const toDelete: string[] = [];
        await Promise.all(
          subs.map(async (row) => {
            const keys = row.keys as { p256dh?: string; auth?: string } | null;
            if (!keys?.p256dh || !keys?.auth) return;
            try {
              await webpush.sendNotification(
                { endpoint: row.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
                notifPayload,
                { TTL: 60 * 60 * 24 },
              );
              sent++;
            } catch (err: unknown) {
              const status = (err as { statusCode?: number })?.statusCode;
              if (status === 404 || status === 410) toDelete.push(row.id);
              else console.error("push send failed", status, err);
            }
          }),
        );

        if (toDelete.length > 0) {
          await supabaseAdmin.from("push_subscriptions").delete().in("id", toDelete);
        }

        return new Response(JSON.stringify({ sent, removed: toDelete.length }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
