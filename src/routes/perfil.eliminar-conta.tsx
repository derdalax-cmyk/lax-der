import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AccountDeletionFlow } from "@/components/profile/AccountDeletionFlow";

export const Route = createFileRoute("/perfil/eliminar-conta")({
  head: () => ({
    meta: [
      { title: "Excluir conta · DERDALAX" },
      { name: "description", content: "Apagar permanentemente a sua conta DERDALAX e os seus dados pessoais." },
      { property: "og:title", content: "Excluir conta · DERDALAX" },
      { property: "og:description", content: "Apagar permanentemente a sua conta DERDALAX e os seus dados pessoais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExcluirContaPage,
});

function ExcluirContaPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-5 py-6 sm:py-10">
      <Link to="/perfil" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar ao perfil
      </Link>

      <div className="bg-card border border-border rounded-3xl mt-4 p-5 sm:p-8 shadow-sm">
        <AccountDeletionFlow />
      </div>
    </div>
  );
}
