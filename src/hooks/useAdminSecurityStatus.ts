import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminSecurityStatus } from "@/lib/admin-security.functions";

export function useAdminSecurityStatus(enabled = true) {
  const fn = useServerFn(getAdminSecurityStatus);
  return useQuery({ queryKey: ["admin-security-status"], queryFn: () => fn(), enabled, staleTime: 30_000, refetchInterval: 60_000 });
}

/** Maps step-up server errors to a redirect to /admin/verificar. Returns true if handled. */
export function isStepUpError(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return m.includes("STEP_UP_REQUIRED");
}
