// Tipos comuns da camada de pagamento.
// Esta abstração permite trocar/adicionar provedores (Paysuite, e-Mpesa direto, etc.)
// sem alterar o código do checkout.

export type PaymentMethod = "mpesa" | "emola";

export type InitPaymentInput = {
  orderId: string;
  method: PaymentMethod;
  /** Número de telemóvel do pagador (com ou sem indicativo). */
  msisdn: string;
  /** URL para onde o utilizador volta após o pagamento. */
  returnUrl: string;
};

export type InitPaymentResult = {
  ok: boolean;
  alreadyPaid: boolean;
  /** URL de checkout do provedor, quando aplicável. */
  checkoutUrl: string | null;
  /** Identificador da transação no provedor. */
  providerId: string | null;
};

export interface PaymentProvider {
  /** Identificador único do provedor. */
  readonly id: string;
  /** Nome legível do provedor. */
  readonly label: string;
  /** Métodos de pagamento suportados. */
  readonly methods: PaymentMethod[];
  /** Inicia um pagamento para um pedido. */
  initPayment(input: InitPaymentInput): Promise<InitPaymentResult>;
}
