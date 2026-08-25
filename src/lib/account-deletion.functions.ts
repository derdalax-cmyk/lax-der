import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAccountDeletionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { findOpenDisputes } = await import("./account-deletion.server");
    const blockers = await findOpenDisputes(context.userId);
    return { blockers, email: (context.claims as { email?: string }).email ?? null };
  });

export const requestAccountDeletionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { findOpenDisputes, createAndSendDeletionCode } = await import("./account-deletion.server");

    const blockers = await findOpenDisputes(context.userId);
    if (blockers.length > 0) return { sent: false as const, blockers };

    const email = (context.claims as { email?: string }).email;
    if (!email) throw new Error("A sua conta não tem email associado. Contacte o suporte.");

    const { expiresAt } = await createAndSendDeletionCode(context.userId, email);
    return { sent: true as const, blockers: [], expiresAt, email };
  });

export const confirmAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    const code = String(data?.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) throw new Error("O código deve ter 6 dígitos.");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { findOpenDisputes, verifyDeletionCode, purgeAccount } = await import(
      "./account-deletion.server"
    );

    const blockers = await findOpenDisputes(context.userId);
    if (blockers.length > 0) return { deleted: false as const, error: "blocked", blockers };

    const result = await verifyDeletionCode(context.userId, data.code);
    if (!result.ok) {
      return { deleted: false as const, error: result.reason, attemptsLeft: result.attemptsLeft };
    }

    await purgeAccount(context.userId);
    return { deleted: true as const };
  });
