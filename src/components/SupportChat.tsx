import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { openSupportThread, useSupportMessages } from "@/hooks/useSupport";
import { Loader2, Send, ImagePlus, X, CheckCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PRIVATE_BUCKET, privateRef } from "@/lib/privateStorage";
import { usePrivateUrl } from "@/hooks/usePrivateUrl";

/** Support chat surface (user side). Auto-creates thread + welcome message on mount. */
export function SupportChat() {
  const { user, loading } = useAuth();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let alive = true;
    (async () => {
      try {
        const id = await openSupportThread();
        if (alive) setThreadId(id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível abrir o suporte");
      } finally {
        if (alive) setStarting(false);
      }
    })();
    return () => { alive = false; };
  }, [user, loading]);

  const { data: messages = [], isLoading } = useSupportMessages(threadId);

  useEffect(() => {
    if (!threadId) return;
    supabase.rpc("mark_support_read", { _thread_id: threadId, _side: "user" });
  }, [threadId, messages.length]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!threadId || !user || sending) return;
    const body = text.trim();
    if (!body && !pendingImage) return;
    setSending(true);
    let image_url: string | null = null;
    try {
      if (pendingImage) {
        const ext = pendingImage.name.split(".").pop();
        const path = `support/${user.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, pendingImage, { upsert: false });
        if (error) throw error;
        image_url = privateRef(path);
      }
      const { error } = await supabase.from("support_messages").insert({
        thread_id: threadId, sender_id: user.id, is_admin: false, body: body || null, image_url,
      });
      if (error) throw error;
      setText("");
      setPendingImage(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;
  if (!user) {
    return (
      <div className="border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground bg-card">
        Inicie sessão para conversar com o suporte da DERDALAX.
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card flex flex-col h-[65vh] min-h-[420px]">
      <div className="px-4 py-3 border-b border-border bg-ink text-white flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gold text-ink grid place-items-center font-bold">D</div>
        <div>
          <p className="text-sm font-semibold leading-tight">Suporte DERDALAX</p>
          <p className="text-[11px] text-white/60">Normalmente responde em poucas horas</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2 bg-[linear-gradient(180deg,#f7f4ee_0%,#efe9de_100%)]">
        {(starting || isLoading) && (
          <div className="h-full grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        )}
        {!starting && !isLoading && messages.map((m) => {
          const mine = !m.is_admin;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                mine ? "bg-[#dcf8c6] text-ink rounded-br-sm" : "bg-white text-ink border border-black/5 rounded-bl-sm",
              )}>
                {m.image_url && <Attachment value={m.image_url} />}
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
          <ImagePlus className="w-4 h-4" />
          <span className="truncate flex-1">{pendingImage.name}</span>
          <button onClick={() => setPendingImage(null)} className="p-1 hover:bg-secondary rounded"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="border-t border-border p-2 flex items-end gap-2 bg-card">
        <label className="w-10 h-10 shrink-0 rounded-full grid place-items-center cursor-pointer hover:bg-secondary" title="Anexar imagem">
          <ImagePlus className="w-5 h-5 text-muted-foreground" />
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingImage(f); e.target.value = ""; }} />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Escreva uma mensagem..."
          className="flex-1 resize-none max-h-28 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        <button
          onClick={send}
          disabled={(!text.trim() && !pendingImage) || sending || !threadId}
          className="w-10 h-10 shrink-0 rounded-full bg-ink text-gold grid place-items-center hover:bg-ink/90 disabled:opacity-40"
          aria-label="Enviar"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function Attachment({ value }: { value: string }) {
  const src = usePrivateUrl(value);
  if (!src) return <div className="w-[220px] h-32 rounded-lg mb-1 bg-black/5 animate-pulse" />;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img src={src} alt="anexo" className="max-w-[220px] rounded-lg mb-1" />
    </a>
  );
}
