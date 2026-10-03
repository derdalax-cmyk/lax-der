import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/vendedor/mensagens/")({
  component: () => (
    <div className="flex-1 grid place-items-center text-sm text-muted-foreground px-6 text-center">
      <div>
        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
        Selecione uma conversa para começar.
      </div>
    </div>
  ),
});
