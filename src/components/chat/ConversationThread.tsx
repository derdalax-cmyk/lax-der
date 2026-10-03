import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { conversationsKey, EDIT_WINDOW_MS, type Message } from "@/hooks/useMessaging";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  conversationId: string;
  /** Classes for the scrollable message area (height control). */
  areaClassName?: string;
  compact?: boolean;
};

const messagesKey = (id: string) => ["messages", id] as const;

/** Single implementation of a conversation: load, realtime, read, send, edit, delete. */
export function ConversationThread({ conversationId, areaClassName, compact }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<Message | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Message | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Reset composer when switching conversation
  useEffect(() => { setText(""); setEditing(null); }, [conversationId]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: messagesKey(conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages").select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const markRead = () =>
      supabase.rpc("mark_conversation_read", { _conversation_id: conversationId }).then(() => {
        qc.invalidateQueries({ queryKey: conversationsKey(user.id) });
      });
    markRead();
    const upsert = (m: Message) =>
      qc.setQueryData<Message[]>(messagesKey(conversationId), (prev = []) =>
        prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m],
      );
    const channel = supabase
      .channel(`messages-${conversationId}-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const m = payload.new as Message;
        upsert(m);
        if (m.sender_id !== user.id) markRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        upsert(payload.new as Message);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user?.id, qc]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const refreshList = () => user?.id && qc.invalidateQueries({ queryKey: conversationsKey(user.id) });

  const submit = async () => {
    const body = text.trim();
    if (!body || !user?.id || sending) return;
    setSending(true);
    if (editing) {
      const target = editing;
      const { error } = await supabase.rpc("edit_message", { _message_id: target.id, _body: body });
      setSending(false);
      if (error) { toast.error(error.message || "Não foi possível editar."); return; }
      qc.setQueryData<Message[]>(messagesKey(conversationId), (prev = []) =>
        prev.map((m) => (m.id === target.id ? { ...m, body, edited_at: new Date().toISOString() } : m)),
      );
      setEditing(null);
      setText("");
      refreshList();
      return;
    }
    setText("");
    const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body });
    setSending(false);
    if (error) { toast.error("Não foi possível enviar a mensagem."); setText(body); }
  };

  const doDelete = async (m: Message) => {
    const { error } = await supabase.rpc("delete_message", { _message_id: m.id });
    setConfirmDelete(null);
    if (error) { toast.error(error.message || "Não foi possível apagar."); return; }
    qc.setQueryData<Message[]>(messagesKey(conversationId), (prev = []) =>
      prev.map((x) => (x.id === m.id ? { ...x, body: "", deleted_at: new Date().toISOString() } : x)),
    );
    if (editing?.id === m.id) { setEditing(null); setText(""); }
    refreshList();
  };

  const startEdit = (m: Message) => { setEditing(m); setText(m.body); };

  return (
    <>
      <div className={cn("flex-1 overflow-y-auto space-y-2 bg-[linear-gradient(180deg,#f7f4ee_0%,#efe9de_100%)]", compact ? "px-3 py-3" : "px-3 sm:px-5 py-4", areaClassName)}>
        {isLoading ? (
          <div className="h-full py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <div className="h-full py-10 grid place-items-center text-sm text-muted-foreground text-center px-4">Sem mensagens. Escreva a primeira!</div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const deleted = !!m.deleted_at;
            const canEdit = mine && !deleted && now - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;
            return (
              <div key={m.id} className={cn("group flex items-start gap-1", mine ? "justify-end" : "justify-start")}>
                {mine && !deleted && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="mt-1 p-1 rounded-full text-muted-foreground hover:bg-black/5" aria-label="Opções da mensagem">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && (
                        <DropdownMenuItem onClick={() => startEdit(m)}><Pencil className="w-3.5 h-3.5 mr-2" /> Editar</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setConfirmDelete(m)} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Apagar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                  mine ? "bg-[#dcf8c6] text-ink rounded-br-sm" : "bg-white text-ink border border-black/5 rounded-bl-sm",
                  editing?.id === m.id && "ring-2 ring-gold/50",
                )}>
                  {deleted ? (
                    <p className="italic text-black/50">Mensagem apagada</p>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  )}
                  <span className="block text-[10px] mt-0.5 text-black/50 text-right">
                    {m.edited_at && !deleted && "editada · "}
                    {new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {editing && (
        <div className="border-t border-border px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground bg-card">
          <Pencil className="w-3 h-3 text-gold" /> A editar mensagem
          <button onClick={() => { setEditing(null); setText(""); }} className="ml-auto p-1 rounded hover:bg-secondary" aria-label="Cancelar edição">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="border-t border-border p-2 flex items-end gap-2 bg-card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={1}
          placeholder="Escreva uma mensagem..."
          className="flex-1 resize-none max-h-28 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || sending}
          className={cn("shrink-0 rounded-full bg-ink text-gold grid place-items-center hover:bg-ink/90 disabled:opacity-40 transition-colors", compact ? "w-9 h-9" : "w-10 h-10")}
          aria-label={editing ? "Guardar" : "Enviar"}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar mensagem?</AlertDialogTitle>
            <AlertDialogDescription>A mensagem será substituída por "Mensagem apagada" para ambos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && doDelete(confirmDelete)}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
