import { createFileRoute } from "@tanstack/react-router";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmail(title: string, body: string, linkUrl: string) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br/>");
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${safeTitle}</title></head><body style="margin:0;background:#f4f3f0;font-family:Helvetica,Arial,sans-serif;padding:40px 12px;color:#0a0a0a">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(10,10,10,.08)">
    <div style="background:#0a0a0a;padding:28px 24px;text-align:center">
      <div style="font-family:'Playfair Display',Georgia,serif;color:#e4b363;font-size:26px;letter-spacing:8px;font-weight:700">DERDALAX</div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#e4b363 0%,#f2d49b 50%,#e4b363 100%)"></div>
    <div style="padding:36px 32px 28px;text-align:center">
      <h1 style="font-family:'Playfair Display',Georgia,serif;color:#0a0a0a;font-size:22px;line-height:1.3;margin:0 0 16px">${safeTitle}</h1>
      <p style="color:#4a4a4a;font-size:15px;line-height:1.6;margin:0 0 26px">${safeBody}</p>
      <a href="${linkUrl}" style="display:inline-block;background:#0a0a0a;color:#e4b363;text-decoration:none;padding:13px 30px;border-radius:999px;font-weight:600;letter-spacing:1px;font-size:13px">Abrir DERDALAX</a>
    </div>
    <div style="padding:20px 18px;text-align:center;color:#8a8a8a;font-size:11px;line-height:1.6;border-top:1px solid #eee;background:#faf9f6">
      <div style="font-family:'Playfair Display',Georgia,serif;color:#0a0a0a;letter-spacing:4px;font-size:14px;margin-bottom:4px">DERDALAX</div>
      <div>Moda e estilo, feitos em Moçambique.</div>
      <div style="margin-top:8px">
        <a href="https://derdalax.co.mz/politicas/termos-condicoes" style="color:#e4b363;text-decoration:underline;font-weight:600">Termos e Condições</a>
        &middot;
        <a href="https://derdalax.co.mz/politicas/privacidade-dados" style="color:#e4b363;text-decoration:underline;font-weight:600">Política de Privacidade</a>
      </div>
      <div style="margin-top:6px">
        Dúvidas? Responda este email ou escreva para
        <a href="mailto:suporte@derdalax.co.mz" style="color:#e4b363;text-decoration:underline;font-weight:600">suporte@derdalax.co.mz</a>
      </div>
    </div>
  </div>
</body></html>`;
}

const ALLOWED_TYPES = new Set(["order", "order_status", "new_seller"]);

export const Route = createFileRoute("/api/public/email/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const expected = `Bearer ${process.env.PUSH_DISPATCH_SECRET ?? ""}`;
        if (!process.env.PUSH_DISPATCH_SECRET || auth !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: {
          user_id?: string;
          type?: string;
          title?: string;
          body?: string;
          link?: string;
        };
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const { user_id, type, title, body, link } = payload ?? {};
        if (!user_id || !type || !title) return new Response("Missing fields", { status: 400 });
        if (!ALLOWED_TYPES.has(type)) {
          return Response.json({ skipped: "type_not_allowed" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("email, notification_preferences")
          .eq("id", user_id)
          .maybeSingle();

        const email = (profile as { email?: string | null } | null)?.email;
        if (!email) return Response.json({ skipped: "no_email" });

        const rawPrefs = (profile as { notification_preferences?: unknown } | null)?.notification_preferences;
        const prefs = (rawPrefs && typeof rawPrefs === "object" ? rawPrefs : {}) as {
          email?: Record<string, boolean>;
        };
        if (prefs.email && prefs.email[type] === false) {
          return Response.json({ skipped: "pref_off" });
        }

        const linkPath = link && link.startsWith("/") ? link : "/";
        const linkUrl = `https://derdalax.co.mz${linkPath}`;
        const html = renderEmail(title, body ?? "", linkUrl);
        const text = `${title}\n\n${body ?? ""}\n\n${linkUrl}`;
        const messageId = crypto.randomUUID();

        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: `notif_${type}`,
          recipient_email: email,
          status: "pending",
        });

        const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            to: email,
            from: "DERDALAX <noreply@derdalax.co.mz>",
            reply_to: "suporte@derdalax.co.mz",
            sender_domain: "notify.derdalax.co.mz",
            subject: title,
            html,
            text,
            purpose: "transactional",
            label: `notif_${type}`,
            queued_at: new Date().toISOString(),
          },
        });

        if (enqueueError) {
          await supabaseAdmin.from("email_send_log").insert({
            message_id: messageId,
            template_name: `notif_${type}`,
            recipient_email: email,
            status: "failed",
            error_message: enqueueError.message,
          });
          return new Response(enqueueError.message, { status: 500 });
        }

        return Response.json({ enqueued: true, message_id: messageId });
      },
    },
  },
});
