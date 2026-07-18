import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOrderConversation, type Message } from "@/hooks/useMessaging";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  orderId: string;
  /** For buyer mode: the seller store id. Ignored in seller mode. */
  sellerId?: string;
  /** "buyer" starts/reuses the conversation via RPC; "seller" looks up an existing one. */
  mode?: "buyer" | "seller";
  title?: string;
  heightClass?: string;
};

/** Compact chat surface embedded inside an order detail view. */
export function OrderChatPanel({ orderId, sellerId, mode = "buyer", title, heightClass = "h-72" }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [convId, setConvId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    setStarting(true);
    setNotReady(false);
    const load = async () => {
      try {
        if (mode === "seller") {
          if (!user?.id) return;
          const { data, error } = await supabase
            .from("conversations")
            .select("id")
            .eq("order_id", orderId)
            .eq("seller_user_id", user.id)
            .maybeSingle();
          if (error) throw error;
          if (!alive) return;
          if (data?.id) setConvId(data.id);
          else setNotReady(true);
        } else {
          if (!sellerId) return;
          const id = await startOrderConversation(orderId, sellerId);
          if (alive) setConvId(id);
        }
      } catch (err) {
        if (alive) toast.error(err instanceof Error ? err.message : "Não foi possível abrir o chat");
      } finally {
        if (alive) setStarting(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [orderId, sellerId, mode, user?.id]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", convId],
    enabled: !!convId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages").select("*")
        .eq("conversation_id", convId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!convId || !user?.id) return;
    supabase.rpc("mark_conversation_read", { _conversation_id: convId });
    const channel = supabase
      .channel(`order-chat-${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` }, (payload) => {
        qc.setQueryData<Message[]>(["messages", convId], (prev = []) =>
          prev.some((m) => m.id === (payload.new as Message).id) ? prev : [...prev, payload.new as Message],
        );
        if ((payload.new as Message).sender_id !== user.id) {
          supabase.rpc("mark_conversation_read", { _conversation_id: convId });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [convId, user?.id, qc]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !convId || !user?.id || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase.from("messages").insert({ conversation_id: convId, sender_id: user.id, body });
    setSending(false);
    if (error) { toast.error("Não foi possível enviar."); setText(body); }
  };

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card flex flex-col">
      <div className="px-3 py-2 border-b border-border bg-ink text-white flex items-center gap-2 text-xs font-semibold">
        <MessageSquare className="w-3.5 h-3.5 text-gold" /> {title ?? "Chat com o outro lado"}
      </div>
      <div className={cn("flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-[linear-gradient(180deg,#f7f4ee_0%,#efe9de_100%)]", heightClass)}>
        {starting || isLoading ? (
          <div className="h-full grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : notReady ? (
          <div className="h-full grid place-items-center text-xs text-muted-foreground text-center px-4">
            O cliente ainda não iniciou o chat deste pedido.
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full grid place-items-center text-xs text-muted-foreground text-center px-4">Sem mensagens. Escreva a primeira!</div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                  mine ? "bg-[#dcf8c6] text-ink rounded-br-sm" : "bg-white text-ink border border-black/5 rounded-bl-sm",
                )}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <span className="block text-[10px] mt-0.5 text-black/50 text-right">
                    {new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border p-2 flex items-end gap-2 bg-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Escreva uma mensagem..."
          className="flex-1 resize-none max-h-24 rounded-2xl border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending || !convId}
          className="w-9 h-9 shrink-0 rounded-full bg-ink text-gold grid place-items-center hover:bg-ink/90 disabled:opacity-40"
          aria-label="Enviar"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

