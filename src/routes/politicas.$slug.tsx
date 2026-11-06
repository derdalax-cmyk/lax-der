import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { POLICIES, type Policy } from "@/lib/policies";

export const Route = createFileRoute("/politicas/$slug")({
  head: ({ params }) => {
    const p = POLICIES.find((x) => x.slug === params.slug);
    const title = p ? `${p.title} · DERDALAX` : "Políticas · DERDALAX";
    const description = p?.short ?? "Políticas da DERDALAX";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  loader: ({ params }) => {
    const policy = POLICIES.find((x) => x.slug === params.slug);
    if (!policy) throw notFound();
    return { slug: policy.slug };
  },
  component: PolicyPage,
});

function PolicyPage() {
  const { slug } = Route.useLoaderData() as { slug: string };
  const policy = POLICIES.find((p) => p.slug === slug) as Policy;
  const Icon = policy.icon;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <Link
          to="/perfil"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <span className={`h-14 w-14 shrink-0 rounded-2xl ${policy.tint} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${policy.iconColor}`} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-3xl leading-tight text-foreground">{policy.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{policy.short}</p>
          </div>
        </div>

        <article className="space-y-8">
          {policy.sections.map((s, i) => (
            <section key={i}>
              {s.heading && (
                <h2 className="font-semibold text-lg text-foreground mb-3">{s.heading}</h2>
              )}
              <div className="space-y-3">
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-[15px] leading-relaxed text-muted-foreground">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

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
