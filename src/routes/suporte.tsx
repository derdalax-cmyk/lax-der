import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/suporte")({
  head: () => ({ meta: [{ title: "Suporte · DERDALAX" }, { name: "description", content: "Contacte o suporte DERDALAX." }] }),
  component: () => (
    <div className="max-w-[1400px] mx-auto px-5 py-20 text-center">
      <h1 className="font-display text-4xl mb-3">Suporte</h1>
      <p className="text-muted-foreground">WhatsApp: +258 84 000 0000</p>
    </div>
  ),
});
