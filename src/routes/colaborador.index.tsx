import { createFileRoute, Link } from "@tanstack/react-router";
import { useCollaborations } from "@/hooks/useCollaborations";
import { Store, ChevronRight, Loader2 } from "lucide-react";
import { CollaboratorStatusPill } from "@/components/admin/CollaboratorsSection";

export const Route = createFileRoute("/colaborador/")({
  component: CollaboratorHome,
});

function CollaboratorHome() {
  const { collaborations, loading } = useCollaborations();

  if (loading) {
    return <div className="min-h-[40vh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (collaborations.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gold/15 text-gold grid place-items-center mx-auto mb-5">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="font-display text-2xl mb-2">Sem lojas atribuídas</h1>
        <p className="text-sm text-muted-foreground">
          Ainda não foi atribuído a nenhuma loja. Fale com a administração da DERDALAX.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Minhas responsabilidades</h1>
      <p className="text-sm text-muted-foreground mb-5">Lojas onde pode trabalhar e a sua função em cada uma.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {collaborations.map((c) => {
          const active = c.status === "active";
          const card = (
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 h-full">
              <div className="w-12 h-12 rounded-xl bg-secondary overflow-hidden grid place-items-center shrink-0">
                {c.logo_url ? <img src={c.logo_url} alt={c.store_name} className="w-full h-full object-cover" /> : <Store className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{c.store_name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.role_label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {c.total_products} produtos · {c.pending_products} em revisão
                </div>
              </div>
              {active ? <ChevronRight className="w-5 h-5 text-gold shrink-0" /> : <CollaboratorStatusPill status={c.status} />}
            </div>
          );
          return active ? (
            <Link key={c.seller_id} to="/colaborador/$sellerId" params={{ sellerId: c.seller_id }} className="hover:border-gold/60 rounded-2xl">
              {card}
            </Link>
          ) : (
            <div key={c.seller_id} className="opacity-60">{card}</div>
          );
        })}
      </div>
    </div>
  );
}
