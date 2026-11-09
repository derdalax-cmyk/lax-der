import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const dismissProfileCompletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("dismiss_profile_completion");
    if (error) throw new Error("Não foi possível guardar o adiamento. Tente novamente.");
    return data;
  });