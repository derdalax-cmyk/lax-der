import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";

export const Route = createFileRoute("/vendedor/mensalidade")({
  head: () => ({ meta: [{ title: "Mensalidade · DERDALAX" }] }),
  component: MensalidadePage,
});

function MensalidadePage() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gold/15 text-gold grid place-items-center mx-auto mb-6">
          <CalendarClock className="w-10 h-10" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl mb-3">Mensalidade da loja</h1>
        <p className="text-sm text-muted-foreground">Em breve.</p>
      </div>
    </div>
  );
}
