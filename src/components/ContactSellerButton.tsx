import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageSquare, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeller } from "@/hooks/useSeller";
import { startConversation } from "@/hooks/useMessaging";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { currentPath } from "@/lib/safeRedirect";

type Props = {
  sellerId: string;
  productId?: string | null;
  className?: string;
  label?: string;
};

export function ContactSellerButton({ sellerId, productId, className, label = "Contactar vendedor" }: Props) {
  const { user } = useAuth();
  const { seller } = useSeller();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Don't let a seller message their own store
  if (seller?.id === sellerId) return null;

  const handle = async () => {
    if (!user) {
      const redirect = currentPath();
      navigate({ to: "/login", search: redirect ? { redirect } : {} });
      return;
    }
    setLoading(true);
    try {
      const convId = await startConversation(sellerId, productId);
      navigate({ to: "/mensagens", search: { c: convId } });
    } catch {
      toast.error("Não foi possível iniciar a conversa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-gold/60 hover:text-gold disabled:opacity-50",
        className,
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
      {label}
    </button>
  );
}
