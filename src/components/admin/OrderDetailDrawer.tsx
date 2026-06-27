import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, PaymentBadge, ORDER_STATUS, ORDER_STATUS_META, PAYMENT_METHOD_LABEL } from "@/components/admin/StatusBadge";
import { Check, CircleDollarSign, ImageOff, MapPin, Phone, User, Mail, Hash, XCircle, Save, Printer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const money = (n: number) => `${Number(n).toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MT`;

type OrderLike = {
  id: string;
  seq: string;
  user_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  email: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  status: string;
  subtotal: number;
  shipping: number;
  total: number;
  notes?: string | null;
  shipping_address?: Record<string, unknown> | null;
  created_at: string;
  customerOrders: number;
};

const TIMELINE: { key: string; label: string }[] = [
  { key: "pending", label: "Criado" },
  { key: "paid", label: "Pago" },
  { key: "processing", label: "Processando" },
  { key: "sent", label: "Enviado" },
  { key: "delivered", label: "Entregue" },
];

export function OrderDetailDrawer({ order, open, onOpenChange }: {
  order: OrderLike | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-order-items", order?.id],
    enabled: open && !!order,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, quantity, price, product_id, variation_id, products(title, images), product_variations(size, color)")
        .eq("order_id", order!.id);
      if (error) throw error;
      return data;
    },
  });

  if (!order) return null;

  const currentIdx = order.status === "cancelled" ? -1 : TIMELINE.findIndex((t) => t.key === order.status);
  const isPaid = (order.payment_status ?? "pending") === "paid";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("orders").update({ status: status as never }).eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status atualizado para ${ORDER_STATUS_META[status]?.label ?? status}`);
    setNewStatus("");
    refresh();
    onOpenChange(false);
  };

  const markPaid = async () => {
    const { error } = await supabase.from("orders").update({ payment_status: "paid", status: order.status === "pending" ? "paid" : (order.status as never) }).eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento confirmado");
    refresh();
    onOpenChange(false);
  };

  const cancelOrder = async () => {
    const { error } = await supabase.from("orders").update({ status: "cancelled" as never }).eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pedido cancelado");
    refresh();
    onOpenChange(false);
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    const stamp = new Date().toLocaleString("pt-PT");
    const merged = `${order.notes ? order.notes + "\n" : ""}[${stamp}] ${note.trim()}`;
    const { error } = await supabase.from("orders").update({ notes: merged }).eq("id", order.id);
    setSavingNote(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Nota adicionada");
    setNote("");
    refresh();
  };

  const addr = (order.shipping_address ?? {}) as Record<string, string>;
  const addrLine = [addr.street, addr.number, addr.neighborhood, addr.city, addr.reference].filter(Boolean).join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <SheetTitle className="flex items-center justify-between gap-3">
            <span className="font-mono text-base">{order.seq}</span>
            <StatusBadge status={order.status} />
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">{new Date(order.created_at).toLocaleString("pt-PT")}</p>
        </SheetHeader>

        <div className="p-5 space-y-6">
          {/* Timeline */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Progresso</h3>
            {order.status === "cancelled" ? (
              <div className="flex items-center gap-2 text-destructive text-sm"><XCircle className="w-4 h-4" /> Pedido cancelado</div>
            ) : (
              <div className="flex items-center">
                {TIMELINE.map((t, i) => (
                  <div key={t.key} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs border-2",
                        i <= currentIdx ? "bg-gold border-gold text-ink" : "bg-background border-border text-muted-foreground")}>
                        {i <= currentIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </div>
                      <span className="text-[10px] mt-1 text-muted-foreground whitespace-nowrap">{t.label}</span>
                    </div>
                    {i < TIMELINE.length - 1 && <div className={cn("h-0.5 flex-1 mx-1 mb-4", i < currentIdx ? "bg-gold" : "bg-border")} />}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Customer */}
          <section className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Cliente</h3>
            <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-muted-foreground" /> {order.customer_name ?? "—"}</div>
            {order.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /> {order.email}</div>}
            <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {order.customer_phone ?? "—"}</div>
            {addrLine && <div className="flex items-start gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground mt-0.5" /> {addrLine}</div>}
            <div className="text-xs text-muted-foreground pt-1">{order.customerOrders} pedido(s) no total</div>
          </section>

          {/* Items */}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Itens</h3>
            <div className="space-y-2">
              {isLoading && <div className="text-sm text-muted-foreground">A carregar itens…</div>}
              {items?.map((it) => {
                const prod = it.products as { title?: string; images?: unknown } | null;
                const variation = it.product_variations as { size?: string | null; color?: string | null } | null;
                const imgs = Array.isArray(prod?.images) ? (prod?.images as string[]) : [];
                const variant = [variation?.size, variation?.color].filter(Boolean).join(" / ");
                return (
                  <div key={it.id} className="flex items-center gap-3 bg-card border border-border rounded-lg p-2">
                    <div className="w-12 h-12 rounded-md bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                      {imgs[0] ? <img src={imgs[0]} alt="" className="w-full h-full object-cover" /> : <ImageOff className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{prod?.title ?? "Produto removido"}</div>
                      {variant && <div className="text-xs text-muted-foreground">{variant}</div>}
                      <div className="text-xs text-muted-foreground">{it.quantity} × {money(Number(it.price))}</div>
                    </div>
                    <div className="text-sm font-semibold">{money(Number(it.price) * it.quantity)}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 space-y-1 text-sm border-t border-border pt-3">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Frete</span><span>{money(order.shipping)}</span></div>
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{money(order.total)}</span></div>
            </div>
          </section>

          {/* Payment */}
          <section className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Pagamento</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Método</span>
              <span>{PAYMENT_METHOD_LABEL[order.payment_method ?? ""] ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estado</span>
              <PaymentBadge status={order.payment_status} />
            </div>
            {order.payment_reference && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Referência</span>
                <span className="font-mono text-xs flex items-center gap-1"><Hash className="w-3 h-3" />{order.payment_reference}</span>
              </div>
            )}
            {!isPaid && order.status !== "cancelled" && (
              <Button onClick={markPaid} className="w-full mt-2 bg-success text-white hover:bg-success/90">
                <CircleDollarSign className="w-4 h-4 mr-1" /> Confirmar pagamento
              </Button>
            )}
          </section>

          {/* Actions */}
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Ações</h3>
            <div className="flex gap-2">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Atualizar status…" /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_META[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button disabled={!newStatus || newStatus === order.status} onClick={() => updateStatus(newStatus)}>Aplicar</Button>
            </div>

            <div>
              {order.notes && (
                <div className="bg-secondary/50 rounded-lg p-3 text-xs whitespace-pre-wrap mb-2 max-h-32 overflow-y-auto">{order.notes}</div>
              )}
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicionar nota interna…" rows={2} />
              <Button variant="outline" size="sm" className="mt-2" onClick={saveNote} disabled={savingNote || !note.trim()}>
                <Save className="w-4 h-4 mr-1" /> Guardar nota
              </Button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-1" /> Imprimir
              </Button>
              {order.status !== "cancelled" && (
                <Button variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={cancelOrder}>
                  <XCircle className="w-4 h-4 mr-1" /> Cancelar pedido
                </Button>
              )}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
