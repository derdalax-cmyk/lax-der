import { Link } from "@tanstack/react-router";
import { ArrowRight, Store } from "lucide-react";

/** Full institutional text, used on /inicial. */
export function AboutDerdalax() {
  return (
    <section aria-labelledby="sobre-derdalax" className="py-16 border-t border-border">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <h2 id="sobre-derdalax" className="font-display text-3xl md:text-4xl text-gold mb-4">DERDALAX</h2>
        <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
          A DERDALAX é um marketplace de moda em Moçambique que reúne vendedores de roupas, calçados e
          acessórios da calamidade (brechó) num só lugar.
        </p>
        <p className="mt-4 text-base md:text-lg leading-relaxed text-muted-foreground">
          Descubra peças, consulte os vendedores, compre diretamente e, se quiser, também pode vender os
          seus produtos através da plataforma.
        </p>
        <p className="mt-6 font-display text-lg md:text-xl text-foreground">
          Encontre. Escolha. Compre. Venda.
        </p>
      </div>
    </section>
  );
}

/** Compact, clickable card for the homepage, linking to /inicial. */
export function AboutDerdalaxCard() {
  return (
    <section aria-labelledby="sobre-derdalax-card" className="pb-16">
      <div className="max-w-[1400px] mx-auto px-5">
        <Link
          to="/inicial"
          className="group flex gap-4 items-start border-t border-border pt-8 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
            <Store className="w-5 h-5 text-ink" />
          </div>
          <div className="flex-1">
            <h3 id="sobre-derdalax-card" className="font-display text-lg mb-1 group-hover:text-gold transition-colors">
              Sobre a DERDALAX
            </h3>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Um marketplace de moda em Moçambique onde vários vendedores apresentam roupas, calçados e acessórios
              em segunda mão / brechó. Descubra peças, compre, venda e fale diretamente com os vendedores.
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-gold">
              Conhecer a DERDALAX <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
