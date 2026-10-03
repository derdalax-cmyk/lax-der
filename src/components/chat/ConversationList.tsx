import { Loader2, MessageSquare, Store, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivateUrl } from "@/hooks/usePrivateUrl";
import { orderRef, type Conversation } from "@/hooks/useMessaging";

export function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function ChatAvatar({ name, avatar, role }: { name: string; avatar: string | null; role: string }) {
  const src = usePrivateUrl(avatar);
  return (
    <div className="w-11 h-11 rounded-full bg-secondary overflow-hidden grid place-items-center shrink-0">
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : role === "buyer" ? (
        <Store className="w-5 h-5 text-muted-foreground" />
      ) : (
        <UserIcon className="w-5 h-5 text-muted-foreground" />
      )}
    </div>
  );
}

export function ContextBadge({ conversation }: { conversation: Pick<Conversation, "kind" | "order_id"> }) {
  return (
    <span className={cn(
      "text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border shrink-0",
      conversation.kind === "order" ? "text-gold bg-gold/10 border-gold/30" : "text-muted-foreground bg-secondary border-border",
    )}>
      {conversation.kind === "order" ? `Pedido ${orderRef(conversation.order_id)}` : "Geral"}
    </span>
  );
}

type Props = {
  conversations: Conversation[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  emptyText: string;
};

export function ConversationList({ conversations, loading, activeId, onSelect, emptyText }: Props) {
  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (conversations.length === 0) {
    return (
      <div className="py-16 px-6 text-center text-sm text-muted-foreground">
        <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
        {emptyText}
      </div>
    );
  }
  return (
    <>
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border last:border-0 hover:bg-secondary/50 transition-colors",
            c.id === activeId && "bg-secondary",
          )}
        >
          <ChatAvatar name={c.name} avatar={c.avatar} role={c.role} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{c.name}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">{relTime(c.last_message_at)}</span>
            </div>
            <div className="mt-0.5"><ContextBadge conversation={c} /></div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground truncate">{c.last_message || "Nova conversa"}</span>
              {c.unread > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[10px] font-bold flex items-center justify-center shrink-0">
                  {c.unread > 9 ? "9+" : c.unread}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </>
  );
}
