import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bell, ShoppingBag, CheckCircle2, XCircle, Sparkles, Check, Trash2, Loader2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

const ICONS: Record<string, { icon: typeof Bell; cls: string }> = {
  order: { icon: ShoppingBag, cls: "bg-gold/20 text-gold" },
  product_approved: { icon: CheckCircle2, cls: "bg-success/15 text-success" },
  product_rejected: { icon: XCircle, cls: "bg-destructive/15 text-destructive" },
  featured_approved: { icon: Sparkles, cls: "bg-success/15 text-success" },
  featured_rejected: { icon: XCircle, cls: "bg-destructive/15 text-destructive" },
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} d`;
}

export function SellerNotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["seller-notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`seller-notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["seller-notifications", user.id] });
          try { audioRef.current?.play().catch(() => {}); } catch { /* ignore */ }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  const markAllRead = async () => {
    if (unread === 0) return;
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    qc.invalidateQueries({ queryKey: ["seller-notifications", user?.id] });
  };

  const clearAll = async () => {
    if (items.length === 0) return;
    await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    qc.invalidateQueries({ queryKey: ["seller-notifications", user?.id] });
  };

  const openItem = async (n: NotificationRow) => {
    setOpen(false);
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["seller-notifications", user?.id] });
    }
    if (n.link) navigate({ to: n.link as "/vendedor/pedidos" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative p-2 rounded-md hover:bg-secondary transition-colors" aria-label="Notificações">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-medium text-sm">Notificações</span>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={markAllRead}>
                <Check className="w-3 h-3" /> Marcar lidas
              </button>
            )}
            {items.length > 0 && (
              <button className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1" onClick={clearAll}>
                <Trash2 className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Sem notificações.</div>
          ) : (
            items.map((n) => {
              const meta = ICONS[n.type] ?? { icon: Bell, cls: "bg-secondary text-muted-foreground" };
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border last:border-0 hover:bg-secondary/50 transition-colors",
                    !n.read && "bg-gold/5",
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", meta.cls)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {n.title}
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />}
                    </div>
                    {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5">{relTime(n.created_at)}</div>
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
