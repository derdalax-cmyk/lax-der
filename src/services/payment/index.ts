import type { PaymentProvider } from "./types";
import { paysuiteProvider } from "./paysuite";

export * from "./types";

// Registo de provedores disponíveis. Adicionar novos provedores aqui.
export const paymentProviders: Record<string, PaymentProvider> = {
  [paysuiteProvider.id]: paysuiteProvider,
};

// Provedor ativo por omissão.
export const DEFAULT_PAYMENT_PROVIDER = "paysuite";

export function getPaymentProvider(id: string = DEFAULT_PAYMENT_PROVIDER): PaymentProvider {
  const provider = paymentProviders[id];
  if (!provider) throw new Error(`Provedor de pagamento desconhecido: ${id}`);
  return provider;
}
