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

        const { sendPushToUser } = await import("@/lib/push.server");
        let sent = 0;
        let removed = 0;
        try {
          ({ sent, removed } = await sendPushToUser(user_id, { title, body, url, tag }));
        } catch {
          return new Response("Push error", { status: 500 });
        }
        return new Response(JSON.stringify({ sent, removed }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
