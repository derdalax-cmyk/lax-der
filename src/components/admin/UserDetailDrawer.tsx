import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Save, MapPin, Star, Ban, ShieldCheck, Crown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const money = (n: number) => `${Number(n).toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MT`;

export type UserLike = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  created_at: string;
  ordersCount: number;
  totalSpent: number;
  complete: boolean;
};

export function UserDetailDrawer({ user, open, onOpenChange }: {
  user: UserLike | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", city: "", document: "" });
  const [note, setNote] = useState("");

  const { data: detail } = useQuery({
    queryKey: ["admin-user-detail", user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      const [{ data: profile }, { data: orders }, { data: addresses }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).single(),
        supabase.from("orders").select("id, total, status, payment_status, created_at").eq("user_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("addresses").select("*").eq("user_id", user!.id),
      ]);
      // most bought product
      const orderIds = (orders ?? []).map((o) => o.id);
      let topProduct: string | null = null;
      if (orderIds.length) {
        const { data: items } = await supabase
          .from("order_items")
          .select("quantity, products(title)")
          .in("order_id", orderIds);
        const tally = new Map<string, number>();
        (items ?? []).forEach((it) => {
          const title = (it.products as { title?: string } | null)?.title;
          if (title) tally.set(title, (tally.get(title) ?? 0) + (it.quantity ?? 1));
        });
        topProduct = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }
      return { profile, orders: orders ?? [], addresses: addresses ?? [], topProduct };
    },
  });

  useEffect(() => {
    if (detail?.profile) {
      setForm({
        name: detail.profile.name ?? "",
        phone: detail.profile.phone ?? "",
        city: detail.profile.city ?? "",
        document: detail.profile.document ?? "",
      });
    }
    setEditing(false);
    setNote("");
  }, [detail?.profile]);

  if (!user) return null;
  const p = detail?.profile;
  const orders = detail?.orders ?? [];
  const paidOrders = orders.filter((o) => o.payment_status === "paid" || o.status === "paid" || o.status === "delivered");
  const spent = paidOrders.reduce((s, o) => s + Number(o.total), 0);
  const avg = paidOrders.length ? spent / paidOrders.length : 0;
  const dates = orders.map((o) => +new Date(o.created_at)).sort((a, b) => a - b);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Perfil atualizado");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["admin-user-detail", user.id] });
    refresh();
  };

  const toggleFlag = async (field: "is_vip" | "blocked", value: boolean) => {
    const payload = field === "is_vip" ? { is_vip: value } : { blocked: value };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);

    if (error) { toast.error(error.message); return; }
    toast.success(field === "is_vip" ? (value ? "Marcado como VIP" : "VIP removido") : (value ? "Utilizador bloqueado" : "Utilizador desbloqueado"));
    qc.invalidateQueries({ queryKey: ["admin-user-detail", user.id] });
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    const stamp = new Date().toLocaleString("pt-PT");
    const merged = `${p?.admin_notes ? p.admin_notes + "\n" : ""}[${stamp}] ${note.trim()}`;
    const { error } = await supabase.from("profiles").update({ admin_notes: merged }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Nota adicionada");
    setNote("");
    qc.invalidateQueries({ queryKey: ["admin-user-detail", user.id] });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <SheetTitle className="flex items-center gap-2">
            {user.name || "Utilizador"}
            {p?.is_vip && <Crown className="w-4 h-4 text-gold" />}
            {p?.blocked && <span className="text-xs bg-destructive/15 text-destructive px-2 py-0.5 rounded">Bloqueado</span>}
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">Registado em {new Date(user.created_at).toLocaleDateString("pt-PT")}</p>
        </SheetHeader>

        <div className="p-5 space-y-6">
          {/* Personal data */}
          <section className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Dados pessoais</h3>
              {!editing && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</Button>}
            </div>
            {editing ? (
              <div className="space-y-3">
                <div><Label className="text-xs">Nome</Label><Input type="text" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label className="text-xs">Telefone</Label><Input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label className="text-xs">Cidade</Label><Input type="text" autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label className="text-xs">Documento (NR)</Label><Input type="text" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveProfile}><Save className="w-4 h-4 mr-1" /> Guardar</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                <Row label="Email" value={user.email ?? "—"} />
                <Row label="Telefone" value={p?.phone ?? "—"} />
                <Row label="Cidade" value={p?.city ?? "—"} />
                <Row label="Documento (NR)" value={p?.document ?? "—"} />
                <Row label="Perfil" value={user.complete ? "Completo" : "Incompleto"} />
              </div>
            )}
          </section>

          {/* Stats */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Estatísticas</h3>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Total de pedidos" value={String(orders.length)} />
              <Stat label="Total gasto" value={money(spent)} />
              <Stat label="Ticket médio" value={money(avg)} />
              <Stat label="Produto mais comprado" value={detail?.topProduct ?? "—"} />
              <Stat label="Primeira compra" value={dates.length ? new Date(dates[0]).toLocaleDateString("pt-PT") : "—"} />
              <Stat label="Última compra" value={dates.length ? new Date(dates[dates.length - 1]).toLocaleDateString("pt-PT") : "—"} />
            </div>
          </section>

          {/* Order history */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Histórico de pedidos</h3>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem pedidos.</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-PT")}</span>
                    <span className="font-medium">{money(Number(o.total))}</span>
                    <StatusBadge status={o.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Addresses */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Endereços</h3>
            {(detail?.addresses.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum endereço guardado.</p>
            ) : (
              <div className="space-y-2">
                {detail?.addresses.map((a) => (
                  <div key={a.id} className={cn("bg-card border rounded-lg p-3 text-sm flex items-start gap-2", a.is_default ? "border-gold" : "border-border")}>
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <div>{[a.street, a.number, a.neighborhood, a.city].filter(Boolean).join(", ")}</div>
                      {a.reference && <div className="text-xs text-muted-foreground">{a.reference}</div>}
                      {a.is_default && <span className="text-[10px] text-gold">Padrão</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Internal notes */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Notas internas</h3>
            {p?.admin_notes && <div className="bg-secondary/50 rounded-lg p-3 text-xs whitespace-pre-wrap mb-2 max-h-32 overflow-y-auto">{p.admin_notes}</div>}
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicionar nota…" rows={2} />
            <Button variant="outline" size="sm" className="mt-2" onClick={saveNote} disabled={!note.trim()}><Save className="w-4 h-4 mr-1" /> Guardar nota</Button>
          </section>

          {/* Actions */}
          <section className="flex flex-wrap gap-2 border-t border-border pt-4">
            {p?.is_vip ? (
              <Button variant="outline" size="sm" onClick={() => toggleFlag("is_vip", false)}><Star className="w-4 h-4 mr-1" /> Remover VIP</Button>
            ) : (
              <Button variant="outline" size="sm" className="text-gold" onClick={() => toggleFlag("is_vip", true)}><Star className="w-4 h-4 mr-1" /> Marcar VIP</Button>
            )}
            {p?.blocked ? (
              <Button variant="outline" size="sm" onClick={() => toggleFlag("blocked", false)}><ShieldCheck className="w-4 h-4 mr-1" /> Desbloquear</Button>
            ) : (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => toggleFlag("blocked", true)}><Ban className="w-4 h-4 mr-1" /> Bloquear</Button>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-right">{value}</span></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium mt-0.5 truncate">{value}</div>
    </div>
  );
}
