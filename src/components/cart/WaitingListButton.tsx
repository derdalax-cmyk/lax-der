import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";

export function WaitingListButton({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [inList, setInList] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase.from("waiting_list")
        .select("id,position,status").eq("product_id", productId).eq("user_id", user.id).maybeSingle();
      setInList(!!data);
      setPosition(data?.position ?? null);
    };
    load();
  }, [user, productId]);

  const join = async () => {
    if (!user) { toast.error("Inicie sessão"); return; }
    setLoading(true);
    const { count } = await supabase.from("waiting_list").select("*", { count: "exact", head: true })
      .eq("product_id", productId).in("status", ["waiting", "notified"]);
    const pos = (count ?? 0) + 1;
    const { error } = await supabase.from("waiting_list").insert({
      user_id: user.id, product_id: productId, position: pos, status: "waiting",
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setInList(true); setPosition(pos);
    toast.success(`Está na fila (posição ${pos}). Avisaremos quando disponível.`);
  };

  const leave = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.from("waiting_list").delete().eq("product_id", productId).eq("user_id", user.id);
    setLoading(false);
    setInList(false); setPosition(null);
    toast.success("Removido da fila");
  };

  if (inList) {
    return (
      <Button variant="outline" onClick={leave} disabled={loading} className="w-full">
        <BellRing className="w-4 h-4 mr-2" /> Na fila (#{position}) — sair
      </Button>
    );
  }
  return (
    <Button variant="outline" onClick={join} disabled={loading} className="w-full">
      <Bell className="w-4 h-4 mr-2" /> Avise-me quando disponível
    </Button>
  );
}
