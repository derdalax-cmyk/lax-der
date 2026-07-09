import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2, Pencil, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
};

export function SellerReviews({ sellerId }: { sellerId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
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

  // Determine my existing review by querying own row (reviews rpc omits user_id)

  const { data: mine } = useQuery({
    queryKey: ["my-seller-review", sellerId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("seller_reviews")
        .select("id,rating,comment")
        .eq("seller_id", sellerId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data ?? null) as { id: string; rating: number; comment: string | null } | null;
    },
  });

  const startEdit = () => {
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? "");
    setEditing(true);
  };

  const submit = async () => {
    if (!user) return;
    if (rating < 1) { toast.error("Escolha uma nota de 1 a 5 estrelas."); return; }
    setSaving(true);
    const payload = { seller_id: sellerId, user_id: user.id, rating, comment: comment.trim() || null };
    const { error } = await supabase
      .from("seller_reviews")
      .upsert(payload, { onConflict: "seller_id,user_id" });
    setSaving(false);
    if (error) { toast.error("Não foi possível guardar a avaliação."); return; }
    toast.success("Avaliação guardada. Obrigado!");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["seller-reviews", sellerId] });
    qc.invalidateQueries({ queryKey: ["my-seller-review", sellerId, user.id] });
    qc.invalidateQueries({ queryKey: ["public-seller", sellerId] });
  };

  const remove = async () => {
    if (!mine) return;
    setSaving(true);
    const { error } = await supabase.from("seller_reviews").delete().eq("id", mine.id);
    setSaving(false);
    if (error) { toast.error("Não foi possível remover."); return; }
    toast.success("Avaliação removida.");
    setEditing(false);
    setRating(0); setComment("");
    qc.invalidateQueries({ queryKey: ["seller-reviews", sellerId] });
    qc.invalidateQueries({ queryKey: ["my-seller-review", sellerId, user?.id] });
    qc.invalidateQueries({ queryKey: ["public-seller", sellerId] });
  };

  return (
    <div>
      {/* Write / edit review */}
      {!user ? (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 text-sm text-muted-foreground">
          <Link to="/login" className="text-gold font-medium hover:underline">Inicie sessão</Link> para avaliar esta loja.
        </div>
      ) : editing || !mine ? (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold mb-3">{mine ? "Editar a sua avaliação" : "Avaliar esta loja"}</h3>
          <StarRating value={rating} size={28} onChange={setRating} className="mb-3" />
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
                  {r.reviewer_avatar ? (
                    <img src={r.reviewer_avatar} alt={r.reviewer_name} className="w-full h-full object-cover" />
                  ) : (
                    r.reviewer_name.charAt(0).toUpperCase()
                  )}
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
