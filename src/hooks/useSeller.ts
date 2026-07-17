import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SellerRow = {
  id: string;
  user_id: string;
  full_name: string;
  store_name: string;
  email: string | null;
  phone: string;
  province: string;
  city: string | null;
  description: string | null;
  logo_url: string | null;
  status: string;
  admin_notes: string | null;
  approved_at: string | null;
  created_at: string;
  emola_number: string | null;
  mpesa_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
};


export function useSeller() {
  const { user, loading: authLoading } = useAuth();
  const q = useQuery({
    queryKey: ["my-seller", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("sellers").select("*").eq("user_id", user!.id).maybeSingle();
      return (data ?? null) as SellerRow | null;
    },
  });
  return {
    seller: q.data ?? null,
    isApproved: q.data?.status === "approved",
    loading: authLoading || q.isLoading,
  };
}
