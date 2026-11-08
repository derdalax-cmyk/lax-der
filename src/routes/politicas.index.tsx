import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { POLICIES } from "@/lib/policies";

const TITLE = "Políticas · Derdalax";
const DESC =
  "Consulte as políticas e os termos da Derdalax, incluindo os Termos e Condições de Uso e a Política de Privacidade e Dados.";

export const Route = createFileRoute("/politicas/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://derdalax.co.mz/politicas" }],
  }),
  component: PoliciesIndexPage,
});

function PoliciesIndexPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <Link
          to="/perfil"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-2xl md:text-3xl leading-tight text-foreground">Políticas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione uma política para ler em detalhe.
          </p>
        </div>

        <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {POLICIES.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.slug}>
                <Link
                  to="/politicas/$slug"
                  params={{ slug: p.slug }}
                  className="flex items-center gap-4 px-4 py-4 md:px-6 hover:bg-secondary/40 transition-colors"
                >
                  <span className={`h-11 w-11 shrink-0 rounded-xl ${p.tint} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${p.iconColor}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground leading-tight">{p.title}</span>
                    <span className="block text-sm text-muted-foreground mt-0.5 line-clamp-2">{p.short}</span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Dúvidas? Escreva para{" "}
            <a href="mailto:suporte@derdalax.co.mz" className="text-gold underline underline-offset-2">
              suporte@derdalax.co.mz
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
