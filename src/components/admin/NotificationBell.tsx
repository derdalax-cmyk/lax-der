import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Bell, ShoppingBag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Notif = { id: string; name: string; total: number; at: string };

const money = (n: number) => `${Number(n).toLocaleString("pt-PT")} MT`;

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("admin-new-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as { id: string; customer_name: string | null; total: number; created_at: string };
        setItems((prev) => [{ id: o.id, name: o.customer_name ?? "Cliente", total: Number(o.total), at: o.created_at }, ...prev].slice(0, 20));
        try { audioRef.current?.play().catch(() => {}); } catch { /* ignore */ }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative p-2 rounded-md hover:bg-secondary transition-colors" aria-label="Notificações">
        <Bell className="w-5 h-5" />
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">
            {items.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-medium text-sm">Novos pedidos</span>
          {items.length > 0 && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setItems([])}>Limpar</button>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Sem novos pedidos.</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => { setOpen(false); navigate({ to: "/admin/pedidos" }); }}
                className={cn("w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/50 border-b border-border last:border-0")}
              >
                <div className="w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{n.name}</div>
                  <div className="text-xs text-muted-foreground">{money(n.total)} · {new Date(n.at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
