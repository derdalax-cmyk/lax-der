import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY test-only route. Removed after validating the account deletion flow.
export const Route = createFileRoute("/api/public/tmp-deletion-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { secret?: string; email?: string; password?: string };
        if (body.secret !== "tmp-deletion-test-9271") return new Response("no", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: body.email!,
          password: body.password!,
          email_confirm: true,
        });
        if (error) return Response.json({ error: error.message }, { status: 400 });
        return Response.json({ user_id: data.user?.id });
      },
    },
  },
});
