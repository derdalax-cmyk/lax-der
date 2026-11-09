import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/profile/reminders")({
  server: { handlers: { POST: async ({ request }) => {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
    const { processProfileReminders } = await import("@/lib/profileCompletion.server");
    return Response.json(await processProfileReminders());
  } } },
});