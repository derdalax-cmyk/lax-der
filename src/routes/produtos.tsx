import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/produtos")({
  head: () => ({ meta: [{ title: "Produtos · DERDALAX" }, { name: "description", content: "Explore a coleção DERDALAX." }] }),
  component: () => (
    <div className="max-w-[1400px] mx-auto px-5 py-20 text-center">
      <h1 className="font-display text-4xl mb-3">Produtos</h1>
      <p className="text-muted-foreground">Catálogo em construção — em breve.</p>
    </div>
  ),
});
