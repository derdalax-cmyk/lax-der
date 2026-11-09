import { createFileRoute } from "@tanstack/react-router";

async function unsubscribe(token: string | null) {
  if (!token || !/^[a-zA-Z0-9_-]{16,128}$/.test(token)) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("email_unsubscribe_tokens").select("email").eq("token", token).maybeSingle();
  if (!data?.email) return false;
  await supabaseAdmin.from("suppressed_emails").upsert({ email: data.email.toLowerCase(), reason: "unsubscribe", metadata: { source: "campaign" } as never }, { onConflict: "email", ignoreDuplicates: true });
  return true;
}

const page = (ok: boolean) => new Response(
  `<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Derdalax</title><body style="font-family:Arial,sans-serif;text-align:center;padding:48px 16px;"><h1>Derdalax</h1><p>${ok ? "A sua subscrição de emails de campanhas foi cancelada." : "Link inválido ou expirado."}</p><p><a href="https://derdalax.co.mz">Voltar à loja</a></p></body></html>`,
  { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
);

export const Route = createFileRoute("/api/public/campaigns/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => page(await unsubscribe(new URL(request.url).searchParams.get("token"))),
      POST: async ({ request }) => page(await unsubscribe(new URL(request.url).searchParams.get("token"))),
    },
  },
});
