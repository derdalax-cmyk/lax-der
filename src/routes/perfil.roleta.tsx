import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useRoleta } from "@/hooks/useRoleta";
import { RoletaPanel } from "@/components/roleta/RoletaPanel";

export const Route = createFileRoute("/perfil/roleta")({
  head: () => ({ meta: [
    { title: "Roleta de Descontos · DERDALAX" },
    { name: "description", content: "Desbloqueie a Roleta DERDALAX com um código ou convidando amigos e ganhe desconto." },
    { property: "og:title", content: "Roleta de Descontos · DERDALAX" },
    { property: "og:description", content: "Desbloqueie a Roleta DERDALAX e ganhe desconto." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RoletaPage,
});

const STATUS: Record<string, string> = { ACTIVE: "Ativo", RESERVED: "Reservado", REDEEMED: "Utilizado", EXPIRED: "Expirado", LOST: "Não ganhou" };

function RoletaPage() {
  const { campaign, mine } = useRoleta();
  return (
    <div className="max-w-xl mx-auto px-5 py-8 space-y-6">
      <Link to="/perfil" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" /> Perfil</Link>
      <div className="rounded-2xl bg-ink text-white border border-gold/50 p-6 space-y-5">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Roleta DERDALAX</p>
          <h1 className="font-display text-3xl">{campaign ? <>Ganhe até <span className="text-gold">{campaign.max_percent}%</span> de desconto</> : "Roleta de Descontos"}</h1>
          {campaign && <p className="text-sm text-white/60 mt-1">{campaign.name}</p>}
        </div>
        <div className="[&_label]:text-white [&_.text-muted-foreground]:text-white/60">
          <RoletaPanel />
        </div>
      </div>
      {!!mine?.history?.length && (
        <section className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-medium mb-3">Histórico</h2>
          <ul className="divide-y divide-border text-sm">
            {mine.history.map((h, i) => (
              <li key={i} className="py-2 flex justify-between gap-3">
                <span>{h.campaign} · {new Date(h.won_at).toLocaleDateString("pt-PT")}</span>
                <span className="text-muted-foreground">{h.percent > 0 ? `-${h.percent}% · ` : ""}{STATUS[h.status] ?? h.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
