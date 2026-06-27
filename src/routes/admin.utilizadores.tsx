import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Users, UserPlus, UserCheck, UserX, UserCog,
  ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronLeft, ChevronRight, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/utilizadores")({
  component: AdminUtilizadores,
});

type EnrichedUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
  ordersCount: number;
  totalSpent: number;
  lastOrder: string | null;
  active: boolean;
  complete: boolean;
};

const money = (n: number) => `${Number(n).toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MT`;
const DAY = 86400000;

type SortKey = "name" | "city" | "ordersCount" | "totalSpent" | "lastOrder" | "created_at";

function AdminUtilizadores() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [purchases, setPurchases] = useState("all");
  const [profileState, setProfileState] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: orders }] = await Promise.all([
        supabase.from("profiles").select("id, name, email, phone, city, created_at"),
        supabase.from("orders").select("user_id, total, status, payment_status, created_at"),
      ]);
      if (error) throw error;

      const now = Date.now();
      const agg = new Map<string, { count: number; spent: number; last: string | null }>();
      (orders ?? []).forEach((o) => {
        const cur = agg.get(o.user_id) ?? { count: 0, spent: 0, last: null };
        cur.count += 1;
        const paid = o.payment_status === "paid" || o.status === "paid" || o.status === "delivered";
        if (paid) cur.spent += Number(o.total);
        if (!cur.last || new Date(o.created_at) > new Date(cur.last)) cur.last = o.created_at;
        agg.set(o.user_id, cur);
      });

      const enriched: EnrichedUser[] = (profiles ?? []).map((p) => {
        const a = agg.get(p.id) ?? { count: 0, spent: 0, last: null };
        const active = a.last ? now - +new Date(a.last) <= 90 * DAY : false;
        const complete = !!p.phone && !!p.city && !!p.name;
        return {
          id: p.id, name: p.name, email: p.email, phone: p.phone, city: p.city, created_at: p.created_at,
          ordersCount: a.count, totalSpent: a.spent, lastOrder: a.last, active, complete,
        };
      });
      return enriched;
    },
  });

  const users = data ?? [];

  const cities = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => { if (u.city) set.add(u.city); });
    return [...set].sort();
  }, [users]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: users.length,
      new30: users.filter((u) => now - +new Date(u.created_at) <= 30 * DAY).length,
      active: users.filter((u) => u.active).length,
      inactive: users.filter((u) => u.ordersCount > 0 && !u.active).length,
      incomplete: users.filter((u) => !u.complete).length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.filter((u) => {
      if (city !== "all" && u.city !== city) return false;
      if (purchases === "with" && u.ordersCount === 0) return false;
      if (purchases === "without" && u.ordersCount > 0) return false;
      if (profileState === "complete" && !u.complete) return false;
      if (profileState === "incomplete" && u.complete) return false;
      if (q) {
        const hay = `${u.name ?? ""} ${u.email ?? ""} ${u.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = (a.name ?? "").localeCompare(b.name ?? ""); break;
        case "city": cmp = (a.city ?? "").localeCompare(b.city ?? ""); break;
        case "ordersCount": cmp = a.ordersCount - b.ordersCount; break;
        case "totalSpent": cmp = a.totalSpent - b.totalSpent; break;
        case "lastOrder": cmp = (a.lastOrder ? +new Date(a.lastOrder) : 0) - (b.lastOrder ? +new Date(b.lastOrder) : 0); break;
        case "created_at": cmp = +new Date(a.created_at) - +new Date(b.created_at); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [users, search, city, purchases, profileState, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const exportCsv = () => {
    const headers = ["Nome", "Email", "Telefone", "Cidade", "Pedidos", "Total Gasto", "Ultimo Pedido", "Cadastro", "Status", "Perfil"];
    const rows = filtered.map((u) => [
      u.name ?? "", u.email ?? "", u.phone ?? "", u.city ?? "", u.ordersCount, u.totalSpent,
      u.lastOrder ? new Date(u.lastOrder).toLocaleDateString("pt-PT") : "",
      new Date(u.created_at).toLocaleDateString("pt-PT"),
      u.active ? "Ativo" : "Inativo", u.complete ? "Completo" : "Incompleto",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `utilizadores-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const initials = (name: string | null, email: string | null) => {
    const base = (name || email || "?").trim();
    const parts = base.split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || base[0]?.toUpperCase() || "?";
  };

  const SortHeader = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-4 py-3", className)}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {children}
        {sortKey === k ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Utilizadores</h1>
          <p className="text-sm text-muted-foreground">Base de clientes da loja DERDALAX.</p>
        </div>
        <Button onClick={exportCsv} variant="outline">
          <Download className="w-4 h-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} icon={Users} />
        <StatCard label="Novos (30d)" value={stats.new30} icon={UserPlus} />
        <StatCard label="Ativos (90d)" value={stats.active} icon={UserCheck} />
        <StatCard label="Inativos" value={stats.inactive} icon={UserX} accent />
        <StatCard label="Perfil Incompleto" value={stats.incomplete} icon={UserCog} accent />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Pesquisar nome, email, telefone…" className="pl-9" />
        </div>
        <Select value={city} onValueChange={(v) => { setCity(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Cidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas cidades</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={purchases} onValueChange={(v) => { setPurchases(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Compras" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="with">Com compras</SelectItem>
            <SelectItem value="without">Sem compras</SelectItem>
          </SelectContent>
        </Select>
        <Select value={profileState} onValueChange={(v) => { setProfileState(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer perfil</SelectItem>
            <SelectItem value="complete">Perfil completo</SelectItem>
            <SelectItem value="incomplete">Perfil incompleto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <SortHeader k="name">Utilizador</SortHeader>
                <th className="px-4 py-3">Contacto</th>
                <SortHeader k="city">Cidade</SortHeader>
                <SortHeader k="ordersCount">Pedidos</SortHeader>
                <SortHeader k="totalSpent" className="text-right">Total Gasto</SortHeader>
                <SortHeader k="lastOrder">Último Pedido</SortHeader>
                <SortHeader k="created_at">Cadastro</SortHeader>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">A carregar…</td></tr>}
              {!isLoading && paged.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-16 text-center">
                  <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <div className="text-muted-foreground">Nenhum utilizador encontrado.</div>
                </td></tr>
              )}
              {paged.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-ink text-gold flex items-center justify-center text-xs font-semibold shrink-0">
                        {initials(u.name, u.email)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name || "Sem nome"}</div>
                        {!u.complete && <span className="text-[10px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded">Incompleto</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">{u.email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.phone ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.city ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{u.ordersCount}</td>
                  <td className="px-4 py-3 text-right font-semibold">{money(u.totalSpent)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.lastOrder ? new Date(u.lastOrder).toLocaleDateString("pt-PT") : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(u.created_at).toLocaleDateString("pt-PT")}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      u.active ? "bg-success/15 text-success border-success/30" : "bg-secondary text-muted-foreground border-border")}>
                      {u.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Mostrar</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <span>de {filtered.length} utilizadores</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Página {safePage} de {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: {
  label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; accent?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
        <Icon className={cn("w-4 h-4", accent ? "text-destructive" : "text-gold")} />
      </div>
      <div className="font-display text-2xl leading-tight">{value}</div>
    </div>
  );
}
