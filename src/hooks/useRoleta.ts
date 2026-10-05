import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { getRoletaCart } from "@/lib/productPrice";

export type RoletaCampaignPublic = {
  id: string; name: string; ends_at: string | null; max_percent: number;
  max_discount_mt: number; validity_days: number; prizes: number[];
};
export type RoletaSpinInfo = { id: string; percent: number; status: string; won_at?: string; expires_at: string | null; max_discount_mt: number; campaign_id?: string; order_id?: string | null };
export type RoletaActiveReward = RoletaSpinInfo & { eligible_product_ids: string[] };
export type RoletaHistoryItem = { id?: string; campaign: string; percent: number; status: string; won_at: string; expires_at: string | null; order_id?: string | null };
export type MyRoleta = {
  campaign: RoletaCampaignPublic | null;
  has_spun_current?: boolean;
  current_spin: RoletaSpinInfo | null;
  reward: RoletaSpinInfo | null;
  active_rewards?: RoletaActiveReward[];
  eligible_product_ids: string[];
  referral: { ref_code: string; count: number; needed: number; total?: number; issued?: number; code: string | null; code_status: string | null };
  popup_dismissed_until: string | null;
  history: RoletaHistoryItem[];
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
  const activeRewards = useMemo<RoletaActiveReward[]>(() => {
    const now = Date.now();
    return (mine.data?.active_rewards ?? [])
      .filter((r) => r.status === "ACTIVE" && r.expires_at && new Date(r.expires_at).getTime() > now && r.percent > 0)
      .sort((a, b) => b.percent - a.percent || Number(b.max_discount_mt) - Number(a.max_discount_mt));
  }, [mine.data]);
  // Highest reward (compat with single-reward consumers)
  const reward = activeRewards[0] ?? null;
  const eligible = useMemo(() => new Set(activeRewards.flatMap((r) => r.eligible_product_ids ?? [])), [activeRewards]);
  /** Best reward for a single product (storefront badge/preview). Server decides on order. */
  const rewardFor = useCallback(
    (productId: string) => activeRewards.find((r) => (r.eligible_product_ids ?? []).includes(productId)) ?? null,
    [activeRewards],
  );
  return {
    campaign: pub.data ?? null,
    mine: mine.data ?? null,
    activeReward: reward,
    activeRewards,
    rewardFor,
    eligible,
    refresh: () => qc.invalidateQueries({ queryKey: ROLETA_KEY }),
  };
}

/** Estimate of the roleta discount for the current cart: picks the single reward with the best
 *  real saving (mirrors roleta_apply_to_order). Server recomputes on order creation. */
export function useCartRoleta() {
  const { items } = useCart();
  const { activeRewards } = useRoleta();
  return useMemo(() => {
    const base = items.map((it) => ({
      key: `${it.product_id}-${it.variation_id ?? "_"}`,
      productId: it.product_id,
      unitPrice: Number(it.variation?.price ?? it.product.base_price),
      basePrice: Number(it.product.base_price),
      originalPrice: it.product.original_price ?? null,
      quantity: it.quantity,
    }));
    const normalDiscount = base.reduce((a, l) => {
      const o = Number(l.originalPrice ?? 0);
      return l.unitPrice === l.basePrice && o > l.basePrice ? a + (o - l.basePrice) * l.quantity : a;
    }, 0);
    let best: { reward: RoletaActiveReward | null; discount: number; byKey: ReturnType<typeof getRoletaCart>["byKey"] } = { reward: null, discount: 0, byKey: new Map() };
    for (const r of activeRewards) {
      const ids = new Set(r.eligible_product_ids ?? []);
      const res = getRoletaCart(base.map((l) => ({ ...l, eligible: ids.has(l.productId) })), r);
      if (res.discount > best.discount) best = { reward: r, discount: res.discount, byKey: res.byKey };
    }
    return { reward: best.reward, normalDiscount, roletaDiscount: best.discount, byKey: best.byKey };
  }, [items, activeRewards]);
}
