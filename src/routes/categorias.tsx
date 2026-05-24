import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/categorias")({
  head: () => ({ meta: [{ title: "Categorias · DERDALAX" }, { name: "description", content: "Categorias DERDALAX." }] }),
  component: () => (
    <div className="max-w-[1400px] mx-auto px-5 py-20 text-center">
      <h1 className="font-display text-4xl mb-3">Categorias</h1>
      <p className="text-muted-foreground">Em breve.</p>
    </div>
  ),
});
