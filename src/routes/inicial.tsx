import { createFileRoute, Link } from "@tanstack/react-router";
import { AboutDerdalax } from "@/components/AboutDerdalax";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const DESC =
  "Plataforma de compra e venda de roupas da calamidade em Moçambique. Encontre peças, compre diretamente aos vendedores ou anuncie os seus produtos na Derdalax.";

export const Route = createFileRoute("/inicial")({
  head: () => ({
    meta: [
      { title: "Derdalax — Marketplace de Roupas da Calamidade em Moçambique" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Derdalax — Marketplace de Roupas da Calamidade em Moçambique" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InicialPage,
});

function InicialPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-3xl mx-auto px-5 pt-14 text-center">
        <p className="font-display text-sm font-bold tracking-widest text-gold">Derdalax</p>
        <h1 className="mt-3 font-display text-3xl md:text-5xl text-foreground">
          Moda da Calamidade, direto dos vendedores
        </h1>
      </header>
      <AboutDerdalax />
      <section className="max-w-md mx-auto px-5 pb-16 text-center">
        {user ? (
          <Button asChild className="bg-gold text-ink hover:bg-gold/90">
            <Link to="/">Ir para a loja</Link>
          </Button>
        ) : (
          <div className="border border-border bg-card p-6">
            <h2 className="font-display text-xl text-foreground">Crie a sua conta ou entre</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Guarde favoritos, acompanhe pedidos e fale com os vendedores.
            </p>
            <div className="mt-4 flex gap-2">
              <Button asChild className="flex-1 bg-gold text-ink hover:bg-gold/90">
                <Link to="/login" search={{ mode: "signup" }}>Criar conta</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/login">Entrar</Link>
              </Button>
            </div>
          </div>
        )}
        <Link to="/politica-privacidade" className="mt-6 inline-block text-xs text-muted-foreground underline">
          Política de Privacidade
        </Link>
      </section>
    </div>
  );
}
