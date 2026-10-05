import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, Plus, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLETA_KEY } from "@/hooks/useRoleta";

export const Route = createFileRoute("/admin/roleta")({
  head: () => ({ meta: [{ title: "Roleta de Descontos · Admin DERDALAX" }, { name: "description", content: "Gestão da Roleta DERDALAX." }] }),
  component: AdminRoleta,
});

type Prize = { percent: number; weight: number };
type Campaign = {
  id: string; name: string; is_active: boolean; starts_at: string | null; ends_at: string | null;
  validity_days: number; max_discount_mt: number; prizes: Prize[]; top_prize_percent: number; top_prize_limit: number; created_at: string;
};
const DEFAULT_PRIZES: Prize[] = [
  { percent: 0, weight: 30 }, { percent: 5, weight: 30 }, { percent: 10, weight: 22 }, { percent: 15, weight: 12 },
  { percent: 20, weight: 5 }, { percent: 25, weight: 0.8 }, { percent: 30, weight: 0.2 },
];
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-PT") : "—");
const mzn = (n: unknown) => `${Number(n ?? 0).toLocaleString("pt-PT", { maximumFractionDigits: 2 })} MT`;

function AdminRoleta() {
  const qc = useQueryClient();
  const { data: campaigns = [], refetch } = useQuery({
    queryKey: ["admin-roleta-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roleta_campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Campaign[];
    },
  });
  const [selId, setSelId] = useState<string | null>(null);
  useEffect(() => { if (!selId && campaigns.length) setSelId((campaigns.find((c) => c.is_active) ?? campaigns[0]).id); }, [campaigns, selId]);
  const sel = campaigns.find((c) => c.id === selId) ?? null;

  const createCampaign = async () => {
    const name = window.prompt("Nome da nova campanha", `Campanha ${new Date().toLocaleDateString("pt-PT")}`)?.trim();
    if (!name) return;
    const { data, error } = await supabase.from("roleta_campaigns").insert({ name, prizes: DEFAULT_PRIZES as never }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await refetch(); setSelId(data.id); toast.success("Campanha criada (desativada)");
  };

  const renameCampaign = async () => {
    if (!sel) return;
    const name = window.prompt("Novo nome da campanha", sel.name)?.trim();
    if (!name || name === sel.name) return;
    const { error } = await supabase.from("roleta_campaigns").update({ name }).eq("id", sel.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Nome atualizado"); await refetch(); qc.invalidateQueries({ queryKey: ROLETA_KEY });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Roleta de Descontos</h1>
          <p className="text-sm text-muted-foreground">Campanhas, códigos, indicações e resultados.</p>
        </div>
        <div className="flex gap-2">
          {campaigns.length > 0 && (
            <Select value={selId ?? undefined} onValueChange={setSelId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Campanha" /></SelectTrigger>
              <SelectContent>{campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.is_active ? " · ativa" : ""}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {sel && <Button variant="outline" onClick={renameCampaign}><Pencil className="w-4 h-4 mr-1" /> Editar nome</Button>}
          <Button onClick={createCampaign} className="bg-gold text-ink hover:bg-gold/90"><Plus className="w-4 h-4 mr-1" /> Nova campanha</Button>
        </div>
      </div>

      {!sel ? <p className="text-sm text-muted-foreground">Ainda não existe nenhuma campanha.</p> : (
        <Tabs defaultValue="campanha">
          <TabsList>
            <TabsTrigger value="campanha">Campanha</TabsTrigger>
            <TabsTrigger value="codigos">Códigos</TabsTrigger>
            <TabsTrigger value="indicacoes">Indicações</TabsTrigger>
            <TabsTrigger value="resultados">Resultados</TabsTrigger>
          </TabsList>
          <TabsContent value="campanha"><CampaignForm key={`${sel.id}-${sel.name}`} c={sel} campaigns={campaigns} onSaved={() => { refetch(); qc.invalidateQueries({ queryKey: ROLETA_KEY }); }} /></TabsContent>
          <TabsContent value="codigos"><CodesTab campaignId={sel.id} /></TabsContent>
          <TabsContent value="indicacoes"><ReferralsTab campaignId={sel.id} /></TabsContent>
          <TabsContent value="resultados"><ResultsTab campaignId={sel.id} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function CampaignForm({ c, campaigns, onSaved }: { c: Campaign; campaigns: Campaign[]; onSaved: () => void }) {
  const [f, setF] = useState({
    name: c.name, starts_at: toLocal(c.starts_at), ends_at: toLocal(c.ends_at),
    validity_days: String(c.validity_days), max_discount_mt: String(c.max_discount_mt),
    top_prize_percent: String(c.top_prize_percent), top_prize_limit: String(c.top_prize_limit),
  });
  const [prizes, setPrizes] = useState<Prize[]>(c.prizes?.length ? c.prizes : DEFAULT_PRIZES);
  const [busy, setBusy] = useState(false);
  const sum = prizes.reduce((a, p) => a + Number(p.weight || 0), 0);

  const save = async (activeOverride?: boolean) => {
    if (Math.abs(sum - 100) > 0.0001) { toast.error(`A soma das probabilidades deve ser 100% (atual ${sum}%)`); return; }
    setBusy(true);
    const is_active = activeOverride ?? c.is_active;
    if (is_active) {
      const others = campaigns.filter((x) => x.is_active && x.id !== c.id);
      for (const o of others) await supabase.from("roleta_campaigns").update({ is_active: false }).eq("id", o.id);
    }
    const { error } = await supabase.from("roleta_campaigns").update({
      name: f.name.trim() || c.name, starts_at: fromLocal(f.starts_at), ends_at: fromLocal(f.ends_at),
      validity_days: Number(f.validity_days), max_discount_mt: Number(f.max_discount_mt),
      top_prize_percent: Number(f.top_prize_percent), top_prize_limit: Number(f.top_prize_limit),
      prizes: prizes.map((p) => ({ percent: Number(p.percent), weight: Number(p.weight) })) as never, is_active,
    }).eq("id", c.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Campanha guardada"); onSaved();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5 mt-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold/5 px-4 py-3">
        <div>
          <p className="font-medium">{c.is_active ? "Campanha ativa" : "Campanha desativada"}</p>
          <p className="text-xs text-muted-foreground">Ao desativar ninguém novo gira; prémios já ganhos mantêm-se até expirar ou ser usados.</p>
        </div>
        <Switch checked={c.is_active} disabled={busy} onCheckedChange={(v) => save(v)} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Validade do prémio (dias)</Label><Input type="number" min={1} value={f.validity_days} onChange={(e) => setF({ ...f, validity_days: e.target.value })} /></div>
        <div><Label>Início (opcional)</Label><Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
        <div><Label>Fim (opcional)</Label><Input type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></div>
        <div><Label>Desconto máximo (MT)</Label><Input type="number" min={1} step="0.01" value={f.max_discount_mt} onChange={(e) => setF({ ...f, max_discount_mt: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Prémio alto (%)</Label><Input type="number" min={1} max={30} value={f.top_prize_percent} onChange={(e) => setF({ ...f, top_prize_percent: e.target.value })} /></div>
          <div><Label>Máx. vencedores/mês</Label><Input type="number" min={0} value={f.top_prize_limit} onChange={(e) => setF({ ...f, top_prize_limit: e.target.value })} /></div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Prémios e probabilidades</Label>
          <span className={`text-xs font-semibold ${Math.abs(sum - 100) < 0.0001 ? "text-success" : "text-destructive"}`}>Total: {Number(sum.toFixed(4))}%</span>
        </div>
        <div className="space-y-2">
          {prizes.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <div className="flex items-center gap-2"><Input type="number" min={0} max={30} value={p.percent} onChange={(e) => setPrizes(prizes.map((x, j) => j === i ? { ...x, percent: Number(e.target.value) } : x))} /><span className="text-xs text-muted-foreground w-20">{Number(p.percent) === 0 ? "Não ganhou" : "% desconto"}</span></div>
              <div className="flex items-center gap-2"><Input type="number" min={0} step="0.1" value={p.weight} onChange={(e) => setPrizes(prizes.map((x, j) => j === i ? { ...x, weight: Number(e.target.value) } : x))} /><span className="text-xs text-muted-foreground">%</span></div>
              <Button variant="ghost" size="sm" onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}>Remover</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setPrizes([...prizes, { percent: 5, weight: 0 }])}><Plus className="w-4 h-4 mr-1" /> Prémio</Button>
        </div>
      </div>
      <div className="flex justify-end"><Button onClick={() => save()} disabled={busy} className="bg-gold text-ink hover:bg-gold/90">{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Guardar</Button></div>
    </div>
  );
}

type CodeRow = { id: string; code: string; status: string; origin: string; created_at: string; redeemed_at: string | null; owner: string | null; redeemed_by: string | null };

function CodesTab({ campaignId }: { campaignId: string }) {
  const [qty, setQty] = useState("10");
  const [filter, setFilter] = useState<"all" | "AVAILABLE" | "REDEEMED" | "REFERRAL">("all");
  const [busy, setBusy] = useState(false);
  const { data = [], refetch } = useQuery({
    queryKey: ["admin-roleta-codes", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("roleta_admin_codes", { _campaign_id: campaignId });
      if (error) throw error;
      return (data ?? []) as unknown as CodeRow[];
    },
  });
  const rows = useMemo(() => data.filter((r) => filter === "all" || (filter === "REFERRAL" ? r.origin === "REFERRAL" : r.status === filter)), [data, filter]);
  const gen = async (n: number) => {
    if (!(n >= 1 && n <= 1000)) { toast.error("Quantidade entre 1 e 1000"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("roleta_admin_generate_codes", { _campaign_id: campaignId, _qty: n });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${n} código(s) gerado(s)`); refetch();
  };
  const copyAll = () => { navigator.clipboard.writeText(rows.map((r) => r.code).join("\n")); toast.success(`${rows.length} códigos copiados`); };
  const csv = () => {
    const lines = [["codigo", "estado", "origem", "utilizador", "usado_por", "criado", "usado"].join(","),
      ...rows.map((r) => [r.code, r.status, r.origin, r.owner ?? "", r.redeemed_by ?? "", r.created_at, r.redeemed_at ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "codigos-roleta.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 mt-3">
      <div className="flex flex-wrap items-end gap-2">
        {[1, 10, 50, 100].map((n) => <Button key={n} variant="outline" size="sm" disabled={busy} onClick={() => gen(n)}>+{n}</Button>)}
        <Input type="number" min={1} max={1000} value={qty} onChange={(e) => setQty(e.target.value)} className="w-24 h-9" />
        <Button size="sm" disabled={busy} onClick={() => gen(Number(qty))} className="bg-gold text-ink hover:bg-gold/90">Gerar</Button>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={copyAll}><Copy className="w-4 h-4 mr-1" /> Copiar</Button>
          <Button size="sm" variant="outline" onClick={csv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {([["all", "Todos"], ["AVAILABLE", "Disponíveis"], ["REDEEMED", "Utilizados"], ["REFERRAL", "Gerados por utilizadores"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1 rounded-full border ${filter === k ? "border-gold bg-gold/10 text-gold font-medium" : "border-border"}`}>{l}</button>
        ))}
        <span className="ml-auto text-muted-foreground">{rows.length} código(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="py-2">Código</th><th>Estado</th><th>Origem</th><th>Utilizador</th><th>Usado por</th><th>Data de uso</th></tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="py-2 font-mono font-semibold tracking-widest">{r.code}</td>
                <td>{r.status === "AVAILABLE" ? <span className="text-success">Disponível</span> : <span className="text-muted-foreground">Utilizado</span>}</td>
                <td>{r.origin === "ADMIN" ? "Admin" : "Indicação"}</td>
                <td>{r.owner ?? "—"}</td>
                <td>{r.redeemed_by ?? "—"}</td>
                <td>{fmt(r.redeemed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReferralsTab({ campaignId }: { campaignId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["admin-roleta-referrals", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("roleta_admin_referrals", { _campaign_id: campaignId });
      if (error) throw error;
      return (data ?? []) as unknown as { user_id: string; name: string | null; count: number; codes_issued?: number; code: string | null; code_status: string | null }[];
    },
  });
  return (
    <div className="bg-card border border-border rounded-xl p-5 mt-3">
      {data.length === 0 ? <p className="text-sm text-muted-foreground">Sem indicações nesta campanha.</p> : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr><th className="py-2">Utilizador</th><th>Indicações</th><th>Ciclo atual</th><th>Códigos gerados</th><th>Último código</th><th>Estado</th></tr></thead>
          <tbody className="divide-y divide-border">
            {data.map((r) => (
              <tr key={r.user_id}>
                <td className="py-2">{r.name ?? "—"}</td>
                <td>{r.count}</td>
                <td>{Math.min(Math.max(r.count - (r.codes_issued ?? 0) * 5, 0), 5)}/5</td>
                <td>{r.codes_issued ?? 0}</td>
                <td className="font-mono">{r.code ?? "—"}</td>
                <td>{r.code ? (r.code_status === "AVAILABLE" ? "Por usar" : "Utilizado") : "Em progresso"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ResultsTab({ campaignId }: { campaignId: string }) {
  const { data } = useQuery({
    queryKey: ["admin-roleta-stats", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("roleta_admin_stats", { _campaign_id: campaignId });
      if (error) throw error;
      return data as Record<string, unknown> & { distribution: Record<string, number> };
    },
  });
  if (!data) return <div className="mt-3 h-40 rounded-xl bg-secondary animate-pulse" />;
  const cards: [string, unknown][] = [
    ["Elegíveis (códigos gerados)", data.codes_total], ["Códigos disponíveis", data.codes_available], ["Giros", data.spins],
    ["Ganharam", data.won], ["Não ganharam", data.lost], ["Ativos", data.active], ["Reservados", data.reserved],
    ["Utilizados (compras)", data.redeemed], ["Expirados", data.expired],
    ["Desconto concedido", mzn(data.discount_total)], ["Vendas geradas", mzn(data.sales_total)],
    [`Limite ${data.top_percent}% (mês)`, `${data.top_used}/${data.top_limit}`],
  ];
  return (
    <div className="mt-3 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(([l, v]) => <div key={l} className="bg-card border border-border rounded-xl p-4"><p className="text-xl font-semibold">{String(v ?? 0)}</p><p className="text-xs text-muted-foreground">{l}</p></div>)}
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="font-medium mb-2">Distribuição dos resultados</h3>
        <ul className="text-sm space-y-1">
          {Object.entries(data.distribution ?? {}).sort((a, b) => Number(a[0]) - Number(b[0])).map(([p, n]) => (
            <li key={p} className="flex justify-between"><span>{p === "0" ? "Não ganhou" : `${p}%`}</span><span className="font-medium">{n}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
