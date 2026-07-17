import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { startOrderConversation } from "@/hooks/useMessaging";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/order/$orderId")({
  validateSearch: (search: Record<string, unknown>): { seller?: string } => ({
    seller: typeof search.seller === "string" ? search.seller : undefined,
  }),
  head: () => ({ meta: [{ title: "Chat do pedido · DERDALAX" }] }),
  component: OrderChatRedirect,
});

function OrderChatRedirect() {
  const { orderId } = Route.useParams();
  const { seller } = Route.useSearch();
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!seller) return;
    startOrderConversation(orderId, seller)
      .then(setConversationId)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível abrir o chat"));
  }, [orderId, seller]);

  if (!seller) return <Navigate to="/perfil/pedidos" />;
  if (conversationId) return <Navigate to="/mensagens" search={{ c: conversationId }} />;
  return <div className="min-h-[50vh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
}