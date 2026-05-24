import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/pedidos")({
  component: () => (
    <div>
      <h1 className="font-display text-3xl mb-2">Pedidos</h1>
      <p className="text-muted-foreground">Em breve — gestão de pedidos.</p>
    </div>
  ),
});
