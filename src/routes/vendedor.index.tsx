import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeller } from "@/hooks/useSeller";
import { Package, Clock, CheckCircle2, XCircle, TrendingUp, Plus, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/vendedor/")({
  component: SellerDashboard,
});

type P = {
  id: string; title: string; base_price: number; status: string;
  approval_status: string; images: unknown; created_at: string;
};

function SellerDashboard() {
  const { seller } = useSeller();

  const { data: products } = useQuery({
    queryKey: ["seller-products", seller?.id],
    enabled: !!seller?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("id,title,base_price,status,approval_status,images,created_at")
        .eq("seller_id", seller!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as P[];
    },
  });

  const list = products ?? [];
  const total = list.length;
  const pending = list.filter((p) => p.approval_status === "pending").length;
  const approved = list.filter((p) => p.approval_status === "approved").length;
  const rejected = list.filter((p) => p.approval_status === "rejected").length;
  const sold = list.filter((p) => p.status === "sold");
  const revenue = sold.reduce((s, p) => s + Number(p.base_price), 0);

  const stats = [
    { label: "Produtos", value: total, icon: Package, cls: "bg-ink/5 text-ink" },
    { label: "Pendentes", value: pending, icon: Clock, cls: "bg-gold/15 text-gold" },
    { label: "Aprovados", value: approved, icon: CheckCircle2, cls: "bg-success/10 text-success" },
    { label: "Rejeitados", value: rejected, icon: XCircle, cls: "bg-destructive/10 text-destructive" },
    { label: "Vendas", value: `${revenue.toLocaleString("pt-PT")} MT`, icon: TrendingUp, cls: "bg-green/10 text-green" },
  ];

  const recent = list.slice(0, 5);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Olá, {seller?.full_name?.split(" ")[0] ?? "vendedor"} 👋</h1>
          <p className="text-sm text-muted-foreground">Visão geral da sua loja <strong>{seller?.store_name}</strong>.</p>
        </div>
        <Button asChild className="bg-gold text-ink hover:bg-gold/90">
          <Link to="/vendedor/produtos"><Plus className="w-4 h-4 mr-1" /> Adicionar produto</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg grid place-items-center mb-3 ${s.cls}`}><Icon className="w-4.5 h-4.5" /></div>
              <p className="text-xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>

      {pending > 0 && (
        <div className="mb-6 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-gold shrink-0" />
          Tem <strong>{pending}</strong> produto(s) à espera de aprovação do administrador.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Produtos recentes</h2>
          <Link to="/vendedor/produtos" className="text-sm text-gold hover:underline">Ver todos</Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">
            Ainda não tem produtos. <Link to="/vendedor/produtos" className="text-gold hover:underline">Adicione o primeiro</Link>.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((p) => {
              const imgs = Array.isArray(p.images) ? (p.images as string[]) : [];
              const st = p.approval_status;
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-11 h-11 rounded-md bg-secondary overflow-hidden grid place-items-center shrink-0">
                    {imgs[0] ? <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" /> : <ImageOff className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{Number(p.base_price).toLocaleString("pt-PT")} MT</p>
                  </div>
                  <span className={`text-[11px] px-2 py-1 rounded-full ${st === "approved" ? "bg-success/15 text-success" : st === "pending" ? "bg-gold/15 text-gold" : "bg-destructive/15 text-destructive"}`}>
                    {st === "approved" ? "Aprovado" : st === "pending" ? "Pendente" : "Rejeitado"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
