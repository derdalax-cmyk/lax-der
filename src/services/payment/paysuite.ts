import { initPaysuitePayment } from "@/lib/paysuite.functions";
import type { PaymentProvider, InitPaymentInput, InitPaymentResult } from "./types";

// Adaptador Paysuite: encaminha para a server function já existente.
export const paysuiteProvider: PaymentProvider = {
  id: "paysuite",
  label: "Paysuite (e-Mpesa / e-Mola)",
  methods: ["mpesa", "emola"],
  async initPayment(input: InitPaymentInput): Promise<InitPaymentResult> {
    const result = await initPaysuitePayment({ data: input });
    return {
      ok: result.ok,
      alreadyPaid: result.alreadyPaid,
      checkoutUrl: result.checkoutUrl,
      providerId: result.providerId,
    };
  },
};
