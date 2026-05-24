import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout · DERDALAX" }] }),
  component: () => (
    <div className="max-w-2xl mx-auto px-5 py-20 text-center">
      <h1 className="font-display text-4xl mb-3">Checkout</h1>
      <p className="text-muted-foreground mb-6">Em construção. Em breve poderá finalizar o pedido.</p>
      <Link to="/carrinho" className="text-gold underline">Voltar ao carrinho</Link>
    </div>
  ),
});
