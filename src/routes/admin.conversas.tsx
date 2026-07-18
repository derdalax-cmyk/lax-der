import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSupportMessages } from "@/hooks/useSupport";
import { Loader2, Send, ImagePlus, X, CheckCheck, Check, MessagesSquare, ChevronLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/conversas")({
  component: AdminConversas,
});

type AdminThread = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  admin_unread: number;
  resolved: boolean;
};

function relTime(iso: string | null) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function AdminConversas() {
  const qc = useQueryClient();
  const [active, setActive] = useState<AdminThread | null>(null);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["admin-support-threads"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_support_threads");
      if (error) throw error;
      return (data ?? []) as unknown as AdminThread[];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase.channel("admin-support-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-support-threads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-3xl">Conversas</h1>
        <p className="text-sm text-muted-foreground">Mensagens de suporte com os clientes.</p>
      </div>
      <div className="grid md:grid-cols-[320px_1fr] border border-border rounded-2xl overflow-hidden bg-card h-[calc(100vh-220px)] min-h-[500px]">
        <aside className={cn("border-r border-border overflow-y-auto", active ? "hidden md:block" : "block")}>
          {isLoading ? (
            <div className="py-16 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : threads.length === 0 ? (
            <div className="py-16 px-6 text-center text-sm text-muted-foreground">
              <MessagesSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
              Sem conversas ainda.
            </div>
          ) : threads.map((t) => (
            <button key={t.id} onClick={() => setActive(t)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border last:border-0 hover:bg-secondary/50",
                active?.id === t.id && "bg-secondary",
              )}>
              <div className="w-10 h-10 rounded-full bg-secondary grid place-items-center overflow-hidden shrink-0">
                {t.avatar ? <img src={t.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-semibold">{(t.name?.[0] ?? "?").toUpperCase()}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{relTime(t.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">{t.last_message ?? "Nova conversa"}</span>
                  {t.admin_unread > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[10px] font-bold grid place-items-center shrink-0">
                      {t.admin_unread > 9 ? "9+" : t.admin_unread}
                    </span>
                  )}
                  {t.resolved && <span className="text-[10px] text-success shrink-0">✓ resolvida</span>}
                </div>
              </div>
            </button>
          ))}
        </aside>

        <section className={cn("min-w-0 flex flex-col", active ? "flex" : "hidden md:flex")}>
          {active ? <AdminThreadPane thread={active} onBack={() => setActive(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["admin-support-threads"] })} /> : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground px-6 text-center">
              Selecione uma conversa.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AdminThreadPane({ thread, onBack, onChanged }: { thread: AdminThread; onBack: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = useSupportMessages(thread.id);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.rpc("mark_support_read", { _thread_id: thread.id, _side: "admin" }).then(onChanged);
  }, [thread.id, messages.length, onChanged]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if ((!body && !pendingImage) || sending || !user) return;
    setSending(true);
    let image_url: string | null = null;
    try {
      if (pendingImage) {
        const ext = pendingImage.name.split(".").pop();
        const path = `support/admin/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("products").upload(path, pendingImage, { upsert: false });
        if (error) throw error;
        image_url = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from("support_messages").insert({
        thread_id: thread.id, sender_id: user.id, is_admin: true, body: body || null, image_url,
      });
      if (error) throw error;
      setText(""); setPendingImage(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally { setSending(false); }
  };

  const toggleResolved = async () => {
    const { error } = await supabase.from("support_threads").update({ resolved: !thread.resolved }).eq("id", thread.id);
    if (error) toast.error(error.message); else { toast.success(thread.resolved ? "Reaberta" : "Marcada como resolvida"); onChanged(); }
  };

  return (
    <>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="md:hidden p-1 -ml-1 rounded hover:bg-secondary" aria-label="Voltar">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-secondary grid place-items-center overflow-hidden">
          {thread.avatar ? <img src={thread.avatar} alt="" className="w-full h-full object-cover" /> : <span className="font-semibold">{(thread.name?.[0] ?? "?").toUpperCase()}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{thread.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{thread.email}</p>
        </div>
        <button onClick={toggleResolved}
          className={cn("text-xs px-3 py-1.5 rounded-full border flex items-center gap-1",
            thread.resolved ? "border-success text-success" : "border-border hover:bg-secondary")}>
          <CheckCircle2 className="w-3.5 h-3.5" /> {thread.resolved ? "Resolvida" : "Marcar resolvida"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2 bg-[linear-gradient(180deg,#f7f4ee_0%,#efe9de_100%)]">
        {isLoading ? (
          <div className="h-full grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : messages.map((m) => {
          const mine = m.is_admin;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                mine ? "bg-[#dcf8c6] text-ink rounded-br-sm" : "bg-white text-ink border border-black/5 rounded-bl-sm")}>
                {m.image_url && (
                  <a href={m.image_url} target="_blank" rel="noopener noreferrer">
                    <img src={m.image_url} alt="anexo" className="max-w-[220px] rounded-lg mb-1" />
                  </a>
                )}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <span className="flex items-center gap-1 justify-end text-[10px] text-black/50 mt-0.5">
                  {new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                  {mine && (m.read ? <CheckCheck className="w-3 h-3 text-blue-500" /> : <Check className="w-3 h-3" />)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {pendingImage && (
        <div className="px-4 py-2 border-t border-border flex items-center gap-2 text-xs bg-secondary/50">
          <ImagePlus className="w-4 h-4" /><span className="truncate flex-1">{pendingImage.name}</span>
          <button onClick={() => setPendingImage(null)} className="p-1 hover:bg-secondary rounded"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="border-t border-border p-2 flex items-end gap-2 bg-card">
        <label className="w-10 h-10 shrink-0 rounded-full grid place-items-center cursor-pointer hover:bg-secondary" title="Anexar imagem">
          <ImagePlus className="w-5 h-5 text-muted-foreground" />
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingImage(f); e.target.value = ""; }} />
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1} placeholder="Escreva uma resposta..."
          className="flex-1 resize-none max-h-28 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40" />
        <button onClick={send} disabled={(!text.trim() && !pendingImage) || sending}
          className="w-10 h-10 shrink-0 rounded-full bg-ink text-gold grid place-items-center hover:bg-ink/90 disabled:opacity-40" aria-label="Enviar">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </>
  );
}
