import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";

type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  product_id: string | null;
  product_title: string | null;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: string;
};

const MZN = (v: unknown) =>
  `${Number(v ?? 0).toLocaleString("pt-PT", { maximumFractionDigits: 0 })} MT`;

function describe(log: AuditLog): string {
  const who = log.actor_name || log.actor_email || "Colaborador";
  const prod = log.product_title ? `"${log.product_title}"` : "um produto";
  const c = (log.changes ?? {}) as Record<string, any>;

  if (log.action === "product.create") return `${who} criou o produto ${prod}`;

  const parts: string[] = [];
  if (c.base_price) parts.push(`preço ${MZN(c.base_price.from)} → ${MZN(c.base_price.to)}`);
  if (c.title) parts.push(`título "${c.title.from}" → "${c.title.to}"`);
  if (c.stock) parts.push(`estoque ${c.stock.from} → ${c.stock.to}`);
  if (c.status) parts.push(`estado ${c.status.from} → ${c.status.to}`);
  if (c.images) parts.push("fotos alteradas");
  if (c.description) parts.push("descrição alterada");

  if (log.action === "product.update") {
    return parts.length
      ? `${who} editou ${prod}: ${parts.join(", ")}`
      : `${who} editou ${prod}`;
  }
  return `${who} — ${log.action}${parts.length ? `: ${parts.join(", ")}` : ""}`;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function SellerAuditSection({ sellerId }: { sellerId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["seller-audit", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_audit_logs", {
        _seller_id: sellerId,
        _limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as unknown as AuditLog[];
    },
  });

  const logs = data ?? [];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <History className="w-4 h-4 text-gold" />
        <h3 className="font-medium">Auditoria de colaboradores</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Ações feitas por colaboradores nos produtos desta loja. Alterações do próprio dono da loja
        não são registadas.
      </p>

      {isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded bg-secondary animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem atividades registadas.</p>
      ) : (
        <ol className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {logs.map((log) => (
            <li key={log.id} className="border-l-2 border-border pl-3">
              <p className="text-sm">{describe(log)}</p>
              <p className="text-xs text-muted-foreground">{fmt(log.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
