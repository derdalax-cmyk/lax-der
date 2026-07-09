import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Bell, ShoppingBag, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type NotifKind = "order" | "product_approved" | "product_rejected" | "featured";

type Notif = {
  kind: NotifKind;
  id: string;
  title: string;
  sub: string;
  at: string;
  to: "/vendedor/pedidos" | "/vendedor/produtos" | "/vendedor/destaques";
};

const ICONS: Record<NotifKind, { icon: typeof Bell; cls: string }> = {
  order: { icon: ShoppingBag, cls: "bg-gold/20 text-gold" },
  product_approved: { icon: CheckCircle2, cls: "bg-success/15 text-success" },
  product_rejected: { icon: XCircle, cls: "bg-destructive/15 text-destructive" },
  featured: { icon: Sparkles, cls: "bg-emerald-500/15 text-emerald-600" },
};

export function SellerNotificationBell({ sellerId }: { sellerId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const productIds = useRef<Set<string>>(new Set());
  const productTitles = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!sellerId) return;
    let active = true;

    const loadProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id,title")
        .eq("seller_id", sellerId);
      if (!active) return;
      productIds.current = new Set((data ?? []).map((p) => p.id));
      productTitles.current = new Map((data ?? []).map((p) => [p.id, p.title]));
    };
    loadProducts();

    const add = (n: Notif) => setItems((prev) => [n, ...prev].slice(0, 20));

    const channel = supabase
      .channel(`seller-notifications-${sellerId}`)
      // Novos itens de pedido que contêm produtos deste vendedor
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_items" }, (payload) => {
        const oi = payload.new as { id: string; product_id: string; quantity: number; created_at?: string };
        if (!productIds.current.has(oi.product_id)) return;
        add({
          kind: "order",
          id: oi.id,
          title: productTitles.current.get(oi.product_id) ?? "Novo pedido",
          sub: `Nova venda · ${oi.quantity} un.`,
          at: oi.created_at ?? new Date().toISOString(),
          to: "/vendedor/pedidos",
        });
      })
      // Aprovação/rejeição de produtos do vendedor
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products", filter: `seller_id=eq.${sellerId}` }, (payload) => {
        const oldR = payload.old as { approval_status?: string };
        const newR = payload.new as { id: string; title: string; approval_status?: string; updated_at?: string };
        if (oldR.approval_status === newR.approval_status) return;
        if (newR.approval_status === "approved") {
          add({ kind: "product_approved", id: newR.id, title: newR.title, sub: "Produto aprovado", at: newR.updated_at ?? new Date().toISOString(), to: "/vendedor/produtos" });
        } else if (newR.approval_status === "rejected") {
          add({ kind: "product_rejected", id: newR.id, title: newR.title, sub: "Produto rejeitado", at: newR.updated_at ?? new Date().toISOString(), to: "/vendedor/produtos" });
        }
      })
      // Decisões sobre candidaturas a destaques
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "featured_collection_products", filter: `submitted_by=eq.${sellerId}` }, (payload) => {
        const oldR = payload.old as { status?: string };
        const newR = payload.new as { product_id: string; status?: string };
        if (oldR.status === newR.status || newR.status === "pending") return;
        add({
          kind: "featured",
          id: newR.product_id + (newR.status ?? ""),
          title: productTitles.current.get(newR.product_id) ?? "Candidatura a destaque",
          sub: newR.status === "approved" ? "Destaque aprovado" : "Destaque rejeitado",
          at: new Date().toISOString(),
          to: "/vendedor/destaques",
        });
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [sellerId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative p-2 rounded-md border border-border bg-card hover:bg-secondary transition-colors" aria-label="Notificações">
        <Bell className="w-5 h-5" />
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">
            {items.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-medium text-sm">Notificações</span>
          {items.length > 0 && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setItems([])}>Limpar</button>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Sem novas notificações.</div>
          ) : (
            items.map((n, i) => {
              const { icon: Icon, cls } = ICONS[n.kind];
              return (
                <button
                  key={n.kind + n.id + i}
                  onClick={() => { setOpen(false); navigate({ to: n.to }); }}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/50 border-b border-border last:border-0"
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", cls)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.sub} · {new Date(n.at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
