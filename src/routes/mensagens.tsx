import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations, type Conversation, type Message } from "@/hooks/useMessaging";
import { Store, Send, Loader2, MessageSquare, ChevronLeft, User as UserIcon, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/mensagens")({
  validateSearch: (s: Record<string, unknown>): { c?: string } => ({
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  head: () => ({ meta: [{ title: "Mensagens · DERDALAX" }, { name: "description", content: "As suas conversas com lojas e clientes na DERDALAX." }] }),
  component: MensagensPage,
});

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

function MensagensPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { data: conversations = [], isLoading } = useConversations();
  const activeId = search.c ?? null;

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  const setActive = (id: string | null) =>
    navigate({ to: "/mensagens", search: id ? { c: id } : {}, replace: true });

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="max-w-[1100px] mx-auto px-3 sm:px-5 py-4 md:py-8">
      <h1 className="font-display text-2xl md:text-3xl mb-4 px-1">Mensagens</h1>
      <div className="grid md:grid-cols-[340px_1fr] gap-0 md:gap-4 border border-border rounded-2xl overflow-hidden bg-card h-[calc(100vh-220px)] min-h-[440px]">
        {/* List */}
        <aside className={cn("border-r border-border overflow-y-auto", activeId ? "hidden md:block" : "block")}>
          {isLoading ? (
            <div className="py-16 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : conversations.length === 0 ? (
            <div className="py-16 px-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
              Ainda não tem conversas. Contacte uma loja a partir de um produto.
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border last:border-0 hover:bg-secondary/50 transition-colors",
                  c.id === activeId && "bg-secondary",
                )}
              >
                <Avatar name={c.name} avatar={c.avatar} role={c.role} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{relTime(c.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground truncate">{c.last_message ?? "Nova conversa"}</span>
                    {c.unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[10px] font-bold flex items-center justify-center shrink-0">
                        {c.unread > 9 ? "9+" : c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </aside>

        {/* Thread */}
        <section className={cn("min-w-0 flex flex-col", activeId ? "flex" : "hidden md:flex")}>
          {active ? (
            <Thread conversation={active} onBack={() => setActive(null)} />
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

function Avatar({ name, avatar, role }: { name: string; avatar: string | null; role: string }) {
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

function Thread({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const convId = conversation.id;

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", convId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  // Realtime + mark read
  useEffect(() => {
    if (!user?.id) return;
    supabase.rpc("mark_conversation_read", { _conversation_id: convId }).then(() => {
      qc.invalidateQueries({ queryKey: ["my-conversations", user.id] });
    });
    const channel = supabase
      .channel(`messages-${convId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          qc.setQueryData<Message[]>(["messages", convId], (prev = []) =>
            prev.some((m) => m.id === (payload.new as Message).id) ? prev : [...prev, payload.new as Message],
          );
          if ((payload.new as Message).sender_id !== user.id) {
            supabase.rpc("mark_conversation_read", { _conversation_id: convId });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [convId, user?.id, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !user?.id || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: user.id,
      body,
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar a mensagem.");
      setText(body);
    }
  };

  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded hover:bg-secondary" aria-label="Voltar">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Avatar name={conversation.name} avatar={conversation.avatar} role={conversation.role} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{conversation.name}</p>
          {conversation.role === "buyer" ? (
            <div className="flex items-center gap-3 text-[11px]">
              <Link to="/loja/$id" params={{ id: conversation.seller_id }} className="text-gold hover:underline">Ver loja</Link>
              {conversation.phone && <a href={`tel:${conversation.phone}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Phone className="w-3 h-3" /> {conversation.phone}</a>}
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">Cliente</span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2 bg-[linear-gradient(180deg,#f7f4ee_0%,#efe9de_100%)]">
        {isLoading ? (
          <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Sem mensagens. Escreva a primeira!</div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                    mine ? "bg-[#dcf8c6] text-ink rounded-br-sm" : "bg-white text-ink border border-black/5 rounded-bl-sm",
                  )}
                >
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          rows={1}
          placeholder="Escreva uma mensagem..."
          className="flex-1 resize-none max-h-28 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="w-10 h-10 shrink-0 rounded-full bg-ink text-gold grid place-items-center hover:bg-ink/90 disabled:opacity-40 transition-colors"
          aria-label="Enviar"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

    </>
  );
}
