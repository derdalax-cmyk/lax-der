import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { startOrderConversation } from "@/hooks/useMessaging";
import { supabase } from "@/integrations/supabase/client";
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

function OrderChatRedirect() {
  const { orderId } = Route.useParams();
  const { seller } = Route.useSearch();
  const { user, loading } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!seller || !user?.id) return;
    startOrderConversation(orderId, seller)
      .then(async (id) => {
        const { data: existing, error: readError } = await supabase.from("messages").select("id").eq("conversation_id", id).limit(1);
        if (readError) throw readError;
        if (!existing?.length) {
          const { error } = await supabase.from("messages").insert({
            conversation_id: id,
            sender_id: user.id,
            body: `Olá! 👋\n\nAcabei de fazer um pedido na sua loja (Pedido #${orderId.slice(0, 8).toUpperCase()}).\nAguardo informações sobre o envio. Obrigado!`,
          });
          if (error) throw error;
        }
        setConversationId(id);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível abrir o chat"));
  }, [orderId, seller, user?.id]);

  if (loading) return <div className="min-h-[50vh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!seller) return <Navigate to="/perfil/pedidos" />;
  if (conversationId) return <Navigate to="/mensagens" search={{ c: conversationId }} />;
  return <div className="min-h-[50vh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
}