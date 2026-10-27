import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { currentPath } from "@/lib/safeRedirect";

export function useFavorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setIds = (ids: Set<string>) => queryClient.setQueryData(["favorite-ids", user?.id], Array.from(ids));
  const { data: savedIds = [] } = useQuery({
    queryKey: ["favorite-ids", user?.id], enabled: !!user, staleTime: Infinity, gcTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).order("product_id", { ascending: false });
      return (data ?? []).map(r => r.product_id);
    },
  });
  const ids = new Set(savedIds);

  const load = useCallback(async () => {
    if (!user) { setIds(new Set()); return; }
    const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false }).order("product_id", { ascending: false });
    setIds(new Set((data ?? []).map((r) => r.product_id)));
  }, [user]);



  const toggle = useCallback(async (productId: string) => {
    if (!user) {
      const redirect = currentPath();
      navigate({ to: "/login", search: redirect ? { redirect } : {} });
      return;
    }
    if (ids.has(productId)) {
      const next = new Set(ids); next.delete(productId); setIds(next);
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", productId);
    } else {
      const next = new Set(ids); next.add(productId); setIds(next);
      const { error } = await supabase.from("favorites").insert({ user_id: user.id, product_id: productId });
      if (error) { next.delete(productId); setIds(new Set(next)); toast.error("Erro ao favoritar"); }
    }
  }, [ids, user]);

  return { favoriteIds: ids, isFavorite: (id: string) => ids.has(id), toggle, refresh: load };
}
