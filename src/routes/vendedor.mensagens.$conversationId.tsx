import { createFileRoute, Link, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Loader2, Phone } from "lucide-react";
import { useConversations, orderRef } from "@/hooks/useMessaging";
import { ChatAvatar, ContextBadge } from "@/components/chat/ConversationList";
import { ConversationThread } from "@/components/chat/ConversationThread";

export const Route = createFileRoute("/vendedor/mensagens/$conversationId")({
  head: () => ({ meta: [{ title: "Conversa · DERDALAX" }] }),
  component: SellerConversationPage,
});

function SellerConversationPage() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { data = [], isLoading } = useConversations();
  const conversation = data.find((c) => c.id === conversationId && c.role === "seller");

  const back = () => (canGoBack ? router.history.back() : navigate({ to: "/vendedor/mensagens", replace: true }));

  if (isLoading) return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!conversation) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-muted-foreground px-6 text-center">
        <div>
          Conversa não encontrada.{" "}
          <Link to="/vendedor/mensagens" className="text-gold underline">Ver conversas</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={back} className="md:hidden p-1 -ml-1 rounded hover:bg-secondary" aria-label="Voltar às conversas">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <ChatAvatar name={conversation.name} avatar={conversation.avatar} role={conversation.role} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{conversation.name}</p>
            <ContextBadge conversation={conversation} />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {conversation.kind === "order" ? (
              <Link to="/vendedor/pedidos" className="text-gold hover:underline">Ver pedido {orderRef(conversation.order_id)}</Link>
            ) : (
              <span>Cliente</span>
            )}
            {conversation.phone && <a href={`tel:${conversation.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="w-3 h-3" /> {conversation.phone}</a>}
          </div>
        </div>
      </header>
      <ConversationThread conversationId={conversation.id} />
    </>
  );
}
