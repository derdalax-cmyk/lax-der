import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type RoletaCampaignPublic = {
  id: string; name: string; ends_at: string | null; max_percent: number;
  max_discount_mt: number; validity_days: number; prizes: number[];
};
export type RoletaSpinInfo = { id: string; percent: number; status: string; won_at?: string; expires_at: string | null; max_discount_mt: number; campaign_id?: string; order_id?: string | null };
export type MyRoleta = {
  campaign: RoletaCampaignPublic | null;
  current_spin: RoletaSpinInfo | null;
  reward: RoletaSpinInfo | null;
  eligible_product_ids: string[];
  referral: { ref_code: string; count: number; needed: number; code: string | null; code_status: string | null };
  popup_dismissed_until: string | null;
  history: { campaign: string; percent: number; status: string; won_at: string; expires_at: string | null }[];
};

export const ROLETA_KEY = ["roleta"] as const;

export function useRoleta() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const pub = useQuery({
    queryKey: [...ROLETA_KEY, "public"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_roleta_public");
      return (data ?? null) as unknown as RoletaCampaignPublic | null;
    },
    staleTime: 60_000,
  });
  const mine = useQuery({
    queryKey: [...ROLETA_KEY, "mine", user?.id],
    enabled: !!user && !loading,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_roleta");
      if (error) throw error;
      return data as unknown as MyRoleta;
    },
    staleTime: 30_000,
  });
  const reward = mine.data?.reward?.status === "ACTIVE" && mine.data.reward.expires_at && new Date(mine.data.reward.expires_at) > new Date()
    ? mine.data.reward : null;
  const eligible = useMemo(() => new Set(reward ? mine.data?.eligible_product_ids ?? [] : []), [reward, mine.data]);
  return {
    campaign: pub.data ?? null,
    mine: mine.data ?? null,
    activeReward: reward,
    eligible,
    refresh: () => qc.invalidateQueries({ queryKey: ROLETA_KEY }),
  };
}
