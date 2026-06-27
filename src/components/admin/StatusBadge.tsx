import { cn } from "@/lib/utils";

export const ORDER_STATUS = ["pending", "paid", "processing", "sent", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const ORDER_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-gold/20 text-ink border-gold/40" },
  paid: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
  processing: { label: "Processando", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  sent: { label: "Enviado", cls: "bg-purple-500/15 text-purple-600 border-purple-500/30" },
  delivered: { label: "Entregue", cls: "bg-emerald-600/15 text-emerald-700 border-emerald-600/30" },
  cancelled: { label: "Cancelado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export const PAYMENT_STATUS_META: Record<string, { label: string; cls: string }> = {
  paid: { label: "Pago", cls: "bg-success/15 text-success border-success/30" },
  pending: { label: "Não pago", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  failed: { label: "Falhou", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  "e-mpesa": "M-Pesa",
  "e-mola": "E-Mola",
};

export function StatusBadge({ status }: { status: string }) {
  const meta = ORDER_STATUS_META[status] ?? { label: status, cls: "bg-secondary text-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", meta.cls)}>
      {meta.label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string | null | undefined }) {
  const key = status ?? "pending";
  const meta = PAYMENT_STATUS_META[key] ?? { label: key, cls: "bg-secondary text-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", meta.cls)}>
      {meta.label}
    </span>
  );
}
