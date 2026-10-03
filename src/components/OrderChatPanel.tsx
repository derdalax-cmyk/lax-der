import { useEffect, useState } from "react";
import { getOrCreateOrderConversation } from "@/hooks/useMessaging";
import { ConversationThread } from "@/components/chat/ConversationThread";
import { Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  orderId: string;
  /** Store that is part of this order. Both buyer and store owner resolve the same conversation. */
  sellerId?: string;
  /** Kept for compatibility; resolution is identical for both sides. */
  mode?: "buyer" | "seller";
  title?: string;
  heightClass?: string;
};

/** Compact chat embedded inside an order view — same conversation as the inbox. */
export function OrderChatPanel({ orderId, sellerId, title, heightClass = "h-72" }: Props) {
  const [convId, setConvId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setConvId(null);
    setError(null);
    if (!sellerId) return;
    getOrCreateOrderConversation(orderId, sellerId)
      .then((id) => alive && setConvId(id))
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Não foi possível abrir o chat"));
    return () => { alive = false; };
  }, [orderId, sellerId]);

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card flex flex-col">
      <div className="px-3 py-2 border-b border-border bg-ink text-white flex items-center gap-2 text-xs font-semibold">
        <MessageSquare className="w-3.5 h-3.5 text-gold" /> {title ?? "Chat do pedido"}
      </div>
      {convId ? (
        <ConversationThread conversationId={convId} areaClassName={heightClass} compact />
      ) : (
        <div className={cn("grid place-items-center text-xs text-muted-foreground text-center px-4", heightClass)}>
          {error ?? <Loader2 className="w-4 h-4 animate-spin" />}
        </div>
      )}
    </div>
  );
}
