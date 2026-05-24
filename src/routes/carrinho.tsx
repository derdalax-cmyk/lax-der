import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/carrinho")({
  head: () => ({ meta: [{ title: "Carrinho · DERDALAX" }, { name: "description", content: "O seu carrinho." }] }),
  component: () => (
    <div className="max-w-[1400px] mx-auto px-5 py-20 text-center">
      <h1 className="font-display text-4xl mb-3">Carrinho</h1>
      <p className="text-muted-foreground">Vazio. Catálogo em breve.</p>
    </div>
  ),
});
