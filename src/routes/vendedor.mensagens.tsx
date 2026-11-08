import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useConversations } from "@/hooks/useMessaging";
import { ConversationList } from "@/components/chat/ConversationList";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vendedor/mensagens")({
  head: () => ({ meta: [{ title: "Mensagens da loja · Derdalax" }, { name: "description", content: "Conversas da sua loja com clientes na Derdalax." }] }),
  component: SellerMessagesLayout,
});

/** Store-owner inbox: list → conversation. Mobile shows one pane at a time. */
function SellerMessagesLayout() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { conversationId?: string };
  const activeId = params.conversationId ?? null;
  const { data: all = [], isLoading } = useConversations();
  const conversations = useMemo(() => all.filter((c) => c.role === "seller"), [all]);

  return (
    <div>
      <h1 className="font-display text-2xl md:text-3xl mb-4">Mensagens</h1>
      <div className="grid md:grid-cols-[320px_1fr] border border-border rounded-2xl overflow-hidden bg-card h-[calc(100vh-200px)] min-h-[440px]">
        <aside className={cn("border-r border-border overflow-y-auto", activeId ? "hidden md:block" : "block")}>
          <ConversationList
            conversations={conversations}
            loading={isLoading}
            activeId={activeId}
            onSelect={(id) => navigate({ to: "/vendedor/mensagens/$conversationId", params: { conversationId: id } })}
            emptyText="Ainda não tem conversas com clientes."
          />
        </aside>
        <section className={cn("min-w-0 flex-col", activeId ? "flex" : "hidden md:flex")}>
          <Outlet />
        </section>
      </div>
    </div>
  );
}
