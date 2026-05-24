import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Truck, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DERDALAX · Moda com história em Moçambique" },
      { name: "description", content: "Descubra peças únicas e coleções selecionadas. Entrega em todo o Moçambique." },
      { property: "og:title", content: "DERDALAX · Moda com história" },
      { property: "og:description", content: "Peças únicas e coleções selecionadas, entregues em todo o Moçambique." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      {/* HERO */}
      <section className="relative bg-ink text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: "var(--gradient-dark)" }} />
        <div className="absolute top-1/2 -right-32 w-[600px] h-[600px] rounded-full bg-gold/20 blur-3xl -translate-y-1/2" />
        <div className="relative max-w-[1400px] mx-auto px-5 py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 text-gold text-xs uppercase tracking-widest mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Nova coleção
            </div>
            <h1 className="font-display text-5xl md:text-7xl leading-[1.05] mb-6">
              Moda com <span className="text-gold italic">história</span>.
            </h1>
            <p className="text-lg text-white/70 max-w-md mb-8 leading-relaxed">
              Peças únicas, escolhidas a dedo. Da coleção limitada ao essencial diário — entregamos em todo Moçambique.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/produtos"
                className="inline-flex items-center gap-2 bg-gold text-ink px-6 py-3 rounded-md font-medium hover:bg-gold/90 transition-colors"
              >
                Explorar coleção <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/categorias"
                className="inline-flex items-center gap-2 border border-white/20 text-white px-6 py-3 rounded-md font-medium hover:bg-white/5 transition-colors"
              >
                Ver categorias
              </Link>
            </div>
          </div>

          <div className="hidden md:block relative">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-white/10" style={{ background: "var(--gradient-gold)" }}>
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-display text-9xl text-ink/20">D</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-16 border-b border-border">
        <div className="max-w-[1400px] mx-auto px-5 grid md:grid-cols-3 gap-8">
          {[
            { icon: Truck, title: "Entrega rápida", desc: "Em todas as principais cidades de Moçambique." },
            { icon: ShieldCheck, title: "Pagamento seguro", desc: "e-Mpesa e e-Mola integrados." },
            { icon: Sparkles, title: "Peças únicas", desc: "Coleções limitadas que ninguém mais terá." },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5 text-ink" />
              </div>
              <div>
                <h3 className="font-display text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-5 text-center">
          <h2 className="font-display text-4xl md:text-5xl mb-4">A loja em construção</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Em breve: catálogo completo, carrinho, checkout em 3 etapas e painel admin.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 bg-ink text-white px-6 py-3 rounded-md font-medium hover:bg-ink/90">
            Entrar / Criar conta
          </Link>
        </div>
      </section>
    </>
  );
}
