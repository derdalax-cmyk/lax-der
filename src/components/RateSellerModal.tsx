import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { invalidateSellerRatings } from "@/lib/sellerRatings";

const DIMS = [
  { key: "quality" as const, label: "Qualidade do produto" },
  { key: "delivery" as const, label: "Prazo de entrega" },
  { key: "service" as const, label: "Atendimento" },
];

export function RateSellerModal({
  open, onOpenChange, sellerId, sellerName, sellerLogo, orderId, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sellerId: string;
  sellerName: string;
  sellerLogo?: string | null;
  orderId?: string;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [scores, setScores] = useState({ quality: 0, delivery: 0, service: 0 });
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) { toast.error("Inicie sessão para avaliar."); return; }
    if (scores.quality < 1 || scores.delivery < 1 || scores.service < 1) {
      toast.error("Classifique as três categorias.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("seller_reviews").upsert({
      seller_id: sellerId,
      user_id: user.id,
      order_id: orderId ?? null,
      rating_quality: scores.quality,
      rating_delivery: scores.delivery,
      rating_service: scores.service,
      rating: Math.round((scores.quality + scores.delivery + scores.service) / 3),
      comment: comment.trim() || null,
    }, { onConflict: "seller_id,user_id" });
    setSaving(false);
    if (error) { toast.error("Não foi possível guardar a avaliação."); return; }
    toast.success("Obrigado pela sua avaliação!");
    await invalidateSellerRatings(qc, sellerId);
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-secondary overflow-hidden grid place-items-center shrink-0">
              {sellerLogo ? <img src={sellerLogo} alt="" className="w-full h-full object-cover" /> : <Store className="w-4 h-4 text-muted-foreground" />}
            </span>
            Classifique {sellerName}
          </DialogTitle>
          <DialogDescription>A sua opinião ajuda outros clientes na Derdalax.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {DIMS.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{d.label}</span>
              <StarRating value={scores[d.key]} size={26} onChange={(v) => setScores((s) => ({ ...s, [d.key]: v }))} />
            </div>
          ))}
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comentário (opcional)"
          rows={3}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Mais tarde</Button>
          <Button onClick={submit} disabled={saving} className="bg-gold text-ink hover:bg-gold/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar avaliação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
