import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MZ_CITIES } from "@/lib/locations";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, Store, Clock, CheckCircle2, XCircle, Check, X, Eye, Inbox,
  Phone, Mail, MapPin, Calendar, Loader2, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Seller = Tables<"sellers">;

export const Route = createFileRoute("/admin/vendedores")({
  head: () => ({ meta: [{ title: "Vendedores · Admin DERDALAX" }] }),
  component: AdminVendedores,
});

const SELLER_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-gold/20 text-ink border-gold/40" },
  approved: { label: "Aprovado", cls: "bg-success/15 text-success border-success/30" },
  rejected: { label: "Rejeitado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

function StatusPill({ status }: { status: string }) {
  const meta = SELLER_STATUS_META[status] ?? { label: status, cls: "bg-secondary text-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", meta.cls)}>
      {meta.label}
    </span>
  );
}

function AdminVendedores() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [province, setProvince] = useState("all");
  const [detail, setDetail] = useState<Seller | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Seller | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Seller[];
    },
  });

  const sellers = data ?? [];

  const provinces = useMemo(() => {
    const set = new Set<string>();
    sellers.forEach((s) => { if (s.province) set.add(s.province); });
    return [...set].sort();
  }, [sellers]);

  const stats = useMemo(() => ({
    total: sellers.length,
    pending: sellers.filter((s) => s.status === "pending").length,
    approved: sellers.filter((s) => s.status === "approved").length,
    rejected: sellers.filter((s) => s.status === "rejected").length,
  }), [sellers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sellers.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (province !== "all" && s.province !== province) return false;
      if (q) {
        const hay = `${s.full_name} ${s.email ?? ""} ${s.store_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sellers, search, status, province]);

  const setSellerStatus = async (s: Seller, next: "approved" | "rejected", notes?: string) => {
    setBusyId(s.id);
    const patch: Partial<Seller> = {
      status: next,
      approved_at: next === "approved" ? new Date().toISOString() : null,
      ...(notes !== undefined ? { admin_notes: notes } : {}),
    };
    const { error } = await supabase.from("sellers").update(patch).eq("id", s.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "approved" ? `${s.store_name} aprovada` : `${s.store_name} rejeitada`);
    qc.invalidateQueries({ queryKey: ["admin-sellers"] });
    setDetail(null);
    setRejectTarget(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Vendedores</h1>
          <p className="text-sm text-muted-foreground">Aprove ou rejeite as lojas que se cadastram na DERDALAX.</p>
        </div>
        <Link to="/admin/vendedores/dashboard">
          <Button variant="outline" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Ver dashboard</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total" value={stats.total} icon={Store} />
        <StatCard label="Pendentes" value={stats.pending} icon={Clock} accent />
        <StatCard label="Aprovados" value={stats.approved} icon={CheckCircle2} />
        <StatCard label="Rejeitados" value={stats.rejected} icon={XCircle} accent />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar nome, email ou loja…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={province} onValueChange={setProvince}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Província" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas províncias</SelectItem>
            {provinces.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Loja</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Província</th>
                <th className="px-4 py-3">Cadastro</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">A carregar…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center">
                  <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <div className="text-muted-foreground">Nenhum vendedor encontrado.</div>
                </td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                        {s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Store className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="font-medium truncate max-w-[180px]">{s.store_name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="truncate max-w-[160px]">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[160px]">{s.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.province}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(s.created_at).toLocaleDateString("pt-PT")}</td>
                  <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetail(s)} aria-label="Ver detalhes">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {s.status !== "approved" && (
                        <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-600/90" disabled={busyId === s.id} onClick={() => setSellerStatus(s, "approved")}>
                          {busyId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Aprovar</>}
                        </Button>
                      )}
                      {s.status !== "rejected" && (
                        <Button variant="outline" size="sm" className="h-8 text-destructive border-destructive/40 hover:bg-destructive/10" disabled={busyId === s.id} onClick={() => setRejectTarget(s)}>
                          <X className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                    {detail.logo_url ? <img src={detail.logo_url} alt="" className="w-full h-full object-cover" /> : <Store className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <span>{detail.store_name}</span>
                  <StatusPill status={detail.status} />
                </DialogTitle>
                <DialogDescription>Detalhes do cadastro de vendedor.</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <DetailRow icon={Store} label="Responsável" value={detail.full_name} />
                <DetailRow icon={Mail} label="Email" value={detail.email ?? "—"} />
                <DetailRow icon={Phone} label="Telefone / WhatsApp" value={detail.phone} />
                <DetailRow icon={MapPin} label="Localização" value={`${detail.province}${detail.city ? " · " + detail.city : ""}`} />
                <CityEditor seller={detail} onSaved={(city) => { setDetail({ ...detail, city }); qc.invalidateQueries({ queryKey: ["admin-sellers"] }); }} />
                <DetailRow icon={Calendar} label="Cadastro" value={new Date(detail.created_at).toLocaleString("pt-PT")} />
                {detail.description && (
                  <div className="bg-secondary/40 rounded-xl px-4 py-3">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Descrição</div>
                    <p className="text-sm">{detail.description}</p>
                  </div>
                )}
                {detail.admin_notes && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
                    <div className="text-[11px] uppercase tracking-wider text-destructive mb-1">Notas do admin</div>
                    <p className="text-sm">{detail.admin_notes}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {detail.status !== "approved" && (
                  <Button className="flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90" disabled={busyId === detail.id} onClick={() => setSellerStatus(detail, "approved")}>
                    <Check className="w-4 h-4 mr-1" /> Aprovar loja
                  </Button>
                )}
                {detail.status !== "rejected" && (
                  <Button variant="outline" className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10" onClick={() => setRejectTarget(detail)}>
                    <X className="w-4 h-4 mr-1" /> Rejeitar
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject confirm */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar {rejectTarget?.store_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O vendedor será notificado de que o cadastro não foi aprovado. Pode voltar a aprovar mais tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => rejectTarget && setSellerStatus(rejectTarget, "rejected")}
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

function CityEditor({ seller, onSaved }: { seller: Seller; onSaved: (city: string) => void }) {
  const [city, setCity] = useState(seller.city ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = (seller.city ?? "") !== city.trim();

  const save = async () => {
    setSaving(true);
    const value = city.trim() || null;
    const { error } = await supabase.from("sellers").update({ city: value }).eq("id", seller.id);
    setSaving(false);
    if (error) { toast.error("Erro ao definir cidade"); return; }
    toast.success("Cidade atualizada");
    onSaved(value ?? "");
  };

  return (
    <div className="flex items-start gap-3">
      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Cidade de venda (só admin)</div>
        <div className="flex gap-2">
          <Select value={city || undefined} onValueChange={setCity}>
            <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Selecionar cidade" /></SelectTrigger>
            <SelectContent>
              {MZ_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={save} disabled={!dirty || saving} className="shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
          </Button>
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
        <Icon className={cn("w-4 h-4", accent ? "text-gold" : "text-gold")} />
      </div>
      <div className="font-display text-2xl leading-tight">{value}</div>
    </div>
  );
}
