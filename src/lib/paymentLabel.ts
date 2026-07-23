export function paymentLabel(method: string | null | undefined, status: string | null | undefined): string {
  if (method === "entrega") {
    return status === "paid" ? "Pago na entrega" : "A pagar na entrega";
  }
  const methodLabel = method === "e-mola" ? "e-Mola" : method === "e-mpesa" ? "e-Mpesa" : method ?? "—";
  const statusLabel = status === "paid" ? "pago" : status === "failed" ? "falhou" : "aguardando pagamento";
  return `${methodLabel} · ${statusLabel}`;
}

export function isPayOnDelivery(method: string | null | undefined): boolean {
  return method === "entrega";
}
