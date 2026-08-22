import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { usePrivateUrl } from "@/hooks/usePrivateUrl";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, Pencil, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
};

type Breakdown = {
  avg_quality: number;
  avg_delivery: number;
  avg_service: number;
  distribution: Record<string, number>;
};

const DIMS = [
  { key: "quality" as const, label: "Qualidade do produto" },
  { key: "delivery" as const, label: "Prazo de entrega" },
  { key: "service" as const, label: "Atendimento" },
];

export function SellerReviews({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [scores, setScores] = useState({ quality: 0, delivery: 0, service: 0 });
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["seller-reviews", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_reviews", { _seller_id: sellerId });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });

  const { data: breakdown } = useQuery({
    queryKey: ["seller-breakdown", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_seller_rating_breakdown", { _seller_id: sellerId });
      if (error) throw error;
      return data as unknown as Breakdown;
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-seller-review", sellerId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("seller_reviews")
        .select("id,rating,rating_quality,rating_delivery,rating_service,comment")
        .eq("seller_id", sellerId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data ?? null) as
        | { id: string; rating: number; rating_quality: number | null; rating_delivery: number | null; rating_service: number | null; comment: string | null }
        | null;
    },
  });

  // Só compradores desta loja podem avaliar (a base de dados também exige isto).
  const { data: eligibleOrderId } = useQuery({
    queryKey: ["review-eligible-order", sellerId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("order_id, orders!inner(user_id,status)")
        .eq("seller_id", sellerId)
        .eq("orders.user_id", user!.id)
        .neq("orders.status", "cancelled")
        .limit(1);
      return (data?.[0]?.order_id as string | undefined) ?? null;
    },
  });



  const startEdit = () => {
    setScores({
      quality: mine?.rating_quality ?? mine?.rating ?? 0,
      delivery: mine?.rating_delivery ?? mine?.rating ?? 0,
      service: mine?.rating_service ?? mine?.rating ?? 0,
    });
    setComment(mine?.comment ?? "");
    setEditing(true);
  };

  const submit = async () => {
    if (!user) return;
    if (scores.quality < 1 || scores.delivery < 1 || scores.service < 1) {
      toast.error("Classifique as três categorias de 1 a 5 estrelas.");
      return;
    }
    if (!eligibleOrderId) {
      toast.error("Só pode avaliar esta loja depois de fazer um pedido com produtos dela.");
      return;
    }
    setSaving(true);
    const payload = {
      seller_id: sellerId,
      user_id: user.id,
      order_id: eligibleOrderId,
      rating_quality: scores.quality,
      rating_delivery: scores.delivery,
      rating_service: scores.service,
      rating: Math.round((scores.quality + scores.delivery + scores.service) / 3),
      comment: comment.trim() || null,
    };
    const { error } = await supabase
      .from("seller_reviews")
      .upsert(payload, { onConflict: "seller_id,user_id" });
    setSaving(false);
    if (error) { toast.error("Não foi possível guardar a avaliação."); return; }
    toast.success("Avaliação guardada. Obrigado!");
    setEditing(false);
    invalidate();
  };

  const remove = async () => {
    if (!mine) return;
    setSaving(true);
    const { error } = await supabase.from("seller_reviews").delete().eq("id", mine.id);
    setSaving(false);
    if (error) { toast.error("Não foi possível remover."); return; }
    toast.success("Avaliação removida.");
    setEditing(false);
    setScores({ quality: 0, delivery: 0, service: 0 });
    setComment("");
    invalidate();
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["seller-reviews", sellerId] });
    qc.invalidateQueries({ queryKey: ["seller-breakdown", sellerId] });
    qc.invalidateQueries({ queryKey: ["my-seller-review", sellerId, user?.id] });
    qc.invalidateQueries({ queryKey: ["public-seller", sellerId] });
  };

  const total = reviews.length;
  const dist = breakdown?.distribution ?? {};

  return (
    <div>
      {/* Breakdown */}
      {total > 0 && breakdown && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 grid sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = Number(dist[String(n)] ?? 0);
              const pct = total ? (c / total) * 100 : 0;
              return (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-8 flex items-center gap-0.5">{n}<Star className="w-3 h-3 fill-gold text-gold" /></span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted-foreground">{c}</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-2.5 sm:border-l sm:border-border sm:pl-5">
            {DIMS.map((d) => {
              const avg = Number((breakdown as never)[`avg_${d.key}`] ?? 0);
              return (
                <div key={d.key} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{d.label}</span>
                  <span className="flex items-center gap-1.5">
                    <StarRating value={Math.round(avg)} size={13} />
                    <span className="text-sm font-medium w-7 text-right">{avg.toFixed(1)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Write / edit review */}
      {!user ? (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 text-sm text-muted-foreground">
          <Link to="/login" className="text-gold font-medium hover:underline">Inicie sessão</Link> para avaliar esta loja.
        </div>
      ) : !mine && !eligibleOrderId ? (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 text-sm text-muted-foreground">
          Só pode avaliar esta loja depois de fazer um pedido com produtos dela.
        </div>
      ) : editing || !mine ? (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold mb-4">{mine ? "Editar a sua avaliação" : "Avaliar esta loja"}</h3>
          <div className="space-y-3 mb-4">
            {DIMS.map((d) => (
              <div key={d.key} className="flex items-center justify-between gap-3">
                <span className="text-sm">{d.label}</span>
                <StarRating value={scores[d.key]} size={24} onChange={(v) => setScores((s) => ({ ...s, [d.key]: v }))} />
              </div>
            ))}
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Partilhe a sua experiência (opcional)"
            rows={3}
            className="mb-3"
          />
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving} className="bg-gold text-ink hover:bg-gold/90">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar avaliação"}
            </Button>
            {mine && (
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">A sua avaliação</p>
              <StarRating value={mine.rating} size={18} />
              {mine.comment && <p className="text-sm mt-2 text-muted-foreground">{mine.comment}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={startEdit} aria-label="Editar"><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={remove} aria-label="Remover"><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <h3 className="font-semibold mb-3">Avaliações ({reviews.length})</h3>
      {isLoading ? (
        <div className="h-24 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : reviews.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-10 text-center text-muted-foreground">
          <MessageSquare className="w-7 h-7 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Ainda sem avaliações. Seja o primeiro!</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-secondary overflow-hidden grid place-items-center shrink-0 text-sm font-semibold">
                  <ReviewerAvatar value={r.reviewer_avatar} name={r.reviewer_name} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.reviewer_name}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-PT")}</p>
                </div>
                <StarRating value={r.rating} size={14} className="ml-auto" />
              </div>
              {r.comment && <p className="text-sm text-muted-foreground whitespace-pre-line">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewerAvatar({ value, name }: { value: string | null; name: string }) {
  const src = usePrivateUrl(value);
  if (!src) return <>{name.charAt(0).toUpperCase()}</>;
  return <img src={src} alt={name} className="w-full h-full object-cover" />;
}
