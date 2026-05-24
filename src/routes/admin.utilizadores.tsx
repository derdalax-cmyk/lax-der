import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/utilizadores")({
  component: () => (
    <div>
      <h1 className="font-display text-3xl mb-2">Utilizadores</h1>
      <p className="text-muted-foreground">Em breve — lista de clientes.</p>
    </div>
  ),
});
