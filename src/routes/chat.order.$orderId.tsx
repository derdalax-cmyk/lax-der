import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getOrCreateOrderConversation } from "@/hooks/useMessaging";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/order/$orderId")({
  validateSearch: (search: Record<string, unknown>): { seller?: string } => ({
    seller: typeof search.seller === "string" ? search.seller : undefined,
  }),
  head: () => ({ meta: [{ title: "Chat do pedido · DERDALAX" }] }),
  component: OrderChatRedirect,
});

/** Resolves the order+store conversation and opens it. Never sends a message by itself. */
function OrderChatRedirect() {
  const { orderId } = Route.useParams();
  const { seller } = Route.useSearch();
  const { user, loading } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!seller || !user?.id) return;
    getOrCreateOrderConversation(orderId, seller)
      .then(setConversationId)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Não foi possível abrir o chat");
        setFailed(true);
      });
  }, [orderId, seller, user?.id]);

  if (loading) return <div className="min-h-[50vh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (!seller || failed) return <Navigate to="/perfil/pedidos" />;
  if (conversationId) return <Navigate to="/mensagens" search={{ c: conversationId }} replace />;
  return <div className="min-h-[50vh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
}
