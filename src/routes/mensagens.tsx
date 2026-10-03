import { createFileRoute, useNavigate, Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, type Conversation } from "@/hooks/useMessaging";
import { MessageSquare, ChevronLeft, Phone, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationList, ChatAvatar, ContextBadge } from "@/components/chat/ConversationList";
import { ConversationThread } from "@/components/chat/ConversationThread";

export const Route = createFileRoute("/mensagens")({
  validateSearch: (s: Record<string, unknown>): { c?: string } => ({
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  head: () => ({ meta: [{ title: "Mensagens · DERDALAX" }, { name: "description", content: "As suas conversas com lojas na DERDALAX." }] }),
  component: MensagensPage,
});

/** Customer inbox. Store-owner conversations live under /vendedor/mensagens. */
function MensagensPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const search = Route.useSearch();
  const { data: all = [], isLoading } = useConversations();
  const activeId = search.c ?? null;

  const conversations = useMemo(() => all.filter((c) => c.role === "buyer"), [all]);
  const hasStoreChats = all.some((c) => c.role === "seller");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  // Old links (/mensagens?c=...) for a store-owner conversation open the seller inbox.
  useEffect(() => {
    if (!activeId) return;
    const c = all.find((x) => x.id === activeId);
    if (c?.role === "seller") navigate({ to: "/vendedor/mensagens/$conversationId", params: { conversationId: c.id }, replace: true });
  }, [activeId, all, navigate]);

  const open = (id: string) => navigate({ to: "/mensagens", search: { c: id } });
  const back = () => (canGoBack ? router.history.back() : navigate({ to: "/mensagens", search: {}, replace: true }));

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="max-w-[1100px] mx-auto px-3 sm:px-5 py-4 md:py-8">
      <div className="flex items-center justify-between gap-3 mb-4 px-1">
        <h1 className="font-display text-2xl md:text-3xl">Mensagens</h1>
        {hasStoreChats && (
          <Link to="/vendedor/mensagens" className="inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
            <Store className="w-4 h-4" /> Mensagens da minha loja
          </Link>
        )}
      </div>
      <div className="grid md:grid-cols-[340px_1fr] gap-0 md:gap-4 border border-border rounded-2xl overflow-hidden bg-card h-[calc(100vh-220px)] min-h-[440px]">
        <aside className={cn("border-r border-border overflow-y-auto", activeId ? "hidden md:block" : "block")}>
          <ConversationList
            conversations={conversations}
            loading={isLoading}
            activeId={activeId}
            onSelect={open}
            emptyText="Ainda não tem conversas. Contacte uma loja a partir de um produto."
          />
        </aside>
        <section className={cn("min-w-0 flex flex-col", activeId ? "flex" : "hidden md:flex")}>
          {active ? (
            <>
              <BuyerHeader conversation={active} onBack={back} />
              <ConversationThread conversationId={active.id} />
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground px-6 text-center">
              <div>
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                Selecione uma conversa para começar.
              </div>
            </div>
          )}
        </section>
      </div>
      <button type="button" onClick={() => window.history.back()} className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" /> Voltar atrás
      </button>
    </div>
  );
}

function BuyerHeader({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded hover:bg-secondary" aria-label="Voltar às conversas">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <ChatAvatar name={conversation.name} avatar={conversation.avatar} role={conversation.role} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{conversation.name}</p>
          <ContextBadge conversation={conversation} />
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <Link to="/loja/$id" params={{ id: conversation.seller_id }} className="text-gold hover:underline">Ver loja</Link>
          {conversation.phone && <a href={`tel:${conversation.phone}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Phone className="w-3 h-3" /> {conversation.phone}</a>}
        </div>
      </div>
    </header>
  );
}
