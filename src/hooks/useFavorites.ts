import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useFavorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) { setIds(new Set()); return; }
    const { data } = await supabase.from("favorites").select("product_id").eq("user_id", user.id);
    setIds(new Set((data ?? []).map((r) => r.product_id)));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (productId: string) => {
    if (!user) { toast.error("Inicie sessão para adicionar favoritos"); return; }
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
