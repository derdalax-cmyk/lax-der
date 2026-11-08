import brandIcon192 from "@/assets/derdalax-icon-192.png.asset.json";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Loader2, Mail, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMZN } from "@/components/ProductCard";
import { MZ_PROVINCES } from "@/lib/locations";
import {
  CAMPAIGN_LIMITS, campaignRecipientLimit, campaignQueueCount, MAX_CAMPAIGN_PRODUCTS, PROFILE_RECOVERY_DEFAULTS, PUSH_BODY_MAX, PUSH_TITLE_MAX, safeCampaignLink,
  type AudienceFilters, type CampaignType, type Segment,
} from "@/lib/campaigns";
import {
  cancelCampaign, createAndSendCampaign, estimateCampaignAudience, getCampaignDetails, listCampaignSellers,
  listCampaigns, listIncompleteAccounts, searchCampaignProducts, sendCampaignTestToMe, sendProfileReminder,
} from "@/lib/campaigns.functions";

export const Route = createFileRoute("/admin/comunicacao")({
  head: () => ({ meta: [
    { title: "Comunicação · Admin Derdalax" },
    { name: "description", content: "Campanhas de notificações, recuperação de perfis e divulgação de produtos." },
    { property: "og:title", content: "Comunicação · Admin Derdalax" },
    { property: "og:description", content: "Campanhas de notificações, recuperação de perfis e divulgação de produtos." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminComunicacao,
});

type Picked = { id: string; title: string; price: number; image: string | null; store: string; status: string };

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "all", label: "Todos os utilizadores" },
  { value: "incomplete", label: "Contas incompletas" },
  { value: "push", label: "Com Push ativo" },
  { value: "email", label: "Com Email disponível" },
];
const STATUS: Record<string, string> = { draft: "Rascunho", queued: "Na fila", sending: "A enviar", completed: "Concluída", failed: "Falhou", cancelled: "Cancelada" };
const FAIL: Record<string, string> = { ineligible: "Preferências desativadas ou subscrição inválida", delivery_unknown: "Entrega não confirmada; não repetida para evitar duplicação", no_subscription: "Sem subscrição push", push_rejected: "Push rejeitado", push_error: "Erro no envio", max_attempts: "Tentativas esgotadas", cancelled: "Cancelado", email_channel_unavailable: "Email indisponível", campaign_missing: "Campanha removida" };

function useStepUpErrors() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return async (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    if (m.includes("STEP_UP_REQUIRED")) {
      toast.message("Confirme novamente a sua identidade para continuar.");
      await qc.invalidateQueries({ queryKey: ["admin-security-status"] });
      navigate({ to: "/admin/verificar", search: { redirect: "/admin/comunicacao" } });
    } else if (m.includes("EMAIL_CHANNEL_UNAVAILABLE")) toast.error("O canal Email para campanhas ainda não está disponível.");
    else toast.error(m);
  };
}

function AdminComunicacao() {
  const [tab, setTab] = useState("nova");
  const [preset, setPreset] = useState<CampaignType | null>(null);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl">Comunicação</h1>
        <p className="text-sm text-muted-foreground mt-1">Envie mensagens, recupere perfis e divulgue produtos.</p>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="nova">Nova campanha</TabsTrigger>
          <TabsTrigger value="incompletas">Contas incompletas</TabsTrigger>
          <TabsTrigger value="produtos">Produtos/lojas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="nova"><Composer key={preset ?? "x"} initialType={preset ?? "message"} onSent={() => setTab("historico")} /></TabsContent>
        <TabsContent value="incompletas"><Incomplete onCampaign={() => { setPreset("profile_recovery"); setTab("nova"); }} /></TabsContent>
        <TabsContent value="produtos"><Composer key="products" initialType="products" onSent={() => setTab("historico")} /></TabsContent>
        <TabsContent value="historico"><History /></TabsContent>
      </Tabs>
    </div>
  );
}

function Composer({ initialType, onSent }: { initialType: CampaignType; onSent: () => void }) {
  const onErr = useStepUpErrors();
  const qc = useQueryClient();
  const estimateFn = useServerFn(estimateCampaignAudience);
  const testFn = useServerFn(sendCampaignTestToMe);
  const sendFn = useServerFn(createAndSendCampaign);
  const recovery = initialType === "profile_recovery";
  const [type, setType] = useState<CampaignType>(initialType);
  const [name, setName] = useState(recovery ? "Recuperação de perfis" : "");
  const [segment, setSegment] = useState<Segment>(recovery ? "incomplete" : "all");
  const [filters, setFilters] = useState<AudienceFilters>({});
  const [title, setTitle] = useState(recovery ? PROFILE_RECOVERY_DEFAULTS.title : "");
  const [body, setBody] = useState(recovery ? PROFILE_RECOVERY_DEFAULTS.body : "");
  const [ctaLabel, setCtaLabel] = useState(recovery ? PROFILE_RECOVERY_DEFAULTS.cta : "");
  const [ctaUrl, setCtaUrl] = useState(recovery ? PROFILE_RECOVERY_DEFAULTS.url : "/");
  const [products, setProducts] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [recipientLimit, setRecipientLimit] = useState(campaignRecipientLimit());

  const effSegment = type === "profile_recovery" ? "incomplete" : segment;
  const est = useQuery({
    queryKey: ["campaign-estimate", effSegment, filters],
    queryFn: () => estimateFn({ data: { segment: effSegment, filters } }),
    staleTime: 30_000, retry: false,
  });
  useEffect(() => { if (est.error) void onErr(est.error); }, [est.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const payload = () => ({ name: name.trim() || title.trim(), type, channels: ["push" as const], recipientLimit, segment: effSegment, filters, title, body, ctaLabel, ctaUrl, productIds: products.map((p) => p.id) });
  const linkOk = type === "products" || !!safeCampaignLink(ctaUrl);
  const valid = title.trim().length >= 2 && body.trim().length >= 2 && linkOk && (type !== "products" || products.length > 0);

  const test = async () => {
    setBusy(true);
    try {
      const r = await testFn({ data: payload() });
      if (r.push === "sent") toast.success("Teste enviado para os seus dispositivos.");
      else if (r.push === "no_subscription") toast.error("Ative as notificações neste dispositivo para receber o teste.");
      else if (r.push === "ineligible") toast.error("Push: confirme as suas preferências e uma subscrição válida para receber o teste.");
      else toast.error("Não foi possível entregar o teste.");
    } catch (e) { await onErr(e); } finally { setBusy(false); }
  };
  const send = async () => {
    setConfirm(false);
    setBusy(true);
    try {
      const r = await sendFn({ data: payload() });
      toast.success(`Campanha enviada para a fila (${r.queued} destinatários).`);
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
      onSent();
    } catch (e) { await onErr(e); } finally { setBusy(false); }
  };

  const pushCount = est.data?.push ?? 0;
  const queuedCount = campaignQueueCount(pushCount, recipientLimit);
  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-4">
      <div className="space-y-5 bg-card border border-border rounded-xl p-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Nome interno</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Ex: Novidades de Novembro" /></div>
          <div><Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as CampaignType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="message">Mensagem</SelectItem>
                <SelectItem value="profile_recovery">Recuperação de perfil</SelectItem>
                <SelectItem value="products">Produtos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Canais</Label>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked disabled /> <Bell className="w-4 h-4" /> Push</label>
            <label className="flex items-center gap-2 text-muted-foreground"><Checkbox checked={false} disabled /> <Mail className="w-4 h-4" /> Email</label>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Email de campanhas requer um serviço dedicado de email marketing; os emails da plataforma ficam reservados a avisos de conta e pedidos.</p>
        </div>
        <div>
          <Label htmlFor="campaign-limit">Limite desta campanha</Label>
          <Select value={String(recipientLimit)} onValueChange={v => setRecipientLimit(campaignRecipientLimit(Number(v)))}>
            <SelectTrigger id="campaign-limit"><SelectValue /></SelectTrigger>
            <SelectContent>{CAMPAIGN_LIMITS.map(limit => <SelectItem key={limit} value={String(limit)}>{limit} destinatários por canal</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Público</Label>
            <Select value={effSegment} onValueChange={(v) => setSegment(v as Segment)} disabled={type === "profile_recovery"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SEGMENTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Província</Label>
            <Select value={filters.province || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, province: v === "all" ? "" : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{MZ_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Cidade</Label><Input value={filters.city ?? ""} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} placeholder="Ex: Beira" /></div>
          <div><Label>Compras</Label>
            <Select value={filters.purchases || "any"} onValueChange={(v) => setFilters((f) => ({ ...f, purchases: v === "any" ? "" : v as AudienceFilters["purchases"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="any">Indiferente</SelectItem><SelectItem value="buyers">Compradores</SelectItem><SelectItem value="no_purchases">Sem compras</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Tipo de conta</Label>
            <Select value={filters.role || "any"} onValueChange={(v) => setFilters((f) => ({ ...f, role: v === "any" ? "" : v as AudienceFilters["role"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="any">Todos</SelectItem><SelectItem value="sellers">Vendedores</SelectItem><SelectItem value="clients">Clientes</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Conta desde</Label><Input type="date" value={filters.created_from ?? ""} onChange={(e) => setFilters((f) => ({ ...f, created_from: e.target.value }))} /></div>
            <div><Label>Até</Label><Input type="date" value={filters.created_to ?? ""} onChange={(e) => setFilters((f) => ({ ...f, created_to: e.target.value }))} /></div>
          </div>
        </div>

        <div className="space-y-3">
          <div><Label>Título <span className="text-muted-foreground text-xs">({title.length}/{PUSH_TITLE_MAX})</span></Label><Input value={title} maxLength={PUSH_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Mensagem <span className="text-muted-foreground text-xs">({body.length}/{PUSH_BODY_MAX})</span></Label><Textarea value={body} maxLength={PUSH_BODY_MAX} rows={3} onChange={(e) => setBody(e.target.value)} /></div>
          {type !== "products" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label>Texto do botão</Label><Input value={ctaLabel} maxLength={40} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Ex: Ver agora" /></div>
              <div><Label>Link</Label><Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/perfil" />
                {!linkOk && <p className="text-xs text-destructive mt-1">Use um caminho interno (ex: /perfil) ou um link https da Derdalax.</p>}
              </div>
            </div>
          )}
        </div>

        {type === "products" && <ProductPicker value={products} onChange={setProducts} />}

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
          <p className="text-sm flex-1 min-w-[200px]">
            {est.isFetching ? "A calcular público…" : est.data ? <>Elegíveis totais: <b>{est.data.total}</b><br />Push disponíveis: <b>{pushCount}</b> · Email disponíveis: <b>{est.data.email}</b><br />Limite: <b>{recipientLimit}</b> · A enfileirar: <b>{queuedCount} Push</b> / <b>0 Email</b></> : "—"}
          </p>
          <Button variant="outline" disabled={!valid || busy} onClick={test}>Enviar teste para mim</Button>
          <Button disabled={!valid || busy || !pushCount} onClick={() => setConfirm(true)}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}Enviar campanha
          </Button>
        </div>
      </div>

      <aside className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Pré-visualização Push</p>
          <div className="bg-card border border-border rounded-xl p-3 flex gap-3 shadow-sm">
            <img src={brandIcon192.url} alt="" className="w-10 h-10 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{title || "Título"}</p>
              <p className="text-xs text-muted-foreground line-clamp-3">{body || "Mensagem"}</p>
              {type === "products" && products[0]?.image && <img src={products[0].image} alt="" className="mt-2 rounded-md w-full max-h-40 object-cover" />}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Abre: {type === "products" ? (products.length === 1 ? "página do produto" : "página da campanha com os produtos") : (safeCampaignLink(ctaUrl) ?? "—")}
          </p>
        </div>
      </aside>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão enfileiradas até {queuedCount} notificações Push elegíveis, com limite de {recipientLimit} destinatários. Cada utilizador recebe no máximo uma mensagem por canal nesta campanha. Email não será enviado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={send}>Confirmar envio</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductPicker({ value, onChange }: { value: Picked[]; onChange: (v: Picked[]) => void }) {
  const onErr = useStepUpErrors();
  const searchFn = useServerFn(searchCampaignProducts);
  const sellersFn = useServerFn(listCampaignSellers);
  const [q, setQ] = useState("");
  const [seller, setSeller] = useState("all");
  const sellers = useQuery({ queryKey: ["campaign-sellers"], queryFn: () => sellersFn(), staleTime: 300_000 });
  const results = useQuery({
    queryKey: ["campaign-products", q, seller],
    queryFn: () => searchFn({ data: { q, sellerIds: seller === "all" ? [] : [seller] } }),
    staleTime: 30_000, retry: false,
  });
  useEffect(() => { if (results.error) void onErr(results.error); }, [results.error]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(() => new Set(value.map((p) => p.id)), [value]);
  const toggle = (p: Picked) => {
    if (selected.has(p.id)) return onChange(value.filter((x) => x.id !== p.id));
    if (value.length >= MAX_CAMPAIGN_PRODUCTS) return toast.error(`Máximo de ${MAX_CAMPAIGN_PRODUCTS} produtos por campanha.`);
    onChange([...value, p]);
  };
  return (
    <div className="space-y-3">
      <Label>Produtos ({value.length}/{MAX_CAMPAIGN_PRODUCTS})</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 text-xs bg-secondary rounded-full pl-1 pr-2 py-1">
              {p.image && <img src={p.image} alt="" className="w-5 h-5 rounded-full object-cover" />}
              <span className="max-w-[140px] truncate">{p.title}</span>
              <button type="button" aria-label="Remover" onClick={() => toggle(p)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar produtos…" /></div>
        <Select value={seller} onValueChange={setSeller}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="Loja" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as lojas</SelectItem>{(sellers.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[420px] overflow-y-auto">
        {results.isPending && <p className="text-sm text-muted-foreground col-span-full">A carregar…</p>}
        {(results.data ?? []).map((p) => (
          <button type="button" key={p.id} onClick={() => toggle(p)}
            className={`text-left border rounded-lg overflow-hidden bg-card ${selected.has(p.id) ? "border-gold ring-2 ring-gold/40" : "border-border"}`}>
            <div className="aspect-square bg-secondary">{p.image && <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-contain" />}</div>
            <div className="p-2">
              <p className="text-xs font-medium line-clamp-2">{p.title}</p>
              <p className="text-xs text-gold font-semibold">{formatMZN(p.price)}</p>
              <p className="text-[10px] text-muted-foreground truncate">{p.store} · {p.status === "reserved" ? "Reservado" : "Disponível"}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Incomplete({ onCampaign }: { onCampaign: () => void }) {
  const onErr = useStepUpErrors();
  const listFn = useServerFn(listIncompleteAccounts);
  const remindFn = useServerFn(sendProfileReminder);
  const [page, setPage] = useState(0);
  const [sending, setSending] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin-incomplete", page], queryFn: () => listFn({ data: { page } }), retry: false });
  useEffect(() => { if (q.error) void onErr(q.error); }, [q.error]); // eslint-disable-line react-hooks/exhaustive-deps
  const remind = async (id: string) => {
    setSending(id);
    try {
      const r = await remindFn({ data: { userId: id } });
      if (r.push === "sent") toast.success("Lembrete enviado.");
      else if (r.push === "no_subscription") toast.error("Este utilizador não tem notificações ativas.");
      else if (r.push === "opted_out") toast.error("Este utilizador não aceita mensagens promocionais.");
      else toast.error("Não foi possível entregar.");
    } catch (e) { await onErr(e); } finally { setSending(null); }
  };
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (q.data?.pageSize ?? 25)));
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-xl p-4">
        <p><span className="font-display text-2xl">{total}</span> <span className="text-muted-foreground text-sm">contas com dados em falta</span></p>
        <Button onClick={onCampaign} disabled={!total}>Criar campanha limitada</Button>
      </div>
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {q.isPending && <p className="p-4 text-sm text-muted-foreground">A carregar…</p>}
        {(q.data?.rows ?? []).map((r) => (
          <div key={r.id} className="p-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{r.name ?? "Sem nome"} <span className="text-muted-foreground font-normal">· {r.email}</span></p>
              <p className="text-xs text-muted-foreground">Falta: {r.missing.join(", ")} · Conta de {new Date(r.createdAt).toLocaleDateString("pt-PT")}</p>
            </div>
            <Button size="sm" variant="outline" disabled={!r.hasPush || sending === r.id} onClick={() => remind(r.id)} title={r.hasPush ? undefined : "Sem notificações ativas"}>
              {sending === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar lembrete"}
            </Button>
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span>{page + 1} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Seguinte</Button>
        </div>
      )}
    </div>
  );
}

function History() {
  const onErr = useStepUpErrors();
  const qc = useQueryClient();
  const listFn = useServerFn(listCampaigns);
  const detailFn = useServerFn(getCampaignDetails);
  const cancelFn = useServerFn(cancelCampaign);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin-campaigns"], queryFn: () => listFn(), retry: false,
    refetchInterval: (query) => (query.state.data ?? []).some((c) => c.status === "queued" || c.status === "sending") ? 5000 : false,
  });
  useEffect(() => { if (q.error) void onErr(q.error); }, [q.error]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = useQuery({ queryKey: ["admin-campaign", open], queryFn: () => { if (!open) throw new Error("Campanha não selecionada."); return detailFn({ data: { id: open } }); }, enabled: !!open });
  const cancel = async (id: string) => {
    try { await cancelFn({ data: { id } }); toast.success("Campanha cancelada."); qc.invalidateQueries({ queryKey: ["admin-campaigns"] }); qc.invalidateQueries({ queryKey: ["admin-campaign", id] }); }
    catch (e) { await onErr(e); }
  };
  const seg = (s: string) => SEGMENTS.find((x) => x.value === s)?.label ?? s;
  return (
    <div className="mt-4 bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="p-3">Campanha</th><th className="p-3">Criada por</th><th className="p-3">Segmento</th><th className="p-3">Canais</th>
            <th className="p-3">Limite / elegíveis / fila</th><th className="p-3">Push aceites/falhados</th><th className="p-3">Emails</th><th className="p-3">Estado</th><th className="p-3">Data</th><th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {(q.data ?? []).map((c) => (
            <tr key={c.id} className="border-b border-border last:border-0">
              <td className="p-3 font-medium">{c.name}</td>
              <td className="p-3">{c.createdBy}</td>
              <td className="p-3">{seg(c.audience_type)}</td>
              <td className="p-3">{(c.channels as string[]).join(", ")}</td>
              <td className="p-3">{c.recipient_limit} / {c.eligible_total} / {c.queued_push + c.queued_email}</td>
              <td className="p-3">{c.sent_push} / {c.failed_push}</td>
              <td className="p-3">{c.sent_email} / {c.failed_email}</td>
              <td className="p-3">{STATUS[c.status] ?? c.status}</td>
              <td className="p-3 whitespace-nowrap">{new Date(c.created_at).toLocaleString("pt-PT")}</td>
              <td className="p-3"><Button size="sm" variant="outline" onClick={() => setOpen(c.id)}>Ver detalhes</Button></td>
            </tr>
          ))}
          {q.data?.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Ainda não há campanhas.</td></tr>}
        </tbody>
      </table>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{d.data?.campaign.name ?? "Campanha"}</DialogTitle></DialogHeader>
          {d.isPending ? <p className="text-sm text-muted-foreground">A carregar…</p> : d.data && (
            <div className="space-y-4 text-sm">
              <p>Limite: {d.data.campaign.recipient_limit} · Elegíveis: {d.data.campaign.eligible_total} · Enfileirados: {d.data.campaign.queued_push} Push / {d.data.campaign.queued_email} Email · Ignorados: {d.data.byStatus.skipped ?? 0}</p>
              <div className="bg-secondary rounded-lg p-3"><p className="font-semibold">{d.data.campaign.title}</p><p className="text-muted-foreground">{d.data.campaign.body}</p></div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="border border-border rounded-lg p-2"><p className="text-xs text-muted-foreground">Enviados</p><p className="font-display text-xl">{d.data.byStatus.sent ?? 0}</p></div>
                <div className="border border-border rounded-lg p-2"><p className="text-xs text-muted-foreground">Falhados</p><p className="font-display text-xl">{d.data.byStatus.failed ?? 0}</p></div>
                <div className="border border-border rounded-lg p-2"><p className="text-xs text-muted-foreground">Pendentes</p><p className="font-display text-xl">{(d.data.byStatus.pending ?? 0) + (d.data.byStatus.processing ?? 0)}</p></div>
              </div>
              {Object.keys(d.data.failures).length > 0 && (
                <div><p className="font-medium mb-1">Falhas / ignorados por motivo</p>
                  <ul className="text-muted-foreground">{Object.entries(d.data.failures).map(([k, v]) => <li key={k}>{FAIL[k] ?? k}: {v}</li>)}</ul></div>
              )}
              {d.data.products.length > 0 && (
                <div><p className="font-medium mb-1">Produtos ({d.data.products.length})</p>
                  <ul className="text-muted-foreground">{d.data.products.map((p) => p ? <li key={p.id}>{p.title} · <span className="text-gold">{formatMZN(Number(p.base_price))}</span></li> : null)}</ul></div>
              )}
              {(d.data.byStatus.pending ?? 0) > 0 && ["queued", "sending"].includes(d.data.campaign.status) && (
                <Button variant="destructive" onClick={() => { if (d.data) void cancel(d.data.campaign.id); }}>Cancelar envios pendentes</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
