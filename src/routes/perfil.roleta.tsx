import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Gift, CircleSlash } from "lucide-react";
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

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Ativo", cls: "bg-success/15 text-success" },
  RESERVED: { label: "Reservado", cls: "bg-gold/15 text-gold" },
  REDEEMED: { label: "Utilizado", cls: "bg-secondary text-foreground" },
  EXPIRED: { label: "Expirado", cls: "bg-muted text-muted-foreground" },
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });

function RoletaPage() {
  const { campaign, mine } = useRoleta();
  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      <Link to="/perfil" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="w-4 h-4" /> Perfil</Link>
      <div className="rounded-2xl bg-ink text-white border border-gold/50 p-5 space-y-5">
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
        <section className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="font-display text-lg font-semibold">Histórico de giros</h2>
            <span className="text-xs text-muted-foreground">{mine.history.length} giro(s)</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Cada novo código é uma nova oportunidade. Boa sorte no próximo giro.</p>
          <ul className="space-y-2">
            {mine.history.map((h, i) => {
              const won = h.percent > 0;
              const st = won ? STATUS[h.status] : null;
              return (
                <li key={h.id ?? i} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2.5">
                  <span className={`h-9 w-9 shrink-0 rounded-lg grid place-items-center ${won ? "bg-ink text-gold" : "bg-secondary text-muted-foreground"}`}>
                    {won ? <Gift className="w-4 h-4" /> : <CircleSlash className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{won ? `Ganhou ${h.percent}%` : "Não ganhou"}</span>
                      {st && <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{fmtDate(h.won_at)} · {h.campaign}</p>
                    {won && h.expires_at && (h.status === "ACTIVE" || h.status === "RESERVED") && (
                      <p className="text-xs text-muted-foreground">Expira a {fmtDate(h.expires_at)}</p>
                    )}
                    {h.order_id && (
                      <Link to="/pedido/$id" params={{ id: h.order_id }} className="text-xs text-gold hover:underline">Pedido #{h.order_id.slice(0, 8).toUpperCase()}</Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
