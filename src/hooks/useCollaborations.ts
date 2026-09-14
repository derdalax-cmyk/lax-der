import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type Collaboration = {
  seller_id: string;
  store_name: string;
  logo_url: string | null;
  city: string | null;
  province: string | null;
  role_slug: string;
  role_label: string;
  permissions: string[];
  status: "active" | "suspended" | "removed";
  total_products: number;
  pending_products: number;
  approved_products: number;
};

export function useCollaborations() {
  const { user, loading: authLoading } = useAuth();
  const q = useQuery({
    queryKey: ["my-collaborations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_collaborations");
      if (error) throw error;
      return (data ?? []) as unknown as Collaboration[];
    },
  });
  const all = q.data ?? [];
  return {
    collaborations: all,
    active: all.filter((c) => c.status === "active"),
    loading: authLoading || q.isLoading,
    refetch: q.refetch,
  };
}

export function useCollaboration(sellerId: string | undefined) {
  const { collaborations, loading } = useCollaborations();
  return {
    collaboration: collaborations.find((c) => c.seller_id === sellerId) ?? null,
    loading,
  };
}

export function can(c: Collaboration | null, perm: string) {
  return !!c && c.status === "active" && c.permissions.includes(perm);
}
